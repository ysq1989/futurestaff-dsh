import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { checkFutureStaffUpdate, parseSignedRelease, trustedUpdateUrl, withFutureStaffInstaller, verifyFutureStaffInstaller, verifyWindowsUpdate,
  type FutureStaffUpdateTrust, type FutureStaffRelease } from '../src/futurestaff-update.ts'

const keys = generateKeyPairSync('ed25519')
const trust: FutureStaffUpdateTrust = { manifestUrl: 'https://updates.fsstory.net/stable.json',
  publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(), signerThumbprint: 'A'.repeat(40) }
const bytes = Buffer.from('installer test fixture')
const installer = { url: 'https://updates.fsstory.net/2.0.11.exe', size: bytes.length,
  sha256: createHash('sha256').update(bytes).digest('hex') }
const release: FutureStaffRelease = { schemaVersion: 1, productId: 'net.fsstory.agent.desktop',
  platform: 'win32', arch: 'x64', version: '2.0.11', notes: '更新说明', installer,
  rollback: { ...installer, url: 'https://updates.fsstory.net/2.0.10.exe', version: '2.0.10' } }
function envelope(value: unknown = release): string {
  const payload = JSON.stringify(value)
  return JSON.stringify({ payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString('base64') })
}
const roots: string[] = []
async function directory(): Promise<string> { const path = await mkdtemp(join(tmpdir(), 'fs-update-test-')); roots.push(path); return path }
afterEach(async () => { for (const path of roots.splice(0)) await rm(path, { recursive: true, force: true }) })

describe('FutureStaff signed release boundary', () => {
  it('verifies a signed manifest including the recoverable prior installer', () => {
    expect(parseSignedRelease(envelope(), trust)).toEqual(release)
  })
  it('rejects tampering and signatures from an unpinned key', () => {
    const altered = JSON.parse(envelope()) as { payload: string }
    altered.payload = altered.payload.replace('2.0.11', '9.0.0')
    expect(() => parseSignedRelease(JSON.stringify(altered), trust)).toThrow('UPDATE_SIGNATURE_REJECTED')
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()
    expect(() => parseSignedRelease(envelope(), { ...trust, publicKey: other })).toThrow('UPDATE_SIGNATURE_REJECTED')
  })
  it.each(['http://updates.fsstory.net/a', 'https://fsstory.net.evil.test/a', 'https://evil.test/a',
    'https://user@updates.fsstory.net/a', 'https://updates.fsstory.net:444/a', 'https://updates.fsstory.net/a?token=secret'])('rejects unsafe source %s', url => {
    expect(() => trustedUpdateUrl(url)).toThrow()
  })
  it.each([
    { ...release, productId: 'ai.deepseek.desktop' }, { ...release, platform: 'darwin' },
    { ...release, version: '2.0.11-beta.1' }, { ...release, rollback: undefined },
    { ...release, rollback: { ...release.rollback, version: '3.0.0' } },
    { ...release, installer: { ...installer, url: 'https://another.fsstory.net/a.exe' } },
    { ...release, installer: { ...installer, size: 0 } },
  ])('rejects incorrect product/platform/version/rollback/artifact', value => {
    expect(() => parseSignedRelease(envelope(value), trust)).toThrow()
  })
  it('requests only the pinned URL without credentials or redirects', async () => {
    const request = vi.fn(async () => new Response(envelope()))
    await expect(checkFutureStaffUpdate(trust, request, new AbortController().signal)).resolves.toEqual(release)
    expect(request).toHaveBeenCalledWith(trust.manifestUrl, expect.objectContaining({ redirect: 'error', credentials: 'omit' }))
  })
  it('rejects oversized streamed manifests and HTTP redirects', async () => {
    const signal = new AbortController().signal
    await expect(checkFutureStaffUpdate(trust, async () => new Response('x'.repeat(33 * 1024)), signal)).rejects.toThrow('UPDATE_MANIFEST_TOO_LARGE')
    await expect(checkFutureStaffUpdate(trust, async () => new Response(null, { status: 302 }), signal)).rejects.toThrow('UPDATE_REQUEST_FAILED')
  })
})

describe('verified installer handoff', () => {
  it('checks complete bytes and publisher before handing the private path to the installer', async () => {
    const root = await directory()
    const verify = vi.fn(async () => {})
    const consume = vi.fn(async (path: string) => { expect(await readFile(path)).toEqual(bytes); expect(verify).toHaveBeenCalled(); return true })
    await withFutureStaffInstaller(release, trust, root, async () => new Response(bytes), new AbortController().signal, consume, verify)
    expect(consume).toHaveBeenCalledOnce()
    expect(verify).toHaveBeenCalledWith(expect.any(String), trust.signerThumbprint)
  })
  it.each(['hash', 'size', 'signature', 'cancel'])('never launches and cleans up after %s failure', async kind => {
    const root = await directory()
    const consume = vi.fn(async () => true)
    const abort = new AbortController()
    if (kind === 'cancel') abort.abort()
    const damaged = kind === 'hash' ? Buffer.from('x'.repeat(bytes.length)) : kind === 'size' ? Buffer.concat([bytes, bytes]) : bytes
    const verify = vi.fn(async () => { if (kind === 'signature') throw new Error('bad signature') })
    await expect(withFutureStaffInstaller(release, trust, root, async () => new Response(damaged), abort.signal, consume, verify)).rejects.toThrow()
    expect(consume).not.toHaveBeenCalled()
    expect(await readdir(root)).toEqual([])
  })
  it('removes a verified installer when the user chooses later', async () => {
    const root = await directory()
    await withFutureStaffInstaller(release, trust, root, async () => new Response(bytes), new AbortController().signal, async () => false, async () => {})
    expect(await readdir(root)).toEqual([])
  })
  it('rejects file substitution during the installation confirmation', async () => {
    const root = await directory()
    const path = join(root, 'setup.exe')
    await writeFile(path, Buffer.from('x'.repeat(bytes.length)))
    await expect(verifyFutureStaffInstaller(path, installer, trust.signerThumbprint)).rejects.toThrow('UPDATE_HASH_REJECTED')
  })
  it.runIf(process.platform === 'win32')('rejects a genuinely unsigned file through the Windows certificate verifier', async () => {
    const root = await directory()
    const path = join(root, 'unsigned.exe')
    await writeFile(path, bytes)
    await expect(verifyWindowsUpdate(path, trust.signerThumbprint)).rejects.toThrow()
  })
})
