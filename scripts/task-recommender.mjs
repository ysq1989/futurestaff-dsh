#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'

import { readCodexUsage } from './codex-usage.mjs'
import { routeCodexQuota } from './quota-router.mjs'

const MODEL_TAGS = new Set(['spark', 'codex', 'sol', 'work', 'any'])
const SECTION_SCORE = Object.freeze({ high: 100, medium: 60, filler: 25 })

function normalizeSection(heading) {
  const value = heading.toLowerCase()
  if (value.includes('high')) return 'high'
  if (value.includes('medium')) return 'medium'
  if (value.includes('filler') || value.includes('small')) return 'filler'
  return undefined
}

function inferModel(text) {
  const value = text.toLowerCase()
  if (/architecture|permission|tenant|security|decision|root-cause|major review/.test(value)) return 'sol'
  if (/cross-module|migration|deep repository|complex|integration architecture/.test(value)) return 'codex'
  if (/browser|file workflow|operational|website|backoffice/.test(value)) return 'work'
  if (/lint|typecheck|test|ui|todo|fixme|dead code|documentation|docs|small|focused/.test(value)) return 'spark'
  return 'any'
}

export function parseAiBacklog(markdown) {
  const tasks = []
  let section
  for (const rawLine of markdown.split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+)$/)
    if (heading) {
      section = normalizeSection(heading[1])
      continue
    }
    if (!section) continue
    const item = rawLine.match(/^\s*-\s*\[\s*\]\s*(.+)$/)
    if (!item) continue
    let title = item[1].trim()
    let model = undefined
    const tag = title.match(/^\[([a-z0-9-]+)\]\s*/i)
    if (tag && MODEL_TAGS.has(tag[1].toLowerCase())) {
      model = tag[1].toLowerCase()
      title = title.slice(tag[0].length).trim()
    }
    tasks.push(Object.freeze({
      id: `backlog-${tasks.length + 1}`,
      title,
      section,
      valueScore: SECTION_SCORE[section],
      model: model ?? inferModel(title),
    }))
  }
  return Object.freeze(tasks)
}

function modelKey(model) {
  if (model === 'GPT-5.3-Codex-Spark') return 'spark'
  if (model === 'GPT-5.3-Codex') return 'codex'
  return 'any'
}

function fitScore(task, preferredModel) {
  const preferred = modelKey(preferredModel)
  if (task.model === preferred) return 40
  if (task.model === 'any') return 20
  if (preferred === 'codex' && task.model === 'spark') return 10
  return -100
}

function urgencyScore(quotaState) {
  if (quotaState === 'CLEAR') return 30
  if (quotaState === 'HARVEST') return 20
  if (quotaState === 'NORMAL') return 5
  return 0
}

export function recommendBacklogTasks(quotaRoute, backlogTasks, { limit = 3 } = {}) {
  if (!quotaRoute || typeof quotaRoute !== 'object') throw new Error('Task recommender requires a quota route')
  if (!Array.isArray(backlogTasks)) throw new Error('Task recommender requires parsed backlog tasks')
  if (!Number.isInteger(limit) || limit <= 0 || limit > 20) throw new Error('Recommendation limit must be between 1 and 20')

  const preferredModel = quotaRoute.preferredModel
  if (!preferredModel) {
    return Object.freeze({ preferredModel: null, quotaState: null, shouldHarvestNow: false, tasks: Object.freeze([]) })
  }

  const preferredBucket = quotaRoute.buckets?.find(bucket => bucket.model === preferredModel)
  const quotaState = preferredBucket?.state ?? null
  if (quotaState === 'EXHAUSTED') {
    return Object.freeze({ preferredModel, quotaState, shouldHarvestNow: false, tasks: Object.freeze([]) })
  }

  const ranked = backlogTasks
    .map(task => {
      const fit = fitScore(task, preferredModel)
      return Object.freeze({
        ...task,
        fitScore: fit,
        score: task.valueScore + fit + urgencyScore(quotaState),
      })
    })
    .filter(task => task.fitScore >= 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((task, index) => Object.freeze({
      rank: index + 1,
      title: task.title,
      section: task.section,
      model: task.model,
      score: task.score,
      reason: `${task.section} value task; ${task.model === 'any' ? 'compatible with' : 'targeted to'} ${preferredModel}; quota state ${quotaState}.`,
    }))

  return Object.freeze({
    preferredModel,
    quotaState,
    shouldHarvestNow: Boolean(quotaRoute.shouldHarvestNow),
    tasks: Object.freeze(ranked),
  })
}

export async function buildTaskRecommendations({ backlogPath = 'tasks/AI-BACKLOG.md', limit = 3, now } = {}) {
  const [snapshot, markdown] = await Promise.all([
    readCodexUsage(),
    readFile(backlogPath, 'utf8'),
  ])
  const quotaRoute = routeCodexQuota(snapshot, now === undefined ? {} : { now })
  const backlogTasks = parseAiBacklog(markdown)
  return Object.freeze({
    generatedAt: new Date(now ?? Date.now()).toISOString(),
    quota: quotaRoute,
    recommendation: recommendBacklogTasks(quotaRoute, backlogTasks, { limit }),
  })
}

async function main() {
  const result = await buildTaskRecommendations()
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
