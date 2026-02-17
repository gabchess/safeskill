#!/usr/bin/env node
/**
 * Bulk scanner: downloads MCP packages from npm and scans each one with SafeSkill.
 * Outputs results to a JSON file for blog post analysis.
 *
 * Usage: npx tsx scripts/scan-registry.ts
 */

import { scanSkill } from "../src/scanner/engine.js";
import type { SkillScanResult, Finding } from "../src/scanner/types.js";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

// ── Config ──────────────────────────────────────────────────────────────────
const WORK_DIR = join(tmpdir(), "safeskill-bulk-scan");
const OUTPUT_FILE = join(homedir(), "safeskill", "clawhub-scan-results.json");
const CONCURRENCY = 5;
const NPM_SEARCH_QUERIES = [
  "mcp-server",
  "mcp+server",
  "keywords:mcp",
  "keywords:model-context-protocol",
  "mcp+tool",
  "@modelcontextprotocol",
];
const SEARCH_SIZE = 250;

// ── Types ───────────────────────────────────────────────────────────────────
interface PackageInfo {
  name: string;
  version: string;
  description: string;
  publisher?: string;
  date?: string;
  links?: { npm?: string; repository?: string };
}

interface ScanResultEntry {
  package: PackageInfo;
  scan: SkillScanResult | null;
  error?: string;
  downloadedAt: string;
}

interface BulkScanResults {
  metadata: {
    scannedAt: string;
    totalPackages: number;
    totalScanned: number;
    totalFailed: number;
    totalFindings: number;
    scanDuration: number;
  };
  summary: {
    byRating: { GREEN: number; YELLOW: number; RED: number };
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
      info: number;
    };
    topRules: { ruleId: string; title: string; count: number }[];
    averageScore: number;
    medianScore: number;
    worstPackages: { name: string; score: number; findings: number }[];
  };
  results: ScanResultEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────
async function searchNpm(query: string): Promise<PackageInfo[]> {
  const results: PackageInfo[] = [];
  let from = 0;

  while (true) {
    const url = `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=${SEARCH_SIZE}&from=${from}`;
    const res = await fetch(url);
    if (!res.ok) break;

    const data = (await res.json()) as {
      objects: {
        package: {
          name: string;
          version: string;
          description: string;
          publisher?: { username: string };
          date: string;
          links?: { npm?: string; repository?: string };
        };
      }[];
      total: number;
    };

    if (data.objects.length === 0) break;

    for (const obj of data.objects) {
      results.push({
        name: obj.package.name,
        version: obj.package.version,
        description: obj.package.description || "",
        publisher: obj.package.publisher?.username,
        date: obj.package.date,
        links: obj.package.links,
      });
    }

    from += data.objects.length;
    if (from >= data.total || data.objects.length < SEARCH_SIZE) break;
  }

  return results;
}

function isMcpRelated(pkg: PackageInfo): boolean {
  const text = `${pkg.name} ${pkg.description}`.toLowerCase();
  return (
    text.includes("mcp") ||
    text.includes("model context protocol") ||
    text.includes("model-context-protocol")
  );
}

async function downloadPackage(
  name: string,
  targetDir: string
): Promise<boolean> {
  try {
    if (existsSync(targetDir)) {
      await rm(targetDir, { recursive: true });
    }
    await mkdir(targetDir, { recursive: true });
    execSync(`npm pack "${name}" --pack-destination "${targetDir}" 2>/dev/null`, {
      timeout: 30000,
      stdio: "pipe",
    });

    // Extract the tarball
    const tarballs = execSync(`ls "${targetDir}"/*.tgz 2>/dev/null`, {
      encoding: "utf-8",
      stdio: "pipe",
    })
      .trim()
      .split("\n")
      .filter(Boolean);

    if (tarballs.length === 0) return false;

    execSync(`tar xzf "${tarballs[0]}" -C "${targetDir}" 2>/dev/null`, {
      stdio: "pipe",
    });

    // npm pack extracts to a 'package' subdirectory
    return existsSync(join(targetDir, "package"));
  } catch {
    return false;
  }
}

async function scanPackage(
  pkg: PackageInfo,
  index: number,
  total: number
): Promise<ScanResultEntry> {
  const safeName = pkg.name.replace(/[@/]/g, "_");
  const targetDir = join(WORK_DIR, "packages", safeName);

  process.stdout.write(
    `[${index + 1}/${total}] Scanning ${pkg.name}...`
  );

  const entry: ScanResultEntry = {
    package: pkg,
    scan: null,
    downloadedAt: new Date().toISOString(),
  };

  const downloaded = await downloadPackage(pkg.name, targetDir);
  if (!downloaded) {
    entry.error = "download_failed";
    process.stdout.write(" DOWNLOAD FAILED\n");
    return entry;
  }

  try {
    const result = await scanSkill(join(targetDir, "package"));
    result.skillName = pkg.name;
    entry.scan = result;

    const icon =
      result.rating === "RED"
        ? "RED"
        : result.rating === "YELLOW"
          ? "YLW"
          : "GRN";
    process.stdout.write(
      ` ${icon} ${result.score}/100 (${result.findings.length} findings, ${result.scannedFiles} files)\n`
    );
  } catch (err) {
    entry.error = `scan_error: ${(err as Error).message}`;
    process.stdout.write(" SCAN ERROR\n");
  }

  return entry;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log("SafeSkill Bulk Scanner");
  console.log("=".repeat(60));
  console.log(`Working directory: ${WORK_DIR}`);
  console.log(`Output: ${OUTPUT_FILE}\n`);

  // 1. Collect packages from npm
  console.log("Searching npm for MCP packages...");
  const allPackages = new Map<string, PackageInfo>();

  for (const query of NPM_SEARCH_QUERIES) {
    process.stdout.write(`  Query: "${query}"...`);
    const results = await searchNpm(query);
    let added = 0;
    for (const pkg of results) {
      if (!allPackages.has(pkg.name) && isMcpRelated(pkg)) {
        allPackages.set(pkg.name, pkg);
        added++;
      }
    }
    process.stdout.write(` ${results.length} results, ${added} new\n`);
  }

  const packages = Array.from(allPackages.values());
  console.log(`\nTotal unique MCP packages found: ${packages.length}\n`);

  // 2. Prepare workspace
  await mkdir(join(WORK_DIR, "packages"), { recursive: true });

  // 3. Scan all packages
  console.log("Scanning packages...");
  console.log("-".repeat(60));

  const startTime = Date.now();
  const results: ScanResultEntry[] = [];

  // Process in batches for concurrency
  for (let i = 0; i < packages.length; i += CONCURRENCY) {
    const batch = packages.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((pkg, j) => scanPackage(pkg, i + j, packages.length))
    );
    results.push(...batchResults);
  }

  const scanDuration = Date.now() - startTime;

  // 4. Compute summary statistics
  console.log("\n" + "=".repeat(60));
  console.log("Computing statistics...\n");

  const scanned = results.filter((r) => r.scan !== null);
  const failed = results.filter((r) => r.scan === null);
  const allFindings = scanned.flatMap((r) => r.scan!.findings);

  const byRating = { GREEN: 0, YELLOW: 0, RED: 0 };
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const ruleCountMap = new Map<string, { title: string; count: number }>();
  const scores: number[] = [];

  for (const r of scanned) {
    byRating[r.scan!.rating]++;
    scores.push(r.scan!.score);

    for (const f of r.scan!.findings) {
      bySeverity[f.severity]++;
      const existing = ruleCountMap.get(f.ruleId);
      if (existing) {
        existing.count++;
      } else {
        ruleCountMap.set(f.ruleId, { title: f.title, count: 1 });
      }
    }
  }

  scores.sort((a, b) => a - b);
  const averageScore =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;
  const medianScore =
    scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0;

  const topRules = Array.from(ruleCountMap.entries())
    .map(([ruleId, data]) => ({ ruleId, ...data }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  const worstPackages = scanned
    .filter((r) => r.scan!.score < 100)
    .sort((a, b) => a.scan!.score - b.scan!.score)
    .slice(0, 30)
    .map((r) => ({
      name: r.package.name,
      score: r.scan!.score,
      findings: r.scan!.findings.length,
    }));

  const output: BulkScanResults = {
    metadata: {
      scannedAt: new Date().toISOString(),
      totalPackages: packages.length,
      totalScanned: scanned.length,
      totalFailed: failed.length,
      totalFindings: allFindings.length,
      scanDuration,
    },
    summary: {
      byRating,
      bySeverity,
      topRules,
      averageScore,
      medianScore,
      worstPackages,
    },
    results,
  };

  // 5. Write results
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // 6. Print summary
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Packages found:    ${packages.length}`);
  console.log(`Successfully scanned: ${scanned.length}`);
  console.log(`Failed to download:   ${failed.length}`);
  console.log(`Total findings:       ${allFindings.length}`);
  console.log(`Scan duration:        ${(scanDuration / 1000).toFixed(1)}s`);
  console.log();
  console.log("BY RATING:");
  console.log(`  GREEN  (80-100): ${byRating.GREEN} packages`);
  console.log(`  YELLOW (50-79):  ${byRating.YELLOW} packages`);
  console.log(`  RED    (0-49):   ${byRating.RED} packages`);
  console.log();
  console.log("BY SEVERITY:");
  console.log(`  Critical: ${bySeverity.critical}`);
  console.log(`  High:     ${bySeverity.high}`);
  console.log(`  Medium:   ${bySeverity.medium}`);
  console.log(`  Low:      ${bySeverity.low}`);
  console.log();
  console.log(`Average score: ${averageScore}/100`);
  console.log(`Median score:  ${medianScore}/100`);
  console.log();
  console.log("TOP ISSUES:");
  for (const rule of topRules.slice(0, 10)) {
    console.log(`  ${rule.count}x ${rule.title} (${rule.ruleId})`);
  }
  console.log();
  if (worstPackages.length > 0) {
    console.log("WORST PACKAGES:");
    for (const pkg of worstPackages.slice(0, 10)) {
      console.log(`  ${pkg.score}/100 ${pkg.name} (${pkg.findings} findings)`);
    }
  }
  console.log();
  console.log(`Full results saved to: ${OUTPUT_FILE}`);

  // 7. Cleanup
  try {
    await rm(WORK_DIR, { recursive: true });
    console.log("Cleaned up temp files.");
  } catch {
    console.log(`Note: temp files remain at ${WORK_DIR}`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
