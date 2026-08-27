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
