#!/usr/bin/env node
import { readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const npm = JSON.parse(readFileSync(join(homedir(), "safeskill/clawhub-scan-results.json"), "utf8"));
const official = JSON.parse(readFileSync(join(homedir(), "safeskill/official-registry-scan-results.json"), "utf8"));

const byName = new Map<string, any>();
for (const r of npm.results) { if (r.scan) byName.set(r.package.name, r); }
for (const r of official.results) { if (r.scan && !byName.has(r.package.name)) byName.set(r.package.name, r); }
const all = Array.from(byName.values());

// Score distribution
const dist = Array(11).fill(0);
for (const r of all) {
  if (r.scan.score === 100) dist[10]++;
  else dist[Math.floor(r.scan.score / 10)]++;
}
console.log("SCORE DISTRIBUTION:");
["0-9","10-19","20-29","30-39","40-49","50-59","60-69","70-79","80-89","90-99","100"].forEach((l, i) =>
  console.log(`  ${l.padStart(5)}: ${dist[i]}`)
);

// SSH + network combo
console.log("\n=== SSH + NETWORK COMBO ===");
all.filter(r =>
  r.scan.findings.some((f: any) => f.ruleId === "FS-001") &&
  r.scan.findings.some((f: any) => ["NET-001","NET-002","NET-003","NET-004","NET-005","ENV-002"].includes(f.ruleId))
).forEach((r: any) => console.log(`  ${r.package.name} score=${r.scan.score}`));

// eval + network
console.log("\n=== EVAL + NETWORK ===");
all.filter(r =>
  r.scan.findings.some((f: any) => f.ruleId === "EXEC-001") &&
  r.scan.findings.some((f: any) => ["NET-001","NET-002","NET-003","ENV-002"].includes(f.ruleId))
).forEach((r: any) => console.log(`  ${r.package.name} score=${r.scan.score}`));

// crypto + obfuscation
console.log("\n=== CRYPTO + OBFUSCATION ===");
all.filter(r =>
  r.scan.findings.some((f: any) => f.ruleId === "SEC-003") &&
  r.scan.findings.some((f: any) => ["OBF-001","OBF-002","OBF-004"].includes(f.ruleId))
).forEach((r: any) => console.log(`  ${r.package.name} score=${r.scan.score}`));

// most findings
console.log("\n=== MOST FINDINGS (top 20) ===");
const sorted = [...all].sort((a: any, b: any) => b.scan.findings.length - a.scan.findings.length);
sorted.slice(0, 20).forEach((r: any) => {
  const rules = [...new Set(r.scan.findings.map((f: any) => f.ruleId))];
  console.log(`  ${r.scan.findings.length} findings, score=${r.scan.score} ${r.package.name} rules=${rules.join(",")}`);
});

// child process + env
console.log("\n=== CHILD PROC + ENV HARVESTING ===");
const cpEnv = all.filter(r =>
  r.scan.findings.some((f: any) => f.ruleId === "EXEC-002") &&
  r.scan.findings.some((f: any) => f.ruleId === "ENV-001")
);
console.log(`  ${cpEnv.length} packages`);

// prompt injection details
console.log("\n=== PROMPT INJECTION (PI-001) DETAILS ===");
all.filter(r => r.scan.findings.some((f: any) => f.ruleId === "PI-001")).forEach((r: any) => {
  const pifs = r.scan.findings.filter((f: any) => f.ruleId === "PI-001");
  const isSecurity = r.package.description?.toLowerCase().includes("security") || r.package.name.includes("security") || r.package.name.includes("audit") || r.package.name.includes("scan");
  console.log(`  ${r.package.name} (security-related: ${isSecurity}):`);
  pifs.forEach((f: any) => console.log(`    ${(f.matchedContent || "").slice(0, 140)}`));
});

// RED stats
const red = all.filter((r: any) => r.scan.rating === "RED");
const redCrit = red.filter((r: any) => r.scan.findings.some((f: any) => f.severity === "critical"));
const avgRedFindings = Math.round(red.reduce((s: number, r: any) => s + r.scan.findings.length, 0) / red.length);
console.log("\n=== RED PACKAGE STATS ===");
console.log(`  Total RED: ${red.length}`);
console.log(`  RED with critical: ${redCrit.length}`);
console.log(`  Avg findings per RED: ${avgRedFindings}`);

// env vars sent over network details
console.log("\n=== ENV OVER NETWORK DETAILS (sample) ===");
all.filter(r => r.scan.findings.some((f: any) => f.ruleId === "ENV-002")).slice(0, 8).forEach((r: any) => {
  const f = r.scan.findings.find((f: any) => f.ruleId === "ENV-002");
  console.log(`  ${r.package.name}: ${(f.matchedContent || "").slice(0, 120)}`);
});

// browser profile access details
console.log("\n=== BROWSER PROFILE ACCESS (sample) ===");
all.filter(r => r.scan.findings.some((f: any) => f.ruleId === "FS-003")).slice(0, 10).forEach((r: any) => {
  const f = r.scan.findings.find((f: any) => f.ruleId === "FS-003");
  console.log(`  ${r.package.name}: ${f.file}:${f.line} — ${(f.matchedContent || "").slice(0, 100)}`);
});

// packages with 0/100 score - how many
const zero = all.filter((r: any) => r.scan.score === 0);
console.log(`\n=== ZERO SCORE PACKAGES: ${zero.length} ===`);
zero.slice(0, 20).forEach((r: any) => {
  const critCount = r.scan.findings.filter((f: any) => f.severity === "critical").length;
  console.log(`  ${r.package.name} — ${r.scan.findings.length} findings, ${critCount} critical`);
});
