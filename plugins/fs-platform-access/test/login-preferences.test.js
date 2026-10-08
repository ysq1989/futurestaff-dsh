import assert from 'node:assert/strict'
import test from 'node:test'
import { LoginPreferences } from '../lib/login-preferences.js'
import { PlatformDevClientController } from '../lib/client/index.js'
import { renderPlatformAccessView } from '../lib/view.js'
const user = '20000000-0000-4000-8000-000000000001'
const otherUser = '20000000-0000-4000-8000-000000000002'
const first = '10000000-0000-4000-8000-000000000001'
const second = '10000000-0000-4000-8000-000000000002'
function fixture() {
  const data = new Map()
  const preferences = new LoginPreferences(() => ({ getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value) }))
  return { preferences, data }
}
const state = { phase: 'selecting_tenant', simulated: false, contractVersion: '0.1.1',
  user: { userId: user, displayName: '示例用户', email: null },
  tenants: [first, second].map((tenantId, index) => ({ tenantId, displayName: `主体 ${index + 1}`,
    slug: `tenant-${index}`, logoUrl: null, role: 'member' })), applications: [], models: [], activeModelId: null }

test('form hints persist by account without storing password, tokens or permissions', async () => {
  const { preferences, data } = fixture()
  preferences.rememberTenant(user, second)
  let response = state
  const controller = new PlatformDevClientController(async () => Response.json(response), () => {}, preferences)
  await controller.loginWithPassword({ loginIdentifier: ' user@example.invalid ', password: 'private-test-password' })
  assert.deepEqual(controller.getLoginHints(), { loginIdentifier: 'user@example.invalid', tenantId: second })
  assert.match(renderPlatformAccessView(controller.getSnapshot(), controller.getLoginHints()),
    new RegExp(`value="${second}" selected`))
  const persisted = [...data.values()].join('')
  assert.doesNotMatch(persisted, /password|token|permissions|private-test/)
  response = { ...state, user: { ...state.user, userId: otherUser } }
  await controller.loginWithPassword({ loginIdentifier: 'another@example.invalid', password: 'private-test-password' })
  assert.equal(controller.getLoginHints().tenantId, undefined)
})
test('removed membership is never selected or automatically submitted', () => {
  const { preferences } = fixture()
  preferences.rememberTenant(user, second)
  const markup = renderPlatformAccessView({ ...state, tenants: state.tenants.slice(0, 1) }, preferences.hints(user))
  assert.doesNotMatch(markup, / selected/)
  assert.doesNotMatch(markup, new RegExp(second))
})

test('an offered subject choice survives the Host restart handoff without authorizing it', async () => {
  const { preferences } = fixture()
  let response = state
  const controller = new PlatformDevClientController(async () => Response.json(response), () => {}, preferences)
  await controller.loginWithPassword({ loginIdentifier: 'user@example.invalid', password: 'private-test-password' })
  response = { phase: 'loading', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [], models: [], activeModelId: null }
  await controller.selectLoginTenant(second)
  assert.equal(preferences.hints(user).tenantId, second)
  assert.equal(controller.getSnapshot().phase, 'loading')
  assert.equal(controller.getSnapshot().activeTenantId, undefined)
})
test('failed login does not replace the last successful account', async () => {
  const { preferences } = fixture()
  preferences.rememberIdentifier('saved@example.invalid')
  const controller = new PlatformDevClientController(async () => Response.json({
    phase: 'error', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [], models: [], activeModelId: null,
    error: { code: 'AUTHENTICATION_REQUIRED', message: '登录失败', retryable: true },
  }), () => {}, preferences)
  await controller.loginWithPassword({ loginIdentifier: 'failed@example.invalid', password: 'private-test-password' })
  assert.equal(controller.getLoginHints().loginIdentifier, 'saved@example.invalid')
})

test('an existing authenticated session seeds first-use hints from its validated identity', async () => {
  const { preferences } = fixture()
  const controller = new PlatformDevClientController(async () => Response.json({ ...state,
    phase: 'no_apps', activeTenantId: second, user: { ...state.user, email: 'known@example.invalid' },
  }), () => {}, preferences)
  await controller.restore()
  assert.deepEqual(controller.getLoginHints(), { loginIdentifier: 'known@example.invalid', tenantId: second })
})
test('a newly created preference reader restores hints and storage failures do not block login', () => {
  const { preferences, data } = fixture()
  preferences.rememberIdentifier('saved@example.invalid'); preferences.rememberTenant(user, second)
  const reloaded = new LoginPreferences(() => ({ getItem: key => data.get(key) ?? null, setItem() {} }))
  assert.deepEqual(reloaded.hints(user), preferences.hints(user))
  const blocked = new LoginPreferences(() => { throw Error('disabled') })
  assert.deepEqual(blocked.hints(user), {})
  assert.doesNotThrow(() => blocked.rememberTenant(user, first))
})

test('corrupt or oversized preferences are ignored and invalid subject identifiers are never written', () => {
  for (const text of ['{broken', 'x'.repeat(16_385), 'null']) {
    const writes = []
    const preferences = new LoginPreferences(() => ({ getItem: () => text, setItem: (...args) => writes.push(args) }))
    assert.deepEqual(preferences.hints(user), {})
    preferences.rememberTenant('../another-account', first)
    assert.equal(writes.length, 0)
  }
})
