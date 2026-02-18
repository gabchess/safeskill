#!/usr/bin/env node
/**
 * Merges npm scan + official registry scan into a combined dataset.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const base = join(homedir(), "safeskill");

const npm = JSON.parse(readFileSync(join(base, "clawhub-scan-results.json"), "utf8"));
const official = JSON.parse(readFileSync(join(base, "official-registry-scan-results.json"), "utf8"));

// Merge results, dedup by package name (npm first, official fills gaps)
const byName = new Map<string, any>();
for (const r of npm.results) {
  if (r.scan) byName.set(r.package.name, r);
}
let newFromOfficial = 0;
for (const r of official.results) {
  if (r.scan && !byName.has(r.package.name)) {
    byName.set(r.package.name, r);
    newFromOfficial++;
  }
}

const all = Array.from(byName.values());
const allFindings = all.flatMap((r: any) => r.scan.findings);

// Stats
const byRating = { GREEN: 0, YELLOW: 0, RED: 0 };
const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
const ruleMap = new Map<string, { title: string; count: number }>();
const scores: number[] = [];

for (const r of all) {
  byRating[r.scan.rating as keyof typeof byRating]++;
  scores.push(r.scan.score);
  for (const f of r.scan.findings) {
    bySeverity[f.severity]++;
    const existing = ruleMap.get(f.ruleId);
    if (existing) existing.count++;
    else ruleMap.set(f.ruleId, { title: f.title, count: 1 });
  }
}

scores.sort((a, b) => a - b);
const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
const median = scores[Math.floor(scores.length / 2)];

const withIssues = all.filter((r: any) => r.scan.findings.length > 0).length;
const withCritical = all.filter((r: any) => r.scan.findings.some((f: any) => f.severity === "critical")).length;

const topRules = Array.from(ruleMap.entries())
  .map(([id, d]) => ({ id, ...d }))
  .sort((a, b) => b.count - a.count);

// Key findings
const countBy = (ruleIds: string[]) =>
  all.filter((r: any) => r.scan.findings.some((f: any) => ruleIds.includes(f.ruleId))).length;

console.log("=== COMBINED SCAN: npm + Official MCP Registry ===");
console.log();
console.log("TOTALS:");
console.log("  npm scan packages:              " + npm.metadata.totalScanned);
console.log("  Official registry servers:      " + official.metadata.totalServers);
console.log("  Official registry npm packages: " + official.metadata.npmPackages);
console.log("  Official registry pypi:         " + official.metadata.pypiPackages);
console.log("  Official registry oci:          " + official.metadata.ociPackages);
console.log("  New packages from official:     " + newFromOfficial);
console.log("  Combined unique packages:       " + all.length);
console.log("  Combined total findings:        " + allFindings.length);
console.log();
console.log("COMBINED RATINGS:");
console.log("  GREEN:  " + byRating.GREEN + " (" + (byRating.GREEN / all.length * 100).toFixed(1) + "%)");
console.log("  YELLOW: " + byRating.YELLOW + " (" + (byRating.YELLOW / all.length * 100).toFixed(1) + "%)");
console.log("  RED:    " + byRating.RED + " (" + (byRating.RED / all.length * 100).toFixed(1) + "%)");
console.log("  With issues:   " + withIssues + " (" + (withIssues / all.length * 100).toFixed(1) + "%)");
console.log("  With critical: " + withCritical + " (" + (withCritical / all.length * 100).toFixed(1) + "%)");
console.log();
console.log("COMBINED SEVERITY:");
for (const [s, c] of Object.entries(bySeverity)) {
  if (c > 0) console.log("  " + s + ": " + c);
}
console.log();
console.log("  Average score: " + avg + "/100");
console.log("  Median score:  " + median + "/100");
console.log();
console.log("TOP RULES (combined):");
for (const r of topRules) {
  console.log("  " + String(r.count).padStart(6) + "x " + r.title + " (" + r.id + ")");
}
console.log();
console.log("KEY FINDINGS (unique packages affected):");
console.log("  eval() / dynamic execution:  " + countBy(["EXEC-001"]));
console.log("  Shell command injection:      " + countBy(["EXEC-003"]));
console.log("  Child process spawning:       " + countBy(["EXEC-002"]));
console.log("  SSH key access:               " + countBy(["FS-001"]));
console.log("  Cloud credential access:      " + countBy(["FS-002"]));
console.log("  Browser profile access:       " + countBy(["FS-003"]));
console.log("  Crypto wallet addresses:      " + countBy(["SEC-003"]));
console.log("  Telegram/Discord exfil:       " + countBy(["NET-001", "NET-002"]));
console.log("  Prompt injection:             " + countBy(["PI-001", "PI-002", "PI-003"]));
console.log("  Hardcoded IPs:                " + countBy(["NET-003"]));
console.log("  Base64/hex obfuscation:       " + countBy(["OBF-001", "OBF-002"]));
console.log("  Env var harvesting:           " + countBy(["ENV-001"]));
console.log("  Env vars sent over network:   " + countBy(["ENV-002"]));

// Write combined summary
const combined = {
  metadata: {
    sources: ["npm (registry.npmjs.org)", "Official MCP Registry (registry.modelcontextprotocol.io)"],
    scannedAt: new Date().toISOString(),
    officialRegistryServers: official.metadata.totalServers,
    npmSearchPackages: npm.metadata.totalScanned,
    combinedUniquePackages: all.length,
    newFromOfficialRegistry: newFromOfficial,
    totalFindings: allFindings.length,
  },
  summary: {
    byRating,
    bySeverity,
    averageScore: avg,
    medianScore: median,
    packagesWithIssues: withIssues,
    packagesWithCritical: withCritical,
    topRules: topRules.slice(0, 20),
  },
  packages: all.map((r: any) => ({
    name: r.package.name,
    version: r.package.version,
    description: r.package.description,
    score: r.scan.score,
    rating: r.scan.rating,
    findingsCount: r.scan.findings.length,
    scannedFiles: r.scan.scannedFiles,
    findingsByRule: r.scan.findings.reduce((acc: Record<string, number>, f: any) => {
      acc[f.ruleId] = (acc[f.ruleId] || 0) + 1;
      return acc;
    }, {}),
  })),
};

writeFileSync(join(base, "combined-scan-summary.json"), JSON.stringify(combined, null, 2));
console.log("\nCombined summary written to combined-scan-summary.json");
