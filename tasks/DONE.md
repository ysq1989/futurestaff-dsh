# Completed Atomic Tasks

## B01a: Connect the desktop product to the pinned local platform Mock

- Status: Completed and pushed as `71174081fbbcd377f61c0abf4fb1874de84199ce`.
- Contract: `0.1.0`, platform commit `93ca162566225894a8cd317b7bc51b096d16a0ec`, bundle SHA-256 `5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9`.
- Result: login, refresh, logout, tenant discovery/switching, authorized applications, explicit state rendering, and tenant-change isolation run against the loopback-only Mock.
- Verification: 11 focused plugin tests, full product check, local Mock smoke, visible browser flow, Profile installation, and exact diff review passed.
- Known follow-up: the pinned DSH `0.1.1-rc.2` `pnpm dlx` launcher could not resolve its declared `dsh-app-boot` dependency on this Windows host.

## B01b: Make the FutureStaff Profile release-loadable

- Status: Completed and pushed as `570fa30af6723005b8d9a8498d9a9056094dd00a`.
- Result: repository-pinned DSH `0.1.2-rc.1`, successful development/release Profile composition, and a relocatable built-only Profile tree without absolute paths or links.
- Verification: release Profile tests, full product checks, exact file inspection, and `profile:dump:release` passed.

## B01c: Integrate the release Profile with the controlled desktop shell

- Status: Completed and pushed as `ab7f5f11a6b8eac2bed6bb2b52040760ebf6c763`; controlled-shell support was pushed as `3e3b3fd822d1510f82d7831f10ea4618701f07f5`.
- Result: verified first-launch Profile installation, preservation of existing user data, packaged-resource gates, and exact cross-repository staging.
- Verification: desktop focused and Windows package gates plus the product full check passed; known unrelated Windows environment failures remain recorded in the completed task history.

## B01d: Export a self-contained private Windows Mock installer

- Status: Completed in the B01d close commit. Desktop artifact-name verification was pushed as `8f7dbd6ce960daa1e80a96010488b982932381bd`.
- Result: the packaged Host runs the pinned B01a contract through an in-process Mock, while retaining the loopback bridge, explicit simulated metadata, all session states, and tenant-change cleanup. No Python service, real account, credential, signing, publishing, or cloud deployment is required.
- Artifact: ignored private Alpha `FutureStaff-Agent-2.0.5-x64-Setup.exe`, 134,257,457 bytes, SHA-256 `22fdb50439094ae3ae434c587a90b009cb3db9e353a1a7dd9c69d084b21e83c1`.
- Verification: product full check, embedded Mock integration tests, release Profile checks, 188 Windows package tests, 228-node runtime closure, NSIS build, installer/application PE verification, independent SHA-256 comparison, and unsigned Authenticode status check passed.

## B01e: Enforce the pinned A01 response contract at the client boundary

- Status: Completed.
- Contract: A01 `0.1.0`, platform commit `93ca162566225894a8cd317b7bc51b096d16a0ec`, bundle SHA-256 `5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9`.
- Result: success and error payloads now fail closed on invalid/extra fields, UUIDs, integer TTL limits, roles, user fields, HTTP(S) URLs, application IDs, deep links, duplicate or malformed capabilities, metadata, logout revocation limits, and unknown error codes. All decoder failures become a bounded local `CONTRACT_MISMATCH` without reflecting payloads or credentials.
- TDD: five new negative cases first failed against the permissive decoder, then passed after strict boundary validation.
- Verification: platform-access tests 18 passed; focused TypeScript check passed; original A01 Python Mock smoke completed login, refresh, tenant list/switch, application discovery, and logout; full `npm run check` passed, including every workspace typecheck/test/build and 50 top-level tests; `git diff --check` passed with only line-ending conversion warnings.
- Boundaries: no A02 endpoints or fields were guessed; no platform or controlled-desktop repository files changed; no real identity, credential, service, signing, publishing, deployment, or external write was used.

## B01f: Polish the local Mock access center

- Status: Completed locally; not committed or pushed.
- Result: the Settings access panel now presents polished signed-out, loading, expired, error, empty, and ready states; tenant selection, active role, application count, and capability labels remain explicit.
- Accessibility: labelled regions and tenant control, live loading and alert semantics, button types, visible keyboard focus, responsive single-column layouts, and reduced-motion handling were added.
- Safety: all account, tenant, application, and capability strings remain HTML-escaped; no credentials are rendered or logged.
- Demo: the local browser demo now shares the production panel styles and uses the existing embedded A01 Mock, so it does not depend on A02 or a separate process.
- Verification: TDD regression coverage first failed against the old markup; platform-access tests passed 21/21; full `npm run check` passed; desktop and 390px browser checks passed with no horizontal overflow and a visible 3px keyboard focus outline; `git diff --check` passed with only Git line-ending conversion warnings; exact diff review passed.
- Boundaries: no A02 endpoint or field was added; no Computer A or controlled-desktop file changed; no real account, persistence, external write, deployment, commit, or push was used.
