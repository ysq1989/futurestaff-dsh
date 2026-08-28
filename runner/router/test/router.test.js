import assert from 'node:assert/strict'
import test from 'node:test'

import { LocalRunnerRouter, RunnerRouterError } from '../lib/index.js'

const binding = Object.freeze({
  tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a',
  deviceId: 'office-pc', capabilities: ['local.system_info'],
})
const registration = Object.freeze({
  protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-a',
  deviceId: 'office-pc', capabilities: ['local.system_info'],
})

function fixture() {
  let now = 1_000
  let nextJob = 1
  const timers = []
  const sent = []
  const router = new LocalRunnerRouter({
    bindings: [binding],
    now: () => now,
    createJobId: () => `job-${nextJob++}`,
    schedule: callback => { timers.push(callback); return callback },
    cancel: handle => { const index = timers.indexOf(handle); if (index >= 0) timers.splice(index, 1) },
    heartbeatTtlMs: 30_000,
    jobTtlMs: 60_000,
  })
  return {
    router, sent, timers,
    channel: { send: job => sent.push(job) },
    setNow: value => { now = value },
  }
}

test('attaches only an exact trusted binding and rejects a duplicate connection', () => {
  const f = fixture()
  const connection = f.router.attach(registration, f.channel)
  assert.deepEqual(f.router.status('runner-a'), {
    runnerId: 'runner-a', deviceId: 'office-pc', online: true,
    stale: false, lastSeenAt: 1_000, capabilities: ['local.system_info'],
  })
  assert.throws(() => f.router.attach(registration, f.channel),
    error => error instanceof RunnerRouterError && error.code === 'RUNNER_ALREADY_CONNECTED')
  connection.disconnect()
  assert.equal(f.router.status('runner-a').online, false)
})

test('rejects registration that differs from the server-side binding', () => {
  const f = fixture()
  assert.throws(() => f.router.attach({ ...registration, deviceId: 'home-pc' }, f.channel),
    error => error instanceof RunnerRouterError && error.code === 'REGISTRATION_MISMATCH')
})

test('injects subject and device, then returns an in-memory system info result', async () => {
  const f = fixture()
  const connection = f.router.attach(registration, f.channel)
  const resultPromise = f.router.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} })
  assert.deepEqual(f.sent[0], {
    protocolVersion: 1, kind: 'runner.job', jobId: 'job-1',
    subject: { tenantId: 'tenant-a', userId: 'user-a' },
    runnerId: 'runner-a', deviceId: 'office-pc',
    tool: { name: 'local.system_info', arguments: {} },
    issuedAt: 1_000, expiresAt: 61_000, approval: { required: false },
  })
  connection.complete({
    protocolVersion: 1, kind: 'runner.job-result', jobId: 'job-1', runnerId: 'runner-a',
    outcome: 'succeeded', value: { platform: 'win32' }, completedAt: 1_001,
  })
  assert.deepEqual(await resultPromise, { platform: 'win32' })
})

test('rejects stale runners and refreshes them with an exact heartbeat', async () => {
  const f = fixture()
  const connection = f.router.attach(registration, f.channel)
  f.setNow(31_001)
  await assert.rejects(f.router.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} }),
    error => error instanceof RunnerRouterError && error.code === 'RUNNER_STALE')
  connection.heartbeat({
    protocolVersion: 1, kind: 'runner.heartbeat', runnerId: 'runner-a',
    deviceId: 'office-pc', sentAt: 31_001,
  })
  assert.equal(f.router.status('runner-a').stale, false)
})

test('keeps pending work safe after a mismatched result and resolves the exact result', async () => {
  const f = fixture()
  const connection = f.router.attach(registration, f.channel)
  const resultPromise = f.router.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} })
  assert.throws(() => connection.complete({
    protocolVersion: 1, kind: 'runner.job-result', jobId: 'another-job', runnerId: 'runner-a',
    outcome: 'succeeded', value: {}, completedAt: 1_001,
  }), error => error instanceof RunnerRouterError && error.code === 'RESULT_MISMATCH')
  connection.complete({
    protocolVersion: 1, kind: 'runner.job-result', jobId: 'job-1', runnerId: 'runner-a',
    outcome: 'failed', error: { code: 'TOOL_FAILED', message: 'unavailable', retryable: true }, completedAt: 1_002,
  })
  await assert.rejects(resultPromise,
    error => error instanceof RunnerRouterError && error.code === 'REMOTE_TOOL_FAILED')
})

test('fails pending work on disconnect and deterministic timeout', async () => {
  const disconnected = fixture()
  const first = disconnected.router.attach(registration, disconnected.channel)
  const firstResult = disconnected.router.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} })
  first.disconnect()
  await assert.rejects(firstResult,
    error => error instanceof RunnerRouterError && error.code === 'CONNECTION_CLOSED')

  const timedOut = fixture()
  timedOut.router.attach(registration, timedOut.channel)
  const secondResult = timedOut.router.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} })
  timedOut.timers[0]()
  await assert.rejects(secondResult,
    error => error instanceof RunnerRouterError && error.code === 'JOB_TIMEOUT')
})
