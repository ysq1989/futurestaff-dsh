# Local Runner protocol tasks

- [x] Specify the v1 protocol and boundaries.
- [x] Add registration, heartbeat, job, and result contracts.
- [x] Add fail-closed Runner-side authorization.
- [x] Add tests for mismatch, expiry, unsupported capability, and replay.
- [x] Record the architecture decision.
- [x] Run the full repository check and deploy the non-network protocol package.
- [x] Parse successful and failed Runner result envelopes.
- [x] Enforce exact trusted binding and one active connection per Runner.
- [x] Inject subject/device during cloud dispatch.
- [x] Settle jobs on result, remote failure, timeout, and disconnect.
- [x] Prove `local.system_info` over an in-memory channel.
- [ ] Add an authenticated WebSocket transport in a separate milestone.

## Authenticated WebSocket slice

- [x] Draft the transport, authentication, observability, and deployment specification.
- [x] Obtain approval for the six stated assumptions.
- [x] Add failing gateway and client tests.
- [x] Implement authenticated upgrade and Router adapter.
- [x] Implement the read-only reconnecting Runner client.
- [x] Add disabled-by-default Compose topology; keep the Nginx example closed.
- [x] Run full checks and review.
- [x] Commit, push, and deploy without opening the route.
