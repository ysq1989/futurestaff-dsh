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
