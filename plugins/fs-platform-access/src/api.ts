import {
  assertMeta,
  assertSession,
  assertKeys,
  isRecord,
  PLATFORM_CLIENT_ID,
  PLATFORM_CONTRACT_VERSION,
  PLATFORM_MOCK_BASE_URL,
  requireBoundedString,
  requireHttpUrl,
  requireString,
  requireUuid,
  type ApplicationList,
  type AuthCallbackInput,
  type AuthResult,
  type AuthorizedApplication,
  type PlatformErrorCode,
  type RefreshResult,
  type Tenant,
  type TenantList,
  type TenantRole,
  type TenantSwitchResult,
  type User,
} from './contracts.js'

type Fetch = (input: string | URL | Request, init?: RequestInit) => Promise<Response>

const roles: readonly TenantRole[] = ['member', 'agent_admin', 'org_admin', 'platform_admin']
const serverErrorCodes: readonly PlatformErrorCode[] = [
  'INVALID_REQUEST', 'AUTHENTICATION_REQUIRED', 'TENANT_MEMBERSHIP_REQUIRED',
  'TENANT_ACCESS_DENIED', 'APPLICATION_ACCESS_DENIED', 'TOKEN_AUDIENCE_INVALID',
  'TOKEN_EXPIRED', 'NOT_FOUND',
]
const slugPattern = /^[a-z0-9][a-z0-9-]{1,62}$/
const appIdPattern = /^[a-z][a-z0-9_]{1,63}$/
const capabilityPattern = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/

export class PlatformApiError extends Error {
  constructor(
    readonly code: PlatformErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'PlatformApiError'
  }
}

function assertLoopbackMockBaseUrl(raw: string): string {
  const url = new URL(raw)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port !== '43821' || url.pathname !== '/') {
    throw new Error('B01a accepts only http://127.0.0.1:43821')
  }
  return url.origin
}

function tenant(value: unknown): Tenant {
  if (!isRecord(value)) throw new Error('invalid tenant')
  assertKeys(value, ['tenantId', 'displayName', 'slug', 'role'], ['logoUrl'])
  const role = requireString(value, 'role') as TenantRole
  if (!roles.includes(role)) throw new Error('invalid tenant role')
  const slug = requireBoundedString(value, 'slug', 2, 63)
  if (!slugPattern.test(slug)) throw new Error('invalid tenant slug')
  const logoUrl = value.logoUrl
  if (logoUrl !== undefined && logoUrl !== null) requireHttpUrl(value, 'logoUrl')
  return Object.freeze({
    tenantId: requireUuid(value, 'tenantId'),
    displayName: requireBoundedString(value, 'displayName', 1, 120),
    slug,
    logoUrl: typeof logoUrl === 'string' || logoUrl === null ? logoUrl : null,
    role,
  })
}

function application(value: unknown): AuthorizedApplication {
  if (!isRecord(value) || !isRecord(value.deepLinks) || !Array.isArray(value.capabilities)) {
    throw new Error('invalid application')
  }
  assertKeys(value, ['appId', 'tenantId', 'displayName', 'baseUrl', 'deepLinks', 'capabilities', 'contractRange'])
  const appId = requireBoundedString(value, 'appId', 2, 64)
  if (!appIdPattern.test(appId)) throw new Error('invalid application id')
  const tenantId = requireUuid(value, 'tenantId')
  const deepLinks = Object.fromEntries(Object.entries(value.deepLinks).map(([key, path]) => {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('invalid application deep link')
    return [key, path]
  }))
  const capabilities = value.capabilities.map((item) => {
    if (typeof item !== 'string' || !capabilityPattern.test(item)) throw new Error('invalid application capability')
    return item
  })
  if (new Set(capabilities).size !== capabilities.length) throw new Error('duplicate application capability')
  return Object.freeze({
    appId, tenantId,
    displayName: requireBoundedString(value, 'displayName', 1, 120), baseUrl: requireHttpUrl(value, 'baseUrl'),
    deepLinks: Object.freeze(deepLinks), capabilities: Object.freeze(capabilities),
    contractRange: requireString(value, 'contractRange'),
  })
}

function user(value: unknown): User {
  if (!isRecord(value)) throw new Error('invalid user')
  assertKeys(value, ['userId', 'displayName'], ['email'])
  const email = value.email
  if (email !== undefined && email !== null
    && (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+$/.test(email))) {
    throw new Error('invalid user email')
  }
  return Object.freeze({
    userId: requireUuid(value, 'userId'), displayName: requireBoundedString(value, 'displayName', 1, 100),
    email: typeof email === 'string' || email === null ? email : null,
  })
}

export class PlatformMockApi {
  readonly baseUrl: string

  constructor(private readonly fetcher: Fetch = globalThis.fetch, baseUrl = PLATFORM_MOCK_BASE_URL) {
    this.baseUrl = assertLoopbackMockBaseUrl(baseUrl)
  }

  async login(input: AuthCallbackInput, signal?: AbortSignal): Promise<AuthResult> {
    const body = await this.request('/desktop/v1/auth/callback', {
      method: 'POST', signal: signal ?? null,
      body: JSON.stringify({ clientId: PLATFORM_CLIENT_ID, ...input }),
    })
    return this.decode(() => {
      if (!isRecord(body)) throw new Error('invalid login response')
      assertKeys(body, ['session', 'user', 'meta'])
      return Object.freeze({ session: assertSession(body.session), user: user(body.user), meta: assertMeta(body.meta) })
    })
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<RefreshResult> {
    const body = await this.request('/desktop/v1/auth/refresh', {
      method: 'POST', signal: signal ?? null,
      body: JSON.stringify({ clientId: PLATFORM_CLIENT_ID, refreshToken }),
    })
    return this.decode(() => {
      if (!isRecord(body)) throw new Error('invalid refresh response')
      assertKeys(body, ['session', 'meta'])
      return Object.freeze({ session: assertSession(body.session), meta: assertMeta(body.meta) })
    })
  }

  async logout(refreshToken: string | undefined, signal?: AbortSignal): Promise<void> {
    const body = await this.request('/desktop/v1/auth/logout', {
      method: 'POST', signal: signal ?? null,
      body: JSON.stringify(refreshToken === undefined ? {} : { refreshToken }),
    })
    this.decode(() => {
      if (!isRecord(body)) throw new Error('invalid logout response')
      assertKeys(body, ['ok', 'revocationEffectiveWithinSeconds', 'meta'])
      if (body.ok !== true
        || !Number.isInteger(body.revocationEffectiveWithinSeconds)
        || Number(body.revocationEffectiveWithinSeconds) < 0
        || Number(body.revocationEffectiveWithinSeconds) > 60) {
        throw new Error('invalid logout result')
      }
      assertMeta(body.meta)
    })
  }

  async listTenants(accessToken: string, signal?: AbortSignal): Promise<TenantList> {
    const body = await this.request('/desktop/v1/tenants', { signal: signal ?? null, headers: this.authorization(accessToken) })
    return this.decode(() => {
      if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('invalid tenant list')
      assertKeys(body, ['activeTenantId', 'items', 'meta'])
      return Object.freeze({
        activeTenantId: requireUuid(body, 'activeTenantId'), items: Object.freeze(body.items.map(tenant)), meta: assertMeta(body.meta),
      })
    })
  }

  async switchTenant(accessToken: string, tenantId: string, signal?: AbortSignal): Promise<TenantSwitchResult> {
    const body = await this.request('/desktop/v1/tenants/switch', {
      method: 'POST', signal: signal ?? null, headers: this.authorization(accessToken), body: JSON.stringify({ tenantId }),
    })
    return this.decode(() => {
      if (!isRecord(body)) throw new Error('invalid tenant switch response')
      assertKeys(body, ['tenant', 'session', 'meta'])
      const session = assertSession(body.session)
      const selectedTenant = tenant(body.tenant)
      if (session.activeTenantId !== selectedTenant.tenantId) throw new Error('tenant switch identity mismatch')
      return Object.freeze({ tenant: selectedTenant, session, meta: assertMeta(body.meta) })
    })
  }

  async listApplications(accessToken: string, activeTenantId: string, signal?: AbortSignal): Promise<ApplicationList> {
    const body = await this.request('/desktop/v1/apps', { signal: signal ?? null, headers: this.authorization(accessToken) })
    return this.decode(() => {
      if (!isRecord(body) || !Array.isArray(body.items)) throw new Error('invalid application list')
      assertKeys(body, ['activeTenantId', 'items', 'meta'])
      const responseTenantId = requireUuid(body, 'activeTenantId')
      const items = body.items.map(application)
      if (responseTenantId !== activeTenantId || items.some(item => item.tenantId !== activeTenantId)) {
        throw new Error('application response crossed the active tenant boundary')
      }
      return Object.freeze({ activeTenantId, items: Object.freeze(items), meta: assertMeta(body.meta) })
    })
  }

  private authorization(accessToken: string): HeadersInit {
    return { Authorization: `Bearer ${accessToken}` }
  }

  private async request(path: string, init: RequestInit): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init.headers },
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') throw error
      throw new PlatformApiError('MOCK_UNAVAILABLE', '本地 FutureStaff Mock 不可用。', true)
    }
    let body: unknown
    try {
      body = await response.json()
    } catch {
      throw this.mismatch('mock returned non-JSON data', response.status)
    }
    if (response.headers.get('x-futurestaff-mock') !== 'true'
      || response.headers.get('x-futurestaff-contract-version') !== PLATFORM_CONTRACT_VERSION) {
      throw this.mismatch('response is not from the pinned local mock', response.status)
    }
    try {
      if (!isRecord(body)) throw new Error('invalid response body')
      assertMeta(body.meta)
    } catch {
      throw this.mismatch('response metadata does not match the pinned contract', response.status)
    }
    if (!response.ok) {
      let code: PlatformErrorCode
      let message: string
      let retryable: boolean
      try {
        assertKeys(body, ['error', 'meta'])
        if (!isRecord(body.error)) throw new Error('invalid error')
        const error = body.error
        assertKeys(error, ['code', 'message', 'retryable'], ['details'])
        if (typeof error.code !== 'string' || !serverErrorCodes.includes(error.code as PlatformErrorCode)) {
          throw new Error('invalid error code')
        }
        if (typeof error.retryable !== 'boolean') throw new Error('invalid retryable')
        if (error.details !== undefined && !isRecord(error.details)) throw new Error('invalid error details')
        code = error.code as PlatformErrorCode
        message = requireString(error, 'message')
        retryable = error.retryable
      } catch {
        throw this.mismatch('platform error response does not match the pinned contract', response.status)
      }
      throw new PlatformApiError(
        code,
        message,
        retryable,
        response.status,
      )
    }
    return body
  }

  private mismatch(message: string, status?: number): PlatformApiError {
    return new PlatformApiError('CONTRACT_MISMATCH', message, false, status)
  }

  private decode<T>(decoder: () => T): T {
    try { return decoder() } catch { throw this.mismatch('platform response does not match the pinned contract') }
  }
}
