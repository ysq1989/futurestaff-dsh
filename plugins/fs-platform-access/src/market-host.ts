import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { fetchRecipes, LocalRoleStore } from './market.js'
import type { WorkspaceIdentity } from './workspace.js'

interface Presets { list(): Promise<{ id: string; path: string; broken?: string }[]> }
interface Settings { update(namespace: string, patch: { default: string }): Promise<void> }
interface Credentials { accessToken: string; tenantId: string; userId: string; signal: AbortSignal }
export function mountMarket(ctx: Context, origin: string, identity: WorkspaceIdentity, root: string,
  authorize: () => Promise<Credentials>): void {
  const store = new LocalRoleStore(root)
  let queue: Promise<unknown> = Promise.resolve()
  for (const [suffix, method] of [['catalog', 'GET'], ['mine', 'GET'], ['install', 'POST']] as const) {
    ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: `/_futurestaff/agent-market/${suffix}`,
      handler: async (request, response) => {
        const send = (status: number, body: unknown) => {
          response.statusCode = status
          response.setHeader('content-type', 'application/json; charset=utf-8')
          response.setHeader('cache-control', 'no-store')
          response.setHeader('x-content-type-options', 'nosniff')
          response.end(JSON.stringify(body))
        }
        if (request.method !== method || request.headers['x-futurestaff-market'] !== '1'
          || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket.remoteAddress ?? '')) return send(403, { error: 'LOCAL_REQUEST_REQUIRED' })
        try {
          const credentials = await authorize()
          if (credentials.tenantId !== identity.tenantId || credentials.userId !== identity.userId) throw new Error('MARKET_IDENTITY')
          if (suffix === 'mine') {
            const roles = await store.list(); credentials.signal.throwIfAborted()
            return send(200, { items: roles.map(({ presetId, recipe: { instructions: _instructions, skills: _skills, ...card } }) => ({ presetId, ...card })) })
          }
          const recipes = await fetchRecipes(origin, credentials)
          if (suffix === 'catalog') return send(200, { items: recipes.map(({ instructions: _instructions, skills: _skills, ...card }) => card) })
          let raw = ''; for await (const chunk of request) {
            raw += chunk.toString(); if (Buffer.byteLength(raw) > 1024) throw new Error('MARKET_REQUEST')
          }
          const body = JSON.parse(raw)
          if (Object.keys(body).sort().join() !== 'templateId,version') throw new Error('MARKET_REQUEST')
          const recipe = recipes.find(r => r.templateId === body.templateId && r.version === body.version)
          if (!recipe) throw new Error('MARKET_STALE')
          const presets = ctx.get('agentPresets') as Presets | undefined
          const baseline = (await presets?.list())?.find(r => r.id === 'standard' && !r.broken)
          if (!baseline) throw new Error('MARKET_RUNTIME_UNAVAILABLE')
          const install = () => store.install(recipe, path.dirname(baseline.path),
            fileURLToPath(new URL('./role.js', import.meta.url)), credentials.signal)
          const pending = queue.then(install, install); queue = pending.catch(() => {})
          const presetId = await pending
          credentials.signal.throwIfAborted()
          if (!(await presets?.list())?.some(r => r.id === presetId && !r.broken)) throw new Error('MARKET_RUNTIME_UNAVAILABLE')
          const settings = ctx.get('settings') as Settings | undefined
          if (!settings) throw new Error('MARKET_RUNTIME_UNAVAILABLE')
          // A real settings update refreshes the native picker and only affects new sessions.
          await settings.update('agent-presets', { default: presetId })
          send(200, { presetId })
        } catch { send(409, { error: 'MARKET_UNAVAILABLE' }) }
      },
    }), `futurestaff agent market ${suffix}`)
  }
}
