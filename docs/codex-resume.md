# Codex Resume

`briefops codex resume` combines a handoff brief with a Codex execution contract.

```bash
briefops codex resume --worker quant-reviewer --task "Continue the rebalance review and identify remaining risks." --save
```

Use `--export-policy shared-only` when the resume prompt may be pasted outside the local Codex workspace.

Shared-only resume output includes selected shared/exportable memory and omits private memory, local project file details, raw work logs, open risks, local next steps, private worker history, and private metadata counts.

The generated prompt includes continuity rules, evidence gates, a completion signal, and after-completion logging instructions.

Local-private resume output can include recent work-log lessons and decisions before they are promoted to durable memory. This keeps fresh-thread handoff usable while memory proposals remain pending for human review.
