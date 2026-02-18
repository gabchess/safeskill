import { NextRequest, NextResponse } from "next/server";
import { scanSkill } from "@/lib/scanner/engine";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { extract } from "tar";

export const maxDuration = 60;

function sanitizePackageName(input: string): string | null {
  let cleaned = input.trim();

  // Handle GitHub URLs — not supported in serverless, only npm
  if (/github\.com/.test(cleaned)) {
    return null;
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

async function downloadAndExtract(
  packageName: string,
  workDir: string
): Promise<{ path: string } | { error: string }> {
  // Get package metadata from npm registry
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName).replace("%40", "@")}`;
  const metaRes = await fetch(registryUrl);
  if (!metaRes.ok) return { error: `Registry returned ${metaRes.status} for ${registryUrl}` };

  const meta = await metaRes.json();
  const latest = meta["dist-tags"]?.latest;
  if (!latest) return { error: "No latest version found in dist-tags" };

  const versionData = meta.versions?.[latest];
  if (!versionData?.dist?.tarball) return { error: `No tarball URL for version ${latest}` };

  const tarballUrl = versionData.dist.tarball;

  // Download tarball
  const tarRes = await fetch(tarballUrl);
  if (!tarRes.ok) return { error: `Tarball download failed: ${tarRes.status}` };
  if (!tarRes.body) return { error: "Tarball response has no body" };

  const tgzPath = join(workDir, "package.tgz");

  // Write tarball to disk using arrayBuffer (more compatible than streams)
  const arrayBuf = await tarRes.arrayBuffer();
  writeFileSync(tgzPath, Buffer.from(arrayBuf));

  // Extract tarball using tar npm package (no system tar needed)
  try {
    await extract({ file: tgzPath, cwd: workDir });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `tar extract failed: ${msg}` };
  }

  const packageDir = join(workDir, "package");
  if (!existsSync(packageDir)) {
    return { error: "Extracted but no 'package' directory found" };
  }
  return { path: packageDir };
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }

  const { target } = body;
  if (!target || typeof target !== "string") {
    return NextResponse.json(
      { error: "Please provide an npm package name." },
      { status: 400 }
    );
  }

  if (/github\.com/.test(target)) {
    return NextResponse.json(
      {
        error:
          "GitHub URLs are not supported in the web scanner. Please provide an npm package name instead.",
      },
      { status: 400 }
    );
  }

  const packageName = sanitizePackageName(target);
  if (!packageName) {
    return NextResponse.json(
      {
        error:
          "Invalid package name. Use an npm package name like @modelcontextprotocol/server-filesystem",
      },
      { status: 400 }
    );
  }

  const workDir = mkdtempSync(join(tmpdir(), "safeskill-"));

  try {
    const downloadResult = await downloadAndExtract(packageName, workDir);
    if ("error" in downloadResult) {
      return NextResponse.json(
        {
          error: `Could not download "${target}". ${downloadResult.error}`,
        },
        { status: 404 }
      );
    }

    const result = await scanSkill(downloadResult.path);
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
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
