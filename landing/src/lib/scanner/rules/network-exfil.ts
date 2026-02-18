import { Rule } from "../types";

const SOURCE_FILES = /\.(js|ts|mjs|cjs|py|rb|json)$/i;

export const networkExfilRules: Rule[] = [
  {
    id: "NET-001",
    severity: "critical",
    title: "Data exfiltration to Telegram Bot API",
    description: "Sends data to Telegram Bot API, commonly used for data exfiltration",
    filePatterns: SOURCE_FILES,
    patterns: [
      /api\.telegram\.org\/bot/i,
      /telegram\.org\/bot.*sendMessage/i,
      /telegram\.org\/bot.*sendDocument/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" sends data to a Telegram bot. This is the #1 method used by malicious skills to steal your data — your API keys, passwords, or files get sent to an attacker's Telegram chat.`,
    recommendation:
      "Remove this skill immediately. Legitimate skills have no reason to communicate with Telegram bots.",
  },
  {
    id: "NET-002",
    severity: "critical",
    title: "Data exfiltration via Discord webhook",
    description: "Sends data to Discord webhooks, commonly used for data exfiltration",
    filePatterns: SOURCE_FILES,
    patterns: [
      /discord(?:app)?\.com\/api\/webhooks\//i,
      /discord\.com\/api\/webhooks/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" sends data to a Discord webhook. Attackers use Discord webhooks to receive stolen data because they're free, anonymous, and hard to trace.`,
    recommendation:
      "Remove this skill immediately unless it's explicitly a Discord integration skill AND you set up the webhook yourself.",
  },
  {
    id: "NET-003",
    severity: "high",
    title: "Outbound HTTP to hardcoded IP address",
    description: "Makes HTTP requests to hardcoded IP addresses instead of domain names",
    filePatterns: SOURCE_FILES,
    patterns: [
      /https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/,
      /fetch\s*\(\s*['"`]https?:\/\/\d{1,3}\./,
      /axios\.\w+\s*\(\s*['"`]https?:\/\/\d{1,3}\./,
      /requests\.\w+\s*\(\s*['"`]https?:\/\/\d{1,3}\./,
    ],
    plainEnglish: (file) =>
      `The file "${file}" connects to a raw IP address instead of a normal website. Legitimate services use domain names. Raw IP addresses are often used to avoid detection and connect to attacker-controlled servers.`,
    recommendation:
      "Investigate what this IP address is. If you can't determine it's a legitimate service, remove this skill.",
  },
  {
    id: "NET-004",
    severity: "medium",
    title: "Data encoding before transmission",
    description: "Encodes data (base64/hex) before sending it over the network",
    filePatterns: SOURCE_FILES,
    patterns: [
      /btoa\s*\(.*fetch/,
      /base64.*(?:fetch|axios|request|http)/,
      /(?:fetch|axios|request|http).*base64/,
      /b64encode.*(?:urlopen|requests|urllib)/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" encodes data before sending it to a server. While encoding itself isn't always malicious, this pattern is common in data theft — the encoding hides what's being sent.`,
    recommendation:
      "Check what data is being encoded and where it's being sent. If you can't determine both, this is suspicious.",
  },
  {
    id: "NET-005",
    severity: "high",
    title: "Outbound connection to paste/webhook service",
    description: "Connects to paste services or generic webhook endpoints used for exfiltration",
    filePatterns: SOURCE_FILES,
    patterns: [
      /pastebin\.com/i,
      /paste\.ee/i,
      /hastebin\.com/i,
      /webhook\.site/i,
      /requestbin/i,
      /ngrok\.io/i,
      /burpcollaborator/i,
      /pipedream\.net/i,
      /hookbin\.com/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" connects to a paste or webhook service. These services are frequently used by attackers as anonymous drop points for stolen data.`,
    recommendation:
      "Remove this skill unless you specifically set up this webhook for your own use.",
  },
];
