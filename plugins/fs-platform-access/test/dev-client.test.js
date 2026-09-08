import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getPlatformDevAccessSnapshot,
  getProductHubApplicationToken,
  PlatformDevClientController,
  shouldShowPlatformLoginGate,
} from '../lib/client/index.js'

const tenantId = '10000000-0000-4000-8000-000000000001'
const snapshot = {
  phase: 'ready', simulated: false, contractVersion: '0.1.1',
  user: { userId: '20000000-0000-4000-8000-000000000001', displayName: 'DEV 用户', email: 'dev@example.invalid' },
  activeTenantId: tenantId,
  tenants: [{ tenantId, displayName: 'DEV 公司', slug: 'dev-company', logoUrl: null, role: 'member' }],
  applications: [{
    appId: 'agent', tenantId, displayName: 'FutureStaff Agent', baseUrl: 'https://dev.fsstory.net',
    deepLinks: { home: '/' }, capabilities: ['agent.read'], contractRange: '>=0.1.1 <0.2.0',
  }],
  models: [{
    modelId: '30000000-0000-4000-8000-000000000001', displayName: '平台默认模型',
    provider: 'openai', model: 'gpt-platform', supportsVision: true, isDefault: true,
  }],
  activeModelId: '30000000-0000-4000-8000-000000000001',
}

test('login gate blocks every unauthenticated phase and clears only after platform context loads', () => {
  for (const phase of ['signed_out', 'loading', 'expired', 'error']) {
    assert.equal(shouldShowPlatformLoginGate({
      phase, simulated: false, contractVersion: '0.1.1', tenants: [], applications: [], models: [],
    }), true)
  }
  assert.equal(shouldShowPlatformLoginGate(snapshot), false)
  assert.equal(shouldShowPlatformLoginGate({ ...snapshot, phase: 'no_apps', applications: [] }), false)
})

test('DEV client uses only guarded Host session routes and keeps responses credential-free', async () => {
  const calls = []
  const controller = new PlatformDevClientController(async (input, init) => {
    calls.push({ input, init })
    return new Response(JSON.stringify(snapshot), { status: 200 })
  }, () => {})

  await controller.restore()
  await controller.refresh()
  await controller.switchTenant(tenantId)
  await controller.logout()

  assert.deepEqual(calls.map(call => call.input), [
    '/_futurestaff/platform-dev/session',
    '/_futurestaff/platform-dev/session/refresh',
    '/_futurestaff/platform-dev/session/switch',
    '/_futurestaff/platform-dev/session/logout',
  ])
  assert.ok(calls.every(call => call.init.headers['x-futurestaff-session'] === '1'))
  assert.equal(calls[2].init.body, JSON.stringify({ tenantId }))
  assert.doesNotMatch(JSON.stringify(controller.getSnapshot()), /accessToken|refreshToken/)
})

test('DEV client submits account credentials only to the guarded local Host login route', async () => {
  const calls = []
  const controller = new PlatformDevClientController(async (input, init) => {
    calls.push({ input, init })
    return new Response(JSON.stringify(snapshot), { status: 200 })
  }, () => {})

  await controller.loginWithPassword({ loginIdentifier: 'user@example.invalid', password: 'private-password' })

  assert.equal(controller.getSnapshot().phase, 'ready')
  assert.equal(calls[0].input, '/_futurestaff/platform-dev/auth/password')
  assert.equal(calls[0].init.headers['x-futurestaff-login'], '1')
  assert.equal(JSON.parse(calls[0].init.body).password, 'private-password')
  assert.doesNotMatch(JSON.stringify(controller.getSnapshot()), /private-password/)
})

test('DEV snapshot helper returns only the strict credential-free Host contract', async () => {
  const result = await getPlatformDevAccessSnapshot(async (input, init) => {
    assert.equal(input, '/_futurestaff/platform-dev/session')
    assert.equal(init.method, 'GET')
    assert.equal(init.headers['x-futurestaff-session'], '1')
    assert.equal(init.cache, 'no-store')
    return new Response(JSON.stringify(snapshot), { status: 200 })
  })
  assert.equal(result.activeTenantId, tenantId)
  assert.doesNotMatch(JSON.stringify(result), /accessToken|refreshToken/)
})

test('DEV client rejects malformed or credential-bearing Host snapshots without reflecting them', async () => {
  const controller = new PlatformDevClientController(async () => new Response(JSON.stringify({
    ...snapshot, accessToken: 'private-token-must-not-escape',
  }), { status: 200 }), () => {})

  await controller.restore()
  assert.equal(controller.getSnapshot().phase, 'error')
  assert.equal(controller.getSnapshot().error.message, '无法连接 FutureStaff 桌面会话服务。')
  assert.doesNotMatch(JSON.stringify(controller.getSnapshot()), /private-token|accessToken/)
})

test('DEV client ignores an older session response after a newer restore completes', async () => {
  let releaseFirst
  let calls = 0
  const controller = new PlatformDevClientController(async () => {
    calls += 1
    if (calls === 1) {
      await new Promise(resolve => { releaseFirst = resolve })
      return new Response(JSON.stringify(snapshot), { status: 200 })
    }
    return new Response(JSON.stringify({
      phase: 'signed_out', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [], models: [], activeModelId: null,
    }), { status: 200 })
  }, () => {})

  const older = controller.restore()
  await new Promise(resolve => setImmediate(resolve))
  await controller.restore()
  releaseFirst()
  await older
  assert.equal(controller.getSnapshot().phase, 'signed_out')
})

test('Product Hub token helper accepts only the exact active-tenant 60-second credential', async () => {
  const token = await getProductHubApplicationToken(tenantId, async (input, init) => {
    assert.equal(input, '/_futurestaff/platform-dev/apps/product_hub/token')
    assert.equal(init.method, 'POST')
    assert.equal(init.headers['x-futurestaff-application'], 'product_hub')
    return new Response(JSON.stringify({
      accessToken: 'short-lived-product-hub-token-with-entropy', tokenType: 'Bearer', expiresIn: 60,
      audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'],
    }), { status: 200 })
  })
  assert.equal(token, 'short-lived-product-hub-token-with-entropy')

  await assert.rejects(() => getProductHubApplicationToken(tenantId, async () => new Response(JSON.stringify({
    accessToken: 'private-wrong-tenant-token-with-entropy', tokenType: 'Bearer', expiresIn: 60,
    audience: 'futurestaff-product-hub-dev', tenantId: '10000000-0000-4000-8000-000000000099',
    permissions: ['product_hub.read'],
  }), { status: 200 })), error => {
    assert.equal(error.message, 'Product Hub authorization is unavailable.')
    assert.doesNotMatch(error.message, /private-wrong/)
    return true
  })
  await assert.rejects(() => getProductHubApplicationToken(tenantId, async () => new Response(JSON.stringify({
    accessToken: 'credential with unsafe whitespace', tokenType: 'Bearer', expiresIn: 60,
    audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'],
  }), { status: 200 })), /unavailable/)
})
