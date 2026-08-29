# ADR-012: Separate management tenants from collector clients

## Status

Proposed

## Date

2026-08-29

## Context

FutureStaff must support its own initial Vietnam visa operation, later onboard independent service providers with separate portal and payment accounts, and eventually expose direct-consumer ordering. Treating the platform or every collector as a tenant would mix credential ownership and order visibility.

## Decision

One `operatorTenantId` represents one independent management tenant. It owns portal configuration and all business records. A collector is a subordinate channel with a separate credential and immutable parent tenant.

Operator and collector capabilities use separate routes, credentials and tool sets. External AI connects only to the collector MCP. DSH and the visual collector workbench share the same collector identity and backend.

M4 records application quantities per collector. Payment is manual through a link or QR code and has no banking integration or financial ledger.

## Alternatives considered

- One platform-wide management tenant was rejected because providers require independent credentials and isolation.
- Treating every collector as a tenant was rejected because one provider needs multiple channels.
- One MCP exposing both roles was rejected because prompts are not authorization boundaries.

## Consequences

- Every business record is tenant scoped; collector records also carry `collectorId`.
- FutureStaff can operate the first management tenant without merging platform and operator roles.
- New providers and future direct consumers fit without changing the ownership model.
- Financial and bank integrations remain deferred and additive.
