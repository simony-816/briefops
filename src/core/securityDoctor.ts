import { promises as fs } from "node:fs";
import path from "node:path";
import { readBriefOpsConfig } from "./config.js";
import { listMemory } from "./memory.js";
import { listMemoryProposals } from "./memoryProposal.js";
import { memoryCategories, memoryFilePath, workspacePaths } from "./paths.js";
import { listSkillPatches } from "./patch.js";
import { pathExists, readTextFile, readYamlFile } from "./storage.js";
import { readWorker } from "./worker.js";
import { memoryFileSchema } from "../schemas/memory.js";

export type SecurityDoctorStatus = "ok" | "warn" | "fail";

export type SecurityDoctorCheck = {
  name: string;
  status: SecurityDoctorStatus;
  detail: string;
};

export type SecurityDoctorResult = {
  ok: boolean;
  checks: SecurityDoctorCheck[];
};

function check(name: string, status: SecurityDoctorStatus, detail: string): SecurityDoctorCheck {
  return { name, status, detail };
}

async function listStaleLocks(cwd: string, staleMs: number): Promise<string[]> {
  const lockDir = path.join(workspacePaths(cwd).root, ".locks");
  if (!(await pathExists(lockDir))) {
    return [];
  }

  const entries = await fs.readdir(lockDir);
  const stale: string[] = [];
  for (const entry of entries.filter((item) => item.endsWith(".lock"))) {
    const filePath = path.join(lockDir, entry);
    const raw = await readTextFile(filePath);
    const createdAt = raw.match(/^created_at: (.+)$/m)?.[1]?.trim();
    const created = createdAt ? Date.parse(createdAt) : Number.NaN;
    if (Number.isNaN(created) || Date.now() - created > staleMs) {
      stale.push(entry);
    }
  }

  return stale;
}

export async function runSecurityDoctor(options: {
  cwd?: string;
  staleMs?: number;
} = {}): Promise<SecurityDoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  const paths = workspacePaths(cwd);
  const checks: SecurityDoctorCheck[] = [];

  if (!(await pathExists(paths.root))) {
    return {
      ok: false,
      checks: [check("Workspace", "fail", ".briefops workspace not found.")]
    };
  }
  checks.push(check("Workspace", "ok", paths.root));

  let config;
  try {
    config = await readBriefOpsConfig(cwd);
    checks.push(check("Config YAML", "ok", paths.config));
  } catch (error) {
    checks.push(check("Config YAML", "fail", error instanceof Error ? error.message : String(error)));
  }

  const invalidMemory: string[] = [];
  for (const category of memoryCategories) {
    try {
      await readYamlFile(memoryFilePath(cwd, category), memoryFileSchema, { items: [] });
    } catch (error) {
      invalidMemory.push(`${category}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  checks.push(
    invalidMemory.length === 0
      ? check("Memory YAML", "ok", "All memory files are valid.")
      : check("Memory YAML", "fail", invalidMemory.join("; "))
  );

  if (config?.defaults.worker) {
    try {
      await readWorker(cwd, config.defaults.worker);
      checks.push(check("Default worker", "ok", config.defaults.worker));
    } catch (error) {
      checks.push(
        check("Default worker", "fail", error instanceof Error ? error.message : String(error))
      );
    }
  } else {
    checks.push(check("Default worker", "warn", "No default worker selected."));
  }

  const pendingMemory = await listMemoryProposals({ cwd, status: "proposed" });
  checks.push(
    pendingMemory.length > 0
      ? check("Pending memory proposals", "warn", `${pendingMemory.length} proposal(s) need review.`)
      : check("Pending memory proposals", "ok", "No pending memory proposals.")
  );

  const pendingPatches = (await listSkillPatches(cwd)).filter((patch) => patch.status === "proposed");
  checks.push(
    pendingPatches.length > 0
      ? check("Pending skill patches", "warn", `${pendingPatches.length} patch(es) need review.`)
      : check("Pending skill patches", "ok", "No pending skill patches.")
  );

  const privateExportable = (await listMemory({ cwd })).filter(
    (item) => item.visibility === "private" && item.exportable
  );
  checks.push(
    privateExportable.length > 0
      ? check("Private exportable memory", "warn", `${privateExportable.length} private item(s) are exportable.`)
      : check("Private exportable memory", "ok", "No private exportable memory.")
  );

  const staleLocks = await listStaleLocks(cwd, options.staleMs ?? 30 * 60 * 1000);
  checks.push(
    staleLocks.length > 0
      ? check("Stale lock files", "fail", staleLocks.join(", "))
      : check("Stale lock files", "ok", "No stale lock files.")
  );

  return {
    ok: checks.every((item) => item.status !== "fail"),
    checks
  };
}
