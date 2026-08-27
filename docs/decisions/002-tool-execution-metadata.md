# ADR-002: Standardize Tool execution metadata

## Status

Accepted

## Date

2026-08-28

## Context

Some Tools run in FutureStaff Cloud; future publishing and desktop actions must run through a user's Local Runner.

## Decision

Every Tool declares a discriminated `ToolMetadata` contract. Local execution requires `deviceId`; cloud execution forbids it. Approval and tenant isolation are explicit booleans.

## Consequences

Routing and approval policy can be added without changing business Tool inputs. Invalid execution/device combinations fail during registration rather than at action time.
