# ADR-015: First-party desktop updates

Accepted: 2026-10-07. Extends ADR-014's embedded product shell and the platform's
ADR-0034 distribution policy.

The disabled upstream updater has hard-coded third-party services and does not
implement the FutureStaff signing contract. Keep it disabled and register a
separate first-party Host plugin against the existing secured loopback action.
Use an operator-pinned Ed25519 key for the version/notes/artifact manifest, exact
SHA-256 and size for installer bytes, and a pinned valid Windows Authenticode
certificate before launching an installer. Require an older rollback artifact
reference and preserve the existing user-confirmed native installation flow.

Empty default trust configuration is visible to users and performs no requests.
Background checks announce available releases without executing updates. V1
supports Windows x64; no platform identity, tenant authorization or Harness Core
changes are required. Live release acceptance depends on signed artifacts and a
controlled feed; unsigned Alpha packages cannot pass this policy.

See [the V1 contract](../specs/desktop-updates-v1.md) for configuration, bounds,
failure behavior, manual rollback and release acceptance.
