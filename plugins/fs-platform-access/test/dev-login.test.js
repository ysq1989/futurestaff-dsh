import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformDevLoginCoordinator, PlatformDevLoginError } from '../lib/index.js'

const callbackInput = Object.freeze({
  code: 'opaque-code', codeVerifier: 'v'.repeat(43),
  redirectUri: 'http://127.0.0.1:43821/callback', state: 's'.repeat(43),
})
const authResult = Object.freeze({
  session: Object.freeze({
    accessToken: 'private-access-token-with-entropy', refreshToken: 'private-refresh-token-with-entropy',
    tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev',
    activeTenantId: '10000000-0000-4000-8000-000000000001',
  }),
  user: Object.freeze({ userId: '20000000-0000-4000-8000-000000000001', displayName: '测试用户' }),
  meta: Object.freeze({ contractVersion: '0.1.1', simulated: false }),
})

test('DEV login consumes PKCE and saves the decoded session without returning credentials', async () => {
  let saved
  const coordinator = new PlatformDevLoginCoordinator({
    pkce: { begin: () => ({ authorizationUrl: 'https://dev.fsstory.net/login?safe=1' }), consume: () => callbackInput, cancel() {}, diagnostics: () => ({ pending: true }) },
    api: { login: async input => { assert.deepEqual(input, callbackInput); return authResult }, logout: async () => {} },
    vault: { save: async value => { saved = value }, clear: async () => {}, diagnostics: async () => ({ available: true, state: 'stored' }) },
  })

  assert.deepEqual(coordinator.begin(), { authorizationUrl: 'https://dev.fsstory.net/login?safe=1' })
  assert.equal(await coordinator.complete('http://127.0.0.1:43821/callback?redacted'), undefined)
  assert.deepEqual(saved, { session: authResult.session, user: authResult.user })
  assert.deepEqual(await coordinator.diagnostics(), { pending: true, exchanging: false, vault: 'stored' })
  assert.doesNotMatch(JSON.stringify(await coordinator.diagnostics()), /private-access|private-refresh/)
})

test('DEV login revokes the refresh token when protected persistence fails', async () => {
  let revoked
  const coordinator = new PlatformDevLoginCoordinator({
    pkce: { begin: () => ({ authorizationUrl: 'https://dev.fsstory.net/login' }), consume: () => callbackInput, cancel() {}, diagnostics: () => ({ pending: false }) },
    api: { login: async () => authResult, logout: async token => { revoked = token } },
    vault: { save: async () => { throw new Error('native secret detail') }, clear: async () => {}, diagnostics: async () => ({ available: true, state: 'empty' }) },
  })

  await assert.rejects(() => coordinator.complete('safe-callback'), error => {
    assert.ok(error instanceof PlatformDevLoginError)
    assert.equal(error.code, 'storage-failure')
    assert.doesNotMatch(error.message, /private|native/)
    return true
  })
  assert.equal(revoked, authResult.session.refreshToken)
})
