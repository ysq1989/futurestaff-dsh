/** Publish verified immutable artifacts, switching the feed only after both are present. */
import { createHash } from 'node:crypto'
import { createReadStream, constants } from 'node:fs'
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { basename, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { parseSignedRelease } from '../desktop-shell/dsh-plugin-desktop/src/futurestaff-update.ts'

async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

/** Trust is supplied independently by the operator, never adopted from the bundle. */
export async function publishDesktopUpdate(bundle, trust, webroot) {
  if (!isAbsolute(bundle) || !isAbsolute(webroot)) throw new Error('Bundle and webroot paths must be absolute')
  const body = await readFile(join(bundle, 'release.json'), 'utf8')
  const manifestDigest = createHash('sha256').update(body).digest('hex')
  if ((await readFile(join(bundle, 'READY'), 'utf8')).trim() !== manifestDigest) throw new Error('Incomplete or altered update bundle')
  const release = parseSignedRelease(body, trust)
  const artifacts = [release.installer, release.rollback]
  for (const artifact of artifacts) {
    if (new URL('.', artifact.url).href !== new URL('.', trust.manifestUrl).href) throw new Error('Artifact URL is outside the publication directory')
    const source = join(bundle, basename(new URL(artifact.url).pathname))
    if ((await stat(source)).size !== artifact.size || await digest(source) !== artifact.sha256)
      throw new Error('Publication artifact hash mismatch')
  }
  await mkdir(webroot, { recursive: true })
  const lock = join(webroot, '.futurestaff-publish-lock')
  await mkdir(lock) // atomic cross-process single publisher; stale locks require operator inspection
  const temporaryFeed = join(webroot, `.feed-${randomUUID()}.tmp`)
  try {
    const feed = join(webroot, basename(new URL(trust.manifestUrl).pathname))
    try {
      const current = parseSignedRelease(await readFile(feed, 'utf8'), trust)
      const { compareSemVerVersions } = await import('../desktop-shell/dsh-plugin-desktop/src/update-checker.ts')
      if (compareSemVerVersions(current.version, release.version) >= 0) throw new Error('Feed cannot overwrite or downgrade an existing release')
    } catch (cause) { if (cause.code !== 'ENOENT') throw cause }
    for (const artifact of artifacts) {
      const name = basename(new URL(artifact.url).pathname)
      const target = join(webroot, name)
      const temporary = join(webroot, `.artifact-${randomUUID()}.tmp`)
      try {
        await copyFile(join(bundle, name), temporary, constants.COPYFILE_EXCL)
        if (await digest(temporary) !== artifact.sha256) throw new Error('Artifact changed during publication')
        // Copy-once preserves published artifact names. Existing identical rollback bytes can be reused.
        try { await copyFile(temporary, target, constants.COPYFILE_EXCL) }
        catch (cause) { if (cause.code !== 'EEXIST' || await digest(target) !== artifact.sha256) throw cause }
      } finally { await rm(temporary, { force: true }) }
    }
    await writeFile(temporaryFeed, body, { flag: 'wx' })
    await rename(temporaryFeed, feed)
    return { version: release.version, manifestUrl: trust.manifestUrl, manifestDigest }
  } finally {
    await rm(temporaryFeed, { force: true })
    await (await import('node:fs/promises')).rmdir(lock)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [bundle, trustFile, webroot] = process.argv.slice(2)
  if (!bundle || !trustFile || !webroot) { console.error('Usage: node scripts/publish-desktop-update.mjs <bundle-dir> <operator-trust.json> <webroot>'); process.exitCode = 1 }
  else publishDesktopUpdate(resolve(bundle), JSON.parse(await readFile(trustFile, 'utf8')), resolve(webroot))
    .then(result => console.log(`Published verified update ${result.version}: ${result.manifestUrl}`))
    .catch(() => { console.error('Update publication failed; inspect the local bundle and publication lock.'); process.exitCode = 1 })
}
