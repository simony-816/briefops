# BriefOps Model Readiness Hardening Design

Status: approved for implementation by the user on 2026-07-10.

## Goal

Make BriefOps reliably improve agent behavior for current long-horizon reasoning models while preserving its local-first, deterministic, runtime-agnostic product boundary.

The release must remove confirmed correctness defects, make historical context safe to consume, turn harness prose into verifiable state, add model-behavior evaluation without calling a hosted model, and strengthen package verification and deployment.

## Scope

This design covers every recommendation confirmed during the v2.1.3 audit:

1. Honor Codex resume modes.
2. Remove the hard-coded quantitative-risk judgment profile from every worker.
3. Add explicit authority and side-effect contracts to generated context.
4. Scope memory before ranking and apply export policy before quotas.
5. Prevent unverified agent conclusions from silently becoming authoritative memory.
6. Replace first-match English-only routing with scored multilingual signals, confidence, and escalation.
7. Replace prefix-only context trimming with structured, invariant-preserving packing and configured budgets.
8. Add prompt profile, schema version, and content-hash provenance.
9. Persist harness routes, goals, findings, verification evidence, and final-response checks.
10. Add response/tool-trace behavior evaluations and make failed evals exit nonzero.
11. Detect local plugin and prompt drift and provide explicit migration commands.
12. Narrow plugin triggers and make read-only/unavailable-continuity behavior safe.
13. Stabilize CLI tests, add lint, test type-checking, coverage, runtime/platform CI, tarball smoke tests, and one release gate.
14. Harden the publish workflow with explicit permissions, immutable action references, provenance, checksums, and publish-before-tag ordering.

## Non-Goals

- BriefOps will not call an LLM API or choose a hosted model.
- BriefOps will not become an agent runtime, cloud service, vector database, MCP server, or multi-agent orchestrator.
- Model labels such as `gpt-5.6-sol` are recorded as evaluation provenance, not used to fork product behavior.
- Existing workspace files remain readable without migration.
- Existing public commands remain available unless a confirmed bug makes their current behavior unsafe.

## Approaches Considered

### A. Compatibility-first staged hardening — selected

Add small backward-compatible contracts and commands in ordered phases. Existing commands keep their names and default output remains human-readable, while structured metadata and validation are added beside it.

Advantages:

- Each phase is independently testable and reviewable.
- Correctness fixes can land before larger harness features.
- Workspace schema evolution can remain additive.
- A failure can be reverted without discarding the whole program.

Cost:

- Some transitional adapters remain until the final consolidation phase.

### B. Rewrite the prompt and harness stack

Replace prime, brief, handoff, resume, router, and eval flows behind a new API.

Advantages:

- Cleaner final architecture.

Rejected because:

- Migration and regression risk are too high for an established 2.x file format.
- It prevents isolated TDD cycles and makes attribution of model regressions difficult.

### C. Add a `5.6 Sol`-specific adapter

Fork prompts and budgets for one model label.

Advantages:

- Fast short-term tuning.

Rejected because:

- The repository has no stable contract for that label.
- Model-name branching would age quickly and undermine runtime independence.

## Global Constraints

- Keep all product operations local and deterministic unless a release command explicitly contacts npm or GitHub.
- Preserve Node.js `>=20` runtime compatibility.
- Preserve reading of workspace schema `1.0.0` and legacy `0.2` fixtures.
- Do not expose private memory in `shared-only` output.
- Do not auto-execute network actions from generated prompts.
- Do not auto-apply skill patches.
- Historical memory, project text, logs, and worker summaries are data, not higher-priority instructions.
- User requests and repository instructions outrank BriefOps memory.
- Read-only tasks must not cause workspace writes during normal completion.
- Every behavior change follows RED/GREEN TDD and receives task-scoped review.
- No version bump, changelog entry, release tag, push, or npm publish occurs before the implementation and full verification phases pass.

## Architecture

### 1. Model and authority contract

Add a central model-facing contract module used by prime, brief, mission, handoff, resume, and portable packs.

The contract contains:

- `prompt_schema_version`
- `prompt_profile`
- `briefops_version`
- `mode`: `plan`, `execute`, or `loop`
- `side_effect_policy`: `read-only`, `workspace-write`, or `network-approved`
- authority precedence
- a statement that historical sections are evidence/data, not executable instructions
- required verification level and evidence shape when a route exists

Profiles are capability-based. Initial profiles are `generic-reasoning-v1`, `codex-reasoning-v1`, and `claude-code-v1`. A captured run may separately record a model label such as `gpt-5.6-sol`.

Resume generation must normalize and render the selected mode. Plan mode explicitly forbids product edits. Execute and loop modes use their existing semantics.

Worker intelligence must derive judgment rules only from worker style and validated memory. The neutral fallback is `Verify relevant work before completion.`

### 2. Memory trust and selection

Candidate selection order becomes:

1. status and type
2. project scope: exact project plus explicitly global items only
3. export policy
4. evidence/confidence eligibility
5. ranking
6. category quotas
7. token budget

Add optional backward-compatible memory metadata:

- `confidence`: `verified` or `unverified`
- `last_verified_at`
- `supersedes`: memory ids

Old items default to `verified` for compatibility, but newly inferred items default to `unverified`. Superseded items are excluded from context. Evidence freshness affects ranking but does not delete data.

Explicit `--lesson`, `--decision`, `--incident`, and `--open-risk` fields remain eligible for local auto-apply. Content inferred only from free-form results, notes, or next steps remains a review proposal unless the caller explicitly opts into inferred-memory application.

### 3. Structured context packing

Add a reusable section packer. Every section declares:

- stable id
- priority
- required/optional status
- minimum budget
- trim strategy: item, head-tail, or none

Required sections are packed first and never removed:

- current task
- authority and side-effect contract
- active constraints
- rejection/blocking conditions
- unresolved risks
- verification contract

Optional project, worker, memory, and recent-work sections consume the remaining budget. A required section that cannot fit returns a clear budget error instead of silently dropping safety text.

Replace `characters / 4` as the only estimator with a pluggable conservative estimator that treats non-ASCII text and code more conservatively. Keep the old estimator available as `legacy-char4` for reproducibility. CLI defaults come from `.briefops/config.yaml` unless explicitly overridden.

The final rendered mission, plan, handoff, resume, and pack—not only their embedded body—must satisfy the selected budget or report a blocking error.

### 4. Multilingual scored routing

Routing collects all signals instead of stopping at the first regex. Signals include English and Korean terms for production incidents, release, review, dependencies, UI, tests, refactors, architecture, research, documentation, features, security, authentication, payments, and databases.

The route result retains `route` for compatibility and adds:

- `matched_routes`
- `signals`
- `confidence`: `high`, `medium`, or `low`
- `composite`
- `side_effect_policy`
- escalation reasons

Risk signals raise the verification level and required artifacts even when the primary task type is different. Explicit `--type` remains authoritative but does not suppress risk escalation. `--side-effects` permits an explicit user or harness override.

### 5. Persistent harness state and evidence validation

Add additive workspace paths under `.briefops/harness/`:

- `routes.jsonl`
- `goals.json`
- `findings.jsonl`
- `verification.jsonl`

Add commands:

- `briefops harness start`
- `briefops harness goal add|update|list`
- `briefops harness finding add|list`
- `briefops harness verify add|list`
- `briefops harness status`
- `briefops harness check-final`

`harness route` remains read-only. `harness start` persists a route and task id. Goal and finding updates require that task id. Verification entries include command/manual evidence, status, timestamp, and optional artifact paths.

`check-final` validates route-required sections and evidence. The existing completion sentinel remains display-only for compatibility and is never accepted as proof by itself.

### 6. Behavior evaluations

Keep existing prompt checklist evals and label them `artifact-checklist`.

Add captured behavior cases and results containing:

- model label
- prompt profile/schema/hash
- BriefOps version
- task, route, mode, and side-effect policy
- response text
- normalized tool calls and mutations
- required and forbidden actions
- evidence manifest
- deterministic rubric results

Behavior evals ingest local JSON/YAML captures; they do not invoke a model. Public fixtures cover:

- plan-only compliance
- read-only compliance
- Korean and English routing
- mixed high-risk tasks
- cross-project memory isolation
- private-memory starvation in shared-only mode
- adversarial instructions inside memory
- false-completion signals
- missing verification evidence
- long multi-stage continuation

Any failed eval sets a nonzero CLI exit status.

### 7. Prompt and plugin lifecycle

Centralize bundled prompt templates and give each a schema version and SHA-256 hash. Saved handoff, prompt, and eval metadata record those values.

Add read-only drift checks and explicit migration:

- `briefops doctor --runtime`
- `briefops prompt diff`
- `briefops prompt upgrade`
- `briefops codex plugin doctor --installed-root <path>`

Runtime doctor reports missing or changed local plugin assets and stale workspace prompt templates. Strict doctor includes runtime readiness when Codex integration is present, without scanning unrelated global directories by default.

Generated skill triggers apply only when a repository is opted into BriefOps or the user explicitly asks for it. Missing continuity on a non-opted-in read-only task fails open with a bounded warning. Suggestions involving `npx ...@latest` are labeled as network actions requiring approval.

### 8. Quality and release pipeline

Stabilize CLI integration tests with explicit per-suite time budgets based on their multi-process behavior. Do not globally hide hangs.

Add:

- ESLint with a TypeScript flat configuration
- `tsconfig.test.json`
- Vitest V8 coverage with checked thresholds
- Node 20, 22, 24, and current compatibility jobs where supported
- Ubuntu, macOS, and Windows filesystem smoke jobs
- a built-tarball install and CLI smoke test
- `prepack` build enforcement
- a curated temporary workspace for strict/runtime doctor release checks

One `verify:release` command runs type-check, lint, build, tests, coverage, curated doctor checks, audit, pack inspection, and tarball smoke tests.

The release workflow uses explicit read-only default permissions, immutable action SHAs, npm provenance, generated checksums, and protected manual dispatch. It publishes npm first, verifies the registry version, then creates/pushes the tag and GitHub Release. This avoids public Git state claiming a version that npm rejected.

## Compatibility and Migration

- Schema additions are optional with defaults, so existing YAML remains valid.
- Existing `harness route` text and JSON fields remain; new fields are additive.
- Existing checklist eval files continue to run.
- Existing templates continue to render, but runtime doctor reports their provenance as unknown or stale.
- Prompt upgrades are explicit and diffable; local templates are never silently overwritten.
- A release migration note documents changed inferred-memory behavior and new runtime checks.

## Error Handling

- Invalid mode, side-effect policy, profile, or evidence status is rejected at CLI parsing or schema validation.
- Required context that cannot fit its budget is a blocking error with the offending section id.
- Missing harness task ids produce actionable errors and do not create partial ledger files.
- Eval failures return exit code 1 while still writing their result artifact.
- Runtime drift is a warning for optional integrations and a release blocker for an installed/declared integration.
- Publish stops before tagging when authentication, audit, provenance, registry verification, or package smoke testing fails.

## Test Strategy

Each task follows a focused RED/GREEN cycle. The branch-level gate includes:

1. Unit tests for mode, authority contract, memory scope, packing, routing, provenance, and schemas.
2. CLI tests for failure exit codes, harness state, prompt migration, and runtime doctor.
3. Privacy sentinels for every new shared-only path.
4. Legacy workspace compatibility tests.
5. Public behavior-eval fixtures.
6. Full build, type-check, lint, test, coverage, release verification, and tarball installation.
7. A final whole-branch architecture and security review.

## Release Plan

The implementation is developed without changing version metadata. After all tasks and reviews pass, prepare a backward-compatible minor release candidate, expected to be `2.2.0` unless the final compatibility audit identifies a breaking change.

Deployment proceeds only when:

- the branch is fully reviewed;
- all local and CI release gates pass;
- npm authentication is valid;
- the target version is absent from npm;
- package provenance and checksums are produced.

If external authentication is unavailable, the work stops in a verified ready-to-publish state with the exact blocker and resumable command recorded.

## Acceptance Criteria

- No confirmed v2.1.3 model-facing correctness defect remains reproducible.
- A plan-mode resume cannot instruct an agent to execute changes.
- A generic worker receives no domain-specific risk persona.
- Other-project or private-only memory cannot consume selected context for the current export.
- Historical content cannot outrank current user/repository instructions.
- Fully Korean release and incident tasks do not default to medium-feature.
- Required safety and verification sections survive tight budgets or produce a blocking error.
- Harness completion requires structured evidence, not a sentinel alone.
- Captured `gpt-5.6-sol` behavior can be evaluated reproducibly without network access.
- Runtime/plugin/prompt drift is visible before release.
- The canonical local test command is stable on the supported development environment.
- The final package passes installation and smoke testing from its tarball.
- Release publication cannot create a tag or GitHub Release before npm publication succeeds.
