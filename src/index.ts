#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { scanSkill, scanSetup } from "./scanner/engine.js";
import { checkConfig } from "./skill/config-checker.js";
import {
  formatSetupReport,
  formatConversational,
  formatSkillReport,
} from "./reporter/plain-english.js";
import { formatSetupJson, formatSkillJson } from "./reporter/json.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";

const server = new McpServer({
  name: "safeskill",
  version: "0.1.0",
});

// Main tool: scan your entire setup
server.tool(
  "scan_setup",
  "Scan your entire MCP setup for security issues. Returns a plain-English report with an overall safety score and per-skill breakdown.",
  {
    format: z
      .enum(["conversational", "detailed", "json"])
      .default("conversational")
      .describe(
        "Output format: 'conversational' for a chat-friendly summary, 'detailed' for a full markdown report, 'json' for raw data"
      ),
    skills_dir: z
      .string()
      .optional()
      .describe(
        "Path to the MCP skills directory. Auto-detected if not provided."
      ),
  },
  async ({ format, skills_dir }) => {
    const home = homedir();

    // Auto-detect skills directory
    const possibleDirs = skills_dir
      ? [skills_dir]
      : [
          join(home, ".mcp", "skills"),
          join(home, ".mcp", "servers"),
          join(home, ".config", "mcp", "skills"),
          join(home, ".claude", "mcp"),
          join(home, "Library", "Application Support", "Claude", "mcp"),
        ];

    let skillsPath: string | null = null;
    for (const dir of possibleDirs) {
      if (existsSync(dir)) {
        skillsPath = dir;
        break;
      }
    }

    // Check config regardless of skills directory
    const configFindings = await checkConfig(home);

    if (!skillsPath) {
      // No skills directory found — still report config issues
      const result = await scanSetup("/nonexistent", configFindings);
      result.summary =
        "Could not find an MCP skills directory. Config check results are below.";

      if (format === "json") {
        return { content: [{ type: "text" as const, text: formatSetupJson(result) }] };
      }

      if (configFindings.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "I couldn't find any MCP skills installed on your system, and your configuration looks clean. You're good!",
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: format === "conversational"
              ? formatConversational(result)
              : formatSetupReport(result),
          },
        ],
      };
    }

    const result = await scanSetup(skillsPath, configFindings);

    let output: string;
    switch (format) {
      case "json":
        output = formatSetupJson(result);
        break;
      case "detailed":
        output = formatSetupReport(result);
        break;
      case "conversational":
      default:
        output = formatConversational(result);
        break;
    }

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// Tool: scan a specific skill
server.tool(
  "scan_skill",
  "Scan a specific MCP skill/server directory for security issues. Returns a safety score with plain-English explanations of any findings.",
  {
    path: z
      .string()
      .describe("Path to the skill directory to scan"),
    format: z
      .enum(["detailed", "json"])
      .default("detailed")
      .describe("Output format: 'detailed' for markdown report, 'json' for raw data"),
  },
  async ({ path, format }) => {
    if (!existsSync(path)) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Directory not found: ${path}. Please provide a valid path to a skill directory.`,
          },
        ],
      };
    }

    const result = await scanSkill(path);
    const output =
      format === "json" ? formatSkillJson(result) : formatSkillReport(result);

    return { content: [{ type: "text" as const, text: output }] };
  }
);

// Tool: check just the config
server.tool(
  "check_config",
  "Check your MCP configuration files for security issues like exposed ports, missing auth, and hardcoded secrets.",
  {},
  async () => {
    const home = homedir();
    const findings = await checkConfig(home);

    if (findings.length === 0) {
      return {
        content: [
          {
            type: "text" as const,
            text: "Your MCP configuration looks secure. No issues found.",
          },
        ],
      };
    }

    const lines: string[] = [
      `Found ${findings.length} configuration issue${findings.length === 1 ? "" : "s"}:`,
      "",
    ];

    for (const f of findings) {
      lines.push(`**${f.title}** [${f.severity.toUpperCase()}]`);
      lines.push(f.plainEnglish);
      lines.push(`**Fix:** ${f.recommendation}`);
      lines.push("");
    }

    return { content: [{ type: "text" as const, text: lines.join("\n") }] };
  }
);

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("SafeSkill server error:", error);
  process.exit(1);
});
