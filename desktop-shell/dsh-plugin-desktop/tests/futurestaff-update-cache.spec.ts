import { createHash, generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { prepareFutureStaffUpdate, cleanupPreparedFutureStaffUpdate, verifyPreparedFutureStaffUpdate } from '../src/futurestaff-update-cache.ts'
import type { FutureStaffRelease } from '../src/futurestaff-update.ts'
const keys = generateKeyPairSync('ed25519')
const trust = { manifestUrl: 'https://fsstory.net/desktop-updates/stable.json',
  publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() }
const bytes = Buffer.from('verified updater cache fixture')
const artifact = { url: 'https://fsstory.net/desktop-updates/setup.exe', size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex') }
const release: FutureStaffRelease = { schemaVersion: 1, productId: 'net.fsstory.agent.desktop',
  platform: 'win32', arch: 'x64', version: '2.0.14', notes: '', installer: artifact,
  rollback: { ...artifact, version: '2.0.13' } }
const roots: string[] = []
async function root() { const path = await mkdtemp(join(tmpdir(), 'fs-prepared-test-')); roots.push(path); return path }
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }) })
const signal = () => new AbortController().signal

it('reuses verified bytes across calls/process restarts and cleans after the installed version catches up', async () => {
  const directory = await root()
  const request = vi.fn(async () => new Response(bytes))
  const first = await prepareFutureStaffUpdate(release, trust, directory, request, signal())
  expect(await prepareFutureStaffUpdate(release, trust, directory, request, signal())).toBe(first)
  expect(request).toHaveBeenCalledOnce()
  await cleanupPreparedFutureStaffUpdate(directory, '2.0.13')
  expect(await readFile(first)).toEqual(bytes)
  await cleanupPreparedFutureStaffUpdate(directory, '2.0.14')
  expect(await readdir(directory)).toEqual([])
})
it('repairs changed cached bytes by downloading a fresh verified package', async () => {
  const directory = await root()
  const request = vi.fn(async () => new Response(bytes))
  const first = await prepareFutureStaffUpdate(release, trust, directory, request, signal())
  await writeFile(first, 'modified')
  await expect(verifyPreparedFutureStaffUpdate(directory, first, release)).rejects.toThrow('UPDATE_HASH_REJECTED')
  const second = await prepareFutureStaffUpdate(release, trust, directory, request, signal())
  expect(second).not.toBe(first); expect(await readFile(second)).toEqual(bytes)
  expect(request).toHaveBeenCalledTimes(2)
  await expect(verifyPreparedFutureStaffUpdate(directory, first, release)).rejects.toThrow('UPDATE_CACHE_REJECTED')
})
it.each(['bad-bytes', 'cancel'])('does not keep an unverified package after %s', async kind => {
  const directory = await root()
  const controller = new AbortController()
  if (kind === 'cancel') controller.abort()
  await expect(prepareFutureStaffUpdate(release, trust, directory,
    async () => new Response('bad'), controller.signal)).rejects.toThrow()
  expect(await readdir(directory)).toEqual([])
})
it('rejects cache paths outside the generated private directory namespace', async () => {
  const directory = await root()
  await writeFile(join(directory, 'prepared-firstparty.json'), JSON.stringify({ version: release.version,
    sha256: artifact.sha256, folder: '../outside' }))
  const request = vi.fn(async () => new Response(bytes))
  await expect(prepareFutureStaffUpdate(release, trust, directory, request, signal())).rejects.toThrow('UPDATE_CACHE_REJECTED')
  expect(request).not.toHaveBeenCalled()
})
it('never follows a generated-name junction/symlink outside the private cache', async () => {
  const directory = await root()
  const outside = await root()
  await writeFile(join(outside, 'FutureStaff-Agent-Setup.exe'), bytes)
  const folder = 'futurestaff-update-ABC123'
  await symlink(outside, join(directory, folder), process.platform === 'win32' ? 'junction' : 'dir')
  await writeFile(join(directory, 'prepared-firstparty.json'), JSON.stringify({ version: release.version,
    sha256: artifact.sha256, folder }))
  await expect(cleanupPreparedFutureStaffUpdate(directory, release.version)).rejects.toThrow('UPDATE_CACHE_REJECTED')
  expect(await readFile(join(outside, 'FutureStaff-Agent-Setup.exe'))).toEqual(bytes)
})
it('rejects a changed release even when its version matches a prior cache entry', async () => {
  const directory = await root()
  const request = vi.fn(async () => new Response(bytes))
  await prepareFutureStaffUpdate(release, trust, directory, request, signal())
  const changed = { ...release, installer: { ...artifact, sha256: 'a'.repeat(64) } }
  await expect(prepareFutureStaffUpdate(changed, trust, directory, request, signal())).rejects.toThrow('UPDATE_HASH_REJECTED')
})
