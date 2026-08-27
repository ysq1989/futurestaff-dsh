import type { FutureStaffIdentity } from '@futurestaff/fs-core'
import type {
  AddProductsToPoolInput, AddProductsToPoolOutput, GetProductOutput,
  ListProductPoolsInput, ListProductPoolsOutput, SearchProductsInput, SearchProductsOutput,
} from './schemas.js'
import {
  addProductsToPoolOutputSchema, getProductOutputSchema, listProductPoolsOutputSchema, searchProductsOutputSchema,
} from './schemas.js'
import type { SelectionCenterLogger, SelectionCenterOperation } from './observability.js'
import { silentSelectionCenterLogger } from './observability.js'
import { randomUUID } from 'node:crypto'

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
  timeoutMs?: number
  requestId?: () => string
  logger?: SelectionCenterLogger
}

export function createHttpSelectionCenterClient(options: HttpSelectionCenterClientOptions): SelectionCenterClient {
  const baseUrl = new URL(options.baseUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('Selection Center baseUrl must use HTTP or HTTPS')
  const apiKey = options.apiKey.trim()
  if (!apiKey) throw new Error('Selection Center apiKey must be a non-empty string')
  const request = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 10_000
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 120_000) throw new Error('Selection Center timeoutMs must be between 1 and 120000')
  const nextRequestId = options.requestId ?? randomUUID
  const logger = options.logger ?? silentSelectionCenterLogger

  async function call<T>(operation: SelectionCenterOperation, path: string, identity: FutureStaffIdentity, init: RequestInit, schema: { parse(value: unknown): T }): Promise<T> {
    const requestId = nextRequestId()
    const startedAt = Date.now()
    const signal = AbortSignal.timeout(timeoutMs)
    try {
      const response = await request(new URL(path, baseUrl), {
        ...init,
        signal,
        headers: {
          accept: 'application/json',
          authorization: `Bearer ${apiKey}`,
          'content-type': 'application/json',
          'x-futurestaff-tenant-id': identity.tenantId,
          'x-futurestaff-user-id': identity.userId,
          'x-request-id': requestId,
          ...init.headers,
        },
      })
      const body = await response.json().catch(() => undefined)
      if (!response.ok) throw fromHttpStatus(response.status)
      let output: T
      try { output = schema.parse(body) } catch {
        throw new SelectionCenterError('UPSTREAM_UNAVAILABLE', 'Selection Center returned an invalid response', true)
      }
      emitSafely(logger, { event: 'selection_center_request_completed', requestId, operation, outcome: 'success', durationMs: Date.now() - startedAt })
      return output
    } catch (error) {
      const timedOut = signal.aborted
      const normalized = error instanceof SelectionCenterError
        ? error
        : new SelectionCenterError('UPSTREAM_UNAVAILABLE', timedOut ? 'Selection Center request timed out' : 'Selection Center is unavailable', true)
      emitSafely(logger, {
        event: 'selection_center_request_completed', requestId, operation,
        outcome: timedOut ? 'timeout' : 'error', durationMs: Date.now() - startedAt, errorCode: normalized.code,
      })
      throw normalized
    }
  }

  return {
    searchProducts: (identity, input) => call('search_products', '/v1/products/search', identity, { method: 'POST', body: JSON.stringify(input) }, searchProductsOutputSchema),
    getProduct: (identity, productId) => call('get_product', `/v1/products/${encodeURIComponent(productId)}`, identity, { method: 'GET' }, getProductOutputSchema),
    listProductPools: (identity, input) => call('list_product_pools', '/v1/product-pools/list', identity, { method: 'POST', body: JSON.stringify(input) }, listProductPoolsOutputSchema),
    addProductsToPool: (identity, input) => call('add_products_to_pool', `/v1/product-pools/${encodeURIComponent(input.poolId)}/products`, identity, {
      method: 'POST', headers: { 'idempotency-key': input.idempotencyKey }, body: JSON.stringify({ productIds: input.productIds }),
    }, addProductsToPoolOutputSchema),
  }
}

function emitSafely(logger: SelectionCenterLogger, event: Parameters<SelectionCenterLogger['emit']>[0]): void {
  try { logger.emit(event) } catch { /* Telemetry must not change Tool behavior. */ }
}

function fromHttpStatus(status: number): SelectionCenterError {
  const mapping: Record<number, SelectionCenterErrorCode> = { 400: 'VALIDATION_ERROR', 401: 'UNAUTHORIZED', 403: 'FORBIDDEN', 404: 'NOT_FOUND', 409: 'CONFLICT', 429: 'RATE_LIMITED' }
  const code = mapping[status] ?? (status >= 500 ? 'UPSTREAM_UNAVAILABLE' : 'INTERNAL')
  return new SelectionCenterError(code, `Selection Center request failed (${status})`, status === 429 || status >= 500, { status })
}
