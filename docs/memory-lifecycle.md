# Memory Lifecycle

BriefOps separates raw logs from durable memory.

Allowed flow:

```text
log -> memory proposal -> human approval -> memory
```

Commands:

```bash
briefops memory propose-from-log latest
briefops memory proposal-list
briefops memory proposal-show <proposal-id>
briefops memory apply-proposal <proposal-id>
briefops memory reject-proposal <proposal-id>
```

Extraction is deterministic and local. Lessons become lesson memory. Notes prefixed with `decision:` or `fact:` become matching memory candidates. Results containing risk or failure language become incident candidates.
