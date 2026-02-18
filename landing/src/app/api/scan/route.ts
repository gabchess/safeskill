import { NextRequest, NextResponse } from "next/server";
import { scanSkill } from "@/lib/scanner/engine";
import { execSync } from "node:child_process";
import { mkdtempSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

export const maxDuration = 60;

function sanitizePackageName(input: string): string | null {
  // Accept npm package names: @scope/name or name
  // Also accept github URLs: github.com/user/repo
  let cleaned = input.trim();

  // Handle GitHub URLs
  const ghMatch = cleaned.match(
    /(?:https?:\/\/)?github\.com\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)/
  );
  if (ghMatch) {
    return `github:${ghMatch[1]}`;
  }

  // Strip leading https://www.npmjs.com/package/ if present
  const npmMatch = cleaned.match(
    /(?:https?:\/\/)?(?:www\.)?npmjs\.com\/package\/([@a-zA-Z0-9_.\-/]+)/
  );
  if (npmMatch) {
    cleaned = npmMatch[1];
  }

  // Validate npm package name
  if (/^(@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { target } = body;
  if (!target || typeof target !== "string") {
    return NextResponse.json(
      { error: "Please provide a package name or GitHub URL." },
      { status: 400 }
    );
  }

  const packageId = sanitizePackageName(target);
  if (!packageId) {
    return NextResponse.json(
      {
        error:
          "Invalid input. Please provide an npm package name (e.g. @modelcontextprotocol/server-filesystem) or a GitHub URL.",
      },
      { status: 400 }
    );
  }

  const workDir = mkdtempSync(join(tmpdir(), "safeskill-web-"));

  try {
    // Download the package
    try {
      execSync(`npm pack "${packageId}" --pack-destination "${workDir}" 2>/dev/null`, {
        timeout: 30000,
        stdio: "pipe",
      });
    } catch {
      return NextResponse.json(
        { error: `Could not download "${target}". Make sure the package name is correct.` },
        { status: 404 }
      );
    }

    // Extract
    const tarballs = execSync(`ls "${workDir}"/*.tgz 2>/dev/null`, {
      encoding: "utf-8",
      stdio: "pipe",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    if (tarballs.length === 0) {
      return NextResponse.json(
        { error: "Package downloaded but could not be extracted." },
        { status: 500 }
      );
    }

    execSync(`tar xzf "${tarballs[0]}" -C "${workDir}" 2>/dev/null`, {
      stdio: "pipe",
    });

    const packageDir = join(workDir, "package");
    if (!existsSync(packageDir)) {
      return NextResponse.json(
        { error: "Package extracted but has unexpected structure." },
        { status: 500 }
      );
    }

    // Scan
    const result = await scanSkill(packageDir);
    result.skillName = target;

    return NextResponse.json({
      skillName: result.skillName,
      score: result.score,
      rating: result.rating,
      findings: result.findings,
      scannedFiles: result.scannedFiles,
      scanDuration: result.scanDuration,
    });
  } finally {
    // Cleanup
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
