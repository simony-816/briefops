# Atlas-Q Example

This folder is a tiny placeholder example for the README workflow.

Example BriefOps setup:

```bash
briefops init
briefops skill create risk-review --description "Review changes for risk and governance violations" --tags "review,risk,governance"
briefops project create atlas-q --description "Rule-based non-ML quantitative trading system" --tags "quant,trading"
briefops memory add --type lessons --project atlas-q --skill risk-review --content "Always verify turnover warning threshold when rebalance logic changes."
briefops brief generate --skill risk-review --project atlas-q --task "Review recent rebalance logic changes." --budget 2000
```

The generated brief should include the skill, project context, matching active memory, task, delivery format, source references, and token budget report.
