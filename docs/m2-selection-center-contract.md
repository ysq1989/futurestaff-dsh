# M2: Selection Center MCP contract

Use MCP Tools with additive, JSON-schema-validated inputs and outputs. IDs are opaque strings; money uses integer minor units plus ISO 4217 currency; list results use cursor pagination.

## `search_products`

Input: `query?`, `category?`, `price?: { minMinor?, maxMinor?, currency }`, `cursor?`, `limit?` (default 20, max 100).

Output: `{ items: ProductSummary[], nextCursor?: string }`.

## `get_product`

Input: `{ productId: string }`.

Output: `{ product: ProductDetail }`; missing products return a typed `NOT_FOUND` error.

## `list_product_pools`

Input: `{ cursor?, limit? }`.

Output: `{ items: ProductPool[], nextCursor?: string }`.

## `add_products_to_pool`

Input: `{ poolId: string, productIds: string[], idempotencyKey: string }`.

Output: `{ poolId, addedProductIds, existingProductIds }`.

All four Tools use `{ execution: 'cloud', tenantScoped: true }`. Search/read can default to `requiresApproval: false`; pool mutation uses `requiresApproval: true`. Tenant and user IDs come from trusted `FutureStaffContext`, never Tool arguments. Errors share `{ code, message, retryable, details? }`; suggested codes are `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, and `INTERNAL`.

## Provisional upstream HTTP mapping

Until the real Selection Center API specification is supplied, the adapter isolates provisional paths behind `SelectionCenterClient`: `POST /v1/products/search`, `GET /v1/products/{productId}`, `POST /v1/product-pools/list`, and `POST /v1/product-pools/{poolId}/products`.

Authentication uses `Authorization: Bearer`; trusted identity is forwarded through `X-FutureStaff-Tenant-Id` and `X-FutureStaff-User-Id`. Mutation also sends `Idempotency-Key`. Only `client.ts` should change when the real upstream contract differs.
