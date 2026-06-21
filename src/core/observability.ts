import { compareContext, type ContextComparison } from "./contextCompare.js";
import { readBriefOpsConfig } from "./config.js";
import { BriefOpsError } from "./errors.js";
import { inspectContinuityHealth } from "./continuity.js";
import { normalizeExportPolicy, type ExportPolicy } from "./exportPolicy.js";
import { getInboxSummary } from "./inbox.js";
import { inspectMemoryHygiene } from "./memoryHygiene.js";
import { readWorker } from "./worker.js";

export type ContinuityObservabilityOptions = {
  cwd?: string;
  worker?: string;
  project?: string;
  task: string;
  maxTokens?: number;
  exportPolicy?: ExportPolicy;
};

export type ContinuityObservability = {
  ok: boolean;
  worker: string;
  project: string;
  task: string;
  context: ContextComparison;
  continuity: {
    readiness: string;
    workLogs: number;
    activeMemory: number;
  };
  queues: {
    pendingMemoryProposals: number;
    pendingSkillPatches: number;
    openRisks: number;
  };
  hygiene: {
    warnings: string[];
    duplicateLike: number;
    potentialConflicts: number;
    oldActive: number;
    stale: number;
    deprecated: number;
  };
};

export async function inspectContinuityObservability(
  options: ContinuityObservabilityOptions
): Promise<ContinuityObservability> {
  const cwd = options.cwd ?? process.cwd();
  const exportPolicy = normalizeExportPolicy(options.exportPolicy);
  const config = await readBriefOpsConfig(cwd);
  const workerName = options.worker ?? config.defaults.worker;
  if (!workerName) {
    throw new BriefOpsError("Continuity observability requires --worker or a default worker.");
  }
  const worker = await readWorker(cwd, workerName);
  const project = options.project ?? worker.project ?? config.defaults.project;
  if (!project) {
    throw new BriefOpsError("Continuity observability requires --project when the worker has no default project.");
  }

  const [context, health, inbox, hygiene] = await Promise.all([
    compareContext({
      cwd,
      worker: worker.name,
      project,
      task: options.task,
      maxTokens: options.maxTokens,
      exportPolicy
    }),
    inspectContinuityHealth({
      cwd,
      project,
      worker: worker.name
    }),
    getInboxSummary({
      cwd,
      project,
      worker: worker.name
    }),
    inspectMemoryHygiene({ cwd })
  ]);

  const activeMemory = Object.values(health.memory).reduce((sum, count) => sum + count, 0);
  return {
    ok: health.readiness !== "FAIL",
    worker: worker.name,
    project,
    task: options.task,
    context,
    continuity: {
      readiness: health.readiness,
      workLogs: health.history.workLogs,
      activeMemory
    },
    queues: {
      pendingMemoryProposals: inbox.pendingMemoryProposals,
      pendingSkillPatches: inbox.pendingSkillPatches,
      openRisks: inbox.openRisks
    },
    hygiene: {
      warnings: hygiene.warnings,
      duplicateLike: hygiene.duplicateLike.length,
      potentialConflicts: hygiene.potentialConflicts.length,
      oldActive: hygiene.oldActive.length,
      stale: hygiene.stale.length,
      deprecated: hygiene.deprecated.length
    }
  };
}
