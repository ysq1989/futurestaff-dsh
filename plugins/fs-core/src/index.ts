import type { Context } from '@deepseek-ai/cordis'
import '@deepseek-ai/dsh-tools'

import {
  localRunnerApprovalDecision,
  douyinDmApprovalDecision,
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
  toolScope?: 'douyin-only'
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    futurestaffContext: ReturnType<typeof createIdentityContext>
  }
}

export function apply(ctx: Context, config: Config): void {
  assertIdentityMode(config.identityMode)
  if (config.toolScope !== undefined && config.toolScope !== 'douyin-only') throw new Error('Unknown FutureStaff Tool scope')
  const visaAccessRole = assertVietnamVisaAccessRole(config.visaAccessRole)
  ctx.provide('futurestaffContext', createIdentityContext(config))
  ctx.on('tools/pre-execute', async (execution, next) => {
    if (config.toolScope === 'douyin-only') {
      const decision = douyinDmApprovalDecision(execution.name)
      if (decision) return decision
      if (['douyin_dm_preview', 'douyin_dm_status', 'douyin_dm_pause']
        .some(name => execution.name === `mcp__douyin-dm__${name}`)) return { kind: 'allow' }
      return { kind: 'deny', reason: '此独立抖音实例只允许已登记的私信工具。' }
    }
    return productHubApprovalDecision(execution.name)
      ?? douyinDmApprovalDecision(execution.name)
      ?? vietnamVisaApprovalDecision(execution.name, visaAccessRole)
      ?? localRunnerApprovalDecision(execution.name)
      ?? next()
  })
}
