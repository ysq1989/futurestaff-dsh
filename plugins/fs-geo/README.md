# GEO local desktop system

GEO is a peer of Douyin acquisition in FutureStaff Agent's System navigation.
It opens one owned local workspace tab. It is not a remote GEO website shortcut.

The business UI and domain/storage code were migrated from the independent GEO
0.2.1 source at `aa8f810a80372e9bc14415b584504a5acf68b323`.
`source-manifest.json` records original file hashes and desktop adaptations.
The original GEO repository and its production environment are unchanged.

## Runtime

- DSH Host owns login, current environment/tenant/member and application grants.
- Every local business request obtains the server-validated GEO permission
  projection through the existing exact `apps/geo/token` operation. Its credential
  stays in Host and is never forwarded to the page or stored in the GEO database.
  Missing registration, `geo.read/operator/admin`, expired identity or unavailable
  authorization fails closed. Desktop chat authorization alone grants no GEO role.
- PGlite is bundled with the application. Users install no PostgreSQL/Redis/Docker.
  SQL migrations and FORCE RLS/compound foreign keys remain intact. Database files
  live outside managed Profile files under the OS user's `.futurestaff/geo`, keyed
  by trusted environment/tenant/member. Existing SaaS or browser data is not copied.
- React 19 runs in the owned local GEO frame, separate from the DSH React 18 shell.
  UI assets, SQL and WASM dependencies are packaged; no development Web server is
  required. Host accepts only bounded loopback/same-origin business requests.
- DSH `platformInference` supplies the authorized model catalog and explicit text
  inference. GEO application permissions are checked in addition to model access.
  These are desktop model calls, not a claim that the SaaS GEO system-key routing,
  billing dimensions, provider citations or Web search metadata were migrated.

The original brand/campaign/question/evidence/metric/CSV and content operations
remain available: versioned drafts, operator submission, administrator review,
manual account/plan/record workflows, and explicitly requested model drafting and
measurement. Failed/unknown measurements are not zero visibility; unknown calls
are not automatically repeated. Drafts do not overwrite saved articles until an
explicit save; publication plans keep immutable reviewed versions.

Local execution does not mean completely offline authorization: login and GEO
permission checks still require Platform availability, and model calls require
the authorized inference service. Data is local to the current member/device;
no automatic cloud/member/device synchronization is implemented. An empty local
workspace needs a GEO administrator to configure its brand.

Product website collectors, automatic publication, unattended external sends and
provider settings remain unavailable. No live inference or publication was used
to validate this migration.

## Developer commands

From the client root, `npm ci`, then `npm run desktop:install`. This installs the
independently locked GEO React 19 dependencies and the immutable desktop workspace.

```text
npm run build -w @futurestaff/fs-geo
npm run typecheck -w @futurestaff/fs-geo
npm test -w @futurestaff/fs-geo
node plugins/fs-geo/scripts/browser-smoke.mjs
```

Browser smoke uses an isolated temporary browser/database, real peer launcher
components and only fixture identity/models. Screenshots go to ignored
`work/geo-local-review`. It does not read installed browser profiles or credentials.

Managed workspace upgrades copy GEO code/resources only and request current-Profile
restart if needed. Cancelling that restart does not unlock the stale Host. Running
app changes and installer generation/publishing still need user authorization.
