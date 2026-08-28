# Spec: authenticated Local Runner WebSocket transport

## Objective

Connect multiple customer-owned Local Runners to one cloud Router over TLS while preserving the server-owned tenant/user/device binding. Prove one read-only `local.system_info` job across a real WebSocket connection. Publishing, browser control, automatic enrollment, and persistent job recovery remain out of scope.

## Assumptions for approval

1. The cloud transport runs as a separate `runner-gateway` process/container rather than modifying DSH Core.
2. Alpha enrollment is operator-managed: every Runner receives a unique high-entropy device token out of band.
3. The server configuration stores only the token SHA-256 digest, never the raw token.
4. The Runner sends `Authorization: Bearer <device-token>` during the HTTP upgrade. Tokens never appear in the URL, messages, or logs.
5. The gateway listens on `127.0.0.1:3090` by default. Nginx at `dsh.fsstory.net` terminates TLS and may later expose `/runner/v1/connect` after credentials are provisioned.
6. This slice does not expose a model-facing dispatch API. It proves the authenticated Runner-to-Router transport first; DSH integration is the following slice.

## Tech stack

- TypeScript 5.9 and Node.js 22
- `ws` 8.x for the WebSocket server; Node's built-in WebSocket client for the desktop Runner where sufficient
- Node built-in HTTP, crypto, OS, and test modules
- Existing `@futurestaff/local-runner-protocol` and `@futurestaff/local-runner-router` workspaces

The `ws` project documents authentication at the HTTP `upgrade` boundary and recommends heartbeat-based broken-connection detection. Compression stays disabled because Runner envelopes are small.

## Commands

- Install: `npm install`
- Build: `npm run build -w @futurestaff/local-runner-gateway`
- Focused tests: `npm test -w @futurestaff/local-runner-gateway`
- Full verification: `npm run check`
- Local gateway: `npm run runner:gateway`
- Local Runner: `npm run runner:client`

## Project structure

- `runner/gateway/src/` — authenticated upgrade, WebSocket adapter, lifecycle logs, and configuration parsing
- `runner/gateway/test/` — real loopback WebSocket integration tests
- `runner/client/src/` — minimal reconnecting Runner and read-only system-info executor
- `runner/client/test/` — executor, configuration, and reconnect-policy tests
- `docker/` — optional gateway service, loopback port, and Nginx route example
- `docs/decisions/` — credential and process-boundary ADR

## Public contracts

Connection endpoint:

```text
GET /runner/v1/connect
Authorization: Bearer <device-token>
Upgrade: websocket
```

Wire sequence:

```text
Runner -> runner.register
Runner -> runner.heartbeat (periodic)
Cloud  -> runner.job
Runner -> runner.job-result
```

HTTP failures before upgrade use status only and do not reveal whether a Runner ID or token exists. WebSocket protocol violations close with a stable application close code and a non-sensitive reason.

Gateway configuration is loaded from a mounted JSON file, not a single environment string:

```json
{
  "bindings": [{
    "tenantId": "tenant-a",
    "userId": "user-a",
    "runnerId": "runner-a",
    "deviceId": "office-pc",
    "capabilities": ["local.system_info"],
    "tokenSha256": "<64 lowercase hex characters>"
  }]
}
```

## Observability questions

1. Did an upgrade fail because of path, missing credentials, or invalid credentials?
2. Which non-secret Runner ID connected or disconnected, and why?
3. Did a job succeed, fail remotely, disconnect, or time out, and how long did it take?

Every event is one structured JSON record with `event`, `level`, `requestId`, and allowlisted fields. Never log bearer tokens, token digests, tenant/user IDs, full message bodies, or Tool arguments.

## Testing strategy

- Small tests: configuration validation, constant-time credential verification wrapper, reconnect backoff, and system-info output allowlist.
- Medium tests: real HTTP upgrade and WebSocket frames on an ephemeral loopback port.
- Required negative cases: absent/wrong token, unknown path, malformed JSON, result before registration, duplicate connection, stale heartbeat, oversized frame, and clean disconnect.
- End-to-end: one authenticated client registers, receives `local.system_info`, returns a validated result, and reconnects after the server closes its socket.

## Boundaries

- Always: TLS at the public edge; exact trusted binding; per-device credentials; bounded frame size; heartbeat liveness; structured redacted logs; loopback default.
- Ask first: exposing the Nginx route publicly, provisioning a real device token, installing the Runner on a customer machine, or adding persistent storage.
- Never: accept tenant/user/device from Tool arguments; put tokens in query strings; log credentials or full envelopes; execute shell commands; enable publishing in this milestone; modify DSH Core.

## Success criteria

- Unauthorized upgrades fail without creating a Router session.
- An authenticated Runner can register only its configured Runner/device/capabilities tuple.
- A real loopback WebSocket carries one `local.system_info` job and validated result.
- Heartbeat and disconnect update Router presence and safely settle pending jobs.
- Client reconnect uses capped exponential backoff with jitter and stops on invalid configuration/authentication.
- Gateway is present in Compose but disabled by default and has no direct public bind.
- Repository checks pass and no secret is committed.

## Deferred decisions

- Self-service enrollment, credential rotation/revocation UI, and hardware-backed keys.
- Gateway-to-DSH dispatch API and approval handoff.
- Persistent presence/jobs for multi-replica routing.
- Desktop packaging, auto-update, and code signing.
