import { createHash } from 'node:crypto'
import { z } from 'zod'
import { planSchema } from './contracts.js'
import { LeadAnalyzer, commentContextSchema, targetProfileSchema, vietnamVisaProfile, type CommentContext } from './lead-analysis.js'

export interface WorkspaceStore { load(): Promise<unknown | null>; save(value: unknown): Promise<void> }
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const watchSchema = z.object({ id: z.string(), kind: z.enum(['account', 'work']), url: z.string(),
  name: z.string().max(200), enabled: z.boolean(), intervalSeconds: z.number().int().min(60).max(86400), nextAt: z.number(),
}).strict()
const evidenceRecordSchema = z.object({ key: z.string(), profileVersion: z.number(), modelId: z.string(),
  classification: z.enum(['target', 'uncertain', 'excluded']), reason: z.string(), need: z.string(),
  quotes: z.array(z.object({ source: z.string(), quote: z.string() })),
}).strict()
const candidateSchema = z.object({ recipient: z.string(), commentKeys: z.array(z.string()),
  profileVersion: z.number(), review: z.enum(['pending', 'eligible', 'approved', 'excluded', 'contacted', 'opted-out']),
}).strict()
const stateSchema = z.object({
  version: z.literal(1), owner: z.string(), profile: targetProfileSchema,
  modelId: z.string().nullable(), revision: z.number(),
  watches: z.array(watchSchema).max(500), comments: z.record(z.string(), commentContextSchema),
  decisions: z.record(z.string(), evidenceRecordSchema), candidates: z.record(z.string(), candidateSchema),
}).strict()
type WorkspaceState = z.infer<typeof stateSchema>

/** Principal is supplied by the authenticated Host, never by model-authored Tool arguments. */
export class LeadWorkspace {
  private state!: WorkspaceState
  private tail: Promise<unknown> = Promise.resolve()
  private owner: string
  constructor(private principal: { tenantId: string; userId: string }, private analyzer: LeadAnalyzer,
    private store: WorkspaceStore, private now = Date.now) {
    if (!principal.tenantId || !principal.userId) throw new Error('TRUSTED_PRINCIPAL_REQUIRED')
    this.owner = hash(JSON.stringify([principal.tenantId, principal.userId]))
  }
  private exclusive<T>(fn: () => Promise<T>) {
    const result = this.tail.then(fn); this.tail = result.catch(() => {}); return result
  }
  private async mutate(fn: () => void) {
    const before = structuredClone(this.state)
    try { fn(); await this.store.save(this.state) } catch (error) { this.state = before; throw error }
  }
  async init() {
    const saved = await this.store.load()
    this.state = saved === null ? { version: 1, owner: this.owner, profile: structuredClone(vietnamVisaProfile), modelId: null,
      revision: 0, watches: [], comments: {}, decisions: {}, candidates: {} } : stateSchema.parse(saved)
    if (this.state.owner !== this.owner) throw new Error('WORKSPACE_OWNER_MISMATCH')
    await this.store.save(this.state)
  }
  snapshot() { return structuredClone(this.state) }
  async selectModel(modelId: string) {
    z.uuid().parse(modelId)
    if (!(await this.analyzer.models()).some(model => model.modelId === modelId)) throw new Error('MODEL_NOT_AUTHORIZED')
    return this.exclusive(() => this.mutate(() => {
      this.state.modelId = modelId; this.state.revision++
      for(const candidate of Object.values(this.state.candidates))if(!['contacted','opted-out'].includes(candidate.review))candidate.review='pending'
    }))
  }
  configureProfile(input: unknown) {
    const profile = targetProfileSchema.parse(input)
    return this.exclusive(() => this.mutate(() => {
      profile.version = this.state.profile.version + 1
      this.state.profile = profile; this.state.revision++
      for (const candidate of Object.values(this.state.candidates)) {
        if (!['contacted', 'opted-out'].includes(candidate.review)) candidate.review = 'pending'
      }
    }))
  }
  addWatch(kind: 'account' | 'work', input: { url: string; name: string; intervalSeconds: number }) {
    return this.addWatches(kind, [input])
  }
  addWatches(kind: 'account' | 'work', inputs: { url: string; name: string; intervalSeconds: number }[]) {
    if (!inputs.length || inputs.length > 500) throw new Error('WATCH_BATCH_LIMIT')
    const watches = inputs.map(input => {
      const url = new URL(input.url)
      const expression = kind === 'account' ? /^\/user\/([A-Za-z0-9_-]{8,160})\/?$/ : /^\/(?:video|note)\/([0-9]{5,30})\/?$/
      const match = expression.exec(url.pathname)
      if (url.origin !== 'https://www.douyin.com' || !match || url.username || url.password) throw new Error('WATCH_URL_INVALID')
      const watch = watchSchema.parse({ id: match[1], kind, url: url.origin + url.pathname.replace(/\/$/, ''),
        name: input.name, intervalSeconds: input.intervalSeconds, nextAt: this.now(), enabled: true })
      return watch
    })
    return this.exclusive(() => this.mutate(() => {
      const additions = [...new Map(watches.map(watch => [watch.id, watch])).values()]
        .filter(watch => !this.state.watches.some(item => item.id === watch.id && item.kind === kind))
      if (this.state.watches.length + additions.length > 500) throw new Error('WATCH_LIMIT')
      this.state.watches.push(...additions)
    }))
  }
  setWatchEnabled(id: string, kind: 'account' | 'work', enabled: boolean) {
    return this.exclusive(() => this.mutate(() => {
      const watch = this.state.watches.find(item => item.id === id && item.kind === kind)
      if (!watch) throw new Error('WATCH_NOT_FOUND')
      watch.enabled = enabled; this.state.revision++
    }))
  }
  dueWatches() { return structuredClone(this.state.watches.filter(watch => watch.enabled && watch.nextAt <= this.now())) }
  removeWatch(id: string, kind: 'account' | 'work') {
    return this.exclusive(() => this.mutate(() => {
      this.state.watches = this.state.watches.filter(watch => watch.id !== id || watch.kind !== kind)
      this.state.revision++
      // Historical evidence and contact/opt-out decisions remain intact.
    }))
  }
  completeWatchScan(id: string, kind: 'account' | 'work') {
    return this.exclusive(() => this.mutate(() => {
      const watch = this.state.watches.find(item => item.id === id && item.kind === kind)
      if (watch) watch.nextAt = this.now() + watch.intervalSeconds * 1000
    }))
  }
  // Trusted collectors alone call this; do not expose arbitrary model-authored ingestion as a Tool.
  recordScan(workId: string, commentsInput: unknown[]) {
    if (commentsInput.length > 500) throw new Error('SCAN_LIMIT')
    const comments = commentsInput.map(comment => commentContextSchema.parse(comment))
    return this.exclusive(() => this.mutate(() => {
      const watch = this.state.watches.find(item => item.id === workId && item.kind === 'work' && item.enabled)
      if (!watch) throw new Error('WORK_NOT_WATCHED')
      if (comments.length > 500 || comments.some(comment => comment.workId !== workId)) throw new Error('SCAN_SOURCE_MISMATCH')
      for (const comment of comments) {
        const key = hash(JSON.stringify([comment.workId, comment.commentId]))
        if (this.state.comments[key]) continue
        if (Object.keys(this.state.comments).length >= 10000) throw new Error('COMMENT_LIMIT')
        this.state.comments[key] = comment
      }
      watch.nextAt = this.now() + watch.intervalSeconds * 1000
    }))
  }
  pendingComments(): { key: string; comment: CommentContext }[] {
    return Object.entries(this.state.comments).filter(([key,comment]) => this.state.watches.some(watch=>watch.kind==='work'&&watch.id===comment.workId&&watch.enabled)&&(this.state.decisions[key]?.profileVersion !== this.state.profile.version||this.state.decisions[key]?.modelId!==this.state.modelId))
      .map(([key, comment]) => ({ key, comment: structuredClone(comment) }))
  }
  async analyzeOne(key: string, signal?: AbortSignal) {
    const comment = this.state.comments[key], modelId = this.state.modelId, revision = this.state.revision
    if (!comment || !modelId) throw new Error('COMMENT_OR_MODEL_REQUIRED')
    const profile = structuredClone(this.state.profile)
    const result = await this.analyzer.classify(profile, comment, modelId, signal)
    if (result.tenantId !== this.principal.tenantId || result.userId !== this.principal.userId) throw new Error('ANALYSIS_OWNER_MISMATCH')
    return this.exclusive(() => this.mutate(() => {
      signal?.throwIfAborted()
      if (revision !== this.state.revision) throw new Error('ANALYSIS_CONTEXT_CHANGED')
      this.state.decisions[key] = { key, profileVersion: profile.version, modelId,
        classification: result.decision.classification, reason: result.decision.reason, need: result.decision.need, quotes: result.decision.evidence }
      const previous = this.state.candidates[result.recipient]
      const protectedReview = previous && ['contacted', 'opted-out'].includes(previous.review) ? previous.review : undefined
      if (result.decision.classification === 'excluded') {
        if (previous && !protectedReview) previous.review = 'pending'
        return
      }
      this.state.candidates[result.recipient] = { recipient: result.recipient,
        commentKeys: [...new Set([...(previous?.commentKeys ?? []), key])], profileVersion: profile.version,
        review: protectedReview ?? (result.review === 'eligible' ? 'eligible' : 'pending') }
    }))
  }
  review(recipient: string, action: 'approve' | 'exclude' | 'opt-out') {
    return this.exclusive(() => this.mutate(() => {
      const candidate = this.state.candidates[recipient]
      if (!candidate) throw new Error('CANDIDATE_NOT_FOUND')
      if (candidate.review === 'opted-out' && action !== 'opt-out') throw new Error('CANDIDATE_NOT_ELIGIBLE')
      if (candidate.review === 'contacted' && action !== 'opt-out') throw new Error('ALREADY_CONTACTED')
      if (action === 'approve' && (candidate.profileVersion !== this.state.profile.version || ['opted-out', 'contacted'].includes(candidate.review)
        || !candidate.commentKeys.some(key => this.state.decisions[key]?.classification === 'target' && this.state.decisions[key]?.profileVersion === this.state.profile.version&&this.state.decisions[key]?.modelId===this.state.modelId)))
        throw new Error('CANDIDATE_NOT_ELIGIBLE')
      candidate.review = action === 'approve' ? 'approved' : action === 'exclude' ? 'excluded' : 'opted-out'
    }))
  }
  markContacted(recipient: string) {
    return this.exclusive(() => this.mutate(() => {
      const candidate = this.state.candidates[recipient]
      if (candidate && candidate.review !== 'opted-out') candidate.review = 'contacted'
    }))
  }
  messagePlan(input: { recipients: string[]; message: string; scheduledAt: string; intervalSeconds: number; durationSeconds: number; maxMessages: number }) {
    if (!input.recipients.length || input.recipients.some(recipient => {
      const candidate = this.state.candidates[recipient]
      return !candidate || !(candidate.review === 'approved'
        || (candidate.review === 'eligible' && this.state.profile.reviewMode === 'high-intent-only'))
        || candidate.profileVersion !== this.state.profile.version
    })) throw new Error('REVIEWED_RECIPIENTS_REQUIRED')
    return planSchema.parse({ mode: 'outbound', ...input, recipients: [...new Set(input.recipients)] })
  }
}
