import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformSessionVault, PlatformSessionVaultError } from '../lib/index.js'

const tenantId = '10000000-0000-4000-8000-000000000001'
const record = {
  session: {
    accessToken: 'private-access-token-with-enough-entropy',
    refreshToken: 'private-refresh-token-with-enough-entropy',
    tokenType: 'Bearer', expiresIn: 900, audience: 'futurestaff-agent-pc-dev', activeTenantId: tenantId,
  },
  user: { userId: '20000000-0000-4000-8000-000000000001', displayName: '测试用户', email: 'user@example.invalid' },
}

class MemorySecrets {
  values = new Map()
  reads = 0
  async available() { return true }
  async has(key) { return this.values.has(key) }
  async read(key) { this.reads += 1; return this.values.get(key) }
  async write(key, value) { this.values.set(key, value) }
  async delete(key) { this.values.delete(key) }
}

test('session Vault persists and restores only through the protected service', async () => {
  const secrets = new MemorySecrets()
  const vault = new PlatformSessionVault(secrets)
  await vault.save(record)
  assert.equal(secrets.values.size, 1)
  assert.match([...secrets.values.values()][0], /private-access-token/)

  const restored = await vault.load()
  assert.deepEqual(restored, record)
  assert.deepEqual(await vault.diagnostics(), { available: true, state: 'stored' })
  assert.doesNotMatch(JSON.stringify(await vault.diagnostics()), /private-access|private-refresh/)
  assert.equal(secrets.reads, 1)

  await vault.clear()
  assert.equal(await vault.load(), undefined)
})

test('session Vault rejects malformed persisted identity without returning secrets', async () => {
  const secrets = new MemorySecrets()
  secrets.values.set('futurestaff.platform.session.v1', JSON.stringify({
    version: 1, contractVersion: '0.1.1', ...record,
    session: { ...record.session, activeTenantId: 'not-a-uuid' },
  }))
  const vault = new PlatformSessionVault(secrets)

  await assert.rejects(() => vault.load(), error => {
    assert.ok(error instanceof PlatformSessionVaultError)
    assert.equal(error.code, 'invalid-state')
    assert.doesNotMatch(error.message, /private-access|private-refresh/)
    return true
  })
})

test('session Vault reports unavailable protection without attempting persistence', async () => {
  const secrets = new MemorySecrets()
  secrets.available = async () => false
  const vault = new PlatformSessionVault(secrets)
  await assert.rejects(() => vault.save(record), error => {
    assert.equal(error.code, 'protection-unavailable')
    return true
  })
  assert.deepEqual(await vault.diagnostics(), { available: false, state: 'unavailable' })
  assert.equal(secrets.values.size, 0)

  secrets.values.set('futurestaff.platform.session.v1', 'stale-local-state')
  await vault.clear()
  assert.equal(secrets.values.size, 0)
  assert.equal(secrets.reads, 0)
})

test('session Vault bounds runtime-invalid input and protection diagnostics failures', async () => {
  const secrets = new MemorySecrets()
  const vault = new PlatformSessionVault(secrets)
  await assert.rejects(() => vault.save(undefined), error => {
    assert.equal(error.code, 'invalid-state')
    return true
  })

  secrets.available = async () => { throw new Error('native detail must not escape') }
  assert.deepEqual(await vault.diagnostics(), { available: false, state: 'unavailable' })
})
