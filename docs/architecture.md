# Architecture

```text
Browser -> official DSH Web bundle -> FutureStaff Profile overlay
                                      |-> fs-core identity service
                                      |-> cloud MCP adapters (M2+)
                                      `-> Local Runner Router
                                            `-> transport adapter (future)
```

`futurestaff-alpha` composes `@deepseek-ai/dsh-base`, then `@deepseek-ai/dsh-web-app`, then its own `cordis.patch.yml`. The overlay inserts `@futurestaff/fs-core`; it does not replace official rows or modify DSH source.

`fs-core` owns two stable boundaries:

1. `FutureStaffContext` validates and exposes `tenantId`, `userId`, and optional `deviceId`. Environment values are bootstrap defaults only. M2 must replace bootstrap construction with request-scoped identity supplied by a trusted authenticated gateway; business Tools must never accept identity overrides from model arguments.
2. `ToolMetadata` decides where a Tool executes and whether approval/tenant isolation is required. Local Tools require a device; cloud Tools cannot name one.
3. A `tools/pre-execute` policy asks for DSH's one-time user approval before every Product Hub operation except an explicit read allowlist. Unknown future Product Hub tools fail closed into approval instead of executing silently.

The Profile installer stages source into `$DSH_HOME/profiles/futurestaff-alpha`, because DSH discovers profiles there. This keeps repository layout readable while respecting the upstream runtime contract.

M2 mounts the Selection Center over the official DSH MCP client using stdio. The row remains disabled without upstream configuration. Its environment identity is suitable only for the single-tenant Alpha bootstrap; a multi-tenant deployment must construct a request-scoped MCP/HTTP boundary instead of sharing one process-wide identity.

The preferred deployed path is the authenticated Product Hub Streamable HTTP MCP. When `PRODUCT_HUB_MCP_URL` and `PRODUCT_HUB_AGENT_KEY` are configured, the Profile disables the provisional stdio row and lets Product Hub own tenant isolation, audit events, and its expanding tool contract. See [ADR-004](decisions/004-prefer-product-hub-streamable-http-mcp.md).

The DSH policy seam, rather than model instructions, enforces confirmation before Product Hub mutations. See [ADR-005](decisions/005-enforce-product-hub-write-approval.md).

Alpha is deliberately single-subject: one container, persistent volume, and Product Hub Agent Key form one identity boundary. Startup rejects any premature `request-scoped` mode. See [ADR-006](decisions/006-single-subject-until-identity-gateway.md) and the [M3 identity acceptance](m3-identity-acceptance.md).

The Local Runner begins as a transport-neutral v1 contract. Cloud-owned subject and device bindings are checked again on the Runner together with capability, expiry, and replay state. See [ADR-007](decisions/007-local-runner-v1-contract.md) and the [protocol spec](specs/local-runner-protocol.md).

The cloud Router is a separate, transport-independent state machine. It accepts only a trusted server-side `RunnerBinding`; dispatch callers supply `runnerId`, Tool name, arguments, and approval evidence, while the Router injects subject and device. It rejects duplicate active connections, stale heartbeats, unauthorized capabilities, mismatched results, and unfinished jobs on timeout or disconnect. There is still no public Runner port. See [ADR-008](decisions/008-router-before-public-transport.md).

The optional WebSocket gateway authenticates a device token before upgrade and then requires the registration frame to match that token's exact binding. It is a separate process and Compose profile, so the normal DSH container remains unchanged. The bundled client re-authorizes every cloud job locally and exposes only `local.system_info`. See [ADR-009](decisions/009-per-device-runner-token.md).

The first DSH dispatch path is a no-input `local_system_info` MCP Tool. Its private HTTP adapter injects a configured Runner ID and service token; the Gateway translates that fixed request into `local.system_info`. Nginx never exposes the internal endpoint. See [ADR-010](decisions/010-fixed-local-system-info-dispatch.md) and the [dispatch spec](specs/runner-system-info-dispatch.md).

See [ADR-001](decisions/001-upstream-composition.md) and [ADR-002](decisions/002-tool-execution-metadata.md).

Server container topology and the strict Mock/production split are recorded in [ADR-003](decisions/003-server-container-deployment.md).
