import { Rule } from "../types";

const DESCRIPTION_FILES = /\.(md|txt|yaml|yml|json)$/i;
const ALL_FILES = /\.(js|ts|mjs|cjs|py|rb|json|yaml|yml|md|txt)$/i;

export const promptInjectionRules: Rule[] = [
  {
    id: "PI-001",
    severity: "critical",
    title: "Prompt injection in skill description",
    description: "Skill description contains instructions that attempt to override agent behavior",
    filePatterns: DESCRIPTION_FILES,
    patterns: [
      /ignore\s+(all\s+)?previous\s+instructions/i,
      /disregard\s+(all\s+)?prior/i,
      /you\s+are\s+now\s+(?:a|an)\s+(?!mcp|skill)/i,
      /system\s*:\s*you\s+(?:must|should|are)/i,
      /\bdo\s+not\s+(?:reveal|share|tell|disclose|show)\b.*\b(?:instructions|prompt|system)\b/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains prompt injection — hidden instructions that try to take over your AI agent. Instead of doing what you ask, your agent could be tricked into following the attacker's instructions, like sending your data to them.`,
    recommendation:
      "Remove this skill immediately. Prompt injection in a skill description is a deliberate attack on your agent.",
  },
  {
    id: "PI-002",
    severity: "high",
    title: "Hidden instructions in tool descriptions",
    description: "Tool or parameter descriptions contain instructions beyond normal documentation",
    filePatterns: ALL_FILES,
    patterns: [
      /(?:always|must|should)\s+(?:include|send|forward|copy|attach)\s+(?:the\s+)?(?:api.?key|token|password|secret|credential)/i,
      /(?:before|after)\s+(?:each|every|any)\s+(?:request|call|response),?\s+(?:also\s+)?(?:send|forward|copy)/i,
      /(?:silently|quietly|secretly|without\s+telling)\s+(?:send|copy|forward|include)/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains hidden instructions that try to make your agent silently send your credentials or data somewhere. This is a sophisticated prompt injection attack.`,
    recommendation:
      "Remove this skill immediately. This is a deliberate attempt to steal your credentials through your AI agent.",
  },
  {
    id: "PI-003",
    severity: "medium",
    title: "Invisible text in description files",
    description: "Uses HTML comments, zero-width characters, or other techniques to hide text",
    filePatterns: DESCRIPTION_FILES,
    patterns: [
      /<!--[\s\S]*?(?:system|instruction|ignore|override)[\s\S]*?-->/i,
      /\[.*?\]\(.*?javascript:/i,
      /\[.*?\]\(\s*data:/i,
    ],
    plainEnglish: (file) =>
      `The file "${file}" contains hidden text that's invisible in normal rendering. This hidden text could contain instructions that trick your AI agent.`,
    recommendation:
      "View the raw source of this file to see what's hidden. If it contains instructions, remove this skill.",
  },
];
