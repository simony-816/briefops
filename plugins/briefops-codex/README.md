# BriefOps Codex Plugin

This is a skill-only Codex plugin bundle for BriefOps.

It does not run a hosted service and does not sync data. The skills call the local `briefops` CLI and local `.briefops/` workspace.

Recommended local setup:

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops worker use <worker>
briefops prime --task "Start this task." --format codex
```

The generated local plugin copy is written to:

```text
.briefops/codex/plugin/briefops
```
