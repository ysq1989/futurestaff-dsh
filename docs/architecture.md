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

The Profile installer stages source into `$DSH_HOME/profiles/futurestaff-alpha`, because DSH discovers profiles there. This keeps repository layout readable while respecting the upstream runtime contract.

See [ADR-001](decisions/001-upstream-composition.md) and [ADR-002](decisions/002-tool-execution-metadata.md).
