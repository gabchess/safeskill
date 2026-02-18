import { allRules } from "./rules/index";
import { walkDirectory, getSkillName } from "../utils/file-walker";
import { computeScore, scoreToRating } from "../scoring/scorer";
import type {
  Finding,
  Rule,
  SkillScanResult,
  SetupScanResult,
} from "./types";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

export async function scanSkill(skillPath: string): Promise<SkillScanResult> {
  const startTime = Date.now();
  const files = await walkDirectory(skillPath);
  const findings: Finding[] = [];

  for (const file of files) {
    for (const rule of allRules) {
      if (!rule.filePatterns.test(file.relativePath)) continue;

      const lines = file.content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        for (const pattern of rule.patterns) {
          // Reset regex state for global/sticky patterns
          pattern.lastIndex = 0;
          if (pattern.test(lines[i])) {
            // Avoid duplicate findings from the same rule on the same line
            const alreadyFound = findings.some(
              (f) =>
                f.ruleId === rule.id &&
                f.file === file.relativePath &&
                f.line === i + 1
            );
            if (!alreadyFound) {
              findings.push({
                ruleId: rule.id,
                severity: rule.severity,
                title: rule.title,
                description: rule.description,
                plainEnglish: rule.plainEnglish(
                  file.relativePath,
                  lines[i].trim()
                ),
                file: file.relativePath,
                line: i + 1,
                matchedContent: lines[i].trim().slice(0, 200),
                recommendation: rule.recommendation,
              });
            }
            break; // One match per pattern per line is enough
          }
        }
      }
    }
  }

  const score = computeScore(findings);

  return {
    skillName: getSkillName(skillPath),
    skillPath,
    findings,
    score,
    rating: scoreToRating(score),
    scannedFiles: files.length,
    scanDuration: Date.now() - startTime,
  };
}

export async function scanSetup(
  skillsDir: string,
  configFindings: Finding[] = []
): Promise<SetupScanResult> {
  const startTime = Date.now();
  const skills: SkillScanResult[] = [];

  let entries;
  try {
    entries = await readdir(skillsDir, { withFileTypes: true });
  } catch {
    return {
      overallScore: 100,
      overallRating: "GREEN",
      skills: [],
      configFindings,
      totalFindings: configFindings.length,
      scanDuration: Date.now() - startTime,
      summary: `Could not read skills directory: ${skillsDir}`,
    };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(skillsDir, entry.name);
    const result = await scanSkill(skillPath);
    skills.push(result);
  }

  const allFindings = [
    ...configFindings,
    ...skills.flatMap((s) => s.findings),
  ];

  const overallScore = computeOverallScore(skills, configFindings);

  return {
    overallScore,
    overallRating: scoreToRating(overallScore),
    skills,
    configFindings,
    totalFindings: allFindings.length,
    scanDuration: Date.now() - startTime,
    summary: generateSummary(skills, configFindings, overallScore),
  };
}

function computeOverallScore(
  skills: SkillScanResult[],
  configFindings: Finding[]
): number {
  if (skills.length === 0 && configFindings.length === 0) return 100;

  // Start with average of all skill scores
  let score = 100;

  if (skills.length > 0) {
    const avgSkillScore =
      skills.reduce((sum, s) => sum + s.score, 0) / skills.length;
    score = avgSkillScore;
  }

  // Deduct for config findings
  for (const f of configFindings) {
    switch (f.severity) {
      case "critical":
        score -= 20;
        break;
      case "high":
        score -= 10;
        break;
      case "medium":
        score -= 5;
        break;
      case "low":
        score -= 2;
        break;
    }
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function generateSummary(
  skills: SkillScanResult[],
  configFindings: Finding[],
  overallScore: number
): string {
  const totalFindings =
    configFindings.length + skills.reduce((sum, s) => s.findings.length, 0);
  const criticalCount =
    configFindings.filter((f) => f.severity === "critical").length +
    skills.reduce(
      (sum, s) => sum + s.findings.filter((f) => f.severity === "critical").length,
      0
    );
  const redSkills = skills.filter((s) => s.rating === "RED");

  if (totalFindings === 0) {
    return "No security issues found. Your setup looks clean.";
  }

  const parts: string[] = [];
  parts.push(`Found ${totalFindings} issue${totalFindings === 1 ? "" : "s"} across ${skills.length} skill${skills.length === 1 ? "" : "s"}.`);

  if (criticalCount > 0) {
    parts.push(
      `${criticalCount} critical issue${criticalCount === 1 ? "" : "s"} require${criticalCount === 1 ? "s" : ""} immediate attention.`
    );
  }

  if (redSkills.length > 0) {
    parts.push(
      `${redSkills.length} skill${redSkills.length === 1 ? "" : "s"} rated RED: ${redSkills.map((s) => s.skillName).join(", ")}.`
    );
  }

  return parts.join(" ");
}
