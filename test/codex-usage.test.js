import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeUsageResponse, sanitizeUsage } from '../scripts/codex-usage.mjs'

test('sanitizeUsage removes sensitive identity and auth fields recursively', () => {
  const sanitized = sanitizeUsage({
    accountId: 'acct-secret',
    token: 'secret',
    rateLimits: { usedPercent: 42, resetAt: 1_800_000_000, email: 'hidden@example.com' },
    additional: [{ secretKey: 'hidden', usedPercent: 10 }],
  })
  assert.deepEqual(sanitized, {
    rateLimits: { usedPercent: 42, resetAt: 1_800_000_000 },
    additional: [{ usedPercent: 10 }],
  })
})

test('normalizeUsageResponse returns only sanitized rate-limit payload', () => {
  const normalized = normalizeUsageResponse({
    result: {
      rateLimits: { primary: { usedPercent: 28, resetAt: 1_800_000_000 } },
      accountId: 'must-not-leak',
    },
  })
  assert.equal(normalized.source, 'codex-app-server')
  assert.deepEqual(normalized.usage, {
    rateLimits: { primary: { usedPercent: 28, resetAt: 1_800_000_000 } },
  })
  assert.ok(Number.isNaN(Date.parse(normalized.fetchedAt)) === false)
})

test('normalizeUsageResponse surfaces app-server errors without fabricating usage', () => {
  assert.throws(
    () => normalizeUsageResponse({ error: { message: 'not logged in' } }),
    /not logged in/,
  )
})
