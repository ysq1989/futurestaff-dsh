import type { Context } from '@deepseek-ai/cordis'

/** Product-owned default route: stored upstream provider settings cannot override it. */
export function apply(ctx: Context): void {
  ctx.provide('agentDefaultModel', Object.freeze({
    currentSelection: () => ({ provider: 'futurestaff', model: 'default' }),
    saveSelection: async () => { throw new Error('模型由 FutureStaff 平台管理。') },
  }))
}
