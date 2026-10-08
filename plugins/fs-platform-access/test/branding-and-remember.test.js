import test from 'node:test'
import assert from 'node:assert/strict'
import { brandConversation, PlatformDevClientController } from '../lib/client/index.js'

test('hero branding changes only brand copy and preserves composer translations and handlers', () => {
  const original = () => null, handler = () => {}, renderSlot = () => null
  const element = brandConversation(original)({ t: key => `original:${key}`, renderSlot, onSubmit: handler })
  assert.equal(element.type, original)
  assert.equal(element.props.t('hero.headline'), 'FutureStaff Agent')
  assert.equal(element.props.t('hero.preview'), '')
  assert.equal(element.props.t('placeholder.hero'), 'original:placeholder.hero')
  assert.equal(element.props.onSubmit, handler)
  assert.equal(element.props.renderSlot, renderSlot)
})

test('remember availability begins unknown, retries a failed metadata request, and sends normal Host headers', async () => {
  let requests = 0
  const controller = new PlatformDevClientController(async (url, init) => {
    assert.equal(url, '/_futurestaff/platform-dev/auth/remembered')
    assert.equal(init.headers.accept, 'application/json')
    assert.equal(init.headers['x-futurestaff-session'], '1')
    requests++
    return requests === 1 ? new Response('', { status: 503 }) : Response.json({ available: true, remembered: false })
  }, () => {})
  assert.equal(controller.getLoginHints().rememberPasswordAvailable, undefined)
  await controller.restoreRememberedLogin()
  assert.equal(controller.getLoginHints().rememberPasswordAvailable, undefined)
  assert.match(controller.getLoginHints().rememberPasswordStatus, /重试/)
  await controller.restoreRememberedLogin()
  assert.equal(controller.getLoginHints().rememberPasswordAvailable, true)
  assert.equal(controller.getLoginHints().rememberPasswordStatus, undefined)
})

test('remembered opt-in does not silently become plaintext login when protection is unavailable', async () => {
  const paths = []
  const controller = new PlatformDevClientController(async url => {
    paths.push(url)
    return Response.json({ available: false, remembered: false })
  }, () => {})
  await controller.loginWithPassword({ loginIdentifier: 'fixture@example.invalid', password: 'fixture-only', rememberPassword: true })
  assert.equal(controller.getSnapshot().phase, 'error')
  assert.match(controller.getSnapshot().error.message, /记住密码服务/)
  assert.deepEqual(paths, ['/_futurestaff/platform-dev/auth/remembered'])
  assert.equal(controller.getLoginHints().rememberPasswordAvailable, false)
})
