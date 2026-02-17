# SafeSkill

One-click security audit for your MCP setup. Get a safety score, plain-English explanations, and fix recommendations.

## What it does

SafeSkill scans your installed MCP skills and configuration for security issues:

- **Malicious code patterns**: eval(), shell injection, obfuscated code
- **Data exfiltration**: connections to Telegram bots, Discord webhooks, paste sites
- **Credential theft**: access to SSH keys, cloud credentials, browser data, crypto wallets
- **Prompt injection**: hidden instructions in skill descriptions
- **Configuration issues**: exposed ports, missing auth, hardcoded secrets

## How to use

Just ask your agent:

> "Check if my MCP setup is safe"

> "Scan my MCP skills for security issues"

> "Is my setup secure?"

## Tools

### scan_setup

Scans your entire MCP setup — all installed skills and configuration files. Returns an overall safety score (0-100) with GREEN/YELLOW/RED rating and plain-English explanations for every issue found.

### scan_skill

Scans a specific skill directory. Provide the path and get a detailed security report.

### check_config

Checks just your MCP configuration files for issues like exposed ports, insecure connections, and hardcoded secrets.

## Installation

Add to your MCP configuration:

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

Or install globally:

```bash
npm install -g safeskill
```

Then add:

```json
{
  "mcpServers": {
    "safeskill": {
      "command": "safeskill-server"
    }
  }
}
```
