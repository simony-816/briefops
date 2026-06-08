# Quickstart

## Codex First Context Path

```bash
briefops init
briefops codex install
briefops codex plugin install
briefops skill create risk-review --description "Review risk and governance."
briefops project create atlas-q --description "Rule-based quantitative system."
briefops worker create quant-reviewer --project atlas-q --skills "risk-review" --style "skeptical,verify before completion"
briefops worker use quant-reviewer
briefops memory add --type lessons --project atlas-q --skill risk-review --content "Always verify turnover warning threshold."
briefops prime --task "Continue rebalance review" --format codex --max-tokens 800
```

`briefops codex plugin install` is local and deterministic. It does not publish to a marketplace and does not write to global Codex folders by default.

## Persistent Worker Path

After work finishes, log the result and promote only useful lessons:

```bash
briefops finish --project atlas-q --skill risk-review --worker quant-reviewer --task "Review rebalance" --result "Found missing turnover warning check." --lesson "Always verify turnover warning threshold."
briefops approve latest
briefops continue --worker quant-reviewer --task "Continue rebalance review" --pack
```

BriefOps skills must never auto-approve memory proposals or skill patches. Approval is a human step.

## Shared-Only Export Path

```bash
briefops prime --task "Continue unresolved checks." --format codex --export-policy shared-only
briefops pack resume --worker quant-reviewer --task "Continue unresolved checks." --export-policy shared-only
```

`shared-only` omits private memory, raw local work logs, open risks, local next steps, private worker lessons, private incidents, and recent work history.

`local-private` is intended for local terminal/Codex use only.
