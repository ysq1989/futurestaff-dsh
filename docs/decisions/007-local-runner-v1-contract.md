# ADR-007: Start Local Runner with a transport-neutral fail-closed contract

## Status

Accepted

## Date

2026-08-28

## Context

FutureStaff needs cloud-hosted DSH workers to route selected tools to multiple user computers. Network enrollment, desktop packaging, reconnect behavior, and publishing are not yet chosen. Coupling authorization rules to an early WebSocket implementation would make the security boundary hard to test and expensive to change.

## Decision

Create `@futurestaff/local-runner-protocol` as a dependency-free, versioned contract package. The v1 foundation defines registration, heartbeat, job, and result envelopes, plus Runner-side authorization.

A job is accepted only when its cloud-owned subject, Runner, device, registered capability, validity window, and replay state all match. The only v1 capability is read-only `local.system_info`. Unknown capabilities and protocol versions fail closed.

Enrollment credentials, signatures, and the reconnecting network transport are separate follow-up layers. Model-authored tool arguments never select a subject or Runner route.

## Alternatives considered

### Implement WebSocket transport first

Rejected because transport does not define authorization and would hide critical routing rules inside connection handlers.

### Put tenant and device IDs in model Tool arguments

Rejected because model-authored routing is not trusted authorization.

### Start directly with a social publishing Tool

Rejected because a write-capable browser Tool is too risky before enrollment, approval binding, expiry, and replay behavior are proven.

## Consequences

- Cloud and desktop implementations share one wire contract.
- Cross-subject, wrong-device, expired, unsupported, and replayed jobs have stable rejection codes.
- The next slice can add authenticated enrollment and transport without changing job authorization semantics.
