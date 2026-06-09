import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { readBriefOpsConfig } from "../src/core/config.js";
import { listWorkLogs } from "../src/core/log.js";
import { listMemory } from "../src/core/memory.js";
import { readMemoryProposal } from "../src/core/memoryProposal.js";
import { readProject } from "../src/core/project.js";
import { readWorker } from "../src/core/worker.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function writeFile(filePath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf8");
}

describe("1.0 compatibility contract", () => {
  it("reads v0.2 workspace files and legacy memory proposal shape", async () => {
    await withTempDir(async (dir) => {
      await initWorkspace(dir);
      await writeFile(
        path.join(dir, ".briefops/config.yaml"),
        [
          "version: 0.2.0",
          "defaults:",
          "  worker: quant-reviewer",
          "  project: atlas-q",
          "token_budgets:",
          "  prime: 800",
          "  resume: 3000",
          "memory_categories:",
          "  - facts",
          "  - decisions",
          "  - lessons",
          "  - incidents",
          "  - deprecated",
          ""
        ].join("\n")
      );
      await writeFile(
        path.join(dir, ".briefops/workers/quant-reviewer.worker.yaml"),
        [
          "name: quant-reviewer",
          "description: Risk reviewer",
          "project: atlas-q",
          "default_skills:",
          "  - risk-review",
          "style:",
          "  - verify before completion",
          "max_tokens: 300",
          "status: active",
          ""
        ].join("\n")
      );
      await writeFile(
        path.join(dir, ".briefops/projects/atlas-q.project.md"),
        [
          "---",
          "name: atlas-q",
          "description: Rule-based quantitative system",
          "max_tokens: 500",
          "tags:",
          "  - risk",
          "---",
          "",
          "# Project: atlas-q",
          "",
          "- Preserve deterministic review flow.",
          ""
        ].join("\n")
      );
      await writeFile(
        path.join(dir, ".briefops/memory/lessons.yaml"),
        [
          "items:",
          "  - id: mem_legacy_lesson",
          "    type: lesson",
          "    status: active",
          "    project: atlas-q",
          "    skill: risk-review",
          "    content: Always verify risk policy before release.",
          "    source: manual",
          "    created_at: 2026-06-08T00:00:00.000Z",
          "    tags:",
          "      - risk",
          "    visibility: private",
          "    exportable: false",
          ""
        ].join("\n")
      );
      await writeFile(
        path.join(dir, ".briefops/logs/20260608_000000-atlas-q-quant-reviewer.yaml"),
        [
          "id: log_legacy",
          "created_at: 2026-06-08T00:00:00.000Z",
          "project: atlas-q",
          "skill: risk-review",
          "worker: quant-reviewer",
          "task: Review legacy flow",
          "result: Found unresolved release risk.",
          "lessons:",
          "  - Keep release checks explicit.",
          "open_risks: []",
          "next_steps: []",
          "decisions: []",
          "incidents: []",
          "files_changed: []",
          "commands_run: []",
          "notes: ''",
          ""
        ].join("\n")
      );
      await writeFile(
        path.join(dir, ".briefops/memory-proposals/memprop_legacy.memory-proposal.yaml"),
        [
          "id: memprop_legacy",
          "created_at: 2026-06-08T00:00:00.000Z",
          "from_log: log_legacy",
          "status: proposed",
          "project: atlas-q",
          "skill: risk-review",
          "worker: quant-reviewer",
          "proposals:",
          "  - type: lesson",
          "    content: Legacy proposal shape remains readable.",
          "    status: active",
          "    source: log_legacy",
          "    tags: []",
          "    visibility: private",
          "    exportable: false",
          ""
        ].join("\n")
      );

      expect((await readBriefOpsConfig(dir)).version).toBe("0.2.0");
      expect((await readWorker(dir, "quant-reviewer")).project).toBe("atlas-q");
      expect((await readProject(dir, "atlas-q")).body).toContain("deterministic review flow");
      expect((await listMemory({ cwd: dir, type: "lessons" }))[0].content).toContain(
        "risk policy"
      );
      expect((await listWorkLogs({ cwd: dir }))[0].result).toContain("release risk");
      expect((await readMemoryProposal(dir, "memprop_legacy")).items[0].category).toBe("lessons");
    });
  });
});
