import type { LeadWorkspace } from '@futurestaff/douyin-dm-mcp/lead-workspace'

type Watch = ReturnType<LeadWorkspace['dueWatches']>[number]
/** A Host-calibrated browser reader. Renderer/model inputs never implement this port. */
export interface WatchCollector {
  ready(owner: string): boolean
  scan(owner: string, watch: Watch, signal: AbortSignal): Promise<{
    sourceUrl: string; works: { url: string; name: string; comments: unknown[] }[]
  }>
}
export const scanErrorCodes = ['SCAN_SOURCE_MISMATCH','SCAN_PAGE_UNAVAILABLE','SCAN_DATA_UNAVAILABLE','SCAN_ACCOUNT_CHANGED','SCAN_SCHEMA_CHANGED','SCAN_FAILED','ACQUISITION_CONTEXT_CHANGED','ACQUISITION_FAILED','MONITOR_FAILED','SEND_RESULT_UNKNOWN','SEND_NOT_READY','SEND_RECIPIENT_UNVERIFIED','SEND_ACCOUNT_CHANGED','MODEL_LOGIN_REQUIRED','MODEL_NOT_AUTHORIZED','MODEL_PROVIDER_UNAVAILABLE','MODEL_SERVICE_UNAVAILABLE','MODEL_RATE_LIMIT','MODEL_STORAGE_UNAVAILABLE','MODEL_SESSION_INVALID','MODEL_OUTPUT_INVALID','MODEL_OUTPUT_LIMIT','MODEL_BINDING_INVALID','INFERENCE_INPUT_INVALID','INFERENCE_INCOMPLETE','INFERENCE_NON_TEXT_OUTPUT','INFERENCE_OUTPUT_LIMIT','KEYWORDS_INVALID','DUPLICATE_KEYWORD_GROUP','WORK_SELECTION_INVALID','EVIDENCE_NOT_IN_SOURCE','KEYWORDS_RESPONSE_INVALID','SELECTION_RESPONSE_INVALID','KEYWORDS_FAILED','SEARCH_FAILED','SELECTION_FAILED','ACQUISITION_TIMEOUT'] as const
export type ScanErrorCode = typeof scanErrorCodes[number]
export class WatchMonitor {
  private errorCode: ScanErrorCode | undefined
  private controller: AbortController | undefined
  private busy = false
  private phase: 'idle' | 'running' | 'paused' | 'blocked' = 'idle'
  private processed = 0
  constructor(private owner: string, private workspace: LeadWorkspace, private signal: AbortSignal,
    private collector: WatchCollector | undefined, private log: (phase: 'started' | 'completed' | 'failed', code?: ScanErrorCode) => Promise<void>) {}
  status() { return { phase: this.phase, processed: this.processed, ready: this.collector?.ready(this.owner) ?? false, ...(this.errorCode ? { errorCode: this.errorCode } : {}) } }
  start() {
    this.signal.throwIfAborted()
    if (!this.collector?.ready(this.owner)) throw Error('COLLECTOR_NOT_READY')
    if (!this.workspace.snapshot().modelId) throw Error('MODEL_REQUIRED')
    if (!this.workspace.snapshot().watches.some(w => w.enabled)) throw Error('WATCH_REQUIRED')
    this.controller?.abort(); this.controller = new AbortController(); this.errorCode = undefined; this.phase = 'running'
  }
  stop() { this.controller?.abort(); this.controller = undefined; this.phase = 'paused' }
  rebind(signal: AbortSignal) { this.stop(); this.signal = signal }
  async settle() { while (this.busy) await new Promise(resolve => setTimeout(resolve, 20)) }
  async tick(parentSignal?:AbortSignal) {
    if (this.busy || this.phase !== 'running' || !this.controller || !this.collector) return
    this.busy = true
    const controller = this.controller, signal = AbortSignal.any([this.signal, controller.signal, AbortSignal.timeout(90_000),...(parentSignal?[parentSignal]:[])])
    try {
      const due=this.workspace.dueWatches().sort((a,b)=>a.nextAt-b.nextAt).slice(0,1)
      if(!due.length&&!this.workspace.pendingComments().length)return
      signal.throwIfAborted();await this.log('started')
      // Bound one scheduler turn and serve the oldest due source first.
      for (const watch of due) {
        signal.throwIfAborted()
        const result = await this.collector.scan(this.owner, watch, signal)
        signal.throwIfAborted()
        if (result.sourceUrl !== watch.url || result.works.length > 20) throw Error('SCAN_SOURCE_MISMATCH')
        for (const work of result.works) {
          const url = new URL(work.url), id = /^\/(?:video|note)\/([0-9]{5,30})$/.exec(url.pathname)?.[1]
          if (url.origin !== 'https://www.douyin.com' || url.username || url.password || url.search || url.hash || !id
            || (watch.kind === 'work' && id !== watch.id)) throw Error('SCAN_SOURCE_MISMATCH')
          if (watch.kind === 'account') await this.workspace.addWatch('work', { ...work, intervalSeconds: watch.intervalSeconds })
          const enabled = this.workspace.snapshot().watches.some(w => w.id === id && w.kind === 'work' && w.enabled)
          if (enabled) { await this.workspace.recordScan(id, work.comments); this.processed++ }
        }
        signal.throwIfAborted(); await this.workspace.completeWatchScan(watch.id, watch.kind)
      }
      for (const comment of this.workspace.pendingComments().slice(0, 5)) {
        signal.throwIfAborted(); await this.workspace.analyzeOne(comment.key, signal)
      }
      signal.throwIfAborted();await this.log('completed')
    } catch (error) {
      if(parentSignal?.aborted){if(this.controller===controller)this.stop();return}
      if (this.controller === controller && !controller.signal.aborted && !this.signal.aborted) {
        const message = error instanceof Error ? error.message : ''
        this.errorCode = scanErrorCodes.includes(message as ScanErrorCode) ? message as ScanErrorCode : 'SCAN_FAILED'
        this.phase = 'blocked'; this.controller = undefined; await this.log('failed', this.errorCode)
      }
    } finally { this.busy = false }
  }
}
