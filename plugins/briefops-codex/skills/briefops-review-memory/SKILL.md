---
name: briefops-review-memory
description: Use when BriefOps reports pending memory proposals or skill patches that need human review before becoming durable local memory
---

# BriefOps Review Memory

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
