import assert from 'node:assert/strict'
import test from 'node:test'
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { BrowserAdapter, Cdp } from '../lib/browser.js'
import { DmEngine } from '../lib/engine.js'

const executable = process.env.DOUYIN_TEST_BROWSER || [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].find(existsSync)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

async function attach(address) {
  const socket = new WebSocket(address)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  return { socket, cdp: new Cdp(socket) }
}

function html(url) {
  const recipient = new URL(url).pathname.split('/').at(-1) || 'recipient_123'
  return `<!doctype html><meta charset="utf-8"><style>[hidden]{display:none} [contenteditable]{width:300px;height:80px}</style>
    <div id="account" data-secuid="account_123"></div>
    <div id="recipient" data-secuid="${recipient}">${recipient}</div>
    <button id="private">私信</button><div id="composer" hidden>
    <div id="editor" contenteditable="true"></div><button id="send">发送</button></div>
    <div id="incoming"></div><div id="outgoing"></div>
    <script>
    document.querySelector('#private').onclick=()=>document.querySelector('#composer').hidden=false;
    document.querySelector('#send').onclick=()=>{
      const row=document.createElement('div');row.className='outgoing';row.dataset.messageId=crypto.randomUUID();
      const text=document.createElement('span');text.textContent=document.querySelector('#editor').innerText;
      row.append(text);document.querySelector('#outgoing').append(row);document.querySelector('#editor').innerText='';
    };
    </script>`
}

test('headless Chromium exercises outbound send and automatic reply against intercepted offline DOM',
  { skip: !executable, timeout: 30000 }, async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'douyin-offline-browser-'))
    const child = spawn(executable, ['--headless=new', '--no-first-run', '--no-default-browser-check',
      '--disable-background-networking', '--host-resolver-rules=MAP * ~NOTFOUND',
      '--remote-debugging-port=0', `--user-data-dir=${dir}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
    const sessions = []; let adapter
    try {
      let portFile
      for (let i = 0; i < 80; i++) {
        try { portFile = await readFile(path.join(dir, 'DevToolsActivePort'), 'utf8'); break } catch { await sleep(100) }
      }
      assert.ok(portFile, 'isolated headless browser must expose its ephemeral debugger')
      const [port, browserPath] = portFile.trim().split('\n')
      const endpoint = `http://127.0.0.1:${port}`
      const browser = await attach(`ws://127.0.0.1:${port}${browserPath.trim()}`); sessions.push(browser.cdp)
      async function fixture(url) {
        const { targetId } = await browser.cdp.call('Target.createTarget', { url: 'about:blank' })
        const tabs = await (await fetch(`${endpoint}/json/list`)).json()
        const session = await attach(tabs.find(tab => tab.id === targetId).webSocketDebuggerUrl); sessions.push(session.cdp)
        // Every request is fulfilled locally. No live Douyin connection or login is used.
        session.socket.addEventListener('message', event => {
          const frame = JSON.parse(event.data)
          if (frame.method === 'Fetch.requestPaused') void session.cdp.call('Fetch.fulfillRequest', {
            requestId: frame.params.requestId, responseCode: 200,
            responseHeaders: [{ name: 'Content-Type', value: 'text/html; charset=utf-8' }],
            body: Buffer.from(html(frame.params.request.url)).toString('base64'),
          }).catch(() => {})
        })
        await session.cdp.call('Fetch.enable', { patterns: [{ urlPattern: '*' }] })
        await session.cdp.call('Page.navigate', { url })
        for (let i = 0; i < 40; i++) {
          if (await session.cdp.evaluate(() => !!document.querySelector('#account'), null)) break
          await sleep(50)
        }
        return { targetId, cdp: session.cdp }
      }
      const inbox = await fixture('https://www.douyin.com/im/recipient_123')
      const sender = await fixture('https://www.douyin.com/user/recipient_123')
      adapter = new BrowserAdapter({ endpoint, accountId: 'account_123', inboxTargetId: inbox.targetId, senderTargetId: sender.targetId,
        selectors: { account: '#account', accountAttribute: 'data-secuid', recipient: '#recipient', recipientAttribute: 'data-secuid',
          blocked: '#captcha', editor: '#editor', sendButton: '#send', incoming: '.incoming', incomingIdAttribute: 'data-message-id',
          incomingRecipientAttribute: 'data-secuid', incomingText: 'span', outgoing: '.outgoing', outgoingIdAttribute: 'data-message-id', outgoingText: 'span' } })
      await adapter.check()
      assert.equal(await adapter.send('recipient_456', "您好，价格？');window.evil=true;//", AbortSignal.timeout(10000)), 'sent')
      assert.equal(await sender.cdp.evaluate(() => window.evil ?? null, null), null)
      const history = await sender.cdp.evaluate(() => document.querySelector('.outgoing span').textContent, null)
      assert.equal(history, "您好，价格？');window.evil=true;//")
      let state = null
      const engine = new DmEngine('fixture-owner', adapter, { load: async () => state, save: async v => { state = structuredClone(v) } }, true)
      await engine.init()
      const preview = await engine.preview({ mode: 'reply', rules: [{ contains: '价格', reply: '请提供型号' }], intervalSeconds: 30, durationSeconds: 60, maxMessages: 1 })
      await engine.start(preview.previewId)
      await inbox.cdp.evaluate(() => {
        const row = document.createElement('div'); row.className = 'incoming'; row.dataset.messageId = 'new-1'; row.dataset.secuid = 'recipient_789';
        const text = document.createElement('span'); text.textContent = '请问价格'; row.append(text); document.querySelector('#incoming').append(row); return true
      }, null)
      await engine.tick(); assert.equal(engine.status().sent, 1)
      assert.equal(await sender.cdp.evaluate(() => document.querySelector('.outgoing span').textContent, null), '请提供型号')
      await inbox.cdp.evaluate(() => { document.querySelector('#account').dataset.secuid = 'other_account'; return true }, null)
      await assert.rejects(adapter.check(), /ACCOUNT_OR_PAGE_CHECK_FAILED/)
    } finally {
      adapter?.close(); for (const session of sessions) session.close()
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await Promise.race([exited, sleep(3000)])
      await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    }
  })
