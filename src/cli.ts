#!/usr/bin/env node

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

const args = process.argv.slice(2);

function printUsage() {
  console.log(`
SafeSkill - One-click security audit for your MCP setup

Usage:
  safeskill                          Scan your entire MCP setup
  safeskill scan <path>              Scan a specific skill/server directory
  safeskill config                   Check your MCP configuration only
  safeskill help                     Show this help

Options:
  --format=conversational|detailed|json   Output format (default: detailed)
  --skills-dir=<path>                     Override auto-detected skills directory

Examples:
  safeskill                          Full security audit
  safeskill scan ./my-mcp-server     Scan a specific project
  safeskill --format=json            Full audit in JSON format
`);
}

async function main() {
  const command = args.find((a) => !a.startsWith("--")) || "setup";
  const formatArg = args
    .find((a) => a.startsWith("--format="))
    ?.split("=")[1] as "conversational" | "detailed" | "json" | undefined;
  const format = formatArg || "detailed";
  const skillsDirArg = args
    .find((a) => a.startsWith("--skills-dir="))
    ?.split("=")[1];

  switch (command) {
    case "help":
    case "--help":
    case "-h":
      printUsage();
      break;

    case "scan": {
      const targetPath = args[args.indexOf("scan") + 1];
      if (!targetPath) {
        console.error("Error: Please provide a path to scan.");
        console.error("Usage: safeskill scan <path>");
        process.exit(1);
      }

      if (!existsSync(targetPath)) {
        console.error(`Error: Directory not found: ${targetPath}`);
        process.exit(1);
      }

      const result = await scanSkill(targetPath);
      console.log(
        format === "json" ? formatSkillJson(result) : formatSkillReport(result)
      );

      process.exit(result.rating === "RED" ? 2 : result.rating === "YELLOW" ? 1 : 0);
      break;
    }

    case "config": {
      const home = homedir();
      const findings = await checkConfig(home);

      if (findings.length === 0) {
        console.log("Your MCP configuration looks secure. No issues found.");
        process.exit(0);
      }

      console.log(
        `Found ${findings.length} configuration issue${findings.length === 1 ? "" : "s"}:\n`
      );
      for (const f of findings) {
        console.log(`[${f.severity.toUpperCase()}] ${f.title}`);
        console.log(f.plainEnglish);
        console.log(`Fix: ${f.recommendation}\n`);
      }

      const hasCritical = findings.some((f) => f.severity === "critical");
      process.exit(hasCritical ? 2 : 1);
      break;
    }

    case "setup":
    default: {
      const home = homedir();

      const possibleDirs = skillsDirArg
        ? [skillsDirArg]
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

      const configFindings = await checkConfig(home);

      if (!skillsPath && configFindings.length === 0) {
        console.log(
          "No MCP skills directory found and no configuration issues detected."
        );
        console.log(
          "If you have MCP skills installed, use --skills-dir=<path> to specify the location."
        );
        process.exit(0);
      }

      const result = await scanSetup(
        skillsPath || "/nonexistent",
        configFindings
      );

      let output: string;
      switch (format) {
        case "json":
          output = formatSetupJson(result);
          break;
        case "conversational":
          output = formatConversational(result);
          break;
        case "detailed":
        default:
          output = formatSetupReport(result);
          break;
      }

      console.log(output);
      process.exit(
        result.overallRating === "RED"
          ? 2
          : result.overallRating === "YELLOW"
            ? 1
            : 0
      );
    }
  }
}

main().catch((error) => {
  console.error("Error:", error.message);
  process.exit(1);
});
