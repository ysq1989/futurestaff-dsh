import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FileDesktopProtectedSecrets,
  type DesktopSecretProtector,
} from '../src/protected-secrets.ts'

const temporaryDirectories: string[] = []

async function temporaryUserData(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-protected-secrets-'))
  temporaryDirectories.push(directory)
  return directory
}

function protector(): DesktopSecretProtector & {
  readonly seal: ReturnType<typeof vi.fn>
  readonly open: ReturnType<typeof vi.fn>
} {
  return {
    available: true,
    seal: vi.fn(value => Buffer.from(`sealed:${Buffer.from(value).toString('base64')}`, 'utf8')),
    open: vi.fn(value => Buffer.from(Buffer.from(value).toString('utf8').slice('sealed:'.length), 'base64')),
  }
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
})

describe('Desktop protected secrets', () => {
  it('atomically persists only sealed bytes and survives a service generation', async () => {
    const userData = await temporaryUserData()
    const crypt = protector()
    const first = new FileDesktopProtectedSecrets(userData, crypt)
    await first.write('futurestaff.platform.session.v1', 'private-access-token private-refresh-token')

    const files = await readdir(join(userData, 'protected-secrets'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^[0-9a-f]{64}\.json$/u)
    const persisted = await readFile(join(userData, 'protected-secrets', files[0]!), 'utf8')
    expect(persisted).not.toContain('private-access-token')
    expect(persisted).not.toContain('private-refresh-token')
    expect(crypt.seal).toHaveBeenCalledTimes(1)

    const second = new FileDesktopProtectedSecrets(userData, crypt)
    await expect(second.read('futurestaff.platform.session.v1'))
      .resolves.toBe('private-access-token private-refresh-token')
    expect(crypt.open).toHaveBeenCalledTimes(1)
  })

  it('deletes one secret without exposing its key as a filename', async () => {
    const userData = await temporaryUserData()
    const store = new FileDesktopProtectedSecrets(userData, protector())
    await store.write('futurestaff.platform.session.v1', 'private-value')
    await store.delete('futurestaff.platform.session.v1')
    await expect(store.read('futurestaff.platform.session.v1')).resolves.toBeUndefined()
    await expect(readdir(join(userData, 'protected-secrets'))).resolves.toEqual([])
  })

  it('treats first-run reads, inspection and deletion as empty idempotent operations', async () => {
    const userData = await temporaryUserData()
    const store = new FileDesktopProtectedSecrets(userData, protector())
    await expect(store.has('futurestaff.platform.session.v1')).resolves.toBe(false)
    await expect(store.read('futurestaff.platform.session.v1')).resolves.toBeUndefined()
    await expect(store.delete('futurestaff.platform.session.v1')).resolves.toBeUndefined()
  })

  it('fails closed for unavailable protection, invalid keys and corrupted state', async () => {
    const userData = await temporaryUserData()
    const unavailable: DesktopSecretProtector = {
      available: false,
      seal: value => value,
      open: value => value,
    }
    const locked = new FileDesktopProtectedSecrets(userData, unavailable)
    await expect(locked.write('futurestaff.platform.session.v1', 'private-value'))
      .rejects.toMatchObject({ code: 'protection-unavailable' })
    await expect(locked.write('../unsafe', 'private-value'))
      .rejects.toMatchObject({ code: 'invalid-key' })
    await expect(locked.write('futurestaff.platform.session.v1', undefined as unknown as string))
      .rejects.toMatchObject({ code: 'invalid-secret' })

    const store = new FileDesktopProtectedSecrets(userData, protector())
    await store.write('futurestaff.platform.session.v1', 'private-value')
    const [file] = await readdir(join(userData, 'protected-secrets'))
    await writeFile(join(userData, 'protected-secrets', file!), '{"version":1,"sealed":"not canonical"}')
    await expect(store.read('futurestaff.platform.session.v1'))
      .rejects.toMatchObject({ code: 'invalid-state' })
  })

  it('rejects a protected-secret directory redirected through a link', async () => {
    const userData = await temporaryUserData()
    const redirected = await temporaryUserData()
    await symlink(redirected, join(userData, 'protected-secrets'), 'junction')
    const store = new FileDesktopProtectedSecrets(userData, protector())
    await expect(store.has('futurestaff.platform.session.v1'))
      .rejects.toMatchObject({ code: 'invalid-state' })
    await expect(store.write('futurestaff.platform.session.v1', 'private-value'))
      .rejects.toMatchObject({ code: 'invalid-state' })
  })
})
