# Token Budget

BriefOps estimates tokens locally and reports section budgets in generated artifacts.

Brief generation uses the final rendered Markdown estimate as `totalTokens`. Inspection calls the same generate path so token reports match generated output.

Handoffs also include section budgets and warnings when generated content exceeds the requested budget.
