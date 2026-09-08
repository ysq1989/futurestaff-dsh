# FutureStaff Agent desktop foundation

The Windows client keeps the productized DSH Desktop shell inside this repository
at `desktop-shell/`. The authoritative machine-readable provenance and security
lock is `desktop/foundation.json`; an adjacent checkout is never a release input.

## Locked source

- Embedded path: `desktop-shell/`
- Imported history: `https://github.com/ysq1989/futurestaff-dsh-desktop.git` at
  `89f84fcb7856746cdbdb664989547fc835ea8179`
- Read-only upstream: `https://github.com/anywhere-labs/dsh-desktop.git`
- Base: `v2.0.5` at `423406fe225442995902015cb6f10eed670ff115`
- License: MIT
- Official `deepseek-harness` gitlink: `a66e4702047846cdaa10c66c9d3df3951f5ea70d`

The imported desktop history preserves the productization boundary, verified
first-launch Profile installation, Host-only OS-protected secret service,
hash-matched Profile upgrades, and non-authoritative bootstrap identity. Future
desktop and product changes share one root commit while remaining separate
packages. See [ADR-014](decisions/014-embed-desktop-shell-in-product-monorepo.md).

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

The check always verifies `desktop-shell/` and its untouched official submodule
gitlink. It accepts no external checkout override. It does not initialize
submodules, publish, sign, or deploy anything.

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

`npm run desktop:stage` verifies the clean monorepo main branch, untouched
official Harness gitlink, FutureStaff package identity, and `extraResources`
destination before writing only the ignored
`desktop-shell/dsh-plugin-desktop/build/futurestaff-profile` packaging input.

`npm run installer:windows` runs that staging gate, invokes the embedded shell's
unsigned NSIS release path, verifies the packaged runtime, and copies the
single x64 Setup executable plus a SHA-256 sidecar into ignored `outputs/`.
Signing and public distribution remain disabled for this Mock-only Alpha.

The installer UI is also a mandatory release input. Follow
[`docs/specs/windows-agent-installer-ui.md`](specs/windows-agent-installer-ui.md)
for the FutureStaff icon, header/sidebar artwork, welcome and review pages,
three-language copy, and acceptance tests. If the monorepo desktop tree does not
contain that UI, stop the build instead of falling back to an adjacent or older
unbranded installer.
