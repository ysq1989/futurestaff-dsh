# ADR-009: Authenticate each Runner with a distinct device token

## Status

Accepted

## Decision

The Alpha Runner gateway uses one high-entropy bearer token per enrolled device. The gateway configuration stores only SHA-256 digests. Authentication occurs during HTTP upgrade; the first registration frame must exactly match the binding selected by that token.

The gateway remains a separate process with a loopback-only port and an opt-in Compose profile. TLS termination belongs to the existing reverse proxy. The Local Runner independently checks subject, Runner, device, capability, expiry, and replay before executing a job.

## Consequences

- A token for one valid device cannot register as another configured Runner.
- Raw tokens are absent from cloud files, URLs, messages, and logs.
- Operator-managed token provisioning is suitable for Alpha but not the final enrollment experience.
- Rotation and revocation require replacing the binding digest and restarting the gateway until persistent enrollment exists.
- DSH Core remains untouched; a later internal dispatch adapter can call the gateway boundary.
