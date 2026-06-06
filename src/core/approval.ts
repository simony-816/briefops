import { BriefOpsError } from "./errors.js";
import { applyMemoryProposal, readMemoryProposal } from "./memoryProposal.js";
import { applySkillPatch, readSkillPatch } from "./patch.js";
import type { MemoryProposal } from "../schemas/memoryProposal.js";
import type { SkillPatch } from "../schemas/patch.js";

export type ApproveMemoryResult = {
  kind: "memory";
  proposal: MemoryProposal;
  created: number;
  skipped: number;
};

export type ApproveSkillPatchResult = {
  kind: "skill-patch";
  patch: SkillPatch;
  skillPath: string;
};

export type ApproveResult = ApproveMemoryResult | ApproveSkillPatchResult;

function isMemoryProposalNotFound(error: unknown): boolean {
  return error instanceof BriefOpsError && error.message.startsWith("Memory proposal not found:");
}

function isSkillPatchNotFound(error: unknown): boolean {
  return error instanceof BriefOpsError && error.message.startsWith("Skill patch not found:");
}

export async function approveMemory(options: {
  cwd?: string;
  id: string;
}): Promise<ApproveMemoryResult> {
  const result = await applyMemoryProposal({
    cwd: options.cwd,
    id: options.id
  });
  return {
    kind: "memory",
    proposal: result.proposal,
    created: result.created,
    skipped: result.skipped
  };
}

export async function approveSkillPatch(options: {
  cwd?: string;
  id: string;
}): Promise<ApproveSkillPatchResult> {
  const cwd = options.cwd ?? process.cwd();
  const patch = await readSkillPatch(cwd, options.id);
  const result = await applySkillPatch({
    cwd,
    skill: patch.skill,
    patch: patch.id
  });
  return {
    kind: "skill-patch",
    patch: result.patch,
    skillPath: result.skillPath
  };
}

export async function approveAny(options: {
  cwd?: string;
  id: string;
}): Promise<ApproveResult> {
  const cwd = options.cwd ?? process.cwd();
  try {
    await readMemoryProposal(cwd, options.id);
    return await approveMemory({ cwd, id: options.id });
  } catch (error) {
    if (!isMemoryProposalNotFound(error)) {
      throw error;
    }
  }

  try {
    return await approveSkillPatch({ cwd, id: options.id });
  } catch (error) {
    if (isSkillPatchNotFound(error)) {
      throw new BriefOpsError(
        `No memory proposal or skill patch found for approval: ${options.id}`
      );
    }
    throw error;
  }
}
