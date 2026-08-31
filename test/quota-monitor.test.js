import assert from 'node:assert/strict'
import test from 'node:test'

import { decideQuotaAlert } from '../scripts/quota-monitor.mjs'

function result({ state = 'HARVEST', remainingPercent = 75, shouldHarvestNow = true, tasks } = {}) {
  const preferredModel = 'GPT-5.3-Codex-Spark'
  return {
    quota: {
      buckets: [{
        model: preferredModel,
        state,
        remainingPercent,
        nextResetAt: '2026-09-01T02:00:00.000Z',
        minutesToNextReset: state === 'CLEAR' ? 90 : 300,
      }],
    },
    recommendation: {
      preferredModel,
      quotaState: state,
      shouldHarvestNow,
      tasks: tasks ?? [{
        rank: 1,
        title: 'Add missing focused tests.',
        section: 'filler',
        model: 'spark',
        score: 85,
        reason: 'filler value task; targeted to Spark.',
      }],
    },
  }
}

test('alerts when a near-reset model has useful remaining allowance and compatible work', () => {
  const decision = decideQuotaAlert(result())
  assert.equal(decision.status, 'ALERT')
  assert.equal(decision.alert.preferredModel, 'GPT-5.3-Codex-Spark')
  assert.equal(decision.alert.remainingPercent, 75)
  assert.equal(decision.alert.tasks.length, 1)
  assert.equal(decision.alert.requiresUserApproval, true)
})

test('stays quiet outside HARVEST or CLEAR', () => {
  const decision = decideQuotaAlert(result({ state: 'NORMAL', shouldHarvestNow: false }))
  assert.equal(decision.status, 'QUIET')
  assert.match(decision.reason, /reset-warning state/)
})

test('stays quiet when too little useful allowance remains', () => {
  const decision = decideQuotaAlert(result({ remainingPercent: 20 }), { minRemainingPercent: 25 })
  assert.equal(decision.status, 'QUIET')
  assert.match(decision.reason, /25% useful-work threshold/)
})

test('stays quiet without compatible backlog work', () => {
  const decision = decideQuotaAlert(result({ tasks: [] }))
  assert.equal(decision.status, 'QUIET')
  assert.match(decision.reason, /No open backlog task/)
})

test('deduplicates the same quota state and task set inside the cooldown', () => {
  const now = Date.parse('2026-09-01T00:00:00.000Z')
  const first = decideQuotaAlert(result(), { now })
  const second = decideQuotaAlert(result(), {
    lastAlertKey: first.alertKey,
    lastAlertAt: new Date(now).toISOString(),
    now: now + 60_000,
  })
  assert.equal(first.status, 'ALERT')
  assert.equal(second.status, 'QUIET')
  assert.match(second.reason, /alert cooldown/)
})

test('alerts again when urgency changes from HARVEST to CLEAR', () => {
  const now = Date.parse('2026-09-01T00:00:00.000Z')
  const harvest = decideQuotaAlert(result(), { now })
  const clear = decideQuotaAlert(result({ state: 'CLEAR' }), {
    lastAlertKey: harvest.alertKey,
    lastAlertAt: new Date(now).toISOString(),
    now: now + 60_000,
  })
  assert.equal(clear.status, 'ALERT')
  assert.equal(clear.alert.quotaState, 'CLEAR')
})

test('alerts again after the cooldown when the useful state persists', () => {
  const now = Date.parse('2026-09-01T00:00:00.000Z')
  const first = decideQuotaAlert(result(), { now })
  const later = decideQuotaAlert(result(), {
    lastAlertKey: first.alertKey,
    lastAlertAt: new Date(now).toISOString(),
    now: now + 181 * 60_000,
  })
  assert.equal(later.status, 'ALERT')
})

test('validates the useful remaining-allowance threshold', () => {
  assert.throws(() => decideQuotaAlert(result(), { minRemainingPercent: 101 }), /between 0 and 100/)
  assert.throws(() => decideQuotaAlert(result(), { cooldownMinutes: 0 }), /between 1 and 10080/)
})
