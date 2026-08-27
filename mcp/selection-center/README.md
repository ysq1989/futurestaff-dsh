# Selection Center MCP

M2 implements four contract-first Tools: `search_products`, `get_product`,
`list_product_pools`, and `add_products_to_pool`.

The stdio entry uses `SELECTION_CENTER_BASE_URL`, `SELECTION_CENTER_API_KEY`,
`FUTURESTAFF_TENANT_ID`, and `FUTURESTAFF_USER_ID`. Upstream paths remain
isolated behind the HTTP adapter until the real Selection Center specification
is supplied.

```bash
npm run build -w @futurestaff/selection-center-mcp
npm run start -w @futurestaff/selection-center-mcp
```

## Local end-to-end demo

Set these values in the repository root `.env`:

```dotenv
SELECTION_CENTER_BASE_URL=http://127.0.0.1:3301/
SELECTION_CENTER_API_KEY=futurestaff-local-mock
FUTURESTAFF_TENANT_ID=tenant-development
FUTURESTAFF_USER_ID=user-development
```

Then run `npm run selection:mock` in one terminal and `npm run dev -- --port 3080 --no-open` in another. The mock is loopback-only, keeps data in memory, and is for local development only.
