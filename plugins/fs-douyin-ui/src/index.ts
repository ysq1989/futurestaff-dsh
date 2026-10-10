import { AccountBrowser } from './account-browser.js'
import type { WatchCollector } from './watch-monitor.js'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@futurestaff/fs-platform-access'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { BrowserAdapter, browserConfigSchema } from '@futurestaff/douyin-dm-mcp/browser'
import { LeadDatabase } from './database.js'
import { DouyinService } from './service.js'

export const inject = ['webServer', 'platformDevLogin', 'platformInference']
export const routePath = '/_futurestaff/douyin/v1/workspace'
const configSchema = z.object({ database: z.string().refine(path.isAbsolute).optional(),
  live: z.boolean().default(false), browser: browserConfigSchema.optional() }).strict()

export function requestAllowed(request: IncomingMessage) {
  if (!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')
    || request.headers['x-futurestaff-douyin'] !== '1' || request.headers['sec-fetch-site'] === 'cross-site') return false
  try {
    const host = new URL(`http://${request.headers.host}`)
    if (!['127.0.0.1','[::1]','localhost'].includes(host.hostname) || host.username || host.password) return false
    const origin = request.headers.origin
    if (origin && (typeof origin !== 'string' || new URL(origin).host !== host.host || !['http:','https:'].includes(new URL(origin).protocol))) return false
    return true
  } catch { return false }
}
function json(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.setHeader('x-content-type-options', 'nosniff')
  response.end(JSON.stringify(value))
}
export function createHandler(service: DouyinService) {
  return async (request: IncomingMessage, response: ServerResponse) => {
    if (!requestAllowed(request)) return json(response, 403, { error: 'LOCAL_REQUEST_REQUIRED' })
    if (!['GET','POST'].includes(request.method ?? '')) return json(response, 405, { error: 'METHOD_NOT_ALLOWED' })
    try {
      if (request.method === 'GET') return json(response, 200, await service.snapshot())
      if (request.headers['content-type'] !== 'application/json') return json(response, 415, { error: 'JSON_REQUIRED' })
      let size = 0; const chunks: Buffer[] = []
      for await (const raw of request) {
        const chunk = Buffer.from(raw); size += chunk.length
        if (size > 32768) return json(response, 413, { error: 'REQUEST_LIMIT' })
        chunks.push(chunk)
      }
      return json(response, 200, await service.act(JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown))
    } catch (error) {
      // Do not reflect model output, user data, local paths or platform diagnostics.
      const safeCodes = ['ACCOUNT_CHECK_FAILED', 'BROWSER_REQUIRED', 'BROWSER_PROFILE_PATH_TOO_LONG', 'BROWSER_START_FAILED', 'BROWSER_START_TIMEOUT', 'BROWSER_TAB_FAILED', 'ACCOUNT_LOGIN_REQUIRED', 'LIBRARY_INCOMPLETE', 'LIBRARY_PANEL_REQUIRED', 'LIBRARY_ACCOUNT_PAGE_REQUIRED', 'LIBRARY_EXPIRED', 'LIBRARY_ITEM_UNAVAILABLE', 'LIBRARY_ACCOUNT_CHANGED', 'WATCH_LIMIT', 'COLLECTOR_NOT_READY', 'PAUSE_SENDING_FIRST', 'MODEL_REQUIRED', 'WATCH_REQUIRED']
      const code = error instanceof Error && [...safeCodes,'ACQUISITION_NOT_READY','SEND_NOT_READY','SEND_CANDIDATE_REQUIRED','SEND_RECIPIENT_UNVERIFIED','SEND_ACCOUNT_CHANGED'].includes(error.message) ? error.message : 'ACTION_UNAVAILABLE'
      json(response, 409, { error: code })
    }
  }
}
export function apply(ctx: Context, input: unknown = {}) {
  const config = configSchema.parse(input)
  if (config.live && (!config.browser || /REPLACE_WITH_|data-operator-verified-/.test(JSON.stringify(config.browser))))
    throw new Error('LIVE_CONFIG_NOT_CALIBRATED')
  const profiles = ctx.get('desktopProfiles') as { current?: { dir?: string } } | undefined
  // Keep mutable data outside managed Profile files so upgrades never replace it.
  const profileScope = profiles?.current?.dir ? createHash('sha256').update(profiles.current.dir).digest('hex') : 'local'
  const database = config.database ?? path.join(os.homedir(), '.futurestaff', 'douyin', profileScope, 'leads.sqlite')
  const accounts = new AccountBrowser(path.join(path.dirname(database), 'browser-accounts'))
  const service = new DouyinService(new LeadDatabase(database), () => ctx.platformDevLogin.authorizeLocal(),
    ctx.platformInference, config.browser ? new BrowserAdapter(config.browser) : undefined, config.live, accounts,
    (ctx.get('douyinWatchCollector') as WatchCollector | undefined) ?? accounts, accounts,
    {ready:owner=>accounts.senderReady(owner),check:(owner,recipient,signal)=>accounts.checkSender(owner,recipient,signal),adapter:owner=>accounts.sender(owner)})
  ctx.provide('douyinLeads', service)
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: routePath, handler: createHandler(service) }), 'futurestaff-douyin: local workspace')
  ctx.effect(() => {
    let ticking = false
    const timer = setInterval(() => {
      if (ticking) return
      ticking = true
      void service.tick().catch(() => {}).finally(() => { ticking = false })
    }, 1000)
    timer.unref()
    return async () => { clearInterval(timer); await service.close() }
  }, 'futurestaff-douyin: local database and scheduler lifecycle')
}
declare module '@deepseek-ai/cordis' { interface Context { douyinLeads: DouyinService } }
