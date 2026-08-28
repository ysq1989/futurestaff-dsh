import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { issueRunnerEnrollmentCode } from '../scripts/issue-runner-enrollment.mjs'

test('issues one expiring code while persisting only its digest', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'futurestaff-issue-code-'))
  const offersFile = path.join(directory, 'offers.json')
  const result = await issueRunnerEnrollmentCode({
    offersFile, tenantId: 'tenant-a', userId: 'user-a', ttlMinutes: 15,
    now: () => 1_000, createCode: () => 'one-time-code-with-enough-entropy',
  })
  assert.deepEqual(result, { code: 'one-time-code-with-enough-entropy', expiresAt: 901_000 })
  const stored = await readFile(offersFile, 'utf8')
  assert.doesNotMatch(stored, /one-time-code-with-enough-entropy/)
  assert.equal(JSON.parse(stored).offers[0].codeSha256, createHash('sha256').update(result.code).digest('hex'))
  if (process.platform !== 'win32') assert.equal((await stat(offersFile)).mode & 0o777, 0o640)
})
