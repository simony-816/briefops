# Memory Lifecycle

BriefOps separates immediate work continuity from durable memory.

Work logs are written first. They can feed the next local handoff or resume immediately, so a fresh AI coding thread can continue from recent results, lessons, decisions, risks, incidents, and next steps without waiting for a memory review.

Durable memory is the curated layer. It is used for reusable lessons, decisions, facts, incidents, and constraints that should survive beyond the immediate handoff.

Allowed flow:

```text
log -> memory proposal -> human approval -> memory
```

Commands:

```bash
briefops memory propose-from-log latest
briefops memory proposal-list
briefops memory proposal-show <proposal-id>
briefops memory proposal-apply <proposal-id>
briefops memory proposal-reject <proposal-id>
```

Extraction is deterministic and local. Lessons become lesson memory candidates. Notes prefixed with `decision:` or `fact:` become matching memory candidates. Results containing risk or failure language become incident candidates.

Proposal generation and approval are local file-backed operations protected by workspace locks. BriefOps never auto-approves memory or skill patches.
