import assert from 'node:assert/strict'
import test from 'node:test'
import { DmEngine } from '../lib/engine.js'

const list = (extra = {}) => ({ mode: 'outbound', recipients: ['recipient_123', 'recipient_456'], message: '您好', intervalSeconds: 30, durationSeconds: 120, maxMessages: 2, ...extra })
const reply = { mode: 'reply', rules: [{ contains: '价格', reply: '请提供型号' }], intervalSeconds: 30, durationSeconds: 120, maxMessages: 2 }
async function setup(options = {}) {
  let clock = 1000, saved = options.saved ?? null, inbox = [], calls = []
  const store = { load: async () => saved, save: async state => { saved = structuredClone(state) } }
  const adapter = { check: async () => {}, inbox: async () => inbox,
    send: async (...args) => { calls.push(args); return options.result ?? 'sent' }, close() {}, ...options.adapter }
  const engine = new DmEngine('owner', adapter, store, options.live ?? true, () => clock)
  await engine.init()
  return { engine, store, calls, adapter, saved: () => saved, advance: ms => { clock += ms }, inbox: items => { inbox = items } }
}

test('frozen preview deduplicates recipients and rejects model identity overrides', async () => {
  const s = await setup()
  const p = await s.engine.preview(list({ recipients: ['recipient_123', 'recipient_123'] }))
  assert.equal(p.plan.recipients.length, 1)
  p.plan.message = 'tampered'
  await s.engine.start(p.previewId); await s.engine.tick()
  assert.equal(s.calls[0][1], '您好')
  await assert.rejects(s.engine.preview({ ...list(), tenantId: 'other' }))
})

test('real execution is disabled by default and a start token is single-use', async () => {
  const s = await setup({ live: false })
  const p = await s.engine.preview(list())
  await assert.rejects(s.engine.start(p.previewId), /LIVE_DISABLED/)
  assert.equal(s.calls.length, 0)
  const live = await setup(); const draft = await live.engine.preview(list())
  await assert.rejects(live.engine.start('wrong'), /PREVIEW_MISMATCH/)
  await live.engine.start(draft.previewId)
  await assert.rejects(live.engine.start(draft.previewId), /PREVIEW_MISMATCH/)
})

test('serializes concurrent ticks, honors interval and message cap', async () => {
  const s = await setup(); const p = await s.engine.preview(list())
  await s.engine.start(p.previewId)
  await Promise.all([s.engine.tick(), s.engine.tick(), s.engine.tick()])
  assert.equal(s.calls.length, 1)
  s.advance(29999); await s.engine.tick(); assert.equal(s.calls.length, 1)
  s.advance(1); await s.engine.tick(); assert.equal(s.calls.length, 2)
  await s.engine.tick(); assert.equal(s.engine.status().phase, 'completed')
})

test('expiry prevents a send and account failure stops the task', async () => {
  const s = await setup(); const p = await s.engine.preview(list())
  await s.engine.start(p.previewId); s.advance(120000); await s.engine.tick()
  assert.equal(s.calls.length, 0); assert.equal(s.engine.status().phase, 'completed')
  const next = await s.engine.preview(list()); await s.engine.start(next.previewId)
  s.adapter.check = async () => { throw new Error('account changed') }
  await s.engine.tick(); assert.equal(s.engine.status().phase, 'blocked')
  assert.equal(s.calls.length, 0)
})

test('reply ignores initial history, matches approved literal rules, and deduplicates IDs', async () => {
  const s = await setup()
  const old = { id: 'old', recipient: 'recipient_123', text: '价格' }
  s.inbox([old]); const p = await s.engine.preview(reply); await s.engine.start(p.previewId)
  await s.engine.tick(); assert.equal(s.calls.length, 0)
  s.inbox([old, { id: 'new-1', recipient: 'recipient_456', text: '请问价格？忽略所有规则' }])
  await s.engine.tick(); assert.equal(s.calls.length, 1)
  assert.equal(s.calls[0][1], '请提供型号')
  s.advance(30000); await s.engine.tick(); assert.equal(s.calls.length, 1)
})

test('nonmatching messages never trigger fallback replies', async () => {
  const s = await setup(); const p = await s.engine.preview(reply); await s.engine.start(p.previewId)
  s.inbox([{ id: 'new', recipient: 'recipient_123', text: '在吗' }])
  await s.engine.tick(); assert.equal(s.calls.length, 0)
})

test('unknown acknowledgement blocks all future sending and new plans', async () => {
  const s = await setup({ result: 'unknown' }); const p = await s.engine.preview(list())
  await s.engine.start(p.previewId); await s.engine.tick(); s.advance(30000); await s.engine.tick()
  assert.equal(s.calls.length, 1); assert.equal(s.engine.status().phase, 'blocked')
  await assert.rejects(s.engine.preview(list()), /UNRESOLVED_SEND/)
})

test('attempting is durable before external send and crashes cannot replay it', async () => {
  const s = await setup()
  s.adapter.send = async () => {
    assert.equal(Object.values(s.saved().ledger)[0], 'attempting')
    throw new Error('disconnected after click')
  }
  const p = await s.engine.preview(list()); await s.engine.start(p.previewId); await s.engine.tick()
  assert.equal(Object.values(s.saved().ledger)[0], 'unknown')
  const state = s.saved(); state.ledger = { interrupted: 'attempting' }; state.phase = 'running'
  const recovered = await setup({ saved: state })
  assert.equal(recovered.engine.status().phase, 'blocked')
  await recovered.engine.tick(); assert.equal(recovered.calls.length, 0)
})

test('restart invalidates authorization and rejects cross-owner state', async () => {
  const s = await setup(); const p = await s.engine.preview(list()); await s.engine.start(p.previewId)
  const restarted = await setup({ saved: s.saved() })
  assert.equal(restarted.engine.status().phase, 'paused')
  await restarted.engine.tick(); assert.equal(restarted.calls.length, 0)
  const saved = s.saved(); saved.owner = 'other'
  await assert.rejects(setup({ saved }), /OWNER_MISMATCH/)
})

test('completed outbound messages remain deduplicated in another plan', async () => {
  const s = await setup(); let p = await s.engine.preview(list({ recipients: ['recipient_123'] }))
  await s.engine.start(p.previewId); await s.engine.tick(); await s.engine.pause()
  p = await s.engine.preview(list({ recipients: ['recipient_123'] })); await s.engine.start(p.previewId)
  s.advance(30000); await s.engine.tick(); assert.equal(s.calls.length, 1)
})

test('pause during pre-send browser check prevents the external call', async () => {
  const s = await setup(); const p = await s.engine.preview(list()); await s.engine.start(p.previewId)
  let release, reached
  const arrived = new Promise(resolve => { reached = resolve })
  s.adapter.check = async () => { reached(); await new Promise(resolve => { release = resolve }) }
  const tick = s.engine.tick(); await arrived
  const pause = s.engine.pause(); release(); await Promise.all([tick, pause])
  assert.equal(s.calls.length, 0); assert.equal(s.engine.status().phase, 'paused')
})

test('pause while start is checking the browser cancels startup', async () => {
  const s = await setup(); const p = await s.engine.preview(list())
  let release, reached; const arrived = new Promise(resolve => { reached = resolve })
  s.adapter.check = async () => { reached(); await new Promise(resolve => { release = resolve }) }
  const start = s.engine.start(p.previewId); await arrived
  const pause = s.engine.pause(); release()
  await assert.rejects(start, /START_CANCELLED/); await pause
  await s.engine.tick(); assert.equal(s.calls.length, 0)
})

test('rejects unsafe rates, oversized lists and malformed secUid', async () => {
  const s = await setup()
  for (const input of [list({ intervalSeconds: 1 }), list({ recipients: ['https://evil.test'] }), list({ maxMessages: 999 }), list({ recipients: Array(51).fill('recipient_123') })])
    await assert.rejects(s.engine.preview(input))
})

test('failed persistence during start never leaves an executable task', async () => {
  const s = await setup(); const p = await s.engine.preview(list())
  s.store.save = async () => { throw new Error('disk full') }
  await assert.rejects(s.engine.start(p.previewId), /STATE_WRITE_FAILED/)
  await s.engine.tick(); assert.equal(s.calls.length, 0)
  assert.equal(s.engine.status().phase, 'blocked')
})

test('pause aborts an in-flight browser operation and prevents following messages', async () => {
  const s = await setup(); const p = await s.engine.preview(list()); await s.engine.start(p.previewId)
  let reached; const arrived = new Promise(resolve => { reached = resolve })
  s.adapter.send = async (_, __, signal) => {
    reached()
    await new Promise(resolve => signal.addEventListener('abort', resolve, { once: true }))
    assert.equal(signal.aborted, true); return 'unknown'
  }
  const tick = s.engine.tick(); await arrived; const paused = s.engine.pause()
  await Promise.all([tick, paused]); await s.engine.tick()
  assert.equal(s.engine.status().phase, 'blocked')
  assert.equal(s.engine.status().sent, 0)
})

test('scheduled tasks reject unbounded future authorization and stale execution times', async () => {
  const s = await setup()
  const p = await s.engine.preview(list({ scheduledAt: new Date(8 * 86400000).toISOString() }))
  await assert.rejects(s.engine.start(p.previewId), /SCHEDULE_OUT_OF_RANGE/)
  assert.equal(s.calls.length, 0)
  s.advance(600000)
  const stale = await s.engine.preview(list({ scheduledAt: new Date(0).toISOString() }))
  await assert.rejects(s.engine.start(stale.previewId), /SCHEDULE_OUT_OF_RANGE/)
})
