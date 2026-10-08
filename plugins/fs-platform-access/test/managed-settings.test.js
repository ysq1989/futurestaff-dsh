import test from 'node:test'
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import FutureStaffSettings from '../lib/managed-settings.js'

const lockedSchema = z.object({ route: z.string().default('futurestaff') })
const themeSchema = z.object({ preference: z.string().default('dark') })
async function fixture(t, raw = 'default-model:\n  route: direct-provider\nui-theme:\n  preference: light\n', watch = false) {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'fs-managed-settings-')), filename = path.join(folder, 'settings.yaml')
  await writeFile(filename, raw)
  const ctx = new Context(), fiber = await ctx.plugin(FutureStaffSettings, { dshHome: folder, watch, debounceMs: 20 })
  t.after(async () => { await fiber.dispose(); await ctx.fiber.dispose(); await rm(folder, { recursive: true, force: true }) })
  const locked = ctx.settings.register('default-model', lockedSchema, { base: { route: 'futurestaff' } })
  ctx.settings.register('ui-theme', themeSchema)
  return { ctx, locked, filename, fiber }
}
test('the real file provider ignores old managed overrides while keeping editable preferences', async t => {
  const { ctx, locked, filename } = await fixture(t)
  assert.equal(locked.get().route, 'futurestaff')
  assert.equal(ctx.settings.get('ui-theme').preference, 'light')
  assert.deepEqual(ctx.settings.describe({ redactSecrets: true }).map(s => s.ns), ['ui-theme'])
  await ctx.settings.update('ui-theme', { preference: 'dark' })
  assert.equal(ctx.settings.get('ui-theme').preference, 'dark')
  const content = await readFile(filename, 'utf8')
  assert.match(content, /route: direct-provider/); assert.match(content, /preference: dark/)
  assert.equal(locked.get().route, 'futurestaff')
})
test('direct update, replace, mutate and owner-scope writes reject before persistence', async t => {
  const { ctx, locked, filename } = await fixture(t), before = await readFile(filename, 'utf8')
  for (const operation of [
    () => ctx.settings.update('default-model', { route: 'foreign' }),
    () => ctx.settings.replace('default-model', {}),
    () => ctx.settings.mutate('default-model', [{ op: 'set', path: ['route'], value: 'foreign' }]),
    () => locked.update({ route: 'foreign' }), () => locked.replace({}),
  ]) await assert.rejects(operation(), /FutureStaff 统一管理/)
  assert.equal(await readFile(filename, 'utf8'), before)
  assert.equal(locked.get().route, 'futurestaff')
})
test('disk reconciliation cannot promote an external override and unknown namespaces stay managed', async t => {
  const { ctx, locked, filename } = await fixture(t)
  ctx.settings.register('new-unreviewed-feature', lockedSchema, { base: { route: 'fixed' } })
  await writeFile(filename, 'default-model:\n  route: external-edit\nui-theme:\n  preference: light\nnew-unreviewed-feature:\n  route: override\n')
  await ctx.settings.replace('ui-theme', { preference: 'dark' })
  assert.equal(locked.get().route, 'futurestaff')
  assert.equal(ctx.settings.get('new-unreviewed-feature').route, 'fixed')
  await assert.rejects(ctx.settings.update('new-unreviewed-feature', { route: 'override' }), /统一管理/)
  assert.match(await readFile(filename, 'utf8'), /route: external-edit/)
})
test('workspace preference files are independent and the real provider disposes its service', async t => {
  const a = await fixture(t), b = await fixture(t)
  await a.ctx.settings.update('ui-theme', { preference: 'dark' })
  assert.equal(b.ctx.settings.get('ui-theme').preference, 'light')
  assert.match(await readFile(b.filename, 'utf8'), /preference: light/)
  await a.fiber.dispose()
  assert.equal(a.ctx.get('settings'), undefined)
})

test('real file watching updates personal preferences but keeps managed values fixed', async t => {
  const { ctx, locked, filename } = await fixture(t, '', true)
  await writeFile(filename, 'default-model:\n  route: attempted-hot-override\nui-theme:\n  preference: light\n')
  for (let i = 0; i < 60 && ctx.settings.get('ui-theme').preference !== 'light'; i++) await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal(ctx.settings.get('ui-theme').preference, 'light')
  assert.equal(locked.get().route, 'futurestaff')
})
