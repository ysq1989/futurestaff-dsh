/** FutureStaff-owned, signed Windows release contract. No upstream update endpoints. */
import { createHash, createPublicKey, verify } from 'node:crypto'
import { execFile } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { compareSemVerVersions, parseSemVer, type UpdateRequest } from './update-checker.ts'

export interface FutureStaffManifestTrust {
  readonly manifestUrl: string
  /** Ed25519 SPKI PEM pinned by the release operator, never supplied by the feed. */
  readonly publicKey: string
}

export interface FutureStaffUpdateTrust extends FutureStaffManifestTrust {
  readonly signerThumbprint: string
}

export interface FutureStaffArtifact {
  readonly url: string
  readonly sha256: string
  readonly size: number
}

export interface FutureStaffRelease {
  readonly schemaVersion: 1
  readonly productId: 'net.fsstory.agent.desktop'
  readonly platform: 'win32'
  readonly arch: 'x64'
  readonly version: string
  readonly notes: string
  readonly installer: FutureStaffArtifact
  readonly rollback: FutureStaffArtifact & { readonly version: string }
}

const MAX_MANIFEST_BYTES = 32 * 1024
const MAX_INSTALLER_BYTES = 1024 * 1024 * 1024

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Fixed HTTPS origin scope also applies to installers and rollback references. */
export function trustedUpdateUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search
    || (url.port && url.port !== '443')
    || !(url.hostname === 'fsstory.net' || url.hostname.endsWith('.fsstory.net'))) {
    throw new Error('UPDATE_SOURCE_REJECTED')
  }
  return url.href
}

export function validateManifestTrust(trust: FutureStaffManifestTrust): void {
  trustedUpdateUrl(trust.manifestUrl)
  if (createPublicKey(trust.publicKey).asymmetricKeyType !== 'ed25519') throw new Error('UPDATE_TRUST_REJECTED')
}

export function validateUpdateTrust(trust: FutureStaffUpdateTrust): void {
  validateManifestTrust(trust)
  if (!/^[A-Fa-f0-9]{40}$/.test(trust.signerThumbprint)) throw new Error('UPDATE_TRUST_REJECTED')
}

function artifact(value: unknown, origin: string): FutureStaffArtifact {
  if (!record(value) || typeof value.url !== 'string' || typeof value.sha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(value.sha256) || typeof value.size !== 'number'
    || !Number.isSafeInteger(value.size) || value.size < 1 || value.size > MAX_INSTALLER_BYTES
    || new URL(trustedUpdateUrl(value.url)).origin !== origin
    || !new URL(value.url).pathname.endsWith('.exe')) throw new Error('UPDATE_ARTIFACT_REJECTED')
  return { url: value.url, sha256: value.sha256, size: value.size }
}

/** Envelope signature covers the exact UTF-8 payload string, avoiding JSON canonicalization. */
export function parseSignedRelease(text: string, trust: FutureStaffManifestTrust): FutureStaffRelease {
  validateManifestTrust(trust)
  if (Buffer.byteLength(text) > MAX_MANIFEST_BYTES) throw new Error('UPDATE_MANIFEST_TOO_LARGE')
  const envelope: unknown = JSON.parse(text)
  if (!record(envelope) || typeof envelope.payload !== 'string' || typeof envelope.signature !== 'string'
    || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)
    || !verify(null, Buffer.from(envelope.payload, 'utf8'), trust.publicKey, Buffer.from(envelope.signature, 'base64'))) {
    throw new Error('UPDATE_SIGNATURE_REJECTED')
  }
  const release: unknown = JSON.parse(envelope.payload)
  if (!record(release) || release.schemaVersion !== 1 || release.productId !== 'net.fsstory.agent.desktop'
    || release.platform !== 'win32' || release.arch !== 'x64' || typeof release.version !== 'string'
    || !parseSemVer(release.version) || parseSemVer(release.version)!.prerelease.length !== 0
    || typeof release.notes !== 'string' || release.notes.length > 4000
    || !record(release.rollback) || typeof release.rollback.version !== 'string'
    || !parseSemVer(release.rollback.version)
    || compareSemVerVersions(release.rollback.version, release.version)! >= 0) throw new Error('UPDATE_MANIFEST_REJECTED')
  const origin = new URL(trust.manifestUrl).origin
  return {
    schemaVersion: 1, productId: 'net.fsstory.agent.desktop', platform: 'win32', arch: 'x64',
    version: parseSemVer(release.version)!.version, notes: release.notes,
    installer: artifact(release.installer, origin),
    rollback: { ...artifact(release.rollback, origin), version: release.rollback.version },
  }
}

async function response(request: UpdateRequest, url: string, signal: AbortSignal): Promise<Response> {
  const result = await request(url, { method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store', signal })
  if (result.status !== 200 || result.body === null || result.redirected) throw new Error('UPDATE_REQUEST_FAILED')
  return result
}

export async function checkFutureStaffUpdate(
  trust: FutureStaffManifestTrust, request: UpdateRequest, signal: AbortSignal,
): Promise<FutureStaffRelease> {
  validateManifestTrust(trust)
  const result = await response(request, trust.manifestUrl, signal)
  const reader = result.body!.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      signal.throwIfAborted()
      const part = await reader.read()
      if (part.done) break
      size += part.value.byteLength
      if (size > MAX_MANIFEST_BYTES) throw new Error('UPDATE_MANIFEST_TOO_LARGE')
      chunks.push(part.value)
    }
    return parseSignedRelease(Buffer.concat(chunks).toString('utf8'), trust)
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
}

/** Authenticode validation executes a fixed script; paths and pins travel as environment data. */
export async function verifyWindowsUpdate(path: string, thumbprint: string): Promise<void> {
  if (process.platform !== 'win32' || !/^[A-Fa-f0-9]{40}$/.test(thumbprint)) throw new Error('UPDATE_SIGNER_REJECTED')
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    "$s = Get-AuthenticodeSignature -LiteralPath $env:FUTURESTAFF_UPDATE_PATH; if ($s.Status -ne 'Valid' -or $s.SignerCertificate.Thumbprint -ne $env:FUTURESTAFF_UPDATE_SIGNER) { exit 1 }"],
  { windowsHide: true, timeout: 30_000, env: { ...process.env, FUTURESTAFF_UPDATE_PATH: path, FUTURESTAFF_UPDATE_SIGNER: thumbprint } })
}

/** Verify exact installer bytes against signed release metadata. */
export async function verifyFutureStaffInstallerBytes(path: string, artifact: FutureStaffArtifact): Promise<void> {
  const digest = createHash('sha256')
  let size = 0
  for await (const chunk of createReadStream(path)) {
    size += chunk.length
    if (size > artifact.size) throw new Error('UPDATE_SIZE_REJECTED')
    digest.update(chunk)
  }
  if (size !== artifact.size || digest.digest('hex') !== artifact.sha256) throw new Error('UPDATE_HASH_REJECTED')
}

/** Authenticode-required delivery retains its independent publisher boundary. */
export async function verifyFutureStaffInstaller(path: string, artifact: FutureStaffArtifact, thumbprint: string): Promise<void> {
  await verifyFutureStaffInstallerBytes(path, artifact)
  await verifyWindowsUpdate(path, thumbprint)
}

/** Installation remains a separate boundary with mandatory publisher verification. */
export async function withFutureStaffInstaller(
  release: FutureStaffRelease, trust: FutureStaffUpdateTrust, directory: string,
  request: UpdateRequest, signal: AbortSignal, consume: (path: string) => Promise<boolean>,
  verifySignature: (path: string, thumbprint: string) => Promise<void> = verifyWindowsUpdate,
): Promise<void> {
  validateUpdateTrust(trust)
  await withFutureStaffDownload(release, trust, directory, request, signal, async path => {
    await verifySignature(path, trust.signerThumbprint)
    signal.throwIfAborted()
    return consume(path)
  })
}

/** Verify bytes in a private directory. This helper neither opens nor executes the EXE. */
export async function withFutureStaffDownload(
  release: FutureStaffRelease, trust: FutureStaffManifestTrust, directory: string,
  request: UpdateRequest, signal: AbortSignal, retain: (path: string) => Promise<boolean>,
): Promise<void> {
  validateManifestTrust(trust)
  const selected = artifact(release.installer, new URL(trust.manifestUrl).origin)
  const temporary = await mkdtemp(join(directory, 'futurestaff-update-'))
  const path = join(temporary, 'FutureStaff-Agent-Setup.exe')
  let retained = false
  try {
    const result = await response(request, selected.url, signal)
    const reader = result.body!.getReader()
    const file = await open(path, 'wx', 0o600)
    const digest = createHash('sha256')
    let size = 0
    try {
      while (true) {
        signal.throwIfAborted()
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > selected.size) throw new Error('UPDATE_SIZE_REJECTED')
        digest.update(part.value)
        await file.writeFile(part.value)
      }
      await file.sync()
    } finally {
      await file.close(); await reader.cancel().catch(() => {}); reader.releaseLock()
    }
    if (size !== selected.size || digest.digest('hex') !== selected.sha256) throw new Error('UPDATE_HASH_REJECTED')
    signal.throwIfAborted()
    retained = await retain(path)
  } finally { if (!retained) await rm(temporary, { recursive: true, force: true }) }
}
