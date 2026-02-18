import { Rule } from "../types";

const SOURCE_FILES = /\.(js|ts|mjs|cjs|py|rb|sh|bash)$/i;

export const filesystemAccessRules: Rule[] = [
  {
    id: "FS-001",
    severity: "critical",
    title: "Access to SSH keys",
    description: "Reads SSH private keys or known_hosts",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\.ssh\/id_/,
      /\.ssh\/known_hosts/,
      /\.ssh\/authorized_keys/,
      /\.ssh\/config/,
      /id_rsa|id_ed25519|id_ecdsa/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" tries to read your SSH keys. These keys give access to your servers, GitHub account, and other systems. If stolen, an attacker can impersonate you on any server you have access to.`,
    recommendation:
      "Remove this skill immediately. No legitimate skill needs to read your SSH keys.",
  },
  {
    id: "FS-002",
    severity: "critical",
    title: "Access to cloud credentials",
    description: "Reads AWS, GCP, or Azure credential files",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\.aws\/credentials/,
      /\.aws\/config/,
      /\.azure\//,
      /\.config\/gcloud/,
      /google.*credentials.*\.json/i,
      /service.account.*\.json/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" tries to read your cloud credentials (AWS, Google Cloud, or Azure). These credentials could give an attacker full access to your cloud infrastructure — they could spin up crypto miners, access your databases, or rack up thousands in charges.`,
    recommendation:
      "Remove this skill immediately. Cloud credentials should never be accessed by MCP skills.",
  },
  {
    id: "FS-003",
    severity: "critical",
    title: "Access to browser profiles",
    description: "Reads browser data (cookies, passwords, history)",
    filePatterns: SOURCE_FILES,
    patterns: [
      /Chrome.*(?:Default|Profile)/i,
      /Firefox.*profiles/i,
      /\.mozilla\/firefox/i,
      /google-chrome/i,
      /Login\s*Data/i,
      /Cookies\.sqlite/i,
      /Local\s*State/i,
      /\.browser/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" tries to access your browser data — this could include your saved passwords, cookies (login sessions), and browsing history. This is a classic data-stealing technique.`,
    recommendation:
      "Remove this skill immediately. This is textbook info-stealer behavior.",
  },
  {
    id: "FS-004",
    severity: "critical",
    title: "Access to cryptocurrency wallets",
    description: "Reads cryptocurrency wallet files or seed phrases",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\.bitcoin\//i,
      /\.ethereum\//i,
      /wallet\.dat/i,
      /\.solana\/id\.json/i,
      /metamask/i,
      /phantom/i,
      /\.crypto\//i,
      /keystore.*utc/i,
      /seed.?phrase/i,
      /mnemonic/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" tries to access cryptocurrency wallet files. If your wallet data or seed phrases are stolen, your crypto can be transferred out irreversibly.`,
    recommendation:
      "Remove this skill immediately. This is the most common goal of malicious MCP skills — stealing cryptocurrency.",
  },
  {
    id: "FS-005",
    severity: "high",
    title: "Access to .env or dotfiles",
    description: "Reads .env files or other configuration files that commonly contain secrets",
    filePatterns: SOURCE_FILES,
    patterns: [
      /\.env\b/,
      /dotenv/,
      /\.netrc/,
      /\.npmrc/,
      /\.pypirc/,
      /\.docker\/config/,
      /\.kube\/config/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" reads environment files or config files that typically contain passwords, API keys, and tokens. This is how attackers harvest credentials from your development environment.`,
    recommendation:
      "Only allow this if the skill explicitly documents why it needs these files. Most skills should receive credentials through proper configuration, not by reading dotfiles.",
  },
  {
    id: "FS-006",
    severity: "high",
    title: "Broad filesystem traversal",
    description: "Recursively walks directories or reads from sensitive system paths",
    filePatterns: SOURCE_FILES,
    patterns: [
      /readdirSync.*recursive/,
      /os\.walk\s*\(\s*['"][\/~]/,
      /glob\s*\(\s*['"][\/*]/,
      /\/etc\/passwd/,
      /\/etc\/shadow/,
    ],
    plainEnglish: (file) =>
      `The file "${file}" scans through directories on your computer. This could be used to find and collect sensitive files, passwords, or personal data.`,
    recommendation:
      "Check what directories are being scanned. A skill should only access its own data directory, not your entire filesystem.",
  },
];
