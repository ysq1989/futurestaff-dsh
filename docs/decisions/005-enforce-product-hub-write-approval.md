# ADR-005: Enforce Product Hub write approval in the DSH tool pipeline

## Status

Accepted

## Date

2026-08-28

## Context

Product Hub exposes both read and mutating MCP tools. Tool descriptions and model instructions can encourage confirmation, but they are not an enforcement boundary. DSH provides a `tools/pre-execute` waterfall whose `ask` result pauses dispatch and uses the mounted user-approval service.

The integration must remain an out-of-tree extension so the pinned DSH release can be upgraded without carrying a Core patch.

## Decision

`fs-core` registers a global `tools/pre-execute` policy. Product Hub tools on an explicit read allowlist delegate unchanged. Every other tool under the Product Hub namespace returns `ask` and executes only when DSH receives one-time user approval.

The allowlist is intentionally fail-closed: a newly introduced Product Hub tool requires approval until reviewed and classified as read-only.

## Alternatives considered

### Prompt-only confirmation

Rejected because the model can omit or misunderstand the instruction and the tool would still dispatch.

### Patch the DSH MCP client

Rejected because it creates a private Core fork and complicates upstream upgrades.

### Add approval tokens to every Product Hub tool input

Deferred. A backend-issued capability token can provide defense in depth later, but it requires a trusted user-facing issuer and changes the Product Hub contract.

## Consequences

- Product Hub mutations pause at the runtime boundary before reaching the MCP server.
- Approval is one-time and scoped to the pending call as implemented by DSH.
- Read calls remain frictionless.
- Unknown future Product Hub tools are conservative by default.
- The policy depends on the DSH user-approval service being mounted; without it, `ask` degrades to denial rather than execution.
