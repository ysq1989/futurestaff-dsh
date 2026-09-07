import {
  assertMeta,
  assertSession,
  isRecord,
  PLATFORM_CLIENT_ID,
  PLATFORM_CONTRACT_VERSION,
  PLATFORM_MOCK_BASE_URL,
  requireString,
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
  const role = requireString(value, 'role') as TenantRole
  if (!roles.includes(role)) throw new Error('invalid tenant role')
  return Object.freeze({
    tenantId: requireString(value, 'tenantId'),
    displayName: requireString(value, 'displayName'),
    slug: requireString(value, 'slug'),
    logoUrl: typeof value.logoUrl === 'string' || value.logoUrl === null ? value.logoUrl : null,
    role,
  })
}

function application(value: unknown): AuthorizedApplication {
  if (!isRecord(value) || !isRecord(value.deepLinks) || !Array.isArray(value.capabilities)) {
    throw new Error('invalid application')
  }
  const tenantId = requireString(value, 'tenantId')
  const deepLinks = Object.fromEntries(Object.entries(value.deepLinks).map(([key, path]) => {
    if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('invalid application deep link')
    return [key, path]
  }))
  const capabilities = value.capabilities.map((item) => {
    if (typeof item !== 'string' || item.length === 0) throw new Error('invalid application capability')
    return item
  })
  return Object.freeze({
    appId: requireString(value, 'appId'), tenantId,
    displayName: requireString(value, 'displayName'), baseUrl: requireString(value, 'baseUrl'),
    deepLinks: Object.freeze(deepLinks), capabilities: Object.freeze(capabilities),
    contractRange: requireString(value, 'contractRange'),
  })
}

function user(value: unknown): User {
  if (!isRecord(value)) throw new Error('invalid user')
  return Object.freeze({
    userId: requireString(value, 'userId'), displayName: requireString(value, 'displayName'),
    email: typeof value.email === 'string' || value.email === null ? value.email : null,
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
    if (!isRecord(body)) throw this.mismatch('invalid login response')
    return Object.freeze({ session: assertSession(body.session), user: user(body.user), meta: assertMeta(body.meta) })
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<RefreshResult> {
    const body = await this.request('/desktop/v1/auth/refresh', {
      method: 'POST', signal: signal ?? null,
      body: JSON.stringify({ clientId: PLATFORM_CLIENT_ID, refreshToken }),
    })
    if (!isRecord(body)) throw this.mismatch('invalid refresh response')
    return Object.freeze({ session: assertSession(body.session), meta: assertMeta(body.meta) })
  }

  async logout(refreshToken: string | undefined, signal?: AbortSignal): Promise<void> {
    await this.request('/desktop/v1/auth/logout', {
      method: 'POST', signal: signal ?? null,
      body: JSON.stringify(refreshToken === undefined ? {} : { refreshToken }),
    })
  }

  async listTenants(accessToken: string, signal?: AbortSignal): Promise<TenantList> {
    const body = await this.request('/desktop/v1/tenants', { signal: signal ?? null, headers: this.authorization(accessToken) })
    if (!isRecord(body) || !Array.isArray(body.items)) throw this.mismatch('invalid tenant list')
    return Object.freeze({
      activeTenantId: requireString(body, 'activeTenantId'), items: Object.freeze(body.items.map(tenant)), meta: assertMeta(body.meta),
    })
  }

  async switchTenant(accessToken: string, tenantId: string, signal?: AbortSignal): Promise<TenantSwitchResult> {
    const body = await this.request('/desktop/v1/tenants/switch', {
      method: 'POST', signal: signal ?? null, headers: this.authorization(accessToken), body: JSON.stringify({ tenantId }),
    })
    if (!isRecord(body)) throw this.mismatch('invalid tenant switch response')
    const session = assertSession(body.session)
    const selectedTenant = tenant(body.tenant)
    if (session.activeTenantId !== selectedTenant.tenantId) throw this.mismatch('tenant switch identity mismatch')
    return Object.freeze({ tenant: selectedTenant, session, meta: assertMeta(body.meta) })
  }

  async listApplications(accessToken: string, activeTenantId: string, signal?: AbortSignal): Promise<ApplicationList> {
    const body = await this.request('/desktop/v1/apps', { signal: signal ?? null, headers: this.authorization(accessToken) })
    if (!isRecord(body) || !Array.isArray(body.items)) throw this.mismatch('invalid application list')
    const items = body.items.map(application)
    if (requireString(body, 'activeTenantId') !== activeTenantId || items.some(item => item.tenantId !== activeTenantId)) {
      throw this.mismatch('application response crossed the active tenant boundary')
    }
    return Object.freeze({ activeTenantId, items: Object.freeze(items), meta: assertMeta(body.meta) })
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
      const error = isRecord(body.error) ? body.error : {}
      throw new PlatformApiError(
        (typeof error.code === 'string' ? error.code : 'CONTRACT_MISMATCH') as PlatformErrorCode,
        typeof error.message === 'string' ? error.message : '平台请求失败。',
        error.retryable === true,
        response.status,
      )
    }
    return body
  }

  private mismatch(message: string, status?: number): PlatformApiError {
    return new PlatformApiError('CONTRACT_MISMATCH', message, false, status)
  }
}
