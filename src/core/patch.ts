import { randomBytes } from "node:crypto";
import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { withWorkspaceLock } from "./lock.js";
import { readWorkLog } from "./log.js";
import {
  normalizeName,
  skillFilePath,
  skillPatchFilePath,
  workspacePaths
} from "./paths.js";
import { readSkill } from "./skill.js";
import {
  listFilesBySuffix,
  readTextFile,
  stringifyMarkdownWithFrontmatter,
  writeTextFile,
  writeYamlFile
} from "./storage.js";
import { requireWorkspace } from "./workspace.js";
import { skillPatchSchema, type SkillPatch } from "../schemas/patch.js";
import YAML from "yaml";

export type ProposeSkillPatchOptions = {
  cwd?: string;
  skill: string;
  fromLog?: string;
};

export const NO_SKILL_PATCH_CANDIDATES_PREFIX = "No skill patch candidates found in log:";

export function isNoSkillPatchCandidatesError(error: unknown): boolean {
  return error instanceof BriefOpsError &&
    error.message.startsWith(NO_SKILL_PATCH_CANDIDATES_PREFIX);
}

function patchId(date = new Date()): string {
  return `patch_${date.toISOString().replace(/[-:.TZ]/g, "").slice(0, 17)}_${randomBytes(3).toString(
    "hex"
  )}`;
}

function bumpPatchVersion(version: string): string {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(.*)$/);
  if (!match) {
    return `${version}.1`;
  }

  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}${match[4] ?? ""}`;
}

function normalizeAddition(lesson: string): string {
  const content = lesson.trim().replace(/^\-\s+/, "");
  return `- ${content}`;
}

function insertAdditionsIntoSection(body: string, section: string, additions: string[]): string {
  const lines = body.split(/\r?\n/);
  const headingPattern = new RegExp(`^##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  const missing = additions.filter((addition) => {
    const content = addition.replace(/^\-\s+/, "");
    return !body.includes(addition) && !body.includes(content);
  });

  if (missing.length === 0) {
    return body;
  }

  if (start === -1) {
    return [body.trimEnd(), "", `## ${section}`, "", ...missing].join("\n");
  }

  const endOffset = lines.slice(start + 1).findIndex((line) => /^##\s+/.test(line.trim()));
  const end = endOffset === -1 ? lines.length : start + 1 + endOffset;
  const before = lines.slice(0, end);
  const after = lines.slice(end);
  const needsBlank = before[before.length - 1]?.trim() !== "";
  const needsTrailingBlank = after.length > 0 && after[0]?.trim() !== "";

  return [
    ...before,
    ...(needsBlank ? [""] : []),
    ...missing,
    ...(needsTrailingBlank ? [""] : []),
    ...after
  ].join("\n").trim();
}

function appendChangelog(body: string, patch: SkillPatch): string {
  const entry = `- ${new Date().toISOString()}: applied ${patch.id} from ${patch.from_log}`;
  if (/^##\s+Changelog\s*$/im.test(body)) {
    return insertAdditionsIntoSection(body, "Changelog", [entry]);
  }

  return [body.trimEnd(), "", "## Changelog", "", entry].join("\n");
}

async function writeSkillPatch(cwd: string, patch: SkillPatch): Promise<string> {
  const filePath = skillPatchFilePath(cwd, patch.id);
  await writeYamlFile(filePath, patch);
  return filePath;
}

export function renderSkillPatchDiff(patch: SkillPatch): string {
  return [
    `Suggested patch for ${patch.skill}.skill.md`,
    "",
    `## ${patch.target_section}`,
    "",
    ...patch.additions.map((addition) => `+ ${addition}`),
    ""
  ].join("\n");
}

export async function proposeSkillPatch(
  options: ProposeSkillPatchOptions
): Promise<{ path: string; patch: SkillPatch; diff: string }> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const skill = normalizeName(options.skill);
  await readSkill(cwd, skill);
  const log = await readWorkLog(cwd, options.fromLog ?? "latest");
  const lessons = log.lessons.map((lesson) => lesson.trim()).filter(Boolean);

  if (log.skill && log.skill !== skill) {
    throw new BriefOpsError(`Work log ${log.id} is linked to skill ${log.skill}, not ${skill}.`);
  }

  if (lessons.length === 0) {
    throw new BriefOpsError(`${NO_SKILL_PATCH_CANDIDATES_PREFIX} ${log.id}`);
  }

  const createdAt = new Date();
  const patch = skillPatchSchema.parse({
    id: patchId(createdAt),
    created_at: createdAt.toISOString(),
    skill,
    from_log: log.id,
    status: "proposed",
    target_section: "Check",
    lessons,
    additions: lessons.map(normalizeAddition)
  });
  const filePath = await writeSkillPatch(cwd, patch);

  return {
    path: filePath,
    patch,
    diff: renderSkillPatchDiff(patch)
  };
}

export async function readSkillPatch(cwd: string, id: string): Promise<SkillPatch> {
  await requireWorkspace(cwd);
  const normalized = id.trim().toLowerCase();

  try {
    const files = await listFilesBySuffix(workspacePaths(cwd).patches, ".patch.yaml");
    const filePath =
      normalized === "latest"
        ? [...files].sort().at(-1)
        : files.find((file) => path.basename(file).startsWith(normalizeName(id)));
    if (!filePath) {
      throw new BriefOpsError(`Skill patch not found: ${id}`);
    }
    const raw = await readTextFile(filePath);
    const parsed = YAML.parse(raw);
    const result = skillPatchSchema.safeParse(parsed);
    if (!result.success) {
      throw new BriefOpsError(`Invalid skill patch ${filePath}: ${result.error.message}`);
    }
    return result.data;
  } catch (error) {
    if (error instanceof BriefOpsError && error.message.startsWith("File not found")) {
      throw new BriefOpsError(`Skill patch not found: ${id}`);
    }

    throw error;
  }
}

export async function readLatestProposedSkillPatch(cwd = process.cwd()): Promise<SkillPatch> {
  const patches = (await listSkillPatches(cwd)).filter((patch) => patch.status === "proposed");
  const latest = patches[0];
  if (!latest) {
    throw new BriefOpsError("No proposed skill patches found.");
  }
  return latest;
}

export async function listSkillPatches(cwd = process.cwd()): Promise<SkillPatch[]> {
  await requireWorkspace(cwd);
  const files = await listFilesBySuffix(workspacePaths(cwd).patches, ".patch.yaml");
  const patches = await Promise.all(
    files.map(async (filePath) => {
      const raw = await readTextFile(filePath);
      const parsed = YAML.parse(raw);
      const result = skillPatchSchema.safeParse(parsed);
      if (!result.success) {
        throw new BriefOpsError(`Invalid skill patch ${filePath}: ${result.error.message}`);
      }
      return result.data;
    })
  );

  return patches.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function applySkillPatch(options: {
  cwd?: string;
  skill: string;
  patch: string;
}): Promise<{ patch: SkillPatch; skillPath: string }> {
  const cwd = options.cwd ?? process.cwd();
  return withWorkspaceLock({ cwd, name: "skill-patch" }, async () =>
    applySkillPatchUnlocked({
      ...options,
      cwd
    })
  );
}

export async function applySkillPatchUnlocked(options: {
  cwd?: string;
  skill: string;
  patch: string;
}): Promise<{ patch: SkillPatch; skillPath: string }> {
  const cwd = options.cwd ?? process.cwd();
  const skillName = normalizeName(options.skill);
  const patch = options.patch.trim().toLowerCase() === "latest"
    ? await readLatestProposedSkillPatch(cwd)
    : await readSkillPatch(cwd, options.patch);
  if (patch.skill !== skillName) {
    throw new BriefOpsError(`Patch ${patch.id} targets ${patch.skill}, not ${skillName}.`);
  }
  if (patch.status !== "proposed") {
    throw new BriefOpsError(`Patch ${patch.id} is already ${patch.status}.`);
  }

  const skill = await readSkill(cwd, skillName);
  const patchedBody = appendChangelog(
    insertAdditionsIntoSection(skill.body, patch.target_section, patch.additions),
    patch
  );
  const nextData = {
    ...skill.data,
    version: bumpPatchVersion(skill.data.version)
  };
  const skillPath = skillFilePath(cwd, skillName);

  await writeTextFile(skillPath, stringifyMarkdownWithFrontmatter(nextData, patchedBody), {
    force: true
  });

  const appliedPatch = skillPatchSchema.parse({
    ...patch,
    status: "applied",
    applied_at: new Date().toISOString()
  });
  await writeSkillPatch(cwd, appliedPatch);

  return { patch: appliedPatch, skillPath };
}

export async function rejectSkillPatch(options: {
  cwd?: string;
  patch: string;
}): Promise<SkillPatch> {
  const cwd = options.cwd ?? process.cwd();
  return withWorkspaceLock({ cwd, name: "skill-patch" }, async () => {
    const patch = await readSkillPatch(cwd, options.patch);
    if (patch.status !== "proposed") {
      throw new BriefOpsError(`Patch ${patch.id} is already ${patch.status}.`);
    }

    const rejectedPatch = skillPatchSchema.parse({
      ...patch,
      status: "rejected",
      rejected_at: new Date().toISOString()
    });
    await writeSkillPatch(cwd, rejectedPatch);
    return rejectedPatch;
  });
}
