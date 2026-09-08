import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createElement, useEffect, useRef, useSyncExternalStore } from 'react'
import { PlatformMockApi } from '../api.js'
import type { PasswordLoginInput } from '../contracts.js'
import { PlatformAccessController, type PlatformAccessSnapshot } from '../controller.js'
import { decodePlatformDevAccessSnapshot } from '../dev-access.js'
import { InMemoryTenantResources } from '../isolation.js'
import { mountPlatformAccessPanel } from '../view.js'

const ROUTE_PREFIX = '/_futurestaff/platform-mock'
const DEV_ROUTE_PREFIX = '/_futurestaff/platform-dev'
const DEV_LOGIN_ROUTE = `${DEV_ROUTE_PREFIX}/login`
const PRODUCT_HUB_TOKEN_ROUTE = `${DEV_ROUTE_PREFIX}/apps/product_hub/token`
export const platformAccessPanelCss = `
.futurestaff-access{--fs-accent:#5b6cff;--fs-accent-soft:color-mix(in srgb,var(--fs-accent) 12%,transparent);--fs-border:color-mix(in srgb,currentColor 13%,transparent);--fs-muted:color-mix(in srgb,currentColor 66%,transparent);box-sizing:border-box;max-width:880px;min-width:0;color:var(--color-text,#172033);font-size:14px;line-height:1.5}
.futurestaff-access *{box-sizing:border-box}.futurestaff-access h2,.futurestaff-access h3,.futurestaff-access p{margin:0}.futurestaff-access button,.futurestaff-access select{font:inherit;color:inherit}
.futurestaff-access .fs-panel{display:grid;gap:22px;min-width:0;padding:26px;border:1px solid var(--fs-border);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--fs-accent) 5%,transparent),transparent 38%),color-mix(in srgb,currentColor 2.5%,transparent);box-shadow:0 18px 48px color-mix(in srgb,#111827 8%,transparent)}
.futurestaff-access .fs-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.futurestaff-access .fs-identity{display:flex;align-items:center;gap:13px;min-width:0}.futurestaff-access .fs-identity>div:last-child{min-width:0}.futurestaff-access .fs-avatar,.futurestaff-access .fs-state-mark{display:grid;flex:0 0 auto;place-items:center;width:46px;height:46px;border-radius:14px;background:linear-gradient(145deg,var(--fs-accent),#7c4dff);color:#fff;font-weight:760;letter-spacing:.02em;box-shadow:0 8px 18px color-mix(in srgb,var(--fs-accent) 27%,transparent)}
.futurestaff-access .fs-kicker{margin-bottom:2px;color:var(--fs-accent);font-size:.72rem;font-weight:760;letter-spacing:.09em;text-transform:uppercase}.futurestaff-access h2{overflow-wrap:anywhere;font-size:1.28rem;line-height:1.3}.futurestaff-access h3{font-size:1rem}.futurestaff-access .fs-user-email,.futurestaff-access .fs-app-id{display:block;overflow:hidden;color:var(--fs-muted);font-size:.8rem;text-overflow:ellipsis;white-space:nowrap}
.futurestaff-access .fs-header-actions,.futurestaff-access .fs-actions{display:flex;flex-wrap:wrap;gap:8px}.futurestaff-access button{min-height:38px;padding:8px 13px;border:1px solid var(--fs-border);border-radius:10px;background:color-mix(in srgb,currentColor 3%,transparent);cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}.futurestaff-access button:hover{border-color:color-mix(in srgb,var(--fs-accent) 55%,transparent);background:var(--fs-accent-soft)}.futurestaff-access button:active{transform:translateY(1px)}.futurestaff-access button[data-kind=primary]{border-color:transparent;background:var(--fs-accent);color:#fff;font-weight:680}
.futurestaff-access button:focus-visible,.futurestaff-access select:focus-visible{outline:3px solid color-mix(in srgb,var(--fs-accent) 35%,transparent);outline-offset:2px}
.futurestaff-access .fs-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.futurestaff-access .fs-environment-badge{display:inline-flex;align-items:center;gap:7px;min-width:0;padding:5px 9px;border:1px solid var(--fs-border);border-radius:999px;background:var(--fs-accent-soft);font-size:.76rem;font-weight:620}.futurestaff-access .fs-environment-badge>span{width:7px;height:7px;border-radius:50%;background:var(--fs-accent);box-shadow:0 0 0 3px var(--fs-accent-soft)}.futurestaff-access .fs-mock-badge{color:var(--fs-muted)}.futurestaff-access .fs-dev-badge{color:var(--fs-accent)}.futurestaff-access .fs-count{color:var(--fs-muted);font-size:.8rem;white-space:nowrap}
.futurestaff-access .fs-tenant{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,310px);align-items:end;gap:18px;padding:17px;border:1px solid var(--fs-border);border-radius:14px;background:color-mix(in srgb,currentColor 2%,transparent)}.futurestaff-access .fs-tenant label{font-weight:680}.futurestaff-access .fs-tenant p,.futurestaff-access .fs-apps-heading p,.futurestaff-access .fs-empty p,.futurestaff-access .fs-lead{color:var(--fs-muted)}.futurestaff-access .fs-tenant p,.futurestaff-access .fs-apps-heading p{margin-top:2px;font-size:.8rem}.futurestaff-access .fs-select-wrap{display:flex;align-items:center;gap:8px;min-width:0}.futurestaff-access select{width:100%;min-width:0;min-height:40px;padding:8px 34px 8px 11px;border:1px solid var(--fs-border);border-radius:10px;background:color-mix(in srgb,currentColor 2.5%,transparent)}.futurestaff-access .fs-role{flex:0 0 auto;padding:4px 7px;border-radius:7px;background:var(--fs-accent-soft);color:var(--fs-accent);font-size:.7rem;font-weight:700}
.futurestaff-access .fs-apps-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.futurestaff-access .fs-apps-heading>span{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--fs-accent-soft);color:var(--fs-accent);font-size:.78rem;font-weight:760}.futurestaff-access .fs-app-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}.futurestaff-access .fs-app-grid li{display:flex;align-items:flex-start;gap:11px;min-width:0;padding:15px;border:1px solid var(--fs-border);border-radius:14px;background:color-mix(in srgb,currentColor 1.5%,transparent)}.futurestaff-access .fs-app-icon{display:grid;flex:0 0 auto;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--fs-accent-soft);color:var(--fs-accent);font-weight:780}.futurestaff-access .fs-app-copy{min-width:0}.futurestaff-access .fs-app-copy>strong{display:block;overflow-wrap:anywhere}.futurestaff-access .fs-capabilities{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.futurestaff-access [data-capability=true]{max-width:100%;padding:3px 7px;border:1px solid var(--fs-border);border-radius:999px;color:var(--fs-muted);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.68rem;overflow-wrap:anywhere}
.futurestaff-access .fs-empty{display:grid;justify-items:center;gap:5px;padding:30px 18px;border:1px dashed color-mix(in srgb,currentColor 20%,transparent);border-radius:14px;text-align:center}.futurestaff-access .fs-empty-mark{display:grid;place-items:center;width:42px;height:42px;margin-bottom:4px;border-radius:13px;background:var(--fs-accent-soft);color:var(--fs-accent);font-weight:780}
.futurestaff-access .fs-login-form{display:grid;gap:8px;max-width:420px;margin-top:4px}.futurestaff-access .fs-login-form label{margin-top:4px;font-size:.82rem;font-weight:680}.futurestaff-access .fs-login-form input{width:100%;min-height:42px;padding:9px 12px;border:1px solid var(--fs-border);border-radius:10px;background:color-mix(in srgb,currentColor 2.5%,transparent);color:inherit;font:inherit}.futurestaff-access .fs-login-form input:focus-visible{outline:3px solid color-mix(in srgb,var(--fs-accent) 35%,transparent);outline-offset:2px}.futurestaff-access .fs-login-form button{margin-top:8px}
.futurestaff-access .fs-model-list{display:grid;gap:8px;margin:0;padding:0;list-style:none}.futurestaff-access .fs-model-list li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 15px;border:1px solid var(--fs-border);border-radius:12px;background:color-mix(in srgb,currentColor 1.5%,transparent)}.futurestaff-access .fs-model-list li[data-active=true]{border-color:color-mix(in srgb,var(--fs-accent) 45%,transparent);background:var(--fs-accent-soft)}.futurestaff-access .fs-model-list strong,.futurestaff-access .fs-model-list span{display:block}.futurestaff-access .fs-model-list span{margin-top:2px;color:var(--fs-muted);font-size:.76rem}.futurestaff-access .fs-model-list em{flex:0 0 auto;padding:4px 8px;border-radius:999px;background:var(--fs-accent);color:#fff;font-size:.7rem;font-style:normal;font-weight:700}
.futurestaff-login-gate{position:fixed;inset:0;z-index:1400;display:grid;place-items:center;padding:24px;background:radial-gradient(circle at 50% 12%,rgba(34,211,238,.18),transparent 38%),rgba(3,10,24,.82);backdrop-filter:blur(12px);pointer-events:auto}.futurestaff-login-gate .futurestaff-access{width:min(520px,100%);max-width:520px}.futurestaff-login-gate .fs-panel{background:color-mix(in srgb,#fff 96%,#e8f5ff);box-shadow:0 28px 90px rgba(0,0,0,.34)}
.futurestaff-access .fs-state{grid-template-columns:auto minmax(0,1fr);align-items:start}.futurestaff-access .fs-state-copy{display:grid;gap:11px;min-width:0}.futurestaff-access .fs-state .fs-state-mark{width:50px;height:50px}.futurestaff-access .fs-state .fs-actions{margin-top:4px}.futurestaff-access .fs-skeletons{display:grid;gap:8px;margin-top:4px}.futurestaff-access .fs-skeletons span{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--fs-border),color-mix(in srgb,currentColor 7%,transparent),var(--fs-border));background-size:200% 100%;animation:fs-shimmer 1.25s ease-in-out infinite}.futurestaff-access .fs-skeletons span:nth-child(2){width:78%}.futurestaff-access .fs-skeletons span:nth-child(3){width:52%}
@keyframes fs-shimmer{to{background-position:-200% 0}}
@media (max-width: 640px){.futurestaff-access .fs-panel{gap:18px;padding:18px;border-radius:16px}.futurestaff-access .fs-header{display:grid}.futurestaff-access .fs-header-actions{width:100%}.futurestaff-access .fs-header-actions button{flex:1}.futurestaff-access .fs-tenant{grid-template-columns:1fr;gap:12px}.futurestaff-access .fs-app-grid{grid-template-columns:1fr}.futurestaff-access .fs-state{grid-template-columns:1fr}.futurestaff-access .fs-state-mark{display:none}.futurestaff-access .fs-actions button{flex:1}.futurestaff-access .fs-summary{align-items:flex-start;flex-direction:column}.futurestaff-access .fs-count{align-self:flex-end}}
@media (prefers-reduced-motion: reduce){.futurestaff-access *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
`

function sameOriginMockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(`${ROUTE_PREFIX}${new URL(input instanceof Request ? input.url : input).pathname}`, init)
}

export async function beginPlatformDevLogin(
  fetcher: typeof fetch = fetch,
  opener: (url: string, target: string, features: string) => unknown = window.open.bind(window),
): Promise<void> {
  const response = await fetcher(DEV_LOGIN_ROUTE, {
    method: 'POST', headers: { accept: 'application/json', 'x-futurestaff-login': '1' },
  })
  let body: unknown
  try { body = await response.json() } catch { throw new Error('FutureStaff login is unavailable.') }
  if (!response.ok || body === null || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).join(',') !== 'authorizationUrl') throw new Error('FutureStaff login is unavailable.')
  const value = (body as { authorizationUrl?: unknown }).authorizationUrl
  if (typeof value !== 'string') throw new Error('FutureStaff login is unavailable.')
  let url: URL
  try { url = new URL(value) } catch { throw new Error('FutureStaff login is unavailable.') }
  const keys = [...url.searchParams.keys()].sort().join(',')
  if (url.origin + url.pathname !== 'https://dev.fsstory.net/login'
    || url.username !== '' || url.password !== '' || url.hash !== ''
    || keys !== 'client_id,code_challenge,code_challenge_method,redirect_uri,state'
    || url.searchParams.get('client_id') !== 'futurestaff-agent-pc-dev'
    || url.searchParams.get('redirect_uri') !== 'http://127.0.0.1:43821/callback'
    || url.searchParams.get('code_challenge_method') !== 'S256'
    || !/^[A-Za-z0-9_-]{43}$/u.test(url.searchParams.get('state') ?? '')
    || !/^[A-Za-z0-9_-]{43}$/u.test(url.searchParams.get('code_challenge') ?? '')) {
    throw new Error('FutureStaff login is unavailable.')
  }
  opener(url.href, '_blank', 'noopener,noreferrer')
}

export async function getProductHubApplicationToken(
  activeTenantId: string,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const unavailable = (): Error => new Error('Product Hub authorization is unavailable.')
  let response: Response
  try {
    response = await fetcher(PRODUCT_HUB_TOKEN_ROUTE, {
      method: 'POST',
      headers: { accept: 'application/json', 'x-futurestaff-application': 'product_hub' },
      cache: 'no-store',
    })
  } catch { throw unavailable() }
  let value: unknown
  try { value = await response.json() } catch { throw unavailable() }
  if (!response.ok || value === null || typeof value !== 'object' || Array.isArray(value)) throw unavailable()
  const token = value as Record<string, unknown>
  const permissions = token.permissions
  if (Object.keys(token).sort().join(',') !== 'accessToken,audience,expiresIn,permissions,tenantId,tokenType'
    || typeof token.accessToken !== 'string' || !/^[\x21-\x7e]{20,8192}$/u.test(token.accessToken)
    || token.tokenType !== 'Bearer' || token.expiresIn !== 60
    || token.audience !== 'futurestaff-product-hub-dev' || token.tenantId !== activeTenantId
    || !Array.isArray(permissions) || permissions.length === 0
    || permissions.some(permission => typeof permission !== 'string'
      || !/^product_hub\.[a-z][a-z0-9_]*$/u.test(permission))
    || new Set(permissions).size !== permissions.length) throw unavailable()
  return token.accessToken
}

export class PlatformDevClientUnavailableError extends Error {
  constructor() {
    super('FutureStaff desktop session service is unavailable.')
    this.name = 'PlatformDevClientUnavailableError'
  }
}

export async function getPlatformDevAccessSnapshot(
  fetcher: typeof fetch = fetch,
): Promise<PlatformAccessSnapshot> {
  let response: Response
  try {
    response = await fetcher(`${DEV_ROUTE_PREFIX}/session`, {
      method: 'GET', headers: { accept: 'application/json', 'x-futurestaff-session': '1' },
      cache: 'no-store',
    })
  } catch { throw new Error('session request failed') }
  if (response.status === 404) throw new PlatformDevClientUnavailableError()
  let value: unknown
  try { value = await response.json() } catch { throw new Error('session response invalid') }
  if (!response.ok) throw new Error('session request rejected')
  try { return decodePlatformDevAccessSnapshot(value) } catch { throw new Error('session response invalid') }
}

type Listener = () => void
type Opener = (url: string, target: string, features: string) => unknown

const initialDevSnapshot: PlatformAccessSnapshot = Object.freeze({
  phase: 'signed_out', simulated: false, contractVersion: '0.1.1',
  tenants: Object.freeze([]), applications: Object.freeze([]), models: Object.freeze([]),
})

export class PlatformDevClientController {
  #snapshot: PlatformAccessSnapshot = initialDevSnapshot
  #generation = 0
  readonly #listeners = new Set<Listener>()

  constructor(
    private readonly fetcher: typeof fetch = fetch,
    private readonly opener: Opener = window.open.bind(window),
  ) {}

  getSnapshot = (): PlatformAccessSnapshot => this.#snapshot

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener)
    return () => this.#listeners.delete(listener)
  }

  async restore(): Promise<void> {
    const generation = ++this.#generation
    this.#publish({ ...initialDevSnapshot, phase: 'loading' })
    try {
      const snapshot = await this.#request('/session', { method: 'GET' })
      if (generation === this.#generation) this.#publish(snapshot)
    } catch (error) {
      if (error instanceof PlatformDevClientUnavailableError) {
        if (generation === this.#generation) this.#publishFailure()
        throw error
      }
      if (generation === this.#generation) this.#publishFailure()
    }
  }

  async startLogin(): Promise<void> {
    const generation = ++this.#generation
    this.#publish({ ...initialDevSnapshot, phase: 'loading' })
    try { await beginPlatformDevLogin(this.fetcher, this.opener) } catch {
      if (generation === this.#generation) this.#publishFailure()
    }
  }

  async loginWithPassword(input: PasswordLoginInput): Promise<void> {
    const generation = ++this.#generation
    this.#publish({ ...initialDevSnapshot, phase: 'loading' })
    try {
      const snapshot = await this.#request('/auth/password', {
        method: 'POST',
        body: JSON.stringify(input),
        headers: { 'x-futurestaff-login': '1' },
      })
      if (generation === this.#generation) this.#publish(snapshot)
    } catch {
      if (generation === this.#generation) this.#publish({
        ...initialDevSnapshot,
        phase: 'error',
        error: { code: 'AUTHENTICATION_REQUIRED', message: '账号或密码错误，请重新输入。', retryable: true },
      })
    }
  }

  async refresh(): Promise<void> { await this.#action('/session/refresh') }
  async logout(): Promise<void> { await this.#action('/session/logout') }

  async switchTenant(tenantId: string): Promise<void> {
    if (!this.#snapshot.tenants.some(tenant => tenant.tenantId === tenantId)) return this.#publishFailure()
    await this.#action('/session/switch', { tenantId })
  }

  async #action(path: string, body?: unknown): Promise<void> {
    const generation = ++this.#generation
    this.#publish({ ...this.#snapshot, phase: 'loading', applications: Object.freeze([]) })
    try {
      const snapshot = await this.#request(path, {
        method: 'POST',
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      })
      if (generation === this.#generation) this.#publish(snapshot)
    } catch { if (generation === this.#generation) this.#publishFailure() }
  }

  async #request(path: string, init: RequestInit): Promise<PlatformAccessSnapshot> {
    if (path === '/session' && init.method === 'GET') return getPlatformDevAccessSnapshot(this.fetcher)
    let response: Response
    try {
      response = await this.fetcher(`${DEV_ROUTE_PREFIX}${path}`, {
        ...init,
        headers: {
          accept: 'application/json', 'x-futurestaff-session': '1',
          ...init.headers,
          ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        },
      })
    } catch {
      throw new Error('session request failed')
    }
    if (response.status === 404) throw new PlatformDevClientUnavailableError()
    let value: unknown
    try { value = await response.json() } catch { throw new Error('session response invalid') }
    if (!response.ok) throw new Error('session request rejected')
    try { return decodePlatformDevAccessSnapshot(value) } catch { throw new Error('session response invalid') }
  }

  #publishFailure(): void {
    this.#publish({
      ...initialDevSnapshot,
      phase: 'error',
      error: { code: 'PLATFORM_UNAVAILABLE', message: '无法连接 FutureStaff 桌面会话服务。', retryable: true },
    })
  }

  #publish(snapshot: PlatformAccessSnapshot): void {
    this.#snapshot = Object.freeze(snapshot)
    for (const listener of this.#listeners) listener()
  }
}

export function FutureStaffPlatformAccessSection() {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (root.current === null) return
    const element = root.current
    const dev = new PlatformDevClientController()
    let controller: PlatformDevClientController | PlatformAccessController = dev
    let dispose = mountPlatformAccessPanel(element, dev)
    let active = true
    void dev.restore().catch(error => {
      if (!active || !(error instanceof PlatformDevClientUnavailableError)) return
      dispose()
      controller = new PlatformAccessController(new PlatformMockApi(sameOriginMockFetch), new InMemoryTenantResources())
      dispose = mountPlatformAccessPanel(element, controller)
    })
    const restoreOnFocus = (): void => { if (controller === dev) void dev.restore() }
    window.addEventListener('focus', restoreOnFocus)
    return () => {
      active = false
      window.removeEventListener('focus', restoreOnFocus)
      dispose()
    }
  }, [])
  return createElement('div', { className: 'futurestaff-access' },
    createElement('style', null, platformAccessPanelCss),
    createElement('div', { ref: root }),
  )
}

export function shouldShowPlatformLoginGate(snapshot: PlatformAccessSnapshot): boolean {
  return snapshot.phase !== 'ready' && snapshot.phase !== 'no_apps'
}

function FutureStaffPlatformLoginGate() {
  const controllerRef = useRef<PlatformDevClientController | null>(null)
  if (controllerRef.current === null) controllerRef.current = new PlatformDevClientController()
  const controller = controllerRef.current
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void controller.restore().catch(() => {})
  }, [controller])

  useEffect(() => {
    if (root.current === null || !shouldShowPlatformLoginGate(snapshot)) return
    return mountPlatformAccessPanel(root.current, controller)
  }, [controller, snapshot.phase])

  if (!shouldShowPlatformLoginGate(snapshot)) return null
  return createElement('section', {
    className: 'futurestaff-login-gate', role: 'dialog', 'aria-modal': true,
    'aria-label': '登录 FutureStaff',
  }, createElement('div', { className: 'futurestaff-access' },
    createElement('style', null, platformAccessPanelCss),
    createElement('div', { ref: root }),
  ))
}

export const inject = ['slots']

/** Mount account access in Settings and require it before the desktop workspace is usable. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'futurestaff-access', order: -10, label: 'FutureStaff',
  }, FutureStaffPlatformAccessSection))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'futurestaff-login-gate', order: -100,
  }, FutureStaffPlatformLoginGate))
}
