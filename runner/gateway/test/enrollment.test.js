import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { EnrollmentError, createEnrollmentService } from '../lib/enrollment.js'

const code = 'alpha-one-time-code-with-high-entropy-123456'

test('redeems one valid code once and persists only credential digests', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-enrollment-'))
  const offersFile = path.join(directory, 'offers.json')
  const stateFile = path.join(directory, 'state.json')
  await writeFile(offersFile, JSON.stringify({ offers: [{
    codeSha256: createHash('sha256').update(code).digest('hex'),
    tenantId: 'tenant-a', userId: 'user-a', expiresAt: Date.now() + 60_000,
  }] }))
  const service = await createEnrollmentService({
    offersFile, stateFile,
    createToken: () => 'device-token-with-at-least-32-characters',
    createId: (() => { const ids = ['runner-id', 'device-id']; return () => ids.shift() })(),
  })

  const enrolled = await service.redeem(code, 'Office PC')
  assert.deepEqual(enrolled.binding, {
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-runner-id', deviceId: 'device-device-id',
    capabilities: ['local.system_info'],
    tokenSha256: createHash('sha256').update(enrolled.token).digest('hex'),
  })
  const persisted = await readFile(stateFile, 'utf8')
  assert.doesNotMatch(persisted, new RegExp(code))
  assert.doesNotMatch(persisted, new RegExp(enrolled.token))
  await assert.rejects(
    service.redeem(code, 'Replay PC'),
    error => error instanceof EnrollmentError && error.code === 'CODE_CONSUMED',
  )
  const reloaded = await createEnrollmentService({ offersFile, stateFile })
  await assert.rejects(
    reloaded.redeem(code, 'Replay after restart'),
    error => error instanceof EnrollmentError && error.code === 'CODE_CONSUMED',
  )
})

test('rejects expired and unknown enrollment codes with stable reasons', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-enrollment-'))
  const offersFile = path.join(directory, 'offers.json')
  const stateFile = path.join(directory, 'state.json')
  await writeFile(offersFile, JSON.stringify({ offers: [{
    codeSha256: createHash('sha256').update(code).digest('hex'),
    tenantId: 'tenant-a', userId: 'user-a', expiresAt: Date.now() - 1,
  }] }))
  const service = await createEnrollmentService({ offersFile, stateFile })
  await assert.rejects(service.redeem(code, 'PC'), error => error.code === 'CODE_EXPIRED')
  await assert.rejects(service.redeem('unknown-code-with-enough-entropy', 'PC'), error => error.code === 'CODE_INVALID')
})
