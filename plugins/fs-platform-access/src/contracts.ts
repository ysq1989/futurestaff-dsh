export const PLATFORM_MOCK_CONTRACT_VERSION = '0.1.0' as const
export const PLATFORM_DEV_CONTRACT_VERSION = '0.1.1' as const
export const PLATFORM_CONTRACT_VERSION = PLATFORM_MOCK_CONTRACT_VERSION
export const PLATFORM_CLIENT_ID = 'futurestaff-agent-pc-dev' as const
export const PLATFORM_MOCK_BASE_URL = 'http://127.0.0.1:43821' as const
export const PLATFORM_DEV_BASE_URL = 'https://dev.fsstory.net' as const

export interface ContractMeta {
  readonly contractVersion: typeof PLATFORM_MOCK_CONTRACT_VERSION | typeof PLATFORM_DEV_CONTRACT_VERSION
  readonly simulated: boolean
  readonly requestId?: string
}

export interface DesktopSession {
  readonly accessToken: string
  readonly refreshToken: string
  readonly tokenType: 'Bearer'
  readonly expiresIn: number
  readonly audience: typeof PLATFORM_CLIENT_ID
  readonly activeTenantId: string
}

export interface User {
  readonly userId: string
  readonly displayName: string
  readonly email?: string | null
}

export type TenantRole = 'member' | 'agent_admin' | 'org_admin' | 'platform_admin'

export interface Tenant {
  readonly tenantId: string
  readonly displayName: string
  readonly slug: string
  readonly logoUrl?: string | null
  readonly role: TenantRole
}

export interface AuthorizedApplication {
  readonly appId: string
  readonly tenantId: string
  readonly displayName: string
  readonly baseUrl: string
  readonly deepLinks: Readonly<Record<string, string>>
  readonly capabilities: readonly string[]
  readonly contractRange: string
}

export interface AuthResult {
  readonly session: DesktopSession
  readonly user: User
  readonly meta: ContractMeta
}

export interface RefreshResult {
  readonly session: DesktopSession
  readonly meta: ContractMeta
}

export interface TenantList {
  readonly activeTenantId: string
  readonly items: readonly Tenant[]
  readonly meta: ContractMeta
}

export interface TenantSwitchResult {
  readonly tenant: Tenant
  readonly session: DesktopSession
  readonly meta: ContractMeta
}

export interface ApplicationList {
  readonly activeTenantId: string
  readonly items: readonly AuthorizedApplication[]
  readonly meta: ContractMeta
}

export interface ApplicationTokenResult {
  readonly accessToken: string
  readonly tokenType: 'Bearer'
  readonly expiresIn: 60
  readonly audience: string
  readonly tenantId: string
  readonly permissions: readonly string[]
  readonly meta: ContractMeta
}

export type PlatformErrorCode =
  | 'INVALID_REQUEST'
  | 'AUTHENTICATION_REQUIRED'
  | 'TENANT_MEMBERSHIP_REQUIRED'
  | 'TENANT_ACCESS_DENIED'
  | 'APPLICATION_ACCESS_DENIED'
  | 'TOKEN_AUDIENCE_INVALID'
  | 'TOKEN_EXPIRED'
  | 'NOT_FOUND'
  | 'MOCK_UNAVAILABLE'
  | 'PLATFORM_UNAVAILABLE'
  | 'CONTRACT_MISMATCH'

export interface PlatformFailure {
  readonly code: PlatformErrorCode
  readonly message: string
  readonly retryable: boolean
}

export interface AuthCallbackInput {
  readonly code: string
  readonly codeVerifier: string
  readonly redirectUri: string
  readonly state: string
}

export interface PasswordLoginInput {
  readonly loginIdentifier: string
  readonly password: string
  readonly tenantId?: string
}

export interface PlatformModel {
  readonly modelId: string
  readonly displayName: string
  readonly provider: string
  readonly model: string
  readonly supportsVision: boolean
  readonly isDefault: boolean
}

export interface ModelList {
  readonly activeTenantId: string
  readonly activeModelId: string | null
  readonly items: readonly PlatformModel[]
  readonly meta: ContractMeta
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function assertKeys(
  record: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
): void {
  const allowed = new Set([...required, ...optional])
  if (required.some(key => !(key in record)) || Object.keys(record).some(key => !allowed.has(key))) {
    throw new Error('invalid object fields')
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${key}`)
  return value
}

export function requireBoundedString(
  record: Record<string, unknown>,
  key: string,
  minimum: number,
  maximum: number,
): string {
  const value = requireString(record, key)
  if (value.length < minimum || value.length > maximum) throw new Error(`invalid ${key}`)
  return value
}

export function requireMinimumString(record: Record<string, unknown>, key: string, minimum: number): string {
  const value = requireString(record, key)
  if (value.length < minimum) throw new Error(`invalid ${key}`)
  return value
}

export function requireUuid(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key)
  if (!uuidPattern.test(value)) throw new Error(`invalid ${key}`)
  return value
}

export function requireHttpUrl(record: Record<string, unknown>, key: string): string {
  const value = requireString(record, key)
  let url: URL
  try { url = new URL(value) } catch { throw new Error(`invalid ${key}`) }
  if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username !== '' || url.password !== '') {
    throw new Error(`invalid ${key}`)
  }
  return value
}

export function assertMeta(
  value: unknown,
  contractVersion: ContractMeta['contractVersion'] = PLATFORM_MOCK_CONTRACT_VERSION,
  simulated = true,
): ContractMeta {
  if (!isRecord(value)
    || value.contractVersion !== contractVersion
    || value.simulated !== simulated) {
    throw new Error('response metadata does not match the selected platform contract')
  }
  assertKeys(value, ['contractVersion', 'simulated'], ['requestId'])
  if (value.requestId !== undefined && (typeof value.requestId !== 'string' || value.requestId.length === 0)) {
    throw new Error('invalid requestId')
  }
  return value as unknown as ContractMeta
}

export function assertSession(value: unknown): DesktopSession {
  if (!isRecord(value)) throw new Error('invalid session')
  assertKeys(value, ['accessToken', 'refreshToken', 'tokenType', 'expiresIn', 'audience', 'activeTenantId'])
  const session: DesktopSession = {
    accessToken: requireMinimumString(value, 'accessToken', 20),
    refreshToken: requireMinimumString(value, 'refreshToken', 20),
    tokenType: value.tokenType === 'Bearer' ? 'Bearer' : (() => { throw new Error('invalid tokenType') })(),
    expiresIn: Number.isInteger(value.expiresIn) && Number(value.expiresIn) >= 60 && Number(value.expiresIn) <= 3600
      ? Number(value.expiresIn)
      : (() => { throw new Error('invalid expiresIn') })(),
    audience: value.audience === PLATFORM_CLIENT_ID ? PLATFORM_CLIENT_ID : (() => { throw new Error('invalid audience') })(),
    activeTenantId: requireUuid(value, 'activeTenantId'),
  }
  return Object.freeze(session)
}
