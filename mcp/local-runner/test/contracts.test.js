import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'

import { createLocalRunnerServer } from '../lib/index.js'

test('registers one no-input local system info tool with trusted routing', async () => {
  let calls = 0
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createLocalRunnerServer({
    getSystemInfo: async () => { calls += 1; return { platform: 'win32', arch: 'x64', release: 'test', hostname: 'test-pc' } },
  }, 'current-windows-pc')
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const tools = await client.listTools()
  assert.deepEqual(tools.tools.map(tool => tool.name), ['local_system_info'])
  const result = await client.callTool({ name: 'local_system_info', arguments: {} })
  assert.equal(result.isError, undefined)
  assert.equal(result.structuredContent.platform, 'win32')
  assert.equal(calls, 1)
  await client.close(); await server.close()
})

test('HTTP client injects configured Runner and internal token', async () => {
  let captured
  const { createHttpLocalRunnerClient } = await import('../lib/index.js')
  const client = createHttpLocalRunnerClient({
    baseUrl: 'http://127.0.0.1:3090/', token: 'x'.repeat(32), runnerId: 'runner-fixed',
    fetch: async (url, init) => { captured = { url: String(url), init }; return Response.json({ data: { platform: 'win32', arch: 'x64', release: 'test', hostname: 'pc' } }) },
  })
  await client.getSystemInfo()
  assert.equal(captured.url, 'http://127.0.0.1:3090/internal/v1/system-info')
  assert.deepEqual(JSON.parse(captured.init.body), { runnerId: 'runner-fixed' })
  assert.equal(captured.init.headers.authorization, `Bearer ${'x'.repeat(32)}`)
})
