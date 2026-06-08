import path from "node:path";
import { BriefOpsError } from "./errors.js";
import {
  filterMemoryForExport,
  normalizeExportPolicy,
  sharedOnlyOmissionNote,
  type ExportPolicy
} from "./exportPolicy.js";
import { listWorkLogs } from "./log.js";
import { withWorkspaceLock } from "./lock.js";
import { formatMemoryItem, selectContinuityContext, taskKeywords } from "./memory.js";
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
import type { WorkLog } from "../schemas/log.js";

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
  fromHandoff?: string;
  mode?: string;
  completionPromise?: string;
  exportPolicy?: ExportPolicy;
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

async function renderWorkerForExport(options: {
  cwd: string;
  worker?: string;
  budget: number;
  exportPolicy: ExportPolicy;
}): Promise<string> {
  if (!options.worker) {
    return "No worker selected.";
  }

  if (options.exportPolicy === "shared-only") {
    const worker = await readWorker(options.cwd, options.worker);
    return [
      `# Worker Intelligence: ${worker.name}`,
      "",
      sharedOnlyOmissionNote,
      "",
      "## Identity",
      "",
      worker.description || "No worker description recorded.",
      "",
      "## Project",
      "",
      worker.project ?? "No default project recorded.",
      "",
      "## Default Operating Style",
      "",
      worker.style.length > 0 ? worker.style.map((style) => `- ${style}`).join("\n") : "- Verify before completion.",
      "",
      "## Skill Bundle",
      "",
      worker.default_skills.length > 0
        ? worker.default_skills.map((skill) => `- ${skill}`).join("\n")
        : "- No default skills recorded.",
      ""
    ].join("\n");
  }

  return (await generateWorkerIntelligence({
    cwd: options.cwd,
    name: options.worker,
    budget: options.budget
  })).content;
}

function formatLogItem(log: WorkLog): string {
  const details = [
    log.result,
    ...log.open_risks.map((risk) => `open risk: ${risk}`),
    ...log.decisions.map((decision) => `decision: ${decision}`),
    ...log.incidents.map((incident) => `incident: ${incident}`),
    ...log.next_steps.map((step) => `next: ${step}`)
  ].join("; ");
  return `- ${log.created_at.slice(0, 10)}: ${log.task}; ${details}`;
}

function scoreLogItem(log: WorkLog, task?: string): number {
  const taskWords = taskKeywords(task);
  const logWords = taskKeywords([
    log.task,
    log.result,
    ...log.lessons,
    ...log.open_risks,
    ...log.next_steps,
    ...log.decisions,
    ...log.incidents
  ].join(" "));
  const overlap = [...taskWords].filter((word) => logWords.has(word)).length;
  const age = Date.parse(log.created_at);
  const fresh = Number.isNaN(age) ? 0 : Math.max(0, 10 - Math.floor((Date.now() - age) / 86_400_000));

  return (
    overlap * 8 +
    fresh +
    log.open_risks.length * 12 +
    log.decisions.length * 10 +
    log.incidents.length * 8 +
    log.next_steps.length * 4
  );
}

function selectLogItems(options: {
  logs: WorkLog[];
  task?: string;
  maxTokens: number;
  quota: number;
}): string {
  const ordered = options.logs
    .map((log) => ({
      log,
      score: scoreLogItem(log, options.task)
    }))
    .sort((a, b) => b.score - a.score || b.log.created_at.localeCompare(a.log.created_at))
    .slice(0, options.quota);
  const selected: string[] = [];
  let tokens = 0;

  for (const item of ordered) {
    const text = formatLogItem(item.log);
    const itemTokens = estimateTokens(text);
    if (selected.length > 0 && tokens + itemTokens > options.maxTokens) {
      continue;
    }
    selected.push(text);
    tokens += itemTokens;
  }

  return selected.length > 0 ? selected.join("\n") : "No recent work logs found.";
}

async function resolveHandoffContext(options: GenerateHandoffOptions): Promise<{
  cwd: string;
  project?: string;
  worker?: string;
  skills: string[];
  task?: string;
  budget: number;
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
    budget: options.budget ?? defaultPolicy.max_total_tokens
  };
}

function trimSection(text: string, minTokens: number): { text: string; trimmed: boolean } {
  const used = estimateTokens(text);
  if (used <= minTokens) {
    return { text, trimmed: false };
  }

  const target = Math.max(minTokens, Math.floor(used * 0.65));
  const trimmed = truncateToTokenBudget(text, target).text;
  return {
    text: trimmed,
    trimmed: trimmed !== text
  };
}

function trimMarkdownSection(markdown: string, heading: string, minTokens: number): {
  text: string;
  trimmed: boolean;
} {
  const marker = `## ${heading}`;
  const start = markdown.indexOf(marker);
  if (start === -1) {
    return { text: markdown, trimmed: false };
  }

  const bodyStart = start + marker.length;
  const nextHeading = markdown.indexOf("\n## ", bodyStart);
  const end = nextHeading === -1 ? markdown.length : nextHeading;
  const body = markdown.slice(bodyStart, end);
  const trimmed = trimSection(body.trim(), minTokens);
  if (!trimmed.trimmed) {
    return { text: markdown, trimmed: false };
  }

  return {
    text: `${markdown.slice(0, bodyStart)}\n\n${trimmed.text}\n${markdown.slice(end)}`,
    trimmed: true
  };
}

export async function generateHandoff(options: GenerateHandoffOptions): Promise<HandoffResult> {
  const context = await resolveHandoffContext(options);
  const exportPolicy = normalizeExportPolicy(options.exportPolicy);
  const id = `handoff_${formatDateStamp()}`;
  let projectText = context.project
    ? truncateToTokenBudget((await readProject(context.cwd, context.project)).body, defaultPolicy.project).text
    : "No project selected.";
  const workerSummary = await renderWorkerForExport({
    cwd: context.cwd,
    worker: context.worker,
    budget: defaultPolicy.worker,
    exportPolicy
  });
  let workerText = truncateToTokenBudget(workerSummary, defaultPolicy.worker).text;
  const logs = exportPolicy === "shared-only" ? [] : await listWorkLogs({
    cwd: context.cwd,
    project: context.project,
    worker: context.worker,
    limit: 12
  });
  let logsText = exportPolicy === "shared-only"
    ? sharedOnlyOmissionNote
    : selectLogItems({
        logs,
        task: context.task,
        maxTokens: defaultPolicy.recent_logs,
        quota: 5
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
  const memoryItems = filterMemoryForExport(memory.items, exportPolicy);
  const byType = (type: string) =>
    memoryItems.filter((item) => item.type === type).map(formatMemoryItem);
  const taskText = truncateToTokenBudget(context.task ?? "No next task provided.", defaultPolicy.task).text;
  const openRisks = logs.flatMap((log) => log.open_risks);
  const nextSteps = logs.flatMap((log) => log.next_steps);
  let decisionsText = formatMemory(byType("decision"));
  let lessonsText = formatMemory(byType("lesson"));
  let incidentsText = formatMemory(byType("incident"));
  const openRisksText = exportPolicy === "shared-only"
    ? sharedOnlyOmissionNote
    : openRisks.length > 0
      ? openRisks.map((risk) => `- ${risk}`).join("\n")
      : "No unresolved open risks found.";
  const nextActionsText = exportPolicy === "shared-only"
    ? sharedOnlyOmissionNote
    : nextSteps.length > 0
      ? nextSteps.map((step) => `- ${step}`).join("\n")
      : `- ${taskText}`;
  const readIfNeededText = context.project
    ? `Project file: .briefops/projects/${context.project}.project.md`
    : "No project references listed.";

  const render = (warnings: string[] = []) => {
    const sections = [
      ["Project", projectText, defaultPolicy.project] as const,
      ["Worker", workerText, defaultPolicy.worker] as const,
      ["Recent Work", logsText, defaultPolicy.recent_logs] as const,
      ["Active Decisions", decisionsText, defaultPolicy.decisions] as const,
      ["Active Lessons", lessonsText, defaultPolicy.lessons] as const,
      ["Recent Incidents / Risks", incidentsText, defaultPolicy.incidents] as const,
      ["Open Risks", openRisksText, defaultPolicy.open_risks] as const,
      ["Current Task", taskText, defaultPolicy.task] as const
    ];
    const report = sections.map(([label, text, budget]) => sectionReport(label, text, budget));
    const warningText = warnings.length > 0 ? `> ${warnings.join("\n> ")}\n\n` : "";
    const body = [
      "# BriefOps Continuity Handoff",
      "",
      `${warningText}## Purpose`,
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
      decisionsText,
      "",
      "## Active Lessons",
      "",
      lessonsText,
      "",
      "## Recent Incidents / Risks",
      "",
      incidentsText,
      "",
      "## Open Risks",
      "",
      openRisksText,
      "",
      "## Suggested Next Actions",
      "",
      nextActionsText,
      "",
      "## Read If Needed",
      "",
      readIfNeededText,
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
    content = content.replace(/- Total: \d+ \/ \d+/, `- Total: ${tokens} / ${context.budget}`);
    tokens = estimateTokens(content);
    return { content, tokens, report };
  };

  const bodyBudget = Math.max(200, context.budget - 100);
  let rendered = render();
  const trimTargets = [
    () => {
      const trimmed = trimSection(lessonsText, 30);
      lessonsText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(incidentsText, 30);
      incidentsText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(logsText, 35);
      logsText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(workerText, 45);
      workerText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(projectText, 45);
      projectText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(decisionsText, 30);
      decisionsText = trimmed.text;
      return trimmed.trimmed;
    }
  ];
  while (rendered.tokens > bodyBudget) {
    const trimmed = trimTargets.some((trim) => trim());
    if (!trimmed) {
      break;
    }
    rendered = render();
  }
  const warnings = rendered.tokens > bodyBudget
    ? [`Rendered handoff exceeds token budget by ${rendered.tokens - bodyBudget} estimated tokens after trimming continuity context.`]
    : [];
  if (warnings.length > 0) {
    rendered = render(warnings);
  }
  const metadata: HandoffMetadata = {
    id,
    created_at: new Date().toISOString(),
    project: context.project,
    worker: context.worker,
    task: context.task,
    adapter: "generic",
    budget: context.budget,
    total_tokens: rendered.tokens,
    warnings
  };
  const content = stringifyMarkdownWithFrontmatter(metadata, rendered.content);
  const savedPath = options.save
    ? await saveGeneratedHandoff({
        cwd: context.cwd,
        id,
        project: context.project,
        worker: context.worker,
        content,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    id,
    content,
    tokens: estimateTokens(content),
    budget: context.budget,
    warnings,
    report: rendered.report,
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
  return withWorkspaceLock({ cwd: options.cwd, name: "handoff" }, async () => {
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
  });
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
  const exportPolicy = normalizeExportPolicy(options.exportPolicy);
  const handoff = options.fromHandoff && exportPolicy !== "shared-only"
    ? await showSavedHandoff(context.cwd, options.fromHandoff)
    : (await generateHandoff({
        ...options,
        cwd: context.cwd,
        exportPolicy,
        save: false
      })).content;
  let workerIntelligence = await renderWorkerForExport({
    cwd: context.cwd,
    worker: context.worker,
    budget: 800,
    exportPolicy
  });
  let handoffText = handoff.trim();
  const renderResume = (warnings: string[] = []) => {
    const warningText = warnings.length > 0 ? `> ${warnings.join("\n> ")}\n\n` : "";
    const content = [
      "# BriefOps Codex Resume Mission",
      "",
      "## Mission",
      "",
      `Continue work as ${context.worker ?? "the selected BriefOps worker"}.`,
      "",
      `${warningText}## Continuity Contract`,
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
      handoffText,
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
    return {
      content,
      tokens: estimateTokens(content)
    };
  };
  let resume = renderResume();
  const trimResumeTargets = [
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Active Lessons", 30);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Recent Incidents / Risks", 30);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Recent Work", 35);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimSection(workerIntelligence, 80);
      workerIntelligence = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Worker", 45);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Project", 45);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    },
    () => {
      const trimmed = trimMarkdownSection(handoffText, "Active Decisions", 30);
      handoffText = trimmed.text;
      return trimmed.trimmed;
    }
  ];
  while (resume.tokens > context.budget) {
    const trimmed = trimResumeTargets.some((trim) => trim());
    if (!trimmed) {
      break;
    }
    resume = renderResume();
  }
  const warnings = resume.tokens > context.budget
    ? [`Rendered Codex resume exceeds token budget by ${resume.tokens - context.budget} estimated tokens after trimming continuity context.`]
    : [];
  if (warnings.length > 0) {
    resume = renderResume(warnings);
  }
  const id = `resume_${formatDateStamp()}`;
  const savedPath = options.save
    ? await writeResumePrompt({
        cwd: context.cwd,
        id,
        worker: context.worker,
        content: resume.content,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    id,
    content: resume.content,
    tokens: resume.tokens,
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
