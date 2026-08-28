import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import WebSocket from 'ws'

import { createEnrollmentService } from '../lib/enrollment.js'
import { parseGatewayConfig, startRunnerGateway } from '../lib/index.js'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const token = 'runner-secret-with-at-least-32-characters'
const binding = {
  tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
  capabilities: ['local.system_info'], tokenSha256: createHash('sha256').update(token).digest('hex'),
}

function waitForMessage(socket) {
  return new Promise((resolve, reject) => {
    socket.once('message', data => resolve(JSON.parse(data.toString())))
    socket.once('error', reject)
  })
}

test('validates gateway bindings and rejects raw or malformed credentials', () => {
  assert.deepEqual(parseGatewayConfig({ bindings: [binding] }).bindings[0], binding)
  assert.throws(() => parseGatewayConfig({ bindings: [{ ...binding, tokenSha256: token }] }))
  assert.throws(() => parseGatewayConfig({ bindings: [binding, binding] }))
})

test('rejects missing credentials before creating a Runner session', async t => {
  const gateway = await startRunnerGateway({ host: '127.0.0.1', port: 0, bindings: [binding] })
  t.after(() => gateway.close())
  await assert.rejects(new Promise((resolve, reject) => {
    const socket = new WebSocket(gateway.url)
    socket.once('open', resolve)
    socket.once('unexpected-response', (_request, response) => reject(new Error(`HTTP_${response.statusCode}`)))
    socket.once('error', reject)
  }), /HTTP_401/)
  assert.equal(gateway.router.status('runner-a').online, false)
})

test('carries one authenticated system-info job and emits redacted lifecycle logs', async t => {
  const events = []
  const gateway = await startRunnerGateway({
    host: '127.0.0.1', port: 0, bindings: [binding],
    log: event => events.push(event),
  })
  t.after(() => gateway.close())
  const socket = new WebSocket(gateway.url, { headers: { authorization: `Bearer ${token}` } })
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-a',
    deviceId: 'office-pc', capabilities: ['local.system_info'],
  }))
  await new Promise(resolve => setTimeout(resolve, 10))

  const resultPromise = gateway.dispatch({ runnerId: 'runner-a', toolName: 'local.system_info', arguments: {} })
  const job = await waitForMessage(socket)
  assert.equal(job.subject.tenantId, 'tenant-a')
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.job-result', jobId: job.jobId, runnerId: 'runner-a',
    outcome: 'succeeded', value: { platform: 'win32', arch: 'x64' }, completedAt: Date.now(),
  }))
  assert.deepEqual(await resultPromise, { platform: 'win32', arch: 'x64' })
  socket.close()

  const serialized = JSON.stringify(events)
  assert.match(serialized, /runner_connected/)
  assert.match(serialized, /runner_job_completed/)
  assert.doesNotMatch(serialized, new RegExp(token))
  assert.doesNotMatch(serialized, /tenant-a|user-a/)
})

test('closes an authenticated socket whose registration mismatches its token binding', async t => {
  const gateway = await startRunnerGateway({ host: '127.0.0.1', port: 0, bindings: [binding] })
  t.after(() => gateway.close())
  const socket = new WebSocket(gateway.url, { headers: { authorization: `Bearer ${token}` } })
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  const closed = new Promise(resolve => socket.once('close', (code, reason) => resolve({ code, reason: reason.toString() })))
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-a',
    deviceId: 'wrong-device', capabilities: ['local.system_info'],
  }))
  assert.deepEqual(await closed, { code: 4403, reason: 'registration rejected' })
})

test('does not let one valid device token register as another configured Runner', async t => {
  const other = {
    ...binding, runnerId: 'runner-b', deviceId: 'home-pc',
    tokenSha256: createHash('sha256').update('another-runner-secret-at-least-32-chars').digest('hex'),
  }
  const gateway = await startRunnerGateway({ host: '127.0.0.1', port: 0, bindings: [binding, other] })
  t.after(() => gateway.close())
  const socket = new WebSocket(gateway.url, { headers: { authorization: `Bearer ${token}` } })
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  const closed = new Promise(resolve => socket.once('close', code => resolve(code)))
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-b',
    deviceId: 'home-pc', capabilities: ['local.system_info'],
  }))
  assert.equal(await closed, 4403)
  assert.equal(gateway.router.status('runner-b').online, false)
})

test('authenticates the private fixed-capability dispatch endpoint', async t => {
  const events = []
  const dispatchToken = 'internal-dispatch-token-at-least-32-characters'
  const gateway = await startRunnerGateway({
    host: '127.0.0.1', port: 0, bindings: [binding], dispatchToken,
    log: event => events.push(event),
  })
  t.after(() => gateway.close())
  const endpoint = new URL('/internal/v1/system-info', gateway.httpUrl)
  const unauthorized = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ runnerId: 'runner-a' }) })
  assert.equal(unauthorized.status, 401)

  const socket = new WebSocket(gateway.url, { headers: { authorization: `Bearer ${token}` } })
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.register', runnerId: 'runner-a',
    deviceId: 'office-pc', capabilities: ['local.system_info'],
  }))
  await new Promise(resolve => setTimeout(resolve, 10))
  socket.once('message', data => {
    const job = JSON.parse(data.toString())
    socket.send(JSON.stringify({
      protocolVersion: 1, kind: 'runner.job-result', jobId: job.jobId, runnerId: 'runner-a',
      outcome: 'succeeded', value: { platform: 'win32', arch: 'x64', release: 'test', hostname: 'test-pc' },
      completedAt: Date.now(),
    }))
  })
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${dispatchToken}`, 'content-type': 'application/json', 'x-request-id': 'request-e2e' },
    body: JSON.stringify({ runnerId: 'runner-a' }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { data: { platform: 'win32', arch: 'x64', release: 'test', hostname: 'test-pc' } })
  assert.match(JSON.stringify(events), /internal_dispatch_completed/)
  socket.close()
})

test('maps an offline Runner to a stable private API error', async t => {
  const gateway = await startRunnerGateway({
    host: '127.0.0.1', port: 0, bindings: [binding],
    dispatchToken: 'internal-dispatch-token-at-least-32-characters',
    log: () => {},
  })
  t.after(() => gateway.close())
  const response = await fetch(new URL('/internal/v1/system-info', gateway.httpUrl), {
    method: 'POST',
    headers: { authorization: 'Bearer internal-dispatch-token-at-least-32-characters', 'content-type': 'application/json' },
    body: JSON.stringify({ runnerId: 'runner-a' }),
  })
  assert.equal(response.status, 503)
  assert.deepEqual(await response.json(), { error: { code: 'RUNNER_OFFLINE', message: 'Runner is unavailable', retryable: true } })
})

test('redeems a public one-time code and immediately authenticates the enrolled Runner', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-gateway-enroll-'))
  const offersFile = path.join(directory, 'offers.json')
  const enrollmentCode = 'one-time-code-with-enough-entropy-for-test'
  await writeFile(offersFile, JSON.stringify({ offers: [{
    codeSha256: createHash('sha256').update(enrollmentCode).digest('hex'),
    tenantId: 'tenant-new', userId: 'user-new', expiresAt: Date.now() + 60_000,
  }] }))
  const enrollment = await createEnrollmentService({ offersFile, stateFile: path.join(directory, 'state.json') })
  const events = []
  const gateway = await startRunnerGateway({
    host: '127.0.0.1', port: 0, bindings: [binding], enrollment,
    publicRunnerUrl: 'wss://dsh.fsstory.net/runner/v1/connect',
    log: event => events.push(event),
  })
  t.after(() => gateway.close())

  const response = await fetch(new URL('/runner/v1/enroll', gateway.httpUrl), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: enrollmentCode, deviceName: 'Office PC' }),
  })
  assert.equal(response.status, 201)
  const { data } = await response.json()
  assert.equal(data.url, 'wss://dsh.fsstory.net/runner/v1/connect')
  assert.equal(data.tenantId, 'tenant-new')
  assert.equal(data.userId, 'user-new')
  assert.ok(data.token.length >= 32)

  const socket = new WebSocket(data.url.replace('wss://dsh.fsstory.net', gateway.httpUrl.replace('http:', 'ws:').replace(/\/$/, '')), {
    headers: { authorization: `Bearer ${data.token}` },
  })
  await new Promise((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject) })
  socket.send(JSON.stringify({
    protocolVersion: 1, kind: 'runner.register', runnerId: data.runnerId,
    deviceId: data.deviceId, capabilities: ['local.system_info'],
  }))
  await new Promise(resolve => setTimeout(resolve, 10))
  assert.equal(gateway.router.status(data.runnerId).online, true)
  socket.close()

  const replay = await fetch(new URL('/runner/v1/enroll', gateway.httpUrl), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code: enrollmentCode, deviceName: 'Replay PC' }),
  })
  assert.equal(replay.status, 409)
  const serializedEvents = JSON.stringify(events)
  assert.match(serializedEvents, /runner_enrollment_completed/)
  assert.doesNotMatch(serializedEvents, new RegExp(enrollmentCode))
  assert.doesNotMatch(serializedEvents, new RegExp(data.token))
})
