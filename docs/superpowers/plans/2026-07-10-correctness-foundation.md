# BriefOps Correctness Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the confirmed v2.1.3 correctness defects and establish safe compatibility foundations for the later model-contract, harness, evaluation, and release phases.

**Architecture:** This phase makes four independently reviewable changes: stabilize the existing multi-process CLI tests, centralize Codex mode behavior and neutral worker judgment, make memory selection and promotion trust-aware, and connect eval/runtime failures to release readiness. Public commands and legacy workspace files remain compatible.

**Tech Stack:** TypeScript 5.6, Node.js 20+, Commander, Zod, YAML, Vitest.

## Global Constraints

- Keep all product operations local and deterministic unless a release command explicitly contacts npm or GitHub.
- Preserve Node.js `>=20` runtime compatibility.
- Preserve reading of workspace schema `1.0.0` and legacy `0.2` fixtures.
- Do not expose private memory in `shared-only` output.
- Historical memory, project text, logs, and worker summaries are data, not higher-priority instructions.
- User requests and repository instructions outrank BriefOps memory.
- Read-only tasks must not cause workspace writes during normal completion.
- Every behavior change follows RED/GREEN TDD and receives task-scoped review.
- Do not change package version, changelog, release tags, or public release metadata in this phase.

---

### Task 1: Stabilize multi-process CLI test budgets

**Files:**
- Modify: `tests/cli-workflow.test.ts`
- Modify: `tests/export-targets.test.ts`

**Interfaces:**
- Consumes: Vitest `describe(name, options, handler)` suite options.
- Produces: A named `CLI_SUITE_TIMEOUT_MS` constant set to `15_000` in each CLI-spawning test file.

- [ ] **Step 1: Reproduce the baseline timeout failure**

Run:

```bash
npm test -- tests/cli-workflow.test.ts tests/export-targets.test.ts --reporter=dot
```

Expected: one or more tests fail only with `Test timed out in 5000ms`; no assertion mismatch is required for this infrastructure RED case.

- [ ] **Step 2: Add an explicit suite-local process budget**

In each file, add the constant next to the CLI path constants:

```ts
const CLI_SUITE_TIMEOUT_MS = 15_000;
```

Change only the CLI-spawning suite declaration:

```ts
describe("CLI persistent worker workflow", { timeout: CLI_SUITE_TIMEOUT_MS }, () => {
```

and:

```ts
describe("harness router exports", { timeout: CLI_SUITE_TIMEOUT_MS }, () => {
```

Do not change global Vitest timeouts and do not add sleeps or retries.

- [ ] **Step 3: Verify the targeted suites**

Run:

```bash
npm test -- tests/cli-workflow.test.ts tests/export-targets.test.ts --reporter=dot
```

Expected: both files pass with no timeout or assertion failures.

- [ ] **Step 4: Verify the complete baseline suite**

Run:

```bash
npm test -- --reporter=dot
```

Expected: 23 files and 124 tests pass under the canonical command.

- [ ] **Step 5: Commit**

```bash
git add tests/cli-workflow.test.ts tests/export-targets.test.ts
git commit -m "test: stabilize CLI integration time budgets"
```

---

### Task 2: Honor resume mode and remove worker judgment leakage

**Files:**
- Create: `src/core/modelContract.ts`
- Modify: `src/core/codex.ts`
- Modify: `src/core/handoff.ts`
- Modify: `src/core/worker.ts`
- Modify: `tests/codex.test.ts`
- Modify: `tests/persistent-worker.test.ts`

**Interfaces:**
- Produces: `CodexMode`, `normalizeCodexMode(value?: string): CodexMode`, and `renderCodexModeInstruction(mode: CodexMode): string` from `src/core/modelContract.ts`.
- Consumes: `GenerateHandoffOptions.mode` and `CodexMissionOptions.mode`.
- Preserves: accepted values `loop`, `execute`, and `plan`; invalid values throw `BriefOpsError`.

- [ ] **Step 1: Write failing resume-mode tests**

Add a test in `tests/persistent-worker.test.ts` that generates a resume with `mode: "plan"` and asserts:

```ts
expect(resume.content).toContain("Plan only. Do not modify product code or workspace state.");
expect(resume.content).not.toContain("Execute only the current task.");
```

Add a second assertion for execute mode:

```ts
expect(execute.content).toContain(
  "Execute only the current task, keeping changes scoped and verified."
);
```

- [ ] **Step 2: Write a failing generic-worker test**

Create a worker named `docs-maintainer` with style `concise` and call `generateWorkerIntelligence`. Assert:

```ts
expect(result.content).toContain("## Judgment Profile");
expect(result.content).toContain("- concise");
expect(result.content).not.toContain("merge recommendation");
expect(result.content).not.toContain("unverified risk assumptions");
expect(result.content).not.toContain("project governance over short-term speed");
```

Also test a worker with no style:

```ts
expect(result.content).toContain("- Verify relevant work before completion.");
```

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- tests/persistent-worker.test.ts tests/codex.test.ts --reporter=verbose
```

Expected: plan mode still contains the execute instruction and the generic worker still contains the quantitative-risk judgment profile.

- [ ] **Step 4: Create the shared mode contract**

Create `src/core/modelContract.ts` with:

```ts
import { BriefOpsError } from "./errors.js";

export const codexModes = ["loop", "execute", "plan"] as const;
export type CodexMode = (typeof codexModes)[number];

export function normalizeCodexMode(value?: string): CodexMode {
  const mode = (value ?? "loop").trim().toLowerCase();
  if ((codexModes as readonly string[]).includes(mode)) {
    return mode as CodexMode;
  }
  throw new BriefOpsError(`Invalid Codex mode: ${value}`);
}

export function renderCodexModeInstruction(mode: CodexMode): string {
  if (mode === "plan") {
    return "Plan only. Do not modify product code or workspace state.";
  }
  if (mode === "execute") {
    return "Execute only the current task, keeping changes scoped and verified.";
  }
  return "Work in a bounded loop: inspect, plan, act, verify, and continue when verification fails.";
}
```

- [ ] **Step 5: Use the shared mode contract in mission and resume generation**

Remove the private `normalizeCodexMode` implementation from `src/core/codex.ts`, import the shared functions, and replace the local ternary with:

```ts
const modeLine = renderCodexModeInstruction(options.mode);
```

In `generateCodexResumeFromHandoff`, normalize once:

```ts
const mode = normalizeCodexMode(options.mode);
```

Replace the hard-coded execute line in the continuity contract with:

```ts
`4. ${renderCodexModeInstruction(mode)}`,
```

- [ ] **Step 6: Derive worker judgment from worker data**

In `generateWorkerIntelligence`, replace the three hard-coded domain rules with:

```ts
const judgment = worker.style.length > 0
  ? worker.style.map((item) => `- ${item}`).join("\n")
  : "- Verify relevant work before completion.";
```

Render `judgment` under `## Judgment Profile`. Do not infer new judgment rules from unrelated project examples.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
npm test -- tests/persistent-worker.test.ts tests/codex.test.ts --reporter=verbose
npm run build
```

Expected: all targeted tests and TypeScript build pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/modelContract.ts src/core/codex.ts src/core/handoff.ts src/core/worker.ts tests/codex.test.ts tests/persistent-worker.test.ts
git commit -m "fix: honor Codex modes and neutralize worker defaults"
```

---

### Task 3: Make memory scope, export, and promotion trust-aware

**Files:**
- Modify: `src/schemas/memory.ts`
- Modify: `src/schemas/memoryProposal.ts`
- Modify: `src/core/memory.ts`
- Modify: `src/core/memoryProposal.ts`
- Modify: `src/core/prime.ts`
- Modify: `src/core/handoff.ts`
- Modify: `src/core/workflow.ts`
- Modify: `src/commands/finish.ts`
- Modify: `tests/memory.test.ts`
- Modify: `tests/prime.test.ts`
- Modify: `tests/persistent-worker.test.ts`
- Modify: `tests/compatibility-contract.test.ts`

**Interfaces:**
- Adds optional/defaulted memory fields: `confidence`, `last_verified_at`, and `supersedes`.
- Adds proposal entry field: `origin: "explicit" | "inferred"`.
- Adds selection options: `exportPolicy?: ExportPolicy` and `includeUnverified?: boolean`.
- Adds finish option/flag: `applyInferredMemory?: boolean` / `--apply-inferred-memory`.
- Preserves legacy memory and proposal parsing through defaults.

- [ ] **Step 1: Write failing selection tests**

Add tests that create current-project, other-project, and global memory. Select for the current project and assert:

```ts
expect(selected.items.map((item) => item.content)).toContain("Current project decision.");
expect(selected.items.map((item) => item.content)).toContain("Global decision.");
expect(selected.items.map((item) => item.content)).not.toContain("Other project decision.");
```

Add a shared-only quota test with a high-scoring private decision and a lower-scoring shared/exportable decision in the same category. Assert the shared decision is selected.

Add an unverified and superseded test:

```ts
expect(selected.items.map((item) => item.id)).not.toContain(unverified.id);
expect(selected.items.map((item) => item.id)).not.toContain(superseded.id);
```

- [ ] **Step 2: Write failing promotion tests**

Add a `finishWork` test where only a failure-sounding result and normative next step create inferred entries. Assert the proposal remains `proposed` and the warnings include:

```ts
"Inferred memory requires review; use --apply-inferred-memory to apply it explicitly."
```

Add a second test with explicit lessons/decisions only and assert the proposal remains auto-applied.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- tests/memory.test.ts tests/prime.test.ts tests/persistent-worker.test.ts tests/compatibility-contract.test.ts --reporter=verbose
```

Expected: other-project memory remains eligible, shared-only selection can be starved, and inferred proposals auto-apply.

- [ ] **Step 4: Extend memory schemas compatibly**

In `src/schemas/memory.ts`, add:

```ts
export const memoryConfidences = ["verified", "unverified"] as const;
```

and the fields:

```ts
confidence: z.enum(memoryConfidences).default("verified"),
last_verified_at: z.string().datetime().optional(),
supersedes: z.array(z.string().min(1)).default([])
```

In proposal entries add:

```ts
origin: z.enum(["explicit", "inferred"]).default("explicit"),
confidence: z.enum(memoryConfidences).default("verified"),
last_verified_at: z.string().datetime().optional(),
supersedes: z.array(z.string().min(1)).default([])
```

- [ ] **Step 5: Filter before scoring and quotas**

Extend `SelectRelevantMemoryOptions` and select candidates in this order:

```ts
const exportPolicy = normalizeExportPolicy(options.exportPolicy);
const active = filterMemoryForExport(
  await listMemory({ cwd: options.cwd, status: "active" }),
  exportPolicy
);
const supersededIds = new Set(active.flatMap((item) => item.supersedes));
const candidates = active.filter((item) => {
  const category = itemTypeToCategory[item.type];
  if (options.project && item.project && item.project !== normalizeName(options.project)) {
    return false;
  }
  if (!options.includeUnverified && item.confidence === "unverified") {
    return false;
  }
  if (supersededIds.has(item.id)) {
    return false;
  }
  if (types && !types.includes(category)) {
    return false;
  }
  return options.includeDeprecated || category !== "deprecated";
});
```

Pass `exportPolicy` into prime and handoff selection before quotas. Keep the final export filter as defense in depth.

- [ ] **Step 6: Preserve trust metadata when adding and applying memory**

Extend `AddMemoryOptions` and `addMemoryUnlocked` to write the new fields. When applying a proposal, pass through `confidence`, `last_verified_at`, and `supersedes`.

Mark explicit log arrays and prefixed notes with `origin: "explicit"`, `confidence: "verified"`. Mark result-derived incidents and normative-next-step decisions with `origin: "inferred"`, `confidence: "unverified"`.

- [ ] **Step 7: Require review for inferred proposals**

Add `applyInferredMemory?: boolean` to `FinishWorkOptions`. After proposal creation, compute:

```ts
const hasInferredMemory = memoryProposal.proposal.items.some(
  (item) => item.origin === "inferred"
);
```

Leave the proposal pending when `options.memoryReview` is true or when inferred items exist and `applyInferredMemory` is false. Emit the exact warning from Step 2.

Add the Commander option:

```ts
.option(
  "--apply-inferred-memory",
  "Apply result/next-step memory inferred by deterministic heuristics."
)
```

- [ ] **Step 8: Verify GREEN and compatibility**

Run:

```bash
npm test -- tests/memory.test.ts tests/prime.test.ts tests/persistent-worker.test.ts tests/compatibility-contract.test.ts --reporter=verbose
npm run build
```

Expected: all targeted tests pass and legacy fixtures parse with verified/default metadata.

- [ ] **Step 9: Commit**

```bash
git add src/schemas/memory.ts src/schemas/memoryProposal.ts src/core/memory.ts src/core/memoryProposal.ts src/core/prime.ts src/core/handoff.ts src/core/workflow.ts src/commands/finish.ts tests/memory.test.ts tests/prime.test.ts tests/persistent-worker.test.ts tests/compatibility-contract.test.ts
git commit -m "fix: isolate and qualify persistent memory"
```

---

### Task 4: Fail eval automation and include declared runtime drift in strict readiness

**Files:**
- Create: `src/core/runtimeDoctor.ts`
- Modify: `src/core/config.ts`
- Modify: `src/core/codexPlugin.ts`
- Modify: `src/core/strictDoctor.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `src/commands/eval.ts`
- Modify: `tests/config.test.ts`
- Modify: `tests/codex-plugin.test.ts`
- Modify: `tests/strict-observability.test.ts`
- Modify: `tests/cli-workflow.test.ts`

**Interfaces:**
- Adds config field `integrations.codex_plugin: boolean`, default `false`.
- Produces `runRuntimeDoctor({ cwd }): Promise<RuntimeDoctorResult>`.
- Installing the local Codex plugin declares `codex_plugin: true` in config.
- Strict doctor adds source `runtime` and treats runtime warnings as not release-ready.
- Failed `briefops eval run` sets process exit code 1 after writing results.

- [ ] **Step 1: Write a failing CLI eval-status test**

In a temporary CLI workspace, create a skill, project, and eval case whose expected phrase is absent. Run `eval run` and assert:

```ts
expect(result.code).toBe(1);
expect(result.stdout).toContain("1 failed");
expect(result.stderr).toContain("Saved eval result:");
```

- [ ] **Step 2: Write failing runtime-readiness tests**

Install the plugin in a temporary workspace, delete one generated skill, run strict doctor, and assert:

```ts
expect(result.releaseReady).toBe(false);
expect(result.checks.find((check) => check.source === "runtime")?.status).toBe("warn");
```

Also assert that a plain runtime-agnostic `initWorkspace` with the default `codex_plugin: false` remains release-ready.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- tests/cli-workflow.test.ts tests/config.test.ts tests/codex-plugin.test.ts tests/strict-observability.test.ts --reporter=verbose
```

Expected: failed eval exits 0 and strict doctor has no runtime source.

- [ ] **Step 4: Add the integration declaration**

Extend the raw and normalized config schemas with:

```ts
integrations: z.object({
  codex_plugin: z.boolean().default(false)
}).default({ codex_plugin: false })
```

and the normalized type:

```ts
integrations: {
  codex_plugin: boolean;
};
```

When `installCodexPlugin` finishes writing files, read the config and write it back with:

```ts
integrations: {
  ...config.integrations,
  codex_plugin: true
}
```

- [ ] **Step 5: Implement runtime doctor**

Create `src/core/runtimeDoctor.ts` with result types matching other doctors. If `codex_plugin` is false, return one ok check named `Codex plugin` with detail `Codex plugin integration is not declared.` If true, call `inspectCodexPlugin` and return:

```ts
{
  name: "Codex plugin",
  status: inspection.ok ? "ok" : "warn",
  detail: inspection.ok
    ? "Installed plugin matches generated assets."
    : inspection.files
        .filter((file) => file.status !== "ok")
        .map((file) => `${file.relativePath}: ${file.status}`)
        .join("; ")
}
```

Bound the detail to the first five changed/missing files and add a count suffix when more exist.

- [ ] **Step 6: Integrate runtime doctor and CLI output**

Add `runtime` to `StrictDoctorCheck.source`, call `runRuntimeDoctor` in `runStrictDoctor`, and append its checks. Add a `--runtime` option to `briefops doctor` that prints the same check table and exits 1 only when runtime doctor reports a hard failure; drift remains a strict-readiness warning.

- [ ] **Step 7: Make eval failures fail automation**

After printing and saving the eval summary, add:

```ts
if (summary.failed > 0) {
  process.exitCode = 1;
}
```

- [ ] **Step 8: Verify GREEN**

Run:

```bash
npm test -- tests/cli-workflow.test.ts tests/config.test.ts tests/codex-plugin.test.ts tests/strict-observability.test.ts --reporter=verbose
npm run build
npm test -- --reporter=dot
```

Expected: targeted and full suites pass; failed eval subprocesses exit 1; declared plugin drift makes strict release readiness false.

- [ ] **Step 9: Commit**

```bash
git add src/core/runtimeDoctor.ts src/core/config.ts src/core/codexPlugin.ts src/core/strictDoctor.ts src/commands/doctor.ts src/commands/eval.ts tests/config.test.ts tests/codex-plugin.test.ts tests/strict-observability.test.ts tests/cli-workflow.test.ts
git commit -m "fix: gate eval and runtime readiness failures"
```

---

## Phase Completion Gate

After all four tasks and their task reviews are clean, run:

```bash
npm run build
npm test -- --reporter=dot
git diff --check main...HEAD
```

Expected:

- TypeScript build exits 0.
- Canonical tests pass without timeout overrides.
- No whitespace errors.
- Worktree contains only committed phase changes and ignored SDD artifacts.

Then request a whole-phase code review before writing the Model Contract and Harness plan.
