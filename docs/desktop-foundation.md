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

The reviewed desktop release commit is pinned at
`2887e6d5c36f423f3773b8344365542586dbed54` on the controlled fork's `main`
branch. It preserves the original productization boundary and verified
first-launch Profile installation, adds the Host-only OS-protected secret
service, safely repairs or explicitly upgrades an exact hash-matched bundled
Alpha Profile, and provides a fixed non-authoritative desktop bootstrap identity before sign-in.
Do not replace it with an uncommitted tree or a moving branch name.

## Distribution boundary

The FutureStaff distribution uses its own application ID, user-data directory,
and log namespace. Third-party update services, both community markets,
sponsor/aggregation links, and LAN remote control are disabled by default.
Future update wiring is intentionally empty until a signed FutureStaff manifest,
SHA-256 verification, and rollback artifact are available.

Window, tray, terminal, Profile management, recovery, and Windows installer
capabilities remain part of the distribution.

## Platform contract pins

The foundation manifest preserves two independent inputs:

- A01 `0.1.0` at platform commit `93ca1625...` remains the immutable loopback
  Mock used by disconnected tests.
- A02 `0.1.1` at deployed Platform DEV source `d789face...` is pinned with handoff
  commit `2c31ed7...`, bundle SHA-256 `9921cc50...`, the exact
  `https://dev.fsstory.net` origin, and `http://127.0.0.1:43821/callback`.

The DEV pin does not enable PROD or authorize real login by itself. B02b adds a
Host-only `desktopProtectedSecrets` contract backed by Electron `safeStorage`
in the pinned controlled desktop release, plus a product `PlatformSessionVault`
that validates the A02 shape. The product Host now owns PKCE, DEV API access,
protected session restoration, and tenant operations; the Web Settings panel
receives only a strictly validated credential-free snapshot. Non-desktop local
development continues to use the independent Mock path.

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
DSH runtime must compose `futurestaff-core`, `futurestaff-platform-access`, and
`futurestaff-product-hub-ui`; transient `pnpm dlx` resolution is not a release
input. Product Hub contributes only additive sidebar/overlay slots and serves
its built UI from a fixed loopback Host route.

Every packaged Web client has a classic-script DSH factory bundle at
`lib/client.js`; release staging executes each bundle far enough to verify its
exact `__ModuleLoader__` registration. The release manifest may list exact
superseded manifest digests so a replacement installer upgrades only an
untouched prior bundled Profile and preserves user-modified Profiles.

The built-only release Profile also carries deterministic pnpm 11 hoisted-layout
metadata. Those files are included in `release-manifest.json` and prevent the
desktop first-launch migration detector from treating the verified, prebuilt
first-party package directories as an obsolete dependency installation.

`npm run desktop:stage` verifies the exact controlled-fork commit, clean tracked
state, untouched official Harness gitlink, FutureStaff package identity, and
`extraResources` destination before writing only the ignored
`build/futurestaff-profile` packaging input in that checkout.

`npm run installer:windows` runs that staging gate, invokes the controlled
fork's unsigned NSIS release path, verifies the packaged runtime, and copies the
single x64 Setup executable plus a SHA-256 sidecar into ignored `outputs/`.
Signing and public distribution remain disabled for this Mock-only Alpha.
