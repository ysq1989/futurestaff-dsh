import { z } from 'zod'
import { incomingSchema, recipientSchema, type Adapter, type Incoming } from './contracts.js'

const selector = z.string().min(1).max(300)
export const browserConfigSchema = z.object({
  endpoint: z.string(), accountId: recipientSchema,
  inboxTargetId: z.string().min(1), senderTargetId: z.string().min(1),
  selectors: z.object({
    account: selector, accountAttribute: selector,
    recipient: selector, recipientAttribute: selector,
    editor: selector, sendButton: selector, blocked: selector,
    incoming: selector, incomingIdAttribute: selector,
    incomingRecipientAttribute: selector, incomingText: selector,
    outgoing: selector, outgoingIdAttribute: selector, outgoingText: selector,
  }).strict(),
}).strict().refine(v => v.inboxTargetId !== v.senderTargetId, 'Use separate inbox and sender tabs')
export type BrowserConfig = z.infer<typeof browserConfigSchema>

export function loopback(value: string, protocols: string[]) {
  const url = new URL(value)
  if (!protocols.includes(url.protocol) || !['127.0.0.1', '[::1]'].includes(url.hostname)
    || url.username || url.password || url.search || url.hash) throw new Error('CDP_LOOPBACK_ONLY')
  return url
}

export class Cdp {
  private sequence = 0
  private listeners = new Map<string, Set<(params: unknown) => void>>()
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()
  constructor(private socket: WebSocket) {
    socket.addEventListener('message', event => {
      let data: any
      try { data = JSON.parse(String(event.data)) } catch { return }
      if (typeof data.method === 'string' && data.id === undefined) {
        for (const listener of this.listeners.get(data.method) ?? []) {
          try { listener(data.params) } catch { /* Observers cannot break command settlement. */ }
        }
        return
      }
      const request = this.pending.get(data.id)
      if (!request) return
      clearTimeout(request.timer); this.pending.delete(data.id)
      if (data.error) request.reject(new Error('CDP_COMMAND_FAILED'))
      else request.resolve(data.result)
    })
    socket.addEventListener('close', () => this.fail())
    socket.addEventListener('error', () => this.fail())
  }
  private fail() {
    for (const item of this.pending.values()) { clearTimeout(item.timer); item.reject(new Error('CDP_DISCONNECTED')) }
    this.pending.clear()
    this.listeners.clear()
  }
  on(method: string, listener: (params: unknown) => void) {
    const listeners = this.listeners.get(method) ?? new Set()
    listeners.add(listener); this.listeners.set(method, listeners)
    return () => { listeners.delete(listener); if (!listeners.size) this.listeners.delete(method) }
  }
  static async connect(address: string) {
    loopback(address, ['ws:'])
    const socket = new WebSocket(address)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { socket.close(); reject(new Error('CDP_CONNECT_TIMEOUT')) }, 5000)
      socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP_CONNECT_FAILED')) }, { once: true })
    })
    return new Cdp(socket)
  }
  call(method: string, params: Record<string, unknown> = {}): Promise<any> {
    const id = ++this.sequence
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP_TIMEOUT')) }, 5000)
      this.pending.set(id, { resolve, reject, timer })
      try { this.socket.send(JSON.stringify({ id, method, params })) }
      catch { clearTimeout(timer); this.pending.delete(id); reject(new Error('CDP_DISCONNECTED')) }
    })
  }
  async evaluate<T>(fn: Function, args: unknown): Promise<T> {
    const result = await this.call('Runtime.evaluate', {
      expression: `(${fn.toString()})(${JSON.stringify(args)})`, returnByValue: true, awaitPromise: true,
    })
    if (result.exceptionDetails || !result.result || !('value' in result.result)) throw new Error('DOM_CHECK_FAILED')
    return result.result.value as T
  }
  close() { this.fail(); this.socket.close() }
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class BrowserAdapter implements Adapter {
  private sessions = new Map<string, Cdp>()
  constructor(private config: BrowserConfig) { loopback(config.endpoint, ['http:']) }
  private async tab(id: string): Promise<Cdp> {
    const endpoint = loopback(this.config.endpoint, ['http:'])
    const response = await fetch(new URL('/json/list', endpoint), { signal: AbortSignal.timeout(5000), redirect: 'error' })
    if (!response.ok) throw new Error('CDP_DISCOVERY_FAILED')
    const tabs = z.array(z.object({ id: z.string(), type: z.string(), url: z.string(), webSocketDebuggerUrl: z.string().optional() })).parse(await response.json())
    const tab = tabs.find(tab => tab.id === id && tab.type === 'page')
    if (!tab || new URL(tab.url).origin !== 'https://www.douyin.com' || !tab.webSocketDebuggerUrl) throw new Error('DOUYIN_TAB_REQUIRED')
    const ws = loopback(tab.webSocketDebuggerUrl, ['ws:'])
    if (ws.hostname !== endpoint.hostname || ws.port !== endpoint.port) throw new Error('CDP_ENDPOINT_MISMATCH')
    if (!this.sessions.has(id)) this.sessions.set(id, await Cdp.connect(ws.href))
    return this.sessions.get(id)!
  }
  private async guard(tab: Cdp, recipient?: string) {
    const ok = await tab.evaluate<boolean>((args: any) => {
      const visible = (el: Element | null) => !!el && el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0
      if (location.origin !== 'https://www.douyin.com') return false
      const account = document.querySelector(args.selectors.account)
      if (!account || account.getAttribute(args.selectors.accountAttribute) !== args.accountId) return false
      if ([...document.querySelectorAll(args.selectors.blocked)].some(visible)) return false
      if (args.recipient) {
        const target = document.querySelector(args.selectors.recipient)
        if (!visible(target) || target!.getAttribute(args.selectors.recipientAttribute) !== args.recipient) return false
      }
      return true
    }, { ...this.config, recipient })
    if (!ok) throw new Error('ACCOUNT_OR_PAGE_CHECK_FAILED')
  }
  async check() {
    for (const id of [this.config.inboxTargetId, this.config.senderTargetId]) await this.guard(await this.tab(id))
  }
  async inbox(): Promise<Incoming[]> {
    const tab = await this.tab(this.config.inboxTargetId); await this.guard(tab)
    const items = await tab.evaluate<unknown>((s: any) => [...document.querySelectorAll(s.incoming)].map(el => ({
      id: el.getAttribute(s.incomingIdAttribute), recipient: el.getAttribute(s.incomingRecipientAttribute),
      text: el.querySelector(s.incomingText)?.textContent?.trim(),
    })), this.config.selectors)
    return z.array(incomingSchema).max(1000).parse(items)
  }
  async send(recipient: string, message: string, signal: AbortSignal): Promise<'sent' | 'unknown'> {
    signal.throwIfAborted()
    recipientSchema.parse(recipient)
    const tab = await this.tab(this.config.senderTargetId); await this.guard(tab)
    await tab.call('Page.navigate', { url: `https://www.douyin.com/user/${recipient}` })
    let opened = false
    for (let i = 0; i < 20; i++) {
      await wait(250)
      signal.throwIfAborted()
      await this.guard(tab)
      opened = await tab.evaluate<boolean>(() => {
        const buttons = [...document.querySelectorAll('button,span.semi-button-content')]
          .filter(el => el.textContent?.trim() === '私信' && el.getBoundingClientRect().width > 0)
        if (buttons.length !== 1) return false
        ;(buttons[0] as HTMLElement).click(); return true
      }, null)
      if (opened) break
    }
    if (!opened) throw new Error('PRIVATE_MESSAGE_BUTTON_MISSING')
    let ready = false
    for (let i = 0; i < 20; i++) {
      await wait(250)
      signal.throwIfAborted()
      try { await this.guard(tab, recipient); ready = true; break } catch { /* Wait for the conversation header. */ }
    }
    if (!ready) throw new Error('RECIPIENT_NOT_VERIFIED')
    const before = await this.outgoing(tab)
    const focused = await tab.evaluate<boolean>((s: any) => {
      const editors = document.querySelectorAll(s.editor)
      if (editors.length !== 1) return false
      const editor = editors[0] as HTMLElement
      if (!editor.isContentEditable || editor.innerText.trim()) return false
      editor.focus(); return document.activeElement === editor
    }, this.config.selectors)
    if (!focused) throw new Error('EDITOR_NOT_EMPTY_OR_UNIQUE')
    signal.throwIfAborted()
    await tab.call('Input.insertText', { text: message })
    await this.guard(tab, recipient)
    signal.throwIfAborted()
    const clicked = await tab.evaluate<boolean>((args: any) => {
      const editor = document.querySelector(args.s.editor) as HTMLElement | null
      const buttons = document.querySelectorAll(args.s.sendButton)
      if (editor?.innerText.trim() !== args.message || buttons.length !== 1) return false
      const button = buttons[0] as HTMLButtonElement
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || !button.getBoundingClientRect().width) return false
      button.click(); return true
    }, { s: this.config.selectors, message })
    if (!clicked) return 'unknown'
    for (let i = 0; i < 20; i++) {
      await wait(250); await this.guard(tab, recipient)
      const after = await this.outgoing(tab)
      if (after.some(item => item.text === message && !before.some(old => old.id === item.id))) return 'sent'
    }
    return 'unknown'
  }
  private async outgoing(tab: Cdp) {
    const rows = await tab.evaluate<unknown>((s: any) => [...document.querySelectorAll(s.outgoing)].map(el => ({
      id: el.getAttribute(s.outgoingIdAttribute), text: el.querySelector(s.outgoingText)?.textContent?.trim(),
    })), this.config.selectors)
    return z.array(z.object({ id: z.string().min(1), text: z.string() })).max(1000).parse(rows)
  }
  close() { for (const tab of this.sessions.values()) tab.close(); this.sessions.clear() }
}
