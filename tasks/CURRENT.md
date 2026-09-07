# B01a: Connect the FutureStaff desktop product to the pinned local platform Mock

- Status: Completed
- Owner: Computer B / `futurestaff-dsh`
- Risk: High (identity, tenant isolation, and public contract consumption)
- Platform contract dependency: `0.1.0` at platform commit `93ca162566225894a8cd317b7bc51b096d16a0ec`, bundle SHA-256 `5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9`

## Goal

Consume the versioned local-only Agent PC Mock, expose login/refresh/logout,
tenant discovery and switching, authorized-application discovery, and explicit
loading/failure/no-authorization/expired states. Tenant changes must invalidate
old async work and clear request caches, workspace state, and application
credentials before the new tenant becomes active.

## Acceptance

- [x] Product lock records the exact contract version, platform commit, bundle SHA-256, loopback URL, and Mock-only status.
- [x] Login, refresh, logout, tenant list/switch, and authorized applications run against the pinned local Mock.
- [x] Public state and display surfaces cover signed out, loading, ready, failure, no authorization, and expired session.
- [x] The product Profile mounts the Host bridge and Web client, and the panel is registered as an actual DSH Settings section.
- [x] Tenant switch invalidates stale responses and clears old requests, cache, workspace, and application credentials before activating the new tenant.
- [x] Tokens remain memory-only and do not appear in public state, rendered views, or smoke output.
- [x] Focused tests, typecheck, build, real Mock smoke, full product check, and diff review pass.

## Verification

- `npm run typecheck -w @futurestaff/fs-platform-access`: passed.
- `npm test -w @futurestaff/fs-platform-access`: 11 passed, including stale-generation, all four tenant-resource cleanup checks, exact Host routes, allowlisted proxy forwarding, and DSH client registration.
- `npm run platform:mock:smoke` against A01b `127.0.0.1:43821`: passed login, refresh, tenant/app discovery, tenant switch, and logout.
- `npm run platform:mock:demo`: loopback panel, browser modules, and same-origin contract proxy loaded; login returned simulated contract `0.1.0`.
- Visible browser check: login showed two tenants/two applications, switching to tenant B showed only its one authorized application, tenant-B refresh displayed the Mock's explicit expired state, re-login and logout returned to signed out.
- `npm run profile:install`: passed; the installed local Profile resolves both `@futurestaff/fs-platform-access` Host and Web client exports.
- `npm run profile:dump`: blocked before Profile loading by the pinned upstream DSH CLI package link missing `@deepseek-ai/dsh-app-boot`; repeated with a warm pnpm cache, while npm execution did not complete dependency setup. No DSH Core workaround was applied.
- `FUTURESTAFF_DESKTOP_SHELL_DIR=D:\项目\futurestaff-dsh-desktop npm run check`: passed all workspace typechecks/tests/builds and 45 root tests.
- A01b bundle recomputation after CRLF-to-LF normalization matched `5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9`. The platform's own focused test was 7 passed / 1 failed because it hashes Windows checkout bytes instead of applying its declared LF normalization.
- `git diff --check`: passed; exact final diff reviewed.

## External boundaries

This task uses only deterministic simulated labels from a loopback Mock. It does
not modify the platform repository, desktop fork, official Harness submodule,
real accounts, credentials, DEV/PROD state, deployment, signing, publishing,
commit, or push.
