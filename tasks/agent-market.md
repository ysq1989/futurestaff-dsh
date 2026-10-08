# Agent market — platform recipes, local DSH execution

High Risk; deployed, 2026-10-08. Both repositories on main; unrelated changes preserved.
Initial implementation baseline b25c1e8; release aligned to c9101023 before committing.
Platform source baaa9a450115ae28d57f888c2e74609304c80347;
desktop packaged source 7b8267faacc51963d7f0a74d4db4c4c417bbcb66.

Scope: desktop-authenticated builtin catalog 0.1.0; tenant module filtering;
immutable local snapshots; native Preset picker; market and local-role settings UI.
Roles extend trusted standard DSH tools. Remote executable configuration is never loaded.
Unsupported platform skills/connectors cannot be installed. No platform Agent instances.
No background heartbeat or new role memory service in this slice.

Validate backend auth/module filtering and recipe versions; local isolation,
atomic/idempotent installation, restart discovery and tool preservation; package
typecheck/build/tests and repository diff hygiene. Live deployment is separate.

Initial implementation evidence:
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
are separate checks. Publication evidence follows.

Deployment evidence (2026-10-08):
- Platform DEV generation 39 and PROD generation 12; same backend image
  sha256:fd31267f5c48b73aac8e2cda9f9d447b58624a3acd2e58e3aee155b507db25a3.
  PROD manifest sha256:c1820c188cae8ca0354a2806e6d2cca9ea825e1740a0c264bc9f759f5d48847c.
  No migration; schema generations unchanged (DEV 12, PROD 3).
- Actual dependency image excludes pytest. Container imports, OpenAPI route and
  tenant projection passed offline. Live health 200, catalog without bearer 401.
  Unrelated container IDs/start times preserved. Platform deployment audit tags pushed.
- Final access suite 118 passed; stable 1094 and Beta 1029 passed (13 skips each),
  root 64 passed. Build/typechecks, native closure and actual ASAR/Profile inspection passed.
- https://fsstory.net/desktop-updates/stable.json publishes 2.0.15 with rollback 2.0.14.
  Live client signature parser and complete HTTPS installer download verified:
  130942890 bytes, cb5565e34f9bf7a92f5212cdec7dd18b86446d300787ded307552c31456ce021.
  Feed digest 89cb65c4069b8cd895ae7319691c1500528295a6df69f31bee9ad7480a726598.
  Private trust/READY endpoints return 404; update container not restarted.
- The active local identity Profile has a pre-existing inference-service extension,
  so the strict bundled upgrade deliberately preserves it. Applied a reviewed nine-file
  market-only overlay with backups outside Git: new market/role modules and browser,
  additive authorization/mount/settings edits, and native Preset root configuration.
  Existing inference registration, identity and user history remain in place.
  Syntax and exact code diffs reviewed; current running process awaits the user's
  confirmed update/restart. Local inventory/backup lives in the ignored external build
  directory, not in release artifacts. The installer itself was never executed by Codex.

Rollback: restore the previous signed feed using the established operator tooling
and retain immutable installers. Restore the previous platform backend image
sha256:515b62a89ea161e7f793f5d4e751dfc3ddd3be655cf521d93b98b839f9ee00e2
through a new guarded generation; no schema rollback. For local customization,
restore only backed-up market overlay code/config slots; preserve snapshots/history.

Remaining release acceptance: live authenticated catalog with the deployed endpoint,
native desktop visual/keyboard smoke, actual session restart in the packaged runtime.
Platform-dependent templates, official registry adapter, personal editing and separate
role memory are outside this first slice; see docs/specs/agent-market-v0.1.0.md.

## Recovery-mode fix, 2.0.16

User acceptance exposed a Host startup failure: the market patch replaces the
whole native agent-presets config, so omitting mandatory `default` discarded
the upstream `default: standard`. The initial fixture used mocked preset services
and therefore never exercised the actual Cordis config schema.

Both workspace config generators now explicitly set `default: standard`.
Market marker v2 upgrades v1 workspaces once through the existing restart boundary.
The installed local market row was backed up and repaired without changing
identity, inference registration or user history. Its native plugin bytes match
the test runtime; real AgentPresets.Config validation passed. User restart remains
required to verify full interactive startup.

119 access tests, including real installed-schema validation, passed. Focused
tenant/workspace tests prove v1 upgrade and subsequent idempotency. Desktop stable
1095 tests passed (13 original skips); build/typechecks and Profile staging passed.
Bundled upgrades now recognize complete audited 2.0.14 and 2.0.15 libraries,
preserving custom code. Release 2.0.16 publication is in progress; rollback uses
the last working 2.0.14 installer rather than the affected 2.0.15 build.
