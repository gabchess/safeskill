import { Rule } from "../types.js";

const SOURCE_FILES = /\.(js|ts|mjs|cjs|py|rb|sh|bash)$/i;

export const codeExecutionRules: Rule[] = [
  {
    id: "EXEC-001",
    severity: "critical",
    title: "Dynamic code execution with eval()",
    description: "Uses eval() or similar to execute dynamically constructed code",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\beval\s*\(/,
      /\bnew\s+Function\s*\(/,
      /\bexec\s*\(\s*(?:f["']|["`]|compile)/,
    ],
    plainEnglish: (file, match) =>
      `The file "${file}" uses eval() or dynamic code execution. This means it can run arbitrary code at runtime — a common technique in malware to hide what it actually does.`,
    recommendation:
      "Remove this skill immediately unless you trust the author completely. Dynamic code execution is the #1 red flag in malicious skills.",
  },
  {
    id: "EXEC-002",
    severity: "high",
    title: "Child process execution",
    description: "Spawns shell commands or child processes",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\bchild_process\b/,
      /\bexecSync\b/,
      /\bspawnSync?\b/,
      /\bexecFileSync?\b/,
      /\bsubprocess\.(run|call|Popen|check_output)\b/,
      /\bos\.system\s*\(/,
      /\bos\.popen\s*\(/,
    ],
    plainEnglish: (file, match) =>
      `The file "${file}" can run system commands on your computer. This gives it the ability to install software, delete files, or do anything you can do in a terminal.`,
    recommendation:
      "Only allow this if the skill explicitly needs to run commands (like a git or docker skill). If it's a simple data skill, this is suspicious.",
  },
  {
    id: "EXEC-003",
    severity: "critical",
    title: "Shell command with string interpolation",
    description:
      "Constructs shell commands using string interpolation or concatenation",
    filePatterns: SOURCE_FILES,
    patterns: [
      /exec(?:Sync)?\s*\(\s*`[^`]*\$\{/,
      /exec(?:Sync)?\s*\(\s*['"][^'"]*['"]\s*\+/,
      /os\.system\s*\(\s*f['"]/,
      /subprocess\.(?:run|call|Popen)\s*\(\s*f['"]/,
    ],
    plainEnglish: (file, match) =>
      `The file "${file}" builds shell commands by inserting variables into strings. This is a command injection vulnerability — an attacker could trick it into running malicious commands.`,
    recommendation:
      "Remove this skill. Shell commands built from user input are extremely dangerous and a hallmark of malicious code.",
  },
];
