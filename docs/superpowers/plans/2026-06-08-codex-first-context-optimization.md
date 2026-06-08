# Codex First Context Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make BriefOps the first local context layer Codex can invoke at the start of any project or thread, reducing token waste from repeated history/context discovery while preserving the local-first open source model.

**Architecture:** Keep BriefOps Core as a local file-backed CLI and add a thin Codex-facing layer: a skill-only plugin package, a compact `prime` context command, ergonomic default-worker setup, and safety controls for concurrent local history writes. Hosted servers, cloud sync, vector databases, and required marketplaces stay out of scope.

**Tech Stack:** TypeScript, Commander, YAML, Zod, Vitest, Codex skill plugin packaging, local Markdown/YAML files under `.briefops/`.

---

## Product Outcome

After Stage 4, a user should be able to install BriefOps from source or npm, initialize a repository, install Codex guidance/plugin assets, and start a new Codex thread with a compact BriefOps prime context before Codex spends tokens re-reading history.

Primary happy path:

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops worker use <worker>
briefops prime --task "Continue the work from the last thread." --format codex
```

Codex plugin happy path:

```text
$briefops-prime-context
Start this task with the smallest useful BriefOps context before inspecting history.
```

Success metrics:

- `briefops prime --max-tokens 800` emits no more than 800 estimated tokens in normal ready workspaces.
- Missing `.briefops` workspaces produce a short setup response instead of a long error.
- Pending memory proposals are visible but never applied automatically.
- Private memory is local by default; export behavior is explicit and test-covered.
- Concurrent writes cannot silently corrupt memory, proposals, worker summaries, logs, handoffs, or packs.

## 4-Stage Development Goals

### Stage 1: Codex Skill-Only Plugin And Installer

Goal: Make BriefOps discoverable and habit-forming inside Codex without running a server.

Done when:

- A local plugin bundle exists in the repository.
- `briefops codex plugin install` writes a deterministic plugin copy inside `.briefops/codex/plugin/briefops`.
- The plugin has skills for prime, finish, review-memory, and continue workflows.
- `npm test -- tests/codex-plugin.test.ts tests/cli-workflow.test.ts` passes.

### Stage 2: Compact First-Context Prime Workflow

Goal: Add the actual token-saving start-of-thread context primitive.

Done when:

- `briefops prime` works with or without a selected worker.
- `briefops prime --format codex --max-tokens 800` emits a compact context contract, not a full resume pack.
- `briefops worker use <worker>` stores a safe default worker for future thread starts.
- Token-budget tests prove prime output is bounded and avoids full history dumps.

### Stage 3: Safety, Conflict, And Export Controls

Goal: Prevent local data corruption and accidental context leakage as usage increases across threads/projects.

Done when:

- Write-heavy flows use workspace-level locking and atomic file writes.
- Memory export policy is explicit for packs and prime output.
- `briefops doctor --security` reports unsafe config, stale locks, invalid YAML, and pending proposals.
- Race-condition and export-policy tests pass.

### Stage 4: Open Source Accessibility And Validation

Goal: Make the workflow easy to adopt and maintain as an open source local-first tool.

Done when:

- README and quickstart show a 5-minute Codex App path with no hosted service.
- Example fixture demonstrates before/after token savings.
- Evals verify prime context quality and bounded-token behavior.
- Release packaging includes plugin files and docs.

## File Structure

Create:

- `plugins/briefops-codex/.codex-plugin/plugin.json` - Codex plugin manifest.
- `plugins/briefops-codex/README.md` - local install and usage notes.
- `plugins/briefops-codex/skills/briefops-prime-context/SKILL.md` - mandatory start-of-thread skill.
- `plugins/briefops-codex/skills/briefops-finish-task/SKILL.md` - end-of-task recording workflow.
- `plugins/briefops-codex/skills/briefops-review-memory/SKILL.md` - human-approved memory review workflow.
- `plugins/briefops-codex/skills/briefops-continue-worker/SKILL.md` - fresh-thread resume workflow.
- `src/core/codexPlugin.ts` - plugin manifest/render/install helpers.
- `src/core/config.ts` - typed `.briefops/config.yaml` read/write helpers.
- `src/core/prime.ts` - compact first-context builder.
- `src/core/lock.ts` - workspace lock helper with stale-lock detection.
- `src/commands/prime.ts` - root `briefops prime` command.
- `tests/codex-plugin.test.ts` - plugin rendering/install tests.
- `tests/prime.test.ts` - compact context tests.
- `tests/safety.test.ts` - lock, atomic write, export policy tests.
- `examples/codex-first-context/README.md` - adoption scenario and expected token savings.

Modify:

- `package.json` - include `plugins`, docs, and examples in published files.
- `src/cli.ts` - register prime and config/worker default commands.
- `src/commands/codex.ts` - add `codex plugin install`, `codex plugin doctor`, and `codex prime`.
- `src/commands/worker.ts` - add `worker use <name>` and `worker current`.
- `src/commands/doctor.ts` - add `--security` mode.
- `src/core/storage.ts` - add atomic text/YAML writes.
- `src/core/workspace.ts` - initialize expanded config safely.
- `src/core/workflow.ts` - use locks in finish/continue/pack flows.
- `src/core/memory.ts` - use atomic writes and export filters.
- `src/core/memoryProposal.ts` - lock proposal apply/reject paths.
- `src/core/patch.ts` - lock skill patch apply paths.
- `README.md`, `docs/quickstart.md`, `docs/token-budget.md`, `docs/roadmap.md` - document the new workflow.

---

## Task 1: Add Codex Plugin Rendering Core

**Files:**

- Create: `src/core/codexPlugin.ts`
- Create: `tests/codex-plugin.test.ts`
- Create: `plugins/briefops-codex/.codex-plugin/plugin.json`
- Create: `plugins/briefops-codex/skills/briefops-prime-context/SKILL.md`
- Create: `plugins/briefops-codex/skills/briefops-finish-task/SKILL.md`
- Create: `plugins/briefops-codex/skills/briefops-review-memory/SKILL.md`
- Create: `plugins/briefops-codex/skills/briefops-continue-worker/SKILL.md`

- [ ] **Step 1: Write failing plugin manifest tests**

Add tests that require a deterministic manifest and four skill files.

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildCodexPluginManifest,
  codexPluginFiles
} from "../src/core/codexPlugin.js";

describe("Codex plugin package", () => {
  it("builds a local-first skill-only plugin manifest", () => {
    const manifest = buildCodexPluginManifest();

    expect(manifest.name).toBe("briefops");
    expect(manifest.skills).toBe("./skills/");
    expect(manifest.interface.displayName).toBe("BriefOps");
    expect(manifest.interface.category).toBe("Developer Tools");
    expect(manifest.interface.capabilities).toEqual(["Read", "Write"]);
    expect(manifest.interface.shortDescription).toContain("local-first");
  });

  it("ships every Codex skill used by the manifest", async () => {
    const files = codexPluginFiles();
    const skillFiles = files.map((file) => file.relativePath).filter((file) => file.endsWith("SKILL.md"));

    expect(skillFiles).toEqual([
      "skills/briefops-prime-context/SKILL.md",
      "skills/briefops-finish-task/SKILL.md",
      "skills/briefops-review-memory/SKILL.md",
      "skills/briefops-continue-worker/SKILL.md"
    ]);

    for (const file of files) {
      expect(file.content.trim().length).toBeGreaterThan(40);
    }
  });

  it("keeps committed plugin files in sync with generated content", async () => {
    const root = path.join(process.cwd(), "plugins/briefops-codex");

    for (const file of codexPluginFiles()) {
      const disk = await fs.readFile(path.join(root, file.relativePath), "utf8");
      expect(disk).toBe(file.content);
    }
  });
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run:

```bash
npm test -- tests/codex-plugin.test.ts
```

Expected: fail because `src/core/codexPlugin.ts` does not exist.

- [ ] **Step 3: Implement `src/core/codexPlugin.ts`**

Implement pure render helpers first. Do not read or write the filesystem in these functions.

```ts
export type CodexPluginManifest = {
  name: string;
  version: string;
  description: string;
  author: { name: string; url: string };
  homepage: string;
  repository: string;
  license: string;
  keywords: string[];
  skills: string;
  interface: {
    displayName: string;
    shortDescription: string;
    longDescription: string;
    developerName: string;
    category: string;
    capabilities: string[];
    defaultPrompt: string[];
    websiteURL: string;
    brandColor: string;
    screenshots: string[];
  };
};

export type CodexPluginFile = {
  relativePath: string;
  content: string;
};

export function buildCodexPluginManifest(): CodexPluginManifest {
  return {
    name: "briefops",
    version: "0.2.0-alpha.0",
    description: "Local-first, token-aware persistent work history for Codex workflows.",
    author: {
      name: "Simon",
      url: "https://github.com/simony-816/briefops"
    },
    homepage: "https://github.com/simony-816/briefops",
    repository: "https://github.com/simony-816/briefops",
    license: "MIT",
    keywords: ["codex", "local-first", "context", "memory", "handoff", "workflow"],
    skills: "./skills/",
    interface: {
      displayName: "BriefOps",
      shortDescription: "Local-first context priming and continuity for Codex",
      longDescription:
        "Use BriefOps to prime Codex with compact local context, record task outcomes, review durable memory proposals, and resume persistent workers without hosted services.",
      developerName: "BriefOps contributors",
      category: "Developer Tools",
      capabilities: ["Read", "Write"],
      defaultPrompt: [
        "Start this task with the smallest useful BriefOps context.",
        "Finish this task and prepare memory for the next thread."
      ],
      websiteURL: "https://github.com/simony-816/briefops",
      brandColor: "#2563EB",
      screenshots: []
    }
  };
}
```

- [ ] **Step 4: Add skill content renderers**

Each skill must preserve the local-first model and avoid auto-approval.

`briefops-prime-context` core instructions:

```md
---
name: briefops-prime-context
description: Use when starting work in any Codex project or fresh thread to load the smallest useful BriefOps context before reading large history files
---

# BriefOps Prime Context

Use BriefOps before broad repo/history inspection when a `.briefops` workspace exists or may exist.

Run:

```bash
briefops prime --format codex --task "<current user task>" --max-tokens 800
```

If the command reports that no workspace exists, keep the response short and suggest `briefops init`.

Never apply memory automatically. If pending proposals exist, show the review command.
```

- [ ] **Step 5: Commit static plugin files**

Write generated content to:

```text
plugins/briefops-codex/.codex-plugin/plugin.json
plugins/briefops-codex/skills/*/SKILL.md
```

- [ ] **Step 6: Verify tests pass**

Run:

```bash
npm test -- tests/codex-plugin.test.ts
```

Expected: pass.

---

## Task 2: Add Local Plugin Install And Doctor Commands

**Files:**

- Modify: `src/core/codexPlugin.ts`
- Modify: `src/commands/codex.ts`
- Modify: `tests/codex-plugin.test.ts`
- Modify: `tests/cli-workflow.test.ts`

- [ ] **Step 1: Write failing installer tests**

Add tests that install the plugin into the workspace, not into user-global Codex folders.

```ts
import { installCodexPlugin } from "../src/core/codexPlugin.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

it("installs a local Codex plugin bundle under .briefops", async () => {
  await withTempDir(async (dir) => {
    await initWorkspace(dir);
    const result = await installCodexPlugin({ cwd: dir });

    expect(result.root).toContain(".briefops/codex/plugin/briefops");
    expect(result.files).toContain(".codex-plugin/plugin.json");
    expect(result.files).toContain("skills/briefops-prime-context/SKILL.md");
  });
});
```

- [ ] **Step 2: Implement installer with no global side effects**

Add:

```ts
export async function installCodexPlugin(options: { cwd?: string; force?: boolean } = {}): Promise<{
  root: string;
  files: string[];
}> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);
  const root = path.join(workspacePaths(cwd).codex, "plugin", "briefops");
  const files: string[] = [];

  for (const file of codexPluginFiles()) {
    const target = path.join(root, file.relativePath);
    await writeTextFile(target, file.content, { force: options.force ?? true });
    files.push(file.relativePath);
  }

  return { root, files };
}
```

- [ ] **Step 3: Add `briefops codex plugin install`**

In `src/commands/codex.ts`, add:

```ts
const plugin = codex.command("plugin").description("Manage local BriefOps Codex plugin assets.");

plugin
  .command("install")
  .description("Install the BriefOps Codex plugin bundle into .briefops/codex/plugin.")
  .option("--force", "Overwrite generated plugin files.")
  .action(async (options: Record<string, unknown>) => {
    const result = await installCodexPlugin({ force: Boolean(options.force) });
    console.log("BriefOps Codex plugin bundle installed.");
    console.log(`Plugin: ${result.root}`);
    console.log("Next: install this local plugin folder in Codex, or use the generated skills as repo guidance.");
  });
```

- [ ] **Step 4: Add plugin doctor**

`briefops codex plugin doctor` should compare generated files with installed files and report `ok`, `missing`, or `changed`.

- [ ] **Step 5: Verify CLI workflow**

Run:

```bash
npm test -- tests/codex-plugin.test.ts tests/cli-workflow.test.ts
```

Expected: pass.

---

## Task 3: Add Typed Config And Default Worker Selection

**Files:**

- Create: `src/core/config.ts`
- Modify: `src/core/workspace.ts`
- Modify: `src/commands/worker.ts`
- Create: `tests/config.test.ts`

- [ ] **Step 1: Write failing config tests**

```ts
import { readBriefOpsConfig, setDefaultWorker } from "../src/core/config.js";

it("stores a default worker for thread starts", async () => {
  await withTempDir(async (dir) => {
    await seedContinuityWorkspace(dir);
    await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });

    const config = await readBriefOpsConfig(dir);
    expect(config.defaults.worker).toBe("quant-reviewer");
    expect(config.defaults.project).toBe("atlas-q");
  });
});
```

- [ ] **Step 2: Implement config schema**

Config shape:

```yaml
version: 0.2.0
created_at: "2026-06-08T00:00:00.000Z"
defaults:
  project: atlas-q
  worker: quant-reviewer
token_budgets:
  prime: 800
  resume: 3000
memory_categories:
  - facts
  - decisions
  - lessons
  - incidents
  - deprecated
```

- [ ] **Step 3: Add `worker use` and `worker current`**

Commands:

```bash
briefops worker use quant-reviewer
briefops worker current
```

`worker use` must fail if the worker does not exist.

- [ ] **Step 4: Preserve backward compatibility**

When reading old config files without `defaults` or `token_budgets`, return defaults in memory and write the expanded shape only when a command changes config.

- [ ] **Step 5: Verify**

Run:

```bash
npm test -- tests/config.test.ts tests/persistent-worker.test.ts
```

Expected: pass.

---

## Task 4: Implement Compact Prime Context Core

**Files:**

- Create: `src/core/prime.ts`
- Create: `tests/prime.test.ts`
- Modify: `src/core/continuity.ts`
- Modify: `src/core/inbox.ts`

- [ ] **Step 1: Write failing prime tests**

```ts
import { primeContext } from "../src/core/prime.js";

it("returns a short setup response when no workspace exists", async () => {
  await withTempDir(async (dir) => {
    const result = await primeContext({
      cwd: dir,
      task: "Start work.",
      maxTokens: 300,
      format: "codex"
    });

    expect(result.status).toBe("setup-required");
    expect(result.content).toContain("briefops init");
    expect(result.tokens).toBeLessThanOrEqual(300);
  });
});

it("emits compact ready context without full resume pack content", async () => {
  await withTempDir(async (dir) => {
    await seedContinuityWorkspace(dir);
    await setDefaultWorker({ cwd: dir, worker: "quant-reviewer" });

    const result = await primeContext({
      cwd: dir,
      task: "Continue unresolved slippage checks.",
      maxTokens: 800,
      format: "codex"
    });

    expect(result.status).toBe("ready");
    expect(result.content).toContain("# BriefOps Prime Context");
    expect(result.content).toContain("quant-reviewer");
    expect(result.content).toContain("Token Budget");
    expect(result.content).not.toContain("# BriefOps Portable Resume Pack");
    expect(result.tokens).toBeLessThanOrEqual(800);
  });
});
```

- [ ] **Step 2: Implement prime options**

```ts
export type PrimeContextOptions = {
  cwd?: string;
  worker?: string;
  project?: string;
  task?: string;
  maxTokens?: number;
  format?: "markdown" | "codex";
  exportPolicy?: "local-private" | "shared-only";
};

export type PrimeContextResult = {
  status: "ready" | "attention-required" | "setup-required";
  content: string;
  tokens: number;
  warnings: string[];
};
```

- [ ] **Step 3: Resolve worker with low-token rules**

Resolution order:

1. `--worker`.
2. `.briefops/config.yaml` `defaults.worker`.
3. The only active worker if exactly one exists.
4. Setup response asking the user to run `briefops worker use <worker>`.

- [ ] **Step 4: Render compact context**

Output sections:

```md
# BriefOps Prime Context

## Current Task

## Worker

## Continuity Status

## Highest-Value Memory

## Open Risks And Next Steps

## Pending User Review

## Recommended Commands

## Token Budget
```

Do not include full handoff, full resume, full logs, or file dumps.

- [ ] **Step 5: Verify token budget behavior**

Use `truncateToTokenBudget` and existing `estimateTokens`. When content exceeds budget, trim memory/log sections before trimming required safety sections.

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/prime.test.ts tests/persistent-worker.test.ts
```

Expected: pass.

---

## Task 5: Add Prime CLI And Codex Alias

**Files:**

- Create: `src/commands/prime.ts`
- Modify: `src/cli.ts`
- Modify: `src/commands/codex.ts`
- Modify: `tests/cli-workflow.test.ts`

- [ ] **Step 1: Add root command**

Command:

```bash
briefops prime --task "..." --worker quant-reviewer --max-tokens 800 --format codex
```

Options:

```text
--task <task>
--worker <worker>
--project <project>
--max-tokens <tokens>
--format <markdown|codex>
--export-policy <local-private|shared-only>
--save
```

- [ ] **Step 2: Add Codex alias**

Command:

```bash
briefops codex prime --task "..." --max-tokens 800
```

This calls the same core function with `format: "codex"`.

- [ ] **Step 3: Register command**

In `src/cli.ts`:

```ts
import { registerPrimeCommand } from "./commands/prime.js";
```

Register immediately after `registerDoctorCommand(program)` so it is visible near the top of help output.

- [ ] **Step 4: CLI test**

Add a test that runs:

```bash
briefops prime --task "Continue unresolved checks." --max-tokens 800
```

Expected stdout contains:

```text
BriefOps Prime Context
Token Budget
```

Expected stderr contains:

```text
Estimated tokens:
```

- [ ] **Step 5: Verify**

```bash
npm test -- tests/prime.test.ts tests/cli-workflow.test.ts
```

Expected: pass.

---

## Task 6: Add Atomic Writes And Workspace Locks

**Files:**

- Create: `src/core/lock.ts`
- Modify: `src/core/storage.ts`
- Modify: `tests/safety.test.ts`

- [ ] **Step 1: Write failing lock tests**

```ts
import { withWorkspaceLock } from "../src/core/lock.js";

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
```

- [ ] **Step 2: Implement `withWorkspaceLock`**

Use local lock files under `.briefops/.locks/<name>.lock`.

Rules:

- Create lock using exclusive file creation.
- Include pid, command name when available, and timestamp.
- Treat locks older than 30 minutes as stale.
- Always remove the lock in `finally`.

- [ ] **Step 3: Add atomic write helpers**

In `src/core/storage.ts`:

```ts
export async function writeTextFileAtomic(filePath: string, content: string): Promise<void>
export async function writeYamlFileAtomic(filePath: string, value: unknown): Promise<void>
```

Implementation writes to sibling temp file and renames it into place.

- [ ] **Step 4: Verify**

```bash
npm test -- tests/safety.test.ts
```

Expected: pass.

---

## Task 7: Apply Locks To Write-Heavy Flows

**Files:**

- Modify: `src/core/memory.ts`
- Modify: `src/core/memoryProposal.ts`
- Modify: `src/core/patch.ts`
- Modify: `src/core/workflow.ts`
- Modify: `src/core/worker.ts`
- Modify: `src/core/handoff.ts`
- Modify: `tests/safety.test.ts`

- [ ] **Step 1: Lock memory mutation**

Wrap these operations:

```text
addMemory
updateMemoryStatus
applyMemoryProposal
rejectMemoryProposal
approveMemory
```

Use lock name:

```text
memory
```

- [ ] **Step 2: Lock workflow mutation**

Wrap:

```text
finishWork
continueWork
packResume when writing output
refreshWorkerSummary
```

Use lock names:

```text
workflow
worker-summary
pack
```

- [ ] **Step 3: Keep read-only commands lock-free**

Do not lock:

```text
primeContext
inspectContinuityHealth
getInboxSummary
listMemory
generateWorkerIntelligence when save=false
```

- [ ] **Step 4: Regression tests**

Run:

```bash
npm test -- tests/safety.test.ts tests/persistent-worker.test.ts tests/cli-workflow.test.ts
```

Expected: pass.

---

## Task 8: Add Export Policy Controls

**Files:**

- Modify: `src/core/prime.ts`
- Modify: `src/core/workflow.ts`
- Modify: `src/commands/pack.ts`
- Modify: `src/commands/prime.ts`
- Modify: `tests/prime.test.ts`
- Modify: `tests/safety.test.ts`

- [ ] **Step 1: Define export policy**

Policy values:

```text
local-private: default; allowed for local terminal/Codex use
shared-only: include only memory items with visibility=shared and exportable=true
```

- [ ] **Step 2: Test shared-only filtering**

```ts
it("filters private memory when export policy is shared-only", async () => {
  await withTempDir(async (dir) => {
    await seedContinuityWorkspace(dir);
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
```

- [ ] **Step 3: Add command options**

Commands:

```bash
briefops prime --export-policy shared-only
briefops pack resume --export-policy shared-only
```

- [ ] **Step 4: Add warning text**

When using `local-private`, include:

```text
This context may include private local BriefOps memory. Review before sharing outside this machine.
```

- [ ] **Step 5: Verify**

```bash
npm test -- tests/prime.test.ts tests/safety.test.ts tests/persistent-worker.test.ts
```

Expected: pass.

---

## Task 9: Add `doctor --security`

**Files:**

- Modify: `src/commands/doctor.ts`
- Create: `src/core/securityDoctor.ts`
- Modify: `tests/safety.test.ts`

- [ ] **Step 1: Add security checks**

Report:

```text
Workspace exists
Config YAML valid
Memory YAML files valid
Pending memory proposals
Pending skill patches
Stale lock files
Private exportable memory items
Missing default worker
Default worker points to missing file
```

- [ ] **Step 2: Exit behavior**

Exit code:

- `0` when all checks are ok or advisory.
- `1` when invalid YAML, stale lock, or missing default worker target is found.

- [ ] **Step 3: Verify**

```bash
npm test -- tests/safety.test.ts
```

Expected: pass.

---

## Task 10: Add Token-Savings Fixture And Eval

**Files:**

- Create: `examples/codex-first-context/README.md`
- Create: `examples/codex-first-context/before-manual-history-dump.md`
- Create: `examples/codex-first-context/after-briefops-prime.md`
- Create: `.briefops/evals/prime-context.eval.yaml` if evals are intended to live in a workspace fixture.
- Modify: `docs/evals.md`
- Modify: `tests/prime.test.ts`

- [ ] **Step 1: Create example scenario**

Use the same `atlas-q` style fixture and compare:

```text
Manual history dump: project README + logs + memory files + handoff
BriefOps prime: compact selected context
```

- [ ] **Step 2: Add token comparison**

Use existing `estimateTokens` in a test to assert:

```ts
expect(primeTokens).toBeLessThan(manualTokens * 0.35);
```

- [ ] **Step 3: Document eval command**

Add to docs:

```bash
npm test -- tests/prime.test.ts
briefops eval run prime-context
```

- [ ] **Step 4: Verify**

```bash
npm test -- tests/prime.test.ts tests/token.test.ts
```

Expected: pass.

---

## Task 11: Update Open Source Docs And Packaging

**Files:**

- Modify: `README.md`
- Modify: `docs/quickstart.md`
- Modify: `docs/token-budget.md`
- Modify: `docs/roadmap.md`
- Modify: `package.json`
- Create: `plugins/briefops-codex/README.md`

- [ ] **Step 1: Update package files**

`package.json` `files` should include:

```json
[
  "dist",
  "plugins",
  "examples",
  "docs",
  "README.md",
  "LICENSE"
]
```

- [ ] **Step 2: Update README positioning**

Keep the boundary explicit:

```md
BriefOps is not a hosted memory service, agent runtime, vector database, or cloud sync product.
```

Add:

```md
BriefOps can ship Codex skill-plugin assets, but the plugin calls the local CLI and local `.briefops/` workspace.
```

- [ ] **Step 3: Add 5-minute Codex App path**

Commands:

```bash
npm install -g briefops
briefops init
briefops codex install
briefops codex plugin install
briefops worker use <worker>
briefops prime --task "Start this task." --format codex
```

- [ ] **Step 4: Update roadmap**

Move these into near-term priorities:

```text
Codex skill-only plugin
compact prime context
local safety/lock controls
token-savings eval fixture
```

Keep out of scope:

```text
hosted server
cloud sync
required marketplace
agent runtime
vector database
```

- [ ] **Step 5: Verify package**

Run:

```bash
npm run build
npm test
npm pack --dry-run
```

Expected:

- Build passes.
- Tests pass.
- Dry run includes `plugins/briefops-codex`.

---

## Task 12: Final Integration Pass

**Files:**

- All files touched above.

- [ ] **Step 1: Run full verification**

```bash
npm run build
npm test
```

Expected: pass.

- [ ] **Step 2: Manual smoke test in temp repo**

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
briefops init
briefops skill create risk-review
briefops project create atlas-q
briefops worker create quant-reviewer --project atlas-q --skills risk-review
briefops worker use quant-reviewer
briefops codex install
briefops codex plugin install
briefops prime --task "Continue unresolved checks." --format codex --max-tokens 800
briefops finish --worker quant-reviewer --task "Review work" --result "Found unresolved risk." --lesson "Check unresolved risk before finishing."
briefops prime --task "Continue unresolved risk review." --format codex --max-tokens 800
```

Expected:

- Plugin bundle path is printed.
- Prime output is compact.
- Pending memory proposal is reported after finish.
- Memory is not auto-approved.

- [ ] **Step 3: Review git diff**

```bash
git diff --stat
git diff -- plugins src tests docs examples package.json README.md
```

Expected:

- No generated local `.briefops/` workspace content is committed unless intentionally part of examples.
- No absolute local paths are committed in docs or plugin files.
- No secret, token, or personal data appears.

- [ ] **Step 4: Commit in stage-sized commits**

Commit order:

```bash
git add plugins src/core/codexPlugin.ts tests/codex-plugin.test.ts
git commit -m "feat: add codex plugin assets"

git add src/core/config.ts src/core/prime.ts src/commands/prime.ts src/cli.ts src/commands/worker.ts tests/config.test.ts tests/prime.test.ts
git commit -m "feat: add compact prime context workflow"

git add src/core/lock.ts src/core/storage.ts src/core/workflow.ts src/core/memory.ts src/core/memoryProposal.ts src/core/patch.ts src/commands/doctor.ts tests/safety.test.ts
git commit -m "feat: harden local continuity writes"

git add README.md docs examples package.json
git commit -m "docs: document codex first-context workflow"
```

## Security And Exception Handling Notes

- Do not make any command write to `~/.codex`, `~/.agents`, or another global plugin folder by default.
- Do not add hosted services, telemetry, or network calls.
- Do not auto-apply memory proposals from any Codex skill.
- Do not include private memory when `--export-policy shared-only` is set.
- Do not let output paths silently overwrite files unless the command has explicit `--force`.
- Do not resolve user-provided worker/project/skill names without `normalizeName`.
- Do not treat plugin install as marketplace publishing; it is a local deterministic artifact.
- Do not let stale lock files permanently block the workspace; stale locks must be reported and removable by `doctor --security`.

## Self-Review

Spec coverage:

- Four-stage development goal: covered by Stage 1 through Stage 4.
- Token waste reduction: covered by compact `prime` workflow, token tests, and eval fixture.
- Open source and accessible: covered by local plugin assets, npm packaging, docs, no hosted services.
- Security and conflict management: covered by locks, atomic writes, export policy, and `doctor --security`.

Placeholder scan:

- No task depends on unspecified hosted infrastructure.
- All new files and modified files are named explicitly.
- Test commands and expected outcomes are included.

Type consistency:

- `PrimeContextOptions`, `PrimeContextResult`, `CodexPluginManifest`, and `CodexPluginFile` are defined before later tasks rely on them.
- Command names stay consistent: `briefops prime`, `briefops codex prime`, `briefops codex plugin install`, `briefops worker use`, and `briefops doctor --security`.
