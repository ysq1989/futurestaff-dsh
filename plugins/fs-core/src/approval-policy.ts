import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

export type ProductHubToolClassification = 'not-applicable' | 'read' | 'write'

const PRODUCT_HUB_TOOL_PREFIX = 'mcp__product-hub__product_hub_'

// This is intentionally a read allowlist. New Product Hub tools therefore
// require approval until they are explicitly reviewed and classified as read-only.
const PRODUCT_HUB_READ_TOOLS = new Set([
  `${PRODUCT_HUB_TOOL_PREFIX}products_search`,
  `${PRODUCT_HUB_TOOL_PREFIX}pools_list`,
  `${PRODUCT_HUB_TOOL_PREFIX}pool_get`,
  `${PRODUCT_HUB_TOOL_PREFIX}design_get`,
])

export function classifyProductHubTool(name: string): ProductHubToolClassification {
  if (!name.startsWith(PRODUCT_HUB_TOOL_PREFIX)) return 'not-applicable'
  return PRODUCT_HUB_READ_TOOLS.has(name) ? 'read' : 'write'
}

export function productHubApprovalDecision(name: string): PreToolDecision | undefined {
  if (classifyProductHubTool(name) !== 'write') return undefined
  return {
    kind: 'ask',
    reason: '此操作会修改选品中心数据，请确认是否执行。',
  }
}

export function localRunnerApprovalDecision(name: string): PreToolDecision | undefined {
  if (name !== 'mcp__local-runner__local_system_info') return undefined
  return {
    kind: 'ask',
    reason: '此操作会读取当前电脑的系统信息，请确认是否执行。',
  }
}
