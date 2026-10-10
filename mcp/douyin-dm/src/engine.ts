import { createHash, randomUUID } from 'node:crypto'
import { planSchema, incomingSchema, stateSchema, type Adapter, type State } from './contracts.js'

export interface Store { load(): Promise<unknown | null>; save(state: State): Promise<void> }
const digest = (s: string) => createHash('sha256').update(s).digest('hex')

export class DmEngine {
  private state!: State
  private tail: Promise<unknown> = Promise.resolve()
  private generation = 0
  private controller = new AbortController()
  constructor(private owner: string, private adapter: Adapter, private store: Store,
    private live: boolean, private now = Date.now) {}

  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.tail.then(fn)
    this.tail = result.catch(() => {})
    return result
  }
  private event(event: string) {
    this.state.events.push({ at: this.now(), event })
    this.state.events = this.state.events.slice(-100)
  }
  private async save() { await this.store.save(structuredClone(this.state)) }
  async init() {
    const saved = await this.store.load()
    this.state = saved === null ? {
      version: 1, owner: this.owner, phase: 'idle', plan: null, previewId: '',
      expiresAt: 0, sent: 0, cursor: 0, nextAt: 0, seen: [], ledger: {}, events: [],
    } : stateSchema.parse(saved)
    if (this.state.owner !== this.owner) throw new Error('OWNER_MISMATCH')
    if (Object.values(this.state.ledger).includes('attempting')) {
      this.state.phase = 'blocked'
      for (const key in this.state.ledger) {
        if (this.state.ledger[key] === 'attempting') this.state.ledger[key] = 'unknown'
      }
      this.event('interrupted_send_requires_manual_review')
    } else if (this.state.phase === 'running') this.state.phase = 'paused'
    this.state.previewId = '' // Approval never survives a process restart.
    await this.save()
  }
  status() {
    return { phase: this.state.phase, mode: this.state.plan?.mode ?? null,
      sent: this.state.sent, cursor: this.state.cursor, expiresAt: this.state.expiresAt,
      nextAt: this.state.nextAt,
      live: this.live, events: structuredClone(this.state.events) }
  }
  preview(input: unknown) {
    return this.exclusive(async () => {
      if (this.state.phase === 'running') throw new Error('PAUSE_FIRST')
      if (Object.values(this.state.ledger).includes('unknown')) throw new Error('UNRESOLVED_SEND')
      if (Object.keys(this.state.ledger).length >= 10000) throw new Error('LEDGER_LIMIT')
      const plan = planSchema.parse(input)
      if (plan.mode === 'outbound') plan.recipients = [...new Set(plan.recipients)]
      const previewId = digest(JSON.stringify(plan) + randomUUID())
      this.state.plan = plan
      this.state.previewId = previewId
      this.state.phase = 'draft'
      this.state.sent = 0; this.state.cursor = 0
      this.event('preview_created')
      await this.save()
      return { previewId, plan: structuredClone(plan), live: this.live,
        confirmation: '确认账号、名单/规则、间隔、数量和时长后启动。自动回复只处理启动后新出现的消息。' }
    })
  }
  start(previewId: string) {
    return this.exclusive(async () => {
      if (this.state.phase !== 'draft' || !previewId || previewId !== this.state.previewId)
        throw new Error('PREVIEW_MISMATCH')
      if (!this.live) throw new Error('LIVE_DISABLED')
      const plan = this.state.plan!
      const startAt = plan.mode === 'outbound' && plan.scheduledAt ? Date.parse(plan.scheduledAt) : this.now()
      if (startAt < this.now() - 300000 || startAt > this.now() + 7 * 86400000) throw new Error('SCHEDULE_OUT_OF_RANGE')
      const generation = this.generation
      await this.adapter.check()
      if (plan.mode === 'reply') this.state.seen = (await this.adapter.inbox()).map(v => incomingSchema.parse(v).id)
      if (generation !== this.generation) throw new Error('START_CANCELLED')
      this.controller = new AbortController()
      this.state.phase = 'running'; this.state.previewId = ''
      this.state.expiresAt = Math.max(this.now(), startAt) + plan.durationSeconds * 1000
      this.state.nextAt = Math.max(this.now(), startAt); this.generation++
      this.event('started')
      try { await this.save() } catch {
        this.state.phase = 'blocked'; this.controller.abort(); throw new Error('STATE_WRITE_FAILED')
      }
      return this.status()
    })
  }
  // Set the stop flag immediately, even while browser I/O is awaiting a response.
  pause() {
    this.generation++
    this.controller.abort()
    if (this.state.phase === 'running') this.state.phase = 'paused'
    return this.exclusive(async () => { this.event('paused'); await this.save(); return this.status() })
  }
  tick() {
    return this.exclusive(async () => {
      const s = this.state, plan = s.plan, generation = this.generation
      if (s.phase !== 'running' || !plan) return
      if (this.now() >= s.expiresAt || s.sent >= plan.maxMessages) {
        s.phase = 'completed'; this.event('limit_reached'); await this.save(); return
      }
      if (this.now() < s.nextAt) return
      try {
        await this.adapter.check()
        let recipient: string, message: string, key: string
        if (plan.mode === 'outbound') {
          const next = plan.recipients[s.cursor]
          if (!next) { s.phase = 'completed'; this.event('list_completed'); await this.save(); return }
          recipient = next; message = plan.message
          key = digest(`${this.owner}:outbound:${recipient}:${message}`)
          if (s.ledger[key]) { s.cursor++; await this.save(); return }
        } else {
          const inbox = (await this.adapter.inbox()).map(v => incomingSchema.parse(v))
          let candidate: { recipient: string; message: string; key: string } | undefined
          for (const item of inbox) {
            if (s.seen.includes(item.id)) continue
            s.seen.push(item.id)
            const rule = plan.rules.find(rule => item.text.includes(rule.contains))
            const id = digest(`${this.owner}:reply:${item.id}`)
            if (rule && !s.ledger[id]) {
              candidate = { recipient: item.recipient, message: rule.reply, key: id }; break
            }
          }
          if (s.seen.length > 10000) throw new Error('INBOX_LIMIT')
          if (!candidate) { await this.save(); return }
          ;({ recipient, message, key } = candidate)
        }
        if (generation !== this.generation || s.phase !== 'running' || this.now() >= s.expiresAt) return
        if (Object.keys(s.ledger).length >= 10000) throw new Error('LEDGER_LIMIT')
        // Persist before external I/O. A crash or ambiguous acknowledgement blocks replay.
        s.ledger[key] = 'attempting'; await this.save()
        if (generation !== this.generation || s.phase !== 'running') {
          delete s.ledger[key]; await this.save(); return
        }
        let result: 'sent' | 'unknown'
        try {
          const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(Math.max(1, s.expiresAt - this.now()))])
          result = await this.adapter.send(recipient, message, signal)
        } catch { result = 'unknown' }
        s.ledger[key] = result
        if (result === 'unknown') { s.phase = 'blocked'; this.event('send_unknown_manual_review') }
        else {
          s.sent++; if (plan.mode === 'outbound') s.cursor++
          s.nextAt = this.now() + plan.intervalSeconds * 1000; this.event('sent')
        }
        await this.save()
      } catch {
        s.phase = 'blocked'; this.event('adapter_or_storage_failure'); await this.save()
      }
    })
  }
}
