# M2 acceptance criteria

- [x] The MCP server registers exactly four Selection Center Tools.
- [x] Inputs and upstream outputs are validated with committed schemas.
- [x] Tenant and user identity are injected outside model-authored Tool arguments.
- [x] Search/read metadata is cloud, tenant-scoped, and non-mutating.
- [x] Pool mutation metadata requires approval and accepts an idempotency key.
- [x] Upstream HTTP failures use stable error codes and do not leak raw bodies.
- [x] The Alpha Profile mounts the server through the official DSH MCP client.
- [x] The Profile row stays disabled until base URL and API key are configured.
- [x] Contract and in-memory MCP tests pass without a real upstream service.
- [x] A real stdio MCP subprocess passes an end-to-end search against a loopback mock upstream.
- [x] Outbound calls have bounded timeouts, correlation IDs, and secret-safe structured completion logs.
- [x] Product Hub write Tools enter DSH's one-time approval flow before dispatch.
- [x] Product Hub reads use an explicit allowlist; unknown future tools require approval by default.

## Pending external acceptance

- Confirm provisional paths and field mappings against the real Selection Center API.
- Complete a live approved pool mutation and a rejected mutation in the non-production tenant.
- Replace Alpha's process-wide identity with request-scoped authenticated identity before multi-tenant deployment.
