import assert from 'node:assert/strict'
import test from 'node:test'
import { createIdentityContext } from '@futurestaff/fs-core'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { createSelectionCenterServer, selectionCenterToolMetadata } from '../lib/index.js'

const identity = createIdentityContext({ tenantId: 'tenant-1', userId: 'user-1' })

test('registers the four M2 tools with tenant-scoped execution metadata', async () => {
  const connection = await connect(createFakeClient())
  const tools = await connection.client.listTools()
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['add_products_to_pool', 'get_product', 'list_product_pools', 'search_products'])
  assert.equal(selectionCenterToolMetadata.add_products_to_pool.requiresApproval, true)
  await connection.close()
})

test('search passes trusted identity and defaults limit to 20', async () => {
  let received
  const connection = await connect(createFakeClient({
    searchProducts: async (currentIdentity, input) => { received = { currentIdentity, input }; return { items: [] } },
  }))
  const result = await connection.client.callTool({ name: 'search_products', arguments: { query: '佛公' } })
  assert.equal(result.isError, undefined)
  assert.deepEqual(received, { currentIdentity: { tenantId: 'tenant-1', userId: 'user-1' }, input: { query: '佛公', limit: 20 } })
  await connection.close()
})

test('rejects duplicate product IDs before pool mutation', async () => {
  let called = false
  const connection = await connect(createFakeClient({
    addProductsToPool: async () => { called = true; return { poolId: 'pool-1', addedProductIds: [], existingProductIds: [] } },
  }))
  const result = await connection.client.callTool({ name: 'add_products_to_pool', arguments: { poolId: 'pool-1', productIds: ['p1', 'p1'], idempotencyKey: 'request-123' } })
  assert.equal(result.isError, true)
  assert.equal(called, false)
  await connection.close()
})

async function connect(selectionCenterClient) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createSelectionCenterServer(selectionCenterClient, identity)
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  return { client, close: async () => { await client.close(); await server.close() } }
}

function createFakeClient(overrides = {}) {
  return {
    searchProducts: async () => ({ items: [] }),
    getProduct: async (_identity, productId) => ({ product: { productId, name: 'Product', category: 'jade', price: { amountMinor: 100, currency: 'CNY' }, imageUrls: [], attributes: {} } }),
    listProductPools: async () => ({ items: [] }),
    addProductsToPool: async (_identity, input) => ({ poolId: input.poolId, addedProductIds: input.productIds, existingProductIds: [] }),
    ...overrides,
  }
}
