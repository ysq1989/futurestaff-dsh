import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformApiError, PlatformMockApi } from '../lib/index.js'

const meta = { contractVersion: '0.1.0', simulated: true }
const mockHeaders = {
  'content-type': 'application/json',
  'x-futurestaff-contract-version': '0.1.0',
  'x-futurestaff-mock': 'true',
}

test('adapter accepts only the fixed loopback Mock endpoint', () => {
  assert.throws(() => new PlatformMockApi(fetch, 'https://platform.example.com'), /accepts only/)
  assert.throws(() => new PlatformMockApi(fetch, 'http://127.0.0.1:8080'), /accepts only/)
})

test('adapter rejects an otherwise valid payload without the pinned Mock headers', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({ ok: true, meta }), {
    status: 200, headers: { 'content-type': 'application/json' },
  }))
  await assert.rejects(() => api.logout(undefined), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter maps the pinned token-expired response without leaking the bearer token', async () => {
  const api = new PlatformMockApi(async (_url, init) => {
    assert.match(init.headers.Authorization, /^Bearer /)
    return new Response(JSON.stringify({ error: { code: 'TOKEN_EXPIRED', message: 'expired', retryable: false }, meta }), {
      status: 401, headers: mockHeaders,
    })
  })
  await assert.rejects(() => api.listTenants('private-token'), error => {
    assert.ok(error instanceof PlatformApiError)
    assert.equal(error.code, 'TOKEN_EXPIRED')
    assert.doesNotMatch(error.message, /private-token/)
    return true
  })
})

test('adapter rejects a malformed success session as a contract mismatch', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    session: {
      accessToken: 'mock-access-valid-tenant-a', refreshToken: 'mock-refresh-valid-tenant-a',
      tokenType: 'Bearer', expiresIn: 900.5, audience: 'futurestaff-agent-pc-dev',
      activeTenantId: 'not-a-uuid',
    },
    user: { userId: 'also-not-a-uuid', displayName: '模拟用户' }, meta,
  }), { status: 200, headers: mockHeaders }))

  await assert.rejects(() => api.login({
    code: 'mock-code-success', codeVerifier: 'v'.repeat(43),
    redirectUri: 'http://127.0.0.1:43821/callback', state: 'mock-state-1234567890',
  }), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter rejects unsafe application URLs and malformed capabilities', async () => {
  const tenantId = '10000000-0000-4000-8000-000000000001'
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    activeTenantId: tenantId,
    items: [{
      appId: 'product_hub', tenantId, displayName: '未来市集',
      baseUrl: 'javascript:alert(1)', deepLinks: { home: '/product-hub' },
      capabilities: ['not a capability'], contractRange: '>=0.1.0 <0.2.0',
    }],
    meta,
  }), { status: 200, headers: mockHeaders }))

  await assert.rejects(() => api.listApplications('private-token', tenantId), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter does not surface an unknown server error code as a trusted contract code', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    error: { code: 'UNTRUSTED_SERVER_CODE', message: 'untrusted', retryable: false }, meta,
  }), { status: 400, headers: mockHeaders }))

  await assert.rejects(() => api.logout(undefined), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter rejects a malformed successful logout result', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    ok: true, revocationEffectiveWithinSeconds: 61, unexpected: true, meta,
  }), { status: 200, headers: mockHeaders }))

  await assert.rejects(() => api.logout(undefined), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter rejects a malformed error envelope even when its code is known', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    error: { code: 'TOKEN_EXPIRED', message: 'expired', unexpected: true }, meta,
  }), { status: 401, headers: mockHeaders }))

  await assert.rejects(() => api.logout(undefined), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})

test('adapter rejects extra response metadata fields', async () => {
  const api = new PlatformMockApi(async () => new Response(JSON.stringify({
    ok: true, revocationEffectiveWithinSeconds: 60, meta: { ...meta, unexpected: true },
  }), { status: 200, headers: mockHeaders }))

  await assert.rejects(() => api.logout(undefined), error => {
    assert.equal(error.code, 'CONTRACT_MISMATCH')
    return true
  })
})
