# FutureStaff Agent desktop foundation

The Windows client uses a controlled fork of `anywhere-labs/dsh-desktop` as its
desktop shell. The authoritative machine-readable lock is
`desktop/foundation.json`; moving branches such as `master` are not release
inputs.

## Locked source

- Controlled fork: `https://github.com/ysq1989/futurestaff-dsh-desktop.git`
- Read-only upstream: `https://github.com/anywhere-labs/dsh-desktop.git`
- Base: `v2.0.5` at `423406fe225442995902015cb6f10eed670ff115`
- License: MIT
- Official `deepseek-harness` gitlink: `a66e4702047846cdaa10c66c9d3df3951f5ea70d`

The first reviewed productization commit is pinned at
`3665790fede332762e716074afb319dc997f121c` on the controlled fork's `main`
branch. Do not replace it with an uncommitted tree or a moving branch name.

## Distribution boundary

The FutureStaff distribution uses its own application ID, user-data directory,
and log namespace. Third-party update services, both community markets,
sponsor/aggregation links, and LAN remote control are disabled by default.
Future update wiring is intentionally empty until a signed FutureStaff manifest,
SHA-256 verification, and rollback artifact are available.

Window, tray, terminal, Profile management, recovery, and Windows installer
capabilities remain part of the distribution.

## Verification

Run the product-level manifest check:

```powershell
npm run desktop:verify
```

To also verify a local controlled-fork checkout and its untouched official
submodule gitlink:

```powershell
$env:FUTURESTAFF_DESKTOP_SHELL_DIR = 'D:\项目\futurestaff-dsh-desktop'
npm run desktop:verify
```

This check does not initialize submodules, create a GitHub repository, publish,
sign, or deploy anything.

## Product Profile staging

`npm run release:profile` creates an ignored release tree at
`dist/desktop-profile/profiles/futurestaff-alpha`. Unlike the developer Profile,
the release tree contains physical copies of built package files and exact
package versions. It contains no source-tree junctions, absolute `file:`
dependencies, credentials, sessions, caches, source files, or tests.

Run `npm run profile:dump:release` before desktop packaging. The repository-pinned
DSH runtime must compose both `futurestaff-core` and
`futurestaff-platform-access`; transient `pnpm dlx` resolution is not a release
input.
