import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { createRunnerEnrollment } from '../scripts/enroll-runner.mjs'

test('writes the raw device token only to the client environment', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'futurestaff-runner-'))
  const clientEnvPath = join(directory, 'client.env')
  const bindingsPath = join(directory, 'bindings.json')
  const token = 'test-device-token-with-at-least-32-characters'
  const enrollment = await createRunnerEnrollment({
    tenantId: 'tenant-a', userId: 'user-a', runnerId: 'runner-a', deviceId: 'office-pc',
    gatewayUrl: 'wss://dsh.fsstory.net/runner/v1/connect', token,
    clientEnvPath, bindingsPath,
  })
  const client = await readFile(clientEnvPath, 'utf8')
  const bindings = await readFile(bindingsPath, 'utf8')
  assert.match(client, new RegExp(`RUNNER_DEVICE_TOKEN=${token}`))
  assert.doesNotMatch(bindings, new RegExp(token))
  assert.match(bindings, new RegExp(createHash('sha256').update(token).digest('hex')))
  assert.deepEqual(enrollment, { runnerId: 'runner-a', deviceId: 'office-pc', clientEnvPath, bindingsPath })
})
