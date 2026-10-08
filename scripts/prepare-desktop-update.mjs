/** Prepare an immutable, public-only update bundle from two verified signed installers. */
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { createReadStream, constants } from 'node:fs'
import { copyFile, mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSignedRelease, validateManifestTrust, validateUpdateTrust, verifyWindowsUpdate } from '../desktop-shell/dsh-plugin-desktop/src/futurestaff-update.ts'

const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function assertExternalSigningKey(path) {
  if (!isAbsolute(path)) throw new Error('Signing key path must be absolute')
  const rel = relative(repository, resolve(path))
  if (rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel))) throw new Error('Manifest private keys must be stored outside the repository')
}

async function digest(path) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(path)) hash.update(chunk)
  return hash.digest('hex')
}

async function inspect(path, version, origin, signerThumbprint, verifySignature) {
  if (!isAbsolute(path) || !basename(path).endsWith('.exe')) throw new Error('Installer must be an absolute EXE file path')
  const info = await stat(path)
  if (!info.isFile() || info.size < 1 || info.size > 1024 ** 3) throw new Error('Installer size rejected')
  if (verifySignature) await verifySignature(path, signerThumbprint)
  return { url: new URL(`FutureStaff-Agent-${version}-x64-Setup.exe`, origin).href,
    size: info.size, sha256: await digest(path) }
}

/** Private keys are passed only as a local file path; never copied into the bundle. */
export async function prepareDesktopUpdate(config, options = {}) {
  const trust = { manifestUrl: config.manifestUrl, publicKey: config.publicKey, signerThumbprint: config.signerThumbprint }
  const delivery = config.delivery ?? 'signed-install'
  if (!['manual-download', 'signed-install', 'confirmed-install'].includes(delivery)) throw new Error('Invalid update delivery mode')
  if (delivery === 'signed-install') validateUpdateTrust(trust)
  else validateManifestTrust(trust)
  assertExternalSigningKey(config.privateKeyPath)
  const base = new URL('.', config.manifestUrl)
  const verifySignature = delivery === 'signed-install' ? (options.verifySignature ?? verifyWindowsUpdate) : undefined
  const keyPath = await realpath(config.privateKeyPath)
  assertExternalSigningKey(keyPath)
  const privateKey = createPrivateKey(await readFile(keyPath))
  if (privateKey.asymmetricKeyType !== 'ed25519' || !createPublicKey(privateKey).equals(createPublicKey(trust.publicKey)))
    throw new Error('Manifest signing key does not match the pinned public key')
  // Validate versions and metadata before deriving artifact names or copying any files.
  const placeholder = { url: new URL('validation.exe', base).href, sha256: '0'.repeat(64), size: 1 }
  const payloadFor = (installer, rollback) => JSON.stringify({ schemaVersion: 1, productId: 'net.fsstory.agent.desktop',
    platform: 'win32', arch: 'x64', version: config.version, notes: config.notes,
    installer, rollback: { ...rollback, version: config.rollbackVersion } })
  const envelopeFor = payload => JSON.stringify({ payload, signature: sign(null, Buffer.from(payload), privateKey).toString('base64') })
  parseSignedRelease(envelopeFor(payloadFor(placeholder, placeholder)), trust)
  const installer = await inspect(config.installerPath, config.version, base, trust.signerThumbprint, verifySignature)
  const rollback = await inspect(config.rollbackPath, config.rollbackVersion, base, trust.signerThumbprint, verifySignature)
  const envelope = envelopeFor(payloadFor(installer, rollback))
  parseSignedRelease(envelope, trust)
  const output = resolve(config.outputDirectory)
  if (!isAbsolute(config.outputDirectory)) throw new Error('Output directory must be absolute')
  await mkdir(output, { recursive: false }) // refuses to overwrite any prior release directory
  try {
    for (const [source, artifact] of [[config.installerPath, installer], [config.rollbackPath, rollback]]) {
      const target = join(output, basename(new URL(artifact.url).pathname))
      await copyFile(source, target, constants.COPYFILE_EXCL)
      if (await digest(target) !== artifact.sha256) throw new Error('Installer changed during bundle export')
      if (verifySignature) await verifySignature(target, trust.signerThumbprint)
    }
    await writeFile(join(output, 'release.json'), `${envelope}\n`, { flag: 'wx' })
    await writeFile(join(output, 'trust.json'), `${JSON.stringify(trust, null, 2)}\n`, { flag: 'wx' })
    await writeFile(join(output, 'SHA256SUMS'), `${installer.sha256}  ${basename(new URL(installer.url).pathname)}\n${rollback.sha256}  ${basename(new URL(rollback.url).pathname)}\n`, { flag: 'wx' })
    // Written last: publishers must reject bundles without this marker.
    await writeFile(join(output, 'READY'), `${createHash('sha256').update(`${envelope}\n`).digest('hex')}\n`, { flag: 'wx' })
    return { output, version: config.version, manifestSha256: await digest(join(output, 'release.json')) }
  } catch { throw new Error('Update bundle is incomplete and must not be published (READY marker absent)') }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv[2]
  if (!path) { console.error('Usage: node scripts/prepare-desktop-update.mjs <local-release-config.json>'); process.exitCode = 1 }
  else prepareDesktopUpdate(JSON.parse(await readFile(path, 'utf8')))
    .then(result => console.log(`Verified signed update bundle: ${result.output}`))
    .catch(() => { console.error('Update bundle rejected. Check local trust configuration and both signed installers.'); process.exitCode = 1 })
}
