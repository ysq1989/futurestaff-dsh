import {
  assertKeys,
  assertSession,
  isRecord,
  PLATFORM_DEV_CONTRACT_VERSION,
  requireBoundedString,
  requireUuid,
  type DesktopSession,
  type User,
} from './contracts.js'

const SESSION_KEY = 'futurestaff.platform.session.v1'
const STATE_VERSION = 1

export interface PlatformProtectedSecrets {
  available(): Promise<boolean>
  has(key: string): Promise<boolean>
  read(key: string): Promise<string | undefined>
  write(key: string, secret: string): Promise<void>
  delete(key: string): Promise<void>
}

export interface StoredPlatformSession {
  readonly session: DesktopSession
  readonly user: User
}

export type PlatformSessionVaultErrorCode = 'protection-unavailable' | 'invalid-state' | 'storage-failure'

export class PlatformSessionVaultError extends Error {
  constructor(readonly code: PlatformSessionVaultErrorCode, message: string) {
    super(message)
    this.name = 'PlatformSessionVaultError'
  }
}

function vaultError(code: PlatformSessionVaultErrorCode, message: string): PlatformSessionVaultError {
  return new PlatformSessionVaultError(code, message)
}

function user(value: unknown): User {
  if (!isRecord(value)) throw vaultError('invalid-state', '受保护的平台会话状态无效。')
  try {
    assertKeys(value, ['userId', 'displayName'], ['email'])
    const email = value.email
    if (email !== undefined && email !== null
      && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/u.test(email))) throw new Error('invalid email')
    return Object.freeze({
      userId: requireUuid(value, 'userId'),
      displayName: requireBoundedString(value, 'displayName', 1, 100),
      email: typeof email === 'string' || email === null ? email : null,
    })
  } catch {
    throw vaultError('invalid-state', '受保护的平台会话状态无效。')
  }
}

function decode(value: unknown): StoredPlatformSession {
  if (!isRecord(value)) throw vaultError('invalid-state', '受保护的平台会话状态无效。')
  try {
    assertKeys(value, ['version', 'contractVersion', 'session', 'user'])
    if (value.version !== STATE_VERSION || value.contractVersion !== PLATFORM_DEV_CONTRACT_VERSION) {
      throw new Error('invalid version')
    }
    return Object.freeze({ session: assertSession(value.session), user: user(value.user) })
  } catch (cause) {
    if (cause instanceof PlatformSessionVaultError) throw cause
    throw vaultError('invalid-state', '受保护的平台会话状态无效。')
  }
}

export class PlatformSessionVault {
  constructor(private readonly secrets: PlatformProtectedSecrets) {}

  async load(): Promise<StoredPlatformSession | undefined> {
    await this.requireProtection()
    let serialized: string | undefined
    try { serialized = await this.secrets.read(SESSION_KEY) } catch {
      throw vaultError('storage-failure', '无法读取受保护的平台会话。')
    }
    if (serialized === undefined) return undefined
    let value: unknown
    try { value = JSON.parse(serialized) as unknown } catch {
      throw vaultError('invalid-state', '受保护的平台会话状态无效。')
    }
    return decode(value)
  }

  async save(value: StoredPlatformSession): Promise<void> {
    await this.requireProtection()
    if (!isRecord(value)) throw vaultError('invalid-state', '受保护的平台会话状态无效。')
    const validated = decode({
      version: STATE_VERSION,
      contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
      session: value.session,
      user: value.user,
    })
    const serialized = JSON.stringify({
      version: STATE_VERSION,
      contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
      session: validated.session,
      user: validated.user,
    })
    try { await this.secrets.write(SESSION_KEY, serialized) } catch {
      throw vaultError('storage-failure', '无法保存受保护的平台会话。')
    }
  }

  async clear(): Promise<void> {
    try { await this.secrets.delete(SESSION_KEY) } catch {
      throw vaultError('storage-failure', '无法清除受保护的平台会话。')
    }
  }

  async diagnostics(): Promise<{ readonly available: boolean; readonly state: 'stored' | 'empty' | 'unavailable' }> {
    let available = false
    try { available = await this.secrets.available() } catch { /* normalized as unavailable */ }
    if (!available) return Object.freeze({ available: false, state: 'unavailable' })
    try {
      return Object.freeze({ available: true, state: await this.secrets.has(SESSION_KEY) ? 'stored' : 'empty' })
    } catch {
      throw vaultError('storage-failure', '无法检查受保护的平台会话。')
    }
  }

  private async requireProtection(): Promise<void> {
    let available = false
    try { available = await this.secrets.available() } catch { /* normalized below */ }
    if (!available) throw vaultError('protection-unavailable', '操作系统凭据保护不可用。')
  }
}

export const platformSessionVaultConstants = Object.freeze({ sessionKey: SESSION_KEY, stateVersion: STATE_VERSION })
