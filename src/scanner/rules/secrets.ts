import { Rule } from "../types.js";

const ALL_FILES = /\.(js|ts|mjs|cjs|py|rb|json|yaml|yml|env|cfg|conf|ini|toml)$/i;

export const secretsRules: Rule[] = [
  {
    id: "SEC-001",
    severity: "high",
    title: "Hardcoded API key",
    description: "Contains what appears to be a hardcoded API key",
    filePatterns: ALL_FILES,
    patterns: [
      /['"]sk-[a-zA-Z0-9]{20,}['"]/,
      /['"](?:api[_-]?key|apikey)\s*['"]?\s*[:=]\s*['"][a-zA-Z0-9]{16,}['"]/i,
      /AKIA[0-9A-Z]{16}/,
      /['"]ghp_[a-zA-Z0-9]{36}['"]/,
      /['"]gho_[a-zA-Z0-9]{36}['"]/,
      /['"]glpat-[a-zA-Z0-9\-_]{20,}['"]/,
      /['"]xox[bpoas]-[a-zA-Z0-9\-]{10,}['"]/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains what looks like a hardcoded API key. This could be the skill author's own key (bad practice, might get revoked), or it could be a key pointing to an attacker's account to route your data through their service.`,
    recommendation:
      "API keys should be stored in environment variables, never in code. If this is the author's key, contact them. If you don't recognize the service, this is suspicious.",
  },
  {
    id: "SEC-002",
    severity: "high",
    title: "Hardcoded private key or secret",
    description: "Contains private keys, tokens, or other secrets in source code",
    filePatterns: ALL_FILES,
    patterns: [
      /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/,
      /-----BEGIN OPENSSH PRIVATE KEY-----/,
      /['"](?:secret|password|passwd|token)\s*['"]?\s*[:=]\s*['"][^'"]{8,}['"]/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains a hardcoded private key or secret. Private keys embedded in code can be extracted by anyone who reads the source.`,
    recommendation:
      "Secrets must never be hardcoded. Report this to the skill author and avoid using this skill until it's fixed.",
  },
  {
    id: "SEC-003",
    severity: "critical",
    title: "Crypto wallet address pattern",
    description: "Contains cryptocurrency wallet addresses, potentially for redirecting transactions",
    filePatterns: ALL_FILES,
    patterns: [
      /[13][a-km-zA-HJ-NP-Z1-9]{25,34}(?=["'\s,;\]})])/,
      /0x[a-fA-F0-9]{40}(?=["'\s,;\]})])/,
      /(?:bc1|tb1)[a-zA-HJ-NP-Z0-9]{25,87}(?=["'\s,;\]})])/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains a cryptocurrency wallet address. Malicious skills embed their own wallet addresses to replace yours in transactions — you think you're sending crypto to your address, but it goes to the attacker.`,
    recommendation:
      "If this skill has anything to do with crypto, verify the wallet address. If it doesn't deal with crypto at all, this is a major red flag.",
  },
];
