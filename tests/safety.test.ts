import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { setDefaultWorker } from "../src/core/config.js";
import { generateCodexResume } from "../src/core/codex.js";
import { cleanStaleLocks, withWorkspaceLock } from "../src/core/lock.js";
import { addWorkLog } from "../src/core/log.js";
import { addMemory, listMemory } from "../src/core/memory.js";
import { applyMemoryProposal, proposeMemoryFromLog } from "../src/core/memoryProposal.js";
import { applySkillPatch, proposeSkillPatch } from "../src/core/patch.js";
import { primeContext } from "../src/core/prime.js";
import { createProject } from "../src/core/project.js";
import { runSecurityDoctor } from "../src/core/securityDoctor.js";
import { createSkill } from "../src/core/skill.js";
import { ensureDirectory, readTextFile, writeTextFileAtomic, writeYamlFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { packResume } from "../src/core/workflow.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seedSafetyWorkspace(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({
    cwd: dir,
    name: "risk-review",
    description: "Review changes for risk and governance violations."
  });
  await createProject({
    cwd: dir,
    name: "atlas-q",
    description: "Rule-based quantitative trading system."
  });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    project: "atlas-q",
    skills: ["risk-review"]
  });
  await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });
}

describe("local safety controls", () => {
  it("prevents two writers from holding the same workspace lock", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      const first = withWorkspaceLock({ cwd: dir, name: "memory" }, async () => {
        await expect(
          withWorkspaceLock({ cwd: dir, name: "memory", timeoutMs: 50 }, async () => "second")
        ).rejects.toThrow("BriefOps workspace lock is already held");
        return "first";
      });

      await expect(first).resolves.toBe("first");
    });
  });

  it("writes text files atomically without leaving temp files", async () => {
    await withTempDir(async (dir) => {
      const target = path.join(dir, "nested", "file.txt");
      await writeTextFileAtomic(target, "hello\n");

      expect(await readTextFile(target)).toBe("hello\n");
      const entries = await fs.readdir(path.dirname(target));
      expect(entries.filter((entry) => entry.includes(".tmp-"))).toEqual([]);
    });
  });

  it("filters private memory when export policy is shared-only", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private local lesson.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared exportable lesson.",
        visibility: "shared",
        exportable: true
      });

      const result = await primeContext({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "shared-only"
      });

      expect(result.content).toContain("Shared exportable lesson.");
      expect(result.content).not.toContain("Private local lesson.");
    });
  });

  it("filters private memory from portable packs when export policy is shared-only", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private pack lesson.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared pack lesson.",
        visibility: "shared",
        exportable: true
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review private pack work",
        result: "Private raw log result should not leave local export.",
        openRisks: ["Private open risk should not leave local export."],
        nextSteps: ["Private next step should not leave local export."]
      });

      const pack = await packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "shared-only"
      });

      expect(pack.content).toContain("Shared pack lesson.");
      expect(pack.content).not.toContain("Private pack lesson.");
      expect(pack.content).not.toContain("Private raw log result should not leave local export.");
      expect(pack.content).not.toContain("Private open risk should not leave local export.");
      expect(pack.content).not.toContain("Private next step should not leave local export.");
      expect(pack.content).toContain("Shared-only export policy is active.");
    });
  });

  it("filters private continuity context from Codex resume when export policy is shared-only", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private resume lesson.",
        visibility: "private",
        exportable: false
      });
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Shared resume lesson.",
        visibility: "shared",
        exportable: true
      });
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review private resume work",
        result: "Private resume raw result should not leave local export.",
        openRisks: ["Private resume open risk should not leave local export."],
        nextSteps: ["Private resume next step should not leave local export."]
      });

      const resume = await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "shared-only"
      });

      expect(resume.content).toContain("Shared resume lesson.");
      expect(resume.content).not.toContain("Private resume lesson.");
      expect(resume.content).not.toContain("Private resume raw result should not leave local export.");
      expect(resume.content).not.toContain("Private resume open risk should not leave local export.");
      expect(resume.content).not.toContain("Private resume next step should not leave local export.");
      expect(resume.content).toContain("Shared-only export policy is active.");
    });
  });

  it("preserves normal continuity context for local-private packs", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Review local private work",
        result: "Local raw log result remains available locally.",
        openRisks: ["Local open risk remains available locally."],
        nextSteps: ["Local next step remains available locally."]
      });

      const pack = await packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        exportPolicy: "local-private"
      });

      expect(pack.content).toContain("Local raw log result remains available locally.");
      expect(pack.content).toContain("Local open risk remains available locally.");
      expect(pack.content).toContain("Local next step remains available locally.");
    });
  });

  it("reports a healthy security doctor result", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      const result = await runSecurityDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.name === "Workspace")?.status).toBe("ok");
      expect(result.checks.find((check) => check.name === "Default worker")?.status).toBe("ok");
    });
  });

  it("fails security doctor for missing default worker targets and stale locks", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await writeYamlFile(`${dir}/.briefops/config.yaml`, {
        version: "0.2.0",
        defaults: {
          worker: "missing-worker"
        },
        token_budgets: {
          prime: 800,
          resume: 3000
        },
        memory_categories: ["facts", "decisions", "lessons", "incidents", "deprecated"]
      });
      await ensureDirectory(`${dir}/.briefops/.locks`);
      await writeTextFileAtomic(
        `${dir}/.briefops/.locks/memory.lock`,
        "name: memory\npid: 999999\ncreated_at: 2000-01-01T00:00:00.000Z\n"
      );

      const result = await runSecurityDoctor({ cwd: dir });

      expect(result.ok).toBe(false);
      expect(result.checks.find((check) => check.name === "Default worker")?.status).toBe("fail");
      expect(result.checks.find((check) => check.name === "Stale lock files")?.status).toBe("fail");
    });
  });

  it("cleans stale locks without removing fresh locks", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await ensureDirectory(`${dir}/.briefops/.locks`);
      await writeTextFileAtomic(
        `${dir}/.briefops/.locks/stale.lock`,
        "name: stale\npid: 999999\ncreated_at: 2000-01-01T00:00:00.000Z\n"
      );
      await writeTextFileAtomic(
        `${dir}/.briefops/.locks/fresh.lock`,
        `name: fresh\npid: ${process.pid}\ncreated_at: ${new Date().toISOString()}\n`
      );

      expect((await runSecurityDoctor({ cwd: dir })).ok).toBe(false);
      const removed = await cleanStaleLocks({ cwd: dir });
      expect(removed.some((filePath) => filePath.endsWith("stale.lock"))).toBe(true);
      await expect(fs.stat(`${dir}/.briefops/.locks/stale.lock`)).rejects.toThrow();
      await expect(fs.stat(`${dir}/.briefops/.locks/fresh.lock`)).resolves.toBeTruthy();
      expect((await runSecurityDoctor({ cwd: dir })).ok).toBe(true);
    });
  });

  it("serializes concurrent direct memory adds", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);

      await Promise.all(
        Array.from({ length: 8 }, (_, index) =>
          addMemory({
            cwd: dir,
            type: "lessons",
            project: "atlas-q",
            skill: "risk-review",
            content: `Concurrent memory lesson ${index}.`
          })
        )
      );

      const lessons = await listMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review"
      });
      expect(lessons.filter((item) => item.content.startsWith("Concurrent memory lesson")).length)
        .toBe(8);
    });
  });

  it("does not corrupt memory files when applying the same proposal concurrently", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Record durable lesson",
        result: "Completed review.",
        lessons: ["Concurrent proposal lesson."]
      });
      const proposed = await proposeMemoryFromLog({ cwd: dir, fromLog: "latest" });
      const results = await Promise.allSettled([
        applyMemoryProposal({ cwd: dir, id: proposed.proposal.id }),
        applyMemoryProposal({ cwd: dir, id: proposed.proposal.id })
      ]);

      expect(results.filter((result) => result.status === "fulfilled").length).toBe(1);
      const lessons = await listMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review"
      });
      expect(lessons.filter((item) => item.content === "Concurrent proposal lesson.").length)
        .toBe(1);
    });
  });

  it("uses the skill-patch lock for direct skill patch apply", async () => {
    await withTempDir(async (dir) => {
      await seedSafetyWorkspace(dir);
      await addWorkLog({
        cwd: dir,
        project: "atlas-q",
        skill: "risk-review",
        worker: "quant-reviewer",
        task: "Record patch lesson",
        result: "Completed review.",
        lessons: ["Apply direct skill patch with lock."]
      });
      const patch = await proposeSkillPatch({
        cwd: dir,
        skill: "risk-review",
        fromLog: "latest"
      });

      await withWorkspaceLock({ cwd: dir, name: "skill-patch" }, async () => {
        await expect(
          applySkillPatch({ cwd: dir, skill: "risk-review", patch: patch.patch.id })
        ).rejects.toThrow("BriefOps workspace lock is already held");
      });
    });
  });
});
