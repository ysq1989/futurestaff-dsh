# ADR-010: Start DSH-to-Runner dispatch with one fixed capability

## Status

Accepted

## Decision

Expose one private authenticated Gateway endpoint for `local.system_info` and one no-input MCP Tool named `local_system_info`. The MCP adapter injects the configured Runner ID and internal service credential. The Gateway injects subject and device from its trusted binding.

The internal endpoint shares the Gateway's loopback/private port but is never proxied by Nginx. A separate bearer token authenticates DSH-side calls; it is unrelated to device credentials.

## Consequences

- Model input cannot select a tenant, user, device, Runner, Tool, or arguments.
- The first real end-to-end path is deliberately read-only and narrow.
- Adding another local capability requires a new explicit contract and approval policy.
- A future multi-tenant identity gateway must replace the Alpha fixed Runner configuration with request-scoped trusted routing.
