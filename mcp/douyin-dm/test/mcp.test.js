import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'
import { createDmServer } from '../lib/server.js'
import { DmEngine } from '../lib/engine.js'

test('MCP exports exact bounded tools and isolates account identity from model arguments', async () => {
  let saved = null, calls = 0
  const engine = new DmEngine('owner', { check: async () => {}, inbox: async () => [], send: async () => { calls++; return 'sent' }, close() {} },
    { load: async () => saved, save: async s => { saved = structuredClone(s) } }, false)
  await engine.init()
  const server = createDmServer(engine, 'fixed-account', 'fixed-device')
  const client = new Client({ name: 'offline-test', version: '1.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await Promise.all([client.connect(a), server.connect(b)])
  try {
    const { tools } = await client.listTools()
    assert.deepEqual(tools.map(t => t.name).sort(), ['douyin_dm_pause', 'douyin_dm_preview', 'douyin_dm_start', 'douyin_dm_status'])
    for (const tool of tools) assert.equal(tool._meta['futurestaff/tool'].deviceId, 'fixed-device')
    const preview = await client.callTool({ name: 'douyin_dm_preview', arguments: {
      mode: 'outbound', recipients: ['recipient_123'], message: '您好', intervalSeconds: 30, durationSeconds: 60, maxMessages: 1,
    } })
    assert.ok(!preview.isError)
    const plan = JSON.parse(preview.content[0].text)
    assert.equal(plan.accountId, 'fixed-account')
    const start = await client.callTool({ name: 'douyin_dm_start', arguments: { previewId: plan.previewId } })
    assert.equal(start.isError, true); assert.equal(calls, 0)
    const invalid = await client.callTool({ name: 'douyin_dm_start', arguments: { previewId: plan.previewId, accountId: 'other' } })
    assert.equal(invalid.isError, true)
    const status = await client.callTool({ name: 'douyin_dm_status', arguments: {} })
    assert.ok(!status.isError)
  } finally { await client.close(); await server.close() }
})
