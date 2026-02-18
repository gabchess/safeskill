import type {
  Finding,
  SkillScanResult,
  SetupScanResult,
} from "../scanner/types";
import { scoreBar } from "../scoring/scorer";

export function formatSkillReport(result: SkillScanResult): string {
  const lines: string[] = [];

  lines.push(`## ${result.skillName}`);
  lines.push("");
  lines.push(
    `**Score: ${result.score}/100** ${result.rating} ${scoreBar(result.score)}`
  );
  lines.push(
    `Scanned ${result.scannedFiles} files in ${result.scanDuration}ms`
  );
  lines.push("");

  if (result.findings.length === 0) {
    lines.push("No security issues found. This skill looks clean.");
    return lines.join("\n");
  }

  // Group by severity
  const critical = result.findings.filter((f) => f.severity === "critical");
  const high = result.findings.filter((f) => f.severity === "high");
  const medium = result.findings.filter((f) => f.severity === "medium");
  const low = result.findings.filter((f) => f.severity === "low");
  const info = result.findings.filter((f) => f.severity === "info");

  if (critical.length > 0) {
    lines.push(`### CRITICAL (${critical.length})`);
    lines.push("");
    for (const f of critical) {
      lines.push(formatFinding(f));
    }
  }

  if (high.length > 0) {
    lines.push(`### HIGH (${high.length})`);
    lines.push("");
    for (const f of high) {
      lines.push(formatFinding(f));
    }
  }

  if (medium.length > 0) {
    lines.push(`### MEDIUM (${medium.length})`);
    lines.push("");
    for (const f of medium) {
      lines.push(formatFinding(f));
    }
  }

  if (low.length > 0) {
    lines.push(`### LOW (${low.length})`);
    lines.push("");
    for (const f of low) {
      lines.push(formatFinding(f));
    }
  }

  if (info.length > 0) {
    lines.push(`### INFO (${info.length})`);
    lines.push("");
    for (const f of info) {
      lines.push(formatFinding(f));
    }
  }

  // Action items
  lines.push("### What to do");
  lines.push("");
  if (critical.length > 0) {
    lines.push(
      `- **Remove immediately**: This skill has ${critical.length} critical issue${critical.length === 1 ? "" : "s"}. Do not use it until these are resolved.`
    );
  } else if (high.length > 0) {
    lines.push(
      `- **Review carefully**: This skill has ${high.length} high-severity issue${high.length === 1 ? "" : "s"}. Only use it if you trust the author.`
    );
  } else {
    lines.push(
      "- **Proceed with caution**: Minor issues found. Review the details above."
    );
  }

  return lines.join("\n");
}

export function formatSetupReport(result: SetupScanResult): string {
  const lines: string[] = [];

  lines.push("# SafeSkill Security Report");
  lines.push("");
  lines.push(
    `**Overall Score: ${result.overallScore}/100** ${result.overallRating} ${scoreBar(result.overallScore)}`
  );
  lines.push("");
  lines.push(result.summary);
  lines.push("");

  if (result.configFindings.length > 0) {
    lines.push("## Configuration Issues");
    lines.push("");
    for (const f of result.configFindings) {
      lines.push(formatFinding(f));
    }
  }

  if (result.skills.length > 0) {
    // Sort skills by score ascending (worst first)
    const sorted = [...result.skills].sort((a, b) => a.score - b.score);

    lines.push(`## Skills (${sorted.length} scanned)`);
    lines.push("");

    // Summary table
    lines.push("| Skill | Score | Rating | Issues |");
    lines.push("|-------|-------|--------|--------|");
    for (const s of sorted) {
      lines.push(
        `| ${s.skillName} | ${s.score}/100 | ${s.rating} | ${s.findings.length} |`
      );
    }
    lines.push("");

    // Detailed reports for skills with findings
    const withFindings = sorted.filter((s) => s.findings.length > 0);
    if (withFindings.length > 0) {
      lines.push("## Detailed Findings");
      lines.push("");
      for (const s of withFindings) {
        lines.push(formatSkillReport(s));
        lines.push("");
        lines.push("---");
        lines.push("");
      }
    }
  } else {
    lines.push("No skills found to scan.");
  }

  lines.push("");
  lines.push("---");
  lines.push(
    `*Scanned in ${result.scanDuration}ms by SafeSkill v0.1.0*`
  );

  return lines.join("\n");
}

export function formatConversational(result: SetupScanResult): string {
  const lines: string[] = [];

  if (result.totalFindings === 0) {
    lines.push(
      "I scanned your entire setup and everything looks clean. No security issues found."
    );
    lines.push("");
    lines.push(
      `**Overall Score: ${result.overallScore}/100** ${result.overallRating}`
    );
    return lines.join("\n");
  }

  // Opening
  const critical = result.skills.reduce(
    (sum, s) =>
      sum + s.findings.filter((f) => f.severity === "critical").length,
    0
  ) + result.configFindings.filter((f) => f.severity === "critical").length;

  if (critical > 0) {
    lines.push(
      `I found **${result.totalFindings} security issues** in your setup, including **${critical} critical** ones that need immediate attention.`
    );
  } else {
    lines.push(
      `I found **${result.totalFindings} security issues** in your setup. Nothing critical, but there are things worth reviewing.`
    );
  }
  lines.push("");
  lines.push(
    `**Overall Score: ${result.overallScore}/100** ${result.overallRating}`
  );
  lines.push("");

  // Highlight the worst skills
  const redSkills = result.skills.filter((s) => s.rating === "RED");
  const yellowSkills = result.skills.filter((s) => s.rating === "YELLOW");

  if (redSkills.length > 0) {
    lines.push("### Skills you should remove:");
    lines.push("");
    for (const s of redSkills) {
      const topFinding = s.findings.find((f) => f.severity === "critical") ||
        s.findings[0];
      lines.push(
        `- **${s.skillName}** (Score: ${s.score}/100) — ${topFinding.plainEnglish}`
      );
    }
    lines.push("");
  }

  if (yellowSkills.length > 0) {
    lines.push("### Skills to review:");
    lines.push("");
    for (const s of yellowSkills) {
      const topFinding = s.findings[0];
      lines.push(
        `- **${s.skillName}** (Score: ${s.score}/100) — ${topFinding.plainEnglish}`
      );
    }
    lines.push("");
  }

  const greenSkills = result.skills.filter((s) => s.rating === "GREEN");
  if (greenSkills.length > 0) {
    lines.push(
      `### Clean skills: ${greenSkills.map((s) => s.skillName).join(", ")}`
    );
    lines.push("");
  }

  // Config issues
  if (result.configFindings.length > 0) {
    lines.push("### Configuration issues:");
    lines.push("");
    for (const f of result.configFindings) {
      lines.push(`- **${f.title}**: ${f.plainEnglish}`);
    }
    lines.push("");
  }

  // What to do
  lines.push("### What to do next:");
  lines.push("");
  if (redSkills.length > 0) {
    lines.push(
      `1. **Remove these skills now**: ${redSkills.map((s) => s.skillName).join(", ")}`
    );
  }
  if (yellowSkills.length > 0) {
    lines.push(
      `${redSkills.length > 0 ? "2" : "1"}. **Review these skills**: ${yellowSkills.map((s) => s.skillName).join(", ")} — check if you trust their authors`
    );
  }
  if (result.configFindings.length > 0) {
    lines.push(
      `${redSkills.length + yellowSkills.length > 0 ? redSkills.length + (yellowSkills.length > 0 ? 1 : 0) + 1 : 1}. **Fix configuration issues** listed above`
    );
  }

  return lines.join("\n");
}

function formatFinding(finding: Finding): string {
  const lines: string[] = [];
  lines.push(`**${finding.title}** [${finding.severity.toUpperCase()}]`);
  lines.push(`File: \`${finding.file}\`${finding.line ? `:${finding.line}` : ""}`);
  lines.push("");
  lines.push(finding.plainEnglish);
  lines.push("");
  if (finding.matchedContent) {
    lines.push("```");
    lines.push(finding.matchedContent);
    lines.push("```");
    lines.push("");
  }
  lines.push(`**Fix:** ${finding.recommendation}`);
  lines.push("");
  return lines.join("\n");
}

export function formatFindingShort(finding: Finding): string {
  return `[${finding.severity.toUpperCase()}] ${finding.title} in ${finding.file}${finding.line ? `:${finding.line}` : ""}`;
}
