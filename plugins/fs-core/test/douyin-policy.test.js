import assert from 'node:assert/strict'
import test from 'node:test'
import { apply, douyinDmApprovalDecision } from '../lib/index.js'

test('Douyin start asks for approval, unknown tools deny and stop/status remain immediate', () => {
  assert.equal(douyinDmApprovalDecision('mcp__douyin-dm__douyin_dm_start').kind, 'ask')
  assert.equal(douyinDmApprovalDecision('mcp__douyin-dm__arbitrary_send').kind, 'deny')
  for (const name of ['douyin_dm_preview', 'douyin_dm_status', 'douyin_dm_pause'])
    assert.equal(douyinDmApprovalDecision(`mcp__douyin-dm__${name}`), undefined)
  assert.equal(douyinDmApprovalDecision('web_search'), undefined)
})

test('actual fs-core pre-execute seam intercepts Douyin start before permission presets', async () => {
  let listener
  apply({ provide() {}, on(event, fn) { listener = fn } }, {
    identityMode: 'single-subject', tenantId: 'tenant', userId: 'operator', deviceId: 'pc',
  })
  let next = 0
  const decision = await listener({ name: 'mcp__douyin-dm__douyin_dm_start' }, async () => { next++; return { kind: 'allow' } })
  assert.equal(decision.kind, 'ask'); assert.equal(next, 0)
})

test('dedicated profile denies shell/browser bypass and allows immediate pause', async () => {
  let listener
  apply({ provide() {}, on(event, fn) { listener = fn } }, {
    identityMode: 'single-subject', tenantId: 'tenant', userId: 'operator', deviceId: 'pc', toolScope: 'douyin-only',
  })
  for (const name of ['shell', 'browser_evaluate', 'mcp__other__send']) {
    assert.equal((await listener({ name }, async () => ({ kind: 'allow' }))).kind, 'deny')
  }
  assert.equal((await listener({ name: 'mcp__douyin-dm__douyin_dm_pause' }, async () => ({ kind: 'ask' }))).kind, 'allow')
})
