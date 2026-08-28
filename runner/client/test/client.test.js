import assert from 'node:assert/strict'
import test from 'node:test'
import { WebSocketServer } from 'ws'

import { connectRunner, executeLocalJob, nextReconnectDelay, parseRunnerClientConfig } from '../lib/index.js'

test('loads a strict client configuration without returning its token in diagnostics', () => {
  const config = parseRunnerClientConfig({
    url: 'wss://dsh.fsstory.net/runner/v1/connect', token: 'x'.repeat(32),
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
  })
  assert.deepEqual(config.describe(), { url: config.url, runnerId: 'runner-a', deviceId: 'office-pc' })
  assert.equal('token' in config.describe(), false)
  assert.throws(() => parseRunnerClientConfig({ ...config, url: 'ws://public.example/runner/v1/connect' }))
})

test('executes only read-only system info and rejects arbitrary local tools', async () => {
  const binding = {
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
    capabilities: ['local.system_info'],
  }
  const result = await executeLocalJob({
    protocolVersion: 1, kind: 'runner.job', jobId: 'job-1',
    subject: { tenantId: 'tenant-a', userId: 'user-a' }, runnerId: 'runner-a', deviceId: 'office-pc',
    tool: { name: 'local.system_info', arguments: {} }, issuedAt: 1, expiresAt: Date.now() + 60_000,
    approval: { required: false },
  }, binding)
  assert.equal(result.outcome, 'succeeded')
  assert.deepEqual(Object.keys(result.value).sort(), ['arch', 'hostname', 'platform', 'release'])
  await assert.rejects(executeLocalJob({
    protocolVersion: 1, kind: 'runner.job', jobId: 'job-2',
    subject: { tenantId: 'tenant-a', userId: 'user-a' }, runnerId: 'runner-a', deviceId: 'office-pc',
    tool: { name: 'local.shell', arguments: { command: 'whoami' } }, issuedAt: 1, expiresAt: Date.now() + 60_000,
    approval: { required: true, approvalId: 'approval-1' },
  }, { ...binding, capabilities: ['local.system_info', 'local.shell'] }), /unsupported local tool/)
})

test('uses capped exponential reconnect backoff with bounded jitter', () => {
  assert.equal(nextReconnectDelay(0, () => 0), 1_000)
  assert.equal(nextReconnectDelay(3, () => 0), 8_000)
  assert.equal(nextReconnectDelay(20, () => 1), 30_000)
})

test('rejects a job for another subject even when Runner and device IDs match', async () => {
  const job = {
    protocolVersion: 1, kind: 'runner.job', jobId: 'job-cross-subject',
    subject: { tenantId: 'tenant-b', userId: 'user-a' }, runnerId: 'runner-a', deviceId: 'office-pc',
    tool: { name: 'local.system_info', arguments: {} }, issuedAt: Date.now() - 1, expiresAt: Date.now() + 60_000,
    approval: { required: false },
  }
  const binding = {
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
    capabilities: ['local.system_info'],
  }
  await assert.rejects(executeLocalJob(job, binding), /subject/)
})

test('registers and returns real system info over a loopback WebSocket', async t => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 })
  await new Promise(resolve => server.once('listening', resolve))
  const port = server.address().port
  const result = new Promise((resolve, reject) => {
    server.once('connection', socket => {
      socket.once('message', registrationData => {
        const registration = JSON.parse(registrationData.toString())
        assert.equal(registration.kind, 'runner.register')
        socket.once('message', resultData => resolve(JSON.parse(resultData.toString())))
        const now = Date.now()
        socket.send(JSON.stringify({
          protocolVersion: 1, kind: 'runner.job', jobId: 'job-e2e',
          subject: { tenantId: 'tenant-a', userId: 'user-a' }, runnerId: 'runner-a', deviceId: 'office-pc',
          tool: { name: 'local.system_info', arguments: {} }, issuedAt: now, expiresAt: now + 60_000,
          approval: { required: false },
        }))
      })
      socket.once('error', reject)
    })
  })
  const client = connectRunner({
    url: `ws://127.0.0.1:${port}/runner/v1/connect`, token: 'x'.repeat(32),
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
  })
  t.after(async () => {
    client.close()
    for (const socket of server.clients) socket.terminate()
    await new Promise(resolve => server.close(resolve))
  })
  assert.equal((await result).outcome, 'succeeded')
})
