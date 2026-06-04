import path from "node:path";
import { normalizeBriefAdapter, type BriefAdapter } from "./adapter.js";
import { generateBrief } from "./brief.js";
import { BriefOpsError } from "./errors.js";
import { listWorkLogs } from "./log.js";
import { formatMemoryItem, selectRelevantMemory } from "./memory.js";
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
import { readWorker, readWorkerSummary, refreshWorkerSummary } from "./worker.js";
import { requireWorkspace } from "./workspace.js";
import { handoffSchema, type HandoffMetadata } from "../schemas/handoff.js";
import type { TokenReportLine } from "../schemas/brief.js";

const defaultPolicy = {
  max_total_tokens: 3000,
  project: 500,
  worker: 400,
  recent_logs: 500,
  decisions: 450,
  lessons: 450,
  incidents: 350,
  deprecated: 150,
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

function formatLogs(logs: Awaited<ReturnType<typeof listWorkLogs>>): string {
  if (logs.length === 0) {
    return "No recent work logs found.";
  }

  return logs
    .map((log) => {
      const scope = [log.project, log.skill, log.worker].filter(Boolean).join("/");
      return `- ${log.created_at.slice(0, 10)}${scope ? ` (${scope})` : ""}: ${log.task}; ${log.result}`;
    })
    .join("\n");
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
    ? ((await readWorkerSummary(context.cwd, context.worker)) ??
      (await refreshWorkerSummary({ cwd: context.cwd, name: context.worker, limit: 20 })).content)
    : "No worker selected.";
  const workerText = truncateToTokenBudget(workerSummary, defaultPolicy.worker).text;
  const logs = await listWorkLogs({
    cwd: context.cwd,
    project: context.project,
    worker: context.worker,
    limit: 8
  });
  const logsText = truncateToTokenBudget(formatLogs(logs), defaultPolicy.recent_logs).text;
  const skill = context.skills[0];
  const memory = await selectRelevantMemory({
    cwd: context.cwd,
    project: context.project,
    skill,
    worker: context.worker,
    task: context.task,
    includeDeprecated: true,
    maxTokens:
      defaultPolicy.decisions +
      defaultPolicy.lessons +
      defaultPolicy.incidents +
      defaultPolicy.deprecated,
    quotas: {
      decisions: 5,
      lessons: 5,
      incidents: 3,
      facts: 4,
      deprecated: 2
    }
  });
  const byType = (type: string) =>
    memory.items.filter((item) => item.type === type).map(formatMemoryItem);
  const taskText = truncateToTokenBudget(context.task ?? "No next task provided.", defaultPolicy.task).text;
  const warnings = [
    memory.omitted > 0 ? `${memory.omitted} memory item(s) were omitted by handoff budget or quotas.` : undefined
  ].filter((warning): warning is string => Boolean(warning));
  const sections = [
    ["Project", projectText, defaultPolicy.project] as const,
    ["Worker", workerText, defaultPolicy.worker] as const,
    ["Recent Work History", logsText, defaultPolicy.recent_logs] as const,
    ["Active Decisions", formatMemory(byType("decision")), defaultPolicy.decisions] as const,
    ["Active Lessons", formatMemory(byType("lesson")), defaultPolicy.lessons] as const,
    ["Known Incidents / Failure Patterns", formatMemory(byType("incident")), defaultPolicy.incidents] as const,
    ["Deprecated / Avoid", formatMemory(byType("deprecated")), defaultPolicy.deprecated] as const,
    ["Current Task", taskText, defaultPolicy.task] as const
  ];
  const report = sections.map(([label, text, budget]) => sectionReport(label, text, budget));
  const body = [
    "# BriefOps Handoff Brief",
    "",
    "## Purpose",
    "",
    "This handoff prepares a fresh AI coding thread to continue work without restarting from zero.",
    "",
    ...sections.flatMap(([label, text]) => [`## ${label}`, "", text, ""]),
    "## Recommended Start",
    "",
    "1. Inspect listed source files.",
    "2. Validate assumptions against current repo state.",
    "3. Keep changes scoped.",
    "4. Apply worker-specific checks.",
    "5. End with log-ready summary.",
    "",
    "## After Completion",
    "",
    "```bash",
    `briefops log add --project ${context.project ?? "<project>"} --worker ${context.worker ?? "<worker>"} --task "<task>" --result "<result>" --lesson "<lesson>"`,
    "briefops memory propose-from-log latest",
    skill ? `briefops skill propose-patch --skill ${skill} --from-log latest` : "briefops skill propose-patch --skill <skill> --from-log latest",
    context.worker ? `briefops worker refresh-summary ${context.worker}` : "briefops worker refresh-summary <worker>",
    "```",
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
  const handoff = await generateHandoff({
    ...options,
    cwd: context.cwd,
    save: false,
    adapter: "codex"
  });
  const taskBrief =
    context.project && context.skills[0]
      ? (
          await generateBrief({
            cwd: context.cwd,
            project: context.project,
            skill: context.skills[0],
            worker: context.worker,
            task: context.task ?? "Continue prior work.",
            budget: Math.max(800, Math.floor(context.budget * 0.35)),
            adapter: "codex"
          })
        ).content
      : "Task brief unavailable because project/skill context is incomplete.";
  const content = [
    "# BriefOps Codex Resume Mission",
    "",
    "## Mission",
    "",
    context.task ?? "Continue prior BriefOps work.",
    "",
    "## Why This Is a Resume",
    "",
    "This prompt prepares a fresh Codex thread to continue from prior BriefOps work history.",
    "",
    "## Continuity Contract",
    "",
    "1. Read the handoff before making changes.",
    "2. Treat active decisions as constraints.",
    "3. Apply worker judgment rules.",
    "4. Avoid repeating known failure patterns.",
    "5. If repository state contradicts memory, report the conflict before acting.",
    "",
    "## Evidence Gates",
    "",
    "- Context gate: list files/docs inspected.",
    "- Continuity gate: mention which prior decision/lesson influenced the work.",
    "- Change gate: summarize smallest useful change set.",
    "- Verification gate: include commands or manual checks.",
    "- Memory gate: state what should be logged or promoted after completion.",
    "",
    "## Handoff Brief",
    "",
    handoff.content.trim(),
    "",
    "## Task Brief",
    "",
    taskBrief.trim(),
    "",
    "## Completion Signal",
    "",
    "```text",
    "<briefops-complete>DONE</briefops-complete>",
    "```",
    "",
    "## After Completion",
    "",
    "Prepare these commands with filled values:",
    "",
    "```bash",
    "briefops log add ...",
    "briefops memory propose-from-log latest",
    "briefops skill propose-patch --skill <skill> --from-log latest",
    "briefops worker refresh-summary <worker>",
    "```",
    ""
  ].join("\n");
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
      `${options.id}-codex-resume-${slugForFilename(options.worker ?? "worker")}.md`
    );
  await writeTextFile(targetPath, options.content, { force: true });
  return targetPath;
}
