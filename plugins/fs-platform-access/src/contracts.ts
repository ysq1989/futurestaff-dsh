export const PLATFORM_CONTRACT_VERSION = '0.1.0' as const
export const PLATFORM_CLIENT_ID = 'futurestaff-agent-pc-dev' as const
export const PLATFORM_MOCK_BASE_URL = 'http://127.0.0.1:43821' as const

export interface ContractMeta {
  readonly contractVersion: typeof PLATFORM_CONTRACT_VERSION
  readonly simulated: true
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

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key]
  if (typeof value !== 'string' || value.length === 0) throw new Error(`invalid ${key}`)
  return value
}

export function assertMeta(value: unknown): ContractMeta {
  if (!isRecord(value)
    || value.contractVersion !== PLATFORM_CONTRACT_VERSION
    || value.simulated !== true) {
    throw new Error('response is not simulated contract v0.1.0 data')
  }
  return value as unknown as ContractMeta
}

export function assertSession(value: unknown): DesktopSession {
  if (!isRecord(value)) throw new Error('invalid session')
  const session: DesktopSession = {
    accessToken: requireString(value, 'accessToken'),
    refreshToken: requireString(value, 'refreshToken'),
    tokenType: value.tokenType === 'Bearer' ? 'Bearer' : (() => { throw new Error('invalid tokenType') })(),
    expiresIn: typeof value.expiresIn === 'number' ? value.expiresIn : (() => { throw new Error('invalid expiresIn') })(),
    audience: value.audience === PLATFORM_CLIENT_ID ? PLATFORM_CLIENT_ID : (() => { throw new Error('invalid audience') })(),
    activeTenantId: requireString(value, 'activeTenantId'),
  }
  return Object.freeze(session)
}
