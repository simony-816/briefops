# Token Budget

BriefOps estimates tokens locally and reports section budgets in generated artifacts.

Brief generation uses the final rendered Markdown estimate as `totalTokens`. Inspection calls the same generate path so token reports match generated output.

Handoffs also include section budgets and warnings when generated content exceeds the requested budget.

View the default budget policy:

```bash
briefops inspect budget
```

Current targets:

- `AGENTS.md`: 500 tokens
- `CLAUDE.md`: 700 tokens
- Cursor rule: 350 tokens
- Cursor rules total: 1200 tokens
- prime default: 800 tokens
- handoff default: 2500 tokens
- resume pack default: 3000 tokens

`briefops prime` is the smallest start-of-thread artifact. Use it before broad history inspection:

```bash
briefops prime --task "Continue unresolved checks." --format codex --max-tokens 800
```

For sharing outside the local machine, use:

```bash
briefops prime --task "Continue unresolved checks." --export-policy shared-only
briefops pack resume --worker <worker> --task "Continue unresolved checks." --export-policy shared-only
```

`shared-only` includes only memory items marked `visibility: shared` and `exportable: true`.
It omits private memory, local project file details, raw work logs, open risks, local next steps, private worker lessons, private incidents, recent work history, and private metadata counts.

`local-private` is intended for local terminal/Codex use only.

## Compare Context

Use `compare context` to see why BriefOps compiles context instead of dumping history:

```bash
briefops compare context --worker <worker> --task "Review this PR."
```

The command estimates local `.briefops` candidate inputs such as project context, worker summary, active memory, and recent logs, then compares them with compiled `briefops prime` output.

## Harness Router Budgets

Harness exports should stay small:

```bash
briefops export agents-md
briefops export claude-md
briefops export cursor-rules
```

These exports are routers. They include command usage and safety boundaries, not raw memory, logs, decisions, incidents, or handoffs.
