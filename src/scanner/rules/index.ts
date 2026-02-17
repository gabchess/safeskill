import { Rule } from "../types.js";
import { codeExecutionRules } from "./code-execution.js";
import { networkExfilRules } from "./network-exfil.js";
import { filesystemAccessRules } from "./filesystem-access.js";
import { obfuscationRules } from "./obfuscation.js";
import { promptInjectionRules } from "./prompt-injection.js";
import { envHarvestingRules } from "./env-harvesting.js";
import { secretsRules } from "./secrets.js";

export const allRules: Rule[] = [
  ...codeExecutionRules,
  ...networkExfilRules,
  ...filesystemAccessRules,
  ...obfuscationRules,
  ...promptInjectionRules,
  ...envHarvestingRules,
  ...secretsRules,
];

export function getRuleById(id: string): Rule | undefined {
  return allRules.find((r) => r.id === id);
}

export function getRulesBySeverity(severity: Rule["severity"]): Rule[] {
  return allRules.filter((r) => r.severity === severity);
}

export {
  codeExecutionRules,
  networkExfilRules,
  filesystemAccessRules,
  obfuscationRules,
  promptInjectionRules,
  envHarvestingRules,
  secretsRules,
};
