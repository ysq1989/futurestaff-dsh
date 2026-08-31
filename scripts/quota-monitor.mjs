#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildTaskRecommendations } from './task-recommender.mjs'

const DEFAULT_MIN_REMAINING_PERCENT = 25
const DEFAULT_COOLDOWN_MINUTES = 180
const DEFAULT_STATE_PATH = 'work/ai-usage-monitor-state.json'
const ALERT_STATES = new Set(['HARVEST', 'CLEAR'])

function finiteNumber(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function validateMinimum(value) {
  const minimum = finiteNumber(value, DEFAULT_MIN_REMAINING_PERCENT)
  if (minimum < 0 || minimum > 100) {
    throw new Error('AI usage monitor minimum remaining percent must be between 0 and 100')
  }
  return minimum
}

function validateCooldown(value) {
  const cooldown = finiteNumber(value, DEFAULT_COOLDOWN_MINUTES)
  if (cooldown < 1 || cooldown > 10_080) {
    throw new Error('AI usage monitor cooldown minutes must be between 1 and 10080')
  }
  return cooldown
}

function alertKey({ preferredModel, quotaState, tasks }) {
  return JSON.stringify([
    preferredModel,
    quotaState,
    ...tasks.map(task => task.title),
  ])
}

export function decideQuotaAlert(result, {
  minRemainingPercent = DEFAULT_MIN_REMAINING_PERCENT,
  cooldownMinutes = DEFAULT_COOLDOWN_MINUTES,
  lastAlertKey,
  lastAlertAt,
  now = Date.now(),
} = {}) {
  if (!result || typeof result !== 'object') throw new Error('AI usage monitor requires task recommendations')

  const minimum = validateMinimum(minRemainingPercent)
  const cooldown = validateCooldown(cooldownMinutes)
  const recommendation = result.recommendation
  const preferredModel = recommendation?.preferredModel ?? null
  const quotaState = recommendation?.quotaState ?? null
  const tasks = Array.isArray(recommendation?.tasks) ? recommendation.tasks : []
  const bucket = result.quota?.buckets?.find(item => item.model === preferredModel)

  const summary = Object.freeze({
    preferredModel,
    quotaState,
    remainingPercent: bucket?.remainingPercent ?? null,
    resetAt: bucket?.nextResetAt ?? null,
    minutesToReset: bucket?.minutesToNextReset ?? null,
    taskCount: tasks.length,
  })

  if (!recommendation?.shouldHarvestNow || !ALERT_STATES.has(quotaState)) {
    return Object.freeze({ status: 'QUIET', reason: 'No model is currently in a reset-warning state.', summary })
  }
  if (!bucket || typeof bucket.remainingPercent !== 'number') {
    return Object.freeze({ status: 'QUIET', reason: 'The preferred model has no usable remaining-allowance value.', summary })
  }
  if (bucket.remainingPercent < minimum) {
    return Object.freeze({
      status: 'QUIET',
      reason: `Only ${bucket.remainingPercent}% allowance remains; the ${minimum}% useful-work threshold is not met.`,
      summary,
    })
  }
  if (tasks.length === 0) {
    return Object.freeze({ status: 'QUIET', reason: 'No open backlog task fits the preferred model.', summary })
  }

  const key = alertKey({
    preferredModel,
    quotaState,
    tasks,
  })
  const lastAlertMs = typeof lastAlertAt === 'string' ? Date.parse(lastAlertAt) : Number.NaN
  const minutesSinceLastAlert = Number.isFinite(lastAlertMs) ? Math.max(0, (now - lastAlertMs) / 60_000) : Infinity
  if (key === lastAlertKey && minutesSinceLastAlert < cooldown) {
    return Object.freeze({ status: 'QUIET', reason: 'This quota state and task set are still inside the alert cooldown.', summary })
  }

  return Object.freeze({
    status: 'ALERT',
    alertKey: key,
    alert: Object.freeze({
      title: 'Codex allowance reset reminder',
      preferredModel,
      quotaState,
      remainingPercent: bucket.remainingPercent,
      resetAt: bucket.nextResetAt,
      minutesToReset: bucket.minutesToNextReset,
      tasks: Object.freeze(tasks),
      requiresUserApproval: true,
    }),
  })
}

async function readState(statePath) {
  try {
    const value = JSON.parse(await readFile(statePath, 'utf8'))
    return value && typeof value === 'object' ? value : {}
  } catch (error) {
    if (error?.code === 'ENOENT') return {}
    throw new Error(`Could not read AI usage monitor state: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function writeState(statePath, state) {
  await mkdir(dirname(statePath), { recursive: true })
  const temporaryPath = `${statePath}.${process.pid}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryPath, statePath)
}

export async function runQuotaMonitor({
  statePath = process.env.AI_USAGE_MONITOR_STATE_FILE ?? DEFAULT_STATE_PATH,
  minRemainingPercent = process.env.AI_USAGE_MONITOR_MIN_REMAINING_PERCENT ?? DEFAULT_MIN_REMAINING_PERCENT,
  cooldownMinutes = process.env.AI_USAGE_MONITOR_COOLDOWN_MINUTES ?? DEFAULT_COOLDOWN_MINUTES,
  now,
} = {}) {
  const [result, state] = await Promise.all([
    buildTaskRecommendations(now === undefined ? {} : { now }),
    readState(statePath),
  ])
  const decision = decideQuotaAlert(result, {
    minRemainingPercent,
    cooldownMinutes,
    lastAlertKey: state.lastAlertKey,
    lastAlertAt: state.lastAlertAt,
    now: now ?? Date.now(),
  })

  if (decision.status === 'ALERT') {
    await writeState(statePath, {
      version: 1,
      lastAlertKey: decision.alertKey,
      lastAlertAt: new Date(now ?? Date.now()).toISOString(),
    })
  }

  return Object.freeze({
    generatedAt: new Date(now ?? Date.now()).toISOString(),
    status: decision.status,
    ...(decision.status === 'ALERT' ? { alert: decision.alert } : { reason: decision.reason, summary: decision.summary }),
  })
}

async function main() {
  process.stdout.write(`${JSON.stringify(await runQuotaMonitor(), null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
