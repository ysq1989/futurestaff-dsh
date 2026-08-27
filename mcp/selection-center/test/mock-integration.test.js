import assert from 'node:assert/strict'
import test from 'node:test'
import { createHttpSelectionCenterClient, startSelectionCenterMock } from '../lib/index.js'

test('mock upstream exposes an unauthenticated container health endpoint', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const response = await fetch(new URL('/healthz', mock.baseUrl))
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { status: 'ok' })
  } finally {
    await mock.close()
  }
})

test('mock upstream supports search and idempotent pool mutation over real HTTP', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const client = createHttpSelectionCenterClient({ baseUrl: mock.baseUrl, apiKey: 'mock-key' })
    const identity = { tenantId: 'tenant-demo', userId: 'user-demo' }
    const search = await client.searchProducts(identity, { query: '佛公', limit: 20 })
    assert.equal(search.items.length, 2)

    const input = { poolId: 'pool-favorites', productIds: [search.items[0].productId], idempotencyKey: 'request-demo-1' }
    const first = await client.addProductsToPool(identity, input)
    const second = await client.addProductsToPool(identity, input)
    assert.deepEqual(first.addedProductIds, [search.items[0].productId])
    assert.deepEqual(second, first)
  } finally {
    await mock.close()
  }
})

test('mock upstream isolates pool state by tenant', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const client = createHttpSelectionCenterClient({ baseUrl: mock.baseUrl, apiKey: 'mock-key' })
    const input = { poolId: 'pool-favorites', productIds: ['jade-buddha-001'], idempotencyKey: 'request-demo-2' }
    await client.addProductsToPool({ tenantId: 'tenant-a', userId: 'user-a' }, input)
    const tenantB = await client.addProductsToPool({ tenantId: 'tenant-b', userId: 'user-b' }, { ...input, idempotencyKey: 'request-demo-3' })
    assert.deepEqual(tenantB.addedProductIds, ['jade-buddha-001'])
  } finally {
    await mock.close()
  }
})

test('mock upstream rejects reuse of an idempotency key with a different mutation', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const client = createHttpSelectionCenterClient({ baseUrl: mock.baseUrl, apiKey: 'mock-key' })
    const identity = { tenantId: 'tenant-demo', userId: 'user-demo' }
    await client.addProductsToPool(identity, { poolId: 'pool-favorites', productIds: ['jade-buddha-001'], idempotencyKey: 'request-demo-4' })
    await assert.rejects(
      () => client.addProductsToPool(identity, { poolId: 'pool-favorites', productIds: ['jade-buddha-002'], idempotencyKey: 'request-demo-4' }),
      error => error.code === 'CONFLICT',
    )
  } finally {
    await mock.close()
  }
})

test('mock upstream follows the cursor pagination contract', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const client = createHttpSelectionCenterClient({ baseUrl: mock.baseUrl, apiKey: 'mock-key' })
    const identity = { tenantId: 'tenant-demo', userId: 'user-demo' }
    const first = await client.searchProducts(identity, { limit: 1 })
    const second = await client.searchProducts(identity, { cursor: first.nextCursor, limit: 1 })
    assert.equal(first.items.length, 1)
    assert.equal(second.items.length, 1)
    assert.notEqual(first.items[0].productId, second.items[0].productId)
  } finally {
    await mock.close()
  }
})

test('mock upstream fails promptly when its requested port is already in use', async () => {
  const first = await startSelectionCenterMock({ apiKey: 'mock-key' })
  try {
    const port = Number(new URL(first.baseUrl).port)
    await assert.rejects(() => startSelectionCenterMock({ apiKey: 'mock-key', port }), /EADDRINUSE/)
  } finally {
    await first.close()
  }
})
