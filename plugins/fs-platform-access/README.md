# FutureStaff platform access (B01a)

This product-layer workspace consumes only the pinned Agent PC contract `0.1.0`
and its loopback Mock. It does not connect to DEV or production and never reads a
real account, password, application credential, or platform secret.

The adapter rejects non-loopback base URLs, responses without
`X-FutureStaff-Mock: true`, responses from another contract version, and any
application record whose tenant differs from the active tenant. Session tokens
remain private to the controller and are absent from public snapshots and views.

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
