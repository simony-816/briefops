# BriefOps Relay Build Week Design

Status: approved at the product-direction level by the user on 2026-07-15; this repository-specific design requires final user review before implementation planning.

## Decision Summary

Build **BriefOps Relay** as an opt-in vertical slice on top of the existing BriefOps 2.2 architecture.

BriefOps Relay converts repository evidence into a task-scoped execution contract, audits the resulting Git diff against that contract, and creates a verified handoff for the next Codex session.

The selected implementation keeps the existing single-package TypeScript CLI and local `.briefops/` workspace. It adds:

1. deterministic repository and Git evidence collection;
2. two bounded GPT-5.6 Responses API operations: contract generation and diff audit;
3. strict evidence-ID validation around all model claims;
4. deterministic integrity scoring and completion gates;
5. a self-contained static HTML report instead of a hosted application;
6. one Codex plugin skill that runs the prepare → build → audit → handoff loop;
7. a seeded demo repository, reproducible evals, and a scriptable video-production path.

The implementation must not turn BriefOps into a general agent runtime, cloud service, vector database, or multi-agent orchestrator.

## 1. Repository Baseline

BriefOps 2.2 is currently a local-first Node.js 20+ TypeScript CLI with:

- a Commander command surface;
- Zod-validated YAML and Markdown workspace files;
- atomic local writes and workspace locks;
- skill, project, memory, worker, brief, handoff, and continuation workflows;
- evidence anchors on durable memory;
- deterministic checklist evals;
- a generated skill-only Codex plugin;
- privacy, stability, security, and runtime doctor checks.

The current product intentionally excludes hosted-model calls, a web dashboard, cloud synchronization, vector search, and agent execution. Relay is therefore an explicit Build Week extension, not an invisible change to existing commands.

Before implementation begins, Codex must:

1. create a derivative Build Week repository that preserves the full Git history;
2. create a `buildweek-baseline` tag at the exact parent commit before any Relay product code;
3. add `PREEXISTING.md` with an existing-versus-new capability table;
4. add `BUILD_LOG.md` and update it after every merged epic;
5. preserve the baseline tag and unsquashed feature history until judging is complete.

Because the current repository is already owned by the entrant, the derivative repository should be created as a history-preserving mirror named `briefops-relay` rather than relying on a same-owner GitHub fork operation.

## 2. Problem

Codex can implement a bounded task well, but long-running projects distribute critical context across:

- repository instructions such as `AGENTS.md`;
- product and architecture documentation;
- ADRs and specifications;
- source code and tests;
- package and runtime configuration;
- Git history;
- prior task handoffs and decisions.

During implementation, a coding agent can satisfy the visible request while violating a hidden project rule, omitting required verification, or relying on stale context. A later session then has to reconstruct both the intended contract and the state of the implementation.

Existing BriefOps solves continuity by compiling local project context, curated memory, and work history into compact briefs and handoffs. It does not currently:

- inspect arbitrary repository files as line-addressable evidence;
- generate a task-specific execution contract from that evidence;
- compare a Git diff against each contract item;
- reject unsupported model citations;
- produce a visual contract-versus-implementation audit.

Relay fills that gap.

## 3. Product Promise

> BriefOps Relay turns scattered repository evidence into an execution contract, checks whether Codex honored it, and leaves a verified handoff for the next session.

Relay is not marketed as “more context” or “agent memory.” Its value is **context integrity**:

- every contract item is tied to evidence;
- every audit verdict is tied to source, change, or validation evidence;
- unsupported evidence references invalidate the model output;
- the final score is computed by application code, not by the model;
- completion is blocked by required violations even when the numeric score is high.

## 4. Target User and Primary Job

### Primary user

A developer, technical product manager, or AI-native builder using Codex across multiple sessions on a real repository.

### Primary job

Before implementation, create an inspectable contract for one task. After implementation, determine which requirements were met, violated, or left unverified, then prepare a trustworthy next-session handoff.

### Secondary users

- open-source maintainers reviewing agent-authored changes;
- team leads coordinating several Codex worktrees;
- non-specialist builders who need a clear explanation of why a change is safe or incomplete.

## 5. Existing Versus New Capability Boundary

| Capability | Existing BriefOps 2.2 | Relay Build Week addition |
|---|---|---|
| Local `.briefops` workspace | Existing | Reused |
| Skills, projects, workers, memory | Existing | Unchanged |
| Memory evidence anchors | Existing | Reused concept, not reused as the run schema |
| Compact brief generation | Existing | Unchanged |
| Handoff and Codex resume | Existing | Reused as continuity context where appropriate |
| Codex skill-only plugin | Existing | Extended with one Relay workflow skill |
| Checklist evals | Existing | Kept unchanged; Relay gets separate seeded evals |
| Repository source scanning | Not present | New |
| Line-aware evidence pack | Not present | New |
| GPT-5.6 API use inside product | Not present | New, explicit opt-in |
| Task-scoped execution contract | Not present | New |
| Git diff evidence collection | Not present | New |
| Contract-versus-diff audit | Not present | New |
| Evidence-ID validator | Not present | New |
| Integrity score and required-item gate | Not present | New |
| Visual audit report | Not present | New static artifact |
| Offline precomputed demo | Not present | New |
| Build Week video automation | Not present | New submission tooling |

The implementation must keep this boundary visible in README, `PREEXISTING.md`, the release notes, and the demo narration.

## 6. Approaches Considered

### A. Separate monorepo with a React dashboard and service backend

This would split the CLI, API service, and UI into separate packages.

Advantages:

- conventional SaaS architecture;
- richer future collaboration features;
- independent UI deployment.

Rejected for Build Week because:

- it rewrites the repository shape under severe time constraints;
- authentication, deployment, and persistence would consume effort without strengthening the core evidence loop;
- it weakens continuity with BriefOps’ local-first design;
- it creates more failure surfaces for judging.

### B. Opt-in `briefops relay` vertical slice inside the current architecture — selected

Add Relay commands, schemas, core modules, run artifacts, one plugin skill, and a self-contained HTML report while preserving existing command behavior.

Advantages:

- reuses established CLI, storage, error, plugin, and test patterns;
- keeps all project evidence local except for explicit model calls;
- makes Build Week changes easy to attribute;
- produces a polished visual result without a new application stack;
- supports a deterministic offline demo.

Cost:

- the static report is intentionally less interactive than a full application;
- Relay must maintain a strict boundary so it does not make existing local-only workflows unexpectedly networked.

### C. Deterministic harness ledger with no hosted-model call

Implement route, goal, finding, and verification ledgers only.

Advantages:

- fully local and deterministic;
- aligned with the pre-existing roadmap;
- lowest technical risk.

Rejected as the primary Build Week direction because:

- it does not demonstrate GPT-5.6 as a meaningful product component;
- it is too close to already planned harness work;
- it does not provide the semantic contract extraction and audit experience needed for the contest story.

## 7. Product Loop

### 7.1 Prepare

The user starts from the repository state immediately before implementation:

```bash
briefops relay prepare \
  --task "Add bulk delete support to the customer API" \
  --allow-network
```

Relay:

1. verifies that the current directory is a Git repository and a BriefOps workspace;
2. resolves and records the current baseline commit;
3. scans allowed repository text files;
4. creates deterministic, line-addressable evidence entries;
5. shows a concise outgoing-data manifest;
6. calls GPT-5.6 through the Responses API;
7. validates every returned evidence ID and contract invariant;
8. saves the execution contract and run metadata;
9. prints the contract path and the next command.

The contract contains:

- task goal;
- required, important, and optional contract items;
- requirement, constraint, decision, and risk kinds;
- source evidence IDs;
- a verification description for each item;
- conflicts and blocking questions;
- confidence metadata.

### 7.2 Build

Codex reads the generated contract and implements the task. Relay does not execute the coding agent and does not modify product code during `prepare`.

The Relay Codex skill instructs Codex to:

1. treat current user and repository instructions as higher authority than generated historical context;
2. map its implementation plan to contract IDs;
3. keep changes within the task boundary;
4. run configured validation commands only with explicit permission;
5. call `briefops relay audit` after implementation;
6. resolve blocking violations and re-audit before claiming completion.

### 7.3 Audit

```bash
briefops relay audit --run latest --run-checks --allow-network
```

Relay:

1. loads the contract and baseline commit from the run;
2. collects staged, unstaged, and committed changes from the baseline to the current state;
3. creates change-evidence IDs for textual diff hunks;
4. optionally executes explicitly configured validation commands without a shell;
5. calls GPT-5.6 with the contract, source evidence, change evidence, and validation summaries;
6. validates every finding and evidence reference;
7. computes the deterministic integrity score and completion gate;
8. writes the audit artifact.

Verdicts:

- `met`: implementation and/or validation evidence supports the contract item;
- `at_risk`: implementation appears aligned but verification is insufficient or indirect;
- `violated`: the change conflicts with the contract item;
- `unverified`: available evidence cannot determine compliance.

### 7.4 Handoff

```bash
briefops relay handoff --run latest
```

Handoff generation is deterministic. It combines run metadata, the contract, audit results, Git state, and validation results into:

- completed contract items;
- unresolved violations and risks;
- exact validation commands and exit codes;
- changed files;
- baseline and current commit identifiers;
- a bounded next-session prompt.

It does not require another model call.

### 7.5 Report

```bash
briefops relay report --run latest --open
```

Relay generates one self-contained HTML file with embedded data, styles, and client-side interaction. It works from `file://` without a server or external assets.

### 7.6 Demo

```bash
briefops relay demo --open
```

The default demo uses committed precomputed artifacts and requires no API key. A live path is explicit:

```bash
briefops relay demo --live --allow-network --open
```

## 8. Command Surface

The P0 command group is:

```text
briefops relay prepare
briefops relay audit
briefops relay handoff
briefops relay report
briefops relay demo
```

### `relay prepare`

Required:

- `--task <text>`
- `--allow-network` for live model use

Optional:

- `--model <model>`; default `gpt-5.6`
- `--include <path>`; repeatable explicit path addition
- `--exclude <glob>`; repeatable additional exclusion
- `--max-files <count>`
- `--max-bytes <count>`
- `--base <ref>`; defaults to current `HEAD`
- `--dry-run`; writes only the evidence manifest and performs no network call
- `--force`; only for replacing the output of the same run target when explicitly chosen

### `relay audit`

Required:

- `--run <id|latest>`
- `--allow-network` for live model use

Optional:

- `--head <ref>`; defaults to the current worktree state
- `--run-checks`; executes configured structured commands
- `--model <model>`
- `--force`

### `relay handoff`

Required:

- `--run <id|latest>`

Optional:

- `--output <path>`
- `--force`

### `relay report`

Required:

- `--run <id|latest>`

Optional:

- `--output <path>`
- `--open`
- `--force`

### `relay demo`

Optional:

- `--live`
- `--allow-network`
- `--open`
- `--keep-worktree`

A Relay-specific eval runner may be exposed as `briefops relay eval` after the main loop is stable. It is P1; the P0 evaluation can run through an internal script and test fixtures.

## 9. Architecture

```text
Codex plugin skill / CLI user
            │
            ▼
     src/commands/relay.ts
            │
            ▼
   src/core/relayWorkflow.ts
       ┌────┼──────────────┐
       │    │              │
       ▼    ▼              ▼
 Evidence  Git diff     Validation
 collector collector    runner
       │    │              │
       └────┴──────┬───────┘
                   ▼
          OpenAI Responses adapter
       contract builder / auditor
                   │
                   ▼
          deterministic validators
      evidence IDs / schemas / score
                   │
          ┌────────┴────────┐
          ▼                 ▼
       run files       static HTML report
```

### Architectural boundaries

1. `relayWorkflow.ts` orchestrates; it does not implement scanning, model calls, or rendering.
2. Evidence collection is deterministic and testable without an API key.
3. The OpenAI adapter is behind an interface and is replaceable with fixture responses in tests.
4. Model output is never written as accepted product state until schema and evidence validation pass.
5. Scoring is a pure function.
6. Report generation consumes accepted JSON artifacts only.
7. Existing BriefOps memory, brief, handoff, and plugin behavior remains unchanged unless explicitly reused.

## 10. Run Storage

Relay uses a separate additive subtree and does not change the workspace schema version:

```text
.briefops/
└── relay/
    ├── config.yaml
    ├── cache/
    └── runs/
        └── relay_20260715_120000_abc123/
            ├── run.json
            ├── manifest.json
            ├── evidence.json
            ├── contract.json
            ├── diff-evidence.json
            ├── validations.json
            ├── audit.json
            ├── handoff.md
            └── report.html
```

### Canonical versus generated state

- `run.json`, `manifest.json`, `evidence.json`, `contract.json`, `diff-evidence.json`, `validations.json`, and `audit.json` are canonical run records.
- `handoff.md` and `report.html` are reproducible generated artifacts.
- Cache entries are disposable.
- API keys, authorization headers, and full HTTP logs are never stored.

### Relay config

`.briefops/relay/config.yaml` is separate from `.briefops/config.yaml` to avoid changing the established workspace contract during Build Week.

Example:

```yaml
version: 1
model: gpt-5.6
limits:
  max_files: 40
  max_total_bytes: 220000
  max_file_bytes: 40000
  max_chunk_bytes: 8000
validation_commands:
  - id: typecheck
    command: npm
    args: [run, build]
  - id: test
    command: npm
    args: [test]
```

Commands are represented as an executable plus argument array. Relay must use `spawn` with `shell: false`.

## 11. Data Model

All schemas live in `src/schemas/relay.ts` and are validated with Zod.

### Evidence reference

```ts
type RelayEvidence = {
  id: string;
  kind: "source" | "change" | "validation";
  source_type: "repository-file" | "git-diff" | "git-metadata" | "command-result";
  path?: string;
  start_line?: number;
  end_line?: number;
  base_sha?: string;
  head_sha?: string;
  command_id?: string;
  content_hash: string;
  content: string;
  truncated: boolean;
};
```

Evidence IDs are deterministic:

```text
<kind-prefix>_<first 16 hex characters of sha256(canonical identity + content hash)>
```

Prefixes:

- `src_` for repository source evidence;
- `chg_` for Git diff evidence;
- `val_` for validation evidence.

The canonical identity includes normalized repository-relative path, line range, source type, and content hash. Paths are always POSIX-style repository-relative strings in stored artifacts.

### Contract item

```ts
type ContractItem = {
  id: string;
  kind: "requirement" | "constraint" | "decision" | "risk";
  priority: "required" | "important" | "optional";
  statement: string;
  rationale: string;
  evidence_ids: string[];
  verification: {
    method: "code" | "test" | "command" | "manual";
    description: string;
  };
  confidence: "high" | "medium" | "low";
};
```

Accepted contract IDs are normalized after model output into stable display IDs `C-001`, `C-002`, and so on, sorted by priority, kind, and statement. The original model order is retained only as provenance.

### Execution contract

```ts
type ExecutionContract = {
  schema_version: 1;
  task: string;
  goal: string;
  items: ContractItem[];
  conflicts: Array<{
    evidence_ids: string[];
    explanation: string;
  }>;
  blocking_questions: Array<{
    question: string;
    evidence_ids: string[];
  }>;
  generated_at: string;
  model: string;
  response_id?: string;
  prompt_version: string;
};
```

### Audit finding

```ts
type AuditFinding = {
  contract_id: string;
  verdict: "met" | "at_risk" | "violated" | "unverified";
  severity: "blocking" | "major" | "minor" | "info";
  evidence_ids: string[];
  explanation: string;
  recommended_action: string;
  confidence: "high" | "medium" | "low";
};
```

### Audit report

```ts
type AuditReport = {
  schema_version: 1;
  run_id: string;
  findings: AuditFinding[];
  integrity_score: number;
  completion_gate: "pass" | "fail";
  gate_reasons: string[];
  generated_at: string;
  model: string;
  response_id?: string;
  prompt_version: string;
};
```

### Run metadata

The run records:

- run ID and timestamps;
- task;
- repository root hash, not an absolute path;
- baseline SHA;
- current HEAD SHA and dirty state;
- selected model;
- prompt versions;
- evidence counts and byte counts;
- included and excluded paths;
- network permission state;
- API response IDs, latency, and token usage when available;
- artifact hashes;
- tool version.

Absolute local paths are not included in shareable report output.

## 12. Evidence Collection

### 12.1 Repository preflight

Relay verifies:

- the root is inside a Git worktree;
- the root is not a bare repository;
- the baseline ref resolves to a commit;
- no selected path escapes the repository root;
- selected files are regular text files;
- the byte and file limits are respected.

### 12.2 Default exclusions

Always excluded unless a future version introduces a separately reviewed mechanism:

- `.git/**`;
- `.briefops/**`;
- `.env`, `.env.*`, credential and key files;
- `node_modules/**`;
- build and coverage output;
- binary files;
- files above the configured maximum;
- files ignored by Git;
- paths in `.briefopsignore`;
- obvious secret-bearing filenames.

P0 does **not** send existing private BriefOps memory or logs to the model. Integrating curated BriefOps context is P1 and must remain explicit.

### 12.3 Always-considered high-priority sources

- nearest applicable `AGENTS.md` files;
- `README.md`;
- package manifests and TypeScript configuration;
- `docs/adr/**`, `docs/specs/**`, and `docs/superpowers/specs/**`;
- test files;
- files explicitly named in the task;
- files supplied with `--include`.

### 12.4 Candidate ranking

Selection is deterministic. It combines:

- exact path or filename mentions in the task;
- keyword overlap between task and path/content;
- source-class priority;
- recent Git touches;
- relationship between source and test filenames;
- explicit include priority.

The model is not asked to perform open-ended repository browsing in P0.

### 12.5 Chunking

- text is normalized to LF for hashing while original line numbering is retained;
- chunks align to line boundaries;
- Markdown headings and code declarations are preferred boundaries;
- every chunk stores exact start and end lines;
- oversized lines are truncated with an explicit marker;
- adjacent selected chunks may be merged when the combined size is within the limit;
- duplicate content hashes are deduplicated while all locations remain discoverable.

### 12.6 Outgoing-data manifest

Before a live call, Relay prints and stores:

- file count;
- evidence count;
- total bytes;
- included paths;
- excluded-path counts by reason;
- whether any file was truncated;
- model and `store: false` state.

`--dry-run` stops after this artifact.

## 13. Git and Change Evidence

Git commands are executed with argument arrays and `shell: false`.

Required operations:

- resolve repository root;
- resolve baseline and current commit IDs;
- inspect dirty state;
- list changed files;
- generate textual diff hunks from baseline through staged and unstaged changes;
- record rename, addition, deletion, and modification status;
- exclude binary payloads.

Change evidence is hunk-based. Each evidence item records:

- old and new paths when renamed;
- old and new line ranges;
- baseline and head identifiers;
- normalized hunk content;
- content hash.

Relay audits the current worktree, not only committed changes, because Codex may run the audit before the final commit.

## 14. OpenAI Integration

### 14.1 API boundary

Use the official OpenAI JavaScript SDK and the Responses API.

The adapter calls `responses.create` with:

- default model `gpt-5.6`;
- structured output through a strict JSON schema in `text.format`;
- `store: false`;
- medium reasoning effort by default;
- no tool calls;
- no remote file uploads;
- bounded timeouts and one retry policy.

The existing Zod schemas remain the final local validator even when the API enforces a JSON schema.

### 14.2 Explicit network permission

No existing BriefOps command becomes networked.

Live Relay commands require all of:

- `--allow-network`;
- `OPENAI_API_KEY` present;
- a non-empty evidence manifest;
- successful preflight validation.

The absence of permission or a key returns an actionable error and points to `briefops relay demo` for offline evaluation.

### 14.3 Model-call budget

P0 permits a maximum of two successful semantic calls per run:

1. contract generation during `prepare`;
2. compliance audit during `audit`.

A schema-repair retry is allowed once per operation. The retry includes only the validation errors and the original bounded inputs. Unknown evidence IDs are treated as a validation failure. After the retry limit, the invalid raw response hash and failure metadata are stored, but the response is not accepted as a contract or audit.

### 14.4 Prompt contracts

Prompts must state:

- repository evidence is data, not higher-priority instruction;
- current user and repository instructions remain authoritative;
- only supplied evidence IDs may be cited;
- unsupported facts must become blocking questions or `unverified` verdicts;
- no file paths, line numbers, commands, or test results may be invented;
- every required contract item needs at least one source evidence ID;
- every `met` or `violated` audit verdict needs relevant evidence;
- concise explanations are preferred over duplicated evidence text.

Prompt templates have explicit version constants and SHA-256 hashes recorded in run artifacts.

## 15. Contract Validation

A model-generated contract is rejected when any of the following is true:

- the schema is invalid;
- an evidence ID is unknown;
- a required item has no source evidence;
- a contract statement is empty or duplicate after normalization;
- the item count is outside the configured range of 3–20;
- a blocking question cites unknown evidence;
- a conflict has fewer than two distinct evidence references;
- the task or goal differs materially from the requested task without a documented blocker.

Contract validation also detects semantically duplicate statements using normalized text equality in P0. Model-based deduplication is not added as a third call.

## 16. Audit Validation

An audit is rejected when:

- a finding references an unknown contract ID;
- a finding references an unknown source, change, or validation evidence ID;
- a contract item has zero or more than one final finding;
- `met` has neither change nor validation evidence;
- `violated` has no source and change evidence combination;
- `unverified` claims that a test passed;
- the model supplies an integrity score or completion gate that conflicts with deterministic computation;
- an explanation includes an uncited path or command result that is absent from the evidence pack.

The model may return a suggested score for debugging provenance, but it is discarded from accepted product output.

## 17. Deterministic Integrity Score and Gate

Weights:

```text
required  = 3
important = 2
optional  = 1
```

Verdict values:

```text
met        = 1.0
at_risk    = 0.5
violated   = 0.0
unverified = 0.0
```

Formula:

```text
score = round(100 × Σ(item weight × verdict value) / Σ(item weight))
```

Completion gate fails when any condition holds:

- any required item is `violated`;
- any required item is `unverified`;
- a blocking question remains unresolved;
- a configured required validation command failed or did not run;
- the audit response failed evidence validation;
- repository state cannot be related to the stored baseline.

A score of 100 is insufficient by itself if a gate condition fails.

## 18. Validation Commands

Relay runs no arbitrary command by default.

When the user passes `--run-checks`, it loads structured commands from Relay config and:

- verifies the executable and argument array;
- rejects shell metacharacter interpretation by using `shell: false`;
- runs from the repository root or an explicit contained subdirectory;
- enforces a per-command timeout;
- captures exit code, duration, bounded stdout, and bounded stderr;
- redacts secret-like values;
- writes a validation evidence artifact;
- continues through all configured checks unless the process cannot start.

The full raw output stays local. The shareable report contains bounded summaries.

## 19. Static Report UX

The report is designed for a 1440×900 demo viewport and remains usable on a laptop-width screen.

### 19.1 Header

Displays:

- task;
- integrity score;
- completion gate;
- baseline and current short SHAs;
- counts of met, at-risk, violated, and unverified items;
- validation status;
- model and prompt version.

### 19.2 Contract section

Each contract card displays:

- contract ID;
- priority and kind;
- statement;
- verdict;
- verification method;
- source-evidence count.

### 19.3 Findings section

Blocking and major findings appear first. Each finding includes:

- verdict and severity;
- explanation;
- recommended action;
- source/change/validation evidence chips.

### 19.4 Evidence drawer

Selecting an evidence chip opens a side panel showing:

- repository-relative path;
- line or diff range;
- source type;
- content hash prefix;
- bounded source content;
- baseline/head metadata where relevant.

### 19.5 Timeline and validation

A compact timeline shows:

- prepared;
- contract accepted;
- changes audited;
- checks executed;
- handoff generated.

Validation rows show command ID, duration, exit code, and summary.

### 19.6 Accessibility and portability

- status is communicated with text and icons, not color alone;
- controls are keyboard reachable;
- motion is unnecessary;
- content remains legible when printed to PDF;
- no external fonts, analytics, scripts, or network assets are loaded;
- the report contains no absolute local paths or API credentials.

## 20. Codex Plugin Extension

Extend the generated plugin with one skill:

```text
skills/briefops-relay-task/SKILL.md
```

The skill triggers only when:

- the user explicitly asks for Relay; or
- the repository has a Relay run/config and the task requires contract/audit discipline.

It must not replace the existing route, prime, finish, review-memory, or continue-worker skills.

Workflow:

1. check `command -v briefops`;
2. inspect or create a Relay contract before implementation;
3. read contract IDs and blockers;
4. implement with a contract-to-plan mapping;
5. run configured checks only with explicit permission;
6. run audit;
7. resolve blocking findings;
8. generate handoff and report;
9. report exact verification evidence.

Update the generator and committed plugin copy together. Existing plugin drift tests must continue to pass.

## 21. Demo Fixture

Create a small, self-contained TypeScript customer API fixture under:

```text
examples/relay-demo/
├── fixture/
├── scenario.json
├── seed.patch
├── expected.json
└── README.md
```

The baseline fixture contains:

- an ADR requiring every public API error to include `requestId`;
- a response helper that correctly creates problem details;
- tests for existing endpoints;
- a task asking for bulk customer deletion.

The seeded patch intentionally:

- adds the bulk-delete route;
- returns one error response without `requestId`;
- bypasses the shared response helper;
- omits an authorization test;
- implements the successful deletion path correctly.

Expected contract/audit outcomes include:

- success behavior: `met`;
- request ID requirement: `violated`;
- shared error helper constraint: `violated` or `at_risk` according to exact patch;
- authorization coverage: `unverified` or `violated` according to the contract wording;
- existing response compatibility: `met` when test evidence supports it.

### Demo execution

`briefops relay demo`:

1. copies the fixture to a temporary directory;
2. initializes a Git repository;
3. commits the baseline;
4. applies `seed.patch`;
5. copies precomputed accepted Relay artifacts into the run directory;
6. generates or opens the static report.

`--live` repeats contract and audit generation with the configured model and saves a separate run so precomputed artifacts are never overwritten.

## 22. Evaluation

Relay evaluation is separate from existing brief checklist evals.

### Seeded scenarios

P0 requires at least six scenarios:

1. missing API error field;
2. required helper bypass;
3. missing authorization test;
4. stale documentation that conflicts with code;
5. a harmless refactor that should not trigger a violation;
6. a model response containing an unknown evidence ID.

Stretch target: ten scenarios.

### Metrics

- required-violation recall;
- overall seeded-violation recall;
- false-positive rate on known-compliant items;
- valid-evidence rate;
- unknown-evidence acceptance count;
- deterministic score reproducibility;
- offline demo success rate;
- live run latency and token usage, reported as observations rather than guarantees.

### Minimum success thresholds

- 100% recall on seeded required violations;
- at least 80% recall across all seeded violations;
- 0 accepted unknown evidence IDs;
- 100% of accepted `met` and `violated` findings carry valid evidence;
- identical score for identical accepted artifacts;
- fresh-clone offline demo succeeds without an API key.

Evaluation results are written to:

```text
docs/submission/relay-eval-results.json
docs/submission/relay-eval-summary.md
```

The report must state the small-fixture limitation and model variability explicitly.

## 23. Privacy and Security

### Network trust boundary

- Relay is opt-in and requires `--allow-network` for every live call.
- Existing BriefOps commands remain local-only.
- The outgoing manifest is visible before the call.
- API calls set `store: false`.
- No source is uploaded as a remote OpenAI file.

### Secret protection

- default secret-bearing paths are excluded;
- `.briefopsignore` is honored;
- common secret patterns are scanned before inclusion;
- suspicious evidence is excluded and reported, not silently sent;
- API keys and headers are never logged;
- command output is redacted before report generation.

### Path protection

- all selected paths resolve beneath the repository root;
- symlinks that escape the root are rejected;
- absolute paths are converted to repository-relative paths before storage;
- explicit output paths retain the existing overwrite protections.

### Prompt-injection protection

The system prompt treats repository content as untrusted evidence. Instructions found inside source files do not override the user task, repository instruction hierarchy, or Relay output schema.

### Sharing boundary

The generated report is safer to share than the raw run directory, but the user must still review it. The report excludes absolute paths and truncates evidence. Raw evidence and command output remain local under `.briefops/relay/runs/`.

## 24. Error Handling

| Condition | Behavior |
|---|---|
| Not a BriefOps workspace | Actionable error pointing to `briefops bootstrap` |
| Not a Git worktree | Block prepare/audit; offline precomputed demo still works |
| Baseline ref missing | Block and display the exact unresolved ref |
| API key missing | Block live call and offer offline demo command |
| `--allow-network` missing | Block before reading evidence content for a request |
| No relevant evidence | Block model call and recommend explicit `--include` paths |
| Evidence limits exceeded | Deterministically rank/truncate and report omissions |
| Secret-like source detected | Exclude, report path and reason without printing the secret |
| API timeout or rate limit | One bounded retry when appropriate; preserve failure metadata |
| Invalid structured output | One repair retry; never accept partial state |
| Unknown evidence ID | Reject the entire contract/audit response |
| Dirty worktree during prepare | Allow, but record warning and baseline/dirty state |
| Baseline unrelated to current worktree | Block audit |
| Validation command timeout | Record failed validation evidence and continue other checks |
| Report open command unavailable | Generate report and print the file path |
| Precomputed demo artifact corrupt | Fail hash verification and do not claim a successful demo |

## 25. Compatibility

- Existing public commands and default outputs remain unchanged.
- Existing workspace schema `1.0.0` remains readable.
- Relay state is additive under `.briefops/relay/`.
- Existing `.briefops/` privacy and gitignore rules cover Relay raw artifacts.
- Existing plugin skills remain available and unchanged in purpose.
- Existing eval files and commands continue to use their current schemas.
- Node.js `>=20` remains the runtime requirement.
- The `openai` package is the only required new production dependency unless implementation evidence demonstrates a smaller safe alternative.
- The static report requires no runtime frontend dependency.

## 26. File-Level Change Map

### New product files

```text
src/commands/relay.ts
src/schemas/relay.ts
src/core/relayPaths.ts
src/core/relayConfig.ts
src/core/relayEvidence.ts
src/core/relayGit.ts
src/core/relayOpenAI.ts
src/core/relayContract.ts
src/core/relayAudit.ts
src/core/relayScore.ts
src/core/relayValidation.ts
src/core/relayReport.ts
src/core/relayHandoff.ts
src/core/relayDemo.ts
src/core/relayWorkflow.ts
```

### Existing product files to modify

```text
src/cli.ts
src/core/codexPlugin.ts
package.json
package-lock.json
CHANGELOG.md
README.md
```

`src/core/paths.ts` should remain unchanged if `relayPaths.ts` can own the additive subtree cleanly. Modify it only when reuse materially reduces duplication without expanding the public workspace contract.

### New tests

```text
tests/relay-schema.test.ts
tests/relay-evidence.test.ts
tests/relay-git.test.ts
tests/relay-contract.test.ts
tests/relay-audit.test.ts
tests/relay-score.test.ts
tests/relay-validation.test.ts
tests/relay-report.test.ts
tests/relay-workflow.test.ts
tests/relay-cli.test.ts
tests/relay-demo.test.ts
```

Existing `tests/codex-plugin.test.ts` and CLI workflow tests must be extended rather than duplicated for plugin synchronization and top-level command registration.

### New plugin file

```text
plugins/briefops-codex/skills/briefops-relay-task/SKILL.md
```

### New demo, submission, and operations files

```text
AGENTS.md
PREEXISTING.md
BUILD_LOG.md
docs/relay/quickstart.md
docs/relay/privacy.md
docs/relay/file-format.md
docs/submission/CODEX_USAGE.md
docs/submission/relay-eval-results.json
docs/submission/relay-eval-summary.md
docs/submission/devpost-copy.md
examples/relay-demo/**
scripts/relay-eval.ts
scripts/video/storyboard.yaml
scripts/video/narration.md
scripts/video/captions.srt
scripts/video/reset-demo.sh
scripts/video/compose.sh
scripts/video/verify.sh
```

Video tooling must remain outside the published npm `files` list unless it is intentionally required by users.

## 27. Test Strategy

### Unit tests

- evidence ID stability;
- line-range correctness;
- canonical path normalization;
- ignore and secret rules;
- byte and file limits;
- contract and audit schema validation;
- unknown-evidence rejection;
- score and gate computation;
- report escaping and private-path omission;
- structured command validation.

### Integration tests

Use temporary Git repositories to verify:

- prepare baseline resolution;
- committed, staged, and unstaged diff collection;
- renames and deletions;
- model-adapter fixture responses;
- contract artifact creation;
- audit artifact creation;
- failed validations;
- handoff and report reproduction.

### CLI tests

- all five P0 subcommands;
- live commands fail safely without permission or API key;
- demo works offline;
- explicit output overwrite protection;
- nonzero exit codes on blocking validation failures;
- useful next-command output.

### Plugin tests

- generated and committed plugin files match;
- Relay skill is installed;
- existing skills remain in order and retain their content;
- local drift is detected.

### Privacy tests

Sentinel values placed in `.env`, `.briefops`, ignored paths, and command output must never appear in the outgoing request fixture or shareable report.

### Live smoke test

A network test is opt-in through an environment flag. It verifies one small contract and audit response against GPT-5.6 but is excluded from the normal unit test suite and never blocks offline development due to account availability.

### Release gates

P0 must pass:

```bash
npm run build
npm test
npm run verify:release
npm pack --dry-run
```

Add a single Build Week convenience command only after individual commands are stable:

```bash
npm run verify:relay
```

It must not hide which constituent step failed.

## 28. Delivery Phases

### Phase 0 — Repository and evidence boundary

- derivative repository and baseline tag;
- `PREEXISTING.md`, `BUILD_LOG.md`, and root `AGENTS.md`;
- Relay schemas and paths;
- evidence collector and Git adapter;
- secret and path tests.

Exit criterion: a dry run creates a stable, reviewable evidence manifest with no network access.

### Phase 1 — Contract generation

- OpenAI adapter;
- structured-output prompt;
- contract validator;
- `relay prepare` CLI;
- accepted and adversarial fixture responses.

Exit criterion: a small fixture produces a valid evidence-backed contract and rejects an invented evidence ID.

### Phase 2 — Audit and score

- diff collector;
- validation runner;
- audit prompt and validator;
- deterministic score and gate;
- `relay audit` CLI.

Exit criterion: the seeded patch produces the expected blocking findings and score.

### Phase 3 — Handoff, report, and plugin

- deterministic handoff;
- self-contained HTML report;
- `handoff`, `report`, and `demo` commands;
- Relay Codex skill and plugin synchronization.

Exit criterion: an offline demo opens the report and the fresh plugin install contains the Relay skill.

### Phase 4 — Evaluation and packaging

- six or more seeded scenarios;
- evaluation script and results;
- README and Relay docs;
- fresh-clone and packed-tarball tests;
- release candidate.

Exit criterion: all P0 thresholds and release gates pass.

### Phase 5 — Video and submission

- freeze product behavior;
- record deterministic demo scenes;
- generate narration and captions;
- compose and verify a sub-three-minute video;
- complete Devpost copy and Codex session evidence.

Exit criterion: repository, public video, testing instructions, and submission form are complete before the internal deadline.

## 29. Schedule and Cut Rules

All times are Korea Standard Time.

### Target schedule

- July 15: repository-specific design approval, derivative repository, baseline evidence.
- July 16: dry-run evidence manifest and contract generation.
- July 17: diff audit, score, and handoff.
- July 18: static report, Codex skill, offline demo.
- July 19: seeded evals, packaging, README, first video cut.
- July 20 at 18:00: feature freeze.
- July 21: clean-install verification, final video, submission.

### Mandatory cut rules

If contract generation is not reliable by July 16 at 18:00:

- limit P0 to the seeded fixture and explicitly included paths;
- remove automatic candidate ranking beyond high-priority sources;
- retain evidence validation.

If audit is not reliable by July 17 at 23:59:

- remove semantic interpretation of raw command output;
- audit contract, diff, and exit-code summaries only;
- retain required-item gating.

If the report is not stable by July 18 at 18:00:

- reduce it to one HTML page with no drawer animation;
- keep summary, contract, findings, and evidence details;
- remove run history and comparisons.

If packaging is not stable by July 19 at 23:59:

- do not publish a new npm version;
- provide `npx` from the repository or a release tarball plus the offline hosted report;
- preserve exact testing instructions.

After feature freeze:

- no new command;
- no schema redesign;
- no new integration;
- only bug, documentation, demo, and submission fixes.

## 30. Video Production Design

Target duration: 2 minutes 45 seconds to 2 minutes 58 seconds.

### Storyboard

| Time | Scene | Message |
|---:|---|---|
| 0:00–0:18 | Codex implements a visible request while an ADR rule remains hidden | Long projects fail when project context loses integrity |
| 0:18–0:30 | BriefOps Relay title and one-sentence promise | Evidence becomes an execution contract |
| 0:30–0:58 | `relay prepare` and contract report | Every item cites a real source location |
| 0:58–1:22 | Contract cards and evidence panel | Requirements, constraints, risks, and verification are inspectable |
| 1:22–1:50 | Seeded implementation and `relay audit` | Relay detects missing request ID and authorization coverage |
| 1:50–2:12 | Codex fixes the findings and re-audits | Contract-driven repair loop |
| 2:12–2:30 | Score, checks, and verified handoff | Completion is evidence-gated, not self-declared |
| 2:30–2:46 | Architecture and eval result | GPT-5.6 semantics plus deterministic validation |
| 2:46–2:55 | Closing line | “Codex remembers the task. Relay preserves the project.” |

### Production files

- storyboard is the timing source of truth;
- narration is written in English and kept near 330–360 words;
- captions are generated from the approved narration and manually checked;
- demo reset uses the committed fixture and deterministic run IDs for capture;
- browser scenes use the static report at a fixed viewport;
- terminal scenes use a fixed font size and clean environment;
- `ffmpeg` composes scenes, voiceover, captions, and simple zoom/crop transitions;
- `ffprobe` verifies duration, video stream, audio stream, resolution, and codec;
- no copyrighted music or unrelated third-party footage is used.

The recording must show the real product path. Precomputed artifacts are acceptable for the offline demo, but the narration must distinguish precomputed demonstration data from the live GPT-5.6 path.

## 31. Codex Development Operating Model

### Primary thread

Owns:

- repository audit;
- approved spec and implementation plan;
- core schemas and evidence boundary;
- OpenAI integration;
- audit and final integration;
- whole-branch review;
- primary `/feedback` session evidence.

### Worktree: report

Owns only:

- static report renderer;
- accessibility and viewport checks;
- deterministic screenshots.

### Worktree: eval-demo

Owns only:

- demo fixture;
- seeded cases;
- evaluation script and results.

### Worktree: video-submission

Starts only after feature freeze and owns:

- storyboard;
- narration and captions;
- capture/reset scripts;
- composition and verification;
- Devpost copy.

### Integration rules

- each worktree has a written acceptance checklist;
- no worktree changes core schemas without primary-thread review;
- every merge is reviewed against the contract and test evidence;
- `BUILD_LOG.md` records the commit, Codex role, human decision, and verification;
- no success claim is made without command output or visual evidence;
- history is not squashed before judging.

## 32. Acceptance Criteria

### Product

- `briefops relay prepare` creates a valid source-evidence pack and execution contract.
- `briefops relay audit` creates exactly one verdict per contract item.
- unknown evidence IDs are never accepted.
- integrity score and completion gate are deterministic.
- required violations block completion.
- `handoff` and `report` reproduce from accepted artifacts without a model call.
- offline demo works without an API key.
- live mode uses GPT-5.6 through the Responses API with explicit network permission.
- existing BriefOps commands remain local and behavior-compatible.

### Quality

- all existing tests pass;
- new unit, integration, CLI, plugin, privacy, and demo tests pass;
- fresh-clone build and offline demo pass;
- package dry run contains required Relay product assets and excludes video tooling;
- the report contains no API key, secret sentinel, or absolute local path;
- documentation accurately distinguishes pre-existing and Build Week functionality.

### Evaluation

- 100% seeded required-violation recall;
- at least 80% overall seeded-violation recall;
- zero accepted invalid evidence references;
- all accepted decisive findings cite valid evidence;
- limitations are explicit.

### Submission

- public or judge-accessible repository;
- README quickstart and supported-platform statement;
- under-three-minute public video with English narration or translation;
- Codex collaboration explanation and primary session ID;
- screenshots and hosted/offline demo artifact;
- submission completed before the internal deadline.

## 33. Non-Goals

The Build Week implementation does not include:

- authentication or user accounts;
- cloud storage or synchronization;
- multi-tenant data;
- billing;
- a GitHub App;
- automatic PR comments;
- vector search or embeddings;
- an MCP server;
- an IDE extension;
- real-time collaboration;
- an agent runtime;
- autonomous multi-agent orchestration;
- automatic execution of unstructured shell commands;
- automatic inclusion of private BriefOps memory;
- a general-purpose React dashboard;
- run-to-run analytics beyond the demo comparison;
- automatic npm publication before all release and submission gates pass.

## 34. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Relay contradicts BriefOps’ local-first identity | Explicit opt-in network flag, separate subtree, offline demo, `store: false` |
| Product appears to be a rebranded memory feature | Lead with repository evidence, execution contract, diff audit, and deterministic gate |
| Model invents citations | Deterministic evidence IDs, strict schema, local validator, whole-response rejection |
| Relevant file is omitted | High-priority sources, task/path ranking, explicit `--include`, visible omissions |
| Large repository exceeds context limits | Hard byte/file limits, line chunks, deterministic ranking, P0 fixture scope |
| Static HTML looks less polished than an app | Deliberate report layout, evidence drawer, fixed demo viewport, no setup friction |
| New dependency destabilizes release | One official SDK dependency, lockfile, adapter tests, tarball smoke test |
| Existing time-sensitive tests become flaky under load | Keep new integration tests bounded; run targeted suites before full release gate |
| API unavailable during judging | Offline precomputed demo and accepted report artifact |
| Same-owner fork cannot be created | History-preserving derivative repository created with Git and GitHub CLI |
| Video work consumes product time | Feature freeze, deterministic fixture, scripted capture and composition |
| Contest attribution is unclear | Baseline tag, `PREEXISTING.md`, `BUILD_LOG.md`, unsquashed commits, Codex usage record |

## 35. Final Product Narrative

BriefOps already helps Codex carry compact context across sessions. Relay extends that continuity into integrity:

1. repository evidence becomes a contract;
2. Codex implements against explicit contract IDs;
3. the resulting diff is audited against every item;
4. unsupported claims are rejected;
5. deterministic code computes readiness;
6. the next session receives a verified handoff.

The Build Week demo must make that loop visible in less than three minutes. A smaller, trustworthy loop is more valuable than a broader but incomplete platform.
