# FutureStaff platform access

This product-layer workspace preserves the pinned Agent PC contract `0.1.0` and
its loopback Mock while preparing a separate A02 `0.1.1` Platform DEV boundary.
The current Settings panel still uses the Mock; no real login or credential
storage is enabled by the adapter alone.

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

This adapter is not enabled in the Settings panel yet. Real login must first be
wired through PKCE and an operating-system protected session store; browser
storage and plaintext files are not acceptable substitutes.
