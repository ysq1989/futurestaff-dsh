# ADR-006: Keep Alpha single-subject until a trusted identity gateway exists

## Status

Accepted

## Date

2026-08-28

## Context

The formal Product Hub MCP authenticates with an Agent Key bound to one Product Hub subject. The official DSH MCP client configures HTTP authorization headers at process composition time. Neither model-authored tool arguments nor untrusted tenant headers may select another identity.

Calling the current process "request-scoped" would therefore be misleading: every browser session in that process reaches Product Hub with the same credential and shares DSH persistence.

## Decision

Alpha supports only `FUTURESTAFF_IDENTITY_MODE=single-subject`. `fs-core` rejects missing and unknown modes during composition. Production deployment must set the mode explicitly.

One running DSH container, its persistent volume, and its Product Hub Agent Key form one security subject. A reverse proxy may authenticate access to that subject, but must not route unrelated tenants or users into it.

`request-scoped` will be introduced only with a trusted FutureStaff gateway, a subject-scoped Product Hub credential exchange, and session/persistence isolation.

## Alternatives considered

### Forward tenant and user headers supplied by the browser or model

Rejected because caller-controlled identity is not authorization.

### Share one Agent Key and label sessions with different tenant IDs

Rejected because labels do not change Product Hub authorization and DSH persistence remains shared.

### Patch DSH Core for dynamic MCP headers

Rejected because FutureStaff must remain upgradeable against upstream DSH.

## Consequences

- Alpha is safe for one explicitly controlled subject per deployment.
- Misconfigured pseudo-multi-tenant startup fails closed.
- Real multi-tenancy requires a separate gateway milestone rather than an environment-variable rename.
