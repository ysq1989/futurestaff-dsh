import type { FutureStaffIdentity } from '@futurestaff/fs-core'
import type {
  AddProductsToPoolInput, AddProductsToPoolOutput, GetProductOutput,
  ListProductPoolsInput, ListProductPoolsOutput, SearchProductsInput, SearchProductsOutput,
} from './schemas.js'
import {
  addProductsToPoolOutputSchema, getProductOutputSchema, listProductPoolsOutputSchema, searchProductsOutputSchema,
} from './schemas.js'

export type SelectionCenterErrorCode =
  | 'VALIDATION_ERROR' | 'UNAUTHORIZED' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT'
  | 'RATE_LIMITED' | 'UPSTREAM_UNAVAILABLE' | 'INTERNAL'

export class SelectionCenterError extends Error {
  constructor(
    readonly code: SelectionCenterErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly details?: unknown,
  ) { super(message) }
}

export interface SelectionCenterClient {
  searchProducts(identity: FutureStaffIdentity, input: SearchProductsInput): Promise<SearchProductsOutput>
  getProduct(identity: FutureStaffIdentity, productId: string): Promise<GetProductOutput>
  listProductPools(identity: FutureStaffIdentity, input: ListProductPoolsInput): Promise<ListProductPoolsOutput>
  addProductsToPool(identity: FutureStaffIdentity, input: AddProductsToPoolInput): Promise<AddProductsToPoolOutput>
}

export interface HttpSelectionCenterClientOptions {
  baseUrl: string
  apiKey: string
  fetch?: typeof globalThis.fetch
}

export function createHttpSelectionCenterClient(options: HttpSelectionCenterClientOptions): SelectionCenterClient {
  const baseUrl = new URL(options.baseUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Selection Center baseUrl must use HTTP or HTTPS')
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('Selection Center apiKey must be a non-empty string')
  const request = options.fetch ?? globalThis.fetch

  async function call(path: string, identity: FutureStaffIdentity, init: RequestInit, schema: { parse(value: unknown): unknown }) {
    const response = await request(new URL(path, baseUrl), {
      ...init,
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
        'x-futurestaff-tenant-id': identity.tenantId,
        'x-futurestaff-user-id': identity.userId,
        ...init.headers,
      },
    }).catch(() => { throw new SelectionCenterError('UPSTREAM_UNAVAILABLE', 'Selection Center is unavailable', true) })
    const body = await response.json().catch(() => undefined)
    if (!response.ok) throw fromHttpStatus(response.status)
    try { return schema.parse(body) } catch {
      throw new SelectionCenterError('UPSTREAM_UNAVAILABLE', 'Selection Center returned an invalid response', true)
    }
  }

  return {
    searchProducts: (identity, input) => call('/v1/products/search', identity, { method: 'POST', body: JSON.stringify(input) }, searchProductsOutputSchema) as Promise<SearchProductsOutput>,
    getProduct: (identity, productId) => call(`/v1/products/${encodeURIComponent(productId)}`, identity, { method: 'GET' }, getProductOutputSchema) as Promise<GetProductOutput>,
    listProductPools: (identity, input) => call('/v1/product-pools/list', identity, { method: 'POST', body: JSON.stringify(input) }, listProductPoolsOutputSchema) as Promise<ListProductPoolsOutput>,
    addProductsToPool: (identity, input) => call(`/v1/product-pools/${encodeURIComponent(input.poolId)}/products`, identity, {
      method: 'POST', headers: { 'idempotency-key': input.idempotencyKey }, body: JSON.stringify({ productIds: input.productIds }),
    }, addProductsToPoolOutputSchema) as Promise<AddProductsToPoolOutput>,
  }
}

function fromHttpStatus(status: number): SelectionCenterError {
  const mapping: Record<number, SelectionCenterErrorCode> = { 400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED' }
  const code = mapping[status] ?? (status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'INTERNAL')
  return new SelectionCenterError(code, `Selection Center request failed (${status})`, status === 429 || status >= 500, { status })
}
