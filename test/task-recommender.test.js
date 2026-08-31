import assert from 'node:assert/strict'
import test from 'node:test'

import { parseAiBacklog, recommendBacklogTasks } from '../scripts/task-recommender.mjs'

const markdown = `# AI Backlog

## High value
- [ ] [sol] Review tenant architecture.
- [ ] [codex] Review database/API contracts.

## Medium value
- [ ] [spark] Add integration tests.
- [ ] [spark] Audit UI consistency.
- [x] [spark] Already finished task.

## Filler / small atomic tasks
- [ ] Fix lint/typecheck warnings.
- [ ] [any] Improve stable documentation.
`

function route(model, state, shouldHarvestNow = true) {
  return {
    preferredModel: model,
    shouldHarvestNow,
    buckets: [{ model, state }],
  }
}

test('parses open backlog tasks, explicit model tags, sections, and inferred tags', () => {
  const tasks = parseAiBacklog(markdown)
  assert.equal(tasks.length, 6)
  assert.deepEqual(tasks[0], {
    id: 'backlog-1', title: 'Review tenant architecture.', section: 'high', valueScore: 100, model: 'sol',
  })
  assert.equal(tasks[4].title, 'Fix lint/typecheck warnings.')
  assert.equal(tasks[4].model, 'spark')
  assert.equal(tasks.some(task => task.title.includes('Already finished')), false)
})

test('prefers Spark-compatible medium work over high-value Sol/Codex work when Spark quota is near reset', () => {
  const result = recommendBacklogTasks(route('GPT-5.3-Codex-Spark', 'CLEAR'), parseAiBacklog(markdown), { limit: 3 })
  assert.equal(result.preferredModel, 'GPT-5.3-Codex-Spark')
  assert.equal(result.quotaState, 'CLEAR')
  assert.equal(result.shouldHarvestNow, true)
  assert.deepEqual(result.tasks.map(task => task.title), [
    'Add integration tests.',
    'Audit UI consistency.',
    'Fix lint/typecheck warnings.',
  ])
  assert.equal(result.tasks.some(task => task.model === 'sol' || task.model === 'codex'), false)
})

test('allows General Codex to take explicitly Codex high-value work before Spark filler work', () => {
  const result = recommendBacklogTasks(route('GPT-5.3-Codex', 'HARVEST'), parseAiBacklog(markdown), { limit: 3 })
  assert.equal(result.tasks[0].title, 'Review database/API contracts.')
  assert.equal(result.tasks[0].model, 'codex')
  assert.ok(result.tasks[0].score > result.tasks.find(task => task.title === 'Add integration tests.')?.score)
})

test('returns no work when the preferred model is exhausted', () => {
  const result = recommendBacklogTasks(route('GPT-5.3-Codex-Spark', 'EXHAUSTED', false), parseAiBacklog(markdown))
  assert.equal(result.quotaState, 'EXHAUSTED')
  assert.equal(result.shouldHarvestNow, false)
  assert.deepEqual(result.tasks, [])
})

test('validates recommendation limits', () => {
  assert.throws(
    () => recommendBacklogTasks(route('GPT-5.3-Codex-Spark', 'NORMAL', false), parseAiBacklog(markdown), { limit: 0 }),
    /between 1 and 20/,
  )
})
