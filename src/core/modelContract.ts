import { BriefOpsError } from "./errors.js";

export const codexModes = ["loop", "execute", "plan"] as const;
export type CodexMode = (typeof codexModes)[number];

export function normalizeCodexMode(value?: string): CodexMode {
  const mode = (value ?? "loop").trim().toLowerCase();
  if ((codexModes as readonly string[]).includes(mode)) return mode as CodexMode;
  throw new BriefOpsError(`Invalid Codex mode: ${value}`);
}

export function renderCodexModeInstruction(mode: CodexMode): string {
  if (mode === "plan") return "Plan only. Do not modify product code or workspace state.";
  if (mode === "execute") return "Execute only the current task, keeping changes scoped and verified.";
  return "Work in a bounded loop: inspect, plan, act, verify, and continue when verification fails.";
}
