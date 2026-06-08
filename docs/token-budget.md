# Token Budget

BriefOps estimates tokens locally and reports section budgets in generated artifacts.

Brief generation uses the final rendered Markdown estimate as `totalTokens`. Inspection calls the same generate path so token reports match generated output.

Handoffs also include section budgets and warnings when generated content exceeds the requested budget.

`briefops prime` is the smallest start-of-thread artifact. Use it before broad history inspection:

```bash
briefops prime --task "Continue unresolved checks." --format codex --max-tokens 800
```

For sharing outside the local machine, use:

```bash
briefops prime --task "Continue unresolved checks." --export-policy shared-only
briefops pack resume --worker <worker> --task "Continue unresolved checks." --export-policy shared-only
```
