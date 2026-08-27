import type { Context } from '@deepseek-ai/cordis'

import { createIdentityContext } from './contracts.js'
export * from './contracts.js'

export const name = 'futurestaff-core'

export interface Config {
  tenantId: string
  userId: string
  deviceId?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    futurestaffContext: ReturnType<typeof createIdentityContext>
  }
}

export function apply(ctx: Context, config: Config): void {
  ctx.provide('futurestaffContext', createIdentityContext(config))
}
