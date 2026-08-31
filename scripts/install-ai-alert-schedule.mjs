#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const AI_ALERT_TASK_NAME = 'FutureStaff AI Quota Alert'

export function buildCreateArgs({ runnerPath, everyHours = 1 } = {}) {
  if (typeof runnerPath !== 'string' || runnerPath.trim() === '') throw new Error('runnerPath is required')
  if (!Number.isInteger(everyHours) || everyHours < 1 || everyHours > 24) throw new Error('everyHours must be an integer from 1 to 24')
  return Object.freeze([
    '/Create', '/TN', AI_ALERT_TASK_NAME,
    '/SC', 'HOURLY', '/MO', String(everyHours),
    '/TR', `"${path.resolve(runnerPath)}"`,
    '/F',
  ])
}

export function buildDeleteArgs() {
  return Object.freeze(['/Delete', '/TN', AI_ALERT_TASK_NAME, '/F'])
}

export function installAiAlertSchedule({
  repoRoot = process.cwd(),
  everyHours = 1,
  remove = process.argv.includes('--remove'),
  spawn = spawnSync,
} = {}) {
  if (process.platform !== 'win32') throw new Error('AI alert scheduling is currently supported on Windows only')
  const args = remove
    ? buildDeleteArgs()
    : buildCreateArgs({ runnerPath: path.join(repoRoot, 'scripts', 'run-ai-alert.cmd'), everyHours })
  const result = spawn('schtasks.exe', args, { stdio: 'inherit', windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`schtasks.exe failed with exit code ${result.status}`)
  return Object.freeze({ installed: !remove, taskName: AI_ALERT_TASK_NAME, everyHours: remove ? null : everyHours })
}

const isMain = fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '')
if (isMain) {
  try {
    const everyHoursArg = process.argv.find(argument => argument.startsWith('--every-hours='))
    const everyHours = everyHoursArg ? Number(everyHoursArg.split('=')[1]) : 1
    const result = installAiAlertSchedule({ everyHours })
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  }
}
