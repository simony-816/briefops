import { BriefOpsError } from "./errors.js";
import { listWorkLogs } from "./log.js";
import { listMemory } from "./memory.js";
import { estimateTokens, truncateToTokenBudget } from "./tokens.js";
import { normalizeName, workerFilePath, workerSummaryFilePath, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  parseCommaList,
  readTextFile,
  writeTextFile,
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

export async function refreshWorkerSummary(options: {
  cwd?: string;
  name: string;
  limit?: number;
}): Promise<{ path: string; content: string; tokens: number }> {
  const cwd = options.cwd ?? process.cwd();
  const worker = await readWorker(cwd, options.name);
  const limit = options.limit ?? 20;
  const logs = await listWorkLogs({ cwd, worker: worker.name, limit });
  const skillLogs =
    logs.length > 0 || worker.default_skills.length === 0
      ? []
      : (
          await Promise.all(
            worker.default_skills.map((skill) => listWorkLogs({ cwd, skill, limit }))
          )
        ).flat();
  const recentLogs = [...logs, ...skillLogs]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
  const skillSet = new Set(worker.default_skills);
  const memories = await listMemory({
    cwd,
    project: worker.project,
    status: "active"
  });
  const workerMemories = memories.filter(
    (item) => !item.skill || skillSet.size === 0 || skillSet.has(item.skill)
  );
  const lessons = workerMemories
    .filter((item) => item.type === "lesson")
    .map((item) => item.content)
    .slice(0, 10);
  const incidents = workerMemories
    .filter((item) => item.type === "incident")
    .map((item) => item.content)
    .slice(0, 8);
  const rules = [
    ...worker.style.map((style) => `Apply operating style: ${style}.`),
    ...lessons.slice(0, 5).map((lesson) => `Use lesson: ${lesson}`)
  ];
  const content = [
    `# Worker Summary: ${worker.name}`,
    "",
    "## Identity",
    "",
    worker.description || "No worker description recorded.",
    "",
    "## Default Project",
    "",
    worker.project ?? "No default project recorded.",
    "",
    "## Default Skills",
    "",
    worker.default_skills.length > 0
      ? worker.default_skills.map((skill) => `- ${skill}`).join("\n")
      : "- No default skills recorded.",
    "",
    "## Operating Style",
    "",
    worker.style.length > 0
      ? worker.style.map((style) => `- ${style}`).join("\n")
      : "- No operating style recorded.",
    "",
    "## Recent Work",
    "",
    recentLogs.length > 0
      ? recentLogs
          .map((log) => `- ${log.created_at.slice(0, 10)}: ${log.task}; ${log.result}`)
          .join("\n")
      : "- No recent work recorded.",
    "",
    "## Accumulated Lessons",
    "",
    lessons.length > 0 ? lessons.map((lesson) => `- ${lesson}`).join("\n") : "- No active lessons recorded.",
    "",
    "## Known Failure Patterns",
    "",
    incidents.length > 0
      ? incidents.map((incident) => `- ${incident}`).join("\n")
      : "- No active incidents recorded.",
    "",
    "## Active Judgment Rules",
    "",
    rules.length > 0 ? rules.map((rule) => `- ${rule}`).join("\n") : "- Verify before completion.",
    "",
    "## Last Refreshed",
    "",
    new Date().toISOString(),
    ""
  ].join("\n");
  const filePath = workerSummaryFilePath(cwd, worker.name);
  await writeTextFile(filePath, content, { force: true });

  return {
    path: filePath,
    content,
    tokens: estimateTokens(content)
  };
}

export async function generateWorkerIntelligence(options: {
  cwd?: string;
  name: string;
  budget?: number;
}): Promise<{ content: string; tokens: number }> {
  const cwd = options.cwd ?? process.cwd();
  const worker = await readWorker(cwd, options.name);
  const skillSet = new Set(worker.default_skills);
  const memories = await listMemory({
    cwd,
    project: worker.project,
    status: "active"
  });
  const workerMemories = memories.filter(
    (item) => !item.skill || skillSet.size === 0 || skillSet.has(item.skill)
  );
  const logs = await listWorkLogs({ cwd, worker: worker.name, limit: 5 });
  const byType = (type: string, limit: number) =>
    workerMemories
      .filter((item) => item.type === type)
      .map((item) => `- ${item.content}`)
      .slice(0, limit)
      .join("\n") || "- No items found yet.";
  const style = worker.style.length > 0
    ? worker.style.map((item) => `- ${item}`).join("\n")
    : "- Verify before completion.";
  const recent = logs.length > 0
    ? logs.map((log) => `- ${log.created_at.slice(0, 10)}: ${log.result}`).join("\n")
    : "- No items found yet.";
  const content = [
    `# Worker Intelligence: ${worker.name}`,
    "",
    "## Identity",
    "",
    worker.description || "No worker description recorded.",
    "",
    "## Default Operating Style",
    "",
    style,
    "",
    "## Skill Bundle",
    "",
    worker.default_skills.length > 0
      ? worker.default_skills.map((skill) => `- ${skill}`).join("\n")
      : "- No default skills recorded.",
    "",
    "## Judgment Profile",
    "",
    "- Prefers explicit verification before merge recommendation.",
    "- Treats unverified risk assumptions as blocking.",
    "- Prioritizes project governance over short-term speed.",
    "",
    "## Accumulated Lessons",
    "",
    byType("lesson", 8),
    "",
    "## Known Failure Patterns",
    "",
    byType("incident", 6),
    "",
    "## Recent Work",
    "",
    recent,
    "",
    "## Active Decisions",
    "",
    byType("decision", 6),
    ""
  ].join("\n");
  const budget = options.budget ?? 800;
  const trimmed = truncateToTokenBudget(content, budget).text;
  return {
    content: trimmed,
    tokens: estimateTokens(trimmed)
  };
}

export async function readWorkerSummary(cwd: string, name: string): Promise<string | undefined> {
  try {
    return await readTextFile(workerSummaryFilePath(cwd, name));
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      return undefined;
    }
    throw error;
  }
}

export async function formatWorkerForBrief(cwd: string, name: string): Promise<string> {
  const worker = await readWorker(cwd, name);
  const summary = await readWorkerSummary(cwd, name);
  if (summary) {
    return truncateToTokenBudget(summary, worker.max_tokens).text;
  }

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
