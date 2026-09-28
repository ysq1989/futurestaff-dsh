# Current Atomic Task

## B06: Brand FutureStaff Agent and diagnose tenant model access

- User supplied a 2.0.9 screenshot showing DeepSeek/DSH marks and a failed `futurestaff/default` chat turn after login.
- Scope: replace product-facing sidebar, titlebar, settings, tray, window, and packaged application marks without editing pinned Harness; distinguish no-model, tenant authorization, and provider failures; keep model credentials and tenant authority on Platform.
- DEV evidence: the test account has two Agent-authorized tenants. Password login selects a tenant with zero visible models; the other authorized tenant has three. Both `/desktop/v1/models` and `/desktop/v1/chat` routes are live. The installed 2.0.9 Profile matches its resource manifest SHA-256 `6cd4850a729b7fb1b276db94334652d8d510c1c1065c9bb6c53790494c9cb20f` and all 79 inventoried files. Authorized chat probes: Agnes timed out after 75 seconds; Mimo and DeepSeek streaming returned `PROVIDER_UNAVAILABLE`. The platform's persisted Mimo and default Agnes configurations both passed nonstream connection and tool-call tests in 4.5 and 1.8 seconds. A separate Platform repository change switches the desktop gateway to one bounded nonstream provider call; DEV deployment and end-to-end chat acceptance remain pending.
- Acceptance: user-facing brand in common workspace chrome and system-prompt provenance display is FutureStaff Agent; no-model guidance points to the tenant switch; chat failures identify the safe failure category; focused and full release gates pass. Do not claim the desktop chat link works without a successful authorized inference probe after DEV deployment.
- Validation: product `npm run check` passed after the tray, window, and application icon changes (stable and Beta Desktop 1,029 tests each, 13 skipped each; root 55 tests); focused icon/package tests passed 104 tests, and the desktop shell build and assembled Profile boot check passed. `npm run release:profile` passed before these shell-only icon changes; a temporary copy of the intact installed 2.0.9 Profile returned `upgraded` and exactly matched the staged 2.0.10 manifest. Platform `backend/tests/test_desktop_chat.py` and `backend/tests/test_desktop_auth_api.py` passed 36 tests with the cross-repository consumer check enabled. No DEV deployment or new installer has been performed.

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
