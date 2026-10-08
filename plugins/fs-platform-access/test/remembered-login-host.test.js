import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { apply } from '../lib/plugin.js'

test('real Host routes authenticate saved passwords privately and reject unguarded metadata access', async t => {
  const actualFetch = globalThis.fetch, values = new Map(), routes = [], forwarded = []
  const tenantId = '10000000-0000-4000-8000-000000000001'
  const meta = { contractVersion: '0.1.1', simulated: false }
  globalThis.fetch = async (url, init) => {
    const pathname = new URL(url).pathname
    if (pathname === '/desktop/v1/auth/password') {
      const body = JSON.parse(init.body); forwarded.push(body)
      assert.equal(body.password, 'fixture-only-password')
      assert.equal(body.rememberPassword, undefined)
      return Response.json({ session: { accessToken: 'fixture-access-token-with-entropy', refreshToken: 'fixture-refresh-token-with-entropy', tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev', activeTenantId: tenantId }, user: { userId: '20000000-0000-4000-8000-000000000001', displayName: 'Fixture', email: null }, meta })
    }
    if (pathname === '/desktop/v1/tenants') return Response.json({ activeTenantId: tenantId, items: [{ tenantId, displayName: 'Fixture', slug: 'fixture', role: 'member', logoUrl: null }], meta })
    if (pathname === '/desktop/v1/models') return Response.json({ activeTenantId: tenantId, activeModelId: null, items: [], meta })
    if (pathname === '/desktop/v1/apps') return Response.json({ activeTenantId: tenantId, items: [], meta })
    throw Error('Unexpected fixture route')
  }
  t.after(() => { globalThis.fetch = actualFetch })
  const disposers = []
  apply({ get: key => key === 'desktopProtectedSecrets' ? { available: async () => true, has: async key => values.has(key), read: async key => values.get(key), write: async (key, value) => values.set(key, value), delete: async key => values.delete(key) } : undefined,
    provide: () => {}, effect: fn => { const dispose = fn(); if (typeof dispose === 'function') disposers.push(dispose) },
    webServer: { register: route => { routes.push(route); return () => {} } } }, { environment: 'dev' })
  const server = createServer((request, response) => {
    const route = routes.find(route => route.path === new URL(request.url, 'http://localhost').pathname)
    if (!route) { response.statusCode = 404; return response.end() }
    void route.handler(request, response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => { for (const dispose of disposers) dispose(); server.close() })
  const root = `http://127.0.0.1:${server.address().port}/_futurestaff/platform-dev`
  assert.equal((await actualFetch(root + '/auth/remembered')).status, 403)
  const headers = { 'x-futurestaff-login': '1', 'content-type': 'application/json' }
  const login = password => actualFetch(root + '/auth/password', { method: 'POST', headers, body: JSON.stringify({ loginIdentifier: 'fixture@example.invalid', password, rememberPassword: true }) })
  const first = await login('fixture-only-password')
  assert.equal(first.status, 200)
  assert.equal((await first.json()).phase, 'no_apps')
  const hint = await (await actualFetch(root + '/auth/remembered', { headers })).json()
  assert.deepEqual(hint, { available: true, remembered: true, loginIdentifier: 'fixture@example.invalid' })
  assert.doesNotMatch(JSON.stringify(hint), /fixture-only-password|accessToken|refreshToken/)
  assert.equal((await login('')).status, 200)
  assert.equal(forwarded.length, 2)
  const forgotten = await (await actualFetch(root + '/auth/remembered', { method: 'DELETE', headers })).json()
  assert.equal(forgotten.remembered, false)
  assert.equal((await login('')).status, 401)
})
