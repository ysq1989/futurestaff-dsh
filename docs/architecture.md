# Architecture

```text
Browser -> official DSH Web bundle -> FutureStaff Profile overlay
                                      |-> fs-core identity service
                                      |-> cloud MCP adapters (M2+)
                                      `-> Local Runner router (future)
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

See [ADR-001](decisions/001-upstream-composition.md) and [ADR-002](decisions/002-tool-execution-metadata.md).

Server container topology and the strict Mock/production split are recorded in [ADR-003](decisions/003-server-container-deployment.md).
