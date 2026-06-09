# BriefOps OSS Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move BriefOps from internal dogfood alpha to a public open-source release candidate with safe defaults, clear trust boundaries, release hygiene, and harness-friendly adoption guidance.

**Architecture:** Keep BriefOps as a local-first file-backed CLI, not an agent harness. Strengthen the product edge: deterministic context priming, human-approved memory, safe shared exports, auditable local work history, and compatibility with stronger harnesses such as LazyCodex/OmO without adopting their global-hook runtime model.

**Tech Stack:** TypeScript, Node.js >=20, Commander, YAML, Zod, Vitest, GitHub Actions, npm package distribution.

---

## File Structure

Create:
- `SECURITY.md` - vulnerability reporting, supported versions, local data handling policy.
- `CONTRIBUTING.md` - development setup, test matrix, branch/commit expectations.
- `CODE_OF_CONDUCT.md` - concise community conduct policy.
- `CHANGELOG.md` - release notes beginning with `0.2.0-alpha.0` and next release section.
- `docs/integrations/harnesses.md` - how to use BriefOps with LazyCodex, OmO, Codex, Claude Code, Cursor, and other harnesses.
- `docs/release-checklist.md` - human release gate checklist.
- `src/core/output.ts` - safe explicit-output write helper.
- `src/core/privacyDoctor.ts` - privacy-oriented local workspace checks.
- `tests/output-safety.test.ts` - no-overwrite behavior for explicit output paths.
- `tests/privacy-doctor.test.ts` - privacy doctor behavior.
- `.github/dependabot.yml` - dependency update signal.

Modify:
- `package.json` - add repository, bugs, homepage, keywords, and release verification script.
- `README.md` - add OSS readiness, trust boundary, harness integration, and release status sections.
- `.github/workflows/ci.yml` - add audit/release-check steps.
- `src/commands/brief.ts` - add `--force` for explicit output overwrite.
- `src/commands/codex.ts` - add `--force` to prompt output commands and tighten plugin install messaging.
- `src/commands/continue.ts` - add `--force` for explicit output overwrite.
- `src/commands/doctor.ts` - add `--privacy` and optional `--fix-gitignore`.
- `src/commands/handoff.ts` - add `--force`.
- `src/commands/pack.ts` - add `--force`.
- `src/core/brief.ts` - use output helper for explicit output paths.
- `src/core/codex.ts` - use output helper for explicit output paths.
- `src/core/codexPlugin.ts` - plugin install should be idempotent but not silently overwrite changed generated files unless `--force`.
- `src/core/handoff.ts` - use output helper for explicit output paths and add missing lock around `saveCodexResumeFromHandoff`.
- `src/core/workflow.ts` - use output helper for explicit pack paths.
- `tests/cli-workflow.test.ts` - CLI coverage for `--force`, `doctor --privacy`, and plugin changed-file behavior.
- `tests/codex-plugin.test.ts` - plugin idempotency and changed-file safety.

---

## Task 1: OSS Trust Documents And Package Metadata

**Files:**
- Create: `SECURITY.md`
- Create: `CONTRIBUTING.md`
- Create: `CODE_OF_CONDUCT.md`
- Create: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `README.md`

- [x] **Step 1: Add `SECURITY.md`**

Create `SECURITY.md`:

```markdown
# Security Policy

BriefOps is a local-first CLI. It stores project memory, work logs, generated prompts, and plugin assets under `.briefops/` in the current repository.

## Supported Versions

| Version | Supported |
| --- | --- |
| 0.2.x alpha | Security fixes accepted |

## Reporting A Vulnerability

Please report suspected vulnerabilities through GitHub Security Advisories when available. If advisories are not enabled, open a GitHub issue with a minimal description and avoid posting secrets, private logs, or exploit payloads.

Include:

- BriefOps version
- Operating system
- Command used
- Whether `.briefops/` contains private project data
- Expected behavior
- Observed behavior

## Local Data Policy

BriefOps does not require a hosted service, MCP server, vector database, or network access.

Do not commit `.briefops/` unless you intentionally curated the contents for sharing. Use:

```bash
briefops doctor --privacy
briefops prime --export-policy shared-only
briefops pack resume --export-policy shared-only
```

before sharing generated context outside your local machine.
```

- [x] **Step 2: Add `CONTRIBUTING.md`**

Create `CONTRIBUTING.md`:

```markdown
# Contributing

Thanks for improving BriefOps.

BriefOps is intentionally small:

- local-first
- file-backed
- deterministic
- human-approved
- token-aware
- no hosted service required
- no MCP server required

## Development Setup

```bash
npm install
npm run build
npm test
```

Run the CLI during development:

```bash
npm run dev -- --help
```

## Required Checks

Before opening a pull request:

```bash
npm run build
npm test
npm pack --dry-run
```

## Safety Rules

- Never auto-approve memory proposals or skill patches.
- Do not introduce hosted services, cloud sync, vector databases, or MCP as required runtime dependencies.
- Keep private local memory out of shared exports unless it is explicitly marked `visibility: shared` and `exportable: true`.
- Prefer small deterministic file-backed changes over agent runtime behavior.

## Pull Request Style

Include:

- What changed
- Why it matters for local-first continuity
- Tests run
- Any privacy or export-policy impact
```

- [x] **Step 3: Add `CODE_OF_CONDUCT.md`**

Create `CODE_OF_CONDUCT.md`:

```markdown
# Code Of Conduct

BriefOps aims to be a practical, respectful open-source project.

We expect contributors to:

- be kind and direct
- critique code and ideas, not people
- respect privacy and local data boundaries
- avoid posting secrets, private logs, or sensitive project memory
- keep discussions focused on making BriefOps safer and more useful

Maintainers may remove comments, issues, or contributions that are abusive, harassing, spammy, or unsafe.
```

- [x] **Step 4: Add `CHANGELOG.md`**

Create `CHANGELOG.md`:

```markdown
# Changelog

## Unreleased

- Add OSS readiness hardening.

## 0.2.0-alpha.0

- Add Codex first-context workflow.
- Add local Codex plugin bundle generation.
- Add `briefops prime` and `briefops codex prime`.
- Add default worker selection with `briefops worker use`.
- Add persistent worker finish/continue flow.
- Add human-approved memory proposal flow.
- Add shared-only export policy.
- Add `doctor --security` and stale lock cleanup.
```

- [x] **Step 5: Update `package.json` metadata**

Modify `package.json`:

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/simony-816/briefops.git"
  },
  "bugs": {
    "url": "https://github.com/simony-816/briefops/issues"
  },
  "homepage": "https://github.com/simony-816/briefops#readme",
  "keywords": [
    "codex",
    "ai-agents",
    "local-first",
    "memory",
    "context",
    "handoff",
    "developer-tools"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "dev": "tsx src/index.ts",
    "verify:release": "npm run build && npm test && npm pack --dry-run"
  }
}
```

Preserve existing fields and ordering where practical.

- [x] **Step 6: Run package metadata check**

Run:

```bash
npm run build
npm test
npm pack --dry-run
```

Expected: all pass and tarball includes `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `docs`, `plugins`, `examples`, and `dist`.

- [x] **Step 7: Commit**

```bash
git add SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md CHANGELOG.md package.json README.md
git commit -m "docs: add open-source trust documents"
```

---

## Task 2: Safe Explicit Output Writes

**Files:**
- Create: `src/core/output.ts`
- Create: `tests/output-safety.test.ts`
- Modify: `src/commands/brief.ts`
- Modify: `src/commands/codex.ts`
- Modify: `src/commands/continue.ts`
- Modify: `src/commands/handoff.ts`
- Modify: `src/commands/pack.ts`
- Modify: `src/core/brief.ts`
- Modify: `src/core/codex.ts`
- Modify: `src/core/handoff.ts`
- Modify: `src/core/workflow.ts`
- Modify: `tests/cli-workflow.test.ts`

- [x] **Step 1: Write failing tests for explicit output no-overwrite**

Create `tests/output-safety.test.ts`:

```ts
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateCodexResume } from "../src/core/codex.js";
import { generateHandoff } from "../src/core/handoff.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { readTextFile, writeTextFile } from "../src/core/storage.js";
import { createWorker } from "../src/core/worker.js";
import { packResume } from "../src/core/workflow.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seed(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({ cwd: dir, name: "risk-review" });
  await createProject({ cwd: dir, name: "atlas-q" });
  await createWorker({
    cwd: dir,
    name: "quant-reviewer",
    project: "atlas-q",
    skills: ["risk-review"]
  });
}

describe("explicit output safety", () => {
  it("does not overwrite explicit Codex resume output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "resume.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });

  it("overwrites explicit Codex resume output when force is true", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "resume.md");
      await writeTextFile(outputPath, "replace me\n");

      await generateCodexResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath,
        force: true
      });

      expect(await readTextFile(outputPath)).toContain("BriefOps Codex Resume");
    });
  });

  it("does not overwrite explicit handoff output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "handoff.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(generateHandoff({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        save: true,
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });

  it("does not overwrite explicit pack output without force", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      const outputPath = path.join(dir, "pack.md");
      await writeTextFile(outputPath, "keep me\n");

      await expect(packResume({
        cwd: dir,
        worker: "quant-reviewer",
        task: "Continue review.",
        outputPath
      })).rejects.toThrow("Output file already exists");

      expect(await readTextFile(outputPath)).toBe("keep me\n");
    });
  });
});
```

- [x] **Step 2: Run failing output safety tests**

Run:

```bash
npm test -- tests/output-safety.test.ts
```

Expected: FAIL because `force` is not yet supported and explicit outputs currently overwrite.

- [x] **Step 3: Add output helper**

Create `src/core/output.ts`:

```ts
import path from "node:path";
import { BriefOpsError } from "./errors.js";
import { pathExists, writeTextFile } from "./storage.js";

export async function writeGeneratedOutput(options: {
  defaultPath: string;
  outputPath?: string;
  content: string;
  force?: boolean;
}): Promise<string> {
  const targetPath = options.outputPath ?? options.defaultPath;
  const isExplicit = Boolean(options.outputPath);

  if (isExplicit && !options.force && await pathExists(targetPath)) {
    throw new BriefOpsError(
      `Output file already exists: ${targetPath}. Re-run with --force to overwrite.`
    );
  }

  await writeTextFile(targetPath, options.content, {
    force: !isExplicit || Boolean(options.force)
  });
  return targetPath;
}

export function resolveCliOutputPath(cwd: string, value?: string): string | undefined {
  return value ? path.resolve(cwd, value) : undefined;
}
```

- [x] **Step 4: Thread `force?: boolean` through core option types**

Add `force?: boolean` to:

```ts
// src/core/brief.ts
export type SaveGeneratedBriefOptions = {
  cwd: string;
  generated: GeneratedBrief;
  outputPath?: string;
  force?: boolean;
};

// src/core/codex.ts
export type CodexMissionOptions = { /* existing fields */ force?: boolean };
export type CodexPlanOptions = { /* existing fields */ force?: boolean };
export type CodexResumeOptions = { /* existing fields */ force?: boolean };

// src/core/handoff.ts
export type GenerateHandoffOptions = { /* existing fields */ force?: boolean };

// src/core/workflow.ts
export type ContinueWorkOptions = { /* existing fields */ force?: boolean };
export type PackResumeOptions = { /* existing fields */ force?: boolean };
```

- [x] **Step 5: Use output helper in save functions**

In `src/core/codex.ts`, replace `writeTextFile(targetPath, ..., { force: true })` inside `saveCodexPrompt()` with:

```ts
return writeGeneratedOutput({
  defaultPath: path.join(
    workspacePaths(options.cwd).codexPrompts,
    `${formatDateStamp()}-${options.kind}-${slugForFilename(options.name)}.md`
  ),
  outputPath: options.outputPath,
  content: options.content,
  force: options.force
});
```

In `src/core/handoff.ts`, use the same pattern for `saveGeneratedHandoff()` and `saveCodexResumeFromHandoff()`.

In `src/core/workflow.ts`, use the same pattern for `packResume()`.

- [x] **Step 6: Add CLI `--force` flags**

For each command with `--output`, add:

```ts
.option("--force", "Overwrite an existing explicit output file.")
```

Pass:

```ts
force: Boolean(options.force)
```

to the corresponding core call.

- [x] **Step 7: Run output tests**

Run:

```bash
npm test -- tests/output-safety.test.ts
```

Expected: PASS.

- [x] **Step 8: Run regression tests**

Run:

```bash
npm test -- tests/cli-workflow.test.ts tests/persistent-worker.test.ts
```

Expected: PASS.

- [x] **Step 9: Commit**

```bash
git add src/core/output.ts src/core src/commands tests/output-safety.test.ts tests/cli-workflow.test.ts
git commit -m "fix: protect explicit output files"
```

---

## Task 3: Privacy Doctor And Gitignore Guard

**Files:**
- Create: `src/core/privacyDoctor.ts`
- Create: `tests/privacy-doctor.test.ts`
- Modify: `src/commands/doctor.ts`
- Modify: `README.md`
- Modify: `docs/quickstart.md`

- [x] **Step 1: Write failing privacy doctor tests**

Create `tests/privacy-doctor.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addMemory } from "../src/core/memory.js";
import { runPrivacyDoctor } from "../src/core/privacyDoctor.js";
import { createProject } from "../src/core/project.js";
import { createSkill } from "../src/core/skill.js";
import { writeTextFile } from "../src/core/storage.js";
import { initWorkspace } from "../src/core/workspace.js";
import { withTempDir } from "./helpers.js";

async function seed(dir: string): Promise<void> {
  await initWorkspace(dir);
  await createSkill({ cwd: dir, name: "risk-review" });
  await createProject({ cwd: dir, name: "atlas-q" });
}

describe("privacy doctor", () => {
  it("warns when .briefops is not ignored", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.ok).toBe(true);
      expect(result.checks.find((check) => check.name === "Gitignore")?.status).toBe("warn");
    });
  });

  it("passes gitignore check when .briefops is ignored", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Gitignore")?.status).toBe("ok");
    });
  });

  it("warns on private memory marked exportable", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");
      await addMemory({
        cwd: dir,
        type: "lessons",
        project: "atlas-q",
        skill: "risk-review",
        content: "Private lesson should not be exportable.",
        visibility: "private",
        exportable: true
      });

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Private exportable memory")?.status)
        .toBe("warn");
    });
  });

  it("warns on secret-like strings in local memory", async () => {
    await withTempDir(async (dir) => {
      await seed(dir);
      await writeTextFile(`${dir}/.gitignore`, ".briefops/\n");
      await addMemory({
        cwd: dir,
        type: "facts",
        project: "atlas-q",
        skill: "risk-review",
        content: "Use API key sk-test-12345678901234567890 for local sandbox.",
        visibility: "private",
        exportable: false
      });

      const result = await runPrivacyDoctor({ cwd: dir });

      expect(result.checks.find((check) => check.name === "Secret-like local memory")?.status)
        .toBe("warn");
    });
  });
});
```

- [x] **Step 2: Run failing tests**

Run:

```bash
npm test -- tests/privacy-doctor.test.ts
```

Expected: FAIL because `runPrivacyDoctor` does not exist.

- [x] **Step 3: Implement privacy doctor**

Create `src/core/privacyDoctor.ts`:

```ts
import { promises as fs } from "node:fs";
import path from "node:path";
import { listMemory } from "./memory.js";
import { pathExists, readTextFile, writeTextFile } from "./storage.js";
import { requireWorkspace } from "./workspace.js";

export type PrivacyDoctorStatus = "ok" | "warn" | "fail";

export type PrivacyDoctorCheck = {
  name: string;
  status: PrivacyDoctorStatus;
  detail: string;
};

export type PrivacyDoctorResult = {
  ok: boolean;
  checks: PrivacyDoctorCheck[];
};

function check(name: string, status: PrivacyDoctorStatus, detail: string): PrivacyDoctorCheck {
  return { name, status, detail };
}

const secretPatterns = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bghp_[A-Za-z0-9_]{20,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\b(password|passwd|secret|token|api[_-]?key)\s*[:=]\s*\S+/i
];

async function gitignoreStatus(cwd: string): Promise<PrivacyDoctorCheck> {
  const gitignorePath = path.join(cwd, ".gitignore");
  if (!(await pathExists(gitignorePath))) {
    return check("Gitignore", "warn", ".gitignore not found; add `.briefops/` before public use.");
  }

  const raw = await readTextFile(gitignorePath);
  const ignoresBriefOps = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === ".briefops" || line === ".briefops/" || line === "/.briefops/");

  return ignoresBriefOps
    ? check("Gitignore", "ok", ".briefops is ignored.")
    : check("Gitignore", "warn", ".briefops is not ignored.");
}

export async function fixBriefOpsGitignore(cwd = process.cwd()): Promise<string> {
  const gitignorePath = path.join(cwd, ".gitignore");
  const existing = await pathExists(gitignorePath) ? await readTextFile(gitignorePath) : "";
  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  if (!lines.includes(".briefops/") && !lines.includes(".briefops") && !lines.includes("/.briefops/")) {
    const next = `${existing.trimEnd()}${existing.trim() ? "\n" : ""}.briefops/\n`;
    await writeTextFile(gitignorePath, next, { force: true });
  }
  return gitignorePath;
}

export async function runPrivacyDoctor(options: {
  cwd?: string;
} = {}): Promise<PrivacyDoctorResult> {
  const cwd = options.cwd ?? process.cwd();
  await requireWorkspace(cwd);

  const memory = await listMemory({ cwd });
  const privateExportable = memory.filter((item) => item.visibility === "private" && item.exportable);
  const secretLike = memory.filter((item) =>
    secretPatterns.some((pattern) => pattern.test(item.content))
  );

  const checks: PrivacyDoctorCheck[] = [
    await gitignoreStatus(cwd),
    privateExportable.length > 0
      ? check("Private exportable memory", "warn", `${privateExportable.length} private item(s) are exportable.`)
      : check("Private exportable memory", "ok", "No private exportable memory."),
    secretLike.length > 0
      ? check("Secret-like local memory", "warn", `${secretLike.length} memory item(s) look like secrets.`)
      : check("Secret-like local memory", "ok", "No secret-like memory found.")
  ];

  return {
    ok: checks.every((item) => item.status !== "fail"),
    checks
  };
}
```

Remove the unused `fs` import if TypeScript reports it.

- [x] **Step 4: Add CLI flags**

Modify `src/commands/doctor.ts`:

```ts
.option("--privacy", "Run privacy checks for local memory and share safety.")
.option("--fix-gitignore", "Add `.briefops/` to .gitignore when running --privacy.")
```

Behavior:

```ts
if (options.privacy) {
  if (options.fixGitignore) {
    const path = await fixBriefOpsGitignore();
    console.log(`Updated gitignore: ${path}`);
    console.log("");
  }
  const result = await runPrivacyDoctor();
  printTable([
    ["Check", "Status", "Detail"],
    ...result.checks.map((item) => [item.name, item.status, item.detail])
  ]);
  if (!result.ok) {
    process.exitCode = 1;
  }
  return;
}
```

- [x] **Step 5: Run privacy tests**

Run:

```bash
npm test -- tests/privacy-doctor.test.ts tests/cli-workflow.test.ts
```

Expected: PASS.

- [x] **Step 6: Document privacy workflow**

Add to `README.md`:

```markdown
## Privacy Check

Run this before publishing a repository, sharing a pack, or attaching BriefOps context outside your machine:

```bash
briefops doctor --privacy
briefops doctor --privacy --fix-gitignore
```

BriefOps is local-first, but `.briefops/` may contain private logs and memory. Keep `.briefops/` out of source control unless you intentionally curated the contents.
```

- [x] **Step 7: Commit**

```bash
git add src/core/privacyDoctor.ts src/commands/doctor.ts tests/privacy-doctor.test.ts tests/cli-workflow.test.ts README.md docs/quickstart.md
git commit -m "feat: add privacy doctor"
```

---

## Task 4: Plugin Trust Boundary And Idempotent Install Safety

**Files:**
- Modify: `src/core/codexPlugin.ts`
- Modify: `src/commands/codex.ts`
- Modify: `plugins/briefops-codex/README.md`
- Modify: `tests/codex-plugin.test.ts`

- [x] **Step 1: Write failing plugin changed-file test**

Add to `tests/codex-plugin.test.ts`:

```ts
it("does not overwrite changed local plugin files without force", async () => {
  await withTempDir(async (dir) => {
    await initWorkspace(dir);
    await installCodexPlugin({ cwd: dir });
    const skillPath = path.join(
      dir,
      ".briefops/codex/plugin/briefops/skills/briefops-prime-context/SKILL.md"
    );
    await writeTextFile(skillPath, "custom local edit\n", { force: true });

    await expect(installCodexPlugin({ cwd: dir })).rejects.toThrow(
      "Generated plugin file has local changes"
    );

    expect(await readTextFile(skillPath)).toBe("custom local edit\n");
  });
});

it("overwrites changed local plugin files with force", async () => {
  await withTempDir(async (dir) => {
    await initWorkspace(dir);
    await installCodexPlugin({ cwd: dir });
    const skillPath = path.join(
      dir,
      ".briefops/codex/plugin/briefops/skills/briefops-prime-context/SKILL.md"
    );
    await writeTextFile(skillPath, "custom local edit\n", { force: true });

    await installCodexPlugin({ cwd: dir, force: true });

    expect(await readTextFile(skillPath)).toContain("BriefOps Prime Context");
  });
});
```

- [x] **Step 2: Run failing plugin tests**

Run:

```bash
npm test -- tests/codex-plugin.test.ts
```

Expected: FAIL because plugin install currently overwrites generated files.

- [x] **Step 3: Make plugin install idempotent but changed-file safe**

In `src/core/codexPlugin.ts`, add:

```ts
async function writeGeneratedPluginFile(options: {
  target: string;
  content: string;
  force: boolean;
}): Promise<void> {
  if (await pathExists(options.target)) {
    const existing = await readTextFile(options.target);
    if (existing === options.content) {
      return;
    }
    if (!options.force) {
      throw new BriefOpsError(
        `Generated plugin file has local changes: ${options.target}. Re-run with --force to overwrite.`
      );
    }
  }

  await writeTextFile(options.target, options.content, { force: true });
}
```

Import `BriefOpsError`.

Replace the install loop write with:

```ts
await writeGeneratedPluginFile({
  target,
  content: file.content,
  force: Boolean(options.force)
});
```

- [x] **Step 4: Narrow plugin trust messaging**

Update generated skill text and `plugins/briefops-codex/README.md` to include:

```markdown
The BriefOps plugin is a local CLI helper. It does not require network access, does not publish to a marketplace, and should not auto-approve memory or skill patches. Use `--export-policy shared-only` before copying context outside the local workspace.
```

- [x] **Step 5: Run plugin tests**

Run:

```bash
npm test -- tests/codex-plugin.test.ts tests/cli-workflow.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add src/core/codexPlugin.ts src/commands/codex.ts plugins/briefops-codex/README.md tests/codex-plugin.test.ts
git commit -m "fix: protect generated plugin files"
```

---

## Task 5: Harness Integration Documentation

**Files:**
- Create: `docs/integrations/harnesses.md`
- Modify: `README.md`
- Modify: `examples/codex-first-context/README.md`

- [x] **Step 1: Create harness integration doc**

Create `docs/integrations/harnesses.md`:

```markdown
# Harness Integrations

BriefOps is not an agent harness. It does not run models, manage subscriptions, install hooks, expose MCP tools, or route work across agents.

BriefOps is a local memory and context ledger that a harness can read before work and update after work.

## Recommended Pattern

Before a task:

```bash
briefops prime --task "<task>" --format codex --max-tokens 800
```

After meaningful work:

```bash
briefops finish --worker <worker> --task "<task>" --result "<result>"
briefops memory proposal-show latest
briefops approve latest
```

For a fresh thread:

```bash
briefops continue --worker <worker> --task "<next task>" --pack
```

For portable or shared context:

```bash
briefops prime --task "<task>" --format codex --export-policy shared-only
briefops pack resume --worker <worker> --task "<task>" --export-policy shared-only
```

## LazyCodex / OmO

Use LazyCodex or OmO for orchestration, hooks, LSP/MCP, and autonomous execution. Use BriefOps for durable local continuity.

Suggested human workflow:

```bash
briefops prime --task "Implement the next scoped change." --format codex --max-tokens 800
codex "Use the BriefOps prime context, then run ultrawork for this task."
briefops finish --worker <worker> --task "Implement the next scoped change." --result "<verified result>"
briefops memory proposal-show latest
```

Do not let a harness auto-run `briefops approve latest`. Approval should remain human-confirmed.

## Codex App And Codex CLI

Use `briefops codex plugin install` to generate local plugin assets under `.briefops/codex/plugin/briefops`.

This command does not write to global Codex folders by default.

## Claude Code

BriefOps can coexist with `CLAUDE.md`. Keep `CLAUDE.md` for always-loaded project instructions and use BriefOps for task history, approved memory, handoffs, and shared-only packs.

## Cursor

BriefOps can coexist with Cursor rules and memories. Keep Cursor rules for editor behavior and use BriefOps for auditable cross-thread work history.
```

- [x] **Step 2: Link integration doc from README**

Add to `README.md`:

```markdown
## Harness Integrations

BriefOps works best as a local memory ledger beside stronger harnesses such as Codex, LazyCodex, OmO, Claude Code, Cursor, and OpenCode. See `docs/integrations/harnesses.md`.
```

- [x] **Step 3: Run docs packaging check**

Run:

```bash
npm pack --dry-run
```

Expected: tarball includes `docs/integrations/harnesses.md`.

- [x] **Step 4: Commit**

```bash
git add docs/integrations/harnesses.md README.md examples/codex-first-context/README.md
git commit -m "docs: explain harness integrations"
```

---

## Task 6: Release Readiness Automation

**Files:**
- Create: `docs/release-checklist.md`
- Create: `.github/dependabot.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `package.json`

- [x] **Step 1: Add release checklist**

Create `docs/release-checklist.md`:

```markdown
# Release Checklist

Before publishing BriefOps:

```bash
npm run build
npm test
npm audit --audit-level=moderate
npm pack --dry-run
briefops --help
```

Manual smoke test:

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
briefops init
briefops codex install
briefops codex plugin install
briefops skill create risk-review
briefops project create atlas-q
briefops worker create quant-reviewer --project atlas-q --skills risk-review
briefops worker use quant-reviewer
briefops prime --task "Start this task." --format codex --max-tokens 800
briefops doctor --security
briefops doctor --privacy
```

Confirm:

- `shared-only` exports omit private local memory.
- Memory and skill patches require human approval.
- Explicit output paths do not overwrite without `--force`.
- `.briefops/` is ignored or intentionally curated.
- `npm pack --dry-run` includes docs, examples, plugins, dist, README, LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, CHANGELOG.
```

- [x] **Step 2: Add Dependabot**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    open-pull-requests-limit: 5
```

- [x] **Step 3: Add CI audit**

Modify `.github/workflows/ci.yml`:

```yaml
      - name: Audit dependencies
        run: npm audit --audit-level=moderate
```

Place after `npm ci` and before build.

- [x] **Step 4: Add release verify script if not already present**

Ensure `package.json` has:

```json
"verify:release": "npm run build && npm test && npm audit --audit-level=moderate && npm pack --dry-run"
```

- [x] **Step 5: Run release verification**

Run:

```bash
npm run verify:release
```

Expected: PASS.

- [x] **Step 6: Commit**

```bash
git add docs/release-checklist.md .github/dependabot.yml .github/workflows/ci.yml package.json
git commit -m "chore: add release readiness checks"
```

---

## Task 7: Final Product Gate

**Files:**
- Modify: `README.md`
- Modify: `docs/roadmap.md`
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `package-lock.json`

- [x] **Step 1: Add release status to README**

Add:

```markdown
## Release Status

BriefOps is pre-1.0. The current release is intended for developers who want a local-first memory and context ledger for AI coding agents. The public API and file formats may change before 1.0, but the core safety principles are stable:

- local files first
- no hosted service required
- no required MCP server
- human-approved memory
- shared-only export controls
- deterministic CLI behavior
```

- [x] **Step 2: Update roadmap**

In `docs/roadmap.md`, make the next milestones:

```markdown
## Near Term

- privacy doctor
- explicit output overwrite protection
- OSS trust docs
- harness integration guide
- release readiness CI

## Later

- optional cross-harness projection
- richer eval fixtures for token savings
- curated shared-memory export bundles
- signed release artifacts
```

- [x] **Step 3: Update changelog**

Move completed items into `CHANGELOG.md`:

```markdown
## 0.2.1-alpha.0

- Add OSS trust documents.
- Add privacy doctor.
- Protect explicit output paths from accidental overwrite.
- Protect generated Codex plugin files from silent local-change overwrite.
- Add harness integration guidance.
- Add release readiness checks.
```

- [x] **Step 4: Run complete verification**

Run:

```bash
npm run verify:release
npm test -- tests/output-safety.test.ts tests/privacy-doctor.test.ts tests/codex-plugin.test.ts tests/cli-workflow.test.ts tests/safety.test.ts
git diff --check
```

Expected:

- build passes
- all tests pass
- audit passes or reports only accepted non-production dev warnings that are documented before release
- package dry-run includes expected files
- diff check has no whitespace errors

- [x] **Step 5: Manual smoke test**

Run:

```bash
tmpdir="$(mktemp -d)"
cd "$tmpdir"
node /Users/simon/Documents/briefops/dist/index.js init
node /Users/simon/Documents/briefops/dist/index.js codex install
node /Users/simon/Documents/briefops/dist/index.js codex plugin install
node /Users/simon/Documents/briefops/dist/index.js skill create risk-review
node /Users/simon/Documents/briefops/dist/index.js project create atlas-q
node /Users/simon/Documents/briefops/dist/index.js worker create quant-reviewer --project atlas-q --skills risk-review
node /Users/simon/Documents/briefops/dist/index.js worker use quant-reviewer
node /Users/simon/Documents/briefops/dist/index.js prime --task "Start this task." --format codex --max-tokens 800
node /Users/simon/Documents/briefops/dist/index.js doctor --security
node /Users/simon/Documents/briefops/dist/index.js doctor --privacy
```

Expected:

- plugin bundle path is printed
- prime output includes `Codex Operating Note`
- security doctor passes or gives actionable warnings
- privacy doctor warns if `.briefops/` is not ignored

- [x] **Step 6: Commit**

```bash
git add README.md docs/roadmap.md CHANGELOG.md package.json package-lock.json
git commit -m "docs: mark release candidate readiness"
```

---

## Completion Criteria

This plan is complete only when:

1. Explicit user output paths never overwrite existing files unless `--force` is passed.
2. Generated plugin files are idempotent and do not silently erase local edits.
3. `briefops doctor --privacy` exists and checks gitignore, private exportable memory, and secret-like memory strings.
4. OSS trust files exist: `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`.
5. CI runs build, tests, audit, and npm package dry-run.
6. Package metadata includes repository, bugs, homepage, and keywords.
7. Harness integration docs clearly position BriefOps beside LazyCodex/OmO rather than as a competing harness.
8. README clearly says BriefOps is pre-1.0 but ready for public alpha use.
9. `npm run verify:release` passes.
10. Manual smoke test passes.

---

## Self-Review

Spec coverage:
- Open-source readiness: Tasks 1, 6, 7.
- P2 overwrite issue: Task 2.
- P2 plugin trust/permission surface: Task 4.
- P3 stale/privacy local data edge: Task 3.
- BriefOps edge versus harness agents: Task 5.
- Product completion direction: Tasks 6 and 7.

Placeholder scan:
- No `TBD`, `TODO`, or “implement later” placeholders.
- Every code-changing task includes exact file paths, commands, and expected outcomes.

Type consistency:
- `force?: boolean` is consistently threaded through explicit output paths.
- `runPrivacyDoctor` returns `PrivacyDoctorResult`, matching CLI rendering.
- Plugin changed-file behavior uses existing `pathExists`, `readTextFile`, and `writeTextFile`.

---

## Execution Options

Plan complete and saved to `docs/superpowers/plans/2026-06-08-briefops-oss-readiness.md`.

1. **Subagent-Driven (recommended)** - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** - execute tasks in this session using executing-plans, with checkpoints after each task.
