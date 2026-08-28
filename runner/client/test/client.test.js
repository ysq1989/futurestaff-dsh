import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { WebSocketServer } from 'ws'

import { connectRunner, enrollRunner, executeLocalJob, nextReconnectDelay, parseRunnerClientConfig } from '../lib/index.js'

test('loads a strict client configuration without returning its token in diagnostics', () => {
  const config = parseRunnerClientConfig({
    url: 'wss://dsh.fsstory.net/runner/v1/connect', token: 'x'.repeat(32),
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
  })
  assert.deepEqual(config.describe(), { url: config.url, runnerId: 'runner-a', deviceId: 'office-pc' })
  assert.equal('token' in config.describe(), false)
  assert.throws(() => parseRunnerClientConfig({ ...config, url: 'ws://public.example/runner/v1/connect' }))
  assert.throws(() => parseRunnerClientConfig({ ...config, url: 'wss://user:pass@dsh.fsstory.net/runner/v1/connect' }))
  assert.throws(() => parseRunnerClientConfig({ ...config, url: 'wss://dsh.fsstory.net/runner/v1/connect#fragment' }))
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

test('exchanges a bootstrap code once and atomically stores only the long-lived Runner config', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-client-enroll-'))
  const bootstrapFile = path.join(directory, 'bootstrap.json')
  const configFile = path.join(directory, 'runner.json')
  const enrollmentCode = 'one-time-enrollment-code-that-must-not-persist'
  await writeFile(bootstrapFile, JSON.stringify({
    gatewayUrl: 'https://dsh.fsstory.net/', deviceName: 'Office PC', code: enrollmentCode,
  }))
  const requests = []
  const config = await enrollRunner({
    bootstrapFile, configFile,
    fetch: async (url, init) => {
      requests.push({ url: String(url), init })
      return new Response(JSON.stringify({ data: {
        url: 'wss://dsh.fsstory.net/runner/v1/connect', token: 'x'.repeat(48),
        tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-new', deviceId: 'device-new',
      } }), { status: 201, headers: { 'content-type': 'application/json' } })
    },
  })
  assert.equal(config.runnerId, 'runner-new')
  assert.equal(requests[0].url, 'https://dsh.fsstory.net/runner/v1/enroll')
  assert.deepEqual(JSON.parse(requests[0].init.body), { code: enrollmentCode, deviceName: 'Office PC' })
  const persisted = await readFile(configFile, 'utf8')
  assert.doesNotMatch(persisted, new RegExp(enrollmentCode))
  assert.deepEqual(parseRunnerClientConfig(JSON.parse(persisted)).describe(), config.describe())
  await assert.rejects(readFile(bootstrapFile), error => error.code === 'ENOENT')
  if (process.platform !== 'win32') assert.equal((await stat(configFile)).mode & 0o777, 0o600)
})

test('keeps bootstrap input for retry when enrollment fails', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-client-enroll-'))
  const bootstrapFile = path.join(directory, 'bootstrap.json')
  const configFile = path.join(directory, 'runner.json')
  await writeFile(bootstrapFile, JSON.stringify({
    gatewayUrl: 'https://dsh.fsstory.net/', deviceName: 'Office PC', code: 'invalid-code-with-enough-length',
  }))
  await assert.rejects(enrollRunner({
    bootstrapFile, configFile,
    fetch: async () => new Response(JSON.stringify({ error: { code: 'CODE_INVALID' } }), { status: 400 }),
  }), /CODE_INVALID/)
  assert.ok((await readFile(bootstrapFile, 'utf8')).includes('invalid-code'))
  await assert.rejects(readFile(configFile), error => error.code === 'ENOENT')
})
