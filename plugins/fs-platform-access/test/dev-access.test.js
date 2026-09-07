import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InMemoryTenantResources,
  PlatformApiError,
  PlatformDevAccessController,
} from '../lib/index.js'

const tenantId = '10000000-0000-4000-8000-000000000001'
const otherTenantId = '10000000-0000-4000-8000-000000000002'
const user = { userId: '20000000-0000-4000-8000-000000000001', displayName: 'DEV 用户', email: 'dev@example.invalid' }
const session = (activeTenantId = tenantId, suffix = 'initial') => ({
  accessToken: `private-access-token-${suffix}-with-entropy`,
  refreshToken: `private-refresh-token-${suffix}-with-entropy`,
  tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev', activeTenantId,
})
const tenants = [
  { tenantId, displayName: 'DEV 甲公司', slug: 'dev-a', logoUrl: null, role: 'member' },
  { tenantId: otherTenantId, displayName: 'DEV 乙公司', slug: 'dev-b', logoUrl: null, role: 'org_admin' },
]
const application = activeTenantId => ({
  appId: 'agent', tenantId: activeTenantId, displayName: 'FutureStaff Agent',
  baseUrl: 'https://dev.fsstory.net', deepLinks: { home: '/' }, capabilities: ['agent.read'],
  contractRange: '>=0.1.1 <0.2.0',
})

class FakeVault {
  value = { session: session(), user }
  saves = []
  cleared = false
  async load() { return this.value }
  async save(value) { this.value = value; this.saves.push(value) }
  async clear() { this.cleared = true; this.value = undefined }
}

class FakeDevApi {
  order = []
  activeTenantId = tenantId
  tokenRequests = []
  async refresh() { return { session: session(this.activeTenantId, 'refreshed'), meta: { contractVersion: '0.1.1', simulated: false } } }
  async logout(token) { this.order.push(`remote:${token}`) }
  async listTenants() { return { activeTenantId: this.activeTenantId, items: tenants, meta: { contractVersion: '0.1.1', simulated: false } } }
  async listApplications(_token, activeTenantId) {
    return { activeTenantId, items: [application(activeTenantId)], meta: { contractVersion: '0.1.1', simulated: false } }
  }
  async switchTenant(_token, activeTenantId) {
    this.activeTenantId = activeTenantId
    return { tenant: tenants.find(item => item.tenantId === activeTenantId), session: session(activeTenantId, 'switched'), meta: { contractVersion: '0.1.1', simulated: false } }
  }
  async issueApplicationToken(accessToken, appId, activeTenantId) {
    this.tokenRequests.push({ accessToken, appId, activeTenantId })
    return {
      accessToken: 'short-lived-product-hub-token-with-entropy', tokenType: 'Bearer', expiresIn: 60,
      audience: 'futurestaff-product-hub-dev', tenantId: activeTenantId,
      permissions: ['product_hub.read'], meta: { contractVersion: '0.1.1', simulated: false },
    }
  }
}

test('DEV access restores a credential-free tenant snapshot from the protected Vault', async () => {
  const controller = new PlatformDevAccessController(new FakeDevApi(), new FakeVault(), new InMemoryTenantResources())
  const snapshot = await controller.restore()

  assert.equal(snapshot.phase, 'ready')
  assert.equal(snapshot.simulated, false)
  assert.equal(snapshot.contractVersion, '0.1.1')
  assert.equal(snapshot.user.displayName, 'DEV 用户')
  assert.equal(snapshot.tenants.length, 2)
  assert.equal(snapshot.applications[0].tenantId, tenantId)
  assert.doesNotMatch(JSON.stringify(snapshot), /private-access|private-refresh/)
})

test('DEV access persists refresh and authorized tenant switch, then clears locally before logout', async () => {
  const vault = new FakeVault()
  const api = new FakeDevApi()
  const resources = new InMemoryTenantResources()
  const controller = new PlatformDevAccessController(api, vault, resources)
  await controller.restore()

  await controller.refresh()
  assert.match(vault.saves.at(-1).session.accessToken, /refreshed/)
  await controller.switchTenant(otherTenantId)
  assert.equal(controller.getSnapshot().phase, 'ready')
  assert.equal(controller.getSnapshot().activeTenantId, otherTenantId)
  assert.match(vault.saves.at(-1).session.accessToken, /switched/)
  await assert.rejects(() => controller.switchTenant('30000000-0000-4000-8000-000000000003'), /not authorized/)

  const originalClear = vault.clear.bind(vault)
  vault.clear = async () => { api.order.push('local'); await originalClear() }
  await controller.logout()
  assert.deepEqual(api.order, ['local', `remote:${session(otherTenantId, 'switched').refreshToken}`])
  assert.equal(controller.getSnapshot().phase, 'signed_out')
})

test('DEV access expires and clears protected state after an authentication rejection', async () => {
  const vault = new FakeVault()
  const api = new FakeDevApi()
  api.listTenants = async () => { throw new PlatformApiError('TOKEN_EXPIRED', 'must not reflect', false, 401) }
  const controller = new PlatformDevAccessController(api, vault, new InMemoryTenantResources())

  const snapshot = await controller.restore()
  assert.equal(snapshot.phase, 'expired')
  assert.equal(snapshot.error.code, 'TOKEN_EXPIRED')
  assert.equal(vault.cleared, true)
  assert.doesNotMatch(JSON.stringify(snapshot), /must not reflect|private-/)
})

test('DEV access serializes protected refresh and tenant mutations', async () => {
  const vault = new FakeVault()
  const api = new FakeDevApi()
  const controller = new PlatformDevAccessController(api, vault, new InMemoryTenantResources())
  await controller.restore()
  const order = []
  let releaseRefresh
  api.refresh = async () => {
    order.push('refresh:start')
    await new Promise(resolve => { releaseRefresh = resolve })
    order.push('refresh:end')
    return { session: session(tenantId, 'refreshed'), meta: { contractVersion: '0.1.1', simulated: false } }
  }
  api.switchTenant = async (_token, activeTenantId) => {
    order.push('switch')
    api.activeTenantId = activeTenantId
    return { tenant: tenants[1], session: session(activeTenantId, 'switched'), meta: { contractVersion: '0.1.1', simulated: false } }
  }

  const refreshing = controller.refresh()
  await new Promise(resolve => setImmediate(resolve))
  const switching = controller.switchTenant(otherTenantId)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(order, ['refresh:start'])
  releaseRefresh()
  await Promise.all([refreshing, switching])
  assert.deepEqual(order, ['refresh:start', 'refresh:end', 'switch'])
  assert.equal(controller.getSnapshot().phase, 'ready')
  assert.equal(controller.getSnapshot().activeTenantId, otherTenantId)
})

test('DEV access maps an application authorization denial to the safe empty state', async () => {
  const api = new FakeDevApi()
  api.listApplications = async () => {
    throw new PlatformApiError('APPLICATION_ACCESS_DENIED', 'must not reflect', false, 403)
  }
  const controller = new PlatformDevAccessController(api, new FakeVault(), new InMemoryTenantResources())

  const snapshot = await controller.restore()
  assert.equal(snapshot.phase, 'no_apps')
  assert.equal(snapshot.applications.length, 0)
  assert.equal(snapshot.tenants.length, 2)
  assert.doesNotMatch(JSON.stringify(snapshot), /must not reflect|private-/)
})

test('DEV access issues an application token only for the active authorized Product Hub', async () => {
  const api = new FakeDevApi()
  api.listApplications = async (_token, activeTenantId) => ({
    activeTenantId, items: [application(activeTenantId), {
      ...application(activeTenantId), appId: 'product_hub', displayName: '未来市集',
      capabilities: ['product_hub.read'],
    }], meta: { contractVersion: '0.1.1', simulated: false },
  })
  const controller = new PlatformDevAccessController(api, new FakeVault(), new InMemoryTenantResources())
  await controller.restore()

  const token = await controller.issueApplicationToken('product_hub')
  assert.equal(token.expiresIn, 60)
  assert.equal(token.tenantId, tenantId)
  assert.deepEqual(api.tokenRequests, [{
    accessToken: session().accessToken, appId: 'product_hub', activeTenantId: tenantId,
  }])
  await assert.rejects(() => controller.issueApplicationToken('erp'), /not authorized/)
  assert.equal(api.tokenRequests.length, 1)
  await controller.logout()
  await assert.rejects(() => controller.issueApplicationToken('product_hub'), /not authorized/)
  assert.equal(api.tokenRequests.length, 1)
})
