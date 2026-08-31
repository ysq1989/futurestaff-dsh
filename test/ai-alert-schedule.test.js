import assert from 'node:assert/strict'
import test from 'node:test'

import { AI_ALERT_TASK_NAME, buildCreateArgs, buildDeleteArgs } from '../scripts/install-ai-alert-schedule.mjs'

test('builds an hourly Windows Task Scheduler command without embedding notification credentials', () => {
  const args = buildCreateArgs({ runnerPath: 'C:\\FutureStaff\\scripts\\run-ai-alert.cmd', everyHours: 1 })
  assert.deepEqual(args.slice(0, 7), [
    '/Create', '/TN', AI_ALERT_TASK_NAME,
    '/SC', 'HOURLY', '/MO', '1',
  ])
  assert.equal(args[7], '/TR')
  assert.match(args[8], /run-ai-alert\.cmd"$/)
  assert.equal(args.at(-1), '/F')
  const serialized = JSON.stringify(args)
  assert.doesNotMatch(serialized, /webhook|token|secret|authorization/i)
})

test('validates the hourly interval', () => {
  assert.throws(() => buildCreateArgs({ runnerPath: 'runner.cmd', everyHours: 0 }), /1 to 24/)
  assert.throws(() => buildCreateArgs({ runnerPath: 'runner.cmd', everyHours: 25 }), /1 to 24/)
  assert.throws(() => buildCreateArgs({ runnerPath: 'runner.cmd', everyHours: 1.5 }), /1 to 24/)
})

test('builds a credential-free task removal command', () => {
  assert.deepEqual(buildDeleteArgs(), ['/Delete', '/TN', AI_ALERT_TASK_NAME, '/F'])
})
