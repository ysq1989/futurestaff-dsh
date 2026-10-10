import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import * as plugin from '../lib/index.js'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

test('real Cordis mounts one local workspace and closes SQLite on plugin disposal', async t => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dy-cordis-'))
  t.after(() => rm(folder, { recursive: true, force: true }))
  const ctx = new Context(), paths = [], controller = new AbortController()
  let released = 0
  ctx.provide('webServer', { register: route => { paths.push(route.path); return () => { released++ } } })
  ctx.provide('platformDevLogin', { authorizeLocal: async () => ({ tenantId: 'tenant-a', userId: 'user-a', signal: controller.signal }) })
  ctx.provide('platformInference', { models: async () => [], generateText: async () => { throw new Error('not used') } })
  const fiber = await ctx.plugin(plugin, { database: path.join(folder, 'leads.sqlite') })
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(paths, [plugin.routePath]); const service = ctx.douyinLeads
  assert.equal((await service.snapshot()).watches.length, 0)
  await fiber.dispose(); assert.equal(released, 1)
  await assert.rejects(service.snapshot(), /CLOSED/); await ctx.fiber.dispose()
})
