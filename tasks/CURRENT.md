# B01b: Make the FutureStaff Profile release-loadable

- Status: Completed locally; awaiting reviewed commit before desktop-shell integration
- Owner: Computer B / `futurestaff-dsh`
- Risk: Standard (desktop runtime and installer prerequisite; no production identity)
- Baseline: `71174081fbbcd377f61c0abf4fb1874de84199ce`

## Goal

Replace the failing transient DSH launcher with a repository-pinned runtime that
matches the controlled desktop shell, then produce a Profile tree that can be
loaded without development-machine absolute paths. This is the prerequisite for
embedding `futurestaff-alpha` in the Windows installer.

## Acceptance

- [x] The DSH CLI/runtime version is exact and aligned with the controlled desktop shell.
- [x] `profile:dump` loads `futurestaff-alpha` and includes `fs-core` plus `fs-platform-access`.
- [x] A release staging command emits a relocatable Profile with no source-tree junctions or absolute dependency paths.
- [x] Release staging contains only built package files and no credentials, sessions, caches, or development sources/tests.
- [x] Focused tests, full product checks, and repository hygiene checks pass.

## Verification

- `npm run profile:install`: passed with the repository-pinned DSH runtime.
- `npm run profile:dump`: passed and included both FutureStaff rows.
- `npm run profile:dump:release`: passed against the relocatable release tree.
- `node --test test/release-profile.test.js`: 2 passed.
- `FUTURESTAFF_DESKTOP_SHELL_DIR=D:\项目\futurestaff-dsh-desktop npm run check`: passed all workspace checks and 47 root tests.
- Release inspection found no reparse points, source-tree absolute paths, source files, tests, credentials, sessions, or caches.
- `git diff --check`: passed.

## External boundaries

Local Mock only. Do not deploy, sign, publish, use a real account/key, modify the
official `deepseek-harness` submodule, commit, or push during this task without a
new explicit instruction.
