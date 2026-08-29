import type { PreToolDecision } from '@deepseek-ai/dsh-tools'

export type ProductHubToolClassification = 'not-applicable' | 'read' | 'write'
export type VietnamVisaToolClassification =
  | 'not-applicable'
  | 'read'
  | 'collector-write'
  | 'operator-only'
  | 'unknown'
export type VietnamVisaAccessRole = 'collector' | 'operator'

export function assertVietnamVisaAccessRole(value: string | undefined): VietnamVisaAccessRole {
  if (value === undefined || value === '' || value === 'collector') return 'collector'
  if (value === 'operator') return 'operator'
  throw new Error('VISA_ACCESS_ROLE must be collector or operator')
}

const PRODUCT_HUB_TOOL_PREFIX = 'mcp__product-hub__product_hub_'

// This is intentionally a read allowlist. New Product Hub tools therefore
// require approval until they are explicitly reviewed and classified as read-only.
const PRODUCT_HUB_READ_TOOLS = new Set([
  `${PRODUCT_HUB_TOOL_PREFIX}products_search`,
  `${PRODUCT_HUB_TOOL_PREFIX}pools_list`,
  `${PRODUCT_HUB_TOOL_PREFIX}pool_get`,
  `${PRODUCT_HUB_TOOL_PREFIX}design_get`,
])

const VIETNAM_VISA_TOOL_PREFIX = 'mcp__vietnam-visa__'
const VIETNAM_VISA_READ_TOOLS = new Set([
  'visa_cases_list',
  'visa_case_status_read',
  'visa_applications_list',
  'visa_application_status_read',
  'visa_materials_list',
])
const VIETNAM_VISA_COLLECTOR_WRITE_TOOLS = new Set([
  'visa_order_create',
  'visa_source_material_upload',
  'visa_applicant_upsert',
])
const VIETNAM_VISA_OPERATOR_TOOLS = new Set([
  'visa_application_submit',
  'visa_application_payment_link',
  'visa_case_query_status',
  'visa_application_query_status',
  'visa_case_cancel',
  'visa_case_complete',
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

export function classifyVietnamVisaTool(name: string): VietnamVisaToolClassification {
  if (!name.startsWith(VIETNAM_VISA_TOOL_PREFIX)) return 'not-applicable'
  const tool = name.slice(VIETNAM_VISA_TOOL_PREFIX.length)
  if (VIETNAM_VISA_READ_TOOLS.has(tool)) return 'read'
  if (VIETNAM_VISA_COLLECTOR_WRITE_TOOLS.has(tool)) return 'collector-write'
  if (VIETNAM_VISA_OPERATOR_TOOLS.has(tool)) return 'operator-only'
  return 'unknown'
}

export function vietnamVisaApprovalDecision(
  name: string,
  role: VietnamVisaAccessRole,
): PreToolDecision | undefined {
  const classification = classifyVietnamVisaTool(name)
  if (classification === 'not-applicable' || classification === 'read') return undefined
  if (classification === 'unknown') {
    return { kind: 'deny', reason: '此越南签证工具尚未完成权限分类，已默认拒绝。' }
  }
  if (classification === 'operator-only' && role === 'collector') {
    return { kind: 'deny', reason: '当前 DSH 是收单端，不能执行越南签证管理端操作。' }
  }
  return { kind: 'ask', reason: '此操作会创建或修改越南签证业务数据，请确认是否执行。' }
}
