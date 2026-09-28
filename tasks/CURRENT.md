# Current Atomic Task

## B05: Restore FutureStaff Agent DEV login on the existing Desktop shell

- User selected the current `anywhere-labs/dsh-desktop v2.0.5` derived shell on 2026-09-28. Keep its pinned Harness `0.1.2-rc.1` while diagnosing login.
- Goal: make the packaged FutureStaff account/password flow work against `https://dev.fsstory.net/desktop/v1/**`, with the server deriving identity, tenant membership, and Agent access.
- Acceptance: authentication and authorization failures show bounded guidance; a valid DEV account reaches a tenant-bound ready snapshot through protected storage without exposing credentials; verify a new installer before distribution.
- Evidence: the DEV password endpoint returns contract `0.1.1`; the supplied test account succeeds through the live API, client controller, and local Host route, each followed by logout. DEV returns two tenants, two apps, and zero available models for that account. The full product `npm run check` passed after the fix, and the Platform desktop-auth suite passed 20 tests. The installed Electron form incorrectly reports a password error with the same credentials, while its Host route succeeds. Its intact installed Profile has the older client bundle with an unbound browser `fetch` and manifest SHA-256 `733377d44a1a7915029a172bc5da08886f66487304e72b9bfe8baa1beb0e9e38`. The staged release now explicitly supersedes that exact Profile; a temporary copy upgraded to the current client and preserved a locally modified Profile. Official Desktop candidate dependency changes are preserved in Git stash `official-desktop-candidate-before-anywhere-login`.
- User authorized real-account testing and a local app restart on 2026-09-28, then approved committing this fix on `main` and generating a new 2.0.9 installer. No DEV deployment, push, installer execution, or installed-Profile replacement has been authorized.
- Release candidate: source commit `f890bce061`; unsigned `outputs/FutureStaff-Agent-2.0.9-x64-Setup.exe` (134,440,886 bytes), SHA-256 `0e7be4cfc9afbfc49e1ade43c710925cffa434512dd7872d3fc1e0657af723f3`. The builder's Windows installer verification passed, the exported hash matches its sidecar, and the packaged Profile contains the exact old-manifest upgrade and bound-fetch client. Installed-app login acceptance remains pending because the installer has not been run.

## Historical task notes

## B03b: Windows 2.0.8 login and managed-chat candidate

- User requested an updated installer on 2026-09-20. Build a distinct 2.0.8 private unsigned candidate; preserve 2.0.7, do not run the installer or push the desktop repository.
- Includes platform-managed chat against DEV Platform 803d876 and the native browser fetch receiver fix. A hidden offline Electron probe reproduced Illegal invocation with the old receiver and succeeded with the wrapper. Plugin tests: 75 passed.
- Acceptance: full npm run check, clean local source commit required by packaging, immutable installer export and SHA-256. Real account login/chat remain user acceptance items; do not claim verified authentication from offline tests.

## B03a: Platform-managed desktop chat

- Status: implementation and offline validation complete on 2026-09-20; not committed, deployed or packaged. Full DSH `npm run check` passed; latest platform-access suite 74 passed; combined Platform chat/auth suites 43 passed, including the actual FastAPI response consumed by the TypeScript adapter.
- Authorization: user approved implementation in the DSH and Platform repositories and explicitly chose existing platform models/server-side credentials. No new key, live inference, deployment or push.
- Scope: preserve the DSH chat UI; add Host `futurestaff/default` adapter and Platform `/desktop/v1/chat`, tenant/model authorization, bounded NDJSON, cancellation, durable local conversation ownership, quota admission and metadata audit. No DSH Core edits or database migration.
- Contract and acceptance: `docs/specs/platform-chat-v0.1.0.md`; Platform ADR-0039. Run focused security/protocol tests, real Cordis composition, cross-repository offline consumer and full DSH gate. Preserve existing Platform identity changes.
- Release: the existing 2.0.7 artifact remains a login-only acceptance candidate; this source requires a new separately authorized release after Platform DEV verification.
- Limits: text and tool proposals only; no real-account inference verified, automatic expired-token refresh or transcript UI isolation across accounts. Durable ownership prevents sending another account/tenant's bound conversation to inference. Platform gateway lint passes; the shared main module retains the same 68 pre-existing diagnostics as HEAD.

## B02r: Prepare the versioned Windows acceptance candidate

- Status: source ready for a clean 2.0.7 build; shared desktop login state and client error mapping repaired. Updated-source `npm run check` passed on 2026-09-20 (platform-access 61; stable and Beta desktop 1,029 passed + 13 skipped each; market 261; root 55). Installer build/verification follows the authorized source commit; see the exported acceptance record for artifact results.
- Goal: preserve the historical 2.0.6 diagnostic artifact and prepare a distinct 2.0.7 Windows candidate containing the platform-login diagnostics and automatic first-launch defaults.
- Acceptance: the stable desktop package is versioned 2.0.7, installer export refuses to overwrite an existing artifact, the complete repository gate passes, and a clean committed source tree can produce one verified 2.0.7 x64 installer plus matching SHA-256 sidecar.
- Authorization: user explicitly approved local commits and generation of the 2.0.7 installer on 2026-09-20. No push, deployment, signing, installer execution, real-account or DEV request is authorized by this approval.
- Client repair: account settings and login gate share one controller; focus reconciliation is non-flickering and cannot supersede account actions; missing Host routes do not fall back to Mock; transport failures are not mislabeled as password errors.
- Chat follow-up: Platform model discovery is present, but no desktop inference route/adapter is wired. Do not claim chat-ready acceptance from the model list or installer build. Agree the tenant-authorized inference contract before modifying Platform or handling model credentials.
