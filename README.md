# SafeSkill

**One-click security audit for your MCP setup.**

One score. Plain English. No CLI knowledge required.

SafeSkill scans your MCP skills and configuration for security issues and gives you a clear safety score (0-100) with plain-English explanations of every finding.

```
Overall Score: 62/100 YELLOW [############--------]

Found 7 security issues across 4 skills.

Skills you should remove:
- sketchy-data-tool (Score: 15/100) — tries to read your SSH keys and send them to a server
- crypto-helper (Score: 35/100) — contains a hardcoded crypto wallet address

Skills to review:
- file-manager (Score: 65/100) — can run system commands on your computer

Clean skills: weather, calculator, notes
```

## Quick Start

### As an MCP Skill (recommended)

Add SafeSkill to your MCP configuration and just ask your agent:

> "Check if my MCP setup is safe"

```json
{
  "mcpServers": {
    "safeskill": {
      "command": "node",
      "args": ["/path/to/safeskill/dist/index.js"]
    }
  }
}
```

### As a CLI

```bash
# Scan your entire setup
npx safeskill

# Scan a specific skill
npx safeskill scan ./my-mcp-server

# Check config only
npx safeskill config

# JSON output
npx safeskill --format=json
```

## What It Detects

### Critical
- Dynamic code execution (`eval()`, `new Function()`)
- Shell command injection
- Data exfiltration to Telegram/Discord/paste sites
- Access to SSH keys, cloud credentials, crypto wallets, browser data
- Prompt injection in skill descriptions
- Environment variable theft over network
- Crypto wallet address replacement

### High
- Child process spawning
- Outbound HTTP to raw IP addresses
- Bulk environment variable harvesting
- Base64/hex obfuscation at runtime
- JavaScript code obfuscation
- Hardcoded API keys and secrets
- Access to .env and dotfiles
- Exposed ports (0.0.0.0 binding)
- Disabled authentication flags

### Medium
- Data encoding before transmission
- Hidden Unicode characters
- Hardcoded secrets in config
- Supply chain risk (npx/uvx execution)

## Scoring

Each skill gets a score from 0-100:

| Score | Rating | Meaning |
|-------|--------|---------|
| 80-100 | GREEN | No significant issues found |
| 50-79 | YELLOW | Some concerns — review the findings |
| 0-49 | RED | Serious issues — remove or replace this skill |

Scores are based on the number and severity of findings, with diminishing returns for repeated instances of the same issue.

## Output Formats

- **Conversational**: Chat-friendly summary for use in MCP agents
- **Detailed**: Full markdown report with all findings
- **JSON**: Machine-readable output for automation

## Building from Source

```bash
git clone https://github.com/yourusername/safeskill.git
cd safeskill
npm install
npm run build
```

## License

MIT
