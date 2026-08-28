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
