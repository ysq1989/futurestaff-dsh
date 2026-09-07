import { PlatformApiError } from './api.js'
import {
  assertKeys,
  isRecord,
  PLATFORM_DEV_CONTRACT_VERSION,
  requireBoundedString,
  requireHttpUrl,
  requireString,
  requireUuid,
  type AuthorizedApplication,
  type DesktopSession,
  type PlatformFailure,
  type RefreshResult,
  type Tenant,
  type TenantList,
  type TenantSwitchResult,
  type User,
} from './contracts.js'
import { clearTenantBoundary, type TenantIsolationBoundary } from './isolation.js'
import type { StoredPlatformSession } from './session-vault.js'

export type PlatformDevAccessPhase = 'signed_out' | 'loading' | 'ready' | 'no_apps' | 'expired' | 'error'

export interface PlatformDevAccessSnapshot {
  readonly phase: PlatformDevAccessPhase
  readonly simulated: false
  readonly contractVersion: typeof PLATFORM_DEV_CONTRACT_VERSION
  readonly user?: User
  readonly activeTenantId?: string
  readonly tenants: readonly Tenant[]
  readonly applications: readonly AuthorizedApplication[]
  readonly error?: PlatformFailure
}

interface PlatformDevAccessApi {
  refresh(refreshToken: string, signal?: AbortSignal): Promise<RefreshResult>
  logout(refreshToken: string | undefined, signal?: AbortSignal): Promise<void>
  listTenants(accessToken: string, signal?: AbortSignal): Promise<TenantList>
  switchTenant(accessToken: string, tenantId: string, signal?: AbortSignal): Promise<TenantSwitchResult>
  listApplications(accessToken: string, activeTenantId: string, signal?: AbortSignal): Promise<{
    readonly activeTenantId: string
    readonly items: readonly AuthorizedApplication[]
  }>
}

interface PlatformDevAccessVault {
  load(): Promise<StoredPlatformSession | undefined>
  save(value: StoredPlatformSession): Promise<void>
  clear(): Promise<void>
}

const initialSnapshot: PlatformDevAccessSnapshot = Object.freeze({
  phase: 'signed_out', simulated: false, contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
  tenants: Object.freeze([]), applications: Object.freeze([]),
})

const phases: readonly PlatformDevAccessPhase[] = ['signed_out', 'loading', 'ready', 'no_apps', 'expired', 'error']
const roles = ['member', 'agent_admin', 'org_admin', 'platform_admin'] as const
const failureCodes: readonly PlatformFailure['code'][] = [
  'INVALID_REQUEST', 'AUTHENTICATION_REQUIRED', 'TENANT_MEMBERSHIP_REQUIRED', 'TENANT_ACCESS_DENIED',
  'APPLICATION_ACCESS_DENIED', 'TOKEN_AUDIENCE_INVALID', 'TOKEN_EXPIRED', 'NOT_FOUND',
  'PLATFORM_UNAVAILABLE', 'CONTRACT_MISMATCH',
]

function safeUser(value: unknown): User {
  if (!isRecord(value)) throw new Error('invalid DEV session snapshot')
  assertKeys(value, ['userId', 'displayName'], ['email'])
  const email = value.email
  if (email !== undefined && email !== null
    && (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+$/u.test(email))) {
    throw new Error('invalid DEV session snapshot')
  }
  return Object.freeze({
    userId: requireUuid(value, 'userId'),
    displayName: requireBoundedString(value, 'displayName', 1, 100),
    email: typeof email === 'string' || email === null ? email : null,
  })
}

function safeTenant(value: unknown): Tenant {
  if (!isRecord(value)) throw new Error('invalid DEV session snapshot')
  assertKeys(value, ['tenantId', 'displayName', 'slug', 'role'], ['logoUrl'])
  const role = requireString(value, 'role')
  if (!roles.includes(role as typeof roles[number])) throw new Error('invalid DEV session snapshot')
  const logoUrl = value.logoUrl
  if (logoUrl !== undefined && logoUrl !== null) requireHttpUrl(value, 'logoUrl')
  return Object.freeze({
    tenantId: requireUuid(value, 'tenantId'),
    displayName: requireBoundedString(value, 'displayName', 1, 120),
    slug: (() => {
      const slug = requireBoundedString(value, 'slug', 2, 63)
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/u.test(slug)) throw new Error('invalid DEV session snapshot')
      return slug
    })(),
    logoUrl: typeof logoUrl === 'string' || logoUrl === null ? logoUrl : null,
    role: role as Tenant['role'],
  })
}

function safeApplication(value: unknown): AuthorizedApplication {
  if (!isRecord(value) || !isRecord(value.deepLinks) || !Array.isArray(value.capabilities)) {
    throw new Error('invalid DEV session snapshot')
  }
  assertKeys(value, ['appId', 'tenantId', 'displayName', 'baseUrl', 'deepLinks', 'capabilities', 'contractRange'])
  const deepLinks = Object.fromEntries(Object.entries(value.deepLinks).map(([key, path]) => {
    if (!/^[a-z][a-z0-9_]{0,63}$/u.test(key) || typeof path !== 'string' || !path.startsWith('/') || path.length > 2048) {
      throw new Error('invalid DEV session snapshot')
    }
    return [key, path]
  }))
  const capabilities = value.capabilities.map(item => {
    if (typeof item !== 'string' || !/^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/u.test(item)) {
      throw new Error('invalid DEV session snapshot')
    }
    return item
  })
  if (new Set(capabilities).size !== capabilities.length) throw new Error('invalid DEV session snapshot')
  return Object.freeze({
    appId: (() => {
      const appId = requireBoundedString(value, 'appId', 2, 64)
      if (!/^[a-z][a-z0-9_]{1,63}$/u.test(appId)) throw new Error('invalid DEV session snapshot')
      return appId
    })(),
    tenantId: requireUuid(value, 'tenantId'),
    displayName: requireBoundedString(value, 'displayName', 1, 120),
    baseUrl: requireHttpUrl(value, 'baseUrl'),
    deepLinks: Object.freeze(deepLinks),
    capabilities: Object.freeze(capabilities),
    contractRange: requireBoundedString(value, 'contractRange', 1, 100),
  })
}

function safeFailure(value: unknown): PlatformFailure {
  if (!isRecord(value)) throw new Error('invalid DEV session snapshot')
  assertKeys(value, ['code', 'message', 'retryable'])
  const code = requireString(value, 'code') as PlatformFailure['code']
  if (!failureCodes.includes(code) || typeof value.retryable !== 'boolean') {
    throw new Error('invalid DEV session snapshot')
  }
  return Object.freeze({ code, message: requireBoundedString(value, 'message', 1, 200), retryable: value.retryable })
}

export function decodePlatformDevAccessSnapshot(value: unknown): PlatformDevAccessSnapshot {
  if (!isRecord(value) || !Array.isArray(value.tenants) || !Array.isArray(value.applications)) {
    throw new Error('invalid DEV session snapshot')
  }
  assertKeys(value, ['phase', 'simulated', 'contractVersion', 'tenants', 'applications'], ['user', 'activeTenantId', 'error'])
  if (typeof value.phase !== 'string' || !phases.includes(value.phase as PlatformDevAccessPhase)
    || value.simulated !== false || value.contractVersion !== PLATFORM_DEV_CONTRACT_VERSION
    || value.tenants.length > 100 || value.applications.length > 200) {
    throw new Error('invalid DEV session snapshot')
  }
  const phase = value.phase as PlatformDevAccessPhase
  const tenants = Object.freeze(value.tenants.map(safeTenant))
  const applications = Object.freeze(value.applications.map(safeApplication))
  const parsed: PlatformDevAccessSnapshot = Object.freeze({
    phase,
    simulated: false,
    contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
    tenants,
    applications,
    ...(value.user === undefined ? {} : { user: safeUser(value.user) }),
    ...(value.activeTenantId === undefined ? {} : { activeTenantId: requireUuid(value, 'activeTenantId') }),
    ...(value.error === undefined ? {} : { error: safeFailure(value.error) }),
  })
  if (phase === 'signed_out' && (parsed.user !== undefined || parsed.activeTenantId !== undefined
    || tenants.length !== 0 || applications.length !== 0 || parsed.error !== undefined)) {
    throw new Error('invalid DEV session snapshot')
  }
  if ((phase === 'ready' || phase === 'no_apps')
    && (parsed.user === undefined || parsed.activeTenantId === undefined
      || !tenants.some(tenant => tenant.tenantId === parsed.activeTenantId)
      || applications.some(application => application.tenantId !== parsed.activeTenantId)
      || (phase === 'ready' && applications.length === 0)
      || (phase === 'no_apps' && applications.length !== 0))) {
    throw new Error('invalid DEV session snapshot')
  }
  if ((phase === 'expired' || phase === 'error') !== (parsed.error !== undefined)) {
    throw new Error('invalid DEV session snapshot')
  }
  return parsed
}

function failure(error: unknown): PlatformFailure {
  if (error instanceof PlatformApiError) {
    const messages: Partial<Record<PlatformFailure['code'], string>> = {
      PLATFORM_UNAVAILABLE: 'FutureStaff Platform DEV 暂时不可用。',
      APPLICATION_ACCESS_DENIED: '当前租户没有已授权应用。',
      TENANT_ACCESS_DENIED: '当前账号无权访问该租户。',
      TENANT_MEMBERSHIP_REQUIRED: '当前账号不属于该租户。',
      TOKEN_EXPIRED: '登录已过期，请重新登录。',
      TOKEN_AUDIENCE_INVALID: '登录会话不适用于当前客户端。',
      AUTHENTICATION_REQUIRED: '请重新登录。',
    }
    return Object.freeze({
      code: error.code,
      message: messages[error.code] ?? '平台响应不符合固定契约。',
      retryable: error.retryable,
    })
  }
  return Object.freeze({ code: 'CONTRACT_MISMATCH', message: '无法读取受保护的平台会话。', retryable: false })
}

export class PlatformDevAccessController {
  #snapshot = initialSnapshot
  #session: DesktopSession | undefined
  #user: User | undefined
  #generation = 0
  #request = new AbortController()
  #queue: Promise<void> = Promise.resolve()

  constructor(
    private readonly api: PlatformDevAccessApi,
    private readonly vault: PlatformDevAccessVault,
    private readonly boundary: TenantIsolationBoundary,
  ) {}

  getSnapshot(): PlatformDevAccessSnapshot { return this.#snapshot }

  restore(): Promise<PlatformDevAccessSnapshot> { return this.#enqueue(() => this.#restore()) }
  refresh(): Promise<PlatformDevAccessSnapshot> { return this.#enqueue(() => this.#refresh()) }
  switchTenant(tenantId: string): Promise<PlatformDevAccessSnapshot> {
    return this.#enqueue(() => this.#switchTenant(tenantId))
  }
  logout(): Promise<PlatformDevAccessSnapshot> { return this.#enqueue(() => this.#logout()) }

  async #restore(): Promise<PlatformDevAccessSnapshot> {
    const operation = this.#beginOperation()
    this.#publish({ ...initialSnapshot, phase: 'loading' })
    try {
      const stored = await this.vault.load()
      if (!this.#isCurrent(operation.generation)) return this.#snapshot
      if (stored === undefined) {
        this.#session = undefined
        this.#user = undefined
        this.#publish(initialSnapshot)
        return this.#snapshot
      }
      this.#session = stored.session
      this.#user = stored.user
      this.#publish({
        ...initialSnapshot, phase: 'loading', user: stored.user,
        activeTenantId: stored.session.activeTenantId,
      })
      await this.#loadContext(operation.generation)
    } catch (error) {
      await this.#handleFailure(error, operation.generation)
    }
    return this.#snapshot
  }

  async #refresh(): Promise<PlatformDevAccessSnapshot> {
    if (this.#session === undefined || this.#user === undefined) return this.#restore()
    const previous = this.#session
    const operation = this.#beginOperation()
    this.#publish({ ...this.#snapshot, phase: 'loading', applications: Object.freeze([]) })
    try {
      const result = await this.api.refresh(previous.refreshToken, operation.signal)
      if (!this.#isCurrent(operation.generation)) return this.#snapshot
      await this.vault.save({ session: result.session, user: this.#user })
      if (!this.#isCurrent(operation.generation)) return this.#snapshot
      this.#session = result.session
      await this.#loadContext(operation.generation)
    } catch (error) {
      await this.#handleFailure(error, operation.generation)
    }
    return this.#snapshot
  }

  async #switchTenant(tenantId: string): Promise<PlatformDevAccessSnapshot> {
    const previous = this.#session
    if (previous === undefined || this.#user === undefined
      || !this.#snapshot.tenants.some(tenant => tenant.tenantId === tenantId)) {
      throw new Error('fs-platform-access: requested tenant is not authorized.')
    }
    if (tenantId === previous.activeTenantId) return this.#snapshot
    const operation = await this.#beginIsolatedOperation()
    this.#publish({
      ...initialSnapshot, phase: 'loading', user: this.#user,
      tenants: this.#snapshot.tenants,
    })
    try {
      const result = await this.api.switchTenant(previous.accessToken, tenantId, operation.signal)
      if (!this.#isCurrent(operation.generation)) return this.#snapshot
      await this.vault.save({ session: result.session, user: this.#user })
      if (!this.#isCurrent(operation.generation)) return this.#snapshot
      this.#session = result.session
      await this.#loadContext(operation.generation)
    } catch (error) {
      await this.#handleFailure(error, operation.generation)
    }
    return this.#snapshot
  }

  async #logout(): Promise<PlatformDevAccessSnapshot> {
    const refreshToken = this.#session?.refreshToken
    const operation = await this.#beginIsolatedOperation()
    this.#session = undefined
    this.#user = undefined
    try {
      await this.vault.clear()
      if (this.#isCurrent(operation.generation)) this.#publish(initialSnapshot)
    } catch (error) {
      if (this.#isCurrent(operation.generation)) {
        this.#publish({ ...initialSnapshot, phase: 'error', error: failure(error) })
      }
    }
    try { await this.api.logout(refreshToken, operation.signal) } catch { /* local-first logout */ }
    return this.#snapshot
  }

  async #loadContext(generation: number): Promise<void> {
    const session = this.#session
    const user = this.#user
    if (session === undefined || user === undefined) return
    const tenants = await this.api.listTenants(session.accessToken, this.#request.signal)
    if (!this.#isCurrent(generation)) return
    if (tenants.activeTenantId !== session.activeTenantId
      || !tenants.items.some(tenant => tenant.tenantId === session.activeTenantId)) {
      throw new PlatformApiError('CONTRACT_MISMATCH', 'tenant identity mismatch', false)
    }
    let applications: { readonly activeTenantId: string; readonly items: readonly AuthorizedApplication[] }
    try {
      applications = await this.api.listApplications(session.accessToken, session.activeTenantId, this.#request.signal)
    } catch (error) {
      if (error instanceof PlatformApiError && error.code === 'APPLICATION_ACCESS_DENIED') {
        if (this.#isCurrent(generation)) this.#publish({
          phase: 'no_apps', simulated: false, contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
          user, activeTenantId: session.activeTenantId, tenants: tenants.items, applications: Object.freeze([]),
        })
        return
      }
      throw error
    }
    if (!this.#isCurrent(generation)) return
    this.#publish({
      phase: applications.items.length === 0 ? 'no_apps' : 'ready',
      simulated: false,
      contractVersion: PLATFORM_DEV_CONTRACT_VERSION,
      user,
      activeTenantId: session.activeTenantId,
      tenants: tenants.items,
      applications: applications.items,
    })
  }

  #beginOperation(): { readonly generation: number; readonly signal: AbortSignal } {
    this.#request.abort()
    this.#request = new AbortController()
    this.#generation += 1
    return Object.freeze({ generation: this.#generation, signal: this.#request.signal })
  }

  async #beginIsolatedOperation(): Promise<{ readonly generation: number; readonly signal: AbortSignal }> {
    const operation = this.#beginOperation()
    await clearTenantBoundary(this.boundary)
    return operation
  }

  #isCurrent(generation: number): boolean { return generation === this.#generation }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#queue.then(operation, operation)
    this.#queue = result.then(() => undefined, () => undefined)
    return result
  }

  async #handleFailure(error: unknown, generation: number): Promise<void> {
    if (!this.#isCurrent(generation) || (error instanceof Error && error.name === 'AbortError')) return
    const problem = failure(error)
    if (problem.code === 'TOKEN_EXPIRED' || problem.code === 'TOKEN_AUDIENCE_INVALID'
      || problem.code === 'AUTHENTICATION_REQUIRED') {
      await clearTenantBoundary(this.boundary)
      try { await this.vault.clear() } catch { /* expired credentials remain unusable */ }
      this.#session = undefined
      this.#user = undefined
      this.#publish({ ...initialSnapshot, phase: 'expired', error: problem })
      return
    }
    this.#publish({
      ...initialSnapshot,
      phase: 'error',
      ...(this.#user === undefined ? {} : { user: this.#user }),
      ...(this.#session === undefined ? {} : { activeTenantId: this.#session.activeTenantId }),
      error: problem,
    })
  }

  #publish(snapshot: PlatformDevAccessSnapshot): void { this.#snapshot = Object.freeze(snapshot) }
}
