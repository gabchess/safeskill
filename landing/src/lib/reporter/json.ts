import type { SkillScanResult, SetupScanResult } from "../scanner/types";

export function formatSkillJson(result: SkillScanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatSetupJson(result: SetupScanResult): string {
  return JSON.stringify(result, null, 2);
}
