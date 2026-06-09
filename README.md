# BriefOps

BriefOps is a local-first, token-aware persistent work history layer for AI coding agents.

The goal is not just to generate a good brief. The goal is to let a user finish an AI coding task, promote useful work history into durable memory, and start a fresh Codex or Claude Code thread where the same worker can continue with prior decisions, lessons, risks, and judgment profile.

```bash
briefops prime --task "Start the next task." --format codex --max-tokens 800
briefops finish ...
briefops memory proposal-show latest
briefops memory proposal-apply latest
briefops continue --worker <worker> --task "<next task>" --pack
```

BriefOps does not run agents. It prepares deterministic local context for them.
It should not maximize context. It preserves continuity by selecting the smallest useful information that should survive into the next task.

## What BriefOps Is

- a local CLI
- a file-based skill, project, memory, worker, and work-log store
- a deterministic memory proposal and approval workflow
- a token-aware brief, handoff, Codex mission, and resume generator
- a compact first-context primer for fresh Codex threads
- a persistent worker continuity layer for fresh AI coding threads
- router exports for local harnesses like Codex, Claude Code, and Cursor

## What BriefOps Is Not

BriefOps is intentionally scoped. It is not:

- an LLM client
- a vector database
- a SaaS product
- a web UI
- an agent runtime
- a multi-agent orchestrator
- a cloud sync service
- an MCP server

Everything important lives in local files under `.briefops/`.

BriefOps can generate Codex skill-plugin assets, but the plugin calls the local CLI and local `.briefops/` workspace. No hosted service or required marketplace is involved.

## Release Status

BriefOps 1.0 is intended for developers who want a local-first memory and context ledger for AI coding agents. The public CLI and file-format compatibility policy is documented in `docs/compatibility.md` and `docs/file-format.md`. The core safety principles are stable:

- local files first
- no hosted service required
- no required MCP server
- human-approved memory
- shared-only export controls
- deterministic CLI behavior

For privacy guarantees, see `docs/privacy-model.md`.

## Open Source Trust Boundary

Before publishing a repository or sharing generated context, review:

- `SECURITY.md` for vulnerability reporting and local data handling.
- `CONTRIBUTING.md` for development checks and safety rules.
- `CHANGELOG.md` for release notes.
- `docs/file-format.md` and `docs/compatibility.md` for the 1.0 local data contract.
- `docs/privacy-model.md` for export-policy and local data boundaries.

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

Check the CLI:

```bash
briefops --version
briefops --help
```

## 5-Minute Codex Quickstart

This is the primary BriefOps workflow.

### 1. Initialize

```bash
briefops init
```

This creates a local `.briefops/` workspace.

### 2. Install Codex Guidance

```bash
briefops codex install
briefops codex plugin install
```

This creates or updates `AGENTS.md` with BriefOps guidance and creates `.briefops/codex/prompts/`.
`briefops codex plugin install` writes a deterministic local plugin bundle under `.briefops/codex/plugin/briefops`. It does not publish to a marketplace and does not write to global Codex folders by default.

### 3. Create A Skill

```bash
briefops skill create risk-review \
  --description "Review changes for risk and governance violations" \
  --tags "review,risk,governance"
```

A skill is a reusable working protocol.

### 4. Create Project Context

```bash
briefops project create atlas-q \
  --description "Rule-based non-ML quantitative trading system" \
  --tags "quant,trading"
```

A project stores durable facts and constraints.

### 5. Create A Worker

```bash
briefops worker create quant-reviewer \
  --project atlas-q \
  --skills "risk-review" \
  --style "governance-first,no strategy drift without approval"

briefops worker use quant-reviewer
```

A worker is the persistent identity BriefOps carries across fresh threads: default project, skill bundle, style, lessons, risks, and judgment profile. `worker use` makes it the default worker for start-of-thread priming.

### 6. Prime A Fresh Codex Thread

```bash
briefops prime \
  --task "Review this PR for risk policy violations." \
  --format codex \
  --max-tokens 800
```

Paste the compact prime context into Codex first. It is smaller than a full resume pack and is designed to reduce repeated history/context lookup.

Codex-format prime output includes an operating note for Codex: use the selected worker/project context, inspect only files needed for the task, and never apply memory or skill patches without user approval.

### 7. Start A Codex Mission When Needed

```bash
briefops codex mission \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --mode loop \
  --completion-promise "Deliver verified findings and no unresolved blocking risk." \
  --save
```

Paste the generated mission prompt into Codex.

### 8. Finish The Task

When Codex finishes, record what happened:

```bash
briefops finish \
  --project atlas-q \
  --skill risk-review \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --result "Found missing turnover warning check." \
  --lesson "Verify turnover warning threshold when rebalance logic changes." \
  --decision "Treat unverified slippage assumptions as blocking before merge recommendation." \
  --open-risk "Slippage assumptions remain unverified." \
  --next-step "Continue the review and finish unresolved slippage checks." \
  --commands "npm test,npm run build"
```

`finish` always writes a work log when `--task` and `--result` are valid. If the log has no durable memory candidates, `finish` warns and still prints the next `briefops continue` command.

### 9. Review And Apply Memory

Memory is human-approved. Review the proposal:

```bash
briefops memory proposal-show latest
```

Apply it only when useful:

```bash
briefops memory proposal-apply latest
```

You can also use the convenience command:

```bash
briefops approve latest
```

### 10. Continue In A Fresh Thread

```bash
briefops continue \
  --worker quant-reviewer \
  --task "Continue the review and finish unresolved slippage checks." \
  --pack
```

`continue --pack` checks continuity health, warns about pending memory proposals, refreshes worker intelligence, saves a handoff, saves a Codex resume prompt, saves a portable resume pack, and prints all generated paths.

## Shared-Only Export Path

Use shared-only output when context may leave the local terminal or local Codex session:

```bash
briefops prime --task "Continue unresolved checks." --format codex --export-policy shared-only
briefops pack resume --worker quant-reviewer --task "Continue unresolved checks." --export-policy shared-only
```

`shared-only` includes only memory items where `visibility: shared` and `exportable: true`.

It omits private memory, local project file details, raw work logs, open risks, local next steps, private worker lessons, private incidents, recent work history, and private metadata counts.

`local-private` is intended for local terminal/Codex use only and may include local private continuity context.

BriefOps skills must never auto-approve memory proposals or skill patches.

## Local Harness Export

Generate local harness instruction files when you want Codex, Claude Code, or Cursor to know how to call BriefOps:

```bash
briefops export agents-md
briefops export claude-md
briefops export cursor-rules
briefops export all
```

Exports are routers, not memory dumps. They tell local AI tools to run `briefops prime`, `briefops finish`, `briefops approve`, and `briefops continue --pack`.

They do not copy `.briefops` memory, raw logs, private decisions, incidents, handoffs, or worker summaries into `AGENTS.md`, `CLAUDE.md`, or Cursor rules. Export commands default to `--export-policy shared-only` because these files are often committed.

## Context Minimalism

Inspect the built-in budget policy:

```bash
briefops inspect budget
```

Compare raw local candidate context to compact prime output:

```bash
briefops compare context --worker quant-reviewer --task "Review this PR."
```

BriefOps should not become the context bloat it was built to prevent. Use `prime` first, then generate a handoff or resume pack only when continuity needs more detail.

## Memory Hygiene

Not every task deserves durable memory. Use durable memory for decisions, lessons, incidents, open risks, and reusable constraints:

```bash
briefops finish --importance trivial --task "Fix typo" --result "Fixed typo."
briefops finish --no-memory-proposal --task "Experiment" --result "Discarded."
briefops memory hygiene
briefops memory prune --dry-run
```

`memory hygiene` and `memory prune --dry-run` are read-only in this release. They report bloat, stale items, deprecated items, and duplicate-like memory without deleting anything.

## Privacy Check

Run this before publishing a repository, sharing a pack, or attaching BriefOps context outside your machine:

```bash
briefops doctor --privacy
briefops doctor --privacy --fix-gitignore
```

BriefOps is local-first, but `.briefops/` may contain private logs and memory. Keep `.briefops/` out of source control unless you intentionally curated the contents.

`doctor --privacy` checks local memory sharing hazards, including `.briefops/` gitignore coverage, private/exportable memory, and secret-like memory strings.

## Pre-Publish Readiness

Before `npm publish`, run the local release checks and review the package contents:

```bash
npm run build
npm test
npm pack --dry-run
```

Run `npm audit --audit-level=moderate` or `npm run verify:release` only from an environment where sending dependency metadata to the npm registry is acceptable.

Confirm:

- generated harness files are routers, not `.briefops` memory dumps
- `briefops --version` matches `package.json`
- `.briefops/` is ignored or intentionally curated
- `SECURITY.md`, `CHANGELOG.md`, and the release checklist reflect the shipped behavior
- `npm pack --dry-run` includes `dist`, docs, examples, plugins, README, LICENSE, SECURITY, CONTRIBUTING, CODE_OF_CONDUCT, and CHANGELOG

## Harness Integrations

BriefOps works best as a local memory ledger beside stronger harnesses such as Codex, LazyCodex, OmO, Claude Code, Cursor, and OpenCode. See `docs/integrations/harnesses.md`.

## Finish / Continue UX

`finish` records what happened.

It writes a work log, proposes durable memory when the log contains useful candidates, can propose a skill patch, can refresh the worker summary, and prints the next `briefops continue` command.

`continue` prepares the same worker for a fresh thread.

It inspects continuity health, warns about pending memory proposals, refreshes the worker summary, generates a handoff, and saves a Codex resume prompt. Add `--pack` when you also want one self-contained markdown file.

```bash
briefops finish \
  --worker quant-reviewer \
  --project atlas-q \
  --skill risk-review \
  --task "Review rebalance logic." \
  --result "Found missing turnover warning check." \
  --lesson "Always verify turnover warning threshold." \
  --next-step "Continue unresolved slippage checks."

briefops memory proposal-show latest
briefops memory proposal-apply latest

briefops continue \
  --worker quant-reviewer \
  --task "Continue unresolved slippage checks." \
  --pack
```

If pending memory proposals exist, `continue` prints explicit review, apply, and reject commands. It never applies memory automatically.

## Portable Resume Pack

Use `pack resume` when Codex cannot access your local `.briefops` workspace or when you want one markdown file to paste or attach to a fresh thread.

```bash
briefops pack resume \
  --worker quant-reviewer \
  --task "Continue unresolved slippage checks."
```

Portable packs are self-contained and include continuity context directly. Review packs before sharing outside your local machine. They may include local project memory, decisions, lessons, risks, and worker history.

By default, packs include private memory because pack generation is an explicit local user action. Memory still stores `visibility` and `exportable` metadata for future filtering:

```bash
briefops memory add \
  --type lessons \
  --content "Always verify turnover warning threshold." \
  --visibility shared \
  --exportable
```

Defaults:

```yaml
visibility: private
exportable: false
```

BriefOps does not add cloud sync or encryption.

## Approvals

Memory and skill changes are human-approved.

Use explicit proposal commands:

```bash
briefops memory proposal-show latest
briefops memory proposal-apply latest
briefops memory proposal-reject latest

briefops skill patch-show latest
briefops skill apply-patch risk-review --patch latest
briefops skill reject-patch latest
```

Or use the convenience approval command:

```bash
briefops approve latest
briefops approve memory latest
briefops approve skill-patch latest
```

`briefops approve <id|latest>` tries memory first. If no matching memory proposal exists, it tries a skill patch. It applies at most one item.

## Inbox

Use `inbox` to see pending memory proposals, skill patches, open risks, stale or deprecated memory counts, and recommended next commands.

```bash
briefops inbox
briefops inbox --project atlas-q
briefops inbox --worker quant-reviewer
briefops inbox --skill risk-review
```

`inbox` is read-only. It does not mutate files.

## Core Concepts

| Concept | What It Is | Stored At |
|---|---|---|
| Skill | Reusable task protocol | `.briefops/skills/*.skill.md` |
| Project | Durable project facts and constraints | `.briefops/projects/*.project.md` |
| Worker | Persistent skill bundle and judgment profile | `.briefops/workers/*.worker.yaml` |
| Worker Summary | Refreshed worker intelligence | `.briefops/workers/summaries/*.summary.md` |
| Work Log | Completed task record | `.briefops/logs/*.yaml` |
| Memory | Curated facts, decisions, lessons, incidents | `.briefops/memory/*.yaml` |
| Memory Proposal | Human-reviewed memory candidate | `.briefops/memory-proposals/*.yaml` |
| Skill Patch | Human-reviewed skill improvement | `.briefops/patches/*.patch.yaml` |
| Handoff | Fresh-thread continuity brief | `.briefops/handoffs/*.md` |
| Codex Prompt | Mission or resume prompt | `.briefops/codex/prompts/*.md` |
| Portable Pack | Self-contained resume markdown | `.briefops/codex/prompts/*resume-pack*.md` |
| Eval | Deterministic checklist case | `.briefops/evals/*.eval.yaml` |

## Memory

Manual memory add:

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

Statuses:

- `active`
- `stale`
- `deprecated`
- `superseded`
- `archived`

Visibility:

- `private`
- `shared`
- `public`

List, show, and update memory:

```bash
briefops memory list
briefops memory list --project atlas-q --status active
briefops memory show <memory-id>
briefops memory update-status <memory-id> --status archived
```

Promote useful work-log items through a proposal:

```bash
briefops memory propose-from-log latest
briefops memory proposal-list --status proposed
briefops memory proposal-show <proposal-id|latest>
briefops memory proposal-apply <proposal-id|latest>
briefops memory proposal-reject <proposal-id|latest>
```

Extraction is deterministic and local. Lessons, decisions, incidents, open risks, prefixed notes, and policy-like next steps can become proposal items. Proposal generation and approval are local file-backed operations protected by workspace locks.

## Skills And Skill Patches

Create and inspect skills:

```bash
briefops skill create risk-review
briefops skill list
briefops skill show risk-review
briefops skill history risk-review
```

Propose, review, apply, or reject skill patches:

```bash
briefops skill propose-patch --skill risk-review --from-log latest
briefops skill patch-list
briefops skill patch-show <patch-id|latest>
briefops skill apply-patch risk-review --patch <patch-id|latest>
briefops skill reject-patch <patch-id|latest>
```

Skill patches are generated from work-log lessons and are never auto-applied.

## Projects And Workers

Projects:

```bash
briefops project create atlas-q
briefops project list
briefops project show atlas-q
```

Workers:

```bash
briefops worker create quant-reviewer --project atlas-q --skills "risk-review"
briefops worker list
briefops worker show quant-reviewer
briefops worker refresh-summary quant-reviewer
briefops worker intelligence quant-reviewer
briefops worker inspect quant-reviewer
```

Use a worker for fresh-thread continuity:

```bash
briefops codex mission --worker quant-reviewer --task "Review this PR." --mode loop --save
briefops continue --worker quant-reviewer --task "Continue prior work." --pack
```

## Briefs, Handoffs, And Codex Prompts

Generate a plain brief:

```bash
briefops brief generate \
  --worker quant-reviewer \
  --task "Review this PR for risk policy violations." \
  --adapter codex
```

Generate a handoff:

```bash
briefops handoff generate \
  --project atlas-q \
  --worker quant-reviewer \
  --task "Continue unresolved slippage checks." \
  --save
```

Add `--export-policy shared-only` to handoff or Codex resume output when the artifact may leave the local workspace. Shared-only handoffs, resumes, and packs omit private continuity content and private metadata counts.

Generate a Codex resume prompt:

```bash
briefops codex resume \
  --worker quant-reviewer \
  --task "Continue unresolved slippage checks." \
  --from-handoff latest \
  --mode loop \
  --save
```

List and inspect saved artifacts:

```bash
briefops brief list
briefops brief show latest
briefops brief inspect latest

briefops handoff list
briefops handoff show latest
briefops handoff inspect latest
```

## Inspect, Doctor, And Evals

```bash
briefops doctor
briefops doctor --privacy
briefops doctor --security
briefops doctor --security --fix-stale-locks
briefops inspect workspace
briefops inspect memory
briefops inspect tokens --worker quant-reviewer --task "Review this PR." --budget 2500
briefops inspect retrieval --project atlas-q --worker quant-reviewer --task "Continue slippage checks."
briefops inspect continuity --project atlas-q --worker quant-reviewer
```

`doctor --security --fix-stale-locks` removes stale locks only; it does not remove fresh locks or other workspace files.

Evals are deterministic checklist checks. They do not call an LLM judge.

```bash
briefops eval create turnover-missing-case \
  --skill risk-review \
  --project atlas-q \
  --input "Review rebalance logic." \
  --expected "turnover warning threshold"

briefops eval run --skill risk-review --project atlas-q
briefops eval list
briefops eval show turnover-missing-case
```

## Token Budget Philosophy

BriefOps uses a deterministic estimate:

```text
estimated_tokens = ceil(character_count / 4)
```

When generated briefs, handoffs, or resumes are too large, BriefOps trims lower-priority context while preserving the task and core continuity contract. If a portable pack exceeds the requested budget, BriefOps prints a warning and preserves core continuity content.

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
+-- memory-proposals/
+-- workers/
|   +-- summaries/
+-- logs/
+-- handoffs/
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

Because `.briefops/` is local/private, Codex does not automatically see it. Provide a saved Codex resume prompt or portable resume pack when starting a fresh thread that needs prior worker context.

## Command Reference

```bash
briefops init
briefops doctor
briefops doctor --privacy
briefops doctor --security
briefops inbox
briefops inbox --project <project>
briefops inbox --worker <worker>
briefops inbox --skill <skill>

briefops finish --worker <worker> --project <project> --skill <skill> --task "<task>" --result "<result>"
briefops continue --worker <worker> --task "<task>"
briefops continue --worker <worker> --task "<task>" --pack
briefops pack resume --worker <worker> --task "<task>"

briefops approve <id|latest>
briefops approve memory <id|latest>
briefops approve skill-patch <id|latest>

briefops skill create <name>
briefops skill list
briefops skill show <name>
briefops skill diff <name>
briefops skill history <name>
briefops skill propose-patch --skill <name> --from-log <log-id|latest>
briefops skill patch-list
briefops skill patch-show <patch-id|latest>
briefops skill apply-patch <name> --patch <patch-id|latest>
briefops skill reject-patch <patch-id|latest>

briefops project create <name>
briefops project list
briefops project show <name>

briefops memory add --type <type> --content "<content>"
briefops memory add --type lessons --content "<content>" --visibility shared --exportable
briefops memory list
briefops memory show <id>
briefops memory update-status <id> --status <status>
briefops memory propose-from-log <log-id|latest>
briefops memory proposal-list --status proposed
briefops memory proposal-show <proposal-id|latest>
briefops memory proposal-apply <proposal-id|latest>
briefops memory proposal-reject <proposal-id|latest>

briefops brief generate --skill <name> --project <name> --task "<task>" --adapter codex
briefops brief generate --worker <worker> --task "<task>" --adapter codex
briefops brief list
briefops brief show <id|latest>
briefops brief inspect <id|latest>

briefops codex install
briefops codex mission --worker <worker> --task "<task>" --mode loop --save
briefops codex plan --project <project> --idea "<what to build>" --save
briefops codex resume --worker <worker> --task "<task>" --from-handoff <id|latest> --mode loop --save

briefops log add
briefops log list
briefops log show <id|latest>

briefops worker create <worker>
briefops worker list
briefops worker show <worker>
briefops worker summary <worker>
briefops worker intelligence <worker>
briefops worker refresh-summary <worker>
briefops worker inspect <worker>

briefops handoff generate --project <project> --worker <worker> --task "<task>" --save
briefops handoff list
briefops handoff show <id|latest>
briefops handoff inspect <id|latest>

briefops inspect tokens
briefops inspect workspace
briefops inspect memory
briefops inspect retrieval --project <project> --worker <worker> --task "<task>"
briefops inspect continuity --project <project> --worker <worker>

briefops eval create <name>
briefops eval list
briefops eval run --skill <skill> --project <project>
briefops eval show <id>
```

## Troubleshooting

Workspace not found:

```bash
briefops init
```

Pending memory before continuing:

```bash
briefops memory proposal-list --status proposed
briefops memory proposal-show latest
briefops memory proposal-apply latest
```

Need a fresh thread without `.briefops` access:

```bash
briefops continue --worker <worker> --task "<task>" --pack
```

Brief or resume is too long:

```bash
briefops inspect tokens --worker <worker> --task "<task>" --budget 2500
```

Check continuity health:

```bash
briefops inspect continuity --project <project> --worker <worker>
```

## Development

```bash
npm install
npm run build
npm test
```

Run the CLI in development:

```bash
npm run dev -- --help
```
