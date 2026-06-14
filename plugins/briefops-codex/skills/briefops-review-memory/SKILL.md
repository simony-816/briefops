---
name: briefops-review-memory
description: Use when BriefOps reports pending local memory proposals or skill patches that need inspection
---

# BriefOps Review Memory

The BriefOps plugin is a local CLI helper. It does not require network access and does not publish to a marketplace.

BriefOps may update directory-local `.briefops/` memory. Use `--export-policy shared-only` before copying context outside the local workspace, and ask before applying skill patches.

BriefOps memory is directory-local. Pending memory proposals are optional audit/review drafts; they should not block normal continuation.

Inspect proposals before applying:

```bash
briefops memory proposal-show latest
briefops inbox
```

Apply relevant local memory proposals directly, or reject inaccurate, duplicate, sensitive, or overly broad proposals:

```bash
briefops memory proposal-apply latest
briefops memory proposal-reject latest
```

Ask before applying skill patches or exporting private memory outside the local workspace.
