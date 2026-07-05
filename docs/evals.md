# Evals

BriefOps evals are deterministic checklist cases for generated artifacts.

Use them to verify that important context appears in generated briefs:

```bash
briefops eval create continuity-rebalance --worker quant-reviewer --input "Continue rebalance review" --expected "turnover warning threshold"
briefops eval run --worker quant-reviewer
```

Continuity evals should check for prior lessons, decisions, and sections that a fresh thread needs before acting.

Prime-context evals should also check that the compact output is materially smaller than a manual history dump:

```bash
npm test -- tests/prime.test.ts
```

For real task utility, use the manual utility log:

- [BriefOps Utility Log](evals/briefops-utility-log.md)

The utility log is for local, task-by-task review of re-explanation, preserved
decisions, preserved risks, handoff quality, routing fit, and verification
discipline. It complements checklist evals without adding telemetry,
dashboards, databases, or cloud analytics.
