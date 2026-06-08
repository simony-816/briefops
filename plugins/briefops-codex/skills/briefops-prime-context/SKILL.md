---
name: briefops-prime-context
description: Use when starting work in any Codex project or fresh thread to load the smallest useful BriefOps context before reading large history files
---

# BriefOps Prime Context

Use BriefOps before broad repo/history inspection when a `.briefops` workspace exists or may exist.

Run:

```bash
briefops prime --format codex --task "<current user task>" --max-tokens 800
```

If the command reports that no workspace exists, keep the response short and suggest `briefops init`.

Never apply memory automatically. If pending proposals exist, show the review command.

Treat the prime output as a compact routing brief, not as permission to skip relevant code inspection.
