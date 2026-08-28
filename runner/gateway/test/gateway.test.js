import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'
import WebSocket from 'ws'

import { parseGatewayConfig, startRunnerGateway } from '../lib/index.js'

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
