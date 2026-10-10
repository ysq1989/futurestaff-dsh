import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'
import { LeadDatabase } from '../lib/database.js'
import { DouyinService } from '../lib/service.js'
import { vietnamVisaProfile } from '@futurestaff/douyin-dm-mcp/lead-analysis'

const modelId = '30000000-0000-4000-8000-000000000001'
const comment = { commentId: 'c1', workId: '123456789', recipient: 'recipient_123', title: '越南签证', description: '',
  text: '电子签还没办，能帮忙吗？', parentText: '', publishedAt: '2026-10-03T10:00:00Z', collectedAt: '2026-10-03T10:01:00Z' }
function setup(filename = ':memory:', options = {}) {
  let controller = new AbortController(), tenant = 'tenant-a'
  const authorize = async () => ({ tenantId: tenant, userId: 'user-a', signal: controller.signal })
  const inference = { models: async () => [{ modelId, displayName: '平台模型' }], generateText: async ({ text }) => {
    const request = JSON.parse(text)
    return { modelId, tenantId: tenant, userId: 'user-a', text: JSON.stringify(request.output.items
      ? {items:request.descriptions.map(item=>({index:item.index,relevant:true,reason:'相关作品',quotes:[item.text]}))}
      :request.output.groups ? { groups: [{ purpose: 'direct', keywords: ['越南签证代办'] }] }
      : { classification: 'target', need: '需要电子签', reason: '本人请求帮助', urgency: 'not-stated', evidence: [{ source: 'comment', quote: '电子签还没办，能帮忙吗？' }] }) }
  } }
  const service = new DouyinService(new LeadDatabase(filename), authorize, inference, options.adapter, !!options.adapter, options.accounts, options.collector,options.discovery,options.ownedSender)
  return { service, inference, switch: value => { controller.abort(); controller = new AbortController(); tenant = value }, logout: () => controller.abort() }
}
async function prepare(s) {
  await s.service.act({ action: 'model', modelId })
  await s.service.act({ action: 'watch', kind: 'work', url: 'https://www.douyin.com/video/123456789', name: '签证攻略', intervalSeconds: 600 })
  await s.service.recordScan(comment.workId, [comment])
  const snapshot = await s.service.snapshot()
  await s.service.act({ action: 'analyze', key: Object.keys(snapshot.comments)[0] })
  await s.service.act({ action: 'review', recipient: comment.recipient, decision: 'approve' })
}
const plan = () => ({ recipients: [comment.recipient], message: '测试文案', scheduledAt: new Date(Date.now() + 60000).toISOString(), intervalSeconds: 30, durationSeconds: 120, maxMessages: 1 })

test('new automation logs preserve the prior namespace for code rollback',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'dy-log-rollback-')),filename=path.join(dir,'leads.sqlite')
  const owner=createHash('sha256').update(JSON.stringify(['tenant-a','user-a'])).digest('hex')
  const seed=new LeadDatabase(filename),legacy=seed.store(owner,'run-log'),before=[{at:1,action:'monitor',phase:'failed',code:'SCAN_FAILED'}]
  await legacy.load();await legacy.save(before);seed.close()
  const s=setup(filename),reader=new LeadDatabase(filename)
  t.after(async()=>{await s.service.close();reader.close();await rm(dir,{recursive:true,force:true})})
  assert.deepEqual((await s.service.snapshot()).runtimeLogs,before)
  await s.service.act({action:'acquisition-pause'})
  assert.deepEqual(await reader.store(owner,'run-log').load(),before)
  assert.ok((await reader.store(owner,'run-log-diagnostics').load()).length>1)
})

test('automatic business acquisition discovers works, classifies comments and applies daily outreach limits',async t=>{
  let sent=0
  const accounts={status:()=>({phase:'connected',accountId:'fixture-account'}),close:async()=>{}}
  const source={id:comment.workId,url:`https://www.douyin.com/video/${comment.workId}`,name:'越南电子签',description:'越南电子签办理说明',accountUrl:'https://www.douyin.com/user/MS4wLjABfixture_account_12345'}
  const s=setup(':memory:',{accounts,discovery:{search:async()=>[source]},collector:{ready:()=>true,scan:async(_owner,watch)=>({sourceUrl:watch.url,works:[{url:watch.url,name:watch.name,comments:[comment]}]})},adapter:{check:async()=>{},inbox:async()=>[],send:async()=>{sent++;return 'sent'},close:()=>{}}})
  t.after(()=>s.service.close())
  await s.service.act({action:'profile',profile:{...vietnamVisaProfile,reviewMode:'high-intent-only'}})
  await s.service.act({action:'model',modelId})
  const policy={message:'测试业务文案',send:true,maxMessagesPerDay:1,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30}
  await assert.rejects(s.service.act({action:'acquisition-start',policy}),/confirmation/)
  await s.service.act({action:'acquisition-start',policy,confirmation:'确认启动自动获客'})
  await s.service.tick()
  const state=await s.service.snapshot()
  assert.equal(state.discoveries.length,1);assert.equal(state.candidates[comment.recipient].review,'contacted');assert.equal(sent,1);assert.equal(state.outreachBudget,1)
  const second={...comment,commentId:'c2',recipient:'recipient_456'}
  await s.service.recordScan(comment.workId,[second])
  const key=Object.entries((await s.service.snapshot()).comments).find(([,value])=>value.commentId==='c2')[0]
  await s.service.act({action:'analyze',key})
  await s.service.act({action:'acquisition-start',policy,confirmation:'确认启动自动获客'});await s.service.tick()
  assert.equal(sent,1);assert.equal((await s.service.snapshot()).candidates[second.recipient].review,'eligible')
})

test('pausing automatic acquisition aborts an in-flight sender before settling the task',async t=>{
  let reached;const sending=new Promise(resolve=>{reached=resolve})
  const accounts={status:()=>({phase:'connected',accountId:'fixture-account'}),close:async()=>{}}
  const s=setup(':memory:',{accounts,discovery:{search:async()=>[]},collector:{ready:()=>true,scan:async(_owner,watch)=>({sourceUrl:watch.url,works:[{url:watch.url,name:watch.name,comments:[]}]})},adapter:{check:async()=>{},inbox:async()=>[],send:async(_recipient,_message,signal)=>{reached();return new Promise(resolve=>signal.addEventListener('abort',()=>resolve('unknown'),{once:true}))},close:()=>{}}})
  t.after(()=>s.service.close());await prepare(s)
  const policy={message:'测试业务文案',send:true,maxMessagesPerDay:1,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30}
  await s.service.act({action:'acquisition-start',policy,confirmation:'确认启动自动获客'})
  const tick=s.service.tick();await sending
  await s.service.act({action:'acquisition-pause'});await tick
  const state=await s.service.snapshot();assert.equal(state.acquisition.phase,'paused');assert.equal(state.sending.phase,'blocked');assert.equal(state.sending.sent,0)
})

test('revoked model authorization blocks automatic discovery and outreach before any external send',async t=>{
  let sends=0,searches=0
  const s=setup(':memory:',{accounts:{status:()=>({phase:'connected',accountId:'fixture-account'}),close:async()=>{}},discovery:{search:async()=>{searches++;return []}},adapter:{check:async()=>{},inbox:async()=>[],send:async()=>{sends++;return 'sent'},close:()=>{}}})
  t.after(()=>s.service.close());await prepare(s)
  const policy={message:'测试业务文案',send:true,maxMessagesPerDay:1,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30}
  await s.service.act({action:'acquisition-start',policy,confirmation:'确认启动自动获客'})
  s.inference.models=async()=>[];await s.service.tick()
  assert.equal((await s.service.snapshot()).acquisition.errorCode,'ACQUISITION_CONTEXT_CHANGED');assert.equal(sends,0);assert.equal(searches,0)
})

test('connected collector runs from explicit startup through evidence and analysis, and records sanitized failures', async t => {
  const dir=await mkdtemp(path.join(os.tmpdir(),'dy-collector-service-'))
  let failing=false
  const s=setup(path.join(dir,'leads.sqlite'),{accounts:{status:()=>({phase:'connected',accountId:'fixture-account'}),close:async()=>{}},collector:{
    ready:()=>true,scan:async(owner,watch)=>{
      assert.match(owner,/^[a-f0-9]{64}$/)
      if(failing)throw Error('private-browser-diagnostic')
      return {sourceUrl:watch.url,works:[{url:watch.url,name:watch.name,comments:[comment]}]}
    }
  }})
  t.after(async()=>{await s.service.close();await rm(dir,{recursive:true,force:true})})
  await s.service.act({action:'model',modelId})
  await s.service.act({action:'watch',kind:'work',url:'https://www.douyin.com/video/123456789',name:'签证攻略',intervalSeconds:600})
  await s.service.act({action:'monitor-start'});await s.service.tick()
  const state=await s.service.snapshot()
  assert.equal(Object.keys(state.comments).length,1);assert.equal(Object.keys(state.decisions).length,1)
  assert.ok(state.runtimeLogs.some(row=>row.action==='monitor'&&row.phase==='completed'))
  await s.service.act({action:'monitor-pause'})
  await s.service.act({action:'watch',kind:'work',url:'https://www.douyin.com/video/234567890',name:'另一个作品',intervalSeconds:600})
  failing=true;await s.service.act({action:'monitor-start'});await s.service.tick()
  const failed=await s.service.snapshot()
  assert.equal(failed.monitoring.errorCode,'SCAN_FAILED')
  assert.ok(failed.runtimeLogs.some(row=>row.code==='SCAN_FAILED'))
  assert.doesNotMatch(JSON.stringify(failed),/private-browser-diagnostic/)
})

test('SQLite persists user-selected models, watch lists, comments and decisions after reopen', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dy-db-')), filename = path.join(folder, 'leads.sqlite')
  try {
    const first = setup(filename); await prepare(first)
    await first.service.act({ action: 'preview', input: plan() })
    await first.service.close()
    const next = setup(filename), state = await next.service.snapshot()
    assert.equal(state.modelId, modelId); assert.equal(state.watches.length, 1)
    assert.equal(Object.keys(state.comments).length, 1); assert.equal(state.candidates[comment.recipient].review, 'approved')
    assert.equal(state.preview, null); assert.equal(state.sending.live, false)
    await next.service.close()
    const database = new DatabaseSync(filename)
    assert.equal(database.prepare('PRAGMA user_version').get().user_version, 1)
    assert.ok(database.prepare('SELECT count(*) AS count FROM lead_state').get().count >= 3)
    database.close()
  } finally { await rm(folder, { recursive: true, force: true }) }
})
test('tenant switch isolates state and aborts the old send approval', async () => {
  const s = setup(); await prepare(s); const original = await s.service.snapshot()
  s.switch('tenant-b'); const different = await s.service.snapshot()
  assert.notEqual(original.owner, different.owner); assert.equal(different.watches.length, 0)
  assert.equal(Object.keys(different.candidates).length, 0)
  s.switch('tenant-a'); assert.equal((await s.service.snapshot()).watches.length, 1)
  s.logout(); await assert.rejects(s.service.snapshot()); await s.service.close()
})
test('unoffered models, client tenant IDs and arbitrary comment ingestion are rejected', async () => {
  const s = setup()
  await assert.rejects(s.service.act({ action: 'model', modelId: '30000000-0000-4000-8000-000000000099' }))
  await assert.rejects(s.service.act({ action: 'model', modelId, tenantId: 'forged' }))
  await assert.rejects(s.service.act({ action: 'scan', workId: comment.workId, comments: [comment] }))
  assert.equal((await s.service.snapshot()).modelId, null); await s.service.close()
})

test('confirmed watch removal preserves evidence and denial decisions and logs stay owner-scoped', async () => {
  const s = setup(); await prepare(s)
  await s.service.act({ action: 'review', recipient: comment.recipient, decision: 'opt-out' })
  await assert.rejects(s.service.act({ action: 'watch-delete', id: comment.workId, kind: 'work' }))
  await s.service.act({ action: 'watch-delete', id: comment.workId, kind: 'work', confirmation: '确认删除' })
  const state = await s.service.snapshot()
  assert.equal(state.watches.length, 0)
  assert.equal(Object.keys(state.comments).length, 1)
  assert.equal(state.candidates[comment.recipient].review, 'opted-out')
  assert.ok(state.runtimeLogs.some(log => log.action === 'watch-delete' && log.phase === 'completed'))
  s.switch('tenant-b'); assert.equal((await s.service.snapshot()).runtimeLogs.length, 0)
  await s.service.close()
})
test('keywords use the selected platform model and remain locally stored', async () => {
  const s = setup(); await s.service.act({ action: 'model', modelId })
  const state = await s.service.act({ action: 'keywords' })
  assert.deepEqual(state.keywords, [{ purpose: 'direct', keywords: ['越南签证代办'] }]); await s.service.close()
})
test('opt-out revokes preview and cannot be reversed through exclude or fresh analysis', async () => {
  const s = setup(); await prepare(s)
  const preview = await s.service.act({ action: 'preview', input: plan() })
  assert.ok(preview.preview); assert.equal(preview.sending.phase, 'draft')
  await s.service.act({ action: 'review', recipient: comment.recipient, decision: 'opt-out' })
  await assert.rejects(s.service.act({ action: 'start', previewId: preview.preview.previewId, confirmation: '确认启动' }))
  await assert.rejects(s.service.act({ action: 'review', recipient: comment.recipient, decision: 'exclude' }))
  await s.service.act({ action: 'analyze', key: Object.keys(preview.comments)[0] })
  assert.equal((await s.service.snapshot()).candidates[comment.recipient].review, 'opted-out')
  await s.service.close()
})
test('a scheduled send checks principal and marks successful recipients as contacted', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-03T10:00:00Z') })
  let sent = 0
  const s = setup(':memory:', { adapter: { check: async () => {}, inbox: async () => [], send: async () => { sent++; return 'sent' }, close() {} } })
  await prepare(s); const preview = await s.service.act({ action: 'preview', input: plan() })
  await s.service.act({ action: 'start', previewId: preview.preview.previewId, confirmation: '确认启动' })
  await s.service.tick(); assert.equal(sent, 0)
  t.mock.timers.tick(60000); await s.service.tick(); assert.equal(sent, 1)
  assert.equal((await s.service.snapshot()).candidates[comment.recipient].review, 'contacted')
  await s.service.close()
})
test('logout pauses an armed task without sending', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-03T10:00:00Z') })
  let sent = 0
  const s = setup(':memory:', { adapter: { check: async () => {}, inbox: async () => [], send: async () => { sent++; return 'sent' }, close() {} } })
  await prepare(s); const preview = await s.service.act({ action: 'preview', input: plan() })
  await s.service.act({ action: 'start', previewId: preview.preview.previewId, confirmation: '确认启动' })
  s.logout(); t.mock.timers.tick(60000); await s.service.tick(); assert.equal(sent, 0); await s.service.close()
})
test('a second database connection cannot overwrite stale revisions', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dy-conflict-')), filename = path.join(folder, 'leads.sqlite')
  const first = new LeadDatabase(filename), second = new LeadDatabase(filename)
  try {
    const owner = 'a'.repeat(64), a = first.store(owner, 'workspace'), b = second.store(owner, 'workspace')
    await a.load(); await b.load(); await a.save({ value: 1 })
    await assert.rejects(b.save({ value: 2 }), /CONCURRENT/)
    assert.deepEqual(await b.load(), { value: 1 })
  } finally { first.close(); second.close(); await rm(folder, { recursive: true, force: true }) }
})
test('future database versions fail closed without downgrading', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dy-schema-')), filename = path.join(folder, 'leads.sqlite')
  try {
    const db = new DatabaseSync(filename); db.exec('PRAGMA user_version=2'); db.close()
    assert.throws(() => new LeadDatabase(filename), /VERSION_UNSUPPORTED/)
    const read = new DatabaseSync(filename); assert.equal(read.prepare('PRAGMA user_version').get().user_version, 2); read.close()
  } finally { await rm(folder, { recursive: true, force: true }) }
})


test('account login has Host-owned scope, rejects injected identity and invalidates send previews', async () => {
  let current = { phase: 'disconnected', accountId: null }, owner, closes = 0
  const accounts = { status: () => current, open: async (key, signal) => {
    owner = key; current = { phase: 'awaiting-login', accountId: null }
    signal.addEventListener('abort', () => { current = { phase: 'disconnected', accountId: null } }, { once: true })
    return current
  }, check: async key => { assert.equal(key, owner); current = { phase: 'connected', accountId: 'MS4wLjABtest_account' }; return current },
  disconnect: async key => { assert.equal(key, owner); current = { phase: 'disconnected', accountId: null } }, close: async () => { closes++ } }
  const s = setup(':memory:', { accounts }); await prepare(s)
  const preview = await s.service.act({ action: 'preview', input: plan() }); assert.ok(preview.preview)
  await assert.rejects(s.service.act({ action: 'account-open', owner: 'injected', endpoint: 'http://evil.invalid' }))
  const opened = await s.service.act({ action: 'account-open' })
  assert.equal(owner, opened.owner); assert.equal(opened.account.phase, 'awaiting-login'); assert.equal(opened.preview, null)
  assert.equal((await s.service.act({ action: 'account-check' })).account.phase, 'connected')
  s.logout(); assert.equal(current.phase, 'disconnected')
  await s.service.close(); assert.equal(closes, 1)
})

function libraryAccounts() {
  let state = { phase: 'connected', accountId: 'MS4wLjABown_account_12345' }, currentKind = 'following'
  let items = [{ id: 'MS4wLjABcreator_account_12345', url: 'https://www.douyin.com/user/MS4wLjABcreator_account_12345', name: '签证作者' }]
  return { status: () => state, close: async () => {}, prepareLibrary: async (_owner, kind) => { currentKind = kind },
    readLibrary: async (_owner, kind, signal) => { signal.throwIfAborted(); if (currentKind !== kind) throw Error('LIBRARY_PANEL_REQUIRED'); return { accountId: state.accountId, items } },
    set: (next, kind = currentKind) => { items = next; currentKind = kind }, account: id => { state = { phase: 'connected', accountId: id } } }
}
test('owned following and favorites snapshots import selected records atomically and deduplicate after SQLite reopen', async () => {
  const folder = await mkdtemp(path.join(os.tmpdir(), 'dy-library-')), filename = path.join(folder, 'leads.sqlite'), accounts = libraryAccounts()
  const s = setup(filename, { accounts })
  try {
    await s.service.act({ action: 'library-open', kind: 'following' })
    let snapshot = await s.service.act({ action: 'library-read', kind: 'following' })
    const id = snapshot.library.items[0].id
    await assert.rejects(s.service.act({ action: 'library-import', snapshotId: snapshot.library.snapshotId, ids: [id, 'forged_id'], intervalSeconds: 600 }), /UNAVAILABLE/)
    assert.equal((await s.service.snapshot()).watches.length, 0)
    await s.service.act({ action: 'library-import', snapshotId: snapshot.library.snapshotId, ids: [id, id], intervalSeconds: 600 })
    snapshot = await s.service.act({ action: 'library-read', kind: 'following' })
    await s.service.act({ action: 'library-import', snapshotId: snapshot.library.snapshotId, ids: [id], intervalSeconds: 600 })
    accounts.set([{ id: '123456789', url: 'https://www.douyin.com/video/123456789', name: '收藏视频' }], 'favorites')
    snapshot = await s.service.act({ action: 'library-read', kind: 'favorites' })
    await s.service.act({ action: 'library-import', snapshotId: snapshot.library.snapshotId, ids: ['123456789'], intervalSeconds: 300 })
    await s.service.close()
    const next = setup(filename); const saved = await next.service.snapshot()
    assert.deepEqual(saved.watches.map(w => [w.kind, w.intervalSeconds]), [['account', 600], ['work', 300]])
    assert.equal(saved.library, null); await next.service.close()
  } finally { await s.service.close().catch(() => {}); await rm(folder, { recursive: true, force: true }) }
})
test('expired, cross-tenant, refreshed, changed-account and no-longer-visible selections cannot import', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-04T10:00:00Z') })
  const accounts = libraryAccounts(), s = setup(':memory:', { accounts })
  const read = () => s.service.act({ action: 'library-read', kind: 'following' })
  const command = state => ({ action: 'library-import', snapshotId: state.library.snapshotId, ids: [state.library.items[0].id], intervalSeconds: 600 })
  try {
    let state = await read(); t.mock.timers.tick(300001); await assert.rejects(s.service.act(command(state)), /EXPIRED/)
    state = await read(); await read(); await assert.rejects(s.service.act(command(state)), /EXPIRED/)
    state = await read(); s.switch('tenant-b'); await assert.rejects(s.service.act(command(state)), /EXPIRED/)
    s.switch('tenant-a'); state = await read(); accounts.set([]); await assert.rejects(s.service.act(command(state)), /UNAVAILABLE/)
    accounts.set(state.library.items); state = await read(); accounts.account('MS4wLjABanother_account_12345')
    await assert.rejects(s.service.act(command(state)), /ACCOUNT_CHANGED/)
    assert.equal((await s.service.snapshot()).watches.length, 0)
    await assert.rejects(s.service.act({ action: 'library-read', kind: 'following', tenantId: 'forged' }))
    await assert.rejects(s.service.act({ action: 'library-import', snapshotId: 'a'.repeat(64), ids: ['fake_id'], intervalSeconds: 600, url: 'https://evil.invalid' }))
  } finally { await s.service.close() }
})


test('one-click sync exposes progress without blocking GET and atomically deduplicates 250 accounts', async () => {
  const accounts = libraryAccounts()
  let release, reached; const arrived = new Promise(r => { reached = r })
  const items = Array.from({ length: 250 }, (_, n) => ({ id: `MS4wLjABcreator_account_${n}`, url: `https://www.douyin.com/user/MS4wLjABcreator_account_${n}`, name: `作者${n}` }))
  accounts.collectFollowing = async (_owner, signal, progress) => {
    progress(150); reached(); await new Promise(r => { release = r }); signal.throwIfAborted()
    return { accountId: accounts.status().accountId, items }
  }
  const s = setup(':memory:', { accounts })
  try {
    const pending = s.service.act({ action: 'following-sync' }); await arrived
    const state = await s.service.snapshot()
    assert.equal(state.followingSync.running, true); assert.equal(state.followingSync.count, 150)
    assert.equal(state.watches.length, 0)
    release(); const done = await pending
    assert.equal(done.followingSync.added, 250); assert.equal(done.watches.length, 250)
    accounts.collectFollowing = async () => ({ accountId: accounts.status().accountId, items })
    assert.equal((await s.service.act({ action: 'following-sync' })).followingSync.added, 0)
    await assert.rejects(s.service.act({ action: 'following-sync', tenantId: 'forged' }))
  } finally { await s.service.close() }
})

test('incomplete collection and logout leave the original watch list unchanged', async () => {
  const accounts = libraryAccounts(), s = setup(':memory:', { accounts })
  try {
    accounts.collectFollowing = async (_owner, _signal, progress) => { progress(10); throw Error('LIBRARY_INCOMPLETE') }
    await assert.rejects(s.service.act({ action: 'following-sync' }), /LIBRARY_INCOMPLETE/)
    assert.equal((await s.service.snapshot()).watches.length, 0)
    accounts.collectFollowing = async () => { s.logout(); return { accountId: accounts.status().accountId, items: [] } }
    await assert.rejects(s.service.act({ action: 'following-sync' }))
  } finally { await s.service.close() }
})
