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

## B02h: Broker the short-lived Product Hub application token

- Status: Completed locally after commit `d2b1f7c`; not committed or pushed.
- Result: the Host-owned DEV controller now mints an A02 application token only when `product_hub` is present in the current server-fetched application snapshot and the protected session still matches the active tenant. Issuance is serialized with refresh, tenant switch, restore, and logout.
- Web boundary: added one exact loopback POST route guarded by `X-FutureStaff-Application: product_hub`; its response is `no-store` and contains only the 60-second application credential contract. `getProductHubApplicationToken()` validates the exact active tenant, audience, TTL, visible-ASCII token, unique `product_hub.*` permissions, and response fields, then returns without caching or persistence.
- Safety: missing/expired sessions, unauthorized applications, cross-tenant responses, unsafe tokens, malformed permissions, missing guard headers, extra fields, and post-logout issuance fail closed with bounded errors. The platform access token and refresh token never enter the Web response.
- Verification: RED tests first failed on the missing controller method and client helper; platform-access tests passed 48/48 with TypeScript build; the real loopback fake flow covered Host minting and Web delivery; full `npm run check` passed including every workspace typecheck/test/build and 52 top-level tests; `git diff --check` passed with line-ending conversion warnings only.
- Boundaries: no Product Hub business request, real Platform DEV request, credential persistence in Web, schema, deployment, controlled-desktop edit, commit, or push was performed.

## B02i: Connect the Product Hub client to the desktop authorization boundary

- Status: Completed locally after commit `d2b1f7c`; not committed or pushed.
- Result: the live Product Hub approval page now accepts only a valid `draft` UUID, resolves the current Product Hub endpoint and tenant from the strict credential-free Host snapshot, obtains a fresh 60-second application token per business request, and sends the server-owned draft/approval contract through `ProductHubApprovalClient`.
- Tenant and permission safety: every token mint revalidates the active tenant, application authorization, and base URL; a switch or revocation fails before Product Hub is called. Only server-issued `product_hub.operator` or `product_hub.admin` enables approval, while read-only users can inspect the draft without a writable control.
- Mutation safety: approval transmits only title, allowlisted template, and a client-generated idempotency key; an identical retry reuses that key. Platform credentials and tenant IDs never enter the Product Hub request body, Web storage, or logs.
- Verification: fake loopback integration proved snapshot -> token -> business request ordering and rejected switched tenants, missing applications, and read-only approval; platform-access tests passed 49/49; Product Hub UI tests passed 15/15 and its Vite production build passed; full `npm run check` passed before the final permission-interface tightening, followed by the affected tests/build and `git diff --check` passing.
- Boundaries: no real Platform DEV account/request, Product Hub business request, external mutation, schema, controlled-desktop edit, commit, push, or server deployment was performed.

## B02j: Build and stage the private Windows client candidate

- Status: Completed locally after commit `d2b1f7c`; source changes remain uncommitted and unpushed.
- Result: staged the built-only `futurestaff-alpha` Profile into the pinned controlled desktop shell at `bd54da63577a5d2595ced66060999e12468f42a8`, built exactly one private unsigned Windows x64 installer, and exported it to `outputs/FutureStaff-Agent-2.0.5-x64-Setup.exe`.
- Artifact: 134,282,271 bytes; SHA-256 `ebac3e3fe0f052951bff105884e9bd49fef85369d8f4ed60c2c289aa7686cf77`; companion `.sha256` file exported beside it. Authenticode is intentionally absent for this private Alpha candidate.
- Verification: controlled desktop `main` and its official DSH gitlink were clean before packaging and remained clean afterward; desktop tests passed 188/188; the first-party runtime closure contained 228 reachable nodes; Electron/NSIS packaging and the installer verification gate exited 0; the staged release manifest pins A01 Mock `0.1.0`, A02 DEV `0.1.1`, exact built file hashes, and `productionEnabled: false`.
- Boundaries: the installer contains the mounted Profile packages `fs-core` and `fs-platform-access`, including B02h. The separately built Product Hub approval UI/B02i is not yet mounted as a DSH Profile navigation plugin and therefore is not claimed as installed by this artifact. No installer execution, signing, public upload, real login, server deployment, migration, Product Hub mutation, commit, or push was performed.

## B02k: Mount Product Hub UI in the DSH Profile

- Status: Completed locally after commit `d2b1f7c`; not committed, pushed, or packaged into a new installer.
- Result: `fs-product-hub-ui` is now a DSH Host/Web plugin in both developer and release Profiles. It contributes an additive Product Hub action to `sidebar.footer.action` and a dismissible `shell.overlay`, preserving the official sidebar, conversation, and details occupants.
- Static boundary: the Host serves only allowlisted built `lib/ui` assets from the fixed loopback `/_futurestaff/product-hub-ui` prefix. Responses use a restrictive CSP, no-store, no-referrer, nosniff, explicit MIME types, and reject non-loopback, unsupported methods, traversal, and unknown files.
- Client boundary: only a valid outer `productHubDraft` UUID is transferred into the isolated same-origin UI as `draft`; missing or malformed values open the safe empty state. The overlay has an accessible dialog name, focused close control, and Escape dismissal. B02i continues to revalidate tenant/application state and mint a fresh 60-second token for each business call.
- Release integration: developer install, release build, Profile manifest, staging verifier, and composition tests now include exact `@futurestaff/fs-product-hub-ui@0.1.0`. The final staged Profile contains only package metadata, compiled `lib`, hashed Vite assets, and public SVG fixtures—no source, tests, absolute source paths, sessions, or credentials.
- Verification: Product Hub package typecheck/build and 18/18 tests passed; Host route and client slot interaction tests passed; release/Profile focused tests passed 8/8; `npm run profile:dump:release` showed `futurestaff-product-hub-ui` in the final DSH tree; final `npm run check` exited 0 including all workspaces and 52/52 top-level tests; `git diff --check` passed with line-ending warnings only.
- Boundaries: no real account, Platform DEV request, Product Hub business request, installer rebuild, installer execution, desktop-shell edit, signing, public upload, server deployment, commit, or push was performed.

## B02l: Make the bundled Profile first-launch safe

- Status: Completed by product commit `644322f` and controlled desktop commit `ab7a889b9e`; replacement installer pending.
- Incident: the private Windows candidate copied the three built first-party packages into `node_modules` but omitted pnpm layout metadata. On a fresh installation the desktop migration detector treated that verified package tree as legacy, invoked packaged pnpm, and entered recovery mode when the private package versions could not be materialized from a registry.
- Result: release staging now emits deterministic pnpm 11 hoisted-layout workspace, modules, and lock metadata before hashing the Profile. Release verification requires the exact metadata contract, so a future installer cannot silently ship the same incomplete dependency state. On upgrade, the desktop atomically repairs only the exact hash-matched defective Profile; any changed managed file or unexpected extra file preserves the user's Profile untouched.
- Verification: the focused regression failed before the fix and then passed 2/2; the staged Profile returned `requiresDependencyMigration=false` through the real desktop preparation function on Windows; release Profile composition included all three FutureStaff plugins; full `npm run check` passed, including every workspace and 52/52 top-level tests.
- Boundaries: no existing user Profile was deleted or modified, no real account or service was contacted, and no installer was executed, signed, or publicly uploaded.

## B02m: Bootstrap the desktop Alpha identity policy

- Status: Completed in controlled desktop commit `2a0a98fac0`; product release pin and replacement installer pending.
- Incident: after the dependency-layout repair, the packaged Profile reached Host composition but `fs-core` correctly rejected the missing `FUTURESTAFF_IDENTITY_MODE` before any plugin could start.
- Result: the desktop Host now injects the explicit `single-subject` mode plus fixed bootstrap-only tenant/user labels whenever the reserved `futurestaff-alpha` Profile is selected. It overwrites caller-controlled environment values for that Profile and leaves every unrelated Profile untouched.
- Security: the bootstrap labels are not application authorization and are never accepted as a Platform tenant choice. A02 remains the authority for authenticated user, active tenant, application grants, and short-lived Product Hub credentials.
- Verification: the regression failed before implementation; identity, Profile repair, migration, and preparation tests passed 52/52 with desktop build/typecheck; product checks and replacement packaging remain the final release gate.

## B02n: Emit DSH-compatible client plugin bundles

- Status: Completed locally; replacement installer pending.
- Incident: both FutureStaff Web plugins exposed raw TypeScript-emitted ESM as their DSH `./client` entry. The Host concatenated those files into a classic script, whose unsupported top-level imports prevented every factory registration and surfaced as a misleading failure on the first official plugin.
- Result: each package now keeps its importable ESM under `lib/client/index.js` and emits a separate `lib/client.js` factory bundle that registers its exact package ID through `__ModuleLoader__`. Release staging parses and executes both bundle shells as a regression gate.
- Upgrade safety: the packaged manifest explicitly supersedes the exact prior candidate manifest digest. Controlled desktop commit `2887e6d5c3` atomically upgrades only that fully hash-matched bundled Profile; managed-file changes or unexpected files remain preserved.
- Boundaries: no user Profile was modified, no installer was executed, no real Platform request was made, and no push or public distribution occurred.
