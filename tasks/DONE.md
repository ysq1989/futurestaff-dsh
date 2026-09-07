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

- Status: Completed and committed locally on `main`; not pushed.
- Result: the Settings access panel now presents polished signed-out, loading, expired, error, empty, and ready states; tenant selection, active role, application count, and capability labels remain explicit.
- Accessibility: labelled regions and tenant control, live loading and alert semantics, button types, visible keyboard focus, responsive single-column layouts, and reduced-motion handling were added.
- Safety: all account, tenant, application, and capability strings remain HTML-escaped; no credentials are rendered or logged.
- Demo: the local browser demo now shares the production panel styles and uses the existing embedded A01 Mock, so it does not depend on A02 or a separate process.
- Verification: TDD regression coverage first failed against the old markup; platform-access tests passed 21/21; full `npm run check` passed; desktop and 390px browser checks passed with no horizontal overflow and a visible 3px keyboard focus outline; `git diff --check` passed with only Git line-ending conversion warnings; exact diff review passed.
- Boundaries: no A02 endpoint or field was added; no Computer A or controlled-desktop file changed; no real account, persistence, external write, deployment, commit, or push was used.

## B02a: Pin A02 and add the Platform DEV API boundary

- Status: Completed and committed as `9e7774401a1d841e746f49c499d62efea76a1112`; pushed with the B02b close.
- Contract: A02 `0.1.1`, Platform DEV source `d789faceb7971deb111fec3e4948237d21e81346`, handoff `2c31ed720d8f9ee4fd8087f758c928ea5f8c0ac2`, bundle SHA-256 `9921cc5084925ceea4e6e9d224e5434d4af294974a736a300ed34c73d2950687`.
- Result: the foundation now pins independent A01 Mock and A02 DEV inputs; `PlatformDevApi` supports the existing desktop identity routes and strict one-minute application-token exchange at the exact root-level DEV origin.
- Safety: the DEV boundary rejects `/api`, alternate origins, simulated or wrong-version metadata, unsafe application IDs, cross-tenant token responses, invalid token TTL/audience/permissions, malformed envelopes, and unbounded transport failures without reflecting credentials.
- Compatibility: the immutable `0.1.0` Mock, its six routes, proof headers, embedded implementation, and disconnected UI remain unchanged; the application-token endpoint was not added to the Mock.
- Verification: RED tests failed before the DEV export and nested contract pin existed; platform-access tests passed 27/27; focused foundation/profile tests passed 8/8; full `npm run check` passed including every workspace typecheck/test/build and 52 top-level tests; `git diff --check` passed with only Git line-ending conversion warnings; exact diff review passed.
- Boundaries: no real login, credential storage, Platform DEV call, Computer A or controlled-desktop edit, deployment, or push was performed.

## B02b: Add OS-protected desktop session storage

- Status: Desktop portion committed and pushed as `bd54da63577a5d2595ced66060999e12468f42a8`; product portion and updated desktop release pin are recorded by this B02b close commit.
- Desktop result: added the generation-scoped, Host-only `desktopProtectedSecrets` Cordis service backed by Electron `safeStorage`; keys are validated and hashed, state is atomically written with private permissions, symlink/path/state hazards fail closed, and only sealed bytes reach disk.
- Product result: added `PlatformSessionVault` for the exact A02 `0.1.1` session/user shape with OS-protection gating, local-first idempotent clear, presence-only credential-free diagnostics, and bounded failures.
- TDD: missing service/Vault tests first failed, then passed; added first-run empty operations, corruption, unavailable protection, invalid runtime input, no-diagnostic-decryption, and plaintext-at-rest checks.
- Verification: product full `npm run check` passed, including every workspace typecheck/test/build and 52 top-level tests; desktop build and typecheck passed; the focused protected-secret suite passed 5/5. Desktop full check reached 1019 passed and 12 skipped tests, with two reproducible unrelated environment failures in diagnostic-export linked-directory setup and recovery pnpm PATH selection. The edited service documents have matching bilingual blob records; the repository-wide bilingual gate remains red only because the unchanged Desktop README pair already has stale recorded hashes.
- Documentation: updated the bilingual public Desktop Host service contract and product/foundation integration boundaries.
- Boundaries: no renderer/IPC/browser storage, real account, DEV request, PKCE launch, deployment, or upstream Harness edit was performed.

## B02c: Add the desktop PKCE transaction boundary

- Status: Completed locally; not committed or pushed.
- Result: added `PlatformPkceTransaction`, which generates a 32-byte verifier and state, derives the S256 challenge, builds only the pinned A02 authorization request, and consumes only the exact loopback callback once.
- Safety: verifier remains in Host memory and is absent from the authorization URL and diagnostics; concurrent start, callback origin/path/query changes, duplicate parameters, invalid code/state, state mismatch, expiry, and replay fail with bounded messages; callback attempts destroy the pending transaction.
- TDD: the missing exports failed first, then three focused PKCE scenarios passed, including pinned URL fields, verifier secrecy, one-time success, pending collision, state mismatch, expiry, and callback rejection.
- Verification: platform-access tests passed 34/34; full `npm run check` passed including all workspace typechecks/tests/builds and 52 top-level tests; `git diff --check` passed with only line-ending conversion warnings.
- Boundaries: no listener, browser launch, DEV request, real account, code exchange, credential persistence, renderer secret, deployment, commit, or push was performed.

## B02d: Orchestrate PKCE exchange into the protected Vault

- Status: Completed locally; not committed or pushed.
- Result: added `PlatformDevLoginCoordinator` to compose one PKCE callback, the pinned `PlatformDevApi` exchange, and `PlatformSessionVault` persistence without returning the decoded session.
- Safety: only one exchange may run; API output is strictly decoded before save; protected-save failure triggers best-effort refresh-token revocation; transaction, exchange, storage, and diagnostics failures are bounded and do not reflect native errors or credentials.
- TDD: missing coordinator exports failed first, then success and protected-storage failure/revocation scenarios passed.
- Verification: platform-access tests passed 36/36 with build and TypeScript compilation; `git diff --check` passed with only line-ending conversion warnings.
- Boundaries: no listener, browser launch, real DEV request/account, renderer credential, deployment, commit, or push was performed.

## B02e: Mount the exact loopback DEV callback service

- Status: Completed locally; not committed or pushed.
- Result: Desktop Host now conditionally provides `platformDevLogin` when `desktopProtectedSecrets` exists; `begin()` owns a temporary dedicated `127.0.0.1:43821` listener because the ordinary DSH WebServer remains on its separate configured port.
- Safety: only GET, loopback socket, exact `Host: 127.0.0.1:43821`, bounded URL length, and the strict PKCE callback are accepted; fixed CSP/no-store HTML never reflects query data or credentials; the listener closes after success, failure, cancellation, runtime error, or five-minute expiry.
- Verification: integration coverage completed a fake DEV exchange through a real loopback socket and found only OS-protected persisted state; platform-access tests passed 37/37; full `npm run check` passed with every workspace typecheck/test/build and 52 top-level tests; `git diff --check` passed with line-ending warnings only.
- Boundaries: no browser launch, real DEV request/account, renderer credential, deployment, commit, or push was performed.

## B02f: Add the safe Host-to-client login trigger

- Status: Completed locally; not committed or pushed.
- Result: added a loopback-only Host POST start route and `beginPlatformDevLogin()`, which validates the exact A02 authorization URL before asking the controlled desktop window to open it externally.
- Safety: the start route requires a non-simple `X-FutureStaff-Login` header to force browser CORS preflight for cross-origin attempts; the client rejects extra response fields, alternate origins/paths, URL credentials/fragments, missing or duplicate parameters, wrong client/callback/method, and malformed state/challenge before invoking the opener.
- Verification: a real loopback start route plus dedicated callback completed the fake DEV/Vault flow; safe and malicious client URL cases passed; platform-access tests passed 38/38; full `npm run check` passed including every workspace typecheck/test/build and 52 top-level tests.
- Boundaries: the existing Mock panel remains unchanged; no real account/DEV request, session restore, deployment, commit, or push was performed.

## B02g: Restore the protected DEV session into the Settings access center

- Status: Completed locally; not committed or pushed.
- Result: added a Host-owned `PlatformDevAccessController` that restores the A02 session from the OS-protected Vault, loads the validated user/tenant/application context, persists refresh and tenant-switch sessions, and clears the protected local session before best-effort remote logout.
- Web boundary: added four loopback Host session routes guarded by `X-FutureStaff-Session`; every response is a credential-free snapshot. The Web client strictly decodes every nested field, rejects extra or credential-shaped output, ignores stale responses, opens B02f login in the system browser, and restores on desktop focus. A definite missing desktop route retains the A01 Mock workflow.
- Tenant and concurrency safety: the Host accepts a switch only for a tenant in the server-fetched membership set, serializes protected session mutations, validates active-tenant consistency, clears expired credentials and tenant resources, and maps application denial to the safe empty state.
- UI: the Settings access center distinguishes Platform DEV `0.1.1` from local Mock `0.1.0`, keeps loading/error/expired/empty states and keyboard semantics, and introduces no new UI dependency or theme system.
- Verification: RED coverage first failed on the missing DEV controller; platform-access tests passed 46/46 with TypeScript build; a fake protected-session flow completed browser start, loopback callback, Vault restore, safe Web snapshot, refresh/switch/logout boundaries, malformed response rejection, concurrent mutation serialization, and stale response rejection; full `npm run check` passed including every workspace typecheck/test/build and 52 top-level tests; `git diff --check` passed with line-ending conversion warnings only.
- Boundaries: no real account, real Platform DEV request, credential read outside fake tests, schema, deployment, controlled-desktop edit, commit, or push was performed.
