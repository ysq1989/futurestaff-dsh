# Spec: FutureStaff Local Runner protocol foundation

## Objective

Define the versioned, transport-neutral contract used by a cloud DSH control plane to bind one Local Runner to one trusted FutureStaff subject and dispatch a bounded local Tool job. The first capability is read-only `local.system_info`; no browser automation or publishing is included.

## Tech stack

- TypeScript 5.9 on Node.js 22
- Node's built-in test runner
- No new runtime dependencies

## Commands

- Build: `npm run build -w @futurestaff/local-runner-protocol`
- Test: `npm test -w @futurestaff/local-runner-protocol`
- Full verification: `npm run check`

## Project structure

- `runner/protocol/src/` — public wire types and boundary validation
- `runner/protocol/test/` — small contract tests
- `docs/specs/` — protocol specification
- `tasks/` — implementation plan and checklist

## Code style

Use camelCase JSON fields, discriminated unions, readonly output types, stable error codes, and explicit protocol versioning.

```ts
type RunnerJob = {
  readonly protocolVersion: 1
  readonly kind: 'runner.job'
  readonly jobId: string
}
```

## Testing strategy

Unit tests validate accepted envelopes and fail-closed authorization: subject mismatch, runner/device mismatch, expiry, unsupported Tool, and duplicate job IDs. No network or customer machine is required.

## Boundaries

- Always: derive subject binding from the authenticated cloud registry; validate every wire envelope; expire jobs; reject replay.
- Ask first: persist Runner records, expose a public network endpoint, or install software on a user device.
- Never: accept tenant/user identity from model Tool arguments; include enrollment secrets in jobs or logs; implement publishing in this milestone.

## Success criteria

- Registration and heartbeat envelopes are versioned and validated.
- A cloud-issued job contains a server-owned subject and device route.
- A Runner accepts only its exact binding, a supported Tool, an unexpired job, and a never-before-seen job ID.
- `local.system_info` is the only initial capability and is read-only.
- Tests and the repository check pass.

## Open questions

- Enrollment and long-lived device authentication mechanism.
- WebSocket versus another reconnecting transport.
- Subject-isolated persistence and Worker scheduling topology.
