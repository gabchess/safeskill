import { Rule } from "../types";
import { codeExecutionRules } from "./code-execution";
import { networkExfilRules } from "./network-exfil";
import { filesystemAccessRules } from "./filesystem-access";
import { obfuscationRules } from "./obfuscation";
import { promptInjectionRules } from "./prompt-injection";
import { envHarvestingRules } from "./env-harvesting";
import { secretsRules } from "./secrets";

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
