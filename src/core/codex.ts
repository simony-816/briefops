import path from "node:path";
import { generateBrief } from "./brief.js";
import { generateCodexResumeFromHandoff } from "./handoff.js";
import { BriefOpsError } from "./errors.js";
import { readProject } from "./project.js";
import { readWorker } from "./worker.js";
import { formatDateStamp, normalizeName, slugForFilename, workspacePaths } from "./paths.js";
import { ensureDirectory, pathExists, readTextFile, writeTextFile } from "./storage.js";
import { estimateTokens } from "./tokens.js";
import { requireWorkspace } from "./workspace.js";

const AGENTS_BEGIN = "<!-- BRIEFOPS_CODEX_BEGIN -->";
const AGENTS_END = "<!-- BRIEFOPS_CODEX_END -->";

export type CodexInstallOptions = {
  cwd?: string;
  force?: boolean;
};

export type CodexMissionOptions = {
  cwd?: string;
  skill?: string;
  project?: string;
  worker?: string;
  task: string;
  budget?: number;
  completionPromise?: string;
  mode?: string;
  save?: boolean;
  outputPath?: string;
};

export type CodexPlanOptions = {
  cwd?: string;
  project?: string;
  worker?: string;
  idea: string;
  save?: boolean;
  outputPath?: string;
};

export type CodexResumeOptions = {
  cwd?: string;
  worker?: string;
  project?: string;
  task: string;
  fromHandoff?: string;
  budget?: number;
  mode?: string;
  completionPromise?: string;
  exportPolicy?: "local-private" | "shared-only";
  save?: boolean;
  outputPath?: string;
};

export type CodexPromptResult = {
  content: string;
  tokens: number;
  savedPath?: string;
};

function normalizeCodexMode(value?: string): "loop" | "execute" | "plan" {
  const mode = (value ?? "loop").trim().toLowerCase();
  if (mode === "loop" || mode === "execute" || mode === "plan") {
    return mode;
  }

  throw new BriefOpsError(`Invalid Codex mode: ${value}`);
}

function codexGuidanceSection(): string {
  return [
    AGENTS_BEGIN,
    "## BriefOps Codex Guidance",
    "",
    "This repository can use BriefOps to prepare token-aware Codex task briefs.",
    "",
    "Useful commands:",
    "",
    "```bash",
    "briefops brief generate --worker <worker> --task \"<task>\" --adapter codex",
    "briefops codex mission --worker <worker> --task \"<task>\" --save",
    "briefops codex plan --project <project> --idea \"<what to build>\" --save",
    "briefops log add --task \"<task>\" --result \"<result>\" --lesson \"<lesson>\"",
    "briefops skill propose-patch --skill <skill> --from-log latest",
    "```",
    "",
    "When using a BriefOps mission, follow its evidence gates before claiming completion.",
    AGENTS_END,
    ""
  ].join("\n");
}

async function upsertAgentsGuidance(cwd: string, force = false): Promise<string> {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const section = codexGuidanceSection();
  if (!(await pathExists(agentsPath))) {
    await writeTextFile(agentsPath, `# AGENTS.md\n\n${section}`);
    return agentsPath;
  }

  const existing = await readTextFile(agentsPath);
  const start = existing.indexOf(AGENTS_BEGIN);
  const end = existing.indexOf(AGENTS_END);
  if (start !== -1 && end !== -1 && end > start) {
    const updated = `${existing.slice(0, start)}${section}${existing.slice(end + AGENTS_END.length).trimStart()}`;
    await writeTextFile(agentsPath, updated, { force: true });
    return agentsPath;
  }

  if (!force) {
    throw new BriefOpsError(
      "AGENTS.md already exists. Re-run with --force to append BriefOps Codex guidance."
    );
  }

  await writeTextFile(agentsPath, `${existing.trimEnd()}\n\n${section}`, { force: true });
  return agentsPath;
}

export async function installCodexPack(options: CodexInstallOptions = {}): Promise<{
  agentsPath: string;
  promptDir: string;
}> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const paths = workspacePaths(cwd);

  await ensureDirectory(paths.codexPrompts);
  await writeTextFile(
    path.join(paths.codexPrompts, "mission.md"),
    [
      "# BriefOps Codex Mission Prompt",
      "",
      "Generate a Codex mission with:",
      "",
      "```bash",
      "briefops codex mission --worker <worker> --task \"<task>\" --save",
      "```",
      ""
    ].join("\n"),
    { force: true }
  );
  await writeTextFile(
    path.join(paths.codexPrompts, "plan.md"),
    [
      "# BriefOps Codex Plan Prompt",
      "",
      "Generate a Codex planning prompt with:",
      "",
      "```bash",
      "briefops codex plan --project <project> --idea \"<what to build>\" --save",
      "```",
      ""
    ].join("\n"),
    { force: true }
  );

  return {
    agentsPath: await upsertAgentsGuidance(cwd, options.force),
    promptDir: paths.codexPrompts
  };
}

function renderMissionShell(options: {
  mode: "loop" | "execute" | "plan";
  task: string;
  completionPromise: string;
  brief: string;
}): string {
  const modeLine =
    options.mode === "loop"
      ? "Work in a bounded loop: inspect, plan, act, verify, and continue if verification fails."
      : options.mode === "execute"
        ? "Execute the task directly, keeping a concise plan and verification evidence attached."
        : "Produce a plan first. Do not modify product code unless the user explicitly approves the plan.";

  return [
    "# BriefOps Codex Mission",
    "",
    "## Mission",
    "",
    options.task,
    "",
    "## Completion Promise",
    "",
    options.completionPromise,
    "",
    "Only claim completion after the evidence gates below are satisfied.",
    "",
    "## Codex Operating Contract",
    "",
    modeLine,
    "",
    "1. Restate the objective in one short paragraph.",
    "2. Inspect the relevant files before editing.",
    "3. Keep changes scoped to the mission.",
    "4. Run the strongest available verification for the changed surface.",
    "5. If verification fails, diagnose and continue instead of ending with a hopeful status.",
    "6. Finish with evidence: files changed, commands run, results, and remaining risk.",
    "",
    "## Evidence Gates",
    "",
    "- Context gate: name the files or docs inspected.",
    "- Change gate: summarize the smallest useful change set.",
    "- Verification gate: include command output or manual QA evidence.",
    "- Risk gate: call out anything unverified or intentionally deferred.",
    "",
    "## Completion Signal",
    "",
    "When all gates pass, end with:",
    "",
    "```text",
    "<briefops-complete>DONE</briefops-complete>",
    "```",
    "",
    "## BriefOps Brief",
    "",
    options.brief.trim(),
    ""
  ].join("\n");
}

async function saveCodexPrompt(options: {
  cwd: string;
  kind: string;
  name: string;
  content: string;
  outputPath?: string;
}): Promise<string> {
  const targetPath =
    options.outputPath ??
    path.join(
      workspacePaths(options.cwd).codexPrompts,
      `${formatDateStamp()}-${options.kind}-${slugForFilename(options.name)}.md`
    );
  await writeTextFile(targetPath, options.content, { force: true });
  return targetPath;
}

export async function generateCodexMission(
  options: CodexMissionOptions
): Promise<CodexPromptResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const mode = normalizeCodexMode(options.mode);
  const generated = await generateBrief({
    cwd,
    skill: options.skill,
    project: options.project,
    worker: options.worker,
    task: options.task,
    budget: options.budget ?? 2500,
    adapter: "codex"
  });
  const content = renderMissionShell({
    mode,
    task: options.task.trim(),
    completionPromise:
      options.completionPromise ??
      "Deliver the requested change with verification evidence and no unresolved blocking risk.",
    brief: generated.content
  });
  const savedPath = options.save
    ? await saveCodexPrompt({
        cwd,
        kind: "mission",
        name: options.worker ?? options.skill ?? "codex",
        content,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    content,
    tokens: estimateTokens(content),
    savedPath
  };
}

export async function generateCodexPlan(options: CodexPlanOptions): Promise<CodexPromptResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const projectName = options.project ? normalizeName(options.project) : undefined;
  const workerName = options.worker ? normalizeName(options.worker) : undefined;
  const project = projectName ? await readProject(cwd, projectName) : undefined;
  const worker = workerName ? await readWorker(cwd, workerName) : undefined;
  const content = [
    "# BriefOps Codex Plan Prompt",
    "",
    "## Planning Mission",
    "",
    options.idea.trim(),
    "",
    "## Codex Planning Contract",
    "",
    "You are planning only. Do not edit product code in this response.",
    "",
    "Produce a decision-complete plan that another Codex run can execute without re-asking foundational questions.",
    "",
    "Return:",
    "",
    "1. Objective",
    "2. Assumptions and open questions",
    "3. Codebase areas to inspect",
    "4. Implementation checklist",
    "5. Verification checklist",
    "6. Risks and rollback notes",
    "",
    worker
      ? [
          "## Worker Profile",
          "",
          `Name: ${worker.name}`,
          worker.description ? `Description: ${worker.description}` : undefined,
          worker.default_skills.length > 0
            ? `Default skills: ${worker.default_skills.join(", ")}`
            : undefined,
          worker.style.length > 0 ? `Style: ${worker.style.join("; ")}` : undefined,
          ""
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n")
      : "",
    project
      ? [
          "## Project Context",
          "",
          project.body,
          ""
        ].join("\n")
      : "## Project Context\n\nNo project context selected.\n",
    "## Completion Signal",
    "",
    "End with a concise `PLAN READY` line and the recommended BriefOps command for execution.",
    ""
  ].join("\n");
  const savedPath = options.save
    ? await saveCodexPrompt({
        cwd,
        kind: "plan",
        name: workerName ?? projectName ?? "codex",
        content,
        outputPath: options.outputPath
      })
    : undefined;

  return {
    content,
    tokens: estimateTokens(content),
    savedPath
  };
}

export async function generateCodexResume(options: CodexResumeOptions): Promise<CodexPromptResult> {
  const result = await generateCodexResumeFromHandoff({
    cwd: options.cwd,
    worker: options.worker,
    project: options.project,
    task: options.task,
    fromHandoff: options.fromHandoff,
    budget: options.budget ?? 3000,
    mode: options.mode,
    completionPromise: options.completionPromise,
    exportPolicy: options.exportPolicy,
    save: options.save,
    outputPath: options.outputPath
  });

  return {
    content: result.content,
    tokens: result.tokens,
    savedPath: result.savedPath
  };
}
