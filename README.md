# BriefOps

BriefOps is a local-first, token-aware skill and briefing layer for AI coding agents.

It helps turn repeated explanations into compact, reusable task briefs for tools like Codex and Claude Code.

BriefOps does not run agents. BriefOps prepares better instructions for agents.

## What It Solves

AI coding sessions often start with the same repeated setup: project facts, review rules, prior lessons, constraints, and the exact shape of the current task. BriefOps stores that durable context as small local files, then compiles only the useful pieces into a compact task brief.

The core workflow is:

```text
Skill + Project Context + Relevant Memory + Task
  -> Compact token-aware Brief
  -> Codex / Claude Code / ChatGPT
  -> Work Log
  -> Human-approved Skill Patch
```

## What It Is Not

BriefOps v1.0 is intentionally scoped.

It is not an agent runtime, an LLM client, a vector database, a dashboard, a cloud sync product, or a multi-agent orchestration system.

## Installation

From this repository:

```bash
npm install
npm run build
npm link
```

You can also run the CLI during development:

```bash
npm run dev -- init
```

## Quickstart

```bash
briefops init

briefops skill create risk-review \
  --description "Review changes for risk and governance violations" \
  --tags "review,risk,governance"

briefops project create atlas-q \
  --description "Rule-based non-ML quantitative trading system" \
  --tags "quant,trading"

briefops memory add \
  --type lessons \
  --project atlas-q \
  --skill risk-review \
  --content "Always verify turnover warning threshold when rebalance logic changes." \
  --tags "rebalance,turnover,risk"

briefops brief generate \
  --skill risk-review \
  --project atlas-q \
  --task "Review recent rebalance logic changes." \
  --budget 2000 \
  --adapter codex \
  --save

briefops log add \
  --project atlas-q \
  --skill risk-review \
  --task "Review recent rebalance logic changes." \
  --result "Found missing turnover warning check." \
  --lesson "Verify turnover warning threshold when rebalance logic changes."

briefops skill propose-patch --skill risk-review --from-log latest
```

## Commands

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

briefops brief generate --skill <name> --project <name> --task "<task>" --budget 2000 --adapter codex
briefops brief generate --worker <name> --task "<task>" --budget 2500
briefops brief list
briefops brief show <id|latest>
briefops brief inspect <id|latest>

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

briefops inspect tokens --skill <name> --project <name> --task "<task>" --budget 2000
briefops inspect tokens --worker <name> --task "<task>" --budget 2500
briefops inspect workspace
briefops inspect memory
```

## File Structure

`briefops init` creates a local workspace in the current repository:

```text
.briefops/
├─ skills/
├─ projects/
├─ memory/
│  ├─ facts.yaml
│  ├─ decisions.yaml
│  ├─ lessons.yaml
│  ├─ incidents.yaml
│  └─ deprecated.yaml
├─ workers/
├─ logs/
├─ briefs/
├─ evals/
│  └─ results/
├─ patches/
├─ templates/
│  ├─ brief.generic.md
│  ├─ brief.codex.md
│  └─ brief.claude-code.md
└─ config.yaml
```

Skill files live at `.briefops/skills/<name>.skill.md`. Project files live at `.briefops/projects/<name>.project.md`. Memory is stored in YAML files by category. Worker, eval, patch, and adapter template files are also local YAML or Markdown files under `.briefops`.

## Token Budget Philosophy

BriefOps uses a simple deterministic estimate:

```text
estimated_tokens = ceil(character_count / 4)
```

This is approximate by design. The goal is not perfect tokenizer accounting. The goal is to make budget tradeoffs visible and prevent every task brief from becoming a context dump.

When a generated brief is too large, BriefOps trims memory first, then worker history, then project context, then skill content down to a minimum floor. It never removes the task entirely.

## Example Workflow

1. Create a reusable skill such as `risk-review`.
2. Create a project context such as `atlas-q`.
3. Add curated lessons or facts as memory.
4. Generate a brief for the task at hand.
5. Paste the generated brief into Codex, Claude Code, or ChatGPT.
6. Add a work log after the task is complete.
7. Propose a skill patch from the work log lesson.
8. Run checklist evals to verify the brief still carries expected operational checks.

## Worker Profiles

Workers are skill bundles, not autonomous agents. A worker can provide default skills, a default project, style notes, and a short recent work history summary from logs.

```bash
briefops worker create quant-reviewer \
  --project atlas-q \
  --skills "risk-review,release-review" \
  --style "governance-first,no strategy drift without approval"

briefops brief generate \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --budget 2500 \
  --adapter codex
```

## Checklist Evals

BriefOps v1.0 uses deterministic checklist evals. It does not call an LLM judge by default.

```bash
briefops eval create turnover-missing-case \
  --skill risk-review \
  --project atlas-q \
  --input "Review rebalance logic." \
  --expected "turnover warning threshold" \
  --expected "blocking issue"

briefops eval run --skill risk-review --project atlas-q
```

## v1.0 Scope

BriefOps v1.0 includes a local CLI, file-based storage, skill/project/memory management, worker profiles, adapter templates, brief generation, token inspection, work logs, human-approved skill patch proposals, checklist evals, and tests.

It deliberately excludes agent execution, LLM API calls, vector search, web dashboards, cloud sync, and plugin architecture.

## Roadmap

Future versions may add optional LLM-based patch suggestions, optional LLM eval judges, better tokenizer integrations, Git diff-aware briefs, PR review mode, and external integrations.

The long-term direction is a persistent worker layer for human-led AI coding workflows, but v1.0 stays focused on one useful job: compile compact, reusable briefs within a visible token budget.
