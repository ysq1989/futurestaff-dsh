import assert from 'node:assert/strict'
import test from 'node:test'

import {
  classifyProductHubTool,
  createIdentityContext,
  defineToolMetadata,
  apply,
  assertIdentityMode,
  localRunnerApprovalDecision,
  productHubApprovalDecision,
  classifyVietnamVisaTool,
  vietnamVisaApprovalDecision,
  assertVietnamVisaAccessRole,
} from '../lib/index.js'

test('identity context passes configured tenant, user, and device identifiers through', () => {
  const context = createIdentityContext({ tenantId: 'tenant-1', userId: 'user-1', deviceId: 'office-pc' })
  assert.deepEqual(context.current(), { tenantId: 'tenant-1', userId: 'user-1', deviceId: 'office-pc' })
})

test('identity context rejects blank identifiers at the boundary', () => {
  assert.throws(() => createIdentityContext({ tenantId: ' ', userId: 'user-1' }), /tenantId/)
})

test('Alpha accepts only an explicitly single-subject identity mode', () => {
  assert.equal(assertIdentityMode('single-subject'), 'single-subject')
  assert.throws(() => assertIdentityMode('request-scoped'), /not implemented/)
  assert.throws(() => assertIdentityMode(''), /FUTURESTAFF_IDENTITY_MODE/)
})

test('local tools must select a device', () => {
  assert.throws(() => defineToolMetadata({ execution: 'local', requiresApproval: true, tenantScoped: true }), /deviceId/)
})

test('local tools cannot bypass approval', () => {
  assert.throws(() => defineToolMetadata({ execution: 'local', requiresApproval: false, tenantScoped: true, deviceId: 'pc-1' }), /approval/)
})

test('cloud tools cannot select a local device', () => {
  assert.throws(() => defineToolMetadata({ execution: 'cloud', requiresApproval: false, tenantScoped: true, deviceId: 'pc-1' }), /cloud/)
})

test('valid tool metadata is frozen before registration', () => {
  const metadata = defineToolMetadata({ execution: 'local', requiresApproval: true, tenantScoped: true, deviceId: 'office-pc' })
  assert.equal(Object.isFrozen(metadata), true)
})

test('Product Hub read tools execute without approval', () => {
  assert.equal(
    classifyProductHubTool('mcp__product-hub__product_hub_products_search'),
    'read',
  )
  assert.equal(
    productHubApprovalDecision('mcp__product-hub__product_hub_products_search'),
    undefined,
  )
  assert.equal(
    classifyProductHubTool('mcp__product-hub__product_hub_pool_get'),
    'read',
  )
  assert.equal(
    productHubApprovalDecision('mcp__product-hub__product_hub_pool_get'),
    undefined,
  )
})

test('known Product Hub write tools require approval', () => {
  assert.equal(
    classifyProductHubTool('mcp__product-hub__product_hub_pools_create'),
    'write',
  )
  assert.deepEqual(
    productHubApprovalDecision('mcp__product-hub__product_hub_pools_create'),
    {
      kind: 'ask',
      reason: '此操作会修改选品中心数据，请确认是否执行。',
    },
  )
})

test('unknown future Product Hub tools fail closed and require approval', () => {
  assert.equal(
    classifyProductHubTool('mcp__product-hub__product_hub_future_mutation'),
    'write',
  )
  assert.equal(
    productHubApprovalDecision('mcp__product-hub__product_hub_future_mutation')?.kind,
    'ask',
  )
})

test('unrelated tools are outside the Product Hub approval policy', () => {
  assert.equal(classifyProductHubTool('web_search'), 'not-applicable')
  assert.equal(productHubApprovalDecision('web_search'), undefined)
})

test('local system info requires explicit approval before contacting the device', () => {
  assert.deepEqual(localRunnerApprovalDecision('mcp__local-runner__local_system_info'), {
    kind: 'ask', reason: '此操作会读取当前电脑的系统信息，请确认是否执行。',
  })
  assert.equal(localRunnerApprovalDecision('web_search'), undefined)
})

test('fs-core registers the approval policy in the DSH pre-execution pipeline', async () => {
  let listener
  const context = {
    provide() {},
    on(event, callback) {
      assert.equal(event, 'tools/pre-execute')
      listener = callback
    },
  }

  apply(context, { identityMode: 'single-subject', tenantId: 'tenant-1', userId: 'user-1' })

  assert.deepEqual(
    await listener(
      { name: 'mcp__product-hub__product_hub_pools_create' },
      async () => ({ kind: 'allow' }),
    ),
    { kind: 'ask', reason: '此操作会修改选品中心数据，请确认是否执行。' },
  )
  assert.deepEqual(
    await listener(
      { name: 'mcp__product-hub__product_hub_products_search' },
      async () => ({ kind: 'allow' }),
    ),
    { kind: 'allow' },
  )
  assert.deepEqual(
    await listener(
      { name: 'mcp__local-runner__local_system_info' },
      async () => ({ kind: 'allow' }),
    ),
    { kind: 'ask', reason: '此操作会读取当前电脑的系统信息，请确认是否执行。' },
  )
  assert.deepEqual(
    await listener(
      { name: 'mcp__vietnam-visa__visa_order_create' },
      async () => ({ kind: 'allow' }),
    ),
    { kind: 'ask', reason: '此操作会创建或修改越南签证业务数据，请确认是否执行。' },
  )
  assert.deepEqual(
    await listener(
      { name: 'mcp__vietnam-visa__visa_application_submit' },
      async () => ({ kind: 'allow' }),
    ),
    { kind: 'deny', reason: '当前 DSH 是收单端，不能执行越南签证管理端操作。' },
  )
})

test('Vietnam visa read tools execute without approval', () => {
  const name = 'mcp__vietnam-visa__visa_case_status_read'
  assert.equal(classifyVietnamVisaTool(name), 'read')
  assert.equal(vietnamVisaApprovalDecision(name, 'collector'), undefined)
})

test('Vietnam visa collector writes require explicit approval', () => {
  const name = 'mcp__vietnam-visa__visa_order_create'
  assert.equal(classifyVietnamVisaTool(name), 'collector-write')
  assert.deepEqual(vietnamVisaApprovalDecision(name, 'collector'), {
    kind: 'ask',
    reason: '此操作会创建或修改越南签证业务数据，请确认是否执行。',
  })
})

test('Vietnam visa operator capabilities are denied to a collector DSH', () => {
  for (const tool of [
    'visa_application_submit',
    'visa_application_payment_link',
    'visa_case_query_status',
    'visa_application_query_status',
    'visa_case_cancel',
    'visa_case_complete',
  ]) {
    const name = `mcp__vietnam-visa__${tool}`
    assert.equal(classifyVietnamVisaTool(name), 'operator-only')
    assert.deepEqual(vietnamVisaApprovalDecision(name, 'collector'), {
      kind: 'deny',
      reason: '当前 DSH 是收单端，不能执行越南签证管理端操作。',
    })
  }
})

test('unknown future Vietnam visa tools fail closed', () => {
  const name = 'mcp__vietnam-visa__visa_future_operation'
  assert.equal(classifyVietnamVisaTool(name), 'unknown')
  assert.deepEqual(vietnamVisaApprovalDecision(name, 'collector'), {
    kind: 'deny',
    reason: '此越南签证工具尚未完成权限分类，已默认拒绝。',
  })
})

test('Vietnam visa access role rejects invalid configuration', () => {
  assert.equal(assertVietnamVisaAccessRole(undefined), 'collector')
  assert.equal(assertVietnamVisaAccessRole('operator'), 'operator')
  assert.throws(() => assertVietnamVisaAccessRole('collecter'), /VISA_ACCESS_ROLE/)
})
