import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-tools'

import { productHubApprovalDecision } from './approval-policy.js'
import { createIdentityContext } from './contracts.js'
export * from './approval-policy.js'
export * from './contracts.js'

export const name = 'futurestaff-core'
export const inject = ['tools']

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
  ctx.on('tools/pre-execute', async (execution, next) => {
    return productHubApprovalDecision(execution.name) ?? next()
  })
}
