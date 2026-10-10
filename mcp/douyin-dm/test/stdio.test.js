import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/client'
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio'

test('actual stdio process can preview and safely rejects live-disabled startup', async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const dir = await mkdtemp(path.join(os.tmpdir(), 'douyin-stdio-'))
  const config = JSON.parse(await readFile(path.join(root, 'config.example.json'), 'utf8'))
  config.stateFile = path.join(dir, 'state.json')
  const filename = path.join(dir, 'config.json'); await writeFile(filename, JSON.stringify(config))
  const transport = new StdioClientTransport({ command: process.execPath, args: [path.join(root, 'lib', 'stdio.js')], env: { DOUYIN_DM_CONFIG: filename }, stderr: 'pipe' })
  const client = new Client({ name: 'offline-stdio', version: '1.0.0' })
  try {
    await client.connect(transport)
    const tools = await client.listTools(); assert.equal(tools.tools.length, 4)
    const result = await client.callTool({ name: 'douyin_dm_preview', arguments: {
      mode: 'reply', rules: [{ contains: '价格', reply: '请提供型号' }], intervalSeconds: 30, durationSeconds: 60, maxMessages: 1,
    } })
    assert.ok(!result.isError)
    const preview = JSON.parse(result.content[0].text)
    const start = await client.callTool({ name: 'douyin_dm_start', arguments: { previewId: preview.previewId } })
    assert.equal(start.isError, true)
    assert.equal(JSON.parse(await readFile(config.stateFile, 'utf8')).phase, 'draft')
  } finally {
    await client.close()
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep))
    await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
