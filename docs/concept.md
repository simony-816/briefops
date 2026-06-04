# BriefOps Concept

BriefOps is a local-first, token-aware persistent work history layer for AI coding agents.

It does not run Codex, Claude Code, or other agents. It prepares compact continuity artifacts so a fresh thread can start with the usable parts of prior work: project constraints, worker style, active decisions, lessons, incidents, and recent logs.

The core loop is:

```text
brief -> work -> log -> proposal -> approved memory -> worker summary -> handoff/resume
```

Raw logs remain audit records. Memory is curated operational knowledge that requires human approval.
