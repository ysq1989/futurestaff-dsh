import assert from 'node:assert/strict'
import test from 'node:test'

import {
  InMemoryTenantResources,
  PlatformAccessController,
  PlatformApiError,
  renderPlatformAccessView,
} from '../lib/index.js'

const tenantA = { tenantId: 'tenant-a', displayName: '模拟甲公司', slug: 'mock-a', logoUrl: null, role: 'member' }
const tenantB = { tenantId: 'tenant-b', displayName: '模拟乙公司', slug: 'mock-b', logoUrl: null, role: 'org_admin' }
const user = { userId: 'user-a', displayName: '模拟用户', email: 'demo@example.invalid' }
const session = activeTenantId => ({ accessToken: `access-${activeTenantId}`, refreshToken: `refresh-${activeTenantId}`, tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev', activeTenantId })
const app = tenantId => ({ appId: 'agent', tenantId, displayName: 'FutureStaff Agent', baseUrl: 'https://example.invalid', deepLinks: { home: '/' }, capabilities: ['agent.read'], contractRange: '>=0.1.0 <0.2.0' })

class FakeApi {
  failure
  noApps = false
  switchGate

  async login() { return { session: session('tenant-a'), user, meta: { contractVersion: '0.1.0', simulated: true } } }
  async refresh() {
    if (this.failure) throw this.failure
    return { session: session('tenant-a'), meta: { contractVersion: '0.1.0', simulated: true } }
  }
  async logout() {}
  async listTenants() { return { activeTenantId: 'tenant-a', items: [tenantA, tenantB], meta: { contractVersion: '0.1.0', simulated: true } } }
  async listApplications(_token, tenantId) {
    if (this.failure) throw this.failure
    if (this.noApps) throw new PlatformApiError('APPLICATION_ACCESS_DENIED', 'none', false, 403)
    return { activeTenantId: tenantId, items: [app(tenantId)], meta: { contractVersion: '0.1.0', simulated: true } }
  }
  async switchTenant(_token, tenantId) {
    if (this.switchGate) await this.switchGate
    return { tenant: tenantB, session: session(tenantId), meta: { contractVersion: '0.1.0', simulated: true } }
  }
}

test('login shows authorized tenants and applications without exposing credentials', async () => {
  const controller = new PlatformAccessController(new FakeApi(), new InMemoryTenantResources())
  await controller.loginWithMock()
  const state = controller.getSnapshot()

  assert.equal(state.phase, 'ready')
  assert.equal(state.tenants.length, 2)
  assert.equal(state.applications[0].displayName, 'FutureStaff Agent')
  assert.doesNotMatch(JSON.stringify(state), /access-|refresh-/)
  assert.match(renderPlatformAccessView(state), /已授权应用/)
})

test('tenant switch clears requests, cache, workspace and application credentials before accepting the new tenant', async () => {
  const api = new FakeApi()
  const resources = new InMemoryTenantResources()
  const oldRequest = new AbortController()
  resources.requests.add(oldRequest)
  resources.requestCache.set('tenant-a:query', {})
  resources.workspace.set('tenant-a:session', {})
  resources.applicationCredentials.set('product_hub', 'private-value')
  const controller = new PlatformAccessController(api, resources)
  await controller.loginWithMock()

  let release
  api.switchGate = new Promise(resolve => { release = resolve })
  const switching = controller.switchTenant('tenant-b')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(oldRequest.signal.aborted, true)
  assert.equal(resources.requestCache.size, 0)
  assert.equal(resources.workspace.size, 0)
  assert.equal(resources.applicationCredentials.size, 0)
  assert.equal(controller.getSnapshot().phase, 'loading')
  assert.equal(controller.getSnapshot().activeTenantId, undefined)

  release()
  await switching
  assert.equal(controller.getSnapshot().activeTenantId, 'tenant-b')
  assert.equal(controller.getSnapshot().applications[0].tenantId, 'tenant-b')
})

test('a stale pre-switch response cannot restore the previous tenant generation', async () => {
  const api = new FakeApi()
  const controller = new PlatformAccessController(api, new InMemoryTenantResources())
  await controller.loginWithMock()

  let releaseRefresh
  api.refresh = async () => {
    await new Promise(resolve => { releaseRefresh = resolve })
    return { session: session('tenant-a'), meta: { contractVersion: '0.1.0', simulated: true } }
  }
  const refreshing = controller.refresh()
  await new Promise(resolve => setImmediate(resolve))
  await controller.switchTenant('tenant-b')
  releaseRefresh()
  await refreshing

  assert.equal(controller.getSnapshot().phase, 'ready')
  assert.equal(controller.getSnapshot().activeTenantId, 'tenant-b')
})

test('no authorization, token expiry, loading, failure and signed-out states are explicit', async () => {
  const api = new FakeApi()
  const controller = new PlatformAccessController(api, new InMemoryTenantResources())
  assert.match(renderPlatformAccessView(controller.getSnapshot()), /data-state="signed_out"/)

  api.noApps = true
  await controller.loginWithMock()
  assert.equal(controller.getSnapshot().phase, 'no_apps')
  assert.match(renderPlatformAccessView(controller.getSnapshot()), /没有已授权应用/)

  api.noApps = false
  api.failure = new PlatformApiError('TOKEN_EXPIRED', 'expired', false, 401)
  await controller.refresh()
  assert.equal(controller.getSnapshot().phase, 'expired')
  assert.match(renderPlatformAccessView(controller.getSnapshot()), /登录已过期/)

  const failing = new FakeApi()
  failing.failure = new PlatformApiError('MOCK_UNAVAILABLE', 'offline', true)
  const failedController = new PlatformAccessController(failing, new InMemoryTenantResources())
  await failedController.loginWithMock()
  assert.equal(failedController.getSnapshot().phase, 'error')
  assert.match(renderPlatformAccessView(failedController.getSnapshot()), /加载失败/)
})

test('access views expose accessible structure and safe responsive content hooks', () => {
  const controller = new PlatformAccessController(new FakeApi(), new InMemoryTenantResources())
  const signedOut = renderPlatformAccessView(controller.getSnapshot())
  assert.match(signedOut, /aria-labelledby="futurestaff-access-title"/)
  assert.match(signedOut, /data-action="login" type="button"/)

  const loading = renderPlatformAccessView({ phase: 'loading', tenants: [], applications: [] })
  assert.match(loading, /role="status"/)
  assert.match(loading, /aria-live="polite"/)
  assert.match(loading, /data-skeleton="true"/)

  const ready = renderPlatformAccessView({
    phase: 'ready', user, tenants: [tenantA, tenantB], activeTenantId: 'tenant-a', applications: [app('tenant-a')],
  })
  assert.match(ready, /for="futurestaff-tenant-select"/)
  assert.match(ready, /id="futurestaff-tenant-select"/)
  assert.match(ready, /1 个应用/)
  assert.match(ready, /data-capability="true"/)
  assert.match(ready, /type="button"/)

  const noApps = renderPlatformAccessView({
    phase: 'no_apps', user, tenants: [tenantA], activeTenantId: 'tenant-a', applications: [],
  })
  assert.match(noApps, /0 个应用/)
  assert.match(noApps, /data-empty="applications"/)

  const expired = renderPlatformAccessView({
    phase: 'expired', tenants: [], applications: [], error: { code: 'TOKEN_EXPIRED', message: 'expired', retryable: false },
  })
  assert.match(expired, /role="alert"/)

  const error = renderPlatformAccessView({
    phase: 'error', tenants: [], applications: [], error: { code: 'MOCK_UNAVAILABLE', message: 'offline', retryable: true },
  })
  assert.match(error, /role="alert"/)

  const devSignedOut = renderPlatformAccessView({
    phase: 'signed_out', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [],
  })
  assert.match(devSignedOut, /data-dev="true"/)
  assert.match(devSignedOut, /登录 Platform DEV/)
  assert.doesNotMatch(devSignedOut, /模拟登录|data-mock="true"/)
})

test('rendered account and application content remains escaped', () => {
  const markup = renderPlatformAccessView({
    phase: 'ready',
    user: { ...user, displayName: '<img src=x onerror=alert(1)>' },
    tenants: [{ ...tenantA, displayName: '<script>tenant</script>' }],
    activeTenantId: 'tenant-a',
    applications: [{ ...app('tenant-a'), displayName: '<b>unsafe</b>', capabilities: ['<svg/onload=alert(1)>'] }],
  })
  assert.doesNotMatch(markup, /<script>|<img|<b>|<svg/)
  assert.match(markup, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.match(markup, /&lt;svg\/onload=alert\(1\)&gt;/)
})

test('logout is local-first and clears every tenant resource even if revocation fails', async () => {
  const api = new FakeApi()
  api.logout = async () => { throw new Error('offline') }
  const resources = new InMemoryTenantResources()
  const controller = new PlatformAccessController(api, resources)
  await controller.loginWithMock()
  resources.requestCache.set('old', 1)
  resources.workspace.set('old', 1)
  resources.applicationCredentials.set('old', 'secret')

  await controller.logout()
  assert.equal(controller.getSnapshot().phase, 'signed_out')
  assert.equal(resources.requestCache.size + resources.workspace.size + resources.applicationCredentials.size, 0)
})
