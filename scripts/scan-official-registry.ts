#!/usr/bin/env node
/**
 * Scans all servers from the Official MCP Registry (registry.modelcontextprotocol.io).
 * Downloads npm packages and scans each one with SafeSkill.
 * Deduplicates against prior npm scan results.
 *
 * Usage: npx tsx scripts/scan-official-registry.ts
 */

import { scanSkill } from "../src/scanner/engine.js";
import type { SkillScanResult, Finding } from "../src/scanner/types.js";
import { writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, tmpdir } from "node:os";

// ── Config ──────────────────────────────────────────────────────────────────
const REGISTRY_BASE = "https://registry.modelcontextprotocol.io/v0";
const WORK_DIR = join(tmpdir(), "safeskill-official-scan");
const OUTPUT_FILE = join(homedir(), "safeskill", "official-registry-scan-results.json");
const PRIOR_SCAN = join(homedir(), "safeskill", "clawhub-scan-summary.json");
const CONCURRENCY = 5;
const PAGE_SIZE = 100;

// ── Types ───────────────────────────────────────────────────────────────────
interface RegistryPackage {
  registryType: string;
  identifier: string;
  transport?: { type: string };
  environmentVariables?: Array<{ name: string; description?: string; isSecret?: boolean }>;
}

interface RegistryServer {
  server: {
    name: string;
    description?: string;
    repository?: { url?: string; source?: string };
    version?: string;
    packages?: RegistryPackage[];
  };
  _meta?: Record<string, unknown>;
}

interface RegistryResponse {
  servers: RegistryServer[];
  metadata: { nextCursor?: string; count: number };
}

interface PackageInfo {
  name: string;
  registryName: string;
  version: string;
  description: string;
  registryType: string;
  identifier: string;
  repoUrl?: string;
}

interface ScanResultEntry {
  package: PackageInfo;
  scan: SkillScanResult | null;
  error?: string;
  downloadedAt: string;
}

interface BulkScanResults {
  metadata: {
    source: string;
    scannedAt: string;
    totalServers: number;
    npmPackages: number;
    pypiPackages: number;
    ociPackages: number;
    otherPackages: number;
    totalScanned: number;
    totalFailed: number;
    totalFindings: number;
    newPackages: number;
    scanDuration: number;
  };
  summary: {
    byRating: { GREEN: number; YELLOW: number; RED: number };
    bySeverity: Record<string, number>;
    topRules: { ruleId: string; title: string; count: number }[];
    averageScore: number;
    medianScore: number;
    worstPackages: { name: string; score: number; findings: number }[];
  };
  results: ScanResultEntry[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAllServers(): Promise<RegistryServer[]> {
  const allServers: RegistryServer[] = [];
  let cursor: string | undefined = undefined;
  let page = 0;

  while (true) {
    page++;
    let url = `${REGISTRY_BASE}/servers?limit=${PAGE_SIZE}`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    process.stdout.write(`  Fetching page ${page}...`);
    const res = await fetch(url);
    if (!res.ok) {
      console.log(` HTTP ${res.status}`);
      break;
    }

    const data = (await res.json()) as RegistryResponse;
    allServers.push(...data.servers);
    process.stdout.write(` ${data.servers.length} servers (total: ${allServers.length})\n`);

    if (!data.metadata.nextCursor || data.servers.length < PAGE_SIZE) break;
    cursor = data.metadata.nextCursor;
  }

  return allServers;
}

function extractNpmPackages(servers: RegistryServer[]): PackageInfo[] {
  const packages: PackageInfo[] = [];
  const seen = new Set<string>();

  for (const entry of servers) {
    const s = entry.server;
    if (!s.packages) continue;

    for (const pkg of s.packages) {
      if (pkg.registryType !== "npm") continue;

      // identifier is the npm package name, possibly with version
      let npmName = pkg.identifier;
      // Strip version suffix if present (e.g., "@scope/pkg@1.0.0" or "pkg@1.0.0")
      const atIdx = npmName.lastIndexOf("@");
      if (atIdx > 0 && !npmName.startsWith("@", atIdx - 1)) {
        // Not a scoped package's @, it's a version separator
        // But we need to be careful: @scope/pkg@1.0.0 has @ at position 0 (scope) and later (version)
      }
      // Simpler: try to separate name from version
      const match = npmName.match(/^(@?[^@]+?)(?:@(\d.*))?$/);
      if (match) {
        npmName = match[1];
      }

      if (seen.has(npmName)) continue;
      seen.add(npmName);

      packages.push({
        name: npmName,
        registryName: s.name,
        version: s.version || "",
        description: s.description || "",
        registryType: "npm",
        identifier: pkg.identifier,
        repoUrl: s.repository?.url,
      });
    }
  }

  return packages;
}

function loadPriorScannedNames(): Set<string> {
  try {
    if (!existsSync(PRIOR_SCAN)) return new Set();
    const data = JSON.parse(require("fs").readFileSync(PRIOR_SCAN, "utf-8"));
    return new Set(data.packages.map((p: { name: string }) => p.name));
  } catch {
    return new Set();
  }
}

async function downloadPackage(name: string, targetDir: string): Promise<boolean> {
  try {
    if (existsSync(targetDir)) {
      await rm(targetDir, { recursive: true });
    }
    await mkdir(targetDir, { recursive: true });
    execSync(`npm pack "${name}" --pack-destination "${targetDir}" 2>/dev/null`, {
      timeout: 30000,
      stdio: "pipe",
    });

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

  process.stdout.write(`[${index + 1}/${total}] Scanning ${pkg.name}...`);

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
      result.rating === "RED" ? "RED" : result.rating === "YELLOW" ? "YLW" : "GRN";
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
  console.log("SafeSkill — Official MCP Registry Scanner");
  console.log("=".repeat(60));
  console.log(`Registry: ${REGISTRY_BASE}`);
  console.log(`Output: ${OUTPUT_FILE}\n`);

  // 1. Fetch all servers from the official registry
  console.log("Fetching all servers from official MCP registry...");
  const servers = await fetchAllServers();
  console.log(`\nTotal servers in registry: ${servers.length}\n`);

  // 2. Count package types
  let npmCount = 0, pypiCount = 0, ociCount = 0, otherCount = 0;
  const allIdentifiers = new Set<string>();
  for (const s of servers) {
    for (const pkg of s.server.packages || []) {
      if (allIdentifiers.has(pkg.identifier)) continue;
      allIdentifiers.add(pkg.identifier);
      switch (pkg.registryType) {
        case "npm": npmCount++; break;
        case "pypi": pypiCount++; break;
        case "oci": ociCount++; break;
        default: otherCount++; break;
      }
    }
  }
  console.log("Package breakdown:");
  console.log(`  npm:   ${npmCount}`);
  console.log(`  pypi:  ${pypiCount}`);
  console.log(`  oci:   ${ociCount}`);
  console.log(`  other: ${otherCount}`);
  console.log();

  // 3. Extract npm packages and deduplicate against prior scan
  const npmPackages = extractNpmPackages(servers);
  console.log(`Unique npm packages: ${npmPackages.length}`);

  const priorScanned = loadPriorScannedNames();
  console.log(`Already scanned in prior run: ${priorScanned.size}`);

  const newPackages = npmPackages.filter((p) => !priorScanned.has(p.name));
  const alreadyScanned = npmPackages.filter((p) => priorScanned.has(p.name));
  console.log(`New packages to scan: ${newPackages.length}`);
  console.log(`Already scanned (will skip download): ${alreadyScanned.length}`);
  console.log();

  // 4. Prepare workspace
  await mkdir(join(WORK_DIR, "packages"), { recursive: true });

  // 5. Scan new packages
  console.log("Scanning new npm packages...");
  console.log("-".repeat(60));

  const startTime = Date.now();
  const results: ScanResultEntry[] = [];

  for (let i = 0; i < newPackages.length; i += CONCURRENCY) {
    const batch = newPackages.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map((pkg, j) => scanPackage(pkg, i + j, newPackages.length))
    );
    results.push(...batchResults);
  }

  const scanDuration = Date.now() - startTime;

  // 6. Compute statistics
  console.log("\n" + "=".repeat(60));
  console.log("Computing statistics...\n");

  const scanned = results.filter((r) => r.scan !== null);
  const failed = results.filter((r) => r.scan === null);
  const allFindings = scanned.flatMap((r) => r.scan!.findings);

  const byRating = { GREEN: 0, YELLOW: 0, RED: 0 };
  const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const ruleCountMap = new Map<string, { title: string; count: number }>();
  const scores: number[] = [];

  for (const r of scanned) {
    byRating[r.scan!.rating]++;
    scores.push(r.scan!.score);

    for (const f of r.scan!.findings) {
      bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1;
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
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const medianScore = scores.length > 0 ? scores[Math.floor(scores.length / 2)] : 0;

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
      source: "registry.modelcontextprotocol.io",
      scannedAt: new Date().toISOString(),
      totalServers: servers.length,
      npmPackages: npmCount,
      pypiPackages: pypiCount,
      ociPackages: ociCount,
      otherPackages: otherCount,
      totalScanned: scanned.length,
      totalFailed: failed.length,
      totalFindings: allFindings.length,
      newPackages: newPackages.length,
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

  // 7. Write results
  await writeFile(OUTPUT_FILE, JSON.stringify(output, null, 2));

  // 8. Print summary
  console.log("RESULTS");
  console.log("=".repeat(60));
  console.log(`Servers in registry:     ${servers.length}`);
  console.log(`npm packages (unique):   ${npmPackages.length}`);
  console.log(`New packages scanned:    ${scanned.length}`);
  console.log(`Failed to download:      ${failed.length}`);
  console.log(`Total findings:          ${allFindings.length}`);
  console.log(`Scan duration:           ${(scanDuration / 1000).toFixed(1)}s`);
  console.log();
  console.log("BY RATING (new packages only):");
  console.log(`  GREEN  (80-100): ${byRating.GREEN}`);
  console.log(`  YELLOW (50-79):  ${byRating.YELLOW}`);
  console.log(`  RED    (0-49):   ${byRating.RED}`);
  console.log();
  console.log("BY SEVERITY:");
  for (const [sev, count] of Object.entries(bySeverity)) {
    if (count > 0) console.log(`  ${sev}: ${count}`);
  }
  console.log();
  console.log(`Average score: ${averageScore}/100`);
  console.log(`Median score:  ${medianScore}/100`);
  console.log();
  if (topRules.length > 0) {
    console.log("TOP ISSUES:");
    for (const rule of topRules.slice(0, 10)) {
      console.log(`  ${rule.count}x ${rule.title} (${rule.ruleId})`);
    }
    console.log();
  }
  if (worstPackages.length > 0) {
    console.log("WORST PACKAGES:");
    for (const pkg of worstPackages.slice(0, 15)) {
      console.log(`  ${pkg.score}/100 ${pkg.name} (${pkg.findings} findings)`);
    }
  }
  console.log();
  console.log(`Full results saved to: ${OUTPUT_FILE}`);

  // 9. Cleanup
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
