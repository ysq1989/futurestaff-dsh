import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createAccountSidebar, sidebarIdentity, sidebarVersion } from '../lib/client/sidebar.js'
import { apply } from '../lib/client/index.js'

const snapshot = { phase: 'ready', user: { userId: 'fixture-user', displayName: '测试用户' },
  activeTenantId: 'active-subject', tenants: [
    { tenantId: 'other-subject', displayName: '另一个主体', logoUrl: 'https://example.invalid/other.png' },
    { tenantId: 'active-subject', displayName: '当前主体', logoUrl: 'https://example.invalid/active.png' },
  ], applications: [], models: [], simulated: true, contractVersion: '0.1.1' }

test('sidebar identity comes only from the active authenticated subject and clears after logout', () => {
  assert.deepEqual(sidebarIdentity(snapshot), { tenantName: '当前主体', logoUrl: 'https://example.invalid/active.png', userName: '测试用户' })
  for (const value of [{ ...snapshot, phase: 'signed_out' }, { ...snapshot, activeTenantId: 'unknown' }]) {
    assert.deepEqual(sidebarIdentity(value), { tenantName: 'FutureStaff Agent', logoUrl: undefined, userName: '未登录' })
  }
})

test('sidebar reads installed-shell version metadata and rejects arbitrary display text', () => {
  assert.equal(sidebarVersion('?dsh-desktop-version=2.0.18'), '2.0.18')
  assert.equal(sidebarVersion('?dsh-desktop-version=2.0.19-alpha.1'), '2.0.19-alpha.1')
  assert.equal(sidebarVersion('?dsh-desktop-version=%3Cscript%3E'), undefined)
  assert.equal(sidebarVersion(''), undefined)
})

test('account sidebar mounts both existing navigation seats and settings while keeping actions initially hidden', () => {
  const slots = []
  const controller = { subscribe: () => () => {}, getSnapshot: () => snapshot, logout: async () => {} }
  const Sidebar = createAccountSidebar(controller)
  const html = renderToStaticMarkup(createElement(Sidebar, {
    collapsed: false, width: 270, startSession: () => {}, toggleSidebar: () => {},
    renderSlot: (name, props) => { slots.push({ name, props }); return createElement('div', null, name) },
  }))
  assert.match(html, /当前主体/)
  assert.match(html, /测试用户，用户菜单/)
  assert.match(html, /aria-expanded="false"/)
  assert.match(html, /id="fs-menu-panel"[^>]+hidden/)
  assert.match(html, /aria-selected="true"/)
  assert.doesNotMatch(html, />退出登录</)
  assert.deepEqual(slots.map(slot => slot.name), ['sidebar.workspaces', 'sidebar.footer.action', 'sidebar.settings'])
  assert.equal(slots[2].props.wide, true)
})

test('product sidebar preserves the native child slot declarations and navigation injection', () => {
  const inject = () => ({ startSession: () => {} }), children = { 'sidebar.workspaces': { kind: 'single', scope: 'root' } }
  const OriginalSidebar = () => null
  const original = { options: {}, locale: 'sidebar', children, inject, component: OriginalSidebar }
  const registered = []
  apply({ slots: {
    inject: (_name, register) => register(),
    subscribe: () => () => {},
    entries: name => name === 'sidebar' ? [original] : [],
    register: (options, component) => { registered.push({ options, component }); return () => {} },
  } })
  assert.equal(original.children, children)
  assert.equal(original.inject, inject)
  assert.notEqual(original.component, OriginalSidebar)
})
