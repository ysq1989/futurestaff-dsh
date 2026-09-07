import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { PLATFORM_CONTRACT_VERSION, PLATFORM_MOCK_BASE_URL } from './contracts.js'
import { dispatchEmbeddedMock } from './embedded-mock.js'

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
}
