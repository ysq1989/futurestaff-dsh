# B01c: Integrate the release Profile with the controlled desktop shell

- Status: Completed and ready for checkpoint commit
- Owner: Computer B / `futurestaff-dsh`
- Risk: Standard (desktop runtime and installer prerequisite; no production identity)
- Product baseline: `570fa30af6723005b8d9a8498d9a9056094dd00a`
- Desktop baseline: `3e3b3fd822d1510f82d7831f10ea4618701f07f5`

## Goal

Pin the reviewed desktop Profile-installation commit and provide one fail-closed
staging command that copies the relocatable release Profile only into the
controlled shell's ignored packaging input.

## Acceptance

- [x] The desktop shell verifies every staged file digest before first installation.
- [x] A fresh packaged installation selects `futurestaff-alpha`; existing Profile and selection data are preserved.
- [x] The packaged-runtime gate requires the FutureStaff Profile resource.
- [x] The product lock pins the reviewed desktop commit and the staging command verifies both repositories.
- [x] Product and desktop focused checks pass; broader environmental failures are recorded without weakening gates.

## Verification

- Controlled desktop commit `3e3b3fd822d1510f82d7831f10ea4618701f07f5` is pushed on `main`; official Harness gitlink remains `a66e4702047846cdaa10c66c9d3df3951f5ea70d` and unmodified.
- Desktop focused Profile/package tests: 43 passed, followed by 51 passed after packaged-resource verification was added.
- `corepack yarn workspace dsh-plugin-desktop check:win-package`: passed 188 Windows packaging tests and the 228-node runtime closure gate.
- `npm run desktop:stage`: passed against the exact clean controlled checkout and wrote only the ignored packaging resource.
- `FUTURESTAFF_DESKTOP_SHELL_DIR=D:\项目\futurestaff-dsh-desktop npm run check`: passed all workspaces and 49 root tests.
- The broader desktop `corepack yarn check` reached 1014 passed / 12 skipped / 2 failed in unrelated existing Windows environment tests (`diagnostic-export` linked temp path and recovery pnpm PATH). Both failures reproduce outside the changed files; no gate was weakened.
- `corepack yarn package:dir` reached Electron native dependency preparation but could not rebuild `node-pty` because Visual Studio C++ tools are absent. The supported Windows installer path disables rebuilding and uses the separately verified prebuilt x64 closure.
- `git diff --check`: passed in both repositories.

## External boundaries

Local Mock only. Do not deploy, sign, publish, use a real account/key, modify the
official `deepseek-harness` submodule, commit, or push during this task without a
new explicit instruction.
