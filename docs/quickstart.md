# Quickstart

```bash
briefops init
briefops skill create risk-review --description "Review risk and governance."
briefops project create atlas-q --description "Rule-based quantitative system."
briefops worker create quant-reviewer --project atlas-q --skills "risk-review" --style "skeptical,verify before completion"
briefops memory add --type lessons --project atlas-q --skill risk-review --content "Always verify turnover warning threshold."
briefops codex resume --worker quant-reviewer --task "Continue rebalance review" --save
```

After work finishes, log the result and promote only useful lessons:

```bash
briefops log add --project atlas-q --skill risk-review --worker quant-reviewer --task "Review rebalance" --result "Found missing turnover warning check." --lesson "Always verify turnover warning threshold."
briefops memory propose-from-log latest
briefops memory proposal-apply <proposal-id>
briefops worker refresh-summary quant-reviewer
```
