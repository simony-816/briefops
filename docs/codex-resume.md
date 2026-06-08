# Codex Resume

`briefops codex resume` combines a handoff brief with a Codex execution contract.

```bash
briefops codex resume --worker quant-reviewer --task "Continue the rebalance review and identify remaining risks." --save
```

Use `--export-policy shared-only` when the resume prompt may be pasted outside the local Codex workspace.

The generated prompt includes continuity rules, evidence gates, a completion signal, and after-completion logging instructions.
