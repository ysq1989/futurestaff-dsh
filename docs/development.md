# Development conventions

- Treat DSH as upstream: never copy, patch, or commit files from DSH Core.
- Pin prerelease DSH versions. Upgrade in a dedicated change and review `profile:dump` output.
- Define contracts and tests before implementation. Validate environment, request, and external API data at boundaries.
- Use camelCase in TypeScript and external JSON; translate legacy upstream fields at adapters only.
- Every Tool declares `ToolMetadata`. A local Tool always requires explicit approval and a target device at registration/reconciliation time.
- Tenant-scoped Tools must derive tenant identity from `FutureStaffContext`, never from model-authored arguments.
- Do not commit secrets, session cookies, browser profiles, or customer data.
- Keep MCP packages as adapters: schemas, authentication, error mapping, and pagination belong at the boundary; orchestration belongs above it.

Run `npm run check` before every commit.
