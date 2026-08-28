# Local Runner protocol plan

1. Commit the transport-neutral v1 contract and acceptance boundaries.
2. Add a dependency-free TypeScript workspace for validation and routing authorization.
3. Prove exact subject/device routing, expiry, capability checking, and replay rejection with unit tests.
4. Document the architecture decision and run the full repository check.

Network enrollment, persistent Runner state, and an executable desktop agent are deliberately separate follow-up slices.

## Cloud Router slice

1. Extend protocol validation to job results.
2. Add trusted registration, presence, dispatch, and collection state.
3. Prove the lifecycle with a dependency-free in-memory channel.
4. Document and deploy without exposing a network transport.

## Authenticated WebSocket slice (awaiting spec approval)

1. Define device-token configuration and authentication at HTTP upgrade.
2. Adapt validated WebSocket messages to the existing Router connection handle.
3. Build a minimal reconnecting client with an allowlisted `local.system_info` executor.
4. Prove the flow over a real loopback socket and add redacted structured lifecycle logs.
5. Add a disabled-by-default gateway Compose service; do not publish the Nginx route until a real device is enrolled.

## System-info dispatch slice

1. Add an authenticated, fixed-capability internal Gateway endpoint.
2. Add a no-input Local Runner MCP adapter with trusted configured routing.
3. Mount the adapter in the FutureStaff Profile and containers.
4. Prove one real request against the enrolled Windows Runner.
