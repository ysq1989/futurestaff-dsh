import type { Context } from '@deepseek-ai/cordis'
import type { PlatformDevAccessSnapshot } from './dev-access.js'

/** Product-owned default route: stored upstream provider settings cannot override it. */
export function apply(ctx: Context, access?: {
  snapshot(): PlatformDevAccessSnapshot
  authorize(modelId: string): Promise<unknown>
}): void {
  const selections = new Map<string, string>()
  const owner = () => { const state = access?.snapshot(); return state?.user && state.activeTenantId ? `${state.user.userId}:${state.activeTenantId}` : null }
  ctx.provide('agentDefaultModel', Object.freeze({
    currentSelection: () => {
      const key = owner(), model = key ? selections.get(key) : undefined
      return { provider: 'futurestaff', model: model && access?.snapshot().models.some(item => item.modelId === model) ? model : 'default' }
    },
    saveSelection: async (selection: { provider: string; model: string }) => {
      if (!access || selection.provider !== 'futurestaff') throw new Error('模型由 FutureStaff 平台管理。')
      const key = owner()
      if (!key) throw new Error('请先登录 FutureStaff。')
      if (selection.model === 'default') { selections.delete(key); return }
      await access.authorize(selection.model)
      if (key !== owner()) throw new Error('主体已切换。')
      selections.set(key, selection.model)
    },
  }))
}
