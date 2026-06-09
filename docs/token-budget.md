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

`shared-only` includes only memory items marked `visibility: shared` and `exportable: true`.
It omits private memory, local project file details, raw work logs, open risks, local next steps, private worker lessons, private incidents, recent work history, and private metadata counts.

`local-private` is intended for local terminal/Codex use only.
