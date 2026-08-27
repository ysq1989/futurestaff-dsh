import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'
import { startSelectionCenterMock } from '../lib/index.js'

test('serves a real product search over stdio MCP against the mock upstream', async () => {
  const mock = await startSelectionCenterMock({ apiKey: 'mock-key' })
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [path.join(packageRoot, 'lib', 'stdio.js')],
    env: {
      ...process.env,
      SELECTION_CENTER_BASE_URL: mock.baseUrl,
      SELECTION_CENTER_API_KEY: 'mock-key',
      FUTURESTAFF_TENANT_ID: 'tenant-e2e',
      FUTURESTAFF_USER_ID: 'user-e2e',
    },
    stderr: 'pipe',
  })
  const client = new Client({ name: 'e2e-client', version: '1.0.0' })
  try {
    await client.connect(transport)
    const result = await client.callTool({ name: 'search_products', arguments: { query: '佛公' } })
    assert.equal(result.isError, undefined)
    assert.equal(result.structuredContent.items.length, 2)
  } finally {
    await client.close()
    await mock.close()
  }
})
