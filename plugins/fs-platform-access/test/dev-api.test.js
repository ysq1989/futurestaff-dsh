import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformApiError, PlatformDevApi } from '../lib/index.js'

const tenantId = '10000000-0000-4000-8000-000000000001'
const meta = { contractVersion: '0.1.1', simulated: false }

test('DEV adapter accepts only the pinned A02 origin without an api prefix', () => {
  assert.doesNotThrow(() => new PlatformDevApi(fetch))
  assert.throws(() => new PlatformDevApi(fetch, 'https://dev.fsstory.net/api'), /exact Platform DEV origin/)
  assert.throws(() => new PlatformDevApi(fetch, 'https://platform-dev.fsstory.net'), /exact Platform DEV origin/)
  assert.throws(() => new PlatformDevApi(fetch, 'http://dev.fsstory.net'), /exact Platform DEV origin/)
})

test('DEV adapter accepts a strict non-simulated v0.1.1 response without Mock proof headers', async () => {
  const api = new PlatformDevApi(async input => {
    assert.equal(input, 'https://dev.fsstory.net/desktop/v1/tenants')
    return new Response(JSON.stringify({ activeTenantId: tenantId, items: [{
      tenantId, displayName: '甲公司', slug: 'company-a', logoUrl: null, role: 'member',
    }], meta }), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  const result = await api.listTenants('private-platform-token')
  assert.equal(result.meta.simulated, false)
  assert.equal(result.meta.contractVersion, '0.1.1')
})

test('DEV adapter validates a one-minute token against the requested tenant', async () => {
  const api = new PlatformDevApi(async (input, init) => {
    assert.equal(input, 'https://dev.fsstory.net/desktop/v1/apps/product_hub/token')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers.Authorization, 'Bearer private-platform-token')
    return new Response(JSON.stringify({
      accessToken: 'application-token-with-enough-entropy', tokenType: 'Bearer', expiresIn: 60,
      audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'], meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  const result = await api.issueApplicationToken('private-platform-token', 'product_hub', tenantId)
  assert.equal(result.tenantId, tenantId)
  assert.equal(result.expiresIn, 60)
  assert.deepEqual(result.permissions, ['product_hub.read'])
})

test('DEV adapter rejects malformed application-token data and unsafe app IDs before transport', async () => {
  let requests = 0
  const api = new PlatformDevApi(async () => {
    requests += 1
    return new Response(JSON.stringify({
      accessToken: 'application-token-with-enough-entropy', tokenType: 'Bearer', expiresIn: 61,
      audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'], meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
  })

  await assert.rejects(() => api.issueApplicationToken('private-platform-token', '../erp', tenantId))
  assert.equal(requests, 0)
  await assert.rejects(() => api.issueApplicationToken('private-platform-token', 'product_hub', tenantId), error => {
    assert.ok(error instanceof PlatformApiError)
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    assert.doesNotMatch(error.message, /private-platform-token/)
    return true
  })
})

test('DEV adapter rejects Mock or wrong-version metadata', async () => {
  const api = new PlatformDevApi(async () => new Response(JSON.stringify({
    activeTenantId: tenantId, items: [], meta: { contractVersion: '0.1.0', simulated: true },
  }), { status: 200, headers: { 'content-type': 'application/json' } }))

  await assert.rejects(() => api.listTenants('private-platform-token'), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('DEV transport failure is bounded and never mislabeled as a Mock failure', async () => {
  const api = new PlatformDevApi(async () => { throw new Error('private network detail') })
  await assert.rejects(() => api.listTenants('private-platform-token'), error => {
    assert.equal(error.code, 'PLATFORM_UNAVAILABLE')
    assert.doesNotMatch(error.message, /private network detail|private-platform-token/)
    return true
  })
})
