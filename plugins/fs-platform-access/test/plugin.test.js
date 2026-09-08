import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createServer, request as httpRequest } from 'node:http'
import test from 'node:test'

import { apply as applyClient, beginPlatformDevLogin } from '../lib/client/index.js'
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

test('client opens only a strictly validated Host authorization URL', async () => {
  const authorizationUrl = `https://dev.fsstory.net/login?client_id=futurestaff-agent-pc-dev&redirect_uri=${encodeURIComponent('http://127.0.0.1:43821/callback')}&state=${'s'.repeat(43)}&code_challenge=${'c'.repeat(43)}&code_challenge_method=S256`
  let opened
  await beginPlatformDevLogin(
    async (input, init) => {
      assert.equal(input, '/_futurestaff/platform-dev/login')
      assert.equal(init.method, 'POST')
      assert.equal(init.headers['x-futurestaff-login'], '1')
      return new Response(JSON.stringify({ authorizationUrl }), { status: 200 })
    },
    (...args) => { opened = args },
  )
  assert.deepEqual(opened, [authorizationUrl, '_blank', 'noopener,noreferrer'])
  await assert.rejects(() => beginPlatformDevLogin(
    async () => new Response(JSON.stringify({ authorizationUrl: 'https://evil.invalid/login' }), { status: 200 }),
    () => { throw new Error('must not open') },
  ), /unavailable/)
  await assert.rejects(() => beginPlatformDevLogin(
    async () => new Response(JSON.stringify({ authorizationUrl: 'not a URL with private data' }), { status: 200 }),
    () => { throw new Error('must not open') },
  ), error => {
    assert.equal(error.message, 'FutureStaff login is unavailable.')
    assert.doesNotMatch(error.message, /private data/)
    return true
  })
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

test('client registers Settings access and a mandatory login gate', () => {
  const slotNames = []
  const registrations = []
  const components = []
  const slots = {
    inject: (name, register) => { slotNames.push(name); register() },
    register: (options, candidate) => {
      registrations.push(options)
      components.push(candidate)
      return () => {}
    },
  }

  applyClient({ slots })

  assert.deepEqual(slotNames, ['settings.section', 'shell.overlay'])
  assert.deepEqual(registrations, [
    { name: 'settings.section', id: 'futurestaff-access', order: -10, label: 'FutureStaff' },
    { name: 'shell.overlay', id: 'futurestaff-login-gate', order: -100 },
  ])
  assert.ok(components.every(component => typeof component === 'function'))
})

test('client panel styles cover narrow screens, keyboard focus and reduced motion', async () => {
  const source = await readFile(new URL('../src/client/index.tsx', import.meta.url), 'utf8')
  assert.match(source, /@media \(max-width: 640px\)/)
  assert.match(source, /:focus-visible/)
  assert.match(source, /prefers-reduced-motion/)
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

test('desktop Host mounts one exact loopback callback and persists a fake DEV exchange', async t => {
  const registrations = []
  let loginService
  const values = new Map()
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (input, init) => {
    const url = new URL(input)
    const meta = { contractVersion: '0.1.1', simulated: false }
    const tenantId = '10000000-0000-4000-8000-000000000001'
    if (url.pathname === '/desktop/v1/auth/callback') return new Response(JSON.stringify({
      session: { accessToken: 'private-access-token-with-entropy', refreshToken: 'private-refresh-token-with-entropy', tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev', activeTenantId: tenantId },
      user: { userId: '20000000-0000-4000-8000-000000000001', displayName: '测试用户' }, meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/desktop/v1/tenants') return new Response(JSON.stringify({
      activeTenantId: tenantId,
      items: [{ tenantId, displayName: '测试公司', slug: 'test-company', logoUrl: null, role: 'member' }], meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/desktop/v1/apps') return new Response(JSON.stringify({
      activeTenantId: tenantId,
      items: [
        { appId: 'agent', tenantId, displayName: 'FutureStaff Agent', baseUrl: 'https://dev.fsstory.net', deepLinks: { home: '/' }, capabilities: ['agent.read'], contractRange: '>=0.1.1 <0.2.0' },
        { appId: 'product_hub', tenantId, displayName: '未来市集', baseUrl: 'https://dev.fsstory.net', deepLinks: { home: '/product-hub' }, capabilities: ['product_hub.read'], contractRange: '>=0.1.1 <0.2.0' },
      ], meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/desktop/v1/models') return new Response(JSON.stringify({
      activeTenantId: tenantId,
      activeModelId: '30000000-0000-4000-8000-000000000001',
      items: [{
        modelId: '30000000-0000-4000-8000-000000000001', displayName: '平台默认模型',
        provider: 'openai', model: 'gpt-platform', supportsVision: true, isDefault: true,
      }], meta,
    }), { status: 200, headers: { 'content-type': 'application/json' } })
    if (url.pathname === '/desktop/v1/apps/product_hub/token') {
      assert.equal(init.headers.Authorization, 'Bearer private-access-token-with-entropy')
      return new Response(JSON.stringify({
        accessToken: 'short-lived-product-hub-token-with-entropy', tokenType: 'Bearer', expiresIn: 60,
        audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'], meta,
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    throw new Error('unexpected fake DEV route')
  }
  t.after(() => { globalThis.fetch = originalFetch })

  applyHost({
    effect: register => { register() },
    get: name => name === 'desktopProtectedSecrets' ? {
      available: async () => true, has: async key => values.has(key), read: async key => values.get(key),
      write: async (key, value) => { values.set(key, value) }, delete: async key => { values.delete(key) },
    } : undefined,
    provide: (name, value) => { if (name === 'platformDevLogin') loginService = value; return () => {} },
    webServer: { host: '127.0.0.1', port: 43821, register: route => { registrations.push(route); return () => {} } },
  })
  assert.equal(registrations.length, 13)
  const startRoute = registrations.find(item => item.path === '/_futurestaff/platform-dev/login')
  const startServer = createServer((request, response) => {
    const path = new URL(request.url, 'http://127.0.0.1').pathname
    const route = registrations.find(item => item.path === path)
    if (route === undefined) { response.statusCode = 404; return response.end() }
    void route.handler(request, response)
  })
  await new Promise(resolve => startServer.listen(0, '127.0.0.1', resolve))
  t.after(() => startServer.close())
  const startAddress = startServer.address()
  const startResponse = await originalFetch(`http://127.0.0.1:${startAddress.port}/_futurestaff/platform-dev/login`, {
    method: 'POST', headers: { 'x-futurestaff-login': '1' },
  })
  assert.equal(startResponse.status, 200)
  const authorization = new URL((await startResponse.json()).authorizationUrl)
  t.after(() => loginService.cancel())
  const callbackResult = await new Promise((resolve, reject) => {
    const request = httpRequest({
      hostname: '127.0.0.1', port: 43821,
      path: `/callback?code=opaque-code&state=${authorization.searchParams.get('state')}`,
      headers: { host: '127.0.0.1:43821' },
    }, response => {
      const chunks = []
      response.on('data', chunk => chunks.push(chunk))
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    request.on('error', reject)
    request.end()
  })
  assert.equal(callbackResult.status, 200)
  assert.match(callbackResult.body, /Authorization complete/)
  assert.equal(values.size, 1)
  assert.doesNotMatch(JSON.stringify(await loginService.diagnostics()), /private-access|private-refresh/)
  const sessionResponse = await originalFetch(`http://127.0.0.1:${startAddress.port}/_futurestaff/platform-dev/session`, {
    headers: { 'x-futurestaff-session': '1' },
  })
  assert.equal(sessionResponse.status, 200)
  const safeSnapshot = await sessionResponse.json()
  assert.equal(safeSnapshot.phase, 'ready')
  assert.equal(safeSnapshot.user.displayName, '测试用户')
  assert.doesNotMatch(JSON.stringify(safeSnapshot), /private-access|private-refresh/)
  const rejectedSession = await originalFetch(`http://127.0.0.1:${startAddress.port}/_futurestaff/platform-dev/session`)
  assert.equal(rejectedSession.status, 403)
  assert.deepEqual(await rejectedSession.json(), { error: 'SESSION_UNAVAILABLE' })
  const tokenResponse = await originalFetch(`http://127.0.0.1:${startAddress.port}/_futurestaff/platform-dev/apps/product_hub/token`, {
    method: 'POST', headers: { 'x-futurestaff-application': 'product_hub' },
  })
  assert.equal(tokenResponse.status, 200)
  assert.equal(tokenResponse.headers.get('cache-control'), 'no-store')
  const applicationToken = await tokenResponse.json()
  assert.equal(applicationToken.expiresIn, 60)
  assert.equal(applicationToken.tenantId, safeSnapshot.activeTenantId)
  assert.equal(applicationToken.accessToken, 'short-lived-product-hub-token-with-entropy')
  assert.doesNotMatch(JSON.stringify(applicationToken), /private-access-token|private-refresh-token/)
  const rejectedToken = await originalFetch(`http://127.0.0.1:${startAddress.port}/_futurestaff/platform-dev/apps/product_hub/token`, {
    method: 'POST',
  })
  assert.equal(rejectedToken.status, 403)
  assert.deepEqual(await rejectedToken.json(), { error: 'APPLICATION_UNAVAILABLE' })
})
