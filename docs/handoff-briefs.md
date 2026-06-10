# Handoff Briefs

Handoff briefs prepare a fresh AI coding thread to continue without restarting from zero.

```bash
briefops handoff generate --worker quant-reviewer --task "Continue rebalance review" --adapter codex --save
```

A handoff includes project context, worker summary, recent work, active decisions, lessons, incidents, deprecated notes when relevant, a recommended start, after-completion commands, and token accounting.

Recent work is immediate continuity, not durable memory approval. Local handoffs include work-log results, lessons, decisions, open risks, incidents, and next steps even when the related memory proposal is still pending. Shared-only handoffs continue to omit raw work logs and private continuity details.
