# Codex First Context Example

This example shows the intended BriefOps first-context workflow.

The problem: a fresh Codex thread often spends tokens rediscovering project history, prior decisions, unresolved risks, and worker habits.

The BriefOps path:

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops worker use quant-reviewer
briefops prime --task "Continue unresolved slippage checks." --format codex --max-tokens 800
```

`briefops prime` is intentionally smaller than a handoff or portable resume pack. It selects the smallest useful context for starting work, then points Codex to the next command only when a full continuation pack is actually needed.

Files:

- `before-manual-history-dump.md` shows the kind of repeated context users often paste manually.
- `after-briefops-prime.md` shows the compact shape BriefOps should produce.
