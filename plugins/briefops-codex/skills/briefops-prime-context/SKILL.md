---
name: briefops-prime-context
description: Use when starting work in any Codex project or fresh thread to load the smallest useful BriefOps context before reading large history files
---

# BriefOps Prime Context

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.

BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

Use BriefOps before broad repo/history inspection when a `.briefops` workspace exists or may exist.

Run:

```bash
briefops prime --format codex --task "<current user task>" --max-tokens 800
```

If the command reports `setup-required`, keep the response short and suggest `briefops bootstrap` for first adoption.

BriefOps memory is directory-local. `briefops finish` auto-promotes durable memory by default; pending proposals from older or review-mode flows can be applied locally without blocking the task.

Treat the prime output as a compact routing brief, not as permission to skip relevant code inspection.
