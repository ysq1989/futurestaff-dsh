# Agent market — platform recipes, local DSH execution

High Risk; local implementation validated, 2026-10-08. Both repositories on main; existing changes preserved.
Platform baseline b25c1e8. No deployment, migration, credentials, commit or push.

Scope: desktop-authenticated builtin catalog 0.1.0; tenant module filtering;
immutable local snapshots; native Preset picker; market and local-role settings UI.
Roles extend trusted standard DSH tools. Remote executable configuration is never loaded.
Unsupported platform skills/connectors cannot be installed. No platform Agent instances.
No background heartbeat or new role memory service in this slice.

Validate backend auth/module filtering and recipe versions; local isolation,
atomic/idempotent installation, restart discovery and tool preservation; package
typecheck/build/tests and repository diff hygiene. Live deployment is separate.

Evidence:
- Platform focused/regression pytest: 47 passed, 1 existing opt-in test skipped.
- New Python files Ruff passed; main.py has the same 68 diagnostics as HEAD, no new diagnostics.
- fs-platform-access package build/typecheck and 122 tests passed.
- Release Profile staging tests: 2 passed (temporary fixture, no installation).
- Actual Python builtin recipes decoded by the TypeScript client: 38 total, 8 compatible.
- Real DSH SystemPrompt assembly proved role isolation and retained host tools.
- Offline Host path validated catalog → immutable install → native default → local list.
- Both repository diff --check passed. No commit, push, deployment or installed Profile change.

Release authorization (2026-10-08): user approved deployment, task-scoped commit and push.
Candidate excludes pending Douyin, inference-service, window and official-shell migration work.
Platform candidate is based on current remote main c9101023; ADR renumbered to 0044.
Desktop 2.0.15: package 117 tests, root 64 tests and stable 1094 tests passed
(13 original skips), with build/typecheck/runtime-closure checks. Existing workspace
Host/browser lib upgrades only when the complete installed inventory matches
the audited 2.0.14 public release; custom code and user data remain preserved.
Initial production-image pytest could not run because pytest is intentionally
absent; local 47-test evidence and actual-image offline imports/route projection
are separate checks. Signed installer publication remains pending at this source commit.

Remaining release acceptance: live authenticated catalog with the deployed endpoint,
native desktop visual/keyboard smoke, actual session restart in the packaged runtime.
Platform-dependent templates, official registry adapter, personal editing and separate
role memory are outside this first slice; see docs/specs/agent-market-v0.1.0.md.
