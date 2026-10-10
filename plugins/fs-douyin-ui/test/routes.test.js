import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createHandler, requestAllowed } from '../lib/index.js'

test('task readiness failures retain actionable codes without exposing diagnostics', async t => {
  for (const code of ['COLLECTOR_NOT_READY', 'PAUSE_SENDING_FIRST', 'MODEL_REQUIRED', 'WATCH_REQUIRED']) {
    const server = createServer(createHandler({ act: async () => { throw Error(code) } }))
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise(resolve => server.close(resolve)))
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST', headers: { 'x-futurestaff-douyin': '1', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'monitor-start' }) })
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: code })
  }
})

test('local bridge rejects cross-origin requests and exposes no identity or scan input', async t => {
  let acted = 0
  const service = { snapshot: async () => ({ owner: 'local-owner' }), act: async () => { acted++; return {} } }
  const server = createServer(createHandler(service)); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/_futurestaff/douyin/v1/workspace`
  assert.equal((await fetch(url)).status, 403)
  assert.equal((await fetch(url, { headers: { 'x-futurestaff-douyin': '1', origin: 'https://evil.invalid' } })).status, 403)
  assert.equal(requestAllowed({ socket: { remoteAddress: '127.0.0.1' }, headers: { 'x-futurestaff-douyin': '1', host: 'evil.invalid' } }), false)
  assert.deepEqual(await (await fetch(url, { headers: { 'x-futurestaff-douyin': '1' } })).json(), { owner: 'local-owner' })
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-futurestaff-douyin': '1', 'content-type': 'text/plain' }, body: '{}' })).status, 415)
  assert.equal((await fetch(url, { method: 'POST', headers: { 'x-futurestaff-douyin': '1', 'content-type': 'application/json' }, body: ' '.repeat(32769) })).status, 413)
  assert.equal(acted, 0)
})
test('bridge never reflects data or credential-bearing exception messages', async t => {
  const server = createServer(createHandler({ snapshot: async () => { throw new Error('private-data-and-token') } }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { headers: { 'x-futurestaff-douyin': '1' } })
  assert.equal(response.status, 409); assert.doesNotMatch(await response.text(), /private-data|token/)
})

test('list calibration failures return only allowlisted actionable error codes', async t => {
  const server = createServer(createHandler({ act: async () => { throw Error('LIBRARY_PANEL_REQUIRED') } }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST', headers: { 'x-futurestaff-douyin': '1', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'library-read', kind: 'favorites' }) })
  assert.equal(response.status, 409); assert.deepEqual(await response.json(), { error: 'LIBRARY_PANEL_REQUIRED' })
})


test('login check failures retain an actionable code across the Host bridge', async t => {
  const server = createServer(createHandler({ act: async () => { throw Error('ACCOUNT_CHECK_FAILED') } }))
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); t.after(() => new Promise(resolve => server.close(resolve)))
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`, { method: 'POST', headers: { 'x-futurestaff-douyin': '1', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'account-check' }) })
  assert.equal(response.status, 409); assert.deepEqual(await response.json(), { error: 'ACCOUNT_CHECK_FAILED' })
})
