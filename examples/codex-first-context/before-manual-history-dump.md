# Manual History Dump

Project: atlas-q is a rule-based quantitative trading system.

Worker: quant-reviewer reviews risk and governance before merge recommendations.

Prior notes repeated into fresh threads:

- Always verify turnover warning threshold before recommending merge.
- Treat unverified slippage assumptions as blocking.
- Missing turnover warning checks were previously missed during rebalance review.
- Slippage assumptions remain unresolved until checked against policy.
- Continue by inspecting risk policy and adding slippage verification to the review checklist.
- The worker style is skeptical and verification-first.
- The project does not allow strategy drift without approval.
- The reviewer should call out unresolved risk explicitly.

This kind of manual context grows quickly as logs, handoffs, and memory files accumulate.
