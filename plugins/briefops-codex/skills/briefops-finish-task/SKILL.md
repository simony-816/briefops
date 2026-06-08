---
name: briefops-finish-task
description: Use when finishing a Codex task to record the outcome, propose durable memory, and prepare the next thread without auto-approving memory
---

# BriefOps Finish Task

Use BriefOps at the end of meaningful work so future Codex threads do not spend tokens rediscovering the same decisions, risks, and lessons.

Run a scoped finish command with the actual result and any durable candidates:

```bash
briefops finish --worker <worker> --task "<task>" --result "<result>" --lesson "<lesson>" --next-step "<next step>"
```

Only include lessons, decisions, incidents, open risks, and next steps that will help future work. Do not store secrets or personal data.

If a memory proposal is created, ask the user to review it. Never run `briefops approve` without explicit user confirmation.
