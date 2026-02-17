import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { Finding } from "../scanner/types.js";

/**
 * Check various MCP configuration files for security issues.
 * Supports Claude Desktop, Cline, and generic MCP gateway configs.
 */
export async function checkConfig(homeDir: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  // Check Claude Desktop config
  const claudeConfigs = [
    join(homeDir, "Library", "Application Support", "Claude", "claude_desktop_config.json"),
    join(homeDir, ".config", "claude", "claude_desktop_config.json"),
    join(homeDir, "AppData", "Roaming", "Claude", "claude_desktop_config.json"),
  ];

  for (const configPath of claudeConfigs) {
    if (existsSync(configPath)) {
      const configFindings = await checkMcpConfig(configPath);
      findings.push(...configFindings);
    }
  }

  // Check for generic MCP config files
  const genericConfigs = [
    join(homeDir, ".mcp", "config.json"),
    join(homeDir, ".mcp.json"),
    join(homeDir, ".cline", "mcp_settings.json"),
  ];

  for (const configPath of genericConfigs) {
    if (existsSync(configPath)) {
      const configFindings = await checkMcpConfig(configPath);
      findings.push(...configFindings);
    }
  }

  return findings;
}

async function checkMcpConfig(configPath: string): Promise<Finding[]> {
  const findings: Finding[] = [];

  let content: string;
  try {
    content = await readFile(configPath, "utf-8");
  } catch {
    return findings;
  }

  let config: Record<string, unknown>;
  try {
    config = JSON.parse(content);
  } catch {
    findings.push({
      ruleId: "CFG-001",
      severity: "low",
      title: "Malformed configuration file",
      description: "Configuration file is not valid JSON",
      plainEnglish: `Your config file at "${configPath}" isn't valid JSON. This might cause unexpected behavior.`,
      file: configPath,
      recommendation: "Fix the JSON syntax in your configuration file.",
    });
    return findings;
  }

  // Check for exposed network servers (SSE/HTTP transport)
  const servers = (config.mcpServers || config.servers || {}) as Record<
    string,
    Record<string, unknown>
  >;

  for (const [name, server] of Object.entries(servers)) {
    if (!server || typeof server !== "object") continue;

    // Check for SSE/HTTP servers that might be exposed
    const url = (server.url || server.endpoint || "") as string;
    if (url && typeof url === "string") {
      if (url.includes("0.0.0.0") || url.includes("://0.0.0.0")) {
        findings.push({
          ruleId: "CFG-002",
          severity: "critical",
          title: `Skill "${name}" is exposed to the internet`,
          description: "Server binds to 0.0.0.0, making it accessible from any network",
          plainEnglish: `Your skill "${name}" is configured to listen on all network interfaces (0.0.0.0). This means anyone on your network — or the internet if you don't have a firewall — can connect to it and use your AI agent.`,
          file: configPath,
          recommendation: `Change the bind address to "127.0.0.1" or "localhost" to only allow local connections.`,
        });
      }

      if (url.startsWith("http://") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
        findings.push({
          ruleId: "CFG-003",
          severity: "high",
          title: `Skill "${name}" uses unencrypted HTTP`,
          description: "Server communicates over plain HTTP instead of HTTPS",
          plainEnglish: `Your skill "${name}" connects over plain HTTP (not HTTPS). This means your data — including any API keys or sensitive information — is sent unencrypted and could be intercepted.`,
          file: configPath,
          recommendation: "Use HTTPS instead of HTTP for remote connections.",
        });
      }
    }

    // Check for environment variables with secrets passed inline
    const env = server.env as Record<string, string> | undefined;
    if (env && typeof env === "object") {
      for (const [key, value] of Object.entries(env)) {
        if (typeof value !== "string") continue;
        // Check for API keys hardcoded in config
        if (
          /(?:api[_-]?key|secret|token|password)/i.test(key) &&
          value.length > 8 &&
          !value.startsWith("${") &&
          !value.startsWith("$")
        ) {
          findings.push({
            ruleId: "CFG-004",
            severity: "medium",
            title: `Hardcoded secret in "${name}" configuration`,
            description: `Environment variable "${key}" appears to contain a hardcoded secret`,
            plainEnglish: `Your skill "${name}" has a secret (${key}) hardcoded directly in the config file. If this file is shared, committed to git, or backed up to the cloud, the secret is exposed.`,
            file: configPath,
            recommendation: `Move "${key}" to a .env file or use your system's secret management. Never hardcode secrets in config files.`,
          });
        }
      }
    }

    // Check for suspicious command-line args
    const args = server.args as string[] | undefined;
    if (Array.isArray(args)) {
      const argsStr = args.join(" ");
      if (/--no-auth|--disable-auth|--no-ssl|--insecure/i.test(argsStr)) {
        findings.push({
          ruleId: "CFG-005",
          severity: "high",
          title: `Skill "${name}" has security disabled`,
          description: "Server is launched with security features explicitly disabled",
          plainEnglish: `Your skill "${name}" is configured with security features turned off (${argsStr.match(/--no-auth|--disable-auth|--no-ssl|--insecure/i)?.[0]}). This makes it vulnerable to unauthorized access.`,
          file: configPath,
          recommendation: "Remove the insecure flags and enable proper authentication.",
        });
      }
    }

    // Check for npx/uvx running remote packages (supply chain risk)
    const command = server.command as string | undefined;
    if (typeof command === "string") {
      if (/^(?:npx|uvx|bunx)\b/.test(command)) {
        // npx running a package that isn't well-known
        findings.push({
          ruleId: "CFG-006",
          severity: "medium",
          title: `Skill "${name}" runs via ${command.split(" ")[0]}`,
          description: "Server runs packages directly without prior installation",
          plainEnglish: `Your skill "${name}" uses ${command.split(" ")[0]} to run a package directly from the internet without installing it first. This means you're trusting the package registry to serve the correct code every time — a supply chain attack could serve malicious code instead.`,
          file: configPath,
          recommendation: "Install the package locally first (`npm install`), then reference the local binary instead of using npx.",
        });
      }
    }
  }

  return findings;
}
