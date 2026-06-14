---
name: briefops-continue-worker
description: Use when continuing a persistent BriefOps worker in a fresh Codex thread with a handoff, resume prompt, or portable pack
---

# BriefOps Continue Worker

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.

BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

Use this workflow when the user wants a fresh Codex thread to continue prior work with the same worker identity, project constraints, memory, and risks.

Prepare a resume prompt and optional portable pack:

```bash
briefops continue --worker <worker> --task "<next task>" --pack
```

Pending memory proposals are optional local review drafts and do not block continuing. Apply relevant local memory when useful; ask before applying skill patches.

Use portable packs only as explicit local user artifacts. They may include private local memory and should be reviewed before sharing.
