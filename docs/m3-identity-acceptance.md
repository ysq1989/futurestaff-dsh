# M3 identity acceptance

## Completed baseline

- [x] Alpha explicitly declares `FUTURESTAFF_IDENTITY_MODE=single-subject`.
- [x] Any empty, unknown, or premature `request-scoped` mode fails startup.
- [x] Production Compose requires the mode instead of silently defaulting it.
- [x] One DSH container and one Product Hub Agent Key represent one trusted subject.

## Required before multi-tenant rollout

- [ ] A trusted FutureStaff gateway authenticates the browser user.
- [ ] The gateway resolves tenant membership without accepting model-authored identity.
- [ ] Product Hub issues or exchanges a credential scoped to that authenticated subject.
- [ ] DSH/MCP connections are isolated per subject, or the MCP transport supports trusted per-session credentials.
- [ ] Cross-tenant isolation tests prove two concurrent subjects cannot observe or mutate each other's Product Hub data.
- [ ] Session persistence is partitioned by the same authenticated subject boundary.

Setting `FUTURESTAFF_IDENTITY_MODE=request-scoped` before these items exist is intentionally rejected.
