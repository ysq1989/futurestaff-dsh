import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { apply as applyClient } from '../lib/client/index.js'
import { apply as applyHost } from '../lib/index.js'

test('host registers only the six exact platform Mock bridge routes', () => {
  const registrations = []
  const ctx = {
    effect: register => { register() },
    webServer: { register: route => { registrations.push(route); return () => {} } },
  }

  applyHost(ctx)

  assert.equal(registrations.length, 6)
  assert.deepEqual(registrations.map(item => item.kind), Array(6).fill('exact'))
  assert.deepEqual(registrations.map(item => item.path).sort(), [
    '/_futurestaff/platform-mock/desktop/v1/apps',
    '/_futurestaff/platform-mock/desktop/v1/auth/callback',
    '/_futurestaff/platform-mock/desktop/v1/auth/logout',
    '/_futurestaff/platform-mock/desktop/v1/auth/refresh',
    '/_futurestaff/platform-mock/desktop/v1/tenants',
    '/_futurestaff/platform-mock/desktop/v1/tenants/switch',
  ])
})

test('host bridge forwards only allowlisted request data and preserves Mock proof headers', async t => {
  const registrations = []
  applyHost({
    effect: register => { register() },
    webServer: { register: route => { registrations.push(route); return () => {} } },
  })
  const route = registrations.find(item => item.path.endsWith('/tenants'))
  const originalFetch = globalThis.fetch
  let upstream
  globalThis.fetch = async (input, init) => {
    upstream = { input, init }
    return new Response(JSON.stringify({ activeTenantId: 'tenant-a', items: [], meta: { contractVersion: '0.1.0', simulated: true } }), {
      status: 200,
      headers: { 'x-futurestaff-mock': 'true', 'x-futurestaff-contract-version': '0.1.0' },
    })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  const server = createServer((request, response) => { void route.handler(request, response) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  const response = await originalFetch(`http://127.0.0.1:${address.port}${route.path}`, {
    headers: { authorization: 'Bearer inert-mock-label', 'x-untrusted': 'must-not-forward' },
  })

  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-futurestaff-mock'), 'true')
  assert.equal(upstream.input, 'http://127.0.0.1:43821/desktop/v1/tenants')
  assert.equal(upstream.init.headers.authorization, 'Bearer inert-mock-label')
  assert.equal(upstream.init.headers['x-untrusted'], undefined)
})

test('client registers the access panel in the DSH Settings section ledger', () => {
  let slotName
  let registration
  let component
  const slots = {
    inject: (name, register) => { slotName = name; register() },
    register: (options, candidate) => {
      registration = options
      component = candidate
      return () => {}
    },
  }

  applyClient({ slots })

  assert.equal(slotName, 'settings.section')
  assert.deepEqual(registration, {
    name: 'settings.section', id: 'futurestaff-access', order: -10, label: 'FutureStaff',
  })
  assert.equal(typeof component, 'function')
})

test('embedded Mock completes login and tenant-scoped discovery without an external process', async t => {
  const registrations = []
  applyHost({
    effect: register => { register() },
    webServer: { register: route => { registrations.push(route); return () => {} } },
  }, { embeddedMock: true })
  const server = createServer((request, response) => {
    const route = registrations.find(item => item.path === new URL(request.url, 'http://localhost').pathname)
    void route.handler(request, response)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const address = server.address()
  const origin = `http://127.0.0.1:${address.port}/_futurestaff/platform-mock`
  const login = await fetch(`${origin}/desktop/v1/auth/callback`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ clientId: 'futurestaff-agent-pc-dev', code: 'mock-code-success', codeVerifier: 'v'.repeat(43), redirectUri: 'http://127.0.0.1:43821/callback', state: 'mock-state-1234567890' }),
  })
  const loginBody = await login.json()
  assert.equal(login.status, 200)
  assert.equal(login.headers.get('x-futurestaff-contract-version'), '0.1.0')
  const apps = await fetch(`${origin}/desktop/v1/apps`, { headers: { authorization: `Bearer ${loginBody.session.accessToken}` } })
  const appsBody = await apps.json()
  assert.deepEqual(appsBody.items.map(item => item.appId), ['agent', 'product_hub'])
  assert.equal(appsBody.meta.simulated, true)
})
