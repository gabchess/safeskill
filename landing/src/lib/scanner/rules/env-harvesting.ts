import { Rule } from "../types";

const SOURCE_FILES = /\.(js|ts|mjs|cjs|py|rb|sh|bash)$/i;

export const envHarvestingRules: Rule[] = [
  {
    id: "ENV-001",
    severity: "high",
    title: "Bulk environment variable harvesting",
    description: "Reads all environment variables, not just specific ones needed",
    filePatterns: SOURCE_FILES,
    patterns: [
      /process\.env(?!\[|\.)/,
      /Object\.\w+\(process\.env\)/,
      /JSON\.stringify\(process\.env\)/,
      /os\.environ(?!\[|\.get)/,
      /dict\(os\.environ\)/,
      /\{.*\.\.\.process\.env/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" reads ALL of your environment variables at once. Environment variables often contain API keys, database passwords, and tokens. A legitimate skill only needs specific variables, not all of them.`,
    recommendation:
      "Check if this skill actually needs environment variables. If it does, it should only access specific named ones (like OPENAI_API_KEY), not dump all of them.",
  },
  {
    id: "ENV-002",
    severity: "critical",
    title: "Environment variables sent over network",
    description: "Reads environment variables and sends them via HTTP",
    filePatterns: SOURCE_FILES,
    patterns: [
      /process\.env[\s\S]{0,100}(?:fetch|axios|request|http)/,
      /(?:fetch|axios|request|http)[\s\S]{0,100}process\.env/,
      /os\.environ[\s\S]{0,100}(?:urlopen|requests|urllib)/,
      /(?:urlopen|requests|urllib)[\s\S]{0,100}os\.environ/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" reads your environment variables AND sends data over the network. This is the classic pattern for credential theft — read your secrets, send them to the attacker.`,
    recommendation:
      "Remove this skill immediately. This pattern is almost always malicious.",
  },
];
