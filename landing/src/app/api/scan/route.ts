import { NextRequest, NextResponse } from "next/server";
import { scanSkill } from "@/lib/scanner/engine";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { createGunzip } from "node:zlib";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

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
): Promise<string | null> {
  // Get package metadata from npm registry
  const metaRes = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName).replace("%40", "@")}`
  );
  if (!metaRes.ok) return null;

  const meta = await metaRes.json();
  const latest = meta["dist-tags"]?.latest;
  if (!latest) return null;

  const versionData = meta.versions?.[latest];
  if (!versionData?.dist?.tarball) return null;

  const tarballUrl = versionData.dist.tarball;

  // Download tarball
  const tarRes = await fetch(tarballUrl);
  if (!tarRes.ok || !tarRes.body) return null;

  const tgzPath = join(workDir, "package.tgz");
  const nodeStream = Readable.fromWeb(tarRes.body as import("stream/web").ReadableStream);
  await pipeline(nodeStream, createWriteStream(tgzPath));

  // Extract using tar (available on Vercel's Amazon Linux)
  try {
    execSync(`tar xzf "${tgzPath}" -C "${workDir}"`, {
      timeout: 15000,
      stdio: "pipe",
    });
  } catch {
    return null;
  }

  const packageDir = join(workDir, "package");
  return existsSync(packageDir) ? packageDir : null;
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
    const packageDir = await downloadAndExtract(packageName, workDir);
    if (!packageDir) {
      return NextResponse.json(
        {
          error: `Could not download "${target}". Make sure the npm package name is correct.`,
        },
        { status: 404 }
      );
    }

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
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}
