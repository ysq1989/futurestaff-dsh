import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-tools'

import {
  localRunnerApprovalDecision,
  productHubApprovalDecision,
  assertVietnamVisaAccessRole,
  vietnamVisaApprovalDecision,
} from './approval-policy.js'
import { assertIdentityMode, createIdentityContext } from './contracts.js'
export * from './approval-policy.js'
export * from './contracts.js'

export const name = 'futurestaff-core'
export const inject = ['tools']

export interface Config {
  identityMode: string
  tenantId: string
  userId: string
  deviceId?: string
  visaAccessRole?: string
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    futurestaffContext: ReturnType<typeof createIdentityContext>
  }
}

export function apply(ctx: Context, config: Config): void {
  assertIdentityMode(config.identityMode)
  const visaAccessRole = assertVietnamVisaAccessRole(config.visaAccessRole)
  ctx.provide('futurestaffContext', createIdentityContext(config))
  ctx.on('tools/pre-execute', async (execution, next) => {
    return productHubApprovalDecision(execution.name)
      ?? vietnamVisaApprovalDecision(execution.name, visaAccessRole)
      ?? localRunnerApprovalDecision(execution.name)
      ?? next()
  })
}
