# ADR-001: Compose DeepSeek Harness as an upstream dependency

## Status

Accepted

## Date

2026-08-28

## Context

FutureStaff needs the DSH agent and Web surface while retaining a clean upgrade path.

## Decision

Use the official npm-distributed DSH runtime, an out-of-tree Profile, and out-of-tree plugins. Pin prerelease versions and inspect the composed tree during upgrades.

## Alternatives considered

- Fork DSH: rejected because core changes create a permanent merge burden.
- Vendor selected DSH packages: rejected because hidden coupling makes upgrades harder to audit.

## Consequences

FutureStaff customization is limited to documented extension seams. Upstream breaking changes are handled by an explicit dependency upgrade, not silent drift.
