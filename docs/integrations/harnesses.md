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

To generate always-visible harness router files:

```bash
briefops export agents-md
briefops export claude-md
briefops export cursor-rules
briefops export all
```

These files should stay compact. They teach harnesses how to call BriefOps and do not copy private memory, raw logs, handoffs, or worker summaries.

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
