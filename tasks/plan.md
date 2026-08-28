# Local Runner protocol plan

1. Commit the transport-neutral v1 contract and acceptance boundaries.
2. Add a dependency-free TypeScript workspace for validation and routing authorization.
3. Prove exact subject/device routing, expiry, capability checking, and replay rejection with unit tests.
4. Document the architecture decision and run the full repository check.

Network enrollment, persistent Runner state, and an executable desktop agent are deliberately separate follow-up slices.
