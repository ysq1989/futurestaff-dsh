import assert from 'node:assert/strict'
import test from 'node:test'
import { LeadAnalyzer, vietnamVisaProfile } from '../lib/lead-analysis.js'
import { LeadWorkspace } from '../lib/lead-workspace.js'
import { DmEngine } from '../lib/engine.js'

const modelId = '30000000-0000-4000-8000-000000000001'
const comment = { commentId: 'comment-1', workId: '123456789', recipient: 'recipient_123', title: '越南签证办理', description: '',
  text: '越南电子签还没办，能帮忙吗？', parentText: '', publishedAt: '2026-10-03T10:00:00Z', collectedAt: '2026-10-03T10:01:00Z' }
const plan = { recipients: [comment.recipient], message: '您好，这是已确认的测试文案', scheduledAt: '2026-10-03T10:10:00Z', intervalSeconds: 30, durationSeconds: 120, maxMessages: 1 }
async function setup(options = {}) {
  let clock = Date.parse('2026-10-03T10:00:00Z'), saved = options.saved ?? null
  const port = { models: async () => [{ modelId, displayName: '所选模型' }], generateText: async () => ({ modelId, tenantId: 'tenant-a', userId: 'user-a',
    text: JSON.stringify({ classification: 'target', need: '办理电子签', reason: '明确请求协助', urgency: 'not-stated', evidence: [{ source: 'comment', quote: '电子签还没办，能帮忙吗？' }] }) }) }
  const store = { load: async () => saved, save: async s => { saved = structuredClone(s) } }
  const workspace = new LeadWorkspace(options.principal ?? { tenantId: 'tenant-a', userId: 'user-a' }, new LeadAnalyzer(port), store, () => clock)
  await workspace.init()
  return { workspace, port, store, saved: () => saved, now: () => clock, advance: ms => { clock += ms } }
}
async function prepare(s) {
  await s.workspace.selectModel(modelId)
  await s.workspace.addWatch('work', { url: 'https://www.douyin.com/video/123456789', name: '签证视频', intervalSeconds: 600 })
  await s.workspace.recordScan(comment.workId, [comment])
  await s.workspace.analyzeOne(s.workspace.pendingComments()[0].key)
}

test('switching the analysis model revokes approval and queues old comments for fresh classification',async()=>{
  const s=await setup();await prepare(s);await s.workspace.review(comment.recipient,'approve')
  const other='40000000-0000-4000-8000-000000000002'
  s.port.models=async()=>[{modelId},{modelId:other}]
  await s.workspace.selectModel(other)
  assert.equal(s.workspace.snapshot().candidates[comment.recipient].review,'pending')
  assert.equal(s.workspace.pendingComments().length,1)
  await assert.rejects(s.workspace.review(comment.recipient,'approve'),/CANDIDATE_NOT_ELIGIBLE/)
})

test('batch watch imports reject invalid or oversized batches without partial records', async () => {
  const s = await setup(), input = id => ({ url: `https://www.douyin.com/video/${id}`, name: '作品', intervalSeconds: 600 })
  assert.throws(() => s.workspace.addWatches('work', [input('123456789'), { ...input('23456789'), url: 'https://evil.invalid/video/23456789' }]), /URL_INVALID/)
  assert.equal(s.workspace.snapshot().watches.length, 0)
  await s.workspace.addWatches('work', [input('123456789'), input('123456789')])
  assert.equal(s.workspace.snapshot().watches.length, 1)
  for (let i = 0; i < 499; i++) await s.workspace.addWatch('work', input(String(10000000 + i)))
  await assert.rejects(s.workspace.addWatches('work', [input('77777777'), input('88888888')]), /WATCH_LIMIT/)
  assert.equal(s.workspace.snapshot().watches.length, 500)
  const failed = await setup()
  failed.store.save = async () => { throw new Error('disk full') }
  await assert.rejects(failed.workspace.addWatches('work', [input('123456789'), input('23456789')]), /disk full/)
  assert.equal(failed.workspace.snapshot().watches.length, 0)
})

test('watch lists normalize URLs, deduplicate scans and retain candidate sources', async () => {
  const s = await setup(); await prepare(s)
  await s.workspace.addWatch('account', { url: 'https://www.douyin.com/user/creator_123?x=1', name: '关注账号', intervalSeconds: 600 })
  assert.equal(s.workspace.snapshot().watches.length, 2)
  assert.equal(s.workspace.snapshot().watches[1].url, 'https://www.douyin.com/user/creator_123')
  await s.workspace.recordScan(comment.workId, [comment, comment])
  assert.equal(Object.keys(s.workspace.snapshot().comments).length, 1)
  assert.equal(s.workspace.pendingComments().length, 0)
  assert.equal(s.workspace.snapshot().candidates[comment.recipient].review, 'pending')
  assert.equal(s.workspace.dueWatches().length, 1)
  s.advance(600000); assert.equal(s.workspace.dueWatches().length, 2)
  assert.throws(() => s.workspace.addWatch('work', { url: 'https://evil.test/video/123456789', name: '无效', intervalSeconds: 600 }))
})

test('reviewed lead becomes a frozen scheduled DM plan and cannot send before its slot', async () => {
  const s = await setup(); await prepare(s)
  assert.throws(() => s.workspace.messagePlan(plan), /REVIEWED_RECIPIENTS_REQUIRED/)
  await s.workspace.review(comment.recipient, 'approve')
  let sent = 0, state = null
  const engine = new DmEngine('trusted-owner', { check: async () => {}, inbox: async () => [], send: async () => { sent++; return 'sent' }, close() {} },
    { load: async () => state, save: async v => { state = structuredClone(v) } }, true, s.now)
  await engine.init()
  const preview = await engine.preview(s.workspace.messagePlan(plan)); await engine.start(preview.previewId)
  await engine.tick(); assert.equal(sent, 0)
  s.advance(599999); await engine.tick(); assert.equal(sent, 0)
  s.advance(1); await engine.tick(); assert.equal(sent, 1)
})

test('changing target rules invalidates prior review and requests reanalysis', async () => {
  const s = await setup(); await prepare(s); await s.workspace.review(comment.recipient, 'approve')
  await s.workspace.configureProfile({ ...vietnamVisaProfile, objective: '只关注明确需要商务签证的用户' })
  assert.equal(s.workspace.snapshot().profile.version, 2)
  assert.equal(s.workspace.pendingComments().length, 1)
  assert.throws(() => s.workspace.messagePlan(plan), /REVIEWED_RECIPIENTS_REQUIRED/)
  await assert.rejects(s.workspace.review(comment.recipient, 'approve'), /CANDIDATE_NOT_ELIGIBLE/)
})

test('opted-out leads cannot be reinstated by another positive comment', async () => {
  const s = await setup(); await prepare(s); await s.workspace.review(comment.recipient, 'opt-out')
  await s.workspace.recordScan(comment.workId, [{ ...comment, commentId: 'comment-2' }])
  await s.workspace.analyzeOne(s.workspace.pendingComments()[0].key)
  assert.equal(s.workspace.snapshot().candidates[comment.recipient].review, 'opted-out')
  await assert.rejects(s.workspace.review(comment.recipient, 'approve'), /CANDIDATE_NOT_ELIGIBLE/)
})

test('cross-tenant workspaces and cross-tenant analysis results are rejected', async () => {
  const s = await setup(); await prepare(s)
  await assert.rejects(setup({ saved: s.saved(), principal: { tenantId: 'tenant-b', userId: 'user-a' } }), /WORKSPACE_OWNER_MISMATCH/)
  const original = s.port.generateText
  s.port.generateText = async args => ({ ...(await original(args)), tenantId: 'tenant-b' })
  await s.workspace.recordScan(comment.workId, [{ ...comment, commentId: 'comment-2' }])
  await assert.rejects(s.workspace.analyzeOne(s.workspace.pendingComments()[0].key), /ANALYSIS_OWNER_MISMATCH/)
  assert.equal(s.workspace.pendingComments().length, 1)
})

test('an in-flight analysis cannot commit after the selected model or rules change', async () => {
  const s = await setup(); await prepare(s)
  await s.workspace.recordScan(comment.workId, [{ ...comment, commentId: 'comment-2' }])
  let release, reached; const arrived = new Promise(resolve => { reached = resolve }), original = s.port.generateText
  s.port.generateText = async args => { reached(); await new Promise(resolve => { release = resolve }); return original(args) }
  const pending = s.workspace.analyzeOne(s.workspace.pendingComments()[0].key); await arrived
  await s.workspace.configureProfile(vietnamVisaProfile); release()
  await assert.rejects(pending, /ANALYSIS_CONTEXT_CHANGED/)
})

test('scanner cannot ingest an unrelated work and failed persistence rolls back mutations', async () => {
  const s = await setup(); await prepare(s)
  await assert.rejects(s.workspace.recordScan('not-watched', [comment]), /WORK_NOT_WATCHED/)
  await assert.rejects(s.workspace.recordScan(comment.workId, [{ ...comment, workId: 'wrong' }]), /SCAN_SOURCE_MISMATCH/)
  s.store.save = async () => { throw new Error('disk full') }
  await assert.rejects(s.workspace.review(comment.recipient, 'approve'), /disk full/)
  assert.equal(s.workspace.snapshot().candidates[comment.recipient].review, 'pending')
})

test('opt-in high-intent admission still produces a preview plan, never starts sending', async () => {
  const s = await setup()
  await s.workspace.configureProfile({ ...vietnamVisaProfile, reviewMode: 'high-intent-only' }); await prepare(s)
  assert.equal(s.workspace.snapshot().candidates[comment.recipient].review, 'eligible')
  assert.equal(s.workspace.messagePlan(plan).mode, 'outbound')
})
