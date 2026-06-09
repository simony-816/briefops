# Codex First Context Example

This example shows the intended BriefOps first-context workflow.

The problem: a fresh Codex thread often spends tokens rediscovering project history, prior decisions, unresolved risks, and worker habits.

The BriefOps path:

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops skill create risk-review
briefops project create atlas-q
briefops worker create quant-reviewer --project atlas-q --skills risk-review
briefops worker use quant-reviewer
briefops prime --task "Continue unresolved slippage checks." --format codex --max-tokens 800
```

`briefops prime` is intentionally smaller than a handoff or portable resume pack. It selects the smallest useful context for starting work, then points Codex to the next command only when a full continuation pack is actually needed.

For portable/shared artifacts:

```bash
briefops prime --task "Continue unresolved slippage checks." --format codex --export-policy shared-only
briefops pack resume --worker quant-reviewer --task "Continue unresolved slippage checks." --export-policy shared-only
```

`shared-only` omits private memory, raw local work logs, open risks, local next steps, private worker lessons, private incidents, and recent work history. `local-private` is intended for local terminal/Codex use only.

BriefOps skills must never auto-approve memory proposals or skill patches.

Harnesses such as LazyCodex or OmO can use BriefOps as the first local context ledger before they run their own orchestration. Keep approval human-confirmed: do not let a harness auto-run `briefops approve latest`.

Files:

- `before-manual-history-dump.md` shows the kind of repeated context users often paste manually.
- `after-briefops-prime.md` shows the compact shape BriefOps should produce.
