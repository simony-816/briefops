# Persistent Worker Demo

This example shows BriefOps carrying work memory across fresh AI coding threads.

Before: the user pastes repeated project rules, prior decisions, and missed-check lessons into every new thread.

After:

```bash
briefops codex resume --worker quant-reviewer --task "Continue the rebalance review and identify remaining risks."
```

The resume prompt includes a compact handoff, worker judgment rules, recent work, active decisions, lessons, incidents, evidence gates, and after-completion logging commands.

The `briefops-workspace/` folder mirrors the important `.briefops/` files for a small atlas-q project.
