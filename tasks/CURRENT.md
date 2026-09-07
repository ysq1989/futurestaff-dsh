# B00: Pin desktop shell and establish the FutureStaff distribution foundation

- Status: Completed
- Owner: Computer B / `futurestaff-dsh`
- Risk: High (desktop distribution and security defaults)
- Platform contract dependency: none for B00; B01 waits for A's versioned Mock

## Goal

Pin DSH Desktop v2.0.5 through the controlled fork, record the exact upstream
and official Harness commits, establish FutureStaff application/storage/logging
identity, and fail closed for third-party network surfaces while retaining the
required Windows desktop capabilities.

## Acceptance

- [x] Product repository checked out on clean `main` at `5b9b51db3a0929c9346d9eb87dc3e53084666bc9`.
- [x] Local desktop checkout uses `main`, intended controlled-fork `origin`, and read-only `upstream` at `v2.0.5`.
- [x] Exact base, license, and official `deepseek-harness` gitlink are recorded.
- [x] Product identity, data directory, log namespace, security defaults, and retained capabilities have executable checks.
- [x] Controlled GitHub fork `ysq1989/futurestaff-dsh-desktop` exists with `main` as default; first reviewed productization commit `3665790fede332762e716074afb319dc997f121c` is recorded as `releaseCommit`.
- [x] Desktop fork applies the local distribution settings; build, typecheck, and focused checks pass.
- [x] Official submodule is shallow-initialized at the exact recorded gitlink and has no local diff.
- [x] B00 handoff records final checks and the remaining publish/sign/deploy boundary.

## Current verification

- Product repository: `FUTURESTAFF_DESKTOP_SHELL_DIR=D:\项目\futurestaff-dsh-desktop npm run check` passed after the release SHA was recorded, including the checkout verifier, 43 root tests, and all workspace tests/builds.
- Desktop fork: build and typecheck passed; focused distribution/log tests are 15 passed.
- Desktop release commit `3665790fede332762e716074afb319dc997f121c` is pushed to the controlled fork's default `main` branch.
- Desktop full plugin suite: 1009 passed, 12 skipped, 3 environment-dependent failures (Electron download unavailable, Windows linked-directory behavior, and packaged pnpm PATH fixture).
- Official submodule is shallow-initialized at `a66e4702047846cdaa10c66c9d3df3951f5ea70d`; `git diff -- deepseek-harness` is empty.

## External boundaries

The user authorized creation of the controlled GitHub fork plus commit and push
for both client repositories on 2026-09-07. Publishing, signing, and deployment
remain out of scope. This task does not modify `FutureStaff-platform` or any
business-system runtime.
