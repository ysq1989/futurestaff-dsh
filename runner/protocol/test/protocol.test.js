import assert from 'node:assert/strict'
import test from 'node:test'

import {
  RunnerProtocolError,
  RunnerReplayGuard,
  authorizeRunnerJob,
  parseRunnerHeartbeat,
  parseRunnerJobResult,
  parseRunnerRegistration,
} from '../lib/index.js'

const binding = Object.freeze({
  tenantId: 'tenant-a',
  userId: 'user-a',
  runnerId: 'runner-a',
  deviceId: 'office-pc',
  capabilities: ['local.system_info'],
})

test('parses successful and failed job result envelopes', () => {
  assert.deepEqual(parseRunnerJobResult({
    protocolVersion: 1,
    kind: 'runner.job-result',
    jobId: 'job-1',
    runnerId: 'runner-a',
    outcome: 'succeeded',
    value: { platform: 'win32' },
    completedAt: 2_000,
  }), {
    protocolVersion: 1,
    kind: 'runner.job-result',
    jobId: 'job-1',
    runnerId: 'runner-a',
    outcome: 'succeeded',
    value: { platform: 'win32' },
    completedAt: 2_000,
  })
  assert.equal(parseRunnerJobResult({
    protocolVersion: 1,
    kind: 'runner.job-result',
    jobId: 'job-2',
    runnerId: 'runner-a',
    outcome: 'failed',
    error: { code: 'TOOL_FAILED', message: 'unavailable', retryable: true },
    completedAt: 2_001,
  }).outcome, 'failed')
})

test('rejects malformed job results', () => {
  assert.throws(
    () => parseRunnerJobResult({
      protocolVersion: 1,
      kind: 'runner.job-result',
      jobId: 'job-1',
      runnerId: 'runner-a',
      outcome: 'failed',
      error: { code: 'TOOL_FAILED', message: 'unavailable' },
      completedAt: 2_001,
    }),
    error => error instanceof RunnerProtocolError && error.code === 'INVALID_ENVELOPE',
  )
})

const job = Object.freeze({
  protocolVersion: 1,
  kind: 'runner.job',
  jobId: 'job-1',
  subject: { tenantId: 'tenant-a', userId: 'user-a' },
  runnerId: 'runner-a',
  deviceId: 'office-pc',
  tool: { name: 'local.system_info', arguments: {} },
  issuedAt: 1_000,
  expiresAt: 61_000,
  approval: { required: false },
})

test('parses v1 registration and heartbeat envelopes', () => {
  assert.deepEqual(parseRunnerRegistration({
    protocolVersion: 1,
    kind: 'runner.register',
    runnerId: 'runner-a',
    deviceId: 'office-pc',
    displayName: 'Office PC',
    capabilities: ['local.system_info'],
  }), {
    protocolVersion: 1,
    kind: 'runner.register',
    runnerId: 'runner-a',
    deviceId: 'office-pc',
    displayName: 'Office PC',
    capabilities: ['local.system_info'],
  })
  assert.equal(parseRunnerHeartbeat({
    protocolVersion: 1,
    kind: 'runner.heartbeat',
    runnerId: 'runner-a',
    deviceId: 'office-pc',
    sentAt: 2_000,
  }).sentAt, 2_000)
})

test('accepts an exact subject, Runner, device, capability, and time match', () => {
  assert.deepEqual(authorizeRunnerJob(binding, job, 2_000), job)
})

test('rejects cross-subject and wrong-device delivery', () => {
  assert.throws(
    () => authorizeRunnerJob(binding, { ...job, subject: { tenantId: 'tenant-b', userId: 'user-a' } }, 2_000),
    error => error instanceof RunnerProtocolError && error.code === 'SUBJECT_MISMATCH',
  )
  assert.throws(
    () => authorizeRunnerJob(binding, { ...job, deviceId: 'home-pc' }, 2_000),
    error => error instanceof RunnerProtocolError && error.code === 'DEVICE_MISMATCH',
  )
})

test('allows bounded clock skew but rejects expired, far-future, and unsupported jobs', () => {
  assert.throws(
    () => authorizeRunnerJob(binding, job, 61_001),
    error => error instanceof RunnerProtocolError && error.code === 'JOB_EXPIRED',
  )
  assert.deepEqual(authorizeRunnerJob(binding, job, 999), job)
  assert.throws(
    () => authorizeRunnerJob(binding, { ...job, issuedAt: 31_000, expiresAt: 91_000 }, 999),
    error => error instanceof RunnerProtocolError && error.code === 'JOB_NOT_YET_VALID',
  )
  assert.throws(
    () => authorizeRunnerJob(binding, { ...job, tool: { name: 'xiaohongshu.publish', arguments: {} } }, 2_000),
    error => error instanceof RunnerProtocolError && error.code === 'CAPABILITY_DENIED',
  )
})

test('bounded replay guard rejects a duplicate accepted job ID', () => {
  const guard = new RunnerReplayGuard(2)
  guard.accept(binding, job, 2_000)
  assert.throws(
    () => guard.accept(binding, job, 2_001),
    error => error instanceof RunnerProtocolError && error.code === 'JOB_REPLAYED',
  )
})

test('rejects malformed and unknown-version wire input', () => {
  assert.throws(
    () => parseRunnerRegistration({ protocolVersion: 2, kind: 'runner.register' }),
    error => error instanceof RunnerProtocolError && error.code === 'INVALID_ENVELOPE',
  )
  assert.throws(
    () => parseRunnerHeartbeat({ protocolVersion: 1, kind: 'runner.heartbeat', runnerId: 'runner-a' }),
    error => error instanceof RunnerProtocolError && error.code === 'INVALID_ENVELOPE',
  )
  assert.throws(
    () => parseRunnerRegistration({
      protocolVersion: 1,
      kind: 'runner.register',
      runnerId: 'runner-a',
      deviceId: 'office-pc',
      capabilities: ['xiaohongshu.publish'],
    }),
    error => error instanceof RunnerProtocolError && error.code === 'CAPABILITY_DENIED',
  )
  assert.throws(
    () => authorizeRunnerJob(binding, { ...job, approval: { required: true } }, 2_000),
    error => error instanceof RunnerProtocolError && error.code === 'INVALID_ENVELOPE',
  )
})
