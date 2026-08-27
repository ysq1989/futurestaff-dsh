import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { once } from 'node:events'
import {
  addProductsToPoolInputSchema, listProductPoolsInputSchema, searchProductsInputSchema,
  type AddProductsToPoolOutput,
} from './schemas.js'

const products = [
  { productId: 'jade-buddha-001', name: '冰种翡翠佛公', category: 'jade-buddha', price: { amountMinor: 88000, currency: 'CNY' }, imageUrls: [], attributes: { color: 'green' } },
  { productId: 'jade-buddha-002', name: '晴水翡翠佛公', category: 'jade-buddha', price: { amountMinor: 128000, currency: 'CNY' }, imageUrls: [], attributes: { color: 'light-green' } },
  { productId: 'jade-bangle-001', name: '糯种翡翠手镯', category: 'jade-bangle', price: { amountMinor: 168000, currency: 'CNY' }, imageUrls: [], attributes: { color: 'green' } },
]

export interface SelectionCenterMockOptions { apiKey: string; host?: string; port?: number }
export interface SelectionCenterMockHandle { baseUrl: string; close(): Promise<void> }

export async function startSelectionCenterMock(options: SelectionCenterMockOptions): Promise<SelectionCenterMockHandle> {
  const tenantPools = new Map<string, Map<string, Set<string>>>()
  const idempotency = new Map<string, { fingerprint: string; output: AddProductsToPoolOutput }>()
  const server = createServer((request, response) => void handle(request, response))

  async function handle(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://localhost')
    if (request.method === 'GET' && url.pathname === '/healthz') return json(response, 200, { status: 'ok' })
    const tenantId = header(request, 'x-futurestaff-tenant-id')
    const userId = header(request, 'x-futurestaff-user-id')
    if (request.headers.authorization !== `Bearer ${options.apiKey}`) return json(response, 401, { error: { code: 'UNAUTHORIZED' } })
    if (!tenantId || !userId) return json(response, 400, { error: { code: 'VALIDATION_ERROR' } })
    try {
      if (request.method === 'POST' && url.pathname === '/v1/products/search') {
        const input = searchProductsInputSchema.parse(await readJson(request))
        const query = input.query?.toLocaleLowerCase()
        const matches = products.filter(product =>
          (!query || product.name.toLocaleLowerCase().includes(query))
          && (!input.category || product.category === input.category)
          && (!input.price || product.price.currency === input.price.currency)
          && (input.price?.minMinor === undefined || product.price.amountMinor >= input.price.minMinor)
          && (input.price?.maxMinor === undefined || product.price.amountMinor <= input.price.maxMinor))
        return json(response, 200, page(matches, input.cursor, input.limit))
      }
      const productMatch = url.pathname.match(/^\/v1\/products\/([^/]+)$/)
      if (request.method === 'GET' && productMatch) {
        const product = products.find(item => item.productId === decodeURIComponent(productMatch[1] ?? ''))
        return product ? json(response, 200, { product }) : json(response, 404, { error: { code: 'NOT_FOUND' } })
      }
      if (request.method === 'POST' && url.pathname === '/v1/product-pools/list') {
        const input = listProductPoolsInputSchema.parse(await readJson(request))
        const pools = tenantPools.get(tenantId) ?? new Map<string, Set<string>>()
        const items = [...pools].map(([poolId, ids]) => ({ poolId, name: poolId, productCount: ids.size }))
        return json(response, 200, page(items, input.cursor, input.limit))
      }
      const poolMatch = url.pathname.match(/^\/v1\/product-pools\/([^/]+)\/products$/)
      if (request.method === 'POST' && poolMatch) {
        const poolId = decodeURIComponent(poolMatch[1] ?? '')
        const idempotencyKey = header(request, 'idempotency-key')
        const input = addProductsToPoolInputSchema.parse({ poolId, ...(await readJson(request) as object), idempotencyKey })
        const replayKey = `${tenantId}:${input.idempotencyKey}`
        const fingerprint = JSON.stringify({ poolId, productIds: [...input.productIds].sort() })
        const replay = idempotency.get(replayKey)
        if (replay && replay.fingerprint !== fingerprint) return json(response, 409, { error: { code: 'CONFLICT' } })
        if (replay) return json(response, 200, replay.output)
        const pools = tenantPools.get(tenantId) ?? new Map<string, Set<string>>()
        tenantPools.set(tenantId, pools)
        const pool = pools.get(poolId) ?? new Set<string>()
        pools.set(poolId, pool)
        const addedProductIds = input.productIds.filter(productId => !pool.has(productId))
        const existingProductIds = input.productIds.filter(productId => pool.has(productId))
        for (const productId of addedProductIds) pool.add(productId)
        const output = { poolId, addedProductIds, existingProductIds }
        idempotency.set(replayKey, { fingerprint, output })
        return json(response, 200, output)
      }
      return json(response, 404, { error: { code: 'NOT_FOUND' } })
    } catch {
      return json(response, 400, { error: { code: 'VALIDATION_ERROR' } })
    }
  }

  const host = options.host ?? '127.0.0.1'
  server.listen(options.port ?? 0, host)
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Mock server did not bind a TCP port')
  const displayHost = host === '0.0.0.0' ? '127.0.0.1' : host
  return { baseUrl: `http://${displayHost}:${address.port}/`, close: async () => { server.close(); await once(server, 'close') } }
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name]
  return Array.isArray(value) ? value[0] : value
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk)
    size += buffer.length
    if (size > 1_000_000) throw new Error('request too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' })
  response.end(JSON.stringify(body))
}

function page<T>(items: T[], cursor: string | undefined, limit: number): { items: T[]; nextCursor?: string } {
  const offset = cursor === undefined ? 0 : Number(cursor)
  if (!Number.isInteger(offset) || offset < 0) throw new Error('invalid cursor')
  const end = offset + limit
  return { items: items.slice(offset, end), ...(end < items.length ? { nextCursor: String(end) } : {}) }
}
