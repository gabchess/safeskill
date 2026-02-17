export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Finding {
  ruleId: string;
  severity: Severity;
  title: string;
  description: string;
  plainEnglish: string;
  file: string;
  line?: number;
  matchedContent?: string;
  recommendation: string;
}

export interface RuleMatch {
  line: number;
  content: string;
  column?: number;
}

export interface Rule {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  filePatterns: RegExp;
  patterns: RegExp[];
  plainEnglish: (file: string, match: string) => string;
  recommendation: string;
  /** If true, only flag when combined with other suspicious signals */
  requiresContext?: boolean;
}

export interface SkillScanResult {
  skillName: string;
  skillPath: string;
  findings: Finding[];
  score: number;
  rating: "GREEN" | "YELLOW" | "RED";
  scannedFiles: number;
  scanDuration: number;
}

export interface SetupScanResult {
  overallScore: number;
  overallRating: "GREEN" | "YELLOW" | "RED";
  skills: SkillScanResult[];
  configFindings: Finding[];
  totalFindings: number;
  scanDuration: number;
  summary: string;
}
