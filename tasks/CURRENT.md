# Current Atomic Task

## B08: Managed desktop defaults

- Requested 2026-10-08: keep the user's selected enhanced mode/Mica, disabled
  market, all notifications, disabled browser access and loopback networking.
  Remove both first-run/upgrade choices and later modification controls.
- High Risk: launcher/preferences/Host validation and shared desktop presentation;
  no business schema, tenant authority, credentials or platform API changes.
- Baseline main `bd06288884`; preserve all unrelated pending changes and upstream
  Harness. Product identity owns policy, all profiles inherit it, Safe Mode remains
  an isolated recovery exception. ADR-017 records the boundary.
- Acceptance: startup normalization/new authenticated profiles, conflicting
  settings and market writes rejected, no ordinary mode/settings controls,
  unsupported Mica fallback preserved, focused tests plus desktop typecheck/build.
- Validation: isolated main candidate passed full npm run check: stable 1,073
  tests, Beta 1,029 tests, root 63 tests, workspace checks, builds, typechecks,
  runtime/loader/operations gates and git diff --check. Generated-profile policy,
  Host write rejection, notification locking and native/UI entry removal passed.
- Status: completed and published 2.0.12 from main source `f7d22242a1`.
  HTTPS client signature and full installer download/size/SHA-256 verification
  passed. Rollback 2.0.11 remains available; no service restart was required.
  The installer was not executed by the agent; installed first-run UI acceptance
  remains a user check.

## B07: FutureStaff desktop software updates

- Live publication completed (2026-10-08): explicit local SSH identity successfully
  connected to the documented main server. An isolated, healthy
  `futurestaff-prod-desktop-updates` container serves read-only public artifacts
  on host loopback 3178. The new fsstory.net HTTPS vhost uses a free Let's Encrypt
  certificate with the existing ACME renewal cron/hook. Existing business
  containers were not restarted.
- Live acceptance: HTTPS feed returned 200 with no-store caching; actual client
  signature parser verified version 2.0.11 and rollback 2.0.10. External full
  installer download matched SHA-256
  `97a976985435d2f1f81c98fd16cea59c7711ca510586a3564367211ea907fd57`.
  Rollback download returned 200; trust.json and READY returned 404. Platform and
  Product Hub health/API/web probes returned 200. Container and host nginx syntax
  checks passed. User installation/first installed-client upgrade remains a
  manual acceptance step; no installer was executed by the agent.

- Current direction (2026-10-08): user selected checking/downloading updates and
  clicking the installer themselves. Default manual-download; paid certificate
  purchase and vendor inquiry are deferred. ADR-016 separates signed manifest
  verification from optional Authenticode-gated native execution.
- Local release ready: source `6b16a21b2cc177c85a84bb966d3a9994a1e6252c`
  was pushed to main. Its clean release clone passed workspace checks, complete
  stable/Beta desktop gates and root tests after building workspace declarations;
  Windows packaging verification passed. Installer exported to
  `outputs/FutureStaff-Agent-2.0.11-x64-Setup.exe`, SHA-256
  `97a976985435d2f1f81c98fd16cea59c7711ca510586a3564367211ea907fd57`.
- Public update bundle: `outputs/desktop-updates-2.0.11`, manifest SHA-256
  `75a4ccf01ae7c2b440a525d8bd9fe9ead4524b074d37b7a828d3d3e407c17a9d`.
  Actual ASAR inspection confirmed the pinned public key/manual-delivery row;
  local publication and actual client manifest/size/hash verification passed.
  No private key was copied into the bundle. No installer was executed.
- Remaining: first user installation and a subsequent installed-client upgrade.
  The earlier server-access, HTTPS and publication blockers are resolved by the
  live-publication evidence above. Final clean-source `npm run check` passed.
- Manual-flow validation: stable desktop build/typecheck passed, full stable tests
  passed 1,071 with 13 skipped, and root tests passed 63. Beta typecheck and the
  exact task-only source variant gate passed. The local whole-workspace check
  failed in an unrelated uncommitted Douyin UI test; that module is excluded from
  this release. Nginx runtime validation awaits server access (no local Docker).
- Source candidate: 2.0.11, pinned public manifest key and intended HTTPS feed
  `https://fsstory.net/desktop-updates/stable.json`. The private key was generated
  in an ACL-protected directory outside the repository and was not printed.
- Server access check: the documented host rejected this local session's SSH
  credentials. No remote container, live feed, certificate or existing integration
  was modified. The destination is configured but is not yet a verified live feed.

- Publisher decision: personal publication, residence China (2026-10-08).
  Main-server container hosting is the user's selected server direction; this local
  session still has no authenticated transport to inspect or change that server.
  Candidate and ready-to-send non-identifying vendor inquiry are recorded in
  `docs/specs/desktop-signing-vendor-check.md`; vendor acceptance/total cost and
  permission to send the inquiry are pending. No order or payment has been made.

- Follow-up (2026-10-08): user requested completion of the update source and signed
  installer workflow. Baseline main `683c5cc57c`; preserve all unrelated work.
  Add certificate-store signed packaging, signed current/rollback bundle preparation
  and atomic static publication. Real signing awaits a valid certificate/provider;
  real publication awaits the selected HTTPS target and working server access.
- Follow-up validation: 14 release/installer/foundation tests passed; all three
  new publication scripts passed Node syntax checks; signing configuration passed
  the installed electron-builder 26.15.7 schema validator. Real Authenticode
  inspection confirmed the historical 2.0.10 installer is unsigned. CurrentUser/My
  and LocalMachine/My have no code-signing certificate; no signing-service variables
  are configured; `ssh -G futurestaff-dev` resolves no usable host alias. Real
  signing/publication is awaiting the user's certificate/service and target answers.

- Requested 2026-10-07: add DSH desktop software updates.
- Risk: High Risk, downloaded executable/installation boundary. Work on main
  `57bb64e2e0`; preserve all pre-existing changes, including official-desktop.
- Owner: embedded product desktop shell; no tenant/business/schema changes.
- Contract: `docs/specs/desktop-updates-v1.md`, ADR-015. Keep upstream updater
  disabled; signed first-party feed, SHA-256, pinned Authenticode publisher,
  rollback reference, explicit download and install confirmation.
- Acceptance: focused security and lifecycle tests, desktop typecheck/build,
  desktop foundation gate and exact task diff review. Live update acceptance
  requires a configured feed and two signed artifacts; neither is assumed.
- Authorization: on 2026-10-08 the user authorized commit and push and requested
  deployment. The deployment target is awaiting clarification; signing setup,
  feed publication and installer execution are not inferred from that request.
- Status: client source implementation and offline acceptance complete; live
  acceptance pending the release operator's feed/key/certificate and signed
  current/rollback installers. No installer was built or executed in this task.
- Validation: stable package `check` passed (1,064 tests, 13 skipped, build,
  typecheck, runtime/CLI/Loader/Profile/license/operations gates); subsequent
  focused update tests passed 33, including real Windows rejection of an
  unsigned fixture. Beta typecheck/build and 117 adjacent regression tests
  passed; foundation gate and 6 root foundation tests passed; diff check passed.
- Repository limitation: `verify-desktop-variants.mjs` remains blocked by the
  pre-existing `electron-shell-generation.ts` and `module-window.ts` differences.
  This task's four shared update/runtime source files are aligned in stable and
  Beta. No gate, existing feature, or unrelated change was removed to make it pass.
- Publication verification (2026-10-08): the root `npm run check` passed
  workspace checks/builds and then stopped at those two unrelated local variant
  differences. The exact task-only staged source snapshot passed the unchanged
  variant checker (133 aligned shared source files); update tests passed 33.
  The stable package's full `check` passed again (1,066 tests, 13 skipped).
  The task-only commit excludes all unrelated staged and unstaged changes.

## B06: Brand FutureStaff Agent and diagnose tenant model access

- User supplied a 2.0.9 screenshot showing DeepSeek/DSH marks and a failed `futurestaff/default` chat turn after login.
- Scope: replace product-facing sidebar, titlebar, settings, tray, window, and packaged application marks without editing pinned Harness; distinguish no-model, tenant authorization, and provider failures; keep model credentials and tenant authority on Platform.
- DEV evidence: the test account has two Agent-authorized tenants. Password login selects a tenant with zero visible models; the other authorized tenant has three. The installed 2.0.9 Profile matches its resource manifest SHA-256 `6cd4850a729b7fb1b276db94334652d8d510c1c1065c9bb6c53790494c9cb20f` and all 79 inventoried files. Initial probes exposed provider streaming failures and then an OpenAI-compatible `tool_calls: null` response incorrectly handled as a list. Platform `b25c1e8` is deployed to DEV as `dev-platform-20260928T122659Z-b25c1e84b7d5`; authorized HTTPS probes logged in, switched to the tenant with three models, and received text plus a successful result from both Mimo and default Agnes. The probes logged out and did not print credentials or model text.
- Acceptance: user-facing brand in common workspace chrome and system-prompt provenance display is FutureStaff Agent; no-model guidance points to the tenant switch; chat failures identify the safe failure category; focused and full release gates pass. The DEV API path is accepted; installing 2.0.10 and visually checking the native tray and workspace on this computer remain pending.
- Validation: product `npm run check` passed after the tray, window, and application icon changes (stable and Beta Desktop 1,029 tests each, 13 skipped each; root 55 tests); focused icon/package tests passed 104 tests, and the desktop shell build and assembled Profile boot check passed. The 2.0.10 unsigned private Windows installer passed packaging verification; exported SHA-256 `65a0525aaa7f44f7cdf4ee5100d39e01fb0d8abb19c6f5e00404460a32ab1237`. A temporary copy of the intact installed 2.0.9 Profile returned `upgraded` and exactly matched the staged 2.0.10 manifest. Platform `backend/tests/test_desktop_chat.py` and `backend/tests/test_desktop_auth_api.py` passed 36 tests, 1 skipped after the null tool-call fix; DEV API and Worker health checks passed after deployment.

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
