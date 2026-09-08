# FutureStaff Agent Windows installer UI contract

This document is the durable acceptance contract for the Windows installer UI.
It is a required release input, not optional polish. A build that contains the
product Profile but falls back to the unbranded desktop-shell installer is not a
FutureStaff Agent release candidate.

## Product identity

- The product name shown throughout setup is `FutureStaff Agent`; user-facing
  installer text must not fall back to `DSH Desktop`.
- The Windows executable and installer use the square, transparent FutureStaff
  `FS` mark with the blue-to-cyan gradient and purple center accent.
- The package description is `FutureStaff Agent: a secure desktop client for
  tenant-aware AI workflows`.

## Required artwork

The controlled desktop shell owns the source and generated assets:

- `dsh-plugin-desktop/build/brand/futurestaff-ai-logo-master.png`: retained
  master logo.
- `dsh-plugin-desktop/build/brand/futurestaff-installer-header-master.png` and
  `futurestaff-installer-art-master.png`: retained installer masters.
- `dsh-plugin-desktop/build/futurestaff-ai-icon.png`: 512 x 512 RGBA Windows
  application icon.
- `dsh-plugin-desktop/build/installerHeader.bmp`: 150 x 57, 24-bit,
  uncompressed NSIS header image.
- `dsh-plugin-desktop/build/installerSidebar.bmp`: 164 x 314, 24-bit,
  uncompressed NSIS installer and uninstaller sidebar.

The visual language is a dark navy background with blue/cyan FutureStaff marks
and a restrained purple accent. Do not substitute upstream DSH artwork.

## Required setup flow

The assisted NSIS installer supports English, Simplified Chinese, and
Traditional Chinese (`en_US`, `zh_CN`, `zh_TW`) and includes all of these steps:

1. A branded welcome page headed `Meet your AI work partner` / `认识你的 AI
   工作伙伴` / `認識你的 AI 工作夥伴`.
2. The normal destination-folder choice.
3. A branded review page headed `Ready for FutureStaff` / `准备安装
   FutureStaff` / `準備安裝 FutureStaff`.
4. The review page shows the selected install directory and the three protected
   defaults: Windows-protected sign-in, loopback-only desktop service, and an
   isolated FutureStaff Profile.
5. The install stage says that `FutureStaff Agent` is being installed and may
   take several minutes; it must not display the generic DSH message.

## Required first launch

- `futurestaff-alpha` is selected and its bundled Profile is upgraded from the
  preceding untouched private candidate when the manifest digest matches.
- `ui-settings-models` is disabled before the Web client renders, so neither the
  internal-test notice nor the DeepSeek API Key dialog can appear.
- Signed-out, loading, expired, and login-error states render a blocking
  FutureStaff account/password page over the workspace. It has no dismiss or
  `configure later` path.
- The workspace is revealed only after the protected session, active tenant,
  platform model list, and application grants have loaded.
- Provider credentials and editable provider/model settings are never rendered
  to a normal desktop user.

The welcome and review copy is maintained in
`dsh-plugin-desktop/build/assistedMessages.yml`, while the custom welcome/review
pages are implemented in `dsh-plugin-desktop/build/installer.nsh`.

## Packaging contract

`dsh-plugin-desktop/package.json` must keep the following effective settings:

- Windows icon: `build/futurestaff-ai-icon.png`.
- NSIS header: `build/installerHeader.bmp`.
- NSIS installer and uninstaller sidebar: `build/installerSidebar.bmp`.
- Installer languages: English, Simplified Chinese, and Traditional Chinese.

The repository patch for `app-builder-lib@26.15.7` must preserve the branded
installing message in its NSIS message template, and the Yarn lock must match
that patch.

## Release gate

Before a Windows package is accepted:

- `installer-messages.spec.ts`, `installer-nsh.spec.ts`, and the installer
  assertions in `package.spec.ts` must pass.
- The full desktop test, runtime-closure, and installer verification gates must
  pass.
- The built candidate must be unsigned only when it is explicitly identified as
  a private build.
- The original controlled-shell worktree and its unrelated changes must remain
  preserved.
- On first launch and after an upgrade, the active `futurestaff-alpha` Profile
  must disable `ui-settings-models`; the upstream API Key onboarding dialog is
  forbidden.
- Every signed-out, loading, expired, or authentication-error state must show a
  non-dismissible FutureStaff account/password login gate. The normal workspace
  is revealed only after the protected platform session and tenant context load.
- A new bundled Profile must explicitly supersede the exact manifest digest of
  the preceding untouched private candidate. Passing package tests is not enough
  if the installed Profile remains on an older manifest.

If the clean desktop commit pinned by `desktop/foundation.json` does not yet
contain this UI contract, packaging must stop and report that the candidate is
incomplete. It must never silently build from the old unbranded baseline. The
UI changes must first be reviewed and incorporated into the pinned desktop
release input, then the product installer must be rebuilt.

## Current candidate status

The installer with SHA-256
`f3a37d04092c9ef79c0d0651aa02c0658644632a2170941f4762c3114cda2818`
was built from the older clean desktop pin and therefore omitted this required
installer UI. An installation test also proved that it preserved the preceding
B02n Profile manifest (`f82212e5ba13adc4c4a144792aa9ef67baff3f8f7c7144f4a1f86ec7288059b8`),
which retained the embedded Mock and upstream API Key onboarding. It is an
incomplete diagnostic artifact and must not be installed, distributed, or
treated as the B02o release candidate.

The corrected unsigned private candidate is
`outputs/FutureStaff-Agent-2.0.6-x64-Setup.exe`, 134,448,316 bytes, SHA-256
`77d3f55e09dae05cd7e708899e9867489c1fd8f409c9da1cc0a6d507d5c1e051`.
It was built from controlled desktop commit
`89f84fcb7856746cdbdb664989547fc835ea8179` and passed the Windows installer
verification gate. Signing, distribution, and installation remain separate
explicitly authorized operations.
