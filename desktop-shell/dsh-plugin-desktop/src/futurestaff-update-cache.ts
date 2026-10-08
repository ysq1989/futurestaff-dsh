/** Private cache is advisory: every reuse is bound to a freshly verified release. */
import { lstat, mkdir, readFile, realpath, rm, rmdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'
import { compareSemVerVersions, type UpdateRequest } from './update-checker.ts'
import { validateManifestTrust, verifyFutureStaffInstallerBytes, withFutureStaffDownload,
  type FutureStaffManifestTrust, type FutureStaffRelease } from './futurestaff-update.ts'

interface PreparedUpdate { version: string; sha256: string; folder: string }
const stateName = 'prepared-firstparty.json'
const folderPattern = /^futurestaff-update-[A-Za-z0-9]{6}$/

async function readState(directory: string): Promise<PreparedUpdate | undefined> {
  const path = join(directory, stateName)
  try {
    const info = await lstat(path)
    if (!info.isFile() || info.isSymbolicLink() || info.size > 4096) throw Error('UPDATE_CACHE_REJECTED')
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<PreparedUpdate>
    if (!value || typeof value.version !== 'string' || typeof value.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(value.sha256) || typeof value.folder !== 'string'
      || !folderPattern.test(value.folder)) throw Error('UPDATE_CACHE_REJECTED')
    return value as PreparedUpdate
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    throw cause
  }
}

async function confinedPath(directory: string, state: PreparedUpdate): Promise<string> {
  const folder = join(directory, state.folder)
  const path = join(folder, 'FutureStaff-Agent-Setup.exe')
  const rootInfo = await lstat(directory)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw Error('UPDATE_CACHE_REJECTED')
  const root = await realpath(directory)
  const folderInfo = await lstat(folder)
  const fileInfo = await lstat(path)
  if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink() || !fileInfo.isFile()
    || fileInfo.isSymbolicLink() || dirname(await realpath(folder)) !== root
    || dirname(await realpath(path)) !== await realpath(folder)) throw Error('UPDATE_CACHE_REJECTED')
  return path
}

async function removePrepared(directory: string, state: PreparedUpdate): Promise<void> {
  const path = await confinedPath(directory, state)
  await rm(path)
  await rmdir(dirname(path))
}

export async function prepareFutureStaffUpdate(release: FutureStaffRelease, trust: FutureStaffManifestTrust,
  directory: string, request: UpdateRequest, signal: AbortSignal): Promise<string> {
  validateManifestTrust(trust)
  signal.throwIfAborted()
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const info = await lstat(directory)
  if (!info.isDirectory() || info.isSymbolicLink()) throw Error('UPDATE_CACHE_REJECTED')
  let previous = await readState(directory)
  if (previous?.version === release.version && previous.sha256 === release.installer.sha256) {
    try {
      const path = await confinedPath(directory, previous)
      await verifyFutureStaffInstallerBytes(path, release.installer)
      signal.throwIfAborted()
      return path
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT'
        && (cause as Error).message !== 'UPDATE_HASH_REJECTED'
        && (cause as Error).message !== 'UPDATE_SIZE_REJECTED') throw cause
      if ((cause as NodeJS.ErrnoException).code !== 'ENOENT') await removePrepared(directory, previous)
      await rm(join(directory, stateName))
      previous = undefined
    }
  }
  let prepared: string | undefined
  await withFutureStaffDownload(release, trust, directory, request, signal, async path => {
    const state = { version: release.version, sha256: release.installer.sha256, folder: basename(dirname(path)) }
    if (!folderPattern.test(state.folder)) throw Error('UPDATE_CACHE_REJECTED')
    await confinedPath(directory, state)
    if (previous) await removePrepared(directory, previous)
    await writeFileAtomic(join(directory, stateName), JSON.stringify(state), { mode: 0o600, dirMode: 0o700 })
    prepared = path
    return true
  })
  if (!prepared) throw Error('UPDATE_CACHE_REJECTED')
  return prepared
}

/** Repeat path confinement and byte validation after interactive confirmation. */
export async function verifyPreparedFutureStaffUpdate(directory: string, path: string,
  release: FutureStaffRelease): Promise<void> {
  const state = await readState(directory)
  if (!state || state.version !== release.version || state.sha256 !== release.installer.sha256
    || await confinedPath(directory, state) !== path) throw Error('UPDATE_CACHE_REJECTED')
  await verifyFutureStaffInstallerBytes(path, release.installer)
}

/** Delete only a generated cached EXE after the installed version catches up. */
export async function cleanupPreparedFutureStaffUpdate(directory: string, currentVersion: string): Promise<void> {
  const state = await readState(directory)
  if (!state) return
  const comparison = compareSemVerVersions(currentVersion, state.version)
  if (comparison === null || comparison < 0) return
  await removePrepared(directory, state)
  await rm(join(directory, stateName))
}
