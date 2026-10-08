import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { decodeRecipe, fetchRecipes, LocalRoleStore, roleRoot } from '../lib/market.js'
import { apply as applyRole } from '../lib/role.js'
import { mountMarket } from '../lib/market-host.js'
import { Readable } from 'node:stream'
import { Context } from '@deepseek-ai/cordis'
import SystemPrompt, { renderPrompt } from '@deepseek-ai/dsh-system-prompt'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
// Use the Host registry's scope identity, not another workspace dependency copy.
const promptRequire = createRequire(import.meta.resolve('@deepseek-ai/dsh-system-prompt'))
const { createScope } = await import(pathToFileURL(promptRequire.resolve('@deepseek-ai/dsh-scope')).href)

function recipe(changes = {}) {
  const body = { templateId: '10000000-0000-4000-8000-000000000001', name: '工程师', description: '写代码',
    icon: 'FE', category: 'software-development', capabilityBullets: ['Code'], instructions: 'Use the project rules.',
    skills: [], compatible: true, unavailableReason: null, ...changes }
  return { ...body, version: createHash('sha256').update(JSON.stringify(Object.fromEntries(Object.keys(body).sort().map(k => [k, body[k]])))).digest('hex') }
}
test('strict recipe rejects executable config, bad checksums and template interpolation', () => {
  assert.equal(decodeRecipe(recipe()).name, '工程师')
  assert.throws(() => decodeRecipe({ ...recipe(), plugins: [] }))
  assert.throws(() => decodeRecipe({ ...recipe(), instructions: 'Altered' }))
  assert.throws(() => decodeRecipe(recipe({ instructions: '{{token}}' })))
})
test('catalog binds trusted origin and tenant and enforces size', async () => {
  const credentials = { tenantId: 'tenant-a', accessToken: 'test-only', signal: new AbortController().signal }
  const fetcher = async (url, init) => {
    assert.equal(url, 'https://dev.fsstory.net/desktop/v1/agent-templates')
    assert.equal(init.redirect, 'error')
    return Response.json({ contractVersion: '0.1.0', activeTenantId: credentials.tenantId, items: [recipe()] })
  }
  assert.equal((await fetchRecipes('https://dev.fsstory.net', credentials, fetcher)).length, 1)
  await assert.rejects(fetchRecipes('https://evil.invalid', credentials, fetcher))
  await assert.rejects(fetchRecipes('https://dev.fsstory.net', credentials, async () => Response.json({ contractVersion: '0.1.0', activeTenantId: 'other', items: [] })))
  await assert.rejects(fetchRecipes('https://dev.fsstory.net', credentials, async () => new Response('x'.repeat(2 * 1024 * 1024 + 1))))
})
test('atomic immutable installation preserves trusted tools/assets and survives new store', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fs-role-'))
  try {
    const baseline = path.join(temp, 'standard'); await mkdir(baseline)
    const composition = '- id: tool-fs\n  name: trusted-file-tool\n- id: tool-shell\n  name: trusted-shell\n'
    await writeFile(path.join(baseline, 'agent.cordis.yml'), composition)
    await writeFile(path.join(baseline, 'skill.md'), 'Trusted asset')
    const root = path.join(temp, 'roles'); const store = new LocalRoleStore(root)
    const signal = new AbortController().signal
    const id = await store.install(recipe(), baseline, '/fixed/role.js', signal)
    assert.equal(await store.install(recipe(), baseline, '/fixed/role.js', signal), id)
    assert.equal((await new LocalRoleStore(root).list()).length, 1)
    assert.ok((await readFile(path.join(root, id, 'agent.cordis.yml'), 'utf8')).startsWith(composition))
    assert.equal(await readFile(path.join(root, id, 'skill.md'), 'utf8'), 'Trusted asset')
    const v2 = await store.install(recipe({ instructions: 'New role version' }), baseline, '/fixed/role.js', signal)
    assert.notEqual(v2, id)
    assert.equal(JSON.parse(await readFile(path.join(root, id, 'recipe.json'), 'utf8')).instructions, 'Use the project rules.')
    await assert.rejects(store.install(recipe({ compatible: false, unavailableReason: 'Missing tool' }), baseline, '/fixed/role.js', signal))
    const aborted = AbortSignal.abort()
    await assert.rejects(store.install(recipe({ name: 'Cancelled' }), baseline, '/fixed/role.js', aborted))
  } finally { await rm(temp, { recursive: true, force: true }) }
})
test('role contributes a scoped section without replacing tools or system prompt', () => {
  let section; let disposed = false
  applyRole({ effect: fn => fn(), systemPrompt: { section: value => { section = value; return () => { disposed = true } } } }, { instructions: 'Role text' })
  assert.equal(section.text, 'Role text'); assert.equal(section.complete, undefined)
  assert.equal(disposed, false)
})
test('workspace identity isolates role directories', () => {
  const a = { environment: 'dev', tenantId: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001' }
  assert.notEqual(roleRoot(a), roleRoot({ ...a, environment: 'production' }))
  assert.notEqual(roleRoot(a), roleRoot({ ...a, tenantId: '10000000-0000-4000-8000-000000000002' }))
  assert.notEqual(roleRoot(a), roleRoot({ ...a, userId: '20000000-0000-4000-8000-000000000002' }))
})
test('real DSH prompt assembly isolates roles and preserves the host tool catalog', async () => {
  const ctx = new Context()
  await ctx.plugin(SystemPrompt, { persona: 'Trusted DSH persona.' })
  ctx.systemPrompt.tools(() => ({ schemas: [{ name: 'read_file', description: 'Read', parameters: { type: 'object' } }] }))
  const first = {}, second = {}
  const a = createScope(ctx, first), b = createScope(ctx, second)
  try {
    const plugin = { apply: applyRole, inject: ['systemPrompt'] }
    await a.ctx.plugin(plugin, { instructions: 'Engineer role.' })
    await b.ctx.plugin(plugin, { instructions: 'Research role.' })
    const engineer = await ctx.systemPrompt.assemble({ scope: first })
    const research = await ctx.systemPrompt.assemble({ scope: second })
    assert.match(renderPrompt(engineer), /Engineer role/)
    assert.doesNotMatch(renderPrompt(engineer), /Research role/)
    assert.match(renderPrompt(research), /Research role/)
    assert.match(renderPrompt(engineer), /Trusted DSH persona/)
    assert.equal(engineer.tools[0].name, 'read_file')
    assert.doesNotMatch(renderPrompt(await ctx.systemPrompt.assemble()), /Engineer role|Research role/)
  } finally { await a.dispose(); await b.dispose(); await ctx.fiber.dispose() }
})
test('Host market completes catalog/install/mine and updates native selection without renderer credentials', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'fs-market-host-'))
  const originalFetch = globalThis.fetch
  try {
    const root = path.join(temp, 'roles'), baseline = path.join(temp, 'standard')
    await mkdir(baseline)
    await writeFile(path.join(baseline, 'agent.cordis.yml'), '- id: trusted-tools\n  name: trusted-tools\n')
    const identity = { environment: 'dev', tenantId: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001' }
    const credentials = { ...identity, accessToken: 'host-only-test', signal: new AbortController().signal }
    let activeCredentials = credentials
    globalThis.fetch = async () => Response.json({ contractVersion: '0.1.0', activeTenantId: identity.tenantId, items: [recipe()] })
    const routes = [], updates = []
    const presets = { list: async () => [{ id: 'standard', path: path.join(baseline, 'agent.cordis.yml') },
      ...(await new LocalRoleStore(root).list()).map(r => ({ id: r.presetId, path: path.join(root, r.presetId, 'agent.cordis.yml') }))] }
    mountMarket({ effect: fn => fn(), webServer: { register: route => routes.push(route) },
      get: name => name === 'agentPresets' ? presets : { update: async (ns, patch) => updates.push([ns, patch]) } },
    'https://dev.fsstory.net', identity, root, async () => activeCredentials)
    async function call(suffix, body, header = '1') {
      const request = Readable.from(body ? [JSON.stringify(body)] : [])
      request.method = suffix === 'install' ? 'POST' : 'GET'
      request.headers = { 'x-futurestaff-market': header }; request.socket = { remoteAddress: '127.0.0.1' }
      let result; const response = { statusCode: 0, setHeader() {}, end: raw => { result = JSON.parse(raw) } }
      await routes.find(r => r.path.endsWith(suffix)).handler(request, response)
      return { status: response.statusCode, body: result }
    }
    assert.equal((await call('catalog', undefined, '')).status, 403)
    const catalog = await call('catalog')
    assert.equal(catalog.status, 200)
    assert.equal(catalog.body.items[0].instructions, undefined)
    assert.doesNotMatch(JSON.stringify(catalog.body), /host-only-test/)
    assert.equal((await call('install', { templateId: recipe().templateId, version: 'stale' })).status, 409)
    const installed = await call('install', { templateId: recipe().templateId, version: recipe().version })
    assert.equal(installed.status, 200)
    assert.deepEqual(updates, [['agent-presets', { default: installed.body.presetId }]])
    const mine = await call('mine'); assert.equal(mine.body.items.length, 1)
    assert.equal(mine.body.items[0].instructions, undefined)
    assert.equal(mine.body.items[0].presetId, installed.body.presetId)
    activeCredentials = { ...credentials, tenantId: 'other' }
    assert.equal((await call('mine')).status, 409)
  } finally { globalThis.fetch = originalFetch; await rm(temp, { recursive: true, force: true }) }
})
