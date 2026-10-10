import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { FileStore } from '../lib/store.js'

test('exclusive process lock and atomic state persistence', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'douyin-dm-'))
  const filename = path.join(dir, 'state.json'), store = new FileStore(filename)
  try {
    await store.acquire(); assert.equal(await store.load(), null)
    await assert.rejects(new FileStore(filename).acquire(), /EEXIST/)
    await store.save({ phase: 'draft' }); await store.save({ phase: 'paused' })
    assert.deepEqual(await store.load(), { phase: 'paused' })
    assert.deepEqual(JSON.parse(await readFile(filename, 'utf8')), { phase: 'paused' })
    await store.close(); const next = new FileStore(filename); await next.acquire(); await next.close()
  } finally { await store.close(); await rm(dir, { recursive: true, force: true }) }
})
