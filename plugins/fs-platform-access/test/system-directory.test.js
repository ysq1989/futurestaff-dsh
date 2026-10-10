import test from 'node:test'
import assert from 'node:assert/strict'
import { systemDirectory, applicationHome } from '../lib/client/system-directory.js'

const app = { appId: 'erp', tenantId: 'a', displayName: 'ERP', baseUrl: 'https://erp-dev.fsstory.net', deepLinks: { home: '/erp' }, capabilities: ['erp.read'] }
const snapshot = { phase: 'ready', activeTenantId: 'a', applications: [app] }
test('directory includes brand systems, registered modules and additional authorized apps without legacy selection center', () => {
  const items = systemDirectory({ ...snapshot, applications: [app, { ...app, appId: 'product_hub' }, { ...app, appId: 'custom', displayName: '扩展系统' }] }, [{ id: 'douyin', title: '抖音获客' }, { id: 'geo', title: 'GEO 品牌运营' }])
  assert.equal(items.filter(item => item.id === 'geo').length, 1)
  assert.equal(items.find(item => item.id === 'douyin').pageId, 'douyin')
  assert.equal(items.find(item => item.id === 'erp').url, 'https://erp-dev.fsstory.net/erp')
  assert.equal(items.find(item => item.id === 'shop').url, null)
  assert.ok(items.some(item => item.title === 'FutureStaff Hub'))
  assert.ok(items.some(item => item.title === '扩展系统'))
  assert.ok(items.every(item => item.id !== 'product_hub'))
})
test('only active authenticated subject applications can supply safe first-party navigation', () => {
  assert.equal(applicationHome(snapshot, app), 'https://erp-dev.fsstory.net/erp')
  for (const patch of [{ tenantId: 'b' }, { capabilities: [] }, { baseUrl: 'https://fsstory.net.attacker.invalid' }, { baseUrl: 'javascript:alert(1)' }, { baseUrl: 'https://user:pass@erp.fsstory.net' }, { deepLinks: { home: '//attacker.invalid' } }, { deepLinks: { home: '/\\attacker.invalid' } }]) {
    assert.equal(applicationHome(snapshot, { ...app, ...patch }), null)
  }
  for (const phase of ['loading', 'signed_out', 'error', 'selecting_tenant']) {
    assert.equal(applicationHome({ ...snapshot, phase }, app), null)
  }
})
