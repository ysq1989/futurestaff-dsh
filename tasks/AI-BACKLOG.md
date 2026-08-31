# AI Backlog

Use this backlog when a model allowance is approaching reset. Prefer work that creates durable project value; do not manufacture low-value work only to consume quota.

Optional task tags are `[spark]`, `[codex]`, `[sol]`, `[work]`, and `[any]`. The recommender respects explicit tags first and only infers a model when a tag is absent.

## High value

- [ ] [sol] Review tenant-isolation boundaries across MCP and Runner components.
- [ ] [sol] Review Agent Key security boundaries and audit-log coverage.
- [ ] [codex] Review database/API contracts before the next major milestone.
- [ ] [sol] Review architecture decisions that affect multiple FutureStaff tools.

## Medium value

- [ ] [spark] Identify integration-test gaps for current milestone code.
- [ ] [codex] Audit API consistency and error contracts.
- [ ] [codex] Audit dependency and upgrade risks.
- [ ] [spark] Audit UI consistency for current user-facing flows.

## Filler / small atomic tasks

- [ ] [spark] Fix lint/typecheck warnings.
- [ ] [spark] Add missing focused tests.
- [ ] [spark] Remove verified dead code.
- [ ] [spark] Triage TODO/FIXME items into Atomic Tasks.
- [ ] [spark] Improve developer documentation where behavior is already stable.

## Routing policy

- GPT-5.6 Sol: architecture, product/permission decisions, difficult root-cause analysis, major review.
- GPT-5.3-Codex: complex cross-module implementation and deep repository exploration.
- GPT-5.3-Codex-Spark: small targeted implementation, bug fixes, UI polish, lint/typecheck/test fixes.
- Work: browser/file/operational workflows rather than ordinary coding discussion.

## Session policy

Stop the current coding conversation and create a new Atomic Task when unrelated work accumulates, repeated “while you are here” changes appear, context becomes large, or the current Definition of Done is already satisfied. Commit the completed task before starting the next one.
