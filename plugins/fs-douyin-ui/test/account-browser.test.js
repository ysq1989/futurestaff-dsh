import assert from 'node:assert/strict'
import test, { mock } from 'node:test'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { JSDOM } from 'jsdom'
import { AccountBrowser, accountProfileDirectory, browserCandidates, readLoginAccount } from '../lib/account-browser.js'

const owner = 'a'.repeat(64), accountId = 'MS4wLjABown_account_12345'
test('short existing profiles are retained; deep Windows profiles get compact isolated paths', () => {
  const root = path.join(os.tmpdir(), 'x'.repeat(160)), home = 'C:/Users/Administrator'
  assert.equal(accountProfileDirectory('C:/short', owner, true, home, 'win32'), path.join('C:/short', owner, 'chrome'))
  const compact = accountProfileDirectory(root, owner, true, home, 'win32')
  assert.ok(path.resolve(compact).length <= 180)
  assert.equal(compact, accountProfileDirectory(root, owner, true, home, 'win32'))
  assert.notEqual(compact, accountProfileDirectory(root, 'b'.repeat(64), true, home, 'win32'))
  assert.notEqual(compact, accountProfileDirectory(root+'other', owner, true, home, 'win32'))
  assert.notEqual(compact, accountProfileDirectory(root, owner, false, home, 'win32'))
  assert.equal(accountProfileDirectory(root, owner, true, home, 'linux'), path.join(root, owner, 'chrome'))
})
function page(payload, url = 'https://www.douyin.com/user/self') {
  const dom = new JSDOM('<p>已登录个人主页</p>', { url, runScripts: 'outside-only' })
  Object.defineProperty(dom.window.document, 'readyState', { value: 'complete' })
  dom.window.AbortSignal = AbortSignal
  const calls = []
  dom.window.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => payload } }
  return { dom, calls, read: () => dom.window.eval(`(${readLoginAccount.toString()})`)() }
}
test('Chrome is searched before every Edge installation', () => {
  const candidates = browserCandidates({ ProgramFiles: 'C:/pf', 'ProgramFiles(x86)': 'C:/pf86', LOCALAPPDATA: 'C:/local' })
  assert.equal(candidates.length, 9)
  assert.ok(candidates.slice(0, 6).every(p => p.endsWith('chrome.exe')))
  assert.ok(candidates.slice(6).every(p => p.endsWith('msedge.exe')))
})
test('authenticated self response resolves an account even when /user/self never redirects', async () => {
  const p = page({ status_code: 0, user: { sec_uid: accountId } })
  try {
    assert.equal(await p.read(), accountId)
    assert.equal(p.calls.length, 1)
    assert.equal(p.calls[0].options.credentials, 'same-origin')
    assert.ok(p.calls[0].url.startsWith('/aweme/v1/web/user/profile/self/'))
  } finally { p.dom.window.close() }
})
test('profile URLs, page text, malformed or anonymous responses never prove login', async () => {
  for (const data of [{}, { status_code: 8, user: { sec_uid: accountId } }, { status_code: 0, user: { sec_uid: '123' } }]) {
    const p = page(data, `https://www.douyin.com/user/${accountId}`)
    try { assert.equal(await p.read(), null) } finally { p.dom.window.close() }
  }
  const p = page({ status_code: 0, user: { sec_uid: accountId } }, 'https://evil.invalid/user/self')
  try { assert.equal(await p.read(), null); assert.equal(p.calls.length, 0) } finally { p.dom.window.close() }
})
test('check reports a page/network failure without killing the login browser', async t => {
  let now=0; t.mock.method(Date, 'now', () => { now+=3000; return now })
  const browser = new AccountBrowser('unused')
  let closed = false
  browser.active = { owner, state: { phase: 'connected', accountId }, cdp: {
    call: async () => {}, evaluate: async () => { throw Error('DOM_CHECK_FAILED') }, close: () => { closed = true },
  }, process: { kill: () => { closed = true } } }
  await assert.rejects(browser.check(owner, new AbortController().signal), /ACCOUNT_CHECK_FAILED/)
  assert.equal(closed, false)
  assert.deepEqual(browser.status(owner), { phase: 'awaiting-login', accountId: null })
})
test('check connects using self response and rejects a changed owner', async () => {
  const browser = new AccountBrowser('unused')
  browser.active = { owner, state: { phase: 'awaiting-login', accountId: null }, cdp: {
    call: async () => {}, evaluate: async () => accountId,
  } }
  assert.deepEqual(await browser.check(owner, new AbortController().signal), { phase: 'connected', accountId })
  assert.deepEqual(await browser.check('b'.repeat(64), new AbortController().signal), { phase: 'disconnected', accountId: null })
})

const executable = browserCandidates(process.env).find(existsSync)
test('real isolated browser opens one page and reuses it instead of creating a second tab', { skip: !executable, timeout: 20000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dy-login-regression-'))
  const browser = new AccountBrowser(root), realSpawn = childProcess.spawn
  const launch = mock.method(childProcess, 'spawn', (exe, args, options) => realSpawn(exe,
    ['--headless=new', '--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', ...args], { ...options, windowsHide: true }))
  syncBuiltinESMExports()
  try {
    assert.deepEqual(await browser.open(owner, new AbortController().signal), { phase: 'awaiting-login', accountId: null })
    const pages = await (await fetch(`${browser.active.endpoint}/json/list`)).json()
    assert.equal(pages.filter(p => p.type === 'page').length, 1)
    // Reopening calls the same active session's check; it never launches or adds a tab.
    browser.active.cdp.evaluate = async () => accountId
    assert.equal((await browser.open(owner, new AbortController().signal)).phase, 'connected')
    assert.equal(launch.mock.callCount(), 1)
    const after = await (await fetch(`${browser.active.endpoint}/json/list`)).json()
    assert.equal(after.filter(p => p.type === 'page').length, 1)
    // Closing the user's window must clear the active session so Open can launch again.
    await browser.active.cdp.call('Browser.close')
    const deadline=Date.now()+3000
    while(browser.status(owner).phase!=='disconnected' && Date.now()<deadline) await new Promise(r=>setTimeout(r,50))
    assert.equal(browser.status(owner).phase,'disconnected')
    assert.equal((await browser.open(owner,new AbortController().signal)).phase,'awaiting-login')
    assert.equal(launch.mock.callCount(),2)

  } finally {
    await browser.close(); launch.mock.restore(); syncBuiltinESMExports()
    assert.ok(root.startsWith(path.join(os.tmpdir(), 'dy-login-regression-')))
    await rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 })
  }
})


function collection(frames, total = null, identity = accountId) {
  const browser = new AccountBrowser('unused')
  browser.active = { owner, state: { phase: 'connected', accountId }, followingTotal: total, cdp: {
    evaluate: async (fn) => fn === readLoginAccount ? identity : frames.shift() ?? { accountId, items: [], end: false },
  } }
  browser.prepareLibrary = async () => {}
  const item = n => ({ id: `MS4wLjABcreator_account_${n}`, url: `https://www.douyin.com/user/MS4wLjABcreator_account_${n}`, name: `作者${n}` })
  return { browser, item }
}

test('full following collection aggregates virtualized pages and deduplicates before completion', async () => {
  const s = collection([], 3), { item } = s
  s.browser.active.cdp.evaluate = async fn => fn === readLoginAccount ? accountId : frames.shift()
  const frames = [{ accountId, items: [item(1), item(2)] }, { accountId, items: [item(2), item(3)] }]
  const progress = []
  const result = await s.browser.collectFollowing(owner, new AbortController().signal, n => progress.push(n))
  assert.deepEqual(result.items.map(x => x.id), [item(1).id, item(2).id, item(3).id])
  assert.deepEqual(progress, [2, 3])
})

test('only a proven empty list or explicit end completes without a total', async () => {
  const s = collection([{ accountId, items: [], end: true }])
  assert.equal((await s.browser.collectFollowing(owner, new AbortController().signal, () => {})).items.length, 0)
})

test('timeout does not report a partial list as complete', async t => {
  const s = collection([{ accountId, items: [], end: false }])
  let time = 0
  t.mock.method(Date, 'now', () => { time += 50000; return time })
  await assert.rejects(s.browser.collectFollowing(owner, new AbortController().signal, () => {}), /LIBRARY_INCOMPLETE/)
})

test('collection rejects changed login, cancellation and the existing 500 record ceiling', async () => {
  const s = collection([{ accountId, items: [], end: true }], null, 'MS4wLjABdifferent_account_12345')
  await assert.rejects(s.browser.collectFollowing(owner, new AbortController().signal, () => {}), /ACCOUNT_CHANGED/)
  const controller = new AbortController(); controller.abort()
  await assert.rejects(collection([]).browser.collectFollowing(owner, controller.signal, () => {}))
  await assert.rejects(collection([], 501).browser.collectFollowing(owner, new AbortController().signal, () => {}), /WATCH_LIMIT/)
})


test('real browser opens numeric counter and scrolls observed role-less Semi following overlay to 250 records', { skip: !executable, timeout: 30000 }, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dy-following-regression-'))
  const browser = new AccountBrowser(root), realSpawn = childProcess.spawn
  const launch = mock.method(childProcess, 'spawn', (exe, args, options) => realSpawn(exe,
    ['--headless=new', '--disable-background-networking', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', ...args], { ...options, windowsHide: true }))
  syncBuiltinESMExports()
  try {
    await browser.open(owner, new AbortController().signal)
    const cdp = browser.active.cdp
    const html = `<!doctype html><html><body><nav><a href="/follow">关注79</a></nav><div><div id="following"><span>关注</span><span>250</span></div><div>粉丝7</div><div>获赞48</div></div>
      <a href="/user/MS4wLjABrecommended_12345">推荐</a>
      <div id="dialog" style="position:fixed;inset:0" hidden><div><div role="tablist"><div role="tab" aria-selected="true">关注 (250)</div><div role="tab" aria-selected="false">粉丝 (7)</div></div><input placeholder="搜索用户名字或抖音号"><div id="list" style="overflow-y:auto;height:200px"></div></div></div>
      <script>
      let offset=0;const list=document.getElementById('list');
      function render(){list.innerHTML=Array.from({length:Math.min(100,250-offset)},(_,n)=>'<a style="display:block" href="/user/MS4wLjABcreator_account_'+(offset+n)+'">作者'+(offset+n)+'</a>').join('')+'<div style="height:3000px"></div>';}
      list.addEventListener('scroll',()=>{if(offset<200){offset+=100;render()}});
      document.getElementById('following').onclick=()=>{document.getElementById('dialog').hidden=false;render()};
      </script></body></html>`
    cdp.socket.addEventListener('message', event => {
      const data=JSON.parse(String(event.data));if(data.method!=='Fetch.requestPaused')return
      const response = new URL(data.params.request.url).pathname.startsWith('/aweme/')
        ? JSON.stringify({status_code:0,user:{sec_uid:accountId}}) : html
      void cdp.call('Fetch.fulfillRequest',{requestId:data.params.requestId,responseCode:200,
        responseHeaders:[{name:'Content-Type',value:response.startsWith('{')?'application/json':'text/html; charset=utf-8'}],
        body:Buffer.from(response).toString('base64')}).catch(()=>{})
    })
    await cdp.call('Fetch.enable',{patterns:[{urlPattern:'https://www.douyin.com/*'}]})
    const progress=[]
    const result=await browser.collectFollowing(owner,new AbortController().signal,n=>progress.push(n))
    assert.equal(result.items.length,250);assert.deepEqual(progress,[100,200,250])
    assert.equal(result.items.some(item=>item.id.includes('recommended')),false)
  } finally {
    await browser.close();launch.mock.restore();syncBuiltinESMExports()
    assert.ok(root.startsWith(path.join(os.tmpdir(),'dy-following-regression-')))
    await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:100})
  }
})


test('prepare waits for hydrated profile counter and confirms the list instead of silently succeeding', async () => {
  const browser = new AccountBrowser('unused')
  let attempts = 0, reads = 0
  browser.active = { owner, state: { phase: 'connected', accountId }, cdp: { call: async method => method === 'Page.navigate' ? { loaderId: 'new-document' } : { frameTree: { frame: { loaderId: 'new-document' } } },
    evaluate: async fn => fn.name === 'openLibraryDom' ? { opened: ++attempts >= 2, total: 19 } : true } }
  browser.check = async () => browser.status(owner)
  browser.readLibrary = async () => { reads++; return { accountId, items: [] } }
  await browser.prepareLibrary(owner, 'following', new AbortController().signal)
  assert.equal(attempts, 2); assert.equal(reads, 1); assert.equal(browser.active.followingTotal, 19)
})


test('prepare never clicks the stale same-URL document before the new loader commits', async () => {
  const browser = new AccountBrowser('unused'); let frames = 0, clicked = 0
  browser.active = { owner, state: { phase: 'connected', accountId }, cdp: {
    call: async method => method === 'Page.navigate' ? { loaderId: 'new' } : { frameTree: { frame: { loaderId: ++frames === 1 ? 'old' : 'new' } } },
    evaluate: async fn => { if (fn.name === 'openLibraryDom') { clicked++; assert.ok(frames >= 2); return { opened: true, total: 19 } } return true },
  } }
  browser.check = async () => browser.status(owner)
  browser.readLibrary = async () => ({ accountId, items: [] })
  await browser.prepareLibrary(owner, 'following', new AbortController().signal)
  assert.ok(frames >= 2); assert.equal(clicked, 1)
})


test('checking current session never reloads QR login and retries a destroyed context', async () => {
  const browser = new AccountBrowser('unused'); let attempts=0
  browser.active={owner,state:{phase:'awaiting-login',accountId:null},cdp:{
    call:async()=>{throw Error('LOGIN_MUST_NOT_NAVIGATE')},
    evaluate:async()=>{ if (++attempts===1) throw Error('CDP_COMMAND_FAILED'); return accountId },
  }}
  assert.deepEqual(await browser.check(owner,new AbortController().signal),{phase:'connected',accountId})
  assert.equal(attempts,2)
})

test('an exited browser is disconnected and never checked through a stale socket', async () => {
  const browser = new AccountBrowser('unused'); let closed=0
  browser.active={owner,state:{phase:'connected',accountId},process:{exitCode:0},cdp:{
    close:()=>closed++,evaluate:async()=>{throw Error('STALE_SOCKET')},
  }}
  assert.deepEqual(await browser.check(owner,new AbortController().signal),{phase:'disconnected',accountId:null})
  assert.equal(closed,1);assert.equal(browser.active,undefined)
})

test('a temporary self endpoint failure can recover without closing the browser', async () => {
  const browser = new AccountBrowser('unused'); let attempts=0
  browser.active={owner,state:{phase:'awaiting-login',accountId:null},cdp:{
    evaluate:async()=>{if(++attempts===1)throw Error('DOM_CHECK_FAILED');return accountId},
  }}
  assert.equal((await browser.check(owner,new AbortController().signal)).phase,'connected')
  assert.equal(attempts,2)
})
