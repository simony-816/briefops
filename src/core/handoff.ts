import path from "node:path";
import { normalizeBriefAdapter, type BriefAdapter } from "./adapter.js";
import { BriefOpsError } from "./errors.js";
import { listWorkLogs, summarizeRecentLogs } from "./log.js";
import { formatMemoryItem, selectContinuityContext } from "./memory.js";
import { readProject } from "./project.js";
import { formatDateStamp, normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import {
  listFilesBySuffix,
  parseMarkdownWithFrontmatter,
  readTextFile,
  stringifyMarkdownWithFrontmatter,
  writeTextFile
} from "./storage.js";
import { estimateTokens, truncateToTokenBudget } from "./tokens.js";
import { generateWorkerIntelligence, readWorker } from "./worker.js";
import { requireWorkspace } from "./workspace.js";
import { handoffSchema, type HandoffMetadata } from "../schemas/handoff.js";
import type { TokenReportLine } from "../schemas/brief.js";

const defaultPolicy = {
  max_total_tokens: 2500,
  project: 450,
  worker: 350,
  recent_logs: 450,
  decisions: 350,
  lessons: 350,
  incidents: 250,
  open_risks: 250,
  task: 150,
  template: 300
};

export type GenerateHandoffOptions = {
  cwd?: string;
  project?: string;
  worker?: string;
  task?: string;
  budget?: number;
  adapter?: string;
  fromHandoff?: string;
  mode?: string;
  completionPromise?: string;
  save?: boolean;
  outputPath?: string;
};

export type HandoffResult = {
  id: string;
  content: string;
  tokens: number;
  budget: number;
  warnings: string[];
  report: TokenReportLine[];
  savedPath?: string;
};

function sectionReport(label: string, text: string, budget: number): TokenReportLine {
  return {
    label,
    used: estimateTokens(text),
    budget
  };
}

function renderTokenReport(lines: TokenReportLine[], total: number, budget: number): string {
  return [
    ...lines.map((line) => `- ${line.label}: ${line.used} / ${line.budget}`),
    `- Total: ${total} / ${budget}`
  ].join("\n");
}

function formatMemory(items: ReturnType<typeof formatMemoryItem>[]): string {
  return items.length > 0 ? items.join("\n") : "No active matching memory found.";
}

async function resolveHandoffContext(options: GenerateHandoffOptions): Promise<{
  cwd: string;
  project?: string;
  worker?: string;
  skills: string[];
  task?: string;
  budget: number;
  adapter: BriefAdapter;
}> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const workerName = options.worker ? normalizeName(options.worker) : undefined;
  const worker = workerName ? await readWorker(cwd, workerName) : undefined;
  const project = options.project
    ? normalizeName(options.project)
    : worker?.project
      ? normalizeName(worker.project)
      : undefined;

  return {
    cwd,
    project,
    worker: workerName,
    skills: worker?.default_skills ?? [],
    task: options.task?.trim(),
    budget: options.budget ?? defaultPolicy.max_total_tokens,
    adapter: normalizeBriefAdapter(options.adapter)
  };
}

export async function generateHandoff(options: GenerateHandoffOptions): Promise<HandoffResult> {
  const context = await resolveHandoffContext(options);
  const id = `handoff_${formatDateStamp()}`;
  const projectText = context.project
    ? truncateToTokenBudget((await readProject(context.cwd, context.project)).body, defaultPolicy.project).text
    : "No project selected.";
  const workerSummary = context.worker
    ? (await generateWorkerIntelligence({
        cwd: context.cwd,
        name: context.worker,
        budget: defaultPolicy.worker
      })).content
    : "No worker selected.";
  const workerText = truncateToTokenBudget(workerSummary, defaultPolicy.worker).text;
  const logsText = truncateToTokenBudget(await summarizeRecentLogs({
    cwd: context.cwd,
    project: context.project,
    worker: context.worker,
    limit: 5
  }), defaultPolicy.recent_logs).text;
  const logs = await listWorkLogs({
    cwd: context.cwd,
    project: context.project,
    worker: context.worker,
    limit: 5
  });
  const memory = await selectContinuityContext({
    cwd: context.cwd,
    project: context.project,
    skill: context.skills[0],
    skills: context.skills,
    worker: context.worker,
    task: context.task,
    maxTokens:
      defaultPolicy.decisions +
      defaultPolicy.lessons +
      defaultPolicy.incidents,
    quotas: {
      decisions: 5,
      lessons: 6,
      incidents: 4,
      facts: 3,
      deprecated: 0
    }
  });
  const byType = (type: string) =>
    memory.items.filter((item) => item.type === type).map(formatMemoryItem);
  const taskText = truncateToTokenBudget(context.task ?? "No next task provided.", defaultPolicy.task).text;
  const openRisks = logs.flatMap((log) => log.open_risks);
  const nextSteps = logs.flatMap((log) => log.next_steps);
  const warnings = [
    memory.omitted > 0 ? `${memory.omitted} memory item(s) were omitted by handoff budget or quotas.` : undefined
  ].filter((warning): warning is string => Boolean(warning));
  const sections = [
    ["Project", projectText, defaultPolicy.project] as const,
    ["Worker", workerText, defaultPolicy.worker] as const,
    ["Recent Work", logsText, defaultPolicy.recent_logs] as const,
    ["Active Decisions", formatMemory(byType("decision")), defaultPolicy.decisions] as const,
    ["Active Lessons", formatMemory(byType("lesson")), defaultPolicy.lessons] as const,
    ["Recent Incidents / Risks", formatMemory(byType("incident")), defaultPolicy.incidents] as const,
    ["Open Risks", openRisks.length > 0 ? openRisks.map((risk) => `- ${risk}`).join("\n") : "No unresolved open risks found.", defaultPolicy.open_risks] as const,
    ["Current Task", taskText, defaultPolicy.task] as const
  ];
  const report = sections.map(([label, text, budget]) => sectionReport(label, text, budget));
  const body = [
    "# BriefOps Continuity Handoff",
    "",
    "## Purpose",
    "",
    "This handoff lets a new AI coding thread continue work without requiring the user to repeat project history, worker judgment, and recent task context.",
    "",
    "## Project",
    "",
    projectText,
    "",
    "## Worker",
    "",
    workerText,
    "",
    "## Current Task",
    "",
    taskText,
    "",
    "## Recent Work",
    "",
    logsText,
    "",
    "## Active Decisions",
    "",
    formatMemory(byType("decision")),
    "",
    "## Active Lessons",
    "",
    formatMemory(byType("lesson")),
    "",
    "## Recent Incidents / Risks",
    "",
    formatMemory(byType("incident")),
    "",
    "## Open Risks",
    "",
    openRisks.length > 0 ? openRisks.map((risk) => `- ${risk}`).join("\n") : "No unresolved open risks found.",
    "",
    "## Suggested Next Actions",
    "",
    nextSteps.length > 0 ? nextSteps.map((step) => `- ${step}`).join("\n") : `- ${taskText}`,
    "",
    "## Read If Needed",
    "",
    context.project ? `Project file: .briefops/projects/${context.project}.project.md` : "No project references listed.",
    "",
    "## Token Budget Report",
    "",
    "__TOKEN_REPORT__",
    ""
  ].join("\n");
  let content = body;
  let tokens = estimateTokens(content.replace("__TOKEN_REPORT__", ""));
  content = content.replace("__TOKEN_REPORT__", renderTokenReport(report, tokens, context.budget));
  tokens = estimateTokens(content);
  if (tokens > context.budget) {
    warnings.push(`Rendered handoff exceeds token budget by ${tokens - context.budget} estimated tokens.`);
  }
  if (warnings.length > 0) {
    content = content.replace(
      "## Purpose",
      `> ${warnings.join("\n> ")}\n\n## Purpose`
    );
    tokens = estimateTokens(content);
  }
  content = content.replace(
    /- Total: \d+ \/ \d+/,
    `- Total: ${tokens} / ${context.budget}`
  );
  tokens = estimateTokens(content);
  const metadata: HandoffMetadata = {
    id,
    created_at: new Date().toISOString(),
    project: context.project,
    worker: context.worker,
    task: context.task,
    adapter: context.adapter,
    budget: context.budget,
    total_tokens: tokens,
    warnings
  };
  const rendered = stringifyMarkdownWithFrontmatter(metadata, content);
  const savedPath = options.save
    ? await saveGeneratedHandoff({
        cwd: context.cwd,
        id,
        project: context.project,
        worker: context.worker,
        content: rendered,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    id,
    content: rendered,
    tokens: estimateTokens(rendered),
    budget: context.budget,
    warnings,
    report,
    savedPath
  };
}

export async function saveGeneratedHandoff(options: {
  cwd: string;
  id: string;
  project?: string;
  worker?: string;
  content: string;
  outputPath?: string;
}): Promise<string> {
  const targetPath =
    options.outputPath ??
    path.join(
      workspacePaths(options.cwd).handoffs,
      `${options.id}-${slugForFilename(options.project ?? "global")}-${slugForFilename(
        options.worker ?? "handoff"
      )}.md`
    );
  await writeTextFile(targetPath, options.content, { force: true });
  return targetPath;
}

function handoffIdFromPath(filePath: string): string {
  return path.basename(filePath, ".md");
}

async function resolveSavedHandoffPath(cwd: string, idOrLatest: string): Promise<string> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).handoffs, ".md");
  if (files.length === 0) {
    throw new BriefOpsError("No saved handoffs found.");
  }
  if (idOrLatest.trim().toLowerCase() === "latest") {
    return [...files].sort().at(-1) as string;
  }
  const match = files.find((filePath) => handoffIdFromPath(filePath).startsWith(idOrLatest));
  if (!match) {
    throw new BriefOpsError(`Saved handoff not found: ${idOrLatest}`);
  }
  return match;
}

export async function listSavedHandoffs(cwd = process.cwd()): Promise<Array<{
  id: string;
  path: string;
  tokens: number;
}>> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).handoffs, ".md");
  const handoffs = await Promise.all(
    files.map(async (filePath) => ({
      id: handoffIdFromPath(filePath),
      path: filePath,
      tokens: estimateTokens(await readTextFile(filePath))
    }))
  );
  return handoffs.sort((a, b) => b.id.localeCompare(a.id));
}

export async function showSavedHandoff(cwd: string, idOrLatest: string): Promise<string> {
  return readTextFile(await resolveSavedHandoffPath(cwd, idOrLatest));
}

export async function inspectSavedHandoff(cwd: string, idOrLatest: string): Promise<{
  metadata: HandoffMetadata;
  path: string;
  characters: number;
}> {
  const filePath = await resolveSavedHandoffPath(cwd, idOrLatest);
  const raw = await readTextFile(filePath);
  const parsed = parseMarkdownWithFrontmatter(raw, handoffSchema, filePath);
  return {
    metadata: parsed.data,
    path: filePath,
    characters: raw.length
  };
}

export async function generateCodexResumeFromHandoff(options: GenerateHandoffOptions): Promise<HandoffResult> {
  const context = await resolveHandoffContext(options);
  const handoff = options.fromHandoff
    ? await showSavedHandoff(context.cwd, options.fromHandoff)
    : (await generateHandoff({
        ...options,
        cwd: context.cwd,
        save: false,
        adapter: "codex"
      })).content;
  const workerIntelligence = context.worker
    ? (await generateWorkerIntelligence({
        cwd: context.cwd,
        name: context.worker,
        budget: 800
      })).content
    : "No worker selected.";
  const content = [
    "# BriefOps Codex Resume Mission",
    "",
    "## Mission",
    "",
    `Continue work as ${context.worker ?? "the selected BriefOps worker"}.`,
    "",
    "## Continuity Contract",
    "",
    "You are starting in a new thread. Do not assume the user will repeat prior context.",
    "",
    "Before acting:",
    "1. Read the handoff.",
    "2. Restate what is already known.",
    "3. Identify unresolved risks.",
    "4. Execute only the current task.",
    "5. Verify before claiming completion.",
    "",
    "## Current Task",
    "",
    context.task ?? "Continue prior BriefOps work.",
    "",
    "## Handoff",
    "",
    handoff.trim(),
    "",
    "## Worker Intelligence",
    "",
    workerIntelligence.trim(),
    "",
    "## Evidence Gates",
    "",
    "- Context gate: name the project files, docs, memory items, or logs used.",
    "- Continuity gate: state which previous result or lesson you are continuing from.",
    "- Change gate: summarize smallest useful change set.",
    "- Verification gate: include commands or manual checks.",
    "- Risk gate: call out unresolved or deferred risks.",
    options.completionPromise ? `- Completion promise: ${options.completionPromise}` : undefined,
    "",
    "## Completion Signal",
    "",
    "Only after all gates pass, end with:",
    "",
    "```text",
    "<briefops-complete>DONE</briefops-complete>",
    "```",
    ""
  ].filter((line): line is string => line !== undefined).join("\n");
  const tokens = estimateTokens(content);
  const warnings = tokens > context.budget
    ? [`Rendered Codex resume exceeds token budget by ${tokens - context.budget} estimated tokens.`]
    : [];
  const id = `resume_${formatDateStamp()}`;
  const savedPath = options.save
    ? await writeResumePrompt({
        cwd: context.cwd,
        id,
        worker: context.worker,
        content,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    id,
    content,
    tokens,
    budget: context.budget,
    warnings,
    report: [],
    savedPath
  };
}

async function writeResumePrompt(options: {
  cwd: string;
  id: string;
  worker?: string;
  content: string;
  outputPath?: string;
}): Promise<string> {
  const targetPath =
    options.outputPath ??
    path.join(
      workspacePaths(options.cwd).codexPrompts,
      `${options.id}-resume-${slugForFilename(options.worker ?? "worker")}.md`
    );
  await writeTextFile(targetPath, options.content, { force: true });
  return targetPath;
}
