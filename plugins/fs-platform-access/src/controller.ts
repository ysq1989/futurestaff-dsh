import { PlatformApiError, PlatformMockApi } from './api.js'
import {
  PLATFORM_CONTRACT_VERSION,
  PLATFORM_DEV_CONTRACT_VERSION,
  type AuthCallbackInput,
  type AuthorizedApplication,
  type DesktopSession,
  type PlatformFailure,
  type Tenant,
  type User,
} from './contracts.js'
import { clearTenantBoundary, type TenantIsolationBoundary } from './isolation.js'

export type AccessPhase = 'signed_out' | 'loading' | 'ready' | 'no_apps' | 'expired' | 'error'

export interface PlatformAccessSnapshot {
  readonly phase: AccessPhase
  readonly simulated: boolean
  readonly contractVersion: typeof PLATFORM_CONTRACT_VERSION | typeof PLATFORM_DEV_CONTRACT_VERSION
  readonly user?: User
  readonly activeTenantId?: string
  readonly tenants: readonly Tenant[]
  readonly applications: readonly AuthorizedApplication[]
  readonly error?: PlatformFailure
}

type Listener = () => void

const initialSnapshot: PlatformAccessSnapshot = Object.freeze({
  phase: 'signed_out', simulated: true, contractVersion: PLATFORM_CONTRACT_VERSION,
  tenants: Object.freeze([]), applications: Object.freeze([]),
})

function withoutError(snapshot: PlatformAccessSnapshot): PlatformAccessSnapshot {
  const { error: _error, ...rest } = snapshot
  return rest
}

export class PlatformAccessController {
  private snapshot: PlatformAccessSnapshot = initialSnapshot
  private session: DesktopSession | undefined
  private generation = 0
  private request = new AbortController()
  private readonly listeners = new Set<Listener>()

  constructor(
    private readonly api: PlatformMockApi,
    private readonly boundary: TenantIsolationBoundary,
  ) {}

  getSnapshot = (): PlatformAccessSnapshot => this.snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async login(input: AuthCallbackInput): Promise<void> {
    const operation = this.beginOperation()
    this.publish({ ...initialSnapshot, phase: 'loading' })
    try {
      const result = await this.api.login(input, operation.signal)
      if (!this.isCurrent(operation.generation)) return
      this.session = result.session
      this.publish({ ...initialSnapshot, phase: 'loading', user: result.user, activeTenantId: result.session.activeTenantId })
      await this.loadInitialContext(operation.generation, result.user)
    } catch (error) {
      await this.handleFailure(error, operation.generation)
    }
  }

  async loginWithMock(): Promise<void> {
    await this.login({
      code: 'mock-code-success', codeVerifier: 'a'.repeat(43),
      redirectUri: 'http://127.0.0.1:43821/callback', state: 'mock-state-000000',
    })
  }

  async startLogin(): Promise<void> { await this.loginWithMock() }

  async refresh(): Promise<void> {
    const previous = this.session
    if (previous === undefined) return this.publishExpired('AUTHENTICATION_REQUIRED', '没有可刷新的登录会话。')
    const operation = this.beginOperation()
    this.publish({ ...withoutError(this.snapshot), phase: 'loading' })
    try {
      const result = await this.api.refresh(previous.refreshToken, operation.signal)
      if (!this.isCurrent(operation.generation)) return
      this.session = result.session
      await this.loadApplications(operation.generation)
    } catch (error) {
      await this.handleFailure(error, operation.generation)
    }
  }

  async switchTenant(tenantId: string): Promise<void> {
    const previous = this.session
    const user = this.snapshot.user
    const tenants = this.snapshot.tenants
    if (previous === undefined || user === undefined) return this.publishExpired('AUTHENTICATION_REQUIRED', '请先登录。')
    if (tenantId === previous.activeTenantId) return

    const operation = await this.beginIsolatedOperation()
    this.session = undefined
    this.publish({ ...initialSnapshot, phase: 'loading', user, tenants })
    try {
      const result = await this.api.switchTenant(previous.accessToken, tenantId, operation.signal)
      if (!this.isCurrent(operation.generation)) return
      this.session = result.session
      this.publish({ ...initialSnapshot, phase: 'loading', user, tenants, activeTenantId: result.tenant.tenantId })
      await this.loadApplications(operation.generation)
    } catch (error) {
      await this.handleFailure(error, operation.generation)
    }
  }

  async logout(): Promise<void> {
    const refreshToken = this.session?.refreshToken
    const operation = await this.beginIsolatedOperation()
    this.session = undefined
    this.publish(initialSnapshot)
    try {
      await this.api.logout(refreshToken, operation.signal)
    } catch {
      // Local state is intentionally signed out even when the mock is unavailable.
    }
  }

  private async loadInitialContext(generation: number, user: User): Promise<void> {
    const session = this.session
    if (session === undefined) return
    try {
      const tenants = await this.api.listTenants(session.accessToken, this.request.signal)
      if (!this.isCurrent(generation)) return
      if (!tenants.items.some(item => item.tenantId === session.activeTenantId)) {
        throw new PlatformApiError('CONTRACT_MISMATCH', '当前租户不在成员关系列表中。', false)
      }
      this.publish({ ...initialSnapshot, phase: 'loading', user, tenants: tenants.items, activeTenantId: session.activeTenantId })
      await this.loadApplications(generation)
    } catch (error) {
      await this.handleFailure(error, generation)
    }
  }

  private async loadApplications(generation: number): Promise<void> {
    const session = this.session
    if (session === undefined) return
    try {
      const result = await this.api.listApplications(session.accessToken, session.activeTenantId, this.request.signal)
      if (!this.isCurrent(generation)) return
      this.publish({ ...withoutError(this.snapshot), phase: result.items.length === 0 ? 'no_apps' : 'ready', applications: result.items })
    } catch (error) {
      if (error instanceof PlatformApiError && error.code === 'APPLICATION_ACCESS_DENIED') {
        if (this.isCurrent(generation)) this.publish({ ...withoutError(this.snapshot), phase: 'no_apps', applications: Object.freeze([]) })
        return
      }
      await this.handleFailure(error, generation)
    }
  }

  private beginOperation(): { generation: number; signal: AbortSignal } {
    this.request.abort()
    this.request = new AbortController()
    this.generation += 1
    return { generation: this.generation, signal: this.request.signal }
  }

  private async beginIsolatedOperation(): Promise<{ generation: number; signal: AbortSignal }> {
    const operation = this.beginOperation()
    await clearTenantBoundary(this.boundary)
    return operation
  }

  private isCurrent(generation: number): boolean { return generation === this.generation }

  private async handleFailure(error: unknown, generation: number): Promise<void> {
    if (!this.isCurrent(generation) || (error instanceof Error && error.name === 'AbortError')) return
    const failure: PlatformFailure = error instanceof PlatformApiError
      ? { code: error.code, message: error.message, retryable: error.retryable }
      : { code: 'CONTRACT_MISMATCH', message: '平台响应不符合固定契约。', retryable: false }
    if (failure.code === 'TOKEN_EXPIRED' || failure.code === 'TOKEN_AUDIENCE_INVALID' || failure.code === 'AUTHENTICATION_REQUIRED') {
      await clearTenantBoundary(this.boundary)
      this.session = undefined
      this.publish({ ...initialSnapshot, phase: 'expired', error: failure })
      return
    }
    this.publish({ ...this.snapshot, phase: 'error', applications: Object.freeze([]), error: failure })
  }

  private publishExpired(code: PlatformFailure['code'], message: string): void {
    this.session = undefined
    this.publish({ ...initialSnapshot, phase: 'expired', error: { code, message, retryable: false } })
  }

  private publish(snapshot: PlatformAccessSnapshot): void {
    this.snapshot = Object.freeze(snapshot)
    for (const listener of this.listeners) listener()
  }
}
