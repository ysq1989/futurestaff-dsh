# ADR-008: Prove the Runner Router before adding public transport

## Status

Accepted

## Decision

Implement Runner connection, presence, dispatch, and result lifecycle as a dependency-free in-memory state machine before choosing or exposing a WebSocket transport.

The Router receives trusted bindings from cloud configuration. A dispatch caller cannot provide tenant, user, or device identity. Transport adapters may translate wire messages, but they must not own authorization or job lifecycle rules.

## Consequences

- State-machine behavior is deterministic and testable without a network or customer device.
- A future WebSocket adapter remains thin and replaceable.
- Restart recovery and horizontal scaling are not provided by the in-memory implementation; persistence is a later explicit decision.
- No new public attack surface is introduced in this milestone.
