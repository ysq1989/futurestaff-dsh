import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CODEX_USAGE_RUNNER_CAPABILITY,
  INITIAL_RUNNER_CAPABILITY,
  RunnerProtocolError,
  authorizeRunnerJob,
  parseRunnerRegistration,
} from '../lib/index.js'

const capabilities = [INITIAL_RUNNER_CAPABILITY, CODEX_USAGE_RUNNER_CAPABILITY]
const binding = {
  tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc', capabilities,
}

test('accepts registration containing the read-only codex usage capability', () => {
  assert.deepEqual(parseRunnerRegistration({
    protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-a', deviceId: 'office-pc', capabilities,
  }).capabilities, capabilities)
})

test('authorizes codex usage only for a binding that declares it', () => {
  const now = Date.now()
  const job = {
    protocolVersion: 1, kind: 'runner.job', jobId: 'job-usage',
    subject: { tenantId: 'tenant-a', userId: 'user-a' }, runnerId: 'runner-a', deviceId: 'office-pc',
    tool: { name: CODEX_USAGE_RUNNER_CAPABILITY, arguments: {} },
    issuedAt: now - 1, expiresAt: now + 60_000, approval: { required: false },
  }
  assert.equal(authorizeRunnerJob(binding, job, now).tool.name, CODEX_USAGE_RUNNER_CAPABILITY)
  assert.throws(
    () => authorizeRunnerJob({ ...binding, capabilities: [INITIAL_RUNNER_CAPABILITY] }, job, now),
    error => error instanceof RunnerProtocolError && error.code === 'CAPABILITY_DENIED',
  )
})
