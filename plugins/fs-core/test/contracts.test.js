import assert from 'node:assert/strict'
import test from 'node:test'

import { createIdentityContext, defineToolMetadata } from '../lib/index.js'

test('identity context passes configured tenant, user, and device identifiers through', () => {
  const context = createIdentityContext({ tenantId: 'tenant-1', userId: 'user-1', deviceId: 'office-pc' })
  assert.deepEqual(context.current(), { tenantId: 'tenant-1', userId: 'user-1', deviceId: 'office-pc' })
})

test('identity context rejects blank identifiers at the boundary', () => {
  assert.throws(() => createIdentityContext({ tenantId: ' ', userId: 'user-1' }), /tenantId/)
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
