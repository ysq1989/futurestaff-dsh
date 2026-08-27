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
