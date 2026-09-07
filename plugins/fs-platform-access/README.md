# FutureStaff platform access

This product-layer workspace preserves the pinned Agent PC contract `0.1.0` and
its loopback Mock while integrating the separate A02 `0.1.1` Platform DEV
boundary. A desktop Host with OS-protected secrets now selects the DEV access
center; ordinary local development without that Host service retains the Mock.

The adapter rejects non-loopback base URLs, responses without
`X-FutureStaff-Mock: true`, responses from another contract version, and any
application record whose tenant differs from the active tenant. Session tokens
remain private to the controller and are absent from public snapshots and views.
Success and error bodies are decoded against the pinned A01 field, UUID, TTL,
URL, capability, role, and enum constraints. Unknown fields or error codes fail
closed as the local `CONTRACT_MISMATCH` code without reflecting response data.

`PlatformAccessController` exposes signed-out, loading, ready, no-application,
expired, and error states. Before tenant switch or logout it cancels the current
request generation and invokes all four isolation hooks: request cancellation,
request-cache clearing, workspace clearing, and application-credential clearing.

To smoke-test the real local Mock, first start the pinned platform Mock at
`127.0.0.1:43821`, then run:

```powershell
npm run platform:mock:smoke
```

To use the actual browser-mountable state panel, keep the Mock running and run
`npm run platform:mock:demo`, then open `http://127.0.0.1:43822`. The development
host is loopback-only and proxies only the six contract paths; it does not log
or persist bearer credentials.

## A02 Platform DEV boundary

The package also exports `PlatformDevApi`, a transport adapter pinned to A02
contract `0.1.1` and the exact `https://dev.fsstory.net` origin. Contract paths
already begin with `/desktop/v1`; the adapter rejects an `/api` prefix and accepts
only non-simulated `0.1.1` response metadata. The A02 provenance is pinned in
`desktop/foundation.json` at platform source `d789faceb7971deb111fec3e4948237d21e81346`
and bundle SHA-256
`9921cc5084925ceea4e6e9d224e5434d4af294974a736a300ed34c73d2950687`.

`PlatformDevApi.issueApplicationToken()` validates the exact application route,
current tenant, one-minute lifetime, audience, permissions, and response shape.
It returns the short-lived credential only to the caller; it does not persist,
render, or log it. The immutable `0.1.0` Mock remains separate and deliberately
does not implement this endpoint.

The package exports `PlatformSessionVault` for the next Host integration step.
It validates and serializes only the A02 `0.1.1` session and user shape, delegates
persistence to the Desktop Host `desktopProtectedSecrets` contract, and exposes
presence-only diagnostics. It never falls back to browser storage or plaintext
files, and local-first clear does not require the operating-system protector to
be available.

The Vault and DEV adapter remain Host-only. The Settings Web client receives
only validated, credential-free user, tenant, application, phase, and error
fields; it never receives the protected session or calls Platform DEV directly.

`PlatformPkceTransaction` provides the Host-side cryptographic transaction
boundary for that next integration: one in-memory 32-byte verifier and state,
an S256 challenge, the pinned authorization and callback URLs, five-minute
expiry, exact callback query validation, and one-time consumption. Its public
request and diagnostics never expose the verifier. It does not open a browser,
listen on a port, or exchange the authorization code by itself.

`PlatformDevLoginCoordinator` composes that transaction with `PlatformDevApi`
and `PlatformSessionVault`. It permits one exchange at a time, persists only a
strictly decoded A02 session, returns no credentials, and makes a best-effort
logout when protected persistence fails. The browser/UI trigger remains
separate Host integration work.

When the Desktop Host supplies `desktopProtectedSecrets`, the plugin also
provides `platformDevLogin`. Calling `begin()` temporarily binds only
`127.0.0.1:43821`, then returns the authorization URL; it never opens the
browser itself. The listener accepts only an exact GET callback with the pinned
Host, returns fixed no-store/CSP HTML, and closes after success, failure,
explicit cancellation, or the five-minute transaction timeout. Browser/UI
trigger wiring remains separate integration work.

The Host exposes one loopback-only POST start route guarded by a non-simple
`X-FutureStaff-Login` request header. `beginPlatformDevLogin()` validates the
entire returned URL contract before calling `window.open(..., '_blank',
'noopener,noreferrer')`; the controlled desktop shell routes that HTTPS window
request to the operating-system browser.

The B02g Host controller restores the protected session, refreshes it, validates
tenant membership before switching, clears local state before remote logout,
and returns only strict credential-free snapshots through four loopback routes.
Each route requires a non-simple `X-FutureStaff-Session` header. The Settings
client selects this DEV controller when the Host service exists, validates every
nested response field, launches login through the B02f helper, and refreshes the
snapshot when the desktop window regains focus. A definite missing Host route
falls back to the unchanged local Mock workflow.

B02h adds one fixed Host broker for the currently authorized `product_hub`
application. Token minting is serialized with refresh, tenant switch, and
logout; it is rejected without a restored session or matching application in
the server-fetched snapshot. The guarded loopback route returns only the A02
60-second Product Hub credential fields with `no-store`. The Web helper verifies
the exact audience, active tenant, TTL, visible-ASCII token, and
`product_hub.*` permissions, returns the token directly to its caller, and does
not cache or persist it. No Product Hub business request is made by the broker.
