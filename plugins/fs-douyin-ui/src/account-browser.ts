import { spawn, type ChildProcess } from 'node:child_process'
import { access, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { Cdp } from '@futurestaff/douyin-dm-mcp/browser'
import { readWatchedPage } from './browser-collector.js'
import type { WatchCollector } from './watch-monitor.js'
import type { DiscoveryPort } from './discovery.js'
import type { Adapter } from '@futurestaff/douyin-dm-mcp/contracts'
import { openPrivateConversation, privateConversation } from './outreach-dom.js'
import { readLibraryDom, openLibraryDom, libraryResultSchema, type LibraryKind, type LibraryResult } from './account-library.js'

export type AccountStatus = { phase: 'disconnected' | 'awaiting-login' | 'connected'; accountId: string | null }
export interface AccountBrowserPort {
  open(owner: string, signal: AbortSignal): Promise<AccountStatus>
  check(owner: string, signal: AbortSignal): Promise<AccountStatus>
  disconnect(owner: string): Promise<void>
  status(owner: string): AccountStatus
  close(): Promise<void>
  prepareLibrary(owner: string, kind: LibraryKind, signal: AbortSignal): Promise<void>
  collectFollowing(owner: string, signal: AbortSignal, progress: (count: number) => void): Promise<LibraryResult>
  readLibrary(owner: string, kind: LibraryKind, signal: AbortSignal): Promise<LibraryResult>
}
const disconnected: AccountStatus = { phase: 'disconnected', accountId: null }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const targetSchema = z.object({ id: z.string(), type: z.string(), url: z.string(), webSocketDebuggerUrl: z.string().url().optional() })

export function browserCandidates(env: NodeJS.ProcessEnv) {
  const bases = [env.ProgramFiles, env['ProgramFiles(x86)'], env.LOCALAPPDATA].filter((base): base is string => !!base)
  return ['Google/Chrome/Application/chrome.exe', 'Google/Chrome/Bin/chrome.exe', 'Microsoft/Edge/Application/msedge.exe']
    .flatMap(relative => bases.map(base => path.join(base, ...relative.split('/'))))
}

/** Leave room for Chromium's Default files and atomic-write temporary names on Windows. */
export function accountProfileDirectory(root: string, owner: string, chrome: boolean,
  home = os.homedir(), platform = process.platform): string {
  const legacy = path.join(root, owner, ...(chrome ? ['chrome'] : []))
  if (platform !== 'win32' || path.resolve(legacy).length <= 180) return legacy
  const identity = createHash('sha256').update(JSON.stringify([path.resolve(root), owner, chrome ? 'chrome' : 'edge'])).digest('hex')
  const compact = path.join(home, '.futurestaff', 'browser-profiles', identity, chrome ? 'chrome' : 'edge')
  if (path.resolve(compact).length > 180) throw new Error('BROWSER_PROFILE_PATH_TOO_LONG')
  // Keep the old profile untouched; do not copy/decrypt credentials or cookies.
  return compact
}

/** Only the same-origin authenticated self endpoint proves which account owns this session. */
export async function readLoginAccount(): Promise<string | null> {
  if (location.origin !== 'https://www.douyin.com' || document.readyState !== 'complete') return null
  const response = await fetch('/aweme/v1/web/user/profile/self/?device_platform=webapp&aid=6383',
    { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw new Error('ACCOUNT_CHECK_FAILED')
  const data = await response.json()
  const id = data?.user?.sec_uid
  return data?.status_code === 0 && typeof id === 'string' && /^MS4wLjAB[A-Za-z0-9_-]{10,150}$/.test(id) ? id : null
}

/** One visible browser owned by the authenticated local workspace, never the user's everyday browser. */
export class AccountBrowser implements AccountBrowserPort, WatchCollector, DiscoveryPort {
  private senderCalibration: {owner:string;accountId:string}|undefined
  private active: { owner: string; process: ChildProcess; endpoint: string; cdp: Cdp; state: AccountStatus; followingTotal?: number | null } | undefined
  constructor(private readonly root: string) {}
  ready(owner: string) { return this.active?.owner === owner && this.active.state.phase === 'connected' && !!this.active.state.accountId }
  senderReady(owner:string){return this.ready(owner)&&this.senderCalibration?.owner===owner&&this.senderCalibration.accountId===this.active?.state.accountId}
  private async recipientPage(owner:string,recipient:string,signal:AbortSignal){
    z.string().regex(/^MS4wLjAB[A-Za-z0-9_-]{10,150}$/).parse(recipient)
    const active=this.active
    if(!active||!this.ready(owner))throw Error('ACCOUNT_LOGIN_REQUIRED')
    const accountId=active.state.accountId
    const verify=async()=>{
      signal.throwIfAborted()
      if(this.active!==active||active.owner!==owner)throw Error('SEND_ACCOUNT_CHANGED')
      if(await active.cdp.evaluate<string|null>(readLoginAccount,null)!==accountId){active.state={phase:'awaiting-login',accountId:null};this.senderCalibration=undefined;throw Error('SEND_ACCOUNT_CHANGED')}
      signal.throwIfAborted()
    }
    await verify();await active.cdp.call('Page.navigate',{url:`https://www.douyin.com/user/${recipient}`})
    let opened=false
    for(let i=0;i<40;i++){
      signal.throwIfAborted()
      try{if(await active.cdp.evaluate<boolean>(openPrivateConversation,recipient)){opened=true;break}}catch{}
      await sleep(250)
    }
    if(!opened)throw Error('SEND_RECIPIENT_UNVERIFIED')
    let checked=false
    for(let i=0;i<20;i++){
      signal.throwIfAborted()
      try{await active.cdp.evaluate(privateConversation,{recipient,operation:'check'});checked=true;break}catch{}
      await sleep(250)
    }
    if(!checked)throw Error('SEND_RECIPIENT_UNVERIFIED')
    await verify()
    return {active,verify}
  }
  async checkSender(owner:string,recipient:string,signal:AbortSignal){
    this.senderCalibration=undefined
    const {active}=await this.recipientPage(owner,recipient,signal)
    this.senderCalibration={owner,accountId:active.state.accountId!}
  }
  sender(owner:string):Adapter{return {
    check:async()=>{if(!this.senderReady(owner))throw Error('SEND_NOT_READY')},inbox:async()=>[],close:()=>{},
    send:async(recipient,message,signal)=>{
      if(!this.senderReady(owner))throw Error('SEND_NOT_READY')
      const {active,verify}=await this.recipientPage(owner,recipient,signal)
      const before=await active.cdp.evaluate<{receipts:{id:string;text:string}[]}>(privateConversation,{recipient,operation:'focus'})
      signal.throwIfAborted();await active.cdp.call('Input.insertText',{text:message});await verify()
      signal.throwIfAborted();await active.cdp.evaluate(privateConversation,{recipient,operation:'send',message})
      for(let i=0;i<20;i++){
        signal.throwIfAborted();await sleep(250);await verify()
        const after=await active.cdp.evaluate<{receipts:{id:string;text:string}[]}>(privateConversation,{recipient,operation:'receipt'})
        if(after.receipts.some(row=>row.text===message&&!before.receipts.some(old=>old.id===row.id)))return 'sent'
      }
      return 'unknown'
    }
  }}
  private async readResource(owner: string, url: string, kind: 'account'|'work'|'search', id: string, signal: AbortSignal) {
    const active = this.active, accountId = active?.state.accountId
    if (!this.ready(owner) || !active || !accountId) throw Error('ACCOUNT_LOGIN_REQUIRED')
    const assertAccount = async () => {
      signal.throwIfAborted()
      if (this.active !== active || active.owner !== owner) throw Error('SCAN_ACCOUNT_CHANGED')
      const actual = await active.cdp.evaluate<string | null>(readLoginAccount, null)
      signal.throwIfAborted()
      if (this.active !== active || actual !== accountId) {
        active.state = { phase: 'awaiting-login', accountId: null }
        throw Error('SCAN_ACCOUNT_CHANGED')
      }
    }
    await assertAccount()
    const result = await readWatchedPage(active.cdp, url, kind, id, signal)
    await assertAccount()
    if (result.kind !== kind) throw Error('SCAN_SOURCE_MISMATCH')
    return result
  }
  async search(owner:string,keyword:string,signal:AbortSignal){
    z.string().trim().min(1).max(80).refine(value=>!/[<>\r\n]|https?:/i.test(value)).parse(keyword)
    const result=await this.readResource(owner,`https://www.douyin.com/search/${encodeURIComponent(keyword)}?type=video`,'search',keyword,signal)
    if(result.kind!=='search')throw Error('SCAN_SOURCE_MISMATCH')
    return result.works
  }
  async scan(owner: string, watch: Parameters<WatchCollector['scan']>[1], signal: AbortSignal) {
    const result=await this.readResource(owner,watch.url,watch.kind,watch.id,signal)
    if(result.kind==='search')throw Error('SCAN_SOURCE_MISMATCH')
    return { sourceUrl: watch.url, works: result.kind === 'account'
      ? result.works.map(work => ({ url: work.url, name: work.name, comments: [] }))
      : [{ url: watch.url, name: watch.name, comments: result.comments }] }
  }
  status(owner: string): AccountStatus { return this.active?.owner === owner ? { ...this.active.state } : { ...disconnected } }
  async open(owner: string, signal: AbortSignal) {
    if (!/^[a-f0-9]{64}$/.test(owner)) throw new Error('BROWSER_OWNER_INVALID')
    signal.throwIfAborted()
    if (this.active?.owner === owner) return this.check(owner, signal)
    await this.close()
    const candidates = browserCandidates(process.env)
    let executable: string | undefined
    for (const candidate of candidates) { try { await access(candidate); executable = candidate; break } catch {} }
    if (!executable) throw new Error('BROWSER_REQUIRED')
    // Preserve existing Edge sessions; Chrome must not open another browser's profile.
    const directory = accountProfileDirectory(this.root, owner, path.basename(executable) === 'chrome.exe')
    await mkdir(directory, { recursive: true })
    // Remove only a stale discovery file, never browser cookies or user data.
    const { rm } = await import('node:fs/promises')
    await rm(path.join(directory, 'DevToolsActivePort'), { force: true })
    const child = spawn(executable, [`--user-data-dir=${directory}`, '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--new-window', 'about:blank'],
    { windowsHide: false, stdio: 'ignore' })
    let failed = false
    child.once('error', () => { failed = true })
    let cdp: Cdp | undefined
    try {
      let endpoint = ''
      for (let i = 0; i < 80; i++) {
        signal.throwIfAborted()
        if (failed || child.exitCode !== null) throw new Error('BROWSER_START_FAILED')
        try {
          const port = Number((await readFile(path.join(directory, 'DevToolsActivePort'), 'utf8')).split('\n')[0])
          if (Number.isInteger(port) && port > 0 && port < 65536) { endpoint = `http://127.0.0.1:${port}`; break }
        } catch {}
        await sleep(100)
      }
      if (!endpoint) throw new Error('BROWSER_START_TIMEOUT')
      const response = await fetch(`${endpoint}/json/list`,
        { redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]) })
      if (!response.ok) throw new Error('BROWSER_TAB_FAILED')
      const targets = z.array(targetSchema).parse(await response.json())
      const target = targets.find(tab => tab.type === 'page' && tab.url === 'about:blank')
      if (!target?.webSocketDebuggerUrl) throw new Error('BROWSER_TAB_FAILED')
      const ws = new URL(target.webSocketDebuggerUrl)
      if (ws.protocol !== 'ws:' || ws.hostname !== '127.0.0.1' || ws.port !== new URL(endpoint).port) throw new Error('BROWSER_ENDPOINT_MISMATCH')
      cdp = await Cdp.connect(ws.href)
      await cdp.call('Page.navigate', { url: 'https://www.douyin.com/user/self' })
      this.active = { owner, process: child, endpoint, cdp, state: { phase: 'awaiting-login', accountId: null } }
      child.once('exit', () => {
        if (this.active?.process === child) { this.active.cdp.close(); this.active = undefined }
      })
      signal.addEventListener('abort', () => { void this.disconnect(owner).catch(() => {}) }, { once: true })
      if (signal.aborted) { await this.disconnect(owner); signal.throwIfAborted() }
      return this.status(owner)
    } catch (error) { cdp?.close(); child.kill(); throw error }
  }
  async check(owner: string, signal: AbortSignal) {
    signal.throwIfAborted()
    const active = this.active
    if (!active || active.owner !== owner) return { ...disconnected }
    if (active.process?.exitCode != null) {
      active.cdp.close(); this.active = undefined
      return { ...disconnected }
    }
    active.state = { phase: 'awaiting-login', accountId: null }
    try {
      // Check the current same-origin session without interrupting QR login or its redirect.
      // Only the authenticated self response proves identity, never the visible URL.
      let failed = false
      const deadline = Date.now() + 8000
      while (Date.now() < deadline) {
        signal.throwIfAborted()
        if (this.active !== active) throw new Error('BROWSER_REPLACED')
        let accountId: string | null
        try { accountId = await active.cdp.evaluate<string | null>(readLoginAccount, null); failed = false }
        catch (error) {
          signal.throwIfAborted()
          if (this.active !== active) return this.status(owner)
          if (!(error instanceof Error) || !['DOM_CHECK_FAILED', 'CDP_COMMAND_FAILED', 'CDP_TIMEOUT'].includes(error.message)) throw error
          // Navigation destroys an in-flight execution context; bounded retry also
          // tolerates a temporarily slow self endpoint while the browser stays open.
          failed = true; await sleep(400); continue
        }
        signal.throwIfAborted()
        if (this.active !== active) throw new Error('BROWSER_REPLACED')
        if (accountId) {
          active.state = { phase: 'connected', accountId }
          break
        }
        await sleep(400)
      }
      signal.throwIfAborted()
      if (failed) throw new Error('ACCOUNT_CHECK_FAILED')
      return this.status(owner)
    } catch (error) {
      if (signal.aborted) throw error
      if (this.active !== active) return this.status(owner)
      // Keep the visible login window available when a page or network check fails.
      throw new Error('ACCOUNT_CHECK_FAILED')
    }
  }
  async disconnect(owner: string) { if (this.active?.owner === owner) await this.close() }
  async prepareLibrary(owner: string, kind: LibraryKind, signal: AbortSignal) {
    const state = await this.check(owner, signal), active = this.active
    if (state.phase !== 'connected' || !active || active.owner !== owner) throw new Error('ACCOUNT_LOGIN_REQUIRED')
    const navigation = await active.cdp.call('Page.navigate', { url: `https://www.douyin.com/user/${state.accountId}` })
    let loaded = false
    const pageDeadline = Date.now() + 15000
    while (Date.now() < pageDeadline) {
      signal.throwIfAborted()
      if (this.active !== active) throw new Error('BROWSER_REPLACED')
      const tree = await active.cdp.call('Page.getFrameTree')
      // The previous document may still report the same URL and complete state
      // immediately after navigate. Click only after the new document commits.
      if ((!navigation.loaderId || tree.frameTree.frame.loaderId === navigation.loaderId)
        && await active.cdp.evaluate((id: string) => location.pathname === `/user/${id}` && document.readyState === 'complete', state.accountId)) {
        loaded = true; break
      }
      await sleep(200)
    }
    if (!loaded) throw new Error('LIBRARY_PANEL_REQUIRED')
    await active.cdp.call('Page.bringToFront')
    let opened: ReturnType<typeof openLibraryDom> = { opened: false, total: null }
    const controlDeadline = Date.now() + 10000
    while (Date.now() < controlDeadline) {
      signal.throwIfAborted()
      if (this.active !== active) throw new Error('BROWSER_REPLACED')
      opened = await active.cdp.evaluate<ReturnType<typeof openLibraryDom>>(openLibraryDom, { kind, accountId: state.accountId! })
      if (opened.opened) break
      await sleep(250)
    }
    if (!opened.opened) throw new Error('LIBRARY_PANEL_REQUIRED')
    active.followingTotal = kind === 'following' ? opened.total : null
    let ready = false
    for (let i = 0; i < 30; i++) {
      signal.throwIfAborted()
      try { await this.readLibrary(owner, kind, signal); ready = true; break } catch {
        if (this.active !== active) throw new Error('BROWSER_REPLACED')
        await sleep(200)
      }
    }
    if (!ready) throw new Error('LIBRARY_PANEL_REQUIRED')
    signal.throwIfAborted()
    if (this.active !== active) throw new Error('BROWSER_REPLACED')
  }
  async collectFollowing(owner: string, signal: AbortSignal, progress: (count: number) => void) {
    await this.prepareLibrary(owner, 'following', signal)
    const active = this.active!
    const expected = active.followingTotal ?? null
    if (expected !== null && expected > 500) throw new Error('WATCH_LIMIT')
    const items = new Map<string, LibraryResult['items'][number]>()
    let unchanged = 0
    const deadline = Date.now() + 90000
    while (Date.now() < deadline) {
      signal.throwIfAborted()
      if (this.active !== active || active.owner !== owner) throw new Error('BROWSER_REPLACED')
      let frame: LibraryResult & { end?: boolean }
      try { frame = await active.cdp.evaluate(readLibraryDom, { kind: 'following', accountId: active.state.accountId!, advance: true }) }
      catch { throw new Error('LIBRARY_PANEL_REQUIRED') }
      const result = libraryResultSchema.parse({ accountId: frame.accountId, items: frame.items })
      const before = items.size
      for (const item of result.items) items.set(item.id, item)
      if (items.size > 500) throw new Error('WATCH_LIMIT')
      progress(items.size)
      signal.throwIfAborted()
      if (this.active !== active || result.accountId !== active.state.accountId) throw new Error('LIBRARY_ACCOUNT_CHANGED')
      if ((expected !== null && items.size === expected) || (frame.end && (expected === null || items.size === expected))) {
        const current = await active.cdp.evaluate<string | null>(readLoginAccount, null)
        signal.throwIfAborted()
        if (this.active !== active || current !== result.accountId) throw new Error('LIBRARY_ACCOUNT_CHANGED')
        return { accountId: result.accountId, items: [...items.values()] }
      }
      unchanged = items.size === before ? unchanged + 1 : 0
      if (unchanged >= 10) throw new Error('LIBRARY_INCOMPLETE')
      await sleep(800)
    }
    throw new Error('LIBRARY_INCOMPLETE')
  }
  async readLibrary(owner: string, kind: LibraryKind, signal: AbortSignal) {
    signal.throwIfAborted()
    const active = this.active
    if (!active || active.owner !== owner || active.state.phase !== 'connected' || !active.state.accountId) throw new Error('ACCOUNT_LOGIN_REQUIRED')
    let result: LibraryResult
    try { result = libraryResultSchema.parse(await active.cdp.evaluate(readLibraryDom, { kind, accountId: active.state.accountId })) }
    catch (error) { if (error instanceof Error && error.message === 'DOM_CHECK_FAILED') throw new Error('LIBRARY_PANEL_REQUIRED'); throw error }
    signal.throwIfAborted()
    if (this.active !== active || result.accountId !== active.state.accountId) throw new Error('BROWSER_REPLACED')
    return result
  }
  async close() {
    this.senderCalibration=undefined
    const active = this.active; this.active = undefined
    if (!active) return
    try { await active.cdp.call('Browser.close') } catch { active.process.kill() }
    active.cdp.close()
  }
}
