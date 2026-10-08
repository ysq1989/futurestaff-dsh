import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import { signedBuilderConfig } from '../scripts/build-signed-desktop-installer.mjs'
import { assertExternalSigningKey, prepareDesktopUpdate } from '../scripts/prepare-desktop-update.mjs'
import { publishDesktopUpdate } from '../scripts/publish-desktop-update.mjs'
import { initializeDesktopUpdateKey } from '../scripts/initialize-desktop-update-key.mjs'
import { parseSignedRelease } from '../desktop-shell/dsh-plugin-desktop/src/futurestaff-update.ts'

const keys = generateKeyPairSync('ed25519')
const trust = { manifestUrl: 'https://dev.fsstory.net/desktop-updates/stable.json',
  publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(), signerThumbprint: 'A'.repeat(40) }
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'fs-release-test-'))
  const privateKeyPath = join(root, 'manifest.pem')
  await writeFile(privateKeyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 })
  const installerPath = join(root, 'current.exe'), rollbackPath = join(root, 'previous.exe')
  await writeFile(installerPath, 'current fixture'); await writeFile(rollbackPath, 'rollback fixture')
  const config = { ...trust, privateKeyPath, installerPath, rollbackPath, version: '2.0.11', rollbackVersion: '2.0.10',
    notes: '更新说明', outputDirectory: join(root, 'bundle') }
  return { root, config, webroot: join(root, 'webroot'), cleanup: () => rm(root, { recursive: true, force: true }) }
}
const verified = async () => {} // offline fixture: production defaults to actual Authenticode verification

test('manifest key initialization protects a fresh external directory and refuses overwrites', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fs-key-test-'))
  try {
    const directory = join(root, 'keys')
    const result = await initializeDesktopUpdateKey(directory)
    assert.match(await readFile(result.publicKeyPath, 'utf8'), /^-----BEGIN PUBLIC KEY-----/)
    await assert.rejects(initializeDesktopUpdateKey(directory), { code: 'EEXIST' })
    assert.equal((await readdir(directory)).length, 2)
  } finally { await rm(root, { recursive: true, force: true }) }
})

test('signed builder pins certificate, SHA256 and timestamp and forbids unsigned fallback', () => {
  const config = signedBuilderConfig({ appId: 'net.fsstory.agent.desktop', win: { icon: 'app.png' } }, trust.signerThumbprint, 'https://timestamp.example.test/')
  assert.equal(config.forceCodeSigning, true); assert.equal(config.win.signExecutable, true)
  assert.equal(config.win.signtoolOptions.certificateSha1, trust.signerThumbprint)
  assert.deepEqual(config.win.signtoolOptions.signingHashAlgorithms, ['sha256'])
  assert.throws(() => signedBuilderConfig({}, '', 'https://timestamp.example.test/'))
  assert.throws(() => signedBuilderConfig({}, trust.signerThumbprint, 'https://user:password@example.test/'))
  assert.throws(() => signedBuilderConfig({}, trust.signerThumbprint, 'https://example.test/?secret=1'))
})
test('manifest keys cannot live in the repository or use relative paths', () => {
  assert.throws(() => assertExternalSigningKey('manifest.pem'))
  assert.throws(() => assertExternalSigningKey(resolve('desktop/manifest.pem')))
  assert.throws(() => assertExternalSigningKey(resolve('..manifest.pem')))
})
test('prepares and publishes a signed bundle consumed by the actual desktop validator', async () => {
  const f = await fixture()
  try {
    let signatureChecks = 0
    await prepareDesktopUpdate(f.config, { verifySignature: async () => { signatureChecks++ } })
    assert.equal(signatureChecks, 4)
    assert.deepEqual((await readdir(f.config.outputDirectory)).sort(), ['FutureStaff-Agent-2.0.10-x64-Setup.exe', 'FutureStaff-Agent-2.0.11-x64-Setup.exe', 'READY', 'SHA256SUMS', 'release.json', 'trust.json'].sort())
    await publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot)
    const release = parseSignedRelease(await readFile(join(f.webroot, 'stable.json'), 'utf8'), trust)
    assert.equal(release.version, '2.0.11'); assert.equal(release.rollback.version, '2.0.10')
    assert.equal(await readFile(join(f.webroot, 'FutureStaff-Agent-2.0.11-x64-Setup.exe'), 'utf8'), 'current fixture')
    await assert.rejects(publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot), /overwrite or downgrade/)
    assert.equal(parseSignedRelease(await readFile(join(f.webroot, 'stable.json'), 'utf8'), trust).version, '2.0.11')
  } finally { await f.cleanup() }
})
test('invalid signer, rollback, or manifest key prevents bundle output', async () => {
  const f = await fixture()
  try {
    await assert.rejects(prepareDesktopUpdate(f.config, { verifySignature: async () => { throw new Error('invalid signer') } }), /invalid signer/)
    await assert.rejects(readFile(join(f.config.outputDirectory, 'READY')), { code: 'ENOENT' })
    await assert.rejects(prepareDesktopUpdate({ ...f.config, rollbackVersion: '9.0.0' }, { verifySignature: verified }))
    const other = generateKeyPairSync('ed25519').publicKey.export({ type: 'spki', format: 'pem' }).toString()
    await assert.rejects(prepareDesktopUpdate({ ...f.config, publicKey: other }, { verifySignature: verified }), /does not match/)
  } finally { await f.cleanup() }
})
for (const delivery of ['manual-download', 'confirmed-install']) {
test(`${delivery} publication supports unsigned EXEs but retains manifest signatures and exact hashes`, async () => {
  const f = await fixture()
  try {
    let certificateChecks = 0
    const manual = { ...f.config, delivery, signerThumbprint: '' }
    await prepareDesktopUpdate(manual, { verifySignature: async () => { certificateChecks++; throw new Error('No Windows certificate') } })
    assert.equal(certificateChecks, 0)
    const manualTrust = { manifestUrl: trust.manifestUrl, publicKey: trust.publicKey }
    await publishDesktopUpdate(manual.outputDirectory, manualTrust, f.webroot)
    assert.equal(parseSignedRelease(await readFile(join(f.webroot, 'stable.json'), 'utf8'), manualTrust).version, '2.0.11')
  } finally { await f.cleanup() }
})
}
test('tampered installers and incomplete bundles never change the live feed', async () => {
  const f = await fixture()
  try {
    await prepareDesktopUpdate(f.config, { verifySignature: verified })
    await writeFile(join(f.config.outputDirectory, 'FutureStaff-Agent-2.0.11-x64-Setup.exe'), 'tampered')
    await assert.rejects(publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot), /hash mismatch/)
    await assert.rejects(readFile(join(f.webroot, 'stable.json')), { code: 'ENOENT' })
    await writeFile(join(f.config.outputDirectory, 'READY'), 'bad digest')
    await assert.rejects(publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot), /Incomplete or altered/)
  } finally { await f.cleanup() }
})
test('publication lock and existing immutable artifact collisions prevent feed switching', async () => {
  const f = await fixture()
  try {
    await prepareDesktopUpdate(f.config, { verifySignature: verified })
    const { mkdir } = await import('node:fs/promises')
    await mkdir(f.webroot); await mkdir(join(f.webroot, '.futurestaff-publish-lock'))
    await assert.rejects(publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot), { code: 'EEXIST' })
    await (await import('node:fs/promises')).rmdir(join(f.webroot, '.futurestaff-publish-lock'))
    await writeFile(join(f.webroot, 'FutureStaff-Agent-2.0.11-x64-Setup.exe'), 'immutable previous bytes')
    await assert.rejects(publishDesktopUpdate(f.config.outputDirectory, trust, f.webroot))
    assert.equal(await readFile(join(f.webroot, 'FutureStaff-Agent-2.0.11-x64-Setup.exe'), 'utf8'), 'immutable previous bytes')
    await assert.rejects(readFile(join(f.webroot, 'stable.json')), { code: 'ENOENT' })
  } finally { await f.cleanup() }
})
