# Quickstart

## Codex First Context Path

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops skill create risk-review --description "Review risk and governance."
briefops project create atlas-q --description "Rule-based quantitative system."
briefops worker create quant-reviewer --project atlas-q --skills "risk-review" --style "skeptical,verify before completion"
briefops worker use quant-reviewer
briefops export all --worker quant-reviewer --force
briefops memory add --type lessons --project atlas-q --skill risk-review --content "Always verify turnover warning threshold."
briefops prime --task "Continue rebalance review" --format codex --max-tokens 800
```

`briefops codex plugin install` is local and deterministic. It does not publish to a marketplace and does not write to global Codex folders by default.

`briefops export all` writes router files for Codex, Claude Code, and Cursor. These files point harnesses at BriefOps commands and do not copy `.briefops` memory, logs, handoffs, or worker summaries.

## Persistent Worker Path

After work finishes, log the result and promote only useful lessons:

```bash
briefops finish --project atlas-q --skill risk-review --worker quant-reviewer --task "Review rebalance" --result "Found missing turnover warning check." --lesson "Always verify turnover warning threshold."
briefops approve latest
briefops continue --worker quant-reviewer --task "Continue rebalance review" --pack
```

BriefOps skills must never auto-approve memory proposals or skill patches. Approval is a human step.

For small or exploratory work, keep durable memory clean:

```bash
briefops finish --task "Fix typo" --result "Fixed typo." --importance trivial
briefops finish --task "Try discarded approach" --result "Discarded." --no-memory-proposal
briefops memory hygiene
briefops memory prune --dry-run
```

## Shared-Only Export Path

```bash
briefops prime --task "Continue unresolved checks." --format codex --export-policy shared-only
briefops pack resume --worker quant-reviewer --task "Continue unresolved checks." --export-policy shared-only
```

`shared-only` omits private memory, local project file details, raw work logs, open risks, local next steps, private worker lessons, private incidents, recent work history, and private metadata counts.

`local-private` is intended for local terminal/Codex use only.

## Privacy Check

Before publishing a repository or sharing generated context, run:

```bash
briefops doctor --privacy
briefops doctor --privacy --fix-gitignore
briefops doctor --stability
```

`.briefops/` can contain private local work logs and memory. Keep it ignored unless you intentionally curated the contents for sharing.

`doctor --privacy` checks local memory sharing hazards, including `.briefops/` gitignore coverage, private/exportable memory, and secret-like memory strings.

`doctor --stability` is a read-only local integrity check for schema validity, duplicate memory ids, broken references, managed-path symlinks, and orphaned review artifacts. Its detailed output is bounded and is not added to `prime`, handoff, resume, or pack context.

## Context Budget Check

```bash
briefops inspect budget
briefops compare context --worker quant-reviewer --task "Continue rebalance review"
```

Use these before adding more always-loaded instructions. BriefOps works best when `prime` stays compact and full resume packs are generated only when needed.
