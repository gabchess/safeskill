import { Rule } from "../types";

const SOURCE_FILES = /\.(js|ts|mjs|cjs|py|rb|json|md)$/i;

export const obfuscationRules: Rule[] = [
  {
    id: "OBF-001",
    severity: "high",
    title: "Base64-encoded string decoded at runtime",
    description: "Decodes base64-encoded strings at runtime, often used to hide malicious payloads",
    filePatterns: SOURCE_FILES,
    patterns: [
      /atob\s*\(/,
      /Buffer\.from\s*\([^)]+,\s*['"]base64['"]\)/,
      /base64\.b64decode\s*\(/,
      /base64\.decodebytes\s*\(/,
      /Base64\.decode64\s*\(/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" decodes hidden base64-encoded content at runtime. This is a common obfuscation technique — the actual malicious code is hidden as an encoded string so it doesn't show up in simple code reviews.`,
    recommendation:
      "Investigate what's being decoded. If you can't determine it's benign data (like an image), this is highly suspicious.",
  },
  {
    id: "OBF-002",
    severity: "high",
    title: "Hex-encoded string decoded at runtime",
    description: "Decodes hex-encoded strings, another obfuscation method",
    filePatterns: SOURCE_FILES,
    patterns: [
      /Buffer\.from\s*\([^)]+,\s*['"]hex['"]\)/,
      /bytes\.fromhex\s*\(/,
      /\\x[0-9a-f]{2}(?:\\x[0-9a-f]{2}){5,}/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" decodes hex-encoded content at runtime. Like base64, hex encoding is used to hide the true contents of strings — URLs, commands, or other payloads.`,
    recommendation:
      "Decode the hex string yourself to see what it contains. If it's a URL or command, this skill is likely malicious.",
  },
  {
    id: "OBF-003",
    severity: "medium",
    title: "Hidden Unicode characters",
    description: "Contains invisible Unicode characters that could be used for homograph attacks or hiding code",
    filePatterns: SOURCE_FILES,
    patterns: [
      /[\u200B\u200C\u200D\u2060\uFEFF]/,
      /[\u202A-\u202E]/,
      /[\u2066-\u2069]/,
      /[\u00AD]/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains invisible Unicode characters. These can be used to hide malicious code that looks normal in a text editor but actually does something different — for example, making a URL look like it goes to google.com when it actually goes to evil.com.`,
    recommendation:
      "View the raw file in a hex editor. This pattern is used in supply-chain attacks to make code appear safe while actually being malicious.",
  },
  {
    id: "OBF-004",
    severity: "high",
    title: "Obfuscated JavaScript patterns",
    description: "Uses common JS obfuscation patterns to hide code intent",
    filePatterns: /\.(js|mjs|cjs|ts)$/i,
    patterns: [
      /\[['"]\\x/,
      /String\.fromCharCode\s*\(/,
      /\['constructor'\]\s*\(\s*['"]return/,
      /\bwindow\[(?:['"]\\x|atob)/,
      /\[["']apply["']\]/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" uses JavaScript obfuscation techniques to hide what it does. Legitimate code is written to be readable; obfuscated code is written to avoid detection.`,
    recommendation:
      "Remove this skill. There is no legitimate reason for an MCP skill to use code obfuscation.",
  },
];
