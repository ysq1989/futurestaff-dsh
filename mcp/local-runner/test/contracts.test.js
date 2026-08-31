import assert from 'node:assert/strict'
import test from 'node:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport } from '@modelcontextprotocol/server'

import { createLocalRunnerServer } from '../lib/index.js'

test('registers read-only system info and codex usage tools with trusted routing', async () => {
  let systemCalls = 0
  let usageCalls = 0
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  const server = createLocalRunnerServer({
    getSystemInfo: async () => { systemCalls += 1; return { platform: 'win32', arch: 'x64', release: 'test', hostname: 'test-pc' } },
    getCodexUsage: async () => {
      usageCalls += 1
      return {
        source: 'codex-app-server', fetchedAt: '2026-08-31T13:00:00.000Z',
        usage: { rateLimits: { primary: { usedPercent: 12, resetsAt: 1788760000 } } },
      }
    },
  }, 'current-windows-pc')
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
  const tools = await client.listTools()
  assert.deepEqual(tools.tools.map(tool => tool.name).sort(), ['local_codex_usage', 'local_system_info'])

  const systemResult = await client.callTool({ name: 'local_system_info', arguments: {} })
  assert.equal(systemResult.isError, undefined)
  assert.equal(systemResult.structuredContent.platform, 'win32')

  const usageResult = await client.callTool({ name: 'local_codex_usage', arguments: {} })
  assert.equal(usageResult.isError, undefined)
  assert.equal(usageResult.structuredContent.source, 'codex-app-server')
  assert.equal(usageResult.structuredContent.usage.rateLimits.primary.usedPercent, 12)
  assert.equal(systemCalls, 1)
  assert.equal(usageCalls, 1)
  await client.close(); await server.close()
})

test('HTTP client injects configured Runner and internal token for both read-only endpoints', async () => {
  const captured = []
  const { createHttpLocalRunnerClient } = await import('../lib/index.js')
  const client = createHttpLocalRunnerClient({
    baseUrl: 'http://127.0.0.1:3090/', token: 'x'.repeat(32), runnerId: 'runner-fixed',
    fetch: async (url, init) => {
      captured.push({ url: String(url), init })
      if (String(url).endsWith('/codex-usage')) {
        return Response.json({ data: { source: 'codex-app-server', fetchedAt: '2026-08-31T13:00:00.000Z', usage: { rateLimits: {} } } })
      }
      return Response.json({ data: { platform: 'win32', arch: 'x64', release: 'test', hostname: 'pc' } })
    },
  })
  await client.getSystemInfo()
  await client.getCodexUsage()
  assert.equal(captured[0].url, 'http://127.0.0.1:3090/internal/v1/system-info')
  assert.equal(captured[1].url, 'http://127.0.0.1:3090/internal/v1/codex-usage')
  for (const request of captured) {
    assert.deepEqual(JSON.parse(request.init.body), { runnerId: 'runner-fixed' })
    assert.equal(request.init.headers.authorization, `Bearer ${'x'.repeat(32)}`)
  }
})
