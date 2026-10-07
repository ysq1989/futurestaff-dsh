/** Initialize the free manifest-signing key outside source control, without overwriting it. */
import { generateKeyPairSync } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertExternalSigningKey } from './prepare-desktop-update.mjs'

export async function initializeDesktopUpdateKey(directory) {
  assertExternalSigningKey(join(directory, 'manifest.pem'))
  assertExternalSigningKey(join(await realpath(dirname(directory)), 'manifest.pem'))
  await mkdir(directory, { mode: 0o700 })
  if (process.platform === 'win32') {
    const sid = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      '[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], { encoding: 'utf8', windowsHide: true }).trim()
    if (!/^S-1-[0-9-]+$/.test(sid)) throw new Error('Cannot determine release-key owner')
    execFileSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F'], { stdio: 'pipe', windowsHide: true })
  }
  const keys = generateKeyPairSync('ed25519')
  const privateKeyPath = join(directory, 'manifest.pem')
  const publicKeyPath = join(directory, 'manifest-public.pem')
  await writeFile(privateKeyPath, keys.privateKey.export({ type: 'pkcs8', format: 'pem' }), { flag: 'wx', mode: 0o600 })
  await writeFile(publicKeyPath, keys.publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx', mode: 0o600 })
  return { privateKeyPath, publicKeyPath }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const directory = process.argv[2]
  if (!directory) { console.error('Usage: node scripts/initialize-desktop-update-key.mjs <new-directory-outside-repository>'); process.exitCode = 1 }
  else initializeDesktopUpdateKey(directory).then(result => console.log(`Created update verification key: ${result.publicKeyPath}`))
    .catch(() => { console.error('Key initialization failed. Existing key directories are never overwritten.'); process.exitCode = 1 })
}
