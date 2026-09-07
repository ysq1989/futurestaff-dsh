import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformDevClientController } from '../lib/client/index.js'

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
}

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
      phase: 'signed_out', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [],
    }), { status: 200 })
  }, () => {})

  const older = controller.restore()
  await new Promise(resolve => setImmediate(resolve))
  await controller.restore()
  releaseFirst()
  await older
  assert.equal(controller.getSnapshot().phase, 'signed_out')
})
