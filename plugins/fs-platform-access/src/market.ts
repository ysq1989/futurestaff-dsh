import { createHash, randomUUID } from 'node:crypto'
import { cp, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { platformOrigin, type PlatformEnvironment } from './environment.js'
import { workspaceDirectory, type WorkspaceIdentity } from './workspace.js'

export interface RoleRecipe {
  templateId: string; version: string; name: string; description: string; icon: string;
  category: string; capabilityBullets: string[]; instructions: string; skills: never[];
  compatible: boolean; unavailableReason: string | null;
}
export interface LocalRole { presetId: string; recipe: RoleRecipe }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export function decodeRecipe(raw: unknown): RoleRecipe {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('MARKET_CONTRACT')
  const r = raw as Record<string, unknown>
  const keys = ['templateId', 'version', 'name', 'description', 'icon', 'category', 'capabilityBullets', 'instructions', 'skills', 'compatible', 'unavailableReason']
  if (Object.keys(r).sort().join() !== keys.sort().join()) throw new Error('MARKET_CONTRACT')
  for (const key of ['templateId', 'version', 'name', 'description', 'icon', 'category', 'instructions']) {
    if (typeof r[key] !== 'string' || Buffer.byteLength(r[key]) > (key === 'instructions' ? 65536 : 8192)) throw new Error('MARKET_CONTRACT')
  }
  if (!uuid.test(r.templateId as string) || !/^[a-f0-9]{64}$/.test(r.version as string)
    || !(r.name as string).trim() || !Array.isArray(r.skills) || r.skills.length !== 0
    || typeof r.compatible !== 'boolean' || !(r.unavailableReason === null || typeof r.unavailableReason === 'string')
    || (r.compatible && (!(r.instructions as string).trim() || r.unavailableReason !== null))
    || !Array.isArray(r.capabilityBullets) || r.capabilityBullets.length > 12
    || r.capabilityBullets.some(b => typeof b !== 'string' || b.length > 1024)) throw new Error('MARKET_CONTRACT')
  // Prompt interpolation is owned by DSH; remote text must not introduce variables.
  if ((r.instructions as string).includes('{{')) throw new Error('MARKET_CONTRACT')
  const content = Object.fromEntries(Object.keys(r).filter(k => k !== 'version').sort().map(k => [k, r[k]]))
  if (createHash('sha256').update(JSON.stringify(content)).digest('hex') !== r.version) throw new Error('MARKET_CHECKSUM')
  return structuredClone(r) as unknown as RoleRecipe
}
export async function fetchRecipes(origin: string, credentials: { accessToken: string; tenantId: string; signal: AbortSignal }, fetcher = globalThis.fetch): Promise<RoleRecipe[]> {
  const environment: PlatformEnvironment = origin === platformOrigin('production') ? 'production' : 'dev'
  if (platformOrigin(environment) !== origin) throw new Error('MARKET_ORIGIN')
  const response = await fetcher(`${origin}/desktop/v1/agent-templates`, {
    headers: { authorization: `Bearer ${credentials.accessToken}` }, redirect: 'error',
    signal: AbortSignal.any([credentials.signal, AbortSignal.timeout(15000)]),
  })
  if (!response.ok) throw new Error('MARKET_UNAVAILABLE')
  const reader = response.body?.getReader()
  if (!reader) throw new Error('MARKET_CONTRACT')
  const chunks: Uint8Array[] = []; let size = 0
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break
      size += result.value.byteLength
      if (size > 2 * 1024 * 1024) throw new Error('MARKET_CONTRACT')
      chunks.push(result.value)
    }
  } finally { await reader.cancel() }
  credentials.signal.throwIfAborted()
  const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  if (Object.keys(body).sort().join() !== ['activeTenantId', 'contractVersion', 'items'].sort().join()
    || body.contractVersion !== '0.1.0' || body.activeTenantId !== credentials.tenantId
    || !Array.isArray(body.items) || body.items.length > 200) throw new Error('MARKET_CONTRACT')
  const items = body.items.map(decodeRecipe)
  if (new Set(items.map((r: RoleRecipe) => r.templateId)).size !== items.length) throw new Error('MARKET_CONTRACT')
  return items
}
export function roleRoot(identity: WorkspaceIdentity): string { return path.join(workspaceDirectory(identity), 'agent-presets') }
export function roleId(recipe: RoleRecipe): string { return `fs-${recipe.templateId}-${recipe.version}` }
export class LocalRoleStore {
  constructor(readonly root: string) { if (!path.isAbsolute(root)) throw new Error('MARKET_ROOT') }
  async list(): Promise<LocalRole[]> {
    let entries
    try { entries = await readdir(this.root, { withFileTypes: true }) }
    catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return []; throw e }
    const roles: LocalRole[] = []
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^fs-[a-f0-9-]+$/.test(entry.name)) continue
      const recipe = decodeRecipe(JSON.parse(await readFile(path.join(this.root, entry.name, 'recipe.json'), 'utf8')))
      if (roleId(recipe) !== entry.name) throw new Error('MARKET_SNAPSHOT')
      roles.push({ presetId: entry.name, recipe })
    }
    return roles
  }
  async install(raw: RoleRecipe, baselineDirectory: string, rolePlugin: string, signal: AbortSignal): Promise<string> {
    const recipe = decodeRecipe(raw)
    if (!recipe.compatible) throw new Error('MARKET_UNSUPPORTED')
    signal.throwIfAborted()
    await mkdir(this.root, { recursive: true })
    if ((await lstat(this.root)).isSymbolicLink()) throw new Error('MARKET_ROOT')
    const id = roleId(recipe); const target = path.join(this.root, id)
    if ((await this.list()).some(r => r.presetId === id)) return id
    const staging = path.join(this.root, `.creating-${randomUUID()}`)
    if (path.dirname(staging) !== path.resolve(this.root)) throw new Error('MARKET_ROOT')
    try {
      // Preserve all trusted standard composition, skills and assets; only add a data-only role.
      await cp(baselineDirectory, staging, { recursive: true, dereference: false })
      const composition = await readFile(path.join(staging, 'agent.cordis.yml'), 'utf8')
      const row = { id: 'futurestaff-role', name: rolePlugin, config: { instructions: recipe.instructions } }
      await writeFile(path.join(staging, 'agent.cordis.yml'), `${composition}\n- ${JSON.stringify(row)}\n`)
      await writeFile(path.join(staging, 'preset.yml'), JSON.stringify({ name: `${recipe.name} · ${recipe.version.slice(0, 8)}`, description: recipe.description }))
      await writeFile(path.join(staging, 'recipe.json'), JSON.stringify(recipe))
      signal.throwIfAborted()
      try { await rename(staging, target) }
      catch (e) {
        if (!(await this.list()).some(r => r.presetId === id)) throw e
      }
      return id
    } finally { await rm(staging, { recursive: true, force: true }) }
  }
}
