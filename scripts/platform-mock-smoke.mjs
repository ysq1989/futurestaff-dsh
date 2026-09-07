import { InMemoryTenantResources, PlatformAccessController, PlatformMockApi } from '../plugins/fs-platform-access/lib/index.js'

const resources = new InMemoryTenantResources()
const controller = new PlatformAccessController(new PlatformMockApi(), resources)

await controller.loginWithMock()
let state = controller.getSnapshot()
if (state.phase !== 'ready' || state.tenants.length !== 2 || state.applications.length !== 2) {
  throw new Error(`mock login/discovery failed: ${state.phase}`)
}

await controller.refresh()
state = controller.getSnapshot()
if (state.phase !== 'ready' || state.activeTenantId !== state.tenants[0].tenantId) {
  throw new Error(`mock refresh failed: ${state.phase}`)
}

await controller.switchTenant(state.tenants[1].tenantId)
state = controller.getSnapshot()
if (state.phase !== 'ready' || state.applications.length !== 1 || state.activeTenantId !== state.tenants[1].tenantId) {
  throw new Error(`mock tenant switch failed: ${state.phase}`)
}

await controller.logout()
if (controller.getSnapshot().phase !== 'signed_out') throw new Error('mock logout failed')

console.log('FutureStaff platform Mock v0.1.0 smoke passed: login, refresh, tenants, apps, switch, logout')
