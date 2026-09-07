import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformPkceTransaction, PlatformPkceError } from '../lib/index.js'

test('PKCE transaction creates the pinned S256 authorization request', () => {
  const bytes = Buffer.from(Array.from({ length: 64 }, (_, index) => index))
  let offset = 0
  const pkce = new PlatformPkceTransaction({
    randomBytes: size => bytes.subarray(offset, offset += size),
    now: () => 1_000,
  })
  const request = pkce.begin()
  const url = new URL(request.authorizationUrl)

  assert.equal(url.origin + url.pathname, 'https://dev.fsstory.net/login')
  assert.equal(url.searchParams.get('client_id'), 'futurestaff-agent-pc-dev')
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:43821/callback')
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.match(url.searchParams.get('state'), /^[A-Za-z0-9_-]{43}$/)
  assert.match(url.searchParams.get('code_challenge'), /^[A-Za-z0-9_-]{43}$/)
  assert.doesNotMatch(request.authorizationUrl, /code_verifier|verifier/i)
  assert.deepEqual(pkce.diagnostics(), { pending: true })
  assert.throws(() => pkce.begin(), error => {
    assert.equal(error.code, 'transaction-pending')
    return true
  })
})

test('PKCE callback is exact, one-time and returns the verifier only to the exchange caller', () => {
  const pkce = new PlatformPkceTransaction({ randomBytes: size => Buffer.alloc(size, 7), now: () => 1_000 })
  const request = pkce.begin()
  const state = new URL(request.authorizationUrl).searchParams.get('state')
  const result = pkce.consume(`http://127.0.0.1:43821/callback?code=opaque-code&state=${state}`)

  assert.equal(result.code, 'opaque-code')
  assert.match(result.codeVerifier, /^[A-Za-z0-9_-]{43}$/)
  assert.equal(result.redirectUri, 'http://127.0.0.1:43821/callback')
  assert.equal(result.state, state)
  assert.deepEqual(pkce.diagnostics(), { pending: false })
  assert.throws(() => pkce.consume(`http://127.0.0.1:43821/callback?code=again&state=${state}`), error => {
    assert.ok(error instanceof PlatformPkceError)
    assert.equal(error.code, 'no-pending-transaction')
    return true
  })
})

test('PKCE callback rejects wrong origins, extra fields, state mismatch and expiry without secrets', () => {
  for (const callback of [
    'http://localhost:43821/callback?code=opaque&state=unused',
    'http://127.0.0.1:43821/callback?code=opaque&state=unused&extra=1',
  ]) {
    const pkce = new PlatformPkceTransaction({ randomBytes: size => Buffer.alloc(size, 9), now: () => 1_000 })
    pkce.begin()
    assert.throws(() => pkce.consume(callback), error => {
      assert.ok(error instanceof PlatformPkceError)
      assert.doesNotMatch(error.message, /opaque|unused/)
      return true
    })
  }

  const mismatched = new PlatformPkceTransaction({ randomBytes: size => Buffer.alloc(size, 10), now: () => 1_000 })
  mismatched.begin()
  assert.throws(
    () => mismatched.consume(`http://127.0.0.1:43821/callback?code=opaque&state=${'x'.repeat(43)}`),
    error => {
      assert.equal(error.code, 'state-mismatch')
      assert.doesNotMatch(error.message, /opaque|x{10}/)
      return true
    },
  )
  assert.deepEqual(mismatched.diagnostics(), { pending: false })

  let now = 1_000
  const pkce = new PlatformPkceTransaction({ randomBytes: size => Buffer.alloc(size, 11), now: () => now })
  const request = pkce.begin()
  const state = new URL(request.authorizationUrl).searchParams.get('state')
  now += 5 * 60_000 + 1
  assert.throws(() => pkce.consume(`http://127.0.0.1:43821/callback?code=opaque&state=${state}`), error => {
    assert.equal(error.code, 'transaction-expired')
    assert.doesNotMatch(JSON.stringify(error), /codeVerifier|opaque/)
    return true
  })
  assert.deepEqual(pkce.diagnostics(), { pending: false })
})
