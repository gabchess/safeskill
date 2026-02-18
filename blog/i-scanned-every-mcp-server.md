# I Scanned 3,093 MCP Servers. Here's What I Found.

I downloaded every MCP server I could find: 2,500 from npm and 841 from the official MCP registry. Then I ran static analysis against all of them. The results are worse than I expected.

**The short version:** 1 in 4 MCP servers has at least one security finding. 1 in 8 is rated RED. 176 scored a flat zero.

Here's the full breakdown.

---

## The Setup

MCP (Model Context Protocol) is the open standard that lets AI agents like Claude, Cursor, and Windsurf connect to external tools. Think of MCP servers as plugins for your AI. They give it the ability to read files, query databases, send emails, browse the web, and thousands of other things.

The problem is that MCP servers run with your local privileges. When you install one, it can do anything you can do: read your SSH keys, access your cloud credentials, harvest your environment variables, and exfiltrate all of it over the network. There's no sandbox. There's no permission system. There's trust, and that's it.

Cisco, 1Password, Snyk, and Bitdefender have all published reports calling this out. But nobody had done a comprehensive scan of the actual ecosystem. So I built [SafeSkill](https://github.com/gabchess/safeskill), a scanner with 32 detection rules, and pointed it at everything.

## What I Scanned

- **2,499 packages** from npm (every package matching MCP-related search queries)
- **5,802 servers** from the [official MCP registry](https://registry.modelcontextprotocol.io), which yielded **841 npm packages** (594 not already in the npm set)
- **3,093 unique packages** after deduplication

Each package was downloaded, extracted, and scanned against 32 rules covering: dynamic code execution, network exfiltration, filesystem access to sensitive paths, prompt injection, code obfuscation, environment variable harvesting, hardcoded secrets, and cryptocurrency wallet patterns.

Total scan time: ~90 minutes on a MacBook.

## The Numbers

| Metric | Count | % |
|--------|------:|----:|
| Unique packages scanned | 3,093 | — |
| Packages with findings | **858** | **27.7%** |
| Rated RED (score < 50) | **397** | **12.8%** |
| Scored 0/100 | **176** | **5.7%** |
| Packages with critical findings | **373** | **12.1%** |
| Total individual findings | **34,934** | — |

Nearly **28% of MCP servers** have at least one security issue worth flagging.

### Score Distribution

```
  100/100:  2,235 packages  ██████████████████████████████████████████████
    80-99:    179 packages  ████
    50-79:    282 packages  ██████
     0-49:    397 packages  ████████
```

The bimodal distribution is stark. Most packages are perfectly clean (2,235 scored 100/100). But the long tail is ugly. 397 packages scored below 50, and 176 of those scored a flat zero.

## What I Found

### 1. Child Process Execution Is Everywhere

**338 packages** (10.9%) spawn child processes: `execSync`, `child_process`, `subprocess.run`. And **131 of those** also harvest environment variables.

This is the combination that keeps me up at night. A package that can run shell commands AND read your env vars has everything it needs to exfiltrate your credentials without you noticing.

Is every one of these malicious? No. Git tools, Docker tools, and terminal utilities legitimately need child processes. But 338 is a lot of surface area, and most users have no way to tell the legitimate ones from the dangerous ones.

### 2. Environment Variable Harvesting Is Rampant

- **218 packages** (7%) read environment variables in bulk (`JSON.stringify(process.env)`, `Object.keys(process.env)`)
- **192 packages** (6.2%) combine environment variable access with network calls

Your environment variables are a treasure chest. `OPENAI_API_KEY`, `AWS_SECRET_ACCESS_KEY`, `GITHUB_TOKEN`, database passwords. They're all sitting in `process.env`, and 1 in 14 MCP servers is reading them.

The legitimate pattern is reading *specific* variables: `process.env.OPENAI_API_KEY`. The dangerous pattern is reading *all of them*: `JSON.stringify(process.env)`. I flagged the latter.

### 3. Dynamic Code Execution

**73 packages** use `eval()`, `new Function()`, or equivalent. That's 2.4% of the ecosystem.

`eval()` is the #1 red flag in malicious code because it allows arbitrary code execution at runtime. The actual payload can be hidden, downloaded, or constructed on the fly.

**26 packages** combine `eval()` with outbound network calls, including:

- An official Notion MCP server fork
- A browser automation tool
- A code analysis server (ironic)
- Multiple "utility" packages

When a package can both execute arbitrary code AND phone home, you're one malicious update away from a full compromise.

### 4. Shell Command Injection

**79 packages** build shell commands using string interpolation:

```javascript
execSync(`curl ${url}/upload -d "${data}"`);
```

This is textbook command injection. If any part of that string comes from user input (or from the AI agent's output, which is itself influenced by potentially untrusted content), an attacker can break out of the command and run anything.

### 5. Sensitive File Access

This is where it gets personal:

| What's being accessed | Packages |
|----------------------|----------|
| `.env` and dotfiles | **639** (20.7%) |
| Browser profiles (cookies, passwords, history) | **59** |
| Crypto wallet files | **36** |
| SSH keys | **11** |
| Cloud credentials (AWS, GCP, Azure) | **8** |

**11 packages** reference paths like `~/.ssh/id_rsa`, `~/.ssh/id_ed25519`, or `~/.ssh/authorized_keys`. No legitimate MCP server needs your SSH keys.

**8 packages** reference `~/.aws/credentials`, `~/.config/gcloud`, or Azure credential paths. If your AI plugin is reading your cloud credentials, something has gone very wrong.

**5 packages** combine SSH or cloud credential access with outbound network connections. That's the full exfiltration chain: read credentials, send them somewhere.

### 6. Crypto Wallet Addresses

**36 packages** contain cryptocurrency wallet addresses (Bitcoin, Ethereum, or Solana patterns).

Some of these are legitimate: crypto tools, blockchain explorers, DeFi integrations. But wallet address replacement is the #1 monetization technique for malicious MCP servers: swap the user's destination address for the attacker's, and the transaction goes through normally... to the wrong wallet.

**7 packages** combine crypto wallet addresses with code obfuscation (base64/hex encoding). That's a much more suspicious signal. Why would you obfuscate a wallet address unless you're trying to hide it?

### 7. Prompt Injection

**25 packages** contain prompt injection patterns: hidden instructions in descriptions, README files, or tool metadata that attempt to override the AI agent's behavior.

Most of these turned out to be security tools that include prompt injection *test cases* (like `@waftester/cli`, `agent-security-scanner-mcp`, `safety-agent-mcp`). But the pattern is valid and worth flagging. The line between "testing prompt injection" and "doing prompt injection" is just intent.

The more interesting cases are packages where prompt injection appears alongside other suspicious signals. When a package has hidden instructions AND accesses sensitive files AND makes network calls, the coincidence starts looking deliberate.

### 8. Code Obfuscation

**96 packages** use base64 or hex encoding at runtime. **73 packages** use obfuscated JavaScript patterns (`String.fromCharCode`, hex-escaped property access, constructor tricks).

Legitimate uses exist (handling binary data, encoding API payloads). But combined with other signals, obfuscation is a strong indicator that something is being hidden.

### 9. Outbound Connections to Suspicious Endpoints

- **69 packages** connect to hardcoded IP addresses (instead of domain names)
- **10 packages** connect to paste sites, webhook services, or request bin endpoints
- **1 package** connects to the Telegram Bot API

Telegram bots are the #1 exfiltration channel for info-stealers. Finding even one is notable.

## The Worst Offenders

176 packages scored 0/100. Here's what the bottom looks like:

| Package | Findings | Critical | What it does |
|---------|----------|----------|-------------|
| `brave-real-browser-mcp-server` | 1,086 | 547 | Every rule triggered — eval, shell injection, credential access, obfuscation, the works |
| `mcp-console-automation` | 658 | multiple | SSH key access + cloud creds + shell execution + env harvesting + network calls |
| `flow-nexus` | 602 | multiple | eval + shell injection + env exfil + crypto wallets + obfuscation |
| `mcp-rubber-duck` | 491 | multiple | eval + shell injection + env harvesting + obfuscation across 158 files |
| `mcp-server-semgrep` | 426 | 147 | eval + shell injection + crypto wallets + obfuscation |

The average RED-rated package has **54 findings**. The average zero-score package has far more.

## Important Caveats

**Not every finding is malicious.** A browser automation tool that spawns Chrome processes *should* have `child_process` references. A crypto tool *should* have wallet addresses. A `.env`-reading tool that helps you manage environment variables is doing exactly what it says.

What I'm measuring is **attack surface**, not **intent**. The findings tell you which packages *could* be dangerous, not which ones *are*. That distinction matters.

That said:

- A package with 1 finding in an expected category is probably fine
- A package with 15+ findings across multiple categories is suspicious regardless of stated purpose
- A package that combines credential access + network calls + obfuscation is almost certainly worth avoiding

**Static analysis has limits.** This scan doesn't catch:
- Malicious behavior triggered only at runtime
- Payloads downloaded from remote servers after installation
- Typosquatting (a package named `@notion-mcp/server` vs `@notionhq/notion-mcp-server`)
- Compromised dependencies (I scanned the package itself, not its `node_modules`)

A clean scan doesn't mean a package is safe. But a dirty scan means you should look closer.

## What You Should Do

**If you use MCP servers:**

1. **Audit what you have installed.** Run `safeskill` against your setup. It takes seconds.
2. **Remove anything you don't actively use.** Every installed server is attack surface.
3. **Prefer servers from known publishers.** Anthropic's official servers, major companies (Stripe, Cloudflare, Sentry). These have reputations to protect.
4. **Check before you install.** A 30-second look at the source code is better than nothing.
5. **Don't run MCP servers with more permissions than they need.** If a weather tool needs network access, fine. If it also needs filesystem access, that's a red flag.

**If you build MCP servers:**

1. **Don't read `process.env` in bulk.** Access specific variables by name.
2. **Don't use `eval()`.** There's almost always a better way.
3. **Don't shell out with string interpolation.** Use `execFile` with argument arrays.
4. **Don't access sensitive paths** unless that's literally your server's purpose.
5. **Document your permissions.** Tell users what your server accesses and why.

**If you're building the MCP ecosystem:**

The protocol needs a permission model. Users should be able to see what a server *can* do before they install it, and restrict what it's *allowed* to do after. Sandboxing, capability declarations, runtime permission prompts — any of these would dramatically reduce the attack surface.

Right now, installing an MCP server is an act of faith. That's not sustainable at 5,802 servers and counting.

## Try It Yourself

**Try it in your browser** (no install needed): **[getsafeskill.vercel.app](https://getsafeskill.vercel.app)**

Or install [SafeSkill](https://github.com/gabchess/safeskill) locally. Add it as an MCP server and ask your agent "Is my MCP setup safe?", or run the CLI directly:

```bash
npx safeskill scan ./path-to-any-mcp-server
```

You'll get a score from 0-100 and plain-English explanations for every finding.

The full scan data (3,093 packages) is in the repo if you want to do your own analysis.

---

## Methodology

- **Scanner:** [SafeSkill](https://github.com/gabchess/safeskill) v0.1.0, 32 static analysis rules
- **Sources:** npm registry (text search for MCP-related packages) + official MCP registry (registry.modelcontextprotocol.io, all 5,802 servers)
- **Scope:** Published npm packages only. Python (PyPI) and Docker (OCI) packages from the official registry were not scanned in this round.
- **Date:** February 18, 2026
- **Code:** The scanning scripts and full result data are available in the [SafeSkill GitHub repo](https://github.com/gabchess/safeskill)

I plan to expand this to PyPI packages and run periodic re-scans. If you want updates, star the repo or follow me.

---

*Built with [SafeSkill](https://github.com/gabchess/safeskill) — one-click security audit for your MCP setup.*
