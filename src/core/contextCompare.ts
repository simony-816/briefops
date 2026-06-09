import { readBriefOpsConfig } from "./config.js";
import { BriefOpsError } from "./errors.js";
import { normalizeExportPolicy, type ExportPolicy } from "./exportPolicy.js";
import { listWorkLogs } from "./log.js";
import { listMemory } from "./memory.js";
import { projectFilePath, workerSummaryFilePath, workspacePaths } from "./paths.js";
import { primeContext } from "./prime.js";
import { pathExists, readTextFile } from "./storage.js";
import { estimateTokens } from "./tokens.js";
import { readWorker } from "./worker.js";

export type CompareContextOptions = {
  cwd?: string;
  worker?: string;
  project?: string;
  task: string;
  maxTokens?: number;
  exportPolicy?: ExportPolicy;
};

export type ContextComparison = {
  raw: {
    projectTokens: number;
    workerSummaryTokens: number;
    activeMemoryTokens: number;
    recentLogTokens: number;
    totalTokens: number;
  };
  prime: {
    tokens: number;
    maxTokens: number;
    exportPolicy: ExportPolicy;
  };
  savedTokens: number;
  compressionPercent: number;
  warnings: string[];
};

async function readOptionalTokens(filePath: string): Promise<number> {
  if (!(await pathExists(filePath))) {
    return 0;
  }
  return estimateTokens(await readTextFile(filePath));
}

export async function compareContext(options: CompareContextOptions): Promise<ContextComparison> {
  const cwd = options.cwd ?? process.cwd();
  if (!(await pathExists(workspacePaths(cwd).root))) {
    throw new BriefOpsError("No `.briefops` workspace found. Run `briefops init` first.");
  }

  const exportPolicy = normalizeExportPolicy(options.exportPolicy);
  const config = await readBriefOpsConfig(cwd);
  const workerName = options.worker ?? config.defaults.worker;
  if (!workerName) {
    throw new BriefOpsError("Compare context requires --worker or a default worker.");
  }
  const worker = await readWorker(cwd, workerName);
  const project = options.project ?? worker.project ?? config.defaults.project;
  if (!project) {
    throw new BriefOpsError("Compare context requires --project when the worker has no default project.");
  }

  const projectTokens = await readOptionalTokens(projectFilePath(cwd, project));
  const workerSummaryTokens = await readOptionalTokens(workerSummaryFilePath(cwd, worker.name));
  const activeMemory = await listMemory({
    cwd,
    project,
    status: "active"
  });
  const skillSet = new Set(worker.default_skills);
  const activeMemoryText = activeMemory
    .filter((item) => !item.skill || skillSet.size === 0 || skillSet.has(item.skill))
    .map((item) => item.content)
    .join("\n");
  const activeMemoryTokens = estimateTokens(activeMemoryText);
  const recentLogsText = (await listWorkLogs({
    cwd,
    project,
    worker: worker.name,
    limit: 8
  })).map((log) => [
    log.task,
    log.result,
    ...log.lessons,
    ...log.decisions,
    ...log.open_risks,
    ...log.next_steps,
    ...log.incidents,
    log.notes
  ].filter(Boolean).join("\n")).join("\n\n");
  const recentLogTokens = estimateTokens(recentLogsText);
  const rawTotal = projectTokens + workerSummaryTokens + activeMemoryTokens + recentLogTokens;
  const prime = await primeContext({
    cwd,
    worker: worker.name,
    project,
    task: options.task,
    maxTokens: options.maxTokens ?? 800,
    exportPolicy
  });
  const savedTokens = Math.max(0, rawTotal - prime.tokens);
  const compressionPercent = rawTotal > 0 ? Math.round((savedTokens / rawTotal) * 100) : 0;
  const warnings = [
    ...prime.warnings,
    exportPolicy === "shared-only"
      ? "Raw candidate context is a local-only estimate; shared-only prime output omits private memory and logs."
      : undefined
  ].filter((warning): warning is string => Boolean(warning));

  return {
    raw: {
      projectTokens,
      workerSummaryTokens,
      activeMemoryTokens,
      recentLogTokens,
      totalTokens: rawTotal
    },
    prime: {
      tokens: prime.tokens,
      maxTokens: options.maxTokens ?? 800,
      exportPolicy
    },
    savedTokens,
    compressionPercent,
    warnings
  };
}
