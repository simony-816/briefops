import { randomBytes } from "node:crypto";
import path from "node:path";
import { formatDateStamp, normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import { listFilesBySuffix, parseCommaList, readTextFile, writeYamlFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { workLogSchema, type WorkLog } from "../schemas/log.js";
import YAML from "yaml";
import { BriefOpsError } from "./errors.js";

export type AddWorkLogOptions = {
  cwd?: string;
  project?: string;
  skill?: string;
  worker?: string;
  task: string;
  result: string;
  lessons?: string[];
  openRisks?: string[];
  nextSteps?: string[];
  decisions?: string[];
  incidents?: string[];
  files?: string;
  commands?: string;
  notes?: string;
};

export type ListWorkLogFilters = {
  cwd?: string;
  project?: string;
  skill?: string;
  worker?: string;
  limit?: number;
};

export async function addWorkLog(options: AddWorkLogOptions): Promise<{ path: string; log: WorkLog }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const createdAt = new Date().toISOString();
  const project = options.project ? normalizeName(options.project) : undefined;
  const skill = options.skill ? normalizeName(options.skill) : undefined;
  const worker = options.worker ? normalizeName(options.worker) : undefined;
  const log = workLogSchema.parse({
    id: `log_${createdAt.replace(/[-:.TZ]/g, "").slice(0, 17)}_${randomBytes(3).toString(
      "hex"
    )}`,
    created_at: createdAt,
    project,
    skill,
    worker,
    task: options.task.trim(),
    result: options.result.trim(),
    lessons: options.lessons ?? [],
    open_risks: options.openRisks ?? [],
    next_steps: options.nextSteps ?? [],
    decisions: options.decisions ?? [],
    incidents: options.incidents ?? [],
    files_changed: parseCommaList(options.files),
    commands_run: parseCommaList(options.commands),
    notes: options.notes ?? ""
  });
  const filename = `${formatDateStamp()}-${slugForFilename(project ?? "global")}-${slugForFilename(
    worker ?? skill ?? "general"
  )}.yaml`;
  const filePath = path.join(workspacePaths(cwd).logs, filename);

  await writeYamlFile(filePath, log);
  return { path: filePath, log };
}

export async function listWorkLogs(filters: ListWorkLogFilters = {}): Promise<WorkLog[]> {
  const cwd = filters.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const project = filters.project ? normalizeName(filters.project) : undefined;
  const skill = filters.skill ? normalizeName(filters.skill) : undefined;
  const worker = filters.worker ? normalizeName(filters.worker) : undefined;
  const limit = filters.limit ?? 20;
  const files = await listFilesBySuffix(workspacePaths(cwd).logs, ".yaml");
  const logs = await Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const parsed = YAML.parse(raw);
      const result = workLogSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefOpsError(`Invalid work log ${filePath}: ${result.error.message}`);
      }
      return result.data;
    })
  );

  return logs
    .filter((log) => (project ? log.project === project : true))
    .filter((log) => (skill ? log.skill === skill : true))
    .filter((log) => (worker ? log.worker === worker : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function readWorkLog(cwd: string, idOrLatest: string): Promise<WorkLog> {
  const normalized = idOrLatest.trim().toLowerCase();
  const logs = await listWorkLogs({ cwd, limit: Number.MAX_SAFE_INTEGER });
  if (normalized === "latest") {
    const latest = logs[0];
    if (!latest) {
      throw new BriefOpsError("No work logs found.");
    }
    return latest;
  }

  const match = logs.find((log) => log.id === idOrLatest);
  if (!match) {
    throw new BriefOpsError(`Work log not found: ${idOrLatest}`);
  }

  return match;
}

export async function summarizeRecentLogs(options: {
  cwd?: string;
  project?: string;
  skill?: string;
  worker?: string;
  limit?: number;
  budget?: number;
}): Promise<string> {
  const logs = await listWorkLogs(options);
  if (logs.length === 0) {
    return "No recent work logs found.";
  }

  const lines = logs.map((log) => {
    const details = [
      log.result,
      ...log.open_risks.map((risk) => `open risk: ${risk}`),
      ...log.next_steps.map((step) => `next: ${step}`)
    ].join("; ");
    return `- ${log.created_at.slice(0, 10)}: ${log.task}; ${details}`;
  });
  return lines.join("\n");
}
