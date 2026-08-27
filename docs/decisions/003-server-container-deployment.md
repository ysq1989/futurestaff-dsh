# ADR-003: Deploy FutureStaff Alpha as server containers

## Status

Accepted

## Date

2026-08-28

## Context

FutureStaff Alpha is a server-hosted agent surface. A local process is useful for development, but it is not the deployment boundary. Test environments need a deterministic Selection Center substitute; production must use the real service and must not accidentally start mock business data.

## Decision

Build one immutable `futurestaff-dsh` image with pinned DSH and application dependencies. Use two explicit Compose files:

- `compose.dev.yml` runs DSH plus an internal-only Selection Center Mock.
- `compose.prod.yml` runs DSH only and requires real Selection Center configuration.

Persist `$DSH_HOME` in a named volume, install the committed Profile into that volume at container start, run as the unprivileged `node` user, and publish DSH only on server loopback. TLS and access control belong to the server's existing reverse proxy or authenticated gateway.

## Alternatives considered

- Run DSH directly on the host: rejected because dependency and upgrade state would be harder to reproduce.
- Ship the Mock in production Compose but disable it: rejected because an environment mistake could route production traffic to fake data.
- Publish port 3080 on every interface: rejected because Alpha does not yet contain its final authentication boundary.

## Consequences

- Development and production topology cannot be confused accidentally.
- Container restarts retain DSH sessions and settings.
- Image builds take longer because they run the complete verification suite.
- Alpha remains one process-scoped tenant/user identity per deployment until request-scoped authentication is implemented.
