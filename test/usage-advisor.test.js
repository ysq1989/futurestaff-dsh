import assert from 'node:assert/strict'
import test from 'node:test'

import { buildUsageAdvice } from '../scripts/usage-advisor.mjs'

function fixture({ state = 'HARVEST', remainingPercent = 80, minutesToReset = 240 } = {}) {
  return {
    generatedAt: '2026-09-01T00:00:00.000Z',
    quota: {
      preferredModel: 'GPT-5.3-Codex-Spark',
      shouldHarvestNow: state === 'HARVEST' || state === 'CLEAR',
      buckets: [
        {
          limitId: 'codex', model: 'GPT-5.3-Codex', state: 'NORMAL', remainingPercent: 86,
          nextResetAt: '2026-09-07T02:29:18.000Z', minutesToNextReset: 8700, windows: [],
        },
        {
          limitId: 'codex_bengalfox', model: 'GPT-5.3-Codex-Spark', state, remainingPercent,
          nextResetAt: '2026-09-01T02:54:25.000Z', minutesToNextReset: minutesToReset, windows: [],
        },
      ],
    },
    recommendation: {
      preferredModel: 'GPT-5.3-Codex-Spark',
      shouldHarvestNow: state === 'HARVEST' || state === 'CLEAR',
      tasks: [
        { rank: 1, title: 'Add missing focused tests.', model: 'spark', section: 'filler', reason: 'focused test task' },
        { rank: 2, title: 'Audit UI consistency.', model: 'spark', section: 'medium', reason: 'UI task' },
        { rank: 3, title: 'Improve developer documentation.', model: 'any', section: 'filler', reason: 'docs task' },
      ],
    },
  }
}

test('builds concise on-demand advice from quota and backlog recommendations', () => {
  const advice = buildUsageAdvice(fixture())
  assert.equal(advice.preferredModel, 'GPT-5.3-Codex-Spark')
  assert.equal(advice.action, 'PREFER')
  assert.equal(advice.shouldHarvestNow, true)
  assert.equal(advice.models.length, 2)
  assert.equal(advice.tasks.length, 3)
  assert.match(advice.summary, /80% remaining/)
})

test('maps CLEAR, NORMAL, and EXHAUSTED states to stable advisor actions', () => {
  assert.equal(buildUsageAdvice(fixture({ state: 'CLEAR', minutesToReset: 60 })).action, 'USE_NOW')
  assert.equal(buildUsageAdvice(fixture({ state: 'NORMAL', minutesToReset: 500 })).action, 'NORMAL')
  assert.equal(buildUsageAdvice(fixture({ state: 'EXHAUSTED', remainingPercent: 5 })).action, 'AVOID')
})

test('caps task output at three items', () => {
  const input = fixture()
  input.recommendation.tasks.push({ rank: 4, title: 'Extra task', model: 'spark', section: 'filler', reason: 'extra' })
  assert.equal(buildUsageAdvice(input).tasks.length, 3)
})

test('rejects malformed input', () => {
  assert.throws(() => buildUsageAdvice({}), /requires task recommendation output/)
})
