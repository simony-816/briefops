import { listWorkLogs } from "./log.js";
import { listMemory } from "./memory.js";
import { listMemoryProposals } from "./memoryProposal.js";
import { listSkillPatches } from "./patch.js";
import { normalizeName } from "./paths.js";
import { readWorker } from "./worker.js";
import { requireWorkspace } from "./workspace.js";

export type InboxOptions = {
  cwd?: string;
  project?: string;
  worker?: string;
  skill?: string;
};

export type InboxSummary = {
  pendingMemoryProposals: number;
  pendingSkillPatches: number;
  openRisks: number;
  staleMemory: number;
  deprecatedMemory: number;
  recommendedCommands: string[];
};

export async function getInboxSummary(options: InboxOptions = {}): Promise<InboxSummary> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const project = options.project ? normalizeName(options.project) : undefined;
  const workerName = options.worker ? normalizeName(options.worker) : undefined;
  const worker = workerName ? await readWorker(cwd, workerName) : undefined;
  const skill = options.skill ? normalizeName(options.skill) : undefined;
  const workerSkills = new Set(worker?.default_skills ?? []);
  const effectiveProject = project ?? worker?.project;

  const memoryProposals = (await listMemoryProposals({
    cwd,
    status: "proposed",
    project: effectiveProject,
    skill
  })).filter((proposal) => !workerName || !proposal.worker || proposal.worker === workerName);

  const skillPatches = (await listSkillPatches(cwd))
    .filter((patch) => patch.status === "proposed")
    .filter((patch) => (skill ? patch.skill === skill : true))
    .filter((patch) => (workerSkills.size > 0 ? workerSkills.has(patch.skill) : true));

  const logs = await listWorkLogs({
    cwd,
    project: effectiveProject,
    skill,
    worker: workerName,
    limit: 20
  });
  const memory = await listMemory({
    cwd,
    project: effectiveProject,
    skill
  });
  const staleMemory = memory.filter((item) => item.status === "stale").length;
  const deprecatedMemory = memory.filter(
    (item) => item.status === "deprecated" || item.type === "deprecated"
  ).length;
  const inspectProject = effectiveProject ?? "<project>";
  const inspectWorker = workerName ?? "<worker>";

  return {
    pendingMemoryProposals: memoryProposals.length,
    pendingSkillPatches: skillPatches.length,
    openRisks: logs.flatMap((log) => log.open_risks).length,
    staleMemory,
    deprecatedMemory,
    recommendedCommands: [
      "briefops memory proposal-list --status proposed",
      "briefops skill patch-list",
      `briefops inspect continuity --project ${inspectProject} --worker ${inspectWorker}`
    ]
  };
}
