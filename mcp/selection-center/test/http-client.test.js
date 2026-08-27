import assert from 'node:assert/strict'
import test from 'node:test'
import { createHttpSelectionCenterClient, SelectionCenterError } from '../lib/index.js'

test('HTTP adapter forwards trusted identity and validates the upstream response', async () => {
  let request
  const client = createHttpSelectionCenterClient({
    baseUrl: 'https://selection.example/',
    apiKey: 'secret-for-test',
    fetch: async (url, init) => {
      request = { url: String(url), init }
      return Response.json({ items: [] })
    },
  })
  const output = await client.searchProducts({ tenantId: 'tenant-1', userId: 'user-1' }, { query: '佛公', limit: 20 })
  assert.deepEqual(output, { items: [] })
  assert.equal(request.url, 'https://selection.example/v1/products/search')
  assert.equal(request.init.headers['x-futurestaff-tenant-id'], 'tenant-1')
  assert.equal(request.init.headers['x-futurestaff-user-id'], 'user-1')
})

test('HTTP adapter does not expose an untrusted upstream error body', async () => {
  const client = createHttpSelectionCenterClient({
    baseUrl: 'https://selection.example/',
    apiKey: 'secret-for-test',
    fetch: async () => Response.json({ internalSecret: 'must-not-leak' }, { status: 500 }),
  })
  await assert.rejects(
    () => client.getProduct({ tenantId: 'tenant-1', userId: 'user-1' }, 'product-1'),
    error => error instanceof SelectionCenterError && error.code === 'UPSTREAM_UNAVAILABLE'
      && JSON.stringify(error.details) === '{"status":500}',
  )
})

test('HTTP adapter rejects unsafe configuration at construction', () => {
  assert.throws(() => createHttpSelectionCenterClient({ baseUrl: 'file:///tmp/data', apiKey: 'secret' }), /HTTP or HTTPS/)
  assert.throws(() => createHttpSelectionCenterClient({ baseUrl: 'https://selection.example/', apiKey: ' ' }), /apiKey/)
})

test('HTTP adapter times out, correlates the request, and emits a safe completion event', async () => {
  const events = []
  const client = createHttpSelectionCenterClient({
    baseUrl: 'https://selection.example/',
    apiKey: 'secret-for-test',
    timeoutMs: 5,
    requestId: () => 'request-1',
    logger: { emit: event => events.push(event) },
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
    }),
  })
  await assert.rejects(
    () => client.getProduct({ tenantId: 'tenant-1', userId: 'user-1' }, 'product-1'),
    error => error instanceof SelectionCenterError && error.code === 'UPSTREAM_UNAVAILABLE' && error.retryable,
  )
  assert.equal(events.length, 1)
  assert.deepEqual(events[0], {
    event: 'selection_center_request_completed',
    requestId: 'request-1',
    operation: 'get_product',
    outcome: 'timeout',
    durationMs: events[0].durationMs,
    errorCode: 'UPSTREAM_UNAVAILABLE',
  })
  assert.equal(Number.isInteger(events[0].durationMs), true)
})

test('HTTP adapter forwards the correlation ID without logging credentials or identity', async () => {
  const events = []
  let headers
  const client = createHttpSelectionCenterClient({
    baseUrl: 'https://selection.example/', apiKey: 'secret-for-test', requestId: () => 'request-2',
    logger: { emit: event => events.push(event) },
    fetch: async (_url, init) => { headers = init.headers; return Response.json({ items: [] }) },
  })
  await client.searchProducts({ tenantId: 'tenant-secret', userId: 'user-secret' }, { limit: 20 })
  assert.equal(headers['x-request-id'], 'request-2')
  const serialized = JSON.stringify(events)
  assert.doesNotMatch(serialized, /secret-for-test|tenant-secret|user-secret/)
  assert.equal(events[0].outcome, 'success')
})

test('telemetry failure does not turn a successful upstream request into a Tool failure', async () => {
  const client = createHttpSelectionCenterClient({
    baseUrl: 'https://selection.example/', apiKey: 'secret-for-test',
    logger: { emit: () => { throw new Error('telemetry offline') } },
    fetch: async () => Response.json({ items: [] }),
  })
  await assert.doesNotReject(() => client.searchProducts({ tenantId: 'tenant-1', userId: 'user-1' }, { limit: 20 }))
})
