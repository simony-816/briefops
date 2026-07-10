import { readBriefOpsConfig } from "./config.js";
import { inspectCodexPlugin } from "./codexPlugin.js";
export type RuntimeDoctorStatus = "ok" | "warn" | "fail";
export type RuntimeDoctorCheck = { name: string; status: RuntimeDoctorStatus; detail: string };
export type RuntimeDoctorResult = { ok: boolean; checks: RuntimeDoctorCheck[] };
export async function runRuntimeDoctor(options: { cwd?: string } = {}): Promise<RuntimeDoctorResult> {
  const config = await readBriefOpsConfig(options.cwd);
  if (!config.integrations.codex_plugin) return { ok: true, checks: [{ name: "Codex plugin", status: "ok", detail: "Codex plugin integration is not declared." }] };
  const inspection = await inspectCodexPlugin(options);
  const changed = inspection.files.filter((file) => file.status !== "ok");
  let detail = inspection.ok ? "Installed plugin matches generated assets." : changed.slice(0, 5).map((file) => `${file.relativePath}: ${file.status}`).join("; ");
  if (changed.length > 5) detail += `; and ${changed.length - 5} more`;
  return { ok: true, checks: [{ name: "Codex plugin", status: inspection.ok ? "ok" : "warn", detail }] };
}
