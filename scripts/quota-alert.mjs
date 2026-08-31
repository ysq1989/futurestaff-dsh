#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildTaskRecommendations } from './task-recommender.mjs'

const CLEAR_MIN_REMAINING = 20
const HARVEST_MIN_REMAINING = 50

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function alertKey(bucket) {
  return `${bucket.limitId}|${bucket.nextResetAt}|${bucket.state}`
}

export function decideQuotaAlert(result, { now = Date.now(), state = {} } = {}) {
  const quota = record(result?.quota)
  const recommendation = record(result?.recommendation)
  if (!quota || !recommendation) throw new Error('Quota alert requires task recommendation output')

  const preferredModel = text(recommendation.preferredModel)
  if (!preferredModel) return Object.freeze({ notify: false, reason: 'NO_PREFERRED_MODEL' })
  const bucket = quota.buckets?.find(item => item.model === preferredModel)
  if (!bucket) return Object.freeze({ notify: false, reason: 'PREFERRED_BUCKET_MISSING' })

  const remainingPercent = Number(bucket.remainingPercent)
  const stateName = bucket.state
  const eligible = stateName === 'CLEAR'
    ? remainingPercent >= CLEAR_MIN_REMAINING
    : stateName === 'HARVEST' && remainingPercent >= HARVEST_MIN_REMAINING
  if (!eligible) return Object.freeze({ notify: false, reason: 'THRESHOLD_NOT_MET', bucket })

  const key = alertKey(bucket)
  const previous = record(state.alerts)?.[key]
  if (typeof previous === 'number') {
    return Object.freeze({ notify: false, reason: 'DUPLICATE_RESET_STATE', key, bucket })
  }

  const tasks = Array.isArray(recommendation.tasks) ? recommendation.tasks.slice(0, 3) : []
  const payload = Object.freeze({
    type: 'futurestaff.ai_quota_alert',
    generatedAt: new Date(now).toISOString(),
    model: preferredModel,
    state: stateName,
    remainingPercent,
    minutesToReset: bucket.minutesToNextReset,
    resetAt: bucket.nextResetAt,
    tasks: Object.freeze(tasks.map(task => Object.freeze({ rank: task.rank, title: task.title, model: task.model, reason: task.reason }))),
    message: `${preferredModel} ${stateName}: ${remainingPercent}% remaining, reset in about ${bucket.minutesToNextReset} minutes.`,
  })
  return Object.freeze({ notify: true, reason: 'ELIGIBLE', key, bucket, payload })
}

export function updateAlertState(state, decision, now = Date.now()) {
  if (!decision?.notify || !decision.key) return state
  const alerts = { ...(record(state?.alerts) ?? {}), [decision.key]: now }
  return Object.freeze({ version: 1, alerts: Object.freeze(alerts) })
}

async function readState(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    return record(parsed) ?? { version: 1, alerts: {} }
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return { version: 1, alerts: {} }
    throw error
  }
}

async function writeState(file, state) {
  await mkdir(path.dirname(file), { recursive: true })
  const tmp = `${file}.${process.pid}.tmp`
  await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(tmp, file)
}

export async function sendQuotaAlert(payload, { webhookUrl = process.env.AI_ALERT_WEBHOOK_URL, fetch = globalThis.fetch } = {}) {
  if (!webhookUrl) return Object.freeze({ delivered: false, transport: 'stdout' })
  const url = new URL(webhookUrl)
  if (url.protocol !== 'https:') throw new Error('AI_ALERT_WEBHOOK_URL must use HTTPS')
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error(`Quota alert webhook failed with HTTP ${response.status}`)
  return Object.freeze({ delivered: true, transport: 'https-webhook' })
}

export async function runQuotaAlert({
  stateFile = process.env.AI_ALERT_STATE_FILE || '.dsh/ai-usage-alert-state.json',
  dryRun = process.argv.includes('--dry-run'),
  now = Date.now(),
} = {}) {
  const [result, state] = await Promise.all([buildTaskRecommendations({ now }), readState(stateFile)])
  const decision = decideQuotaAlert(result, { now, state })
  if (!decision.notify) return Object.freeze({ decision, delivery: null })

  const delivery = dryRun
    ? Object.freeze({ delivered: false, transport: 'dry-run' })
    : await sendQuotaAlert(decision.payload)
  if (delivery.delivered) await writeState(stateFile, updateAlertState(state, decision, now))
  return Object.freeze({ decision, delivery })
}

async function main() {
  const result = await runQuotaAlert()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
