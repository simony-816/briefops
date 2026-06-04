import { BriefOpsError } from "./errors.js";
import { listWorkLogs } from "./log.js";
import { normalizeName, workerFilePath, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  parseCommaList,
  readTextFile,
  writeYamlFile
} from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { workerProfileSchema, type WorkerProfile } from "../schemas/worker.js";
import YAML from "yaml";

export type CreateWorkerOptions = {
  cwd?: string;
  name: string;
  description?: string;
  project?: string;
  skills?: string[] | string;
  style?: string[] | string;
  maxTokens?: number;
  force?: boolean;
};

export type ListWorkerFilters = {
  cwd?: string;
  status?: string;
};

function normalizeList(value?: string[] | string): string[] {
  if (Array.isArray(value)) {
    return value.map(normalizeName);
  }

  return parseCommaList(value).map(normalizeName);
}

async function writeWorker(cwd: string, worker: WorkerProfile, force = true): Promise<string> {
  const filePath = workerFilePath(cwd, worker.name);
  if (!force) {
    try {
      await readTextFile(filePath);
      throw new BriefOpsError(`File already exists: ${filePath}`);
    } catch (error) {
      if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
        await writeYamlFile(filePath, worker);
        return filePath;
      }

      throw error;
    }
  }

  await writeYamlFile(filePath, worker);
  return filePath;
}

export async function createWorker(
  options: CreateWorkerOptions
): Promise<{ path: string; worker: WorkerProfile }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const name = normalizeName(options.name);
  const worker = workerProfileSchema.parse({
    name,
    description: options.description ?? "",
    project: options.project ? normalizeName(options.project) : undefined,
    default_skills: normalizeList(options.skills),
    style: Array.isArray(options.style) ? options.style : parseCommaList(options.style),
    max_tokens: options.maxTokens ?? 300,
    status: "active"
  });
  const filePath = await writeWorker(cwd, worker, Boolean(options.force));

  return { path: filePath, worker };
}

export async function readWorker(cwd: string, name: string): Promise<WorkerProfile> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);
  const filePath = workerFilePath(cwd, normalized);

  try {
    const raw = await readTextFile(filePath);
    const parsed = YAML.parse(raw);
    const result = workerProfileSchema.safeParse(parsed);
    if (!result.success) {
      throw new BriefOpsError(`Invalid worker ${filePath}: ${result.error.message}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Worker not found: ${normalized}`);
    }

    throw error;
  }
}

export async function showWorker(cwd: string, name: string): Promise<string> {
  await requireWorkspace(cwd);
  const normalized = normalizeName(name);

  try {
    return await readTextFile(workerFilePath(cwd, normalized));
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Worker not found: ${normalized}`);
    }

    throw error;
  }
}

export async function listWorkers(filters: ListWorkerFilters = {}): Promise<WorkerProfile[]> {
  const cwd = filters.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).workers, ".worker.yaml");
  const workers = await Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const parsed = YAML.parse(raw);
      const result = workerProfileSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefOpsError(`Invalid worker ${filePath}: ${result.error.message}`);
      }
      return result.data;
    })
  );

  return workers.filter((worker) => (filters.status ? worker.status === filters.status : true));
}

export async function summarizeWorker(cwd: string, name: string, limit = 5): Promise<string> {
  const worker = await readWorker(cwd, name);
  const directLogs = await listWorkLogs({ cwd, worker: worker.name, limit });
  const skillLogs =
    directLogs.length > 0 || worker.default_skills.length === 0
      ? []
      : (
          await Promise.all(
            worker.default_skills.map((skill) => listWorkLogs({ cwd, skill, limit }))
          )
        ).flat();
  const logs = [...directLogs, ...skillLogs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);

  if (logs.length === 0) {
    return "No work history found for this worker yet.";
  }

  return logs
    .map((log) => {
      const skill = log.skill ? `/${log.skill}` : "";
      return `- ${log.created_at}: ${log.project ?? "global"}${skill} - ${log.result}`;
    })
    .join("\n");
}

export async function formatWorkerForBrief(cwd: string, name: string): Promise<string> {
  const worker = await readWorker(cwd, name);
  const sections = [
    `Name: ${worker.name}`,
    worker.description ? `Description: ${worker.description}` : undefined,
    worker.project ? `Default project: ${worker.project}` : undefined,
    worker.default_skills.length > 0
      ? `Default skills: ${worker.default_skills.join(", ")}`
      : undefined,
    worker.style.length > 0 ? `Style: ${worker.style.join("; ")}` : undefined,
    "Recent work history:",
    await summarizeWorker(cwd, name, 3)
  ].filter((line): line is string => Boolean(line));

  return sections.join("\n");
}
