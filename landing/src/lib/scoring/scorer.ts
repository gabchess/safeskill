import type { Finding, Severity } from "../scanner/types";

const SEVERITY_WEIGHTS: Record<Severity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
  info: 0,
};

export function computeScore(findings: Finding[]): number {
  if (findings.length === 0) return 100;

  let totalDeduction = 0;

  // Group findings by rule to apply diminishing returns for repeated findings
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) {
    const existing = byRule.get(f.ruleId) || [];
    existing.push(f);
    byRule.set(f.ruleId, existing);
  }

  for (const [, ruleFindings] of byRule) {
    const weight = SEVERITY_WEIGHTS[ruleFindings[0].severity];
    // First finding: full weight. Additional findings: diminishing returns.
    const count = ruleFindings.length;
    const deduction = weight + Math.min(count - 1, 5) * (weight * 0.3);
    totalDeduction += deduction;
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - totalDeduction)));
  return score;
}

export function scoreToRating(score: number): "GREEN" | "YELLOW" | "RED" {
  if (score >= 80) return "GREEN";
  if (score >= 50) return "YELLOW";
  return "RED";
}

export function ratingEmoji(rating: "GREEN" | "YELLOW" | "RED"): string {
  switch (rating) {
    case "GREEN":
      return "GREEN";
    case "YELLOW":
      return "YELLOW";
    case "RED":
      return "RED";
  }
}

export function scoreBar(score: number): string {
  const filled = Math.round(score / 5);
  const empty = 20 - filled;
  return "[" + "#".repeat(filled) + "-".repeat(empty) + "]";
}
