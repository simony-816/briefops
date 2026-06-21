# BriefOps Master Harness

This document defines the Codex-first Master Harness for BriefOps. The harness is not a larger prompt bundle. It is the operating layer that decides which workflow depth is required for a task, which artifacts must exist, what verification evidence is acceptable, and what memory should survive the session.

## 1. Executive Summary

- Build the MVP as one BriefOps plugin/skill pack with modular internal skills, not as separate plugins.
- Keep BriefOps as the canonical memory and handoff owner. Interoperate with Fable-style state concepts, but do not copy external state files into BriefOps by default.
- Reimplement Fable-like goal, findings, and evidence concepts in clean-room BriefOps schemas unless a future license review explicitly approves code reuse.
- Treat Spec-Kit as the specification/planning layer. Wrap or route to it when installed; do not embed its full workflow into the memory layer.
- Make routing the product center: `briefops harness route --task "<task>"` chooses workflow depth before implementation.
- Use a hybrid state model: Markdown for human narrative and JSON/JSONL/YAML for agent-readable ledgers.
- Prevent over-process by routing tiny work to light plans and targeted verification only.
- Prevent under-process by escalating risky tasks to goal ledgers, findings, full verification, visual evidence, incident logs, or handoffs.
- Keep the core runtime-agnostic. The first adapter is Codex skills and CLI prompts.
- The next implementation step is to extend the new harness router into persistent `.briefops/harness/` ledgers and final response checks.

## 2. Source Project Findings

### FableCodex

Source: <https://github.com/baskduf/FableCodex>

Confirmed facts:

| Area | Finding |
| --- | --- |
| Runtime target | Codex-focused. The repository describes FableCodex as a Codex plugin that ports Fable ideas to Codex and includes a Codex Fable 5 plugin. |
| Useful ideas | Goal ledger, findings ledger, verification gate, evidence-first completion, anti-false-done workflow. |
| Plugin structure | The repository includes `plugins/codex-fable5` and documentation for installing a local Codex plugin. |
| Command/state model | It is organized around task-local ledgers and evidence, not long-term project memory. |
| License | AGPL-3.0-or-later per the repository license/readme metadata. |
| Maturity | Small, focused reference implementation. Treat as conceptual prior art until deeper source audit. |

Architectural interpretation:

- FableCodex owns the execution tracking and verification ideas.
- It should not become BriefOps memory. BriefOps should own long-lived facts, decisions, work logs, handoffs, and project state.
- The MVP should reimplement Fable-like concepts as `goals`, `findings`, and `verification` artifacts under the BriefOps namespace.

Integration recommendation:

- Do not call FableCodex directly in the MVP.
- Borrow the lifecycle ideas, not code.
- Treat code/text reuse as license-sensitive because AGPL obligations may apply.
- Preserve an explicit compatibility note so existing FableCodex state can be imported later if users ask for it.

### fablize

Source: <https://github.com/fivetaku/fablize>

Confirmed facts:

| Area | Finding |
| --- | --- |
| Runtime target | Claude Code-focused. The repository describes itself as a Claude Code plugin. |
| Useful ideas | Per-task router, escalation from simple tasks to deeper workflows, task-complete gate, verification discipline. |
| Plugin structure | The repository includes Claude plugin assets and slash-command style workflows. |
| Command/state model | Stronger as a workflow inspiration source than as a Codex drop-in. |
| License | MIT in the repository license file. |
| Maturity | Useful reference, but runtime-specific to Claude Code. |

Architectural interpretation:

- fablize validates the idea that workflow depth should be routed, not globally forced.
- FableCodex is the closer Codex implementation reference.

Integration recommendation:

- Do not graft fablize into Codex.
- Reuse the design pattern: route first, execute second, verify before completion.

### Ponytail

Source: <https://github.com/DietrichGebert/ponytail>

Confirmed facts:

| Area | Finding |
| --- | --- |
| Runtime target | Codex plugin/prompt policy focused on implementation behavior. |
| Useful ideas | Smallest useful diff, avoid unnecessary refactors, preserve existing behavior, avoid unnecessary dependencies, keep local conventions. |
| Plugin structure | The repository presents policy guidance for Codex-style coding agents. |
| Command/state model | Policy-oriented, not a full lifecycle, memory, or verification system. |
| License | MIT in the repository license file. |
| Maturity | Best treated as an implementation policy layer. |

Architectural interpretation:

- Ponytail belongs between planning and patching.
- It should shape implementation behavior but not own task routing, memory, or verification.

Integration recommendation:

- Encode Ponytail-like rules into the `briefops-implement` skill and final review checklist.
- Keep it as policy, not state.

### BriefOps

Sources: [README.md](../README.md), [docs/file-format.md](file-format.md), [docs/compatibility.md](compatibility.md), [docs/integrations/harnesses.md](integrations/harnesses.md)

Confirmed facts:

| Area | Finding |
| --- | --- |
| Runtime target | Local-first CLI for Codex, Claude Code, Cursor, and local harnesses. |
| Role | Persistent memory, work logs, handoffs, worker continuity, compact context priming. |
| State root | `.briefops/` is the canonical local data root. |
| Current boundary | BriefOps explicitly says it is not an agent harness or multi-agent orchestrator. |
| License | MIT. |

Architectural interpretation:

- The Master Harness should be a new layer above BriefOps memory, not a replacement for current BriefOps.
- The harness can live in the same CLI/plugin because it routes to existing BriefOps commands before and after work.

Integration recommendation:

- Add `briefops harness route` for task classification.
- Add `.briefops/harness/` artifacts only after schemas are stable enough to persist.

### Spec-Kit

Sources: local github-spec-kit plugin skills at `/Users/simon/.codex/plugins/cache/local/github-spec-kit/0.1.0/skills/`.

Confirmed facts:

| Area | Finding |
| --- | --- |
| Runtime target | Codex plugin skills for specification, planning, task generation, analysis, and implementation handoff. |
| Role | Planning layer: requirements, scope, design, task decomposition. |
| Routing guidance | The local `project-orchestrator` skill says Spec Kit is required for new features, architecture changes, API contracts, security-sensitive work, large refactors, and unclear multi-file changes. |
| State root | `.specify/` and `specs/` when initialized in a repository. |

Architectural interpretation:

- Spec-Kit should be invoked only when the harness route says specification/planning is required.
- It should not own memory or final verification.

Integration recommendation:

- MVP: reference Spec-Kit in route output and Codex skills.
- v1: detect `.specify/` and route to `speckit-specify`, `speckit-plan`, and `speckit-tasks` when available.

## 3. Proposed Architecture

```
User Task
  |
  v
+-----------------------------+
| Intake / Classification     |
| briefops harness route      |
+-------------+---------------+
              |
              v
+-------------+---------------+
| Memory Layer                |
| briefops prime              |
+-------------+---------------+
              |
              v
+-------------+---------------+
| Spec / Plan Layer           |
| Spec-Kit when route needs it|
+-------------+---------------+
              |
              v
+-------------+---------------+
| Implementation Policy       |
| Ponytail-like guardrails    |
+-------------+---------------+
              |
              v
+-------------+---------------+
| Execution Tracking          |
| goals + findings            |
+-------------+---------------+
              |
              v
+-------------+---------------+
| Verification Layer          |
| evidence gates              |
+-------------+---------------+
              |
              v
+-------------+---------------+
| Handoff / Learning          |
| briefops finish / continue  |
+-----------------------------+
```

### Layer Ownership

| Layer | Responsibility | Inputs | Outputs | State Files | Trigger | Failure Modes |
| --- | --- | --- | --- | --- | --- | --- |
| Memory | Durable project context, decisions, work logs, handoffs | Task, worker, project | Prime context, logs, memory proposals | `.briefops/memory/*.yaml`, `.briefops/logs/*.yaml`, `.briefops/handoffs/*.md` | Every meaningful task | Memory spam, stale facts, private data leakage |
| Intake / Classification | Select workflow depth | User task, repo signals, explicit task type | Route contract | MVP: none; v1: `.briefops/harness/routes.jsonl` | Start of task | Under-routing risky work, over-routing tiny work |
| Specification | Clarify what to build | Route, requirements, repo context | `spec.md`, acceptance criteria | `.specify/`, `specs/*/spec.md` | New/large/ambiguous features | Specs too heavy, implementation details leak into spec |
| Planning | Decompose work | Spec, repo constraints | Plan, tasks, risk notes | `specs/*/plan.md`, `tasks.md`, optional `.briefops/harness/goals.json` | Medium or larger work | Plan drift, tasks not executable |
| Implementation Policy | Keep changes small and local | Plan, existing code conventions | Scoped diff discipline | Skill text, route final contract | Before editing | Unnecessary refactor, new dependency drift |
| Execution Tracking | Track goals and findings | Route, plan, debugging evidence | Goal ledger, findings | v1 `.briefops/harness/goals.json`, `.briefops/harness/findings.jsonl` | Multi-step, debugging, research, incidents | Hidden blockers, stale goals |
| Verification | Require evidence before done | Route, changed files, commands | Verification record | v1 `.briefops/harness/verification.md` or `.jsonl` | Before final response | False done, unverifiable claims |
| Handoff / Learning | Close task and preserve durable knowledge | Result, risks, commands, decisions | Work log, memory update, resume pack | Existing BriefOps files | Finish meaningful work | Logging transient noise, missing next step |

## 4. Orchestrator Routing Matrix

The MVP route table is implemented in [src/core/harness.ts](../src/core/harness.ts).

| Task Type | Spec | Plan | Goal Ledger | Findings | Verification | Memory Update |
| --- | --- | --- | --- | --- | --- | --- |
| Small bug fix | No | Light | Optional | Yes if debugging | Level 2 targeted test | Work log |
| Medium feature | Light | Yes | Yes | Optional | Level 2 or 3 | Work log plus decisions |
| Large feature | Yes | Yes | Yes | Yes | Level 3 full project verification | Decision, project state, handoff |
| Refactor | No unless behavior changes | Yes | Yes for multi-file | Optional | Level 3 regression verification | Work log plus decision if architecture changes |
| Dependency upgrade | No | Yes | Yes | Yes if breakage appears | Level 3 full project verification | Decision plus work log |
| UI change | Light | Light | Optional | Yes for visual defects | Level 4 visual evidence | Work log, decision if design pattern changes |
| Test repair | No | Light | Optional | Yes if uncertain | Level 2 targeted test | Work log |
| Production incident | No | Incident plan | Yes | Yes | Level 4 evidence-based verification | Incident, decision, handoff |
| Documentation task | No | No or light | No | No | Level 0 or 1 | Work log only if durable |
| Architecture decision | Yes | Yes | Optional | Research findings | Level 1 source inspection | Decision plus architecture memory |
| Exploratory research | No | Research plan | Optional | Yes | Level 1 source inspection | Findings or decision if durable |
| Code review | No | Review plan | Optional | Yes | Level 1 or 2 | Known issue if durable |
| Release preparation | No | Yes | Yes | Yes | Level 4 evidence-based verification | Project state plus handoff |

Minimum useful routing logic:

1. Use explicit `--type` if the user or agent supplies it.
2. Otherwise classify by task keywords and repo signals.
3. Escalate when risk signals appear: production, auth, security, payment, database, dependency, release, UI evidence, large refactor.
4. De-escalate when scope is documentation, typo, local test repair, or a tightly bounded bug.
5. Let the agent override the inferred route only by saying why.

## 5. State Model

Recommended committed default:

```text
.briefops/
  config.yaml
  projects/
  skills/
  workers/
  memory/
  logs/
  handoffs/
  codex/
  harness/
    routes.jsonl
    goals.json
    findings.jsonl
    verification.md
    final-response.md
```

Artifact ownership:

| Artifact | Purpose | Owner | Format | Trigger | Append or Mutable | Human or Machine | Commit? | Sensitive? |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `.briefops/memory/*.yaml` | Durable facts, decisions, lessons | BriefOps memory | YAML | `finish` durable candidates | Mutable by status | Both | Usually ignored by default | May contain private memory |
| `.briefops/logs/*.yaml` | Task work history | BriefOps memory | YAML | Meaningful task finish | Append-only files | Machine-readable | Usually ignored | Often private |
| `.briefops/handoffs/*.md` | Session continuation | Handoff layer | Markdown | Multi-step or risky finish | Generated | Human-readable | Usually ignored | Often private |
| `.briefops/harness/routes.jsonl` | Route decisions audit | Orchestrator | JSONL | Each routed task | Append-only | Machine-readable | Usually ignored | Low to medium |
| `.briefops/harness/goals.json` | Active goals and status | Execution tracking | JSON | Medium+ work | Mutable | Machine-readable | Usually ignored | Medium |
| `.briefops/harness/findings.jsonl` | Debug/research/review findings | Execution tracking | JSONL | Finding discovered | Append-only | Both | Usually ignored | Medium |
| `.briefops/harness/verification.md` | Evidence checklist | Verification | Markdown | Before final response | Mutable per task | Human-readable | Usually ignored | Medium |
| `.briefops/harness/final-response.md` | Final response contract template | Verification | Markdown | Harness install | Mutable template | Human-readable | Could commit if generic | Low |
| `.specify/` and `specs/` | Feature specs and plans | Spec-Kit | Markdown/JSON | Spec-required tasks | Mixed | Both | Usually commit for product specs | Low to medium |

Markdown vs JSON:

- Markdown is best for decisions, handoffs, verification narratives, and templates.
- JSON/JSONL/YAML is best for routing, goals, findings, status, and machine checks.
- Hybrid model: keep agent-controlled ledgers structured, keep human-facing summaries readable.

## 6. Skill / Command Interface

### CLI

```bash
briefops harness route --task "<task>"
briefops harness route --task "<task>" --type large-feature
briefops harness route --task "<task>" --json
briefops harness matrix
briefops prime --format codex --task "<task>"
briefops finish --task "<task>" --result "<verified result>"
```

### Public Codex skills

| Skill | Purpose | When Used | Inputs | Outputs | State Touched |
| --- | --- | --- | --- | --- | --- |
| `briefops-route-task` | Choose workflow depth | Start of task | User task | Route contract | MVP none |
| `briefops-prime-context` | Load compact memory | After route, before broad inspection | Task, worker, project | Prime context | Reads `.briefops/` |
| `briefops-finish-task` | Record outcome and durable memory | End of meaningful work | Result, lessons, risks | Work log, memory proposal/application | Writes `.briefops/` |
| `briefops-review-memory` | Inspect memory proposals | When pending proposals exist | Proposal id | Apply/reject decision | Writes `.briefops/` |
| `briefops-continue-worker` | Prepare fresh-thread handoff | Continuation tasks | Worker, task | Handoff/resume/pack | Writes `.briefops/` |

### Future internal skills

| Skill | Purpose | User-facing? |
| --- | --- | --- |
| `route-task` | Classify task and emit workflow contract | No |
| `load-memory` | Run prime and summarize selected continuity context | No |
| `write-ledger` | Create/update goal ledger | No |
| `record-finding` | Append finding with evidence | No |
| `check-verification` | Validate route-specific completion evidence | No |
| `summarize-handoff` | Prepare durable handoff notes | No |

Smallest viable MVP skill set:

1. `briefops-route-task`
2. `briefops-prime-context`
3. `briefops-finish-task`
4. `briefops-continue-worker`

## 7. Runtime Flows

### New Feature

Flow:

```text
intake -> context retrieval -> specify -> plan -> tasks -> implement -> verify -> handoff
```

Required artifacts: route, prime context, spec if medium/large, plan, goal ledger, verification evidence, finish log.

Exit criteria: acceptance criteria covered, implementation scoped, verification evidence recorded, memory/handoff updated.

Final response: summary, files changed, acceptance criteria, verification, risks, memory update.

### Bug Fix

Flow:

```text
intake -> reproduce -> findings -> patch -> targeted verification -> worklog
```

Required artifacts: route, reproduction note or reason reproduction was not possible, finding if debugging, targeted test evidence.

Exit criteria: root cause or bounded symptom understood, patch scoped, targeted verification passes.

Final response: cause, fix, files changed, verification, remaining risk.

### Refactor

Flow:

```text
intake -> scope boundary -> risk analysis -> plan -> implement incrementally -> regression verification -> handoff
```

Required artifacts: behavior boundary, risk notes, plan, regression evidence.

Exit criteria: no intended behavior change unless documented, diff reviewable, tests cover touched behavior.

Final response: scope, behavior preservation claim, verification, risks.

### Research

Flow:

```text
intake -> source review -> findings -> recommendation -> decision log
```

Required artifacts: route, source list, findings, recommendation, decision if durable.

Exit criteria: sources inspected directly, facts separated from interpretation, uncertainties named.

Final response: findings, sources, recommendation, open questions.

### UI

Flow:

```text
intake -> visual target -> implementation -> render/inspect -> screenshot/evidence -> verification
```

Required artifacts: route, visual target, screenshot/render evidence, responsive notes.

Exit criteria: UI rendered in natural environment, target viewport checked, visual evidence supports completion.

Final response: UI outcome, files changed, visual evidence, remaining visual risk.

## 8. Completion Criteria

Final responses should include:

- Summary of changes.
- Files changed.
- Tests or verification performed.
- Evidence.
- Remaining risks.
- Memory updates made or skipped.
- Next recommended action when useful.

Standards by task kind:

| Work Type | Done Means |
| --- | --- |
| Documentation-only | Content matches current behavior; links/examples checked when practical; skipped execution explained. |
| Code change | Changed behavior is implemented; targeted or full checks pass; residual risk named. |
| UI change | Rendered output inspected; screenshot or equivalent evidence captured; viewport risk named. |
| Database change | Migration path, rollback or compatibility notes, and integration verification exist. |
| Dependency change | Lockfile/package changes are intentional; build/tests pass; migration notes recorded. |
| Production fix | Impact, mitigation, verification, and follow-up risk are recorded. |
| Research-only | Sources are cited; facts and interpretation are separated; recommendation is explicit. |

## 9. Verification Policy

| Level | Required When | Acceptable Evidence | Unacceptable Evidence | Escalation |
| --- | --- | --- | --- | --- |
| Level 0: No execution | Pure planning or writing | Static review note | Claiming code works without code checks | Escalate if files affect runtime behavior |
| Level 1: Static inspection | Docs, config, research, review | File inspection, source links, type-aware reasoning | "Looks fine" without inspected evidence | Escalate if behavior changes |
| Level 2: Targeted verification | Bug fix, isolated change, test repair | Specific test, build target, reproduction check | Unrelated test command only | Escalate on shared module or uncertain coverage |
| Level 3: Full project verification | Feature, refactor, dependency upgrade | Build plus relevant suite or project-standard checks | Only lint for behavior changes | Escalate for release, UI, incident |
| Level 4: Evidence-based verification | UI, generated files, release, incident | Screenshot, artifact inspection, release checklist, logs | Verbal assertion only | Block completion if evidence cannot be produced without explanation |

## 10. Memory Policy

Memory update types:

| Type | Required When | Avoid |
| --- | --- | --- |
| No update | Tiny transient tasks with no durable lesson | Losing decisions or risks |
| Work log only | Most meaningful tasks | Recording every micro-step |
| Decision log | Architecture, product, workflow, or policy choices | Storing preferences as facts |
| Project state update | Durable project constraints changed | Duplicating task logs |
| Handoff summary | Multi-step, interrupted, incident, release, large feature | Handing off stale blockers |
| Architecture memory | Durable technical rationale | Overwriting unresolved debate |
| Known issue/finding | Confirmed unresolved defect or risk | Storing unverified suspicion as fact |

Rules:

1. Store durable decisions, assumptions, constraints, unresolved risks, and next steps.
2. Do not store secrets, credentials, personal data, or transient command noise.
3. Keep raw work logs local/private by default.
4. Use shared-only export when context may leave the workspace.
5. Prefer fewer, higher-quality memory entries.

## 11. Repository Integration

Where files live:

- Harness source code belongs in the BriefOps CLI and plugin generator.
- User project state belongs under `.briefops/`.
- Spec-Kit state belongs under `.specify/` and `specs/` when initialized.
- Always-visible router instructions belong in `AGENTS.md`, `CLAUDE.md`, or Cursor rules through existing `briefops export`.

Commit guidance:

- Commit generic docs, router instructions, specs, and team-approved project rules.
- Ignore `.briefops/` by default because it can contain local/private work history.
- Allow teams to commit selected shared `.briefops` templates only after review.

Monorepos:

- Detect nearest workspace root.
- Support one `.briefops/` at repo root with project names for packages.
- v1 should support package-specific profiles and test command discovery.

Small projects:

- Keep a single `.briefops/` workspace.
- Use default worker and project.
- Avoid requiring Spec-Kit unless complexity warrants it.

Convention detection:

- Read `AGENTS.md`, `README.md`, package scripts, CI config, test scripts, and existing docs before choosing commands.
- Prefer existing test/build commands over invented ones.

## 12. Licensing And Reuse

| Source | License | Code Reuse | Ideas Reimplementation | Attribution |
| --- | --- | --- | --- | --- |
| BriefOps | MIT | Owned here | Yes | Keep MIT notice |
| FableCodex | AGPL-3.0-or-later | Avoid copying into BriefOps | Yes, clean-room only | Attribute ideas; do not derive code/text without legal review |
| fablize | MIT | Possible after source audit | Yes | Attribute if deriving text/code |
| Ponytail | MIT | Possible after source audit | Yes | Attribute if deriving text/code |
| Spec-Kit local plugin | Check upstream for exact terms before copying | Do not copy into BriefOps MVP | Route to installed skills | Cite integration boundary |

Clean-room rule:

- Do not copy source code or long instruction text from external projects into BriefOps.
- Reimplement concepts as BriefOps-native routing, ledgers, and verification contracts.
- Keep source findings and design interpretation separate.

## 13. MVP Scope

Goal:

> Make Codex behave more reliably on real development tasks.

MVP features:

- One installable Codex plugin/skill pack.
- `briefops harness route`.
- Routing matrix for common task categories.
- Existing `briefops prime` memory intake.
- Existing `briefops finish` work log and memory update.
- Goal/finding/verification concepts defined in docs.
- Final response contract defined by route output.

MVP non-goals:

- Cloud sync.
- TUI/dashboard.
- Database-backed state.
- Full multi-agent orchestration.
- Automatic source-code rewriting by harness.
- Mandatory Spec-Kit for all work.
- Direct FableCodex/fablize/Ponytail code import.

MVP file tree:

```text
src/core/harness.ts
src/commands/harness.ts
plugins/briefops-codex/skills/briefops-route-task/SKILL.md
docs/master-harness.md
tests/harness.test.ts
```

Implementation steps:

1. Ship route command and skill entrypoint.
2. Add persistent route audit file `.briefops/harness/routes.jsonl`.
3. Add goal ledger writer for multi-step routes.
4. Add findings append command for debugging/research/review.
5. Add verification checklist generator keyed by route verification level.
6. Add final response checker that prints missing required sections.
7. Detect `.specify/` and suggest Spec-Kit commands only when required.

Test strategy:

- Unit-test route classification and explicit overrides.
- CLI-test `briefops harness route` and `briefops harness matrix`.
- Plugin-sync test for generated Codex skill files.
- Golden-output tests for route contracts.
- Later: fixture tests for `.briefops/harness/` persistence.

Risks:

- Keyword routing can misclassify tasks. Mitigation: explicit `--type` override and safer escalation rules.
- Process creep can make small tasks slow. Mitigation: route matrix defaults small work to light workflow.
- Verification can become performative. Mitigation: route-specific acceptable evidence.
- State can become noisy. Mitigation: memory policy and local/private defaults.

## 14. Roadmap

### MVP

Goal: Make Codex behave more reliably on real development tasks.

Features:

- Routing.
- Memory intake.
- Work log.
- Goal/finding/verification contracts.
- Handoff through existing BriefOps commands.

### v1

Goal: Make BriefOps Master Harness dependable across multiple projects.

Features:

- Persistent harness schemas.
- Project profiles.
- Better `AGENTS.md` integration.
- Automatic test command discovery.
- Release/review/incident flows.
- Spec-Kit detection and route-aware suggestions.

### v2

Goal: Make BriefOps runtime-agnostic.

Features:

- Adapters for Codex, Claude Code, OpenCode, Gemini CLI.
- Portable state model.
- Cross-agent handoff.
- Advanced memory compaction.
- Optional dashboard or TUI.

## 15. Open Questions

1. Should `.briefops/harness/routes.jsonl` be enabled by default or only with `--save`?
2. Should goal/findings state be one shared ledger or one task-scoped directory per task?
3. Should Spec-Kit integration call local skills directly or only print next-step instructions?
4. Should route classification read `AGENTS.md` and package scripts in MVP or v1?
5. Should final response checking be advisory or blocking?
6. Should teams be able to customize routing policy in `.briefops/harness/policy.yaml`?

## 16. Recommended Next Action

Implement persistent harness state:

```bash
briefops harness route --task "<task>" --save
```

The saved route should append to `.briefops/harness/routes.jsonl` and create a task-scoped verification checklist. That makes the orchestrator observable without turning the MVP into a heavy workflow engine.
