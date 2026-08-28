# Local Runner Router acceptance

This milestone proves cloud-side routing behavior without opening a public port or installing a desktop client.

## Accepted

- A Runner connects only when its ID, device, and capabilities exactly match a server-owned binding.
- One Runner ID has at most one active connection.
- Status exposes online, last-seen, stale, device, and capability state without exposing tenant or user identity.
- Dispatch accepts only Runner ID, Tool name, arguments, and optional approval evidence.
- Tenant, user, and device are injected from the trusted binding.
- `local.system_info` completes through an in-memory channel.
- Wrong job results cannot complete another pending job.
- Remote failure, timeout, and disconnect reject pending work with stable error codes.
- Heartbeats refresh presence only when Runner and device match the connection.
- The full repository check passes.

## Deliberately deferred

- WebSocket/HTTP transport and public routing.
- Enrollment credentials, rotation, and revocation.
- Persistent presence or job storage.
- A packaged desktop Runner.
- Browser automation and publishing capabilities.
