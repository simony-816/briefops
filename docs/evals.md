# Evals

BriefOps evals are deterministic checklist cases for generated artifacts.

Use them to verify that important context appears in generated briefs:

```bash
briefops eval create continuity-rebalance --worker quant-reviewer --input "Continue rebalance review" --expected "turnover warning threshold"
briefops eval run --worker quant-reviewer
```

Continuity evals should check for prior lessons, decisions, and sections that a fresh thread needs before acting.
