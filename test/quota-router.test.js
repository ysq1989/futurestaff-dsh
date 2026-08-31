import assert from 'node:assert/strict'
import test from 'node:test'

import { QUOTA_STATE, routeCodexQuota } from '../scripts/quota-router.mjs'

function snapshot(overrides = {}) {
  return {
    source: 'codex-app-server',
    fetchedAt: '2026-08-31T13:21:00.000Z',
    usage: {
      rateLimits: {
        limitName: 'General Codex',
        primary: { usedPercent: 14, windowDurationMins: 10080, resetsAt: Date.parse('2026-09-07T02:29:18.000Z') / 1000 },
        secondary: null,
      },
      rateLimitsByLimitId: {
        codex_bengalfox: {
          limitName: 'GPT-5.3-Codex-Spark',
          primary: { usedPercent: 0, windowDurationMins: 300, resetsAt: Date.parse('2026-08-31T18:54:25.000Z') / 1000 },
          secondary: { usedPercent: 0, windowDurationMins: 10080, resetsAt: Date.parse('2026-09-07T13:54:25.000Z') / 1000 },
        },
      },
      ...overrides,
    },
  }
}

test('prefers Spark when its 5h bucket is approaching reset', () => {
  const result = routeCodexQuota(snapshot(), { now: Date.parse('2026-08-31T13:21:00.000Z') })
  const spark = result.buckets.find(bucket => bucket.model === 'GPT-5.3-Codex-Spark')
  const general = result.buckets.find(bucket => bucket.limitId === 'codex')

  assert.equal(spark.state, QUOTA_STATE.HARVEST)
  assert.equal(spark.windows.find(window => window.kind === 'primary').state, QUOTA_STATE.HARVEST)
  assert.equal(spark.windows.find(window => window.kind === 'secondary').state, QUOTA_STATE.NORMAL)
  assert.equal(general.state, QUOTA_STATE.NORMAL)
  assert.equal(result.preferredModel, 'GPT-5.3-Codex-Spark')
  assert.equal(result.shouldHarvestNow, true)
  assert.equal(result.recommendations[0].action, 'PREFER')
})

test('moves a bucket into CLEAR inside two hours', () => {
  const result = routeCodexQuota(snapshot(), { now: Date.parse('2026-08-31T17:10:00.000Z') })
  const spark = result.buckets.find(bucket => bucket.model === 'GPT-5.3-Codex-Spark')
  assert.equal(spark.state, QUOTA_STATE.CLEAR)
  assert.equal(result.recommendations[0].action, 'USE_NOW')
})

test('marks a model exhausted when any active constraint has five percent or less remaining', () => {
  const input = snapshot()
  input.usage.rateLimitsByLimitId.codex_bengalfox.secondary.usedPercent = 96
  const result = routeCodexQuota(input, { now: Date.parse('2026-08-31T13:21:00.000Z') })
  const spark = result.buckets.find(bucket => bucket.model === 'GPT-5.3-Codex-Spark')
  assert.equal(spark.state, QUOTA_STATE.EXHAUSTED)
  assert.equal(result.recommendations.find(item => item.model === 'GPT-5.3-Codex-Spark').action, 'AVOID')
  assert.equal(result.preferredModel, 'GPT-5.3-Codex')
})

test('accepts snake_case backend window fields and clamps percentages', () => {
  const result = routeCodexQuota({
    source: 'codex-app-server',
    usage: {
      rateLimits: {
        primary: { used_percent: 120, window_duration_mins: 300, reset_at: Date.parse('2026-08-31T16:00:00.000Z') / 1000 },
      },
    },
  }, { now: Date.parse('2026-08-31T13:00:00.000Z') })
  assert.equal(result.buckets[0].windows[0].usedPercent, 100)
  assert.equal(result.buckets[0].windows[0].remainingPercent, 0)
  assert.equal(result.buckets[0].state, QUOTA_STATE.EXHAUSTED)
})

test('rejects invalid or empty usage snapshots', () => {
  assert.throws(() => routeCodexQuota({}), /requires a sanitized Codex usage snapshot/)
  assert.throws(() => routeCodexQuota({ usage: {} }), /no usable rate-limit windows/)
})
