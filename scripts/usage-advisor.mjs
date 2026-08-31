#!/usr/bin/env node
import { pathToFileURL } from 'node:url'

import { buildTaskRecommendations } from './task-recommender.mjs'

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : undefined
}

export function buildUsageAdvice(result) {
  const quota = record(result?.quota)
  const recommendation = record(result?.recommendation)
  if (!quota || !recommendation) throw new Error('Usage advisor requires task recommendation output')

  const buckets = Array.isArray(quota.buckets) ? quota.buckets : []
  const models = buckets.map(bucket => Object.freeze({
    model: bucket.model,
    limitId: bucket.limitId,
    state: bucket.state,
    remainingPercent: bucket.remainingPercent,
    nextResetAt: bucket.nextResetAt,
    minutesToNextReset: bucket.minutesToNextReset,
    windows: bucket.windows,
  }))

  const tasks = Array.isArray(recommendation.tasks)
    ? recommendation.tasks.slice(0, 3).map(task => Object.freeze({
      rank: task.rank,
      title: task.title,
      model: task.model,
      section: task.section,
      reason: task.reason,
    }))
    : []

  const preferredModel = recommendation.preferredModel ?? quota.preferredModel ?? null
  const preferredBucket = buckets.find(bucket => bucket.model === preferredModel)
  const action = preferredBucket?.state === 'CLEAR'
    ? 'USE_NOW'
    : preferredBucket?.state === 'HARVEST'
      ? 'PREFER'
      : preferredBucket?.state === 'EXHAUSTED'
        ? 'AVOID'
        : 'NORMAL'

  const summary = preferredModel
    ? `${preferredModel}: ${preferredBucket?.state ?? 'UNKNOWN'}; ${preferredBucket?.remainingPercent ?? '?'}% remaining; reset in about ${preferredBucket?.minutesToNextReset ?? '?'} minutes.`
    : 'No preferred model is currently available.'

  return Object.freeze({
    generatedAt: result.generatedAt ?? quota.generatedAt ?? new Date().toISOString(),
    preferredModel,
    action,
    shouldHarvestNow: Boolean(recommendation.shouldHarvestNow ?? quota.shouldHarvestNow),
    summary,
    models: Object.freeze(models),
    tasks: Object.freeze(tasks),
  })
}

export async function runUsageAdvisor(options = {}) {
  return buildUsageAdvice(await buildTaskRecommendations(options))
}

async function main() {
  const advice = await runUsageAdvisor()
  process.stdout.write(`${JSON.stringify(advice, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
