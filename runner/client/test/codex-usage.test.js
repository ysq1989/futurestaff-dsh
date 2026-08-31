import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeCodexUsageResponse, sanitizeCodexUsage } from '../lib/index.js'

test('sanitizes identity and authentication-shaped fields recursively', () => {
  const sanitized = sanitizeCodexUsage({
    planType: 'prolite',
    email: 'person@example.com',
    accountId: 'acct-secret',
    nested: {
      authorization: 'Bearer secret',
      cookie: 'cookie-secret',
      token: 'token-secret',
      rateLimits: { primary: { usedPercent: 12, resetsAt: 1788760000 } },
    },
  })
  assert.deepEqual(sanitized, {
    planType: 'prolite',
    nested: { rateLimits: { primary: { usedPercent: 12, resetsAt: 1788760000 } } },
  })
})

test('normalizes app-server usage while preserving rate-limit buckets', () => {
  const snapshot = normalizeCodexUsageResponse({ result: {
    rateLimits: { primary: { usedPercent: 12 } },
    rateLimitsByLimitId: {
      codex_bengalfox: { primary: { usedPercent: 0 }, secondary: { usedPercent: 0 } },
    },
    accountId: 'must-not-leak',
  } })
  assert.equal(snapshot.source, 'codex-app-server')
  assert.equal(snapshot.usage.rateLimits.primary.usedPercent, 12)
  assert.equal(snapshot.usage.rateLimitsByLimitId.codex_bengalfox.primary.usedPercent, 0)
  assert.equal('accountId' in snapshot.usage, false)
})

test('rejects app-server responses without a result payload', () => {
  assert.throws(() => normalizeCodexUsageResponse({ error: { message: 'not signed in' } }), /not signed in/)
})
