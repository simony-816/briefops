---
name: briefops-finish-task
description: Use when finishing a Codex task to record the outcome, update directory-local durable memory, and prepare the next thread
---

# BriefOps Finish Task

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.

BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

Use BriefOps at the end of meaningful work so future Codex threads do not spend tokens rediscovering the same decisions, risks, and lessons.

Run a scoped finish command with the actual result and any durable candidates:

```bash
briefops finish --worker <worker> --task "<task>" --result "<result>" --lesson "<lesson>" --next-step "<next step>"
```

Only include lessons, decisions, incidents, open risks, and next steps that will help future work. Do not store secrets or personal data.

`briefops finish` applies durable memory locally by default and keeps the proposal file as an audit trail. Use `--memory-review` only when the user explicitly wants a pending review queue.
