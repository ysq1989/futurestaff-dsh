import test from 'node:test'
import assert from 'node:assert/strict'
import { RememberedLogin } from '../lib/remembered-login.js'
import { PlatformDevClientController } from '../lib/client/index.js'
import { renderPlatformAccessView } from '../lib/view.js'
const input = { loginIdentifier: 'fixture@example.invalid', password: 'fixture-only-password' }
const verified = { phase: 'selecting_tenant', user: { userId: '20000000-0000-4000-8000-000000000001' } }
function fixture(available = true) {
  const values = new Map()
  const secrets = { available: async () => available, has: async key => values.has(key), read: async key => values.get(key),
    write: async (key, value) => { values.set(key, value) }, delete: async key => { values.delete(key) } }
  return { values, secrets, login: new RememberedLogin(secrets, 'production') }
}
test('remembering requires opt-in and verified authentication; metadata never contains passwords', async () => {
  const f = fixture()
  await f.login.login(input, undefined, async () => verified)
  assert.equal(f.values.size, 0)
  await f.login.login(input, true, async () => ({ phase: 'error' }))
  assert.equal(f.values.size, 0)
  await f.login.login(input, true, async () => verified)
  assert.equal(f.values.size, 1)
  const hint = await new RememberedLogin(f.secrets, 'production').hint()
  assert.deepEqual(hint, { available: true, remembered: true, loginIdentifier: input.loginIdentifier })
  assert.doesNotMatch(JSON.stringify(hint), /fixture-only-password|"password"/)
  let forwarded
  await f.login.login({ ...input, password: '' }, true, async body => { forwarded = body; return verified })
  assert.equal(forwarded.password, input.password)
  await assert.rejects(f.login.login({ loginIdentifier: 'other@example.invalid', password: '' }, true, async () => verified))
  assert.equal((await new RememberedLogin(f.secrets, 'dev').hint()).remembered, false)
})
test('uncheck deletes the credential and unavailable protection never falls back to plaintext', async () => {
  const f = fixture()
  await f.login.login(input, true, async () => verified)
  await f.login.login(input, false, async () => ({ phase: 'error' }))
  assert.equal(f.values.size, 0)
  await f.login.login(input, true, async () => verified)
  await f.login.forget()
  assert.equal((await f.login.hint()).remembered, false)
  const unavailable = fixture(false)
  await unavailable.login.login(input, true, async () => verified)
  assert.equal(unavailable.values.size, 0)
  assert.deepEqual(await unavailable.login.hint(), { available: false, remembered: false })
})
test('forget queued during authentication wins over the pending remember operation', async () => {
  const f = fixture()
  let release
  const login = f.login.login(input, true, () => new Promise(resolve => { release = resolve }))
  await new Promise(resolve => setImmediate(resolve))
  const forget = f.login.forget()
  release(verified)
  await Promise.all([login, forget])
  assert.equal(f.values.size, 0)
})
test('Renderer accepts only credential-free remembered metadata', async () => {
  const controller = new PlatformDevClientController(async () => Response.json({ available: true, remembered: true, loginIdentifier: input.loginIdentifier }), () => {})
  await controller.restoreRememberedLogin()
  assert.equal(controller.getLoginHints().rememberPassword, true)
  assert.doesNotMatch(JSON.stringify(controller.getLoginHints()), /fixture-only-password/)
  const injected = new PlatformDevClientController(async () => Response.json({ available: true, remembered: true, loginIdentifier: input.loginIdentifier, password: input.password }), () => {})
  await injected.restoreRememberedLogin()
  assert.equal(injected.getLoginHints().rememberPassword, false)
})
test('login and subject headings are concise and subject actions share one row', () => {
  const state = { phase: 'signed_out', simulated: false, contractVersion: '0.1.1', tenants: [], applications: [], models: [] }
  const html = renderPlatformAccessView(state)
  assert.match(html, /FutureStaff Agent/)
  assert.match(html, /记住密码/)
  assert.doesNotMatch(html, /访问中心|先验证|登录 FutureStaff/)
  const subject = renderPlatformAccessView({ ...state, phase: 'selecting_tenant' })
  assert.match(subject, /选择登录主体/)
  assert.match(subject, /fs-login-buttons[^]*返回账号登录[^]*type="submit"/)
  assert.doesNotMatch(subject, /账号已验证|选择租户登录|访问中心/)
})
