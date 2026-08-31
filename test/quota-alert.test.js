import assert from 'node:assert/strict'
import test from 'node:test'

import { decideQuotaAlert, sendQuotaAlert, updateAlertState } from '../scripts/quota-alert.mjs'

function fixture({ state = 'HARVEST', remainingPercent = 80, minutesToReset = 240 } = {}) {
  return {
    quota: {
      buckets: [{
        limitId: 'codex_bengalfox',
        model: 'GPT-5.3-Codex-Spark',
        state,
        remainingPercent,
        nextResetAt: '2026-09-01T02:00:00.000Z',
        minutesToNextReset: minutesToReset,
      }],
    },
    recommendation: {
      preferredModel: 'GPT-5.3-Codex-Spark',
      tasks: [
        { rank: 1, title: 'Add missing focused tests.', model: 'spark', reason: 'focused test task' },
        { rank: 2, title: 'Audit UI consistency.', model: 'spark', reason: 'UI task' },
      ],
    },
  }
}

test('alerts for CLEAR with meaningful remaining quota', () => {
  const decision = decideQuotaAlert(fixture({ state: 'CLEAR', remainingPercent: 30, minutesToReset: 90 }), { now: 1_000, state: {} })
  assert.equal(decision.notify, true)
  assert.equal(decision.payload.model, 'GPT-5.3-Codex-Spark')
  assert.equal(decision.payload.state, 'CLEAR')
  assert.equal(decision.payload.tasks.length, 2)
})

test('alerts for HARVEST only when at least half remains', () => {
  assert.equal(decideQuotaAlert(fixture({ state: 'HARVEST', remainingPercent: 50 }), { now: 1_000, state: {} }).notify, true)
  assert.equal(decideQuotaAlert(fixture({ state: 'HARVEST', remainingPercent: 49 }), { now: 1_000, state: {} }).notify, false)
})

test('does not alert for NORMAL, EXHAUSTED, or low remaining CLEAR quota', () => {
  assert.equal(decideQuotaAlert(fixture({ state: 'NORMAL', remainingPercent: 90 }), { now: 1_000, state: {} }).notify, false)
  assert.equal(decideQuotaAlert(fixture({ state: 'EXHAUSTED', remainingPercent: 5 }), { now: 1_000, state: {} }).notify, false)
  assert.equal(decideQuotaAlert(fixture({ state: 'CLEAR', remainingPercent: 19 }), { now: 1_000, state: {} }).notify, false)
})

test('deduplicates the same model/reset/state during cooldown', () => {
  const first = decideQuotaAlert(fixture(), { now: 3_600_000, state: {} })
  const state = updateAlertState({}, first, 3_600_000)
  const second = decideQuotaAlert(fixture(), { now: 3_600_000 + 30 * 60_000, state })
  assert.equal(second.notify, false)
  assert.equal(second.reason, 'COOLDOWN')
})

test('state transition HARVEST to CLEAR creates a distinct alert key', () => {
  const harvest = decideQuotaAlert(fixture({ state: 'HARVEST', remainingPercent: 80 }), { now: 1_000, state: {} })
  const state = updateAlertState({}, harvest, 1_000)
  const clear = decideQuotaAlert(fixture({ state: 'CLEAR', remainingPercent: 70, minutesToReset: 60 }), { now: 2_000, state })
  assert.equal(clear.notify, true)
  assert.notEqual(clear.key, harvest.key)
})

test('webhook delivery requires HTTPS and never needs credentials in the payload', async () => {
  await assert.rejects(
    sendQuotaAlert({ type: 'futurestaff.ai_quota_alert' }, { webhookUrl: 'http://example.com/hook', fetch: async () => new Response(null, { status: 200 }) }),
    /must use HTTPS/,
  )
  let captured
  const result = await sendQuotaAlert({ type: 'futurestaff.ai_quota_alert', message: 'safe' }, {
    webhookUrl: 'https://example.com/secret-path',
    fetch: async (url, init) => { captured = { url: String(url), init }; return new Response(null, { status: 204 }) },
  })
  assert.deepEqual(result, { delivered: true, transport: 'https-webhook' })
  assert.equal(captured.url, 'https://example.com/secret-path')
  assert.deepEqual(JSON.parse(captured.init.body), { type: 'futurestaff.ai_quota_alert', message: 'safe' })
})
