/** Signed Windows release path. The private Alpha packaging path remains unsigned. */
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { constants } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createWindowsPackageOptions, withoutWindowsSigningSecrets } from '../desktop-shell/dsh-plugin-desktop/scripts/package-win.ts'
import { verifyWindowsInstaller } from '../desktop-shell/dsh-plugin-desktop/scripts/verify-win-installer.ts'
import { verifyWindowsUpdate } from '../desktop-shell/dsh-plugin-desktop/src/futurestaff-update.ts'
import { createHash } from 'node:crypto'
import { stageDesktopRelease } from './stage-desktop-release.mjs'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

export function signedBuilderConfig(build, thumbprint, timestampUrl) {
  if (!/^[a-fA-F0-9]{40}$/.test(thumbprint)) throw new Error('A valid signing certificate thumbprint is required')
  const timestamp = new URL(timestampUrl)
  if (!['http:', 'https:'].includes(timestamp.protocol) || timestamp.username || timestamp.password || timestamp.hash || timestamp.search)
    throw new Error('A credential-free RFC3161 timestamp URL is required')
  if (build.win?.azureSignOptions) throw new Error('This signing path requires a pinned certificate store; cloud signing needs its own reviewed adapter')
  return { ...build, forceCodeSigning: true, npmRebuild: false,
    win: { ...build.win, signExecutable: true, signtoolOptions: {
      certificateSha1: thumbprint.toUpperCase(), signingHashAlgorithms: ['sha256'], rfc3161TimeStampServer: timestamp.href,
    } } }
}

export function assertWindowsSigningCertificate(thumbprint) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('Signing requires native Windows x64')
  if (!/^[a-fA-F0-9]{40}$/.test(thumbprint)) throw new Error('FUTURESTAFF_SIGNER_THUMBPRINT is required')
  // Inspect only public certificate metadata. The private key remains in its provider/store.
  const script = "$c = Get-ChildItem Cert:\\CurrentUser\\My,Cert:\\LocalMachine\\My | Where-Object { $_.Thumbprint -eq $env:FUTURESTAFF_RELEASE_SIGNER }; if (-not $c -or @($c).Count -ne 1 -or -not $c.HasPrivateKey -or $c.NotAfter -le (Get-Date) -or $c.NotBefore -gt (Get-Date) -or $c.EnhancedKeyUsageList.ObjectId -notcontains '1.3.6.1.5.5.7.3.3') { exit 1 }; $chain = New-Object System.Security.Cryptography.X509Certificates.X509Chain; if (-not $chain.Build($c)) { exit 1 }"
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true, timeout: 30_000, stdio: 'pipe', env: { ...process.env, FUTURESTAFF_RELEASE_SIGNER: thumbprint },
    })
  } catch { throw new Error('The pinned code-signing certificate is unavailable, expired, untrusted or has no private-key provider') }
}

export async function buildSignedDesktopInstaller() {
  const thumbprint = process.env.FUTURESTAFF_SIGNER_THUMBPRINT ?? ''
  const timestampUrl = process.env.FUTURESTAFF_TIMESTAMP_URL ?? ''
  const options = createWindowsPackageOptions()
  const manifest = JSON.parse(await readFile(join(options.desktopRoot, 'package.json'), 'utf8'))
  const builderConfig = signedBuilderConfig(manifest.build, thumbprint, timestampUrl)
  assertWindowsSigningCertificate(thumbprint)
  await stageDesktopRelease()
  const configDirectory = await mkdtemp(join(tmpdir(), 'futurestaff-signed-builder-'))
  const configPath = join(configDirectory, 'builder.json')
  await writeFile(configPath, JSON.stringify(builderConfig), { flag: 'wx' })
  const env = { ...withoutWindowsSigningSecrets(options.env), CSC_IDENTITY_AUTO_DISCOVERY: 'true' }
  options.run(options.commandShell, ['/d', '/s', '/c', 'corepack yarn workspace dsh-plugin-desktop check:win-package'], options.workspaceRoot, env)
  options.run(options.nodeExecutable, [options.builderCli, '--win', 'nsis', '--x64', '--publish', 'never', '--config', configPath], options.desktopRoot, env)
  const artifacts = verifyWindowsInstaller()
  await verifyWindowsUpdate(artifacts.applicationPath, thumbprint)
  await verifyWindowsUpdate(artifacts.installerPath, thumbprint)
  const directory = join(root, 'outputs', 'signed')
  await mkdir(directory, { recursive: true })
  const target = join(directory, `FutureStaff-Agent-${manifest.version}-x64-Setup.exe`)
  await copyFile(artifacts.installerPath, target, constants.COPYFILE_EXCL)
  const hash = createHash('sha256').update(await readFile(target)).digest('hex')
  await writeFile(`${target}.sha256`, `${hash}\n`, { flag: 'wx' })
  console.log(`Signed installer verified and exported: ${target}`)
  return { target, sha256: hash }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildSignedDesktopInstaller().catch(() => { console.error('Signed release failed. Check the certificate, timestamp configuration and release gates; no unsigned fallback is allowed.'); process.exitCode = 1 })
}
