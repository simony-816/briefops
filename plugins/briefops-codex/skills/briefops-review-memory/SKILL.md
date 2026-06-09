---
name: briefops-review-memory
description: Use when BriefOps reports pending memory proposals or skill patches that need human review before becoming durable local memory
---

# BriefOps Review Memory

The BriefOps plugin is a local CLI helper. It does not require network access, does not publish to a marketplace, and should not auto-approve memory or skill patches.

Use `--export-policy shared-only` before copying context outside the local workspace.

BriefOps memory is human-approved. Pending proposals are local drafts until the user accepts or rejects them.

Inspect proposals before applying:

```bash
briefops memory proposal-show latest
briefops inbox
```

Apply only after explicit user confirmation:

```bash
briefops approve latest
```

Reject inaccurate, duplicate, sensitive, or overly broad proposals instead of carrying noisy context into future threads.
