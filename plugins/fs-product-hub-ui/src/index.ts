import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

const ROUTE_PREFIX = '/_futurestaff/product-hub-ui'
const uiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'ui')
const assetPattern = /^(?:index\.html|favicon\.svg|jade-(?:ice|spring|water)\.svg|assets\/[A-Za-z0-9_.-]+\.(?:css|js|woff2))$/u
const contentTypes: Readonly<Record<string, string>> = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
})

export const inject = ['webServer']

function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

function reject(response: ServerResponse, status: number): void {
  response.statusCode = status
  response.setHeader('cache-control', 'no-store')
  response.setHeader('content-type', 'text/plain; charset=utf-8')
  response.setHeader('x-content-type-options', 'nosniff')
  response.end('Product Hub UI unavailable')
}

async function serve(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (!isLoopback(request.socket.remoteAddress)) return reject(response, 403)
  if (request.method !== 'GET' && request.method !== 'HEAD') return reject(response, 405)
  let pathname: string
  try { pathname = new URL(request.url ?? '', 'http://127.0.0.1').pathname } catch { return reject(response, 400) }
  const relative = pathname === ROUTE_PREFIX || pathname === `${ROUTE_PREFIX}/`
    ? 'index.html'
    : pathname.slice(ROUTE_PREFIX.length + 1)
  if (!assetPattern.test(relative)) return reject(response, 404)
  try {
    const payload = await readFile(path.join(uiRoot, ...relative.split('/')))
    response.statusCode = 200
    response.setHeader('content-type', contentTypes[path.extname(relative)] ?? 'application/octet-stream')
    response.setHeader('cache-control', 'no-store')
    response.setHeader('x-content-type-options', 'nosniff')
    response.setHeader('referrer-policy', 'no-referrer')
    response.setHeader('content-security-policy', "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' https://dev.fsstory.net https://product-dev.fsstory.net; frame-ancestors 'self'; base-uri 'none'; form-action 'none'; object-src 'none'")
    response.setHeader('content-length', String(payload.length))
    response.end(request.method === 'HEAD' ? undefined : payload)
  } catch { reject(response, 404) }
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix', path: ROUTE_PREFIX, handler: serve,
  }), 'futurestaff-product-hub-ui: built UI assets')
}
