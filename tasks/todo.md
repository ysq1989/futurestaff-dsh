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
- [ ] Obtain approval for the six stated assumptions.
- [ ] Add failing gateway and client tests.
- [ ] Implement authenticated upgrade and Router adapter.
- [ ] Implement the read-only reconnecting Runner client.
- [ ] Add disabled-by-default Compose topology and Nginx example.
- [ ] Run full checks, review, commit, push, and deploy without opening the route.
