# BriefOps

Stop dumping context. Compile it.

BriefOps is a local-first, token-aware persistent work history layer for AI coding agents.

It turns project rules, skills, decisions, lessons, and work history into compact task and handoff briefs for Codex, Claude Code, and similar tools.

BriefOps does not run agents.
BriefOps prepares better continuity for them.

## Why BriefOps

AI coding sessions often begin with the same setup:

- what the project is
- what rules the agent must follow
- what previous lessons matter
- what the current task actually asks for
- how the agent should prove it is done

BriefOps stores durable context as local files, then compiles only the relevant pieces into token-aware briefs, handoffs, and Codex resume missions.

```text
Skill + Project Context + Relevant Memory + Worker + Task
  -> Token-aware Brief
  -> Work Log
  -> Human-approved Memory / Skill Proposal
  -> Worker Summary
  -> Handoff / Codex Resume Prompt
  -> Better future threads
```

Before:
A new Codex thread starts from zero. The user pastes repeated project context and prior decisions.

After:

```bash
briefops codex resume --worker reviewer --task "Continue auth refactor"
```

The result is a compact continuity prompt with prior decisions, active lessons, recent work, evidence gates, and after-completion logging commands.

## What BriefOps Is

BriefOps is:

- a local CLI
- a reusable skill and project context registry
- a curated memory store
- a token-aware brief compiler
- a Codex mission prompt generator
- a work log and learning loop
- a deterministic checklist eval runner
- a persistent worker profile system with summaries, handoffs, and task-aware memory retrieval

## What BriefOps Is Not

BriefOps is alpha software and intentionally scoped.

It is not:

- an agent runtime
- a Codex replacement
- an LLM client
- a vector database
- a SaaS product
- a dashboard
- a multi-agent orchestration system

BriefOps prepares the context. Codex or another coding agent still performs the work.

## Install

From this repository:

```bash
npm install
npm run build
npm link
```

Run during development without linking:

```bash
npm run dev -- --help
```

Check the installed CLI:

```bash
briefops --version
briefops --help
```

## 5-Minute Codex Quickstart

This is the recommended first flow if you want BriefOps to feel Codex-native.

### 1. Initialize BriefOps

```bash
briefops init
```

This creates a local `.briefops/` workspace.

### 2. Install Codex guidance

```bash
briefops codex install
```

This creates or updates `AGENTS.md` with BriefOps guidance and creates `.briefops/codex/prompts/`.

### 3. Create a skill

```bash
briefops skill create risk-review \
  --description "Review changes for risk and governance violations" \
  --tags "review,risk,governance"
```

A skill is a short reusable working protocol.

### 4. Create project context

```bash
briefops project create atlas-q \
  --description "Rule-based non-ML quantitative trading system" \
  --tags "quant,trading"
```

A project stores durable facts and constraints.

### 5. Add useful memory

```bash
briefops memory add \
  --type lessons \
  --project atlas-q \
  --skill risk-review \
  --content "Always verify turnover warning threshold when rebalance logic changes." \
  --tags "rebalance,turnover,risk"
```

Memory is curated operational knowledge, not raw chat history.

### 6. Create a worker profile

```bash
briefops worker create quant-reviewer \
  --project atlas-q \
  --skills "risk-review" \
  --style "governance-first,no strategy drift without approval"
```

A worker is a skill bundle with a default project, style notes, and recent work history.

### 7. Generate a Codex mission

```bash
briefops codex mission \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --mode loop \
  --completion-promise "Deliver verified findings and no unresolved blocking risk." \
  --save
```

Paste the generated mission prompt into Codex.

The mission includes:

- Codex operating contract
- evidence gates
- completion promise
- completion signal
- token-aware BriefOps brief

### 8. Log the result after Codex finishes

```bash
briefops log add \
  --project atlas-q \
  --skill risk-review \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --result "Found missing turnover warning check." \
  --lesson "Verify turnover warning threshold when rebalance logic changes." \
  --commands "npm test,npm run build"
```

### 9. Propose a skill improvement

First promote log lessons into curated memory:

```bash
briefops memory propose-from-log latest
briefops memory proposal-list
briefops memory proposal-apply <proposal-id>
```

Refresh the worker and prepare a fresh-thread handoff:

```bash
briefops worker refresh-summary quant-reviewer
briefops handoff generate \
  --worker quant-reviewer \
  --task "Continue reviewing rebalance policy changes." \
  --adapter codex \
  --save
briefops codex resume \
  --worker quant-reviewer \
  --task "Continue the rebalance review and identify remaining risks." \
  --save
```

Then propose any skill protocol improvement:

```bash
briefops skill propose-patch --skill risk-review --from-log latest
```

BriefOps proposes a patch. It does not auto-apply skill changes.

Apply only after review:

```bash
briefops skill apply-patch risk-review --patch <patch-id>
```

## Core Concepts

| Concept | What it is | Stored at |
|---|---|---|
| Skill | Reusable task protocol | `.briefops/skills/*.skill.md` |
| Project | Durable project facts and constraints | `.briefops/projects/*.project.md` |
| Memory | Curated facts, decisions, lessons, incidents | `.briefops/memory/*.yaml` |
| Memory Proposal | Human-approved promotion candidate from logs | `.briefops/memory-proposals/*.yaml` |
| Brief | Compiled task instructions | `.briefops/briefs/*.md` |
| Handoff | Fresh-thread continuity brief | `.briefops/handoffs/*.md` |
| Codex Mission | Codex-favored execution prompt | `.briefops/codex/prompts/*.md` |
| Worker | Skill bundle plus default project and style | `.briefops/workers/*.worker.yaml` |
| Worker Summary | Persistent worker intelligence summary | `.briefops/workers/summaries/*.summary.md` |
| Work Log | Completed task record | `.briefops/logs/*.yaml` |
| Skill Patch | Human-approved skill improvement proposal | `.briefops/patches/*.patch.yaml` |
| Eval | Deterministic checklist case | `.briefops/evals/*.eval.yaml` |

## Recommended Operating Loop

Use this loop for repeated Codex work:

```text
1. Update Skill, Project, or Memory if durable context changed.
2. Generate a Codex plan when the work is ambiguous.
3. Generate a Codex mission when the work is ready.
4. Paste the mission into Codex.
5. Let Codex inspect, act, and verify.
6. Save a work log.
7. Propose memory from the latest log and apply only after review.
8. Refresh the worker summary.
9. Generate handoff or Codex resume prompts for the next thread.
10. Propose skill patches from lessons when the working protocol should change.
11. Run evals for important skills.
```

The goal is not to maximize context. The goal is to minimize repeated explanation.

## Codex-Favored Mode

Codex-favored mode is the main "wow point" of BriefOps.

It gives Codex a stronger mission wrapper than a plain brief, while keeping BriefOps local and simple.

### Install the Codex prompt pack

```bash
briefops codex install
```

This writes BriefOps guidance into `AGENTS.md` and creates prompt templates under `.briefops/codex/prompts/`.

If `AGENTS.md` already exists:

```bash
briefops codex install --force
```

### Generate a planning prompt

Use this before implementation when the task is still fuzzy.

```bash
briefops codex plan \
  --project atlas-q \
  --idea "Add a release-readiness worker profile." \
  --save
```

The plan prompt tells Codex:

- plan only
- do not edit product code
- identify assumptions
- identify codebase areas to inspect
- produce implementation and verification checklists

### Generate an execution mission

Use this when the task is ready to run.

```bash
briefops codex mission \
  --worker quant-reviewer \
  --task "Review the latest PR for governance drift." \
  --mode loop \
  --budget 2500 \
  --save
```

Modes:

| Mode | Use when |
|---|---|
| `loop` | Codex should inspect, act, verify, and continue if verification fails |
| `execute` | Codex should execute directly with concise verification |
| `plan` | Codex should produce a plan and avoid product-code edits |

### Completion signal

Codex missions include:

```text
<briefops-complete>DONE</briefops-complete>
```

Codex should only emit this after the evidence gates pass.

### Evidence gates

A mission asks Codex to finish with evidence:

- context gate: files or docs inspected
- change gate: smallest useful change set
- verification gate: command output or manual QA evidence
- risk gate: unverified or deferred items

## Generate a Plain Brief

If you do not need a full Codex mission, generate a plain brief:

```bash
briefops brief generate \
  --skill risk-review \
  --project atlas-q \
  --task "Review recent rebalance logic changes." \
  --budget 2000 \
  --adapter codex
```

Save it:

```bash
briefops brief generate \
  --skill risk-review \
  --project atlas-q \
  --task "Review recent rebalance logic changes." \
  --budget 2000 \
  --adapter codex \
  --save
```

Generate from a worker:

```bash
briefops brief generate \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --budget 2500 \
  --adapter codex
```

Available adapters:

- `codex`
- `claude-code`
- `generic`

## Skills

Create:

```bash
briefops skill create risk-review \
  --description "Review changes for risk and governance violations" \
  --tags "review,risk,governance" \
  --max-tokens 700
```

List:

```bash
briefops skill list
```

Show:

```bash
briefops skill show risk-review
```

Patch from a work log:

```bash
briefops skill propose-patch --skill risk-review --from-log latest
briefops skill patch-list
briefops skill patch-show <patch-id>
briefops skill apply-patch risk-review --patch <patch-id>
```

Reject a patch:

```bash
briefops skill reject-patch <patch-id>
```

Show skill history:

```bash
briefops skill history risk-review
```

## Projects

Create:

```bash
briefops project create atlas-q \
  --description "Rule-based non-ML quantitative trading system" \
  --tags "quant,trading,governance" \
  --max-tokens 500
```

List and show:

```bash
briefops project list
briefops project show atlas-q
```

Edit the generated `.briefops/projects/atlas-q.project.md` file to add:

- active facts
- active constraints
- read-if-needed source files

## Memory

Add memory:

```bash
briefops memory add \
  --type lessons \
  --project atlas-q \
  --skill risk-review \
  --content "Always verify turnover warning threshold when rebalance logic changes." \
  --tags "rebalance,turnover,risk"
```

Memory types:

- `facts`
- `decisions`
- `lessons`
- `incidents`
- `deprecated`

List memory:

```bash
briefops memory list
briefops memory list --project atlas-q
briefops memory list --skill risk-review --status active
briefops memory list --tag turnover
```

Show and update status:

```bash
briefops memory show <memory-id>
briefops memory update-status <memory-id> --status archived
```

Statuses:

- `active`
- `stale`
- `deprecated`
- `superseded`
- `archived`

## Workers

Create:

```bash
briefops worker create quant-reviewer \
  --description "Risk-focused quantitative strategy reviewer." \
  --project atlas-q \
  --skills "risk-review,backtest-validation,rebalance-review" \
  --style "skeptical,governance-first,no strategy drift without approval" \
  --max-tokens 300
```

List and show:

```bash
briefops worker list
briefops worker show quant-reviewer
```

Summarize worker history from logs:

```bash
briefops worker summary quant-reviewer
```

Use a worker in a brief or Codex mission:

```bash
briefops brief generate --worker quant-reviewer --task "Review this PR." --adapter codex
briefops codex mission --worker quant-reviewer --task "Review this PR." --mode loop
```

## Work Logs

After a task finishes, add a structured log:

```bash
briefops log add \
  --project atlas-q \
  --skill risk-review \
  --worker quant-reviewer \
  --task "Review rebalance logic changes." \
  --result "Found missing turnover warning check." \
  --lesson "Add turnover warning verification to the review checklist." \
  --files "src/rebalance.ts,tests/rebalance.test.ts" \
  --commands "npm test,npm run build"
```

List logs:

```bash
briefops log list
briefops log list --project atlas-q
briefops log list --skill risk-review --limit 5
```

Show a log:

```bash
briefops log show latest
briefops log show <log-id>
```

## Evals

BriefOps evals are deterministic checklist checks. They do not call an LLM judge.

Create an eval case:

```bash
briefops eval create turnover-missing-case \
  --skill risk-review \
  --project atlas-q \
  --input "Review rebalance logic." \
  --expected "turnover warning threshold" \
  --expected "blocking issue" \
  --pass-threshold 1
```

Run evals:

```bash
briefops eval run --skill risk-review --project atlas-q
```

List and show:

```bash
briefops eval list
briefops eval show turnover-missing-case
```

## Inspect and Doctor

Check workspace structure:

```bash
briefops doctor
```

Inspect token usage before generating a full brief:

```bash
briefops inspect tokens \
  --skill risk-review \
  --project atlas-q \
  --task "Review recent rebalance logic changes." \
  --budget 2000
```

Inspect worker-based token usage:

```bash
briefops inspect tokens \
  --worker quant-reviewer \
  --task "Review this PR." \
  --budget 2500
```

Inspect workspace and memory:

```bash
briefops inspect workspace
briefops inspect memory
briefops inspect memory --project atlas-q
```

## Saved Briefs and Prompts

List saved briefs:

```bash
briefops brief list
```

Show or inspect a saved brief:

```bash
briefops brief show latest
briefops brief inspect latest
```

Codex mission and plan prompts are saved under:

```text
.briefops/codex/prompts/
```

## Token Budget Philosophy

BriefOps uses a simple deterministic estimate:

```text
estimated_tokens = ceil(character_count / 4)
```

This is approximate by design.

When a generated brief is too large, BriefOps trims in this order:

```text
memory -> worker history -> project context -> skill content
```

The task itself is never removed.

## File Structure

`briefops init` creates:

```text
.briefops/
+-- config.yaml
+-- skills/
+-- projects/
+-- memory/
|   +-- facts.yaml
|   +-- decisions.yaml
|   +-- lessons.yaml
|   +-- incidents.yaml
|   +-- deprecated.yaml
+-- workers/
+-- logs/
+-- briefs/
+-- codex/
|   +-- prompts/
+-- evals/
|   +-- results/
+-- patches/
+-- templates/
    +-- brief.generic.md
    +-- brief.codex.md
    +-- brief.claude-code.md
```

By default `.briefops/` is ignored by git in this repository. This keeps local operational memory out of public commits unless you intentionally choose otherwise.

## Command Reference

```bash
briefops init
briefops doctor

briefops skill create <name>
briefops skill list
briefops skill show <name>
briefops skill diff <name>
briefops skill history <name>
briefops skill propose-patch --skill <name> --from-log <log-id|latest>
briefops skill apply-patch <name> --patch <patch-id>
briefops skill reject-patch <patch-id>
briefops skill patch-list
briefops skill patch-show <patch-id>

briefops project create <name>
briefops project list
briefops project show <name>

briefops memory add
briefops memory list
briefops memory show <id>
briefops memory update-status <id> --status <status>

briefops brief generate --skill <name> --project <name> --task "<task>" --adapter codex
briefops brief generate --worker <name> --task "<task>" --adapter codex
briefops brief list
briefops brief show <id|latest>
briefops brief inspect <id|latest>

briefops codex install
briefops codex mission --worker <name> --task "<task>" --mode loop --save
briefops codex plan --project <name> --idea "<what to build>" --save

briefops log add
briefops log list
briefops log show <id|latest>

briefops eval create <name>
briefops eval list
briefops eval run --skill <name> --project <name>
briefops eval show <id>

briefops worker create <name>
briefops worker list
briefops worker show <name>
briefops worker summary <name>

briefops inspect tokens
briefops inspect workspace
briefops inspect memory
```

## Example: PR Review With Codex

```bash
briefops codex mission \
  --worker quant-reviewer \
  --task "Review the latest PR for governance drift, missing tests, and risk policy violations." \
  --mode loop \
  --completion-promise "Return blocking findings, required fixes, verification evidence, and merge recommendation." \
  --save
```

Paste the generated prompt into Codex.

After Codex finishes:

```bash
briefops log add \
  --project atlas-q \
  --skill risk-review \
  --worker quant-reviewer \
  --task "Review the latest PR for governance drift, missing tests, and risk policy violations." \
  --result "<what Codex found>" \
  --lesson "<what should be remembered next time>" \
  --commands "<commands Codex ran>"
```

Then:

```bash
briefops skill propose-patch --skill risk-review --from-log latest
```

## Troubleshooting

Workspace not found:

```bash
briefops init
```

Check missing workspace pieces:

```bash
briefops doctor
```

Brief is too long:

```bash
briefops inspect tokens --worker <worker> --task "<task>" --budget 2500
```

Then reduce memory, project, worker, or skill token budgets.

`AGENTS.md` already exists:

```bash
briefops codex install --force
```

No memory appears in a brief:

```bash
briefops memory list --project <project> --skill <skill> --status active
```

Eval fails:

```bash
briefops eval show <case-id>
briefops brief generate --skill <skill> --project <project> --task "<eval input>" --adapter codex
```

Check whether the expected phrases are actually present in the generated brief.

## Development

Install dependencies:

```bash
npm install
```

Build:

```bash
npm run build
```

Run tests:

```bash
npm test
```

Run the CLI in development:

```bash
npm run dev -- --help
```

## Roadmap

Future versions may add:

- optional LLM-based patch suggestions
- optional LLM eval judges
- better tokenizer integrations
- Git diff-aware briefs
- PR review mode
- external integrations

The long-term direction is a persistent worker layer for human-led AI coding workflows, while the current alpha stays focused on one useful job: compile compact, reusable briefs and Codex missions within a visible token budget.
