import type { AccountBrowserPort } from './account-browser.js'
import { createHash, randomBytes } from 'node:crypto'
import { libraryResultSchema, type LibraryKind, type LibraryResult } from './account-library.js'
import { z } from 'zod'
import { LeadAnalyzer, type FutureStaffInferencePort, targetProfileSchema } from '@futurestaff/douyin-dm-mcp/lead-analysis'
import { LeadWorkspace, type WorkspaceStore } from '@futurestaff/douyin-dm-mcp/lead-workspace'
import { DmEngine } from '@futurestaff/douyin-dm-mcp/engine'
import type { Adapter } from '@futurestaff/douyin-dm-mcp/contracts'
import { LeadDatabase } from './database.js'
import { WatchMonitor, scanErrorCodes, type ScanErrorCode, type WatchCollector } from './watch-monitor.js'
import { discoverWorks, discoveredWorkSchema, type DiscoveryPort } from './discovery.js'
import { Acquisition, acquisitionPolicySchema, type AcquisitionPolicy } from './acquisition.js'
import { diagnosed } from './task-diagnostics.js'

export interface Principal { namespace?: string; tenantId: string; userId: string; signal: AbortSignal }
const planInput = z.object({ recipients: z.array(z.string()).min(1).max(50), message: z.string().min(1).max(500),
  scheduledAt: z.iso.datetime(), intervalSeconds: z.number().int().min(30).max(3600),
  durationSeconds: z.number().int().min(30).max(3600), maxMessages: z.number().int().min(1).max(50) }).strict()
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('model'), modelId: z.uuid() }).strict(),
  z.object({ action: z.literal('profile'), profile: targetProfileSchema }).strict(),
  z.object({ action: z.literal('watch'), kind: z.enum(['account','work']), url: z.string().max(1000), name: z.string().max(200), intervalSeconds: z.number().int().min(60).max(86400) }).strict(),
  z.object({ action: z.literal('toggle'), id: z.string().max(200), kind: z.enum(['account','work']), enabled: z.boolean() }).strict(),
  z.object({ action: z.literal('watch-delete'), id: z.string().min(1).max(200), kind: z.enum(['account','work']), confirmation: z.literal('确认删除') }).strict(),
  z.object({ action: z.literal('monitor-start') }).strict(),
  z.object({ action: z.literal('monitor-pause') }).strict(),
  z.object({ action: z.literal('keywords') }).strict(),
  z.object({ action: z.literal('discover') }).strict(),
  z.object({ action:z.literal('acquisition-start'),policy:acquisitionPolicySchema,confirmation:z.literal('确认启动自动获客') }).strict(),
  z.object({ action:z.literal('acquisition-pause') }).strict(),
  z.object({ action:z.literal('sender-check') }).strict(),
  z.object({ action: z.literal('analyze'), key: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ action: z.literal('review'), recipient: z.string().max(160), decision: z.enum(['approve','exclude','opt-out']) }).strict(),
  z.object({ action: z.literal('preview'), input: planInput }).strict(),
  z.object({ action: z.literal('start'), previewId: z.string().regex(/^[a-f0-9]{64}$/), confirmation: z.literal('确认启动') }).strict(),
  z.object({ action: z.literal('pause') }).strict(),
  z.object({ action: z.enum(['account-open','account-check','account-disconnect']) }).strict(),
  z.object({ action: z.enum(['library-open','library-read']), kind: z.enum(['following','favorites']) }).strict(),
  z.object({ action: z.literal('following-sync') }).strict(),
  z.object({ action: z.literal('library-import'), snapshotId: z.string().regex(/^[a-f0-9]{64}$/), ids: z.array(z.string().min(5).max(160)).min(1).max(200), intervalSeconds: z.number().int().min(60).max(86400) }).strict(),
])
const uiSchema = z.object({ version: z.literal(1), keywords: z.array(z.object({ purpose: z.string(), keywords: z.array(z.string()) })),
  preview: z.object({ previewId: z.string(), plan: planInput.extend({ mode: z.literal('outbound') }) }).nullable() })
type Entry = { workspace: LeadWorkspace; analyzer: LeadAnalyzer; engine: DmEngine; uiStore: WorkspaceStore;
  ui: z.infer<typeof uiSchema>; tail: Promise<unknown>; signal: AbortSignal; library: LibrarySnapshot | null; followingSync: { running: boolean; count: number; added: number } | null;
  logStore: WorkspaceStore; logs: RunLog[]; logTail: Promise<void>; monitor: WatchMonitor;
  discoveryStore: WorkspaceStore; discoveries: z.infer<typeof discoveryStateSchema>;
  acquisition:Acquisition;approvedProfile:{version:number;modelId:string}|null;outreachStore:WorkspaceStore;budget:z.infer<typeof budgetSchema>;autoSignal?:AbortSignal }
const budgetSchema=z.object({day:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),attempts:z.number().int().min(0).max(50)}).strict()
type OwnedSender={ready(owner:string):boolean;check(owner:string,recipient:string,signal:AbortSignal):Promise<void>;adapter(owner:string):Adapter}
const discoveryStateSchema=z.array(discoveredWorkSchema.extend({reason:z.string().max(500),quotes:z.array(z.string().max(500)).max(3),profileVersion:z.number().int().nonnegative().default(0),modelId:z.uuid().nullable().default(null)})).max(100)
const runLogSchema = z.array(z.object({ at: z.number(), action: z.string().max(40), phase: z.enum(['started','completed','failed']), code: z.enum(scanErrorCodes).optional() }).strict()).max(200)
type RunLog = z.infer<typeof runLogSchema>[number]
type LibrarySnapshot = LibraryResult & { kind: LibraryKind; snapshotId: string; expiresAt: number }

export class DouyinService {
  private entries = new Map<string, Promise<Entry>>()
  private closed = false
  constructor(private db: LeadDatabase, private authorize: () => Promise<Principal>,
    private inference: FutureStaffInferencePort, private adapter?: Adapter, private live = false, private accounts?: AccountBrowserPort,
    private collector?: WatchCollector, private discovery?: DiscoveryPort,private ownedSender?:OwnedSender) {}
  private async entry() {
    if (this.closed) throw new Error('SERVICE_CLOSED')
    const principal = await this.authorize(); principal.signal.throwIfAborted()
    const owner = createHash('sha256').update(JSON.stringify([...(principal.namespace ? [principal.namespace] : []), principal.tenantId, principal.userId])).digest('hex')
    let promise = this.entries.get(owner)
    if (!promise) {
      if (this.entries.size >= 100) throw new Error('LOCAL_ACCOUNT_LIMIT')
      promise = this.create(owner, principal); this.entries.set(owner, promise)
    }
    const entry = await promise
    // A refreshed login does not restore old sending approval.
    if (entry.signal !== principal.signal) {
      entry.acquisition.stop();await entry.acquisition.settle();entry.acquisition.rebind(principal.signal);entry.approvedProfile=null
      entry.monitor.stop(); await entry.monitor.settle(); entry.monitor.rebind(principal.signal)
      await entry.engine.pause(); entry.library = null; entry.followingSync = null; entry.signal = principal.signal
      principal.signal.addEventListener('abort', () => { entry.acquisition.stop();entry.monitor.stop(); entry.library = null; entry.followingSync = null; void entry.engine.pause().catch(() => {}) }, { once: true })
    }
    principal.signal.throwIfAborted()
    return { entry, principal, owner }
  }
  private async create(owner: string, principal: Principal): Promise<Entry> {
    const analyzer = new LeadAnalyzer(this.inference)
    const workspace = new LeadWorkspace(principal, analyzer, this.db.store(owner, 'workspace'))
    await workspace.init()
    const uiStore = this.db.store(owner, 'ui'), saved = await uiStore.load()
    const ui = saved ? uiSchema.parse(saved) : { version: 1 as const, keywords: [], preview: null }
    ui.preview = null // Restart invalidates the browser/send approval, including the UI button.
    await uiStore.save(ui)
    // Keep the previous log contract untouched so the prior plugin can roll back.
    const logStore = this.db.store(owner, 'run-log-diagnostics')
    const savedLogs = await logStore.load() ?? await this.db.store(owner,'run-log-automation').load() ?? await this.db.store(owner,'run-log').load()
    const logs = savedLogs === null ? [] : runLogSchema.parse(savedLogs)
    const discoveryStore=this.db.store(owner,'discovery'),savedDiscoveries=await discoveryStore.load()
    const discoveries=savedDiscoveries===null?[]:discoveryStateSchema.parse(savedDiscoveries)
    const outreachStore=this.db.store(owner,'outreach-budget'),savedBudget=await outreachStore.load()
    const budget=savedBudget===null?{day:this.day(),attempts:0}:budgetSchema.parse(savedBudget)
    let entry: Entry
    const browserAdapter=(this.live?this.adapter:undefined)??this.ownedSender?.adapter(owner)
    const guarded: Adapter = {
      check: async () => {
        const active = await this.authorize(); active.signal.throwIfAborted()
        if (active.tenantId !== principal.tenantId || active.userId !== principal.userId || active.signal !== entry.signal)
          throw new Error('PRINCIPAL_CHANGED')
        if (!browserAdapter) throw new Error('BROWSER_NOT_CONFIGURED')
        await browserAdapter.check()
      },
      inbox: async () => [],
      send: async (recipient, message, signal) => {
        entry.signal.throwIfAborted()
        const preview = entry.ui.preview
        if (!preview) throw new Error('PREVIEW_REQUIRED')
        workspace.messagePlan({ ...preview.plan, recipients: [recipient] })
        const result = await browserAdapter!.send(recipient, message, AbortSignal.any([signal, entry.signal,...(entry.autoSignal?[entry.autoSignal]:[])]))
        if (result === 'sent') await workspace.markContacted(recipient)
        return result
      }, close: () => {},
    }
    const engine = new DmEngine(owner, guarded, this.db.store(owner, 'send'), (this.live&&!!this.adapter)||!!this.ownedSender)
    await engine.init()
    const monitor = new WatchMonitor(owner, workspace, principal.signal, this.collector, (phase, code) => this.log(entry, 'monitor', phase, code))
    const acquisition=new Acquisition(principal.signal,{
      valid:()=>!entry.signal.aborted&&entry.approvedProfile?.version===workspace.snapshot().profile.version&&entry.approvedProfile?.modelId===workspace.snapshot().modelId,
      discover:signal=>this.discoverEntry(entry,{...principal,signal:entry.signal},owner,signal),
      monitor:async signal=>{if(!workspace.snapshot().watches.some(w=>w.enabled))return;if(monitor.status().phase==='blocked')throw Error('MONITOR_FAILED');if(monitor.status().phase!=='running')monitor.start();await monitor.tick(signal);if(monitor.status().phase==='blocked')throw Error('MONITOR_FAILED')},
      send:(policy,signal)=>this.outreach(entry,policy,signal),log:(phase,code)=>this.log(entry,'acquisition',phase,code),
    })
    entry = { workspace, analyzer, engine, uiStore, ui, tail: Promise.resolve(), signal: principal.signal, library: null, followingSync: null, logStore, logs, logTail: Promise.resolve(), monitor, discoveryStore, discoveries,acquisition,approvedProfile:null,outreachStore,budget }
    principal.signal.addEventListener('abort', () => { acquisition.stop();monitor.stop(); entry.library = null; entry.followingSync = null; void engine.pause().catch(() => {}) }, { once: true })
    return entry
  }
  private async view(entry: Entry, principal: Principal, owner: string) {
    const models = await this.inference.models()
    principal.signal.throwIfAborted()
    const current = await this.authorize()
    if (current.signal !== principal.signal) throw new Error('PRINCIPAL_CHANGED')
    if (entry.library && (entry.library.expiresAt <= Date.now() || this.accounts?.status(owner).accountId !== entry.library.accountId)) entry.library = null
    return { ...entry.workspace.snapshot(), owner, models: models.map(m => ({ modelId: m.modelId, displayName: m.displayName })),
      keywords: entry.ui.keywords, preview: entry.ui.preview, sending: entry.engine.status(), library: entry.library, followingSync: entry.followingSync,
      discoveries: structuredClone(entry.discoveries.filter(item=>item.profileVersion===entry.workspace.snapshot().profile.version&&item.modelId===entry.workspace.snapshot().modelId)), discoveryReady: !!this.discovery,
      acquisition:entry.acquisition.status(),outreachBudget:entry.budget.day===this.day()?entry.budget.attempts:0,
      browserReady: (this.live&&!!this.adapter)||!!this.ownedSender?.ready(owner), runtimeLogs: structuredClone(entry.logs), monitoring: entry.monitor.status(), account: this.accounts?.status(owner) ?? { phase: 'disconnected' as const, accountId: null } }
  }
  async snapshot() { const { entry, principal, owner } = await this.entry(); if (!entry.followingSync?.running) await entry.tail; return this.view(entry, principal, owner) }
  async act(input: unknown) {
    const command = actionSchema.parse(input), { entry, principal, owner } = await this.entry()
    entry.acquisition.stop();entry.monitor.stop()
    const sendingPaused=entry.engine.pause() // Cancel the send before waiting for the pipeline to settle.
    await entry.acquisition.settle();await entry.monitor.settle();await sendingPaused
    if (['discover','monitor-pause','watch-delete','toggle','profile','model','account-open','account-check','account-disconnect','start','library-open','library-read','following-sync'].includes(command.action)) {
      entry.monitor.stop(); await entry.monitor.settle()
    }
    if (['profile','model','review','pause'].includes(command.action)) await entry.engine.pause()
    const result = entry.tail.then(async () => {
      if (this.closed) throw new Error('SERVICE_CLOSED')
      principal.signal.throwIfAborted()
      await this.log(entry, command.action, 'started')
      if (['profile','model','review','pause'].includes(command.action)) await entry.engine.pause()
      switch (command.action) {
        case 'model': await entry.workspace.selectModel(command.modelId); entry.ui.preview = null; break
        case 'profile': await entry.workspace.configureProfile(command.profile); entry.ui.preview = null; entry.ui.keywords = []; break
        case 'watch': await entry.workspace.addWatch(command.kind, command); break
        case 'toggle': await entry.workspace.setWatchEnabled(command.id, command.kind, command.enabled); break
        case 'watch-delete': await entry.workspace.removeWatch(command.id, command.kind); break
        case 'monitor-start':
          if (entry.engine.status().phase === 'running') throw Error('PAUSE_SENDING_FIRST')
          if (this.accounts?.status(owner).phase !== 'connected') throw Error('ACCOUNT_LOGIN_REQUIRED')
          entry.monitor.start(); break
        case 'monitor-pause': break
        case 'keywords': {
          const snapshot = entry.workspace.snapshot()
          if (!snapshot.modelId) throw new Error('MODEL_REQUIRED')
          const result = await entry.analyzer.keywords(snapshot.profile, snapshot.modelId, principal.signal)
          principal.signal.throwIfAborted()
          if (result.tenantId !== principal.tenantId || result.userId !== principal.userId) throw new Error('PRINCIPAL_CHANGED')
          entry.ui.keywords = result.groups; break
        }
        case 'discover': {
          await entry.engine.pause();await this.discoverEntry(entry,principal,owner,principal.signal)
          break
        }
        case 'acquisition-pause': entry.approvedProfile=null;break
        case 'acquisition-start': {
          const snapshot=entry.workspace.snapshot()
          if(!snapshot.modelId||!this.discovery||this.accounts?.status(owner).phase!=='connected')throw Error('ACQUISITION_NOT_READY')
          if(command.policy.send&&(!this.ownedSender?.ready(owner)&&!(this.live&&this.adapter)))throw Error('SEND_NOT_READY')
          entry.approvedProfile={version:snapshot.profile.version,modelId:snapshot.modelId};entry.acquisition.start(command.policy);break
        }
        case 'sender-check': {
          const snapshot=entry.workspace.snapshot(),candidate=Object.values(snapshot.candidates).find(item=>['approved','eligible'].includes(item.review)&&item.profileVersion===snapshot.profile.version)
          if(!candidate||!this.ownedSender)throw Error('SEND_CANDIDATE_REQUIRED')
          await this.ownedSender.check(owner,candidate.recipient,principal.signal);break
        }
        case 'analyze': await entry.workspace.analyzeOne(command.key, principal.signal); break
        case 'review': await entry.workspace.review(command.recipient, command.decision); entry.ui.preview = null; break
        case 'preview': {
          const time = Date.parse(command.input.scheduledAt)
          if (time < Date.now() || time > Date.now() + 7 * 86400000) throw new Error('SCHEDULE_OUT_OF_RANGE')
          const preview = await entry.engine.preview(entry.workspace.messagePlan(command.input))
          if (preview.plan.mode !== 'outbound') throw new Error('OUTBOUND_REQUIRED')
          entry.ui.preview = { previewId: preview.previewId, plan: uiSchema.shape.preview.unwrap().shape.plan.parse(preview.plan) }; break
        }
        case 'start': {
          if (!entry.ui.preview || entry.ui.preview.previewId !== command.previewId) throw new Error('PREVIEW_MISMATCH')
          entry.workspace.messagePlan(entry.ui.preview.plan)
          await entry.engine.start(command.previewId); break
        }
        case 'account-open': await entry.engine.pause(); entry.library = null; entry.ui.preview = null; if (!this.accounts) throw new Error('BROWSER_UNAVAILABLE'); await this.accounts.open(owner, principal.signal); break
        case 'account-check': await entry.engine.pause(); entry.library = null; entry.ui.preview = null; if (!this.accounts) throw new Error('BROWSER_UNAVAILABLE'); await this.accounts.check(owner, principal.signal); break
        case 'account-disconnect': await entry.engine.pause(); entry.library = null; entry.ui.preview = null; await this.accounts?.disconnect(owner); break
        case 'following-sync': {
          entry.followingSync = { running: true, count: 0, added: 0 }
          try {
            await entry.engine.pause(); entry.ui.preview = null; entry.library = null
            if (!this.accounts) throw new Error('BROWSER_UNAVAILABLE')
            const result = libraryResultSchema.parse(await this.accounts.collectFollowing(owner, principal.signal, count => {
              if (!principal.signal.aborted) entry.followingSync = { running: true, count, added: 0 }
            }))
            principal.signal.throwIfAborted()
            const current = await this.authorize()
            if (current.signal !== principal.signal) throw new Error('PRINCIPAL_CHANGED')
            if (this.accounts.status(owner).accountId !== result.accountId) throw new Error('LIBRARY_ACCOUNT_CHANGED')
            const before = entry.workspace.snapshot().watches.length
            if (result.items.length) await entry.workspace.addWatches('account', result.items.map(item => ({ ...item, intervalSeconds: 600 })))
            entry.followingSync = { running: false, count: result.items.length, added: entry.workspace.snapshot().watches.length - before }
          } finally {
            if (entry.followingSync) entry.followingSync.running = false
          }
          break
        }
        case 'library-open':
          await entry.engine.pause(); entry.ui.preview = null; entry.library = null
          if (!this.accounts) throw new Error('BROWSER_UNAVAILABLE')
          await this.accounts.prepareLibrary(owner, command.kind, principal.signal); break
        case 'library-read': {
          entry.library = null
          if (!this.accounts) throw new Error('BROWSER_UNAVAILABLE')
          const result = libraryResultSchema.parse(await this.accounts.readLibrary(owner, command.kind, principal.signal))
          principal.signal.throwIfAborted()
          if (this.accounts.status(owner).accountId !== result.accountId) throw new Error('LIBRARY_ACCOUNT_CHANGED')
          entry.library = { ...result, kind: command.kind, snapshotId: randomBytes(32).toString('hex'), expiresAt: Date.now() + 300000 }; break
        }
        case 'library-import': {
          const library = entry.library
          if (!library || library.snapshotId !== command.snapshotId || library.expiresAt <= Date.now() || !this.accounts) throw new Error('LIBRARY_EXPIRED')
          // Re-read the owned tab before importing: account/list navigation invalidates the selection.
          const current = libraryResultSchema.parse(await this.accounts.readLibrary(owner, library.kind, principal.signal))
          principal.signal.throwIfAborted()
          if (entry.library !== library || library.expiresAt <= Date.now()) throw new Error('LIBRARY_EXPIRED')
          if (current.accountId !== library.accountId) { entry.library = null; throw new Error('LIBRARY_ACCOUNT_CHANGED') }
          const items = [...new Set(command.ids)].map(id => {
            const item = library.items.find(item => item.id === id)
            if (!item || !current.items.some(now => now.id === id && now.url === item.url)) throw new Error('LIBRARY_ITEM_UNAVAILABLE')
            return { ...item, intervalSeconds: command.intervalSeconds }
          })
          await entry.workspace.addWatches(library.kind === 'following' ? 'account' : 'work', items)
          entry.library = null; break
        }
        case 'pause': break
      }
      if (command.action !== 'start') await entry.uiStore.save(entry.ui)
      return this.view(entry, principal, owner)
    })
    const logged = result.then(async value => { await this.log(entry, command.action, 'completed'); return { ...value, runtimeLogs: structuredClone(entry.logs) } },
      async error => { await this.log(entry, command.action, 'failed'); throw error })
    entry.tail = logged.catch(() => {})
    return logged
  }
  private log(entry: Entry, action: string, phase: RunLog['phase'], code?: ScanErrorCode) {
    const next = entry.logTail.then(async () => {
      const logs = [...entry.logs, { at: Date.now(), action, phase, ...(code ? { code } : {}) }].slice(-200)
      await entry.logStore.save(logs); entry.logs = logs
    })
    entry.logTail = next.catch(() => {})
    return next
  }
  private day(){return new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'})}
  private async discoverEntry(entry:Entry,principal:Principal,owner:string,parentSignal:AbortSignal){
    if(!this.discovery||this.accounts?.status(owner).phase!=='connected')throw Error('ACCOUNT_LOGIN_REQUIRED')
    const snapshot=entry.workspace.snapshot()
    if(!snapshot.modelId)throw Error('MODEL_REQUIRED')
    const signal=AbortSignal.any([parentSignal,principal.signal,AbortSignal.timeout(90_000)])
    const keywords=await diagnosed('KEYWORDS',signal,()=>entry.analyzer.keywords(snapshot.profile,snapshot.modelId!,signal))
    if(keywords.tenantId!==principal.tenantId||keywords.userId!==principal.userId)throw Error('PRINCIPAL_CHANGED')
    const accepted=[]
    for(const keyword of keywords.keywords.slice(0,3))accepted.push(...await discoverWorks(this.discovery,entry.analyzer,{owner,tenantId:principal.tenantId,userId:principal.userId,profile:snapshot.profile,modelId:snapshot.modelId,keyword,signal}))
    signal.throwIfAborted()
    const current=await this.authorize()
    if(current.signal!==principal.signal||entry.workspace.snapshot().profile.version!==snapshot.profile.version||entry.workspace.snapshot().modelId!==snapshot.modelId)throw Error('PRINCIPAL_CHANGED')
    const bound=accepted.map(work=>({...work,profileVersion:snapshot.profile.version,modelId:snapshot.modelId!}))
    const findings=[...new Map([...bound,...entry.discoveries.filter(item=>item.profileVersion===snapshot.profile.version&&item.modelId===snapshot.modelId)].map(work=>[work.id,work])).values()].slice(0,100)
    if(accepted.length)await entry.workspace.addWatches('work',accepted.map(work=>({url:work.url,name:work.name,intervalSeconds:600})))
    await entry.discoveryStore.save(findings);entry.discoveries=findings;entry.ui.keywords=keywords.groups
  }
  private async outreach(entry:Entry,policy:AcquisitionPolicy,signal:AbortSignal):Promise<'sent'|'none'|'unknown'>{
    signal.throwIfAborted()
    if(entry.engine.status().phase==='blocked')return 'unknown'
    const snapshot=entry.workspace.snapshot(),candidate=Object.values(snapshot.candidates).find(item=>['approved','eligible'].includes(item.review)&&item.profileVersion===snapshot.profile.version&&item.commentKeys.some(key=>{
      const comment=snapshot.comments[key],decision=snapshot.decisions[key]
      return comment&&decision?.classification==='target'&&decision.modelId===snapshot.modelId&&decision.profileVersion===snapshot.profile.version&&snapshot.watches.some(watch=>watch.kind==='work'&&watch.enabled&&watch.id===comment.workId)
    }))
    if(!candidate)return 'none'
    const day=this.day(),used=entry.budget.day===day?entry.budget.attempts:0
    if(used>=policy.maxMessagesPerDay)return 'none'
    const plan=entry.workspace.messagePlan({recipients:[candidate.recipient],message:policy.message,scheduledAt:new Date().toISOString(),intervalSeconds:policy.intervalSeconds,durationSeconds:60,maxMessages:1})
    await entry.outreachStore.save({day,attempts:used+1});entry.budget={day,attempts:used+1}
    signal.throwIfAborted()
    const preview=await entry.engine.preview(plan)
    if(preview.plan.mode!=='outbound')throw Error('OUTBOUND_REQUIRED')
    entry.ui.preview={previewId:preview.previewId,plan:uiSchema.shape.preview.unwrap().shape.plan.parse(preview.plan)}
    entry.autoSignal=signal
    try{signal.throwIfAborted();await entry.engine.start(preview.previewId);signal.throwIfAborted();await entry.engine.tick()}
    finally{delete entry.autoSignal}
    const state=entry.engine.status();entry.ui.preview=null
    return state.sent===1?'sent':'unknown'
  }
  /** Trusted Host collectors only; this method has no Renderer/Tool route. */
  async recordScan(workId: string, comments: unknown[]) {
    const { entry, principal } = await this.entry()
    principal.signal.throwIfAborted(); await entry.workspace.recordScan(workId, comments)
  }
  async tick() {
    for (const promise of this.entries.values()) {
      const entry = await promise
      if(entry.acquisition.status().phase==='running'){
        const principal=await this.authorize()
        if(principal.signal!==entry.signal||entry.signal.aborted){entry.acquisition.stop();entry.monitor.stop();await entry.engine.pause()}
        else{
          const models=await this.inference.models().catch(()=>[])
          if(!models.some(model=>model.modelId===entry.approvedProfile?.modelId)){
            entry.approvedProfile=null;entry.monitor.stop();await entry.engine.pause()
          }
          await entry.acquisition.tick()
        }
        continue
      }
      if (entry.monitor.status().phase === 'running') {
        const principal = await this.authorize()
        if (principal.signal !== entry.signal || entry.signal.aborted) entry.monitor.stop()
        else await entry.monitor.tick()
      }
      if (entry.engine.status().phase === 'running') {
        if (entry.signal.aborted) await entry.engine.pause()
        else await entry.engine.tick()
      }
    }
  }
  async close() {
    this.closed = true
    for (const promise of this.entries.values()) {
      const entry = await promise;entry.acquisition.stop();entry.monitor.stop();await entry.engine.pause();await entry.acquisition.settle(); await entry.monitor.settle(); await entry.tail; await entry.engine.pause(); await entry.logTail
    }
    await this.accounts?.close(); this.adapter?.close(); this.db.close()
  }
}
export type DouyinSnapshot = Omit<Awaited<ReturnType<DouyinService['snapshot']>>, 'runtimeLogs' | 'monitoring' | 'discoveries' | 'discoveryReady'|'acquisition'|'outreachBudget'> & {
  runtimeLogs?: RunLog[]; monitoring?: ReturnType<WatchMonitor['status']>; discoveries?:z.infer<typeof discoveryStateSchema>;discoveryReady?:boolean;acquisition?:ReturnType<Acquisition['status']>;outreachBudget?:number
}
