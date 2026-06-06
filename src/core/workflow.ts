import path from "node:path";
import { generateCodexResume } from "./codex.js";
import { inspectContinuityHealth } from "./continuity.js";
import { BriefOpsError } from "./errors.js";
import { generateHandoff } from "./handoff.js";
import { addWorkLog, type AddWorkLogOptions } from "./log.js";
import {
  isNoMemoryProposalCandidatesError,
  listMemoryProposals,
  proposeMemoryFromLog
} from "./memoryProposal.js";
import { proposeSkillPatch } from "./patch.js";
import { normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import { writeTextFile } from "./storage.js";
import { readWorker, refreshWorkerSummary } from "./worker.js";
import { requireWorkspace } from "./workspace.js";
import { estimateTokens } from "./tokens.js";

export type FinishWorkOptions = AddWorkLogOptions & {
  proposeSkillPatch?: boolean;
  refreshWorker?: boolean;
  continueTask?: string;
};

export type FinishWorkResult = {
  logId: string;
  logPath: string;
  memoryProposalId?: string;
  memoryProposalPath?: string;
  skillPatchId?: string;
  skillPatchPath?: string;
  workerSummaryPath?: string;
  nextCommand: string;
  warnings: string[];
};

export type ContinueWorkOptions = {
  cwd?: string;
  project?: string;
  worker: string;
  task: string;
  budget?: number;
  mode?: string;
  completionPromise?: string;
  outputPath?: string;
  pack?: boolean;
};

export type ContinueWorkResult = {
  readiness: string;
  pendingMemoryProposals: number;
  workerSummaryPath: string;
  handoffPath?: string;
  resumePath?: string;
  packPath?: string;
  nextCommand: string;
  warnings: string[];
};

export type PackResumeOptions = {
  cwd?: string;
  worker: string;
  project?: string;
  task: string;
  budget?: number;
  outputPath?: string;
};

export type PackResumeResult = {
  path: string;
  tokens: number;
  content: string;
  warnings: string[];
};

function shellQuote(value: string): string {
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function continueCommand(options: {
  project?: string;
  worker?: string;
  task: string;
}): string {
  return [
    "briefops continue",
    options.project ? `--project ${options.project}` : undefined,
    options.worker ? `--worker ${options.worker}` : undefined,
    `--task ${shellQuote(options.task)}`
  ].filter((part): part is string => Boolean(part)).join(" ");
}

export async function finishWork(options: FinishWorkOptions): Promise<FinishWorkResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const logResult = await addWorkLog(options);
  const warnings: string[] = [];
  let memoryProposalId: string | undefined;
  let memoryProposalPath: string | undefined;
  try {
    const memoryProposal = await proposeMemoryFromLog({
      cwd,
      fromLog: logResult.log.id
    });
    memoryProposalId = memoryProposal.proposal.id;
    memoryProposalPath = memoryProposal.path;
  } catch (error) {
    if (!isNoMemoryProposalCandidatesError(error)) {
      throw error;
    }
    warnings.push("No durable memory proposal candidates found.");
  }
  let skillPatchId: string | undefined;
  let skillPatchPath: string | undefined;
  if (options.proposeSkillPatch && !options.skill) {
    throw new BriefOpsError("Skill patch proposal requires --skill.");
  }
  if (options.proposeSkillPatch && options.skill) {
    const patch = await proposeSkillPatch({
      cwd,
      skill: options.skill,
      fromLog: logResult.log.id
    });
    skillPatchId = patch.patch.id;
    skillPatchPath = patch.path;
  }

  let workerSummaryPath: string | undefined;
  if (options.refreshWorker && options.worker) {
    workerSummaryPath = (await refreshWorkerSummary({
      cwd,
      name: options.worker
    })).path;
  }

  const nextTask = options.continueTask ?? logResult.log.next_steps[0] ?? options.task;
  const nextCommand = continueCommand({
    project: logResult.log.project,
    worker: logResult.log.worker,
    task: nextTask
  });

  return {
    logId: logResult.log.id,
    logPath: logResult.path,
    memoryProposalId,
    memoryProposalPath,
    skillPatchId,
    skillPatchPath,
    workerSummaryPath,
    nextCommand,
    warnings
  };
}

export async function continueWork(options: ContinueWorkOptions): Promise<ContinueWorkResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const worker = normalizeName(options.worker);
  const workerProfile = await readWorker(cwd, worker);
  const project = options.project ? normalizeName(options.project) : workerProfile.project;
  if (!project) {
    throw new BriefOpsError("Continue requires --project when the worker has no default project.");
  }
  const health = await inspectContinuityHealth({
    cwd,
    project,
    worker
  });
  if (health.readiness === "FAIL") {
    throw new BriefOpsError("Continuity health failed. Run `briefops inspect continuity` for details.");
  }

  const pending = (await listMemoryProposals({
    cwd,
    status: "proposed",
    project
  })).filter((proposal) => !proposal.worker || proposal.worker === worker);
  const summary = await refreshWorkerSummary({
    cwd,
    name: worker
  });
  const handoff = await generateHandoff({
    cwd,
    project,
    worker,
    task: options.task,
    budget: options.budget,
    save: true
  });
  const resume = await generateCodexResume({
    cwd,
    project,
    worker,
    task: options.task,
    fromHandoff: handoff.id,
    budget: options.budget,
    mode: options.mode,
    completionPromise: options.completionPromise,
    save: true,
    outputPath: options.outputPath
  });
  const pack = options.pack
    ? await packResume({
        cwd,
        project,
        worker,
        task: options.task,
        budget: options.budget
      })
    : undefined;

  return {
    readiness: health.readiness,
    pendingMemoryProposals: pending.length,
    workerSummaryPath: summary.path,
    handoffPath: handoff.savedPath,
    resumePath: resume.savedPath,
    packPath: pack?.path,
    nextCommand: continueCommand({
      project,
      worker,
      task: options.task
    }),
    warnings: [
      health.readiness === "WARN" ? "Continuity health is WARN; prompt was still generated." : undefined,
      pending.length > 0 ? "Pending memory proposals should be reviewed before continuing." : undefined,
      ...handoff.warnings,
      ...(pack?.warnings ?? [])
    ].filter((warning): warning is string => Boolean(warning))
  };
}

function scrubLocalBriefOpsReferences(content: string): string {
  return content
    .replace(
      /^Project file:\s*\.briefops\/[^\r\n]+$/gim,
      "Project context is included in this pack; no local BriefOps project file access is required."
    )
    .replace(
      /`?\.briefops\/[^`\s)]+`?/g,
      "included local BriefOps context"
    );
}

function renderPortablePackHeader(options: {
  worker: string;
  task: string;
  generatedAt: string;
  tokens: number;
}): string {
  return [
    "# BriefOps Portable Resume Pack",
    "",
    "This pack is self-contained. Paste it into Codex or attach it to a fresh thread.",
    "",
    "Review before sharing outside your local machine. It may include local project memory, decisions, lessons, risks, and worker history.",
    "",
    `Worker: ${options.worker}`,
    `Task: ${options.task}`,
    `Generated: ${options.generatedAt}`,
    `Estimated tokens: ${options.tokens}`,
    ""
  ].join("\n");
}

export async function packResume(options: PackResumeOptions): Promise<PackResumeResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const worker = normalizeName(options.worker);
  const resume = await generateCodexResume({
    cwd,
    worker,
    project: options.project,
    task: options.task,
    budget: options.budget ?? 3000,
    save: false
  });
  const portableResume = scrubLocalBriefOpsReferences(resume.content).trim();
  const generatedAt = new Date().toISOString();
  let tokens = 0;
  const buildContent = (estimatedTokens: number) => [
      renderPortablePackHeader({
        worker,
        task: options.task.trim(),
        generatedAt,
        tokens: estimatedTokens
      }),
      portableResume,
      ""
    ].join("\n");
  let content = buildContent(tokens);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const nextTokens = estimateTokens(content);
    if (nextTokens === tokens) {
      break;
    }
    tokens = nextTokens;
    content = buildContent(tokens);
  }
  const budget = options.budget ?? 3000;
  const warnings = tokens > budget
    ? [`Portable resume pack exceeds token budget by ${tokens - budget} estimated tokens; core continuity content was preserved.`]
    : [];
  const targetPath = options.outputPath ?? path.join(
    workspacePaths(cwd).codexPrompts,
    `${slugForFilename(worker)}-resume-pack-${Date.now()}.md`
  );
  await writeTextFile(targetPath, content, { force: true });

  return {
    path: targetPath,
    tokens,
    content,
    warnings
  };
}
