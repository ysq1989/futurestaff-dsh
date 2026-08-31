#!/usr/bin/env node
import { pathToFileURL } from 'node:url'

import { readCodexUsage } from './codex-usage.mjs'

export const QUOTA_STATE = Object.freeze({
  NORMAL: 'NORMAL',
  HARVEST: 'HARVEST',
  CLEAR: 'CLEAR',
  EXHAUSTED: 'EXHAUSTED',
})

const EXHAUSTED_REMAINING_PERCENT = 5
const CLEAR_MINUTES = 120
const HARVEST_MINUTES = 360

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function text(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function resetEpochSeconds(window) {
  return number(window?.resetsAt) ?? number(window?.resetAt) ?? number(window?.reset_at)
}

function usedPercent(window) {
  return number(window?.usedPercent) ?? number(window?.used_percent)
}

function durationMinutes(window) {
  return number(window?.windowDurationMins) ?? number(window?.window_duration_mins) ?? number(window?.windowMinutes)
}

function classifyWindow(remainingPercent, minutesToReset) {
  if (remainingPercent <= EXHAUSTED_REMAINING_PERCENT) return QUOTA_STATE.EXHAUSTED
  if (minutesToReset <= CLEAR_MINUTES) return QUOTA_STATE.CLEAR
  if (minutesToReset <= HARVEST_MINUTES) return QUOTA_STATE.HARVEST
  return QUOTA_STATE.NORMAL
}

function normalizeWindow(kind, raw, nowMs) {
  const window = record(raw)
  if (!window) return undefined
  const used = usedPercent(window)
  const resetSeconds = resetEpochSeconds(window)
  if (used === undefined || resetSeconds === undefined) return undefined

  const boundedUsed = Math.min(100, Math.max(0, used))
  const remainingPercent = Math.max(0, 100 - boundedUsed)
  const resetAtMs = resetSeconds * 1000
  const minutesToReset = Math.max(0, Math.round((resetAtMs - nowMs) / 60_000))
  return Object.freeze({
    kind,
    usedPercent: boundedUsed,
    remainingPercent,
    resetAt: new Date(resetAtMs).toISOString(),
    minutesToReset,
    ...(durationMinutes(window) === undefined ? {} : { windowMinutes: durationMinutes(window) }),
    state: classifyWindow(remainingPercent, minutesToReset),
  })
}

function inferModel(limitId, name) {
  const haystack = `${limitId ?? ''} ${name ?? ''}`.toLowerCase()
  if (haystack.includes('spark') || haystack.includes('bengalfox')) return 'GPT-5.3-Codex-Spark'
  return 'GPT-5.3-Codex'
}

function stateRank(state) {
  return {
    [QUOTA_STATE.EXHAUSTED]: 0,
    [QUOTA_STATE.NORMAL]: 1,
    [QUOTA_STATE.HARVEST]: 2,
    [QUOTA_STATE.CLEAR]: 3,
  }[state] ?? 0
}

function effectiveState(windows) {
  if (windows.some(window => window.state === QUOTA_STATE.EXHAUSTED)) return QUOTA_STATE.EXHAUSTED
  return [...windows].sort((a, b) => stateRank(b.state) - stateRank(a.state))[0]?.state ?? QUOTA_STATE.NORMAL
}

function normalizeBucket(limitId, raw, nowMs, fallbackName) {
  const snapshot = record(raw)
  if (!snapshot) return undefined
  const name = text(snapshot.limitName) ?? text(snapshot.limit_name) ?? fallbackName ?? limitId
  const windows = [
    normalizeWindow('primary', snapshot.primary, nowMs),
    normalizeWindow('secondary', snapshot.secondary, nowMs),
  ].filter(Boolean)
  if (windows.length === 0) return undefined

  const state = effectiveState(windows)
  const tightestWindow = [...windows].sort((a, b) => a.remainingPercent - b.remainingPercent || a.minutesToReset - b.minutesToReset)[0]
  const nextReset = [...windows].sort((a, b) => a.minutesToReset - b.minutesToReset)[0]
  return Object.freeze({
    limitId,
    name,
    model: inferModel(limitId, name),
    state,
    shouldHarvest: state === QUOTA_STATE.HARVEST || state === QUOTA_STATE.CLEAR,
    remainingPercent: tightestWindow.remainingPercent,
    nextResetAt: nextReset.resetAt,
    minutesToNextReset: nextReset.minutesToReset,
    windows: Object.freeze(windows),
  })
}

function recommendationFor(bucket) {
  const base = {
    model: bucket.model,
    limitId: bucket.limitId,
    state: bucket.state,
    priority: bucket.state === QUOTA_STATE.CLEAR ? 100
      : bucket.state === QUOTA_STATE.HARVEST ? 75
        : bucket.state === QUOTA_STATE.NORMAL ? 25 : 0,
  }
  if (bucket.state === QUOTA_STATE.EXHAUSTED) {
    return Object.freeze({ ...base, action: 'AVOID', reason: `Only ${bucket.remainingPercent}% allowance remains in an active constraint.` })
  }
  if (bucket.state === QUOTA_STATE.CLEAR) {
    return Object.freeze({ ...base, action: 'USE_NOW', reason: `Allowance resets in about ${bucket.minutesToNextReset} minutes; prioritize high-value suitable work now.` })
  }
  if (bucket.state === QUOTA_STATE.HARVEST) {
    return Object.freeze({ ...base, action: 'PREFER', reason: `Allowance resets in about ${bucket.minutesToNextReset} minutes; prefer this model for suitable queued work.` })
  }
  return Object.freeze({ ...base, action: 'NORMAL', reason: 'No near-term reset pressure; route by task fit rather than quota.' })
}

export function routeCodexQuota(snapshot, { now = Date.now() } = {}) {
  const envelope = record(snapshot)
  const usage = record(envelope?.usage)
  if (!usage) throw new Error('Quota router requires a sanitized Codex usage snapshot')

  const buckets = []
  const general = normalizeBucket('codex', usage.rateLimits, now, 'General Codex')
  if (general) buckets.push(general)

  const byLimitId = record(usage.rateLimitsByLimitId)
  if (byLimitId) {
    for (const [limitId, raw] of Object.entries(byLimitId)) {
      if (limitId === 'codex') continue
      const bucket = normalizeBucket(limitId, raw, now)
      if (bucket) buckets.push(bucket)
    }
  }

  if (buckets.length === 0) throw new Error('Quota router found no usable rate-limit windows')

  const recommendations = buckets
    .map(recommendationFor)
    .sort((a, b) => b.priority - a.priority || a.model.localeCompare(b.model))

  const preferred = recommendations.find(item => item.action === 'USE_NOW' || item.action === 'PREFER')
    ?? recommendations.find(item => item.action === 'NORMAL')

  return Object.freeze({
    generatedAt: new Date(now).toISOString(),
    source: envelope.source ?? 'codex-app-server',
    buckets: Object.freeze(buckets),
    recommendations: Object.freeze(recommendations),
    preferredModel: preferred?.model ?? null,
    shouldHarvestNow: recommendations.some(item => item.action === 'USE_NOW' || item.action === 'PREFER'),
  })
}

async function main() {
  const snapshot = await readCodexUsage()
  process.stdout.write(`${JSON.stringify(routeCodexQuota(snapshot), null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
