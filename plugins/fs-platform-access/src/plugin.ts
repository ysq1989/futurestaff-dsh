import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { PlatformDevApi } from './api.js'
import { PLATFORM_CONTRACT_VERSION, PLATFORM_MOCK_BASE_URL } from './contracts.js'
import { PlatformDevAccessController, type PlatformDevAccessSnapshot } from './dev-access.js'
import { PlatformDevLoginCoordinator } from './dev-login.js'
import { dispatchEmbeddedMock } from './embedded-mock.js'
import { InMemoryTenantResources } from './isolation.js'
import { PlatformPkceTransaction, platformPkceConstants } from './pkce.js'
import { PlatformSessionVault, type PlatformProtectedSecrets } from './session-vault.js'

const ROUTE_PREFIX = '/_futurestaff/platform-mock'
const MAX_REQUEST_BYTES = 64 * 1024
const routes = new Map<string, ReadonlySet<string>>([
  ['/desktop/v1/auth/callback', new Set(['POST'])],
  ['/desktop/v1/auth/refresh', new Set(['POST'])],
  ['/desktop/v1/auth/logout', new Set(['POST'])],
  ['/desktop/v1/tenants', new Set(['GET'])],
  ['/desktop/v1/tenants/switch', new Set(['POST'])],
  ['/desktop/v1/apps', new Set(['GET'])],
])

export const inject = ['webServer']

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function json(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('x-futurestaff-mock', 'true')
  response.setHeader('x-futurestaff-contract-version', PLATFORM_CONTRACT_VERSION)
  response.setHeader('content-length', String(Buffer.byteLength(payload)))
  response.end(payload)
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const raw of request) {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    size += chunk.length
    if (size > MAX_REQUEST_BYTES) throw new Error('REQUEST_TOO_LARGE')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

export interface PlatformAccessConfig { readonly embeddedMock?: boolean }

export interface PlatformDevLoginService {
  begin(): Promise<{ readonly authorizationUrl: string }>
  snapshot(): Promise<PlatformDevAccessSnapshot>
  refresh(): Promise<PlatformDevAccessSnapshot>
  switchTenant(tenantId: string): Promise<PlatformDevAccessSnapshot>
  logout(): Promise<PlatformDevAccessSnapshot>
  diagnostics(): Promise<{ readonly pending: boolean; readonly exchanging: boolean; readonly vault: 'stored' | 'empty' | 'unavailable' }>
  cancel(): void
}

function protectedSecrets(value: unknown): value is PlatformProtectedSecrets {
  if (value === null || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return ['available', 'has', 'read', 'write', 'delete'].every(key => typeof record[key] === 'function')
}

function callbackHtml(response: ServerResponse, status: number, success: boolean): void {
  const body = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FutureStaff</title><body><h1>${success ? 'Authorization complete' : 'Authorization failed'}</h1><p>${success ? 'You can return to FutureStaff Agent.' : 'Return to FutureStaff Agent and try again.'}</p></body></html>`
  response.statusCode = status
  response.setHeader('content-type', 'text/html; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('content-security-policy', "default-src 'none'; style-src 'none'; img-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('referrer-policy', 'no-referrer')
  response.setHeader('content-length', String(Buffer.byteLength(body)))
  response.end(body)
}

function loginJson(response: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.setHeader('content-length', String(Buffer.byteLength(payload)))
  response.end(payload)
}

function mountDevLogin(ctx: Context): void {
  if (typeof (ctx as unknown as { get?: unknown }).get !== 'function') return
  const secrets = ctx.get('desktopProtectedSecrets') as unknown
  if (!protectedSecrets(secrets)) return
  const api = new PlatformDevApi()
  const vault = new PlatformSessionVault(secrets)
  const access = new PlatformDevAccessController(api, vault, new InMemoryTenantResources())
  const coordinator = new PlatformDevLoginCoordinator({
    pkce: new PlatformPkceTransaction(), api, vault,
  })
  const initialized = access.restore()
  let server: Server | undefined
  let expiry: NodeJS.Timeout | undefined
  const close = (): void => {
    if (expiry !== undefined) clearTimeout(expiry)
    expiry = undefined
    server?.close()
    server = undefined
    coordinator.cancel()
  }
  const service: PlatformDevLoginService = Object.freeze({
    begin: async () => {
      if (server !== undefined) throw new Error('fs-platform-access: callback listener is already active.')
      const authorization = coordinator.begin()
      const listener = createServer(async (request, response) => {
        if (request.method !== 'GET') return callbackHtml(response, 405, false)
        if (!isLoopback(request.socket.remoteAddress) || request.headers.host !== '127.0.0.1:43821'
          || request.url === undefined || request.url.length > 2048) return callbackHtml(response, 400, false)
        try {
          await coordinator.complete(`http://127.0.0.1:43821${request.url}`)
          await access.restore()
          callbackHtml(response, 200, true)
        } catch {
          callbackHtml(response, 400, false)
        } finally {
          close()
        }
      })
      server = listener
      try {
        await new Promise<void>((resolve, reject) => {
          listener.once('error', reject)
          listener.listen(43821, '127.0.0.1', () => {
            listener.off('error', reject)
            listener.on('error', close)
            resolve()
          })
        })
        expiry = setTimeout(close, platformPkceConstants.transactionTtlMs)
        expiry.unref()
        return authorization
      } catch {
        close()
        throw new Error('fs-platform-access: callback listener is unavailable.')
      }
    },
    snapshot: async () => { await initialized; return access.getSnapshot() },
    refresh: () => access.refresh(),
    switchTenant: (tenantId: string) => access.switchTenant(tenantId),
    logout: () => access.logout(),
    diagnostics: () => coordinator.diagnostics(),
    cancel: close,
  })
  ctx.provide('platformDevLogin', service)
  ctx.effect(() => close, 'futurestaff-platform-access: Platform DEV callback listener lifecycle')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/_futurestaff/platform-dev/login',
    handler: async (request, response) => {
      if (request.method !== 'POST' || !isLoopback(request.socket.remoteAddress)
        || request.headers['x-futurestaff-login'] !== '1') {
        return loginJson(response, request.method === 'POST' ? 403 : 405, { error: 'LOGIN_UNAVAILABLE' })
      }
      try { loginJson(response, 200, await service.begin()) } catch {
        loginJson(response, 409, { error: 'LOGIN_UNAVAILABLE' })
      }
    },
  }), 'futurestaff-platform-access: start Platform DEV login')
  const guarded = (request: IncomingMessage): boolean => request.headers['x-futurestaff-session'] === '1'
    && isLoopback(request.socket.remoteAddress)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/_futurestaff/platform-dev/session',
    handler: async (request, response) => {
      if (request.method !== 'GET' || !guarded(request)) {
        return loginJson(response, request.method === 'GET' ? 403 : 405, { error: 'SESSION_UNAVAILABLE' })
      }
      try { loginJson(response, 200, await service.snapshot()) } catch {
        loginJson(response, 503, { error: 'SESSION_UNAVAILABLE' })
      }
    },
  }), 'futurestaff-platform-access: read safe Platform DEV session')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/_futurestaff/platform-dev/session/refresh',
    handler: async (request, response) => {
      if (request.method !== 'POST' || !guarded(request)) {
        return loginJson(response, request.method === 'POST' ? 403 : 405, { error: 'SESSION_UNAVAILABLE' })
      }
      try { loginJson(response, 200, await service.refresh()) } catch {
        loginJson(response, 409, { error: 'SESSION_UNAVAILABLE' })
      }
    },
  }), 'futurestaff-platform-access: refresh Platform DEV session')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/_futurestaff/platform-dev/session/switch',
    handler: async (request, response) => {
      if (request.method !== 'POST' || !guarded(request)) {
        return loginJson(response, request.method === 'POST' ? 403 : 405, { error: 'SESSION_UNAVAILABLE' })
      }
      try {
        const body = JSON.parse((await readBody(request)).toString('utf8')) as unknown
        if (body === null || typeof body !== 'object' || Array.isArray(body)
          || Object.keys(body).join(',') !== 'tenantId'
          || typeof (body as { tenantId?: unknown }).tenantId !== 'string') throw new Error('invalid tenant')
        loginJson(response, 200, await service.switchTenant((body as { tenantId: string }).tenantId))
      } catch {
        loginJson(response, 403, { error: 'SESSION_UNAVAILABLE' })
      }
    },
  }), 'futurestaff-platform-access: switch Platform DEV tenant')
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: '/_futurestaff/platform-dev/session/logout',
    handler: async (request, response) => {
      if (request.method !== 'POST' || !guarded(request)) {
        return loginJson(response, request.method === 'POST' ? 403 : 405, { error: 'SESSION_UNAVAILABLE' })
      }
      try { loginJson(response, 200, await service.logout()) } catch {
        loginJson(response, 409, { error: 'SESSION_UNAVAILABLE' })
      }
    },
  }), 'futurestaff-platform-access: clear Platform DEV session')
}

async function proxy(request: IncomingMessage, response: ServerResponse, path: string, embeddedMock: boolean): Promise<void> {
  const methods = routes.get(path)
  if (methods === undefined || request.method === undefined || !methods.has(request.method)) {
    json(response, 405, {
      error: { code: 'INVALID_REQUEST', message: 'The request does not match the contract.', retryable: false },
      meta: { contractVersion: PLATFORM_CONTRACT_VERSION, simulated: true },
    })
    return
  }
  if (!isLoopback(request.socket.remoteAddress)) {
    json(response, 403, {
      error: { code: 'AUTHENTICATION_REQUIRED', message: 'The local Mock bridge is loopback-only.', retryable: false },
      meta: { contractVersion: PLATFORM_CONTRACT_VERSION, simulated: true },
    })
    return
  }
  try {
    const body = await readBody(request)
    if (embeddedMock) {
      let parsed: unknown = null
      try { parsed = body.length === 0 ? null : JSON.parse(body.toString('utf8')) } catch { /* dispatched as invalid input */ }
      const result = dispatchEmbeddedMock(request.method, path, request.headers, parsed)
      json(response, result.status, result.body)
      return
    }
    const upstream = await fetch(`${PLATFORM_MOCK_BASE_URL}${path}`, {
      method: request.method,
      headers: {
        'content-type': 'application/json',
        ...(typeof request.headers.authorization === 'string' ? { authorization: request.headers.authorization } : {}),
      },
      body: body.length === 0 ? null : body.toString('utf8'),
    })
    const payload = Buffer.from(await upstream.arrayBuffer())
    response.statusCode = upstream.status
    response.setHeader('content-type', 'application/json; charset=utf-8')
    response.setHeader('cache-control', 'no-store')
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('x-futurestaff-mock', upstream.headers.get('x-futurestaff-mock') ?? '')
    response.setHeader('x-futurestaff-contract-version', upstream.headers.get('x-futurestaff-contract-version') ?? '')
    response.setHeader('content-length', String(payload.length))
    response.end(payload)
  } catch {
    json(response, 502, {
      error: { code: 'MOCK_UNAVAILABLE', message: 'The local FutureStaff Mock is unavailable.', retryable: true },
      meta: { contractVersion: PLATFORM_CONTRACT_VERSION, simulated: true },
    })
  }
}

/** Register six exact, loopback-only bridge routes for the pinned local Mock. */
export function apply(ctx: Context, config: PlatformAccessConfig = {}): void {
  for (const path of routes.keys()) {
    ctx.effect(() => ctx.webServer.register({
      kind: 'exact',
      path: `${ROUTE_PREFIX}${path}`,
      handler: (request, response) => proxy(request, response, path, config.embeddedMock === true),
    }), `futurestaff-platform-access: local Mock bridge ${path}`)
  }
  mountDevLogin(ctx)
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    platformDevLogin: PlatformDevLoginService
  }
}
