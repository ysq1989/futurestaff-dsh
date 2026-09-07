# ADR-013: Keep DSH loopback-bound behind a container forwarder

## Status

Accepted

## Date

2026-09-07

## Context

The DSH Web runtime rejects `--host 0.0.0.0` because the browser surface can execute powerful local actions. The FutureStaff server image previously passed that value directly so Docker port publishing could reach the process. A container restart exposed the runtime guard and caused a restart loop.

The DEV topology still needs Docker to publish port 3080 on the server's loopback interface. Binding DSH to the container loopback makes it unreachable through Docker's normal port mapping.

## Decision

Run DSH itself on `127.0.0.1:3081`. Start a minimal TCP forwarder in the same container that listens on container port 3080 and forwards only to `127.0.0.1:3081`.

The Compose boundary remains `127.0.0.1:${DSH_PORT}:3080`. The forwarder does not parse HTTP, hold credentials, or select another destination. The existing trusted-host fence and authenticated reverse proxy remain required.

## Alternatives considered

- Disable or bypass the DSH host guard: rejected because the runtime should retain its safe default.
- Use host networking: rejected because it would weaken Compose isolation and break the internal Selection Center hostname contract.
- Add a general-purpose proxy sidecar: rejected because it adds another image and service lifecycle for one fixed local hop.

## Consequences

- DSH never binds a non-loopback address.
- Docker and the host reverse proxy continue to reach container port 3080.
- PID 1 supervises both the fixed forwarder and DSH, forwards termination signals, and exits when DSH exits.
- The container health check continues to test the externally reachable container port.
