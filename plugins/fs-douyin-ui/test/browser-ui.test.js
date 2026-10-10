import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Cdp } from '@futurestaff/douyin-dm-mcp/browser'
import { LeadDatabase } from '../lib/database.js'
import { DouyinService } from '../lib/service.js'
import { createHandler, routePath } from '../lib/index.js'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const executable = process.env.DOUYIN_TEST_BROWSER || ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
test('real browser renders desktop/mobile views and loads evidence through the local Host bridge', { skip: !executable, timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dy-ui-browser-')), output = path.join(root, 'work', 'douyin-ui-review')
  await mkdir(output, { recursive: true })
  const modelId = '30000000-0000-4000-8000-000000000001', signal = new AbortController().signal
  const service = new DouyinService(new LeadDatabase(path.join(dir, 'leads.sqlite')),
    async () => ({ tenantId: 'fixture-tenant', userId: 'fixture-user', signal }),
    { models: async () => [{ modelId, displayName: 'FutureStaff 示例模型' }], generateText: async () => ({ modelId, tenantId: 'fixture-tenant', userId: 'fixture-user',
      text: JSON.stringify({ classification: 'target', need: '需要电子签办理协助', reason: '评论者明确表示未办理并请求帮助', urgency: 'explicit', evidence: [{ source: 'comment', quote: '下周去河内，电子签还没办，能帮忙吗？' }] }) }) }, undefined, false,
    { status: () => ({ phase: 'connected', accountId: 'MS4wLjABfixture_account_12345' }), close: async () => {},
      readLibrary: async () => ({ accountId: 'MS4wLjABfixture_account_12345', items: [{ id: '234567890', name: '收藏的越南签证视频', url: 'https://www.douyin.com/video/234567890' }] }) })
  await service.act({ action: 'model', modelId })
  await service.act({ action: 'watch', kind: 'work', url: 'https://www.douyin.com/video/123456789', name: '越南电子签申请攻略', intervalSeconds: 600 })
  await service.recordScan('123456789', [{ commentId: 'fixture-c1', workId: '123456789', recipient: 'fixture_recipient', title: '越南电子签申请攻略', description: '', text: '下周去河内，电子签还没办，能帮忙吗？', parentText: '', publishedAt: '2026-10-03T10:00:00Z', collectedAt: '2026-10-03T10:01:00Z' }])
  await service.act({ action: 'analyze', key: Object.keys((await service.snapshot()).comments)[0] })
  await service.act({ action: 'review', recipient: 'fixture_recipient', decision: 'approve' })
  await service.act({ action: 'preview', input: { recipients: ['fixture_recipient'], message: '您好，看到您咨询越南电子签办理。如果仍需要协助，欢迎回复。', scheduledAt: new Date(Date.now() + 600000).toISOString(), intervalSeconds: 60, durationSeconds: 3600, maxMessages: 1 } })
  const ui = await build({ stdin: { contents: `
    import React from 'react'; import {createRoot} from 'react-dom/client';
    import {DouyinWorkspace} from ${JSON.stringify(path.join(root,'plugins/fs-douyin-ui/src/client/index.tsx'))};
    import {ShellPaletteFixture} from ${JSON.stringify(path.join(root,'plugins/fs-douyin-ui/test/shell-palette-fixture.tsx'))};
    import {appearanceCss,appearanceTokens} from ${JSON.stringify(path.join(root,'plugins/fs-platform-access/src/client/appearance.ts'))};
    import {platformAccessPanelCss} from ${JSON.stringify(path.join(root,'plugins/fs-platform-access/src/client/index.tsx'))};
    import {renderPlatformAccessView} from ${JSON.stringify(path.join(root,'plugins/fs-platform-access/src/view.ts'))};
    document.body.dataset.futurestaffSkin='midnight';
    const scheme=new URLSearchParams(location.search).get('scheme')==='light'?'light':'dark';
    document.documentElement.style.colorScheme=scheme;
    for(const [key,value] of Object.entries(appearanceTokens))document.body.style.setProperty(key,value[scheme]);
    const style=document.createElement('style');style.textContent=platformAccessPanelCss+appearanceCss;document.head.appendChild(style);
    if(location.pathname==='/login'){
      document.getElementById('root').innerHTML='<section class="futurestaff-login-gate"><div class="futurestaff-access">'+renderPlatformAccessView({phase:'signed_out',simulated:false,contractVersion:'0.1.1',tenants:[],applications:[],models:[]})+'</div></section>';
    }else{
      createRoot(document.getElementById('root')).render(React.createElement(location.pathname==='/shell'?ShellPaletteFixture:DouyinWorkspace,location.pathname==='/module'?{standalone:true,onClose:()=>{}}:{}));
    }`, resolveDir: root, loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic' })
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>抖音获客界面离线验收</title><style>:root{--bg-primary:#0B1120;--bg-secondary:#111827;--text-primary:#F1F5F9;--text-secondary:#94A3B8;--border-default:#1E3A5F;--accent-primary:#818CF8}body{margin:0}#root{height:100vh}</style><div id="root"></div><script src="/fixture.js"></script></html>`
  const handler = createHandler(service)
  const server = createServer((req,res) => { if (req.url === routePath) void handler(req,res); else if (req.url === '/fixture.js') { res.setHeader('content-type','application/javascript'); res.end(ui.outputFiles[0].text) } else { res.setHeader('content-type','text/html; charset=utf-8'); res.end(html) } })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const child = spawn(executable, ['--headless=new','--disable-background-networking','--no-first-run','--no-default-browser-check','--no-proxy-server','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1','--remote-debugging-port=0',`--user-data-dir=${dir}/browser`,'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let cdp
  try {
    let portFile
    for (let i=0;i<80;i++) { try { portFile = await readFile(path.join(dir,'browser','DevToolsActivePort'),'utf8'); break } catch { await sleep(100) } }
    assert.ok(portFile)
    const [port] = portFile.trim().split('\n'), targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
    cdp = await Cdp.connect(targets.find(t => t.type === 'page').webSocketDebuggerUrl)
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false })
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
    for (let i=0;i<80;i++) { if (await cdp.evaluate(() => !!document.querySelector('[role="tab"]'), null)) break; await sleep(100) }
    assert.equal(await cdp.evaluate(() => document.querySelectorAll('[role="tab"]').length, null), 9,
      JSON.stringify(await cdp.evaluate(() => ({ url: location.href, text: document.body?.innerText, root: document.querySelector('#root')?.innerHTML }), null)))
    async function screenshot(name) {
      const result = await cdp.call('Page.captureScreenshot', { format: 'png' })
      await writeFile(path.join(output, name+'.png'), Buffer.from(result.data,'base64'))
    }
    await screenshot('profile-desktop')
    await cdp.evaluate(() => { [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent==='目标用户').click(); return true }, null)
    await sleep(100); assert.equal(await cdp.evaluate(() => document.body.textContent.includes('下周去河内，电子签还没办，能帮忙吗？'), null), true)
    await screenshot('candidates-desktop')
    await cdp.evaluate(() => { [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent==='私信任务').click(); return true }, null)
    await sleep(100); assert.equal(await cdp.evaluate(() => [...document.querySelectorAll('button')].find(e => e.textContent==='确认启动预约').disabled, null), true)
    await screenshot('schedule-desktop')
    await cdp.evaluate(() => { [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent==='关注作品').click(); return true }, null)
    await cdp.evaluate(() => { [...document.querySelectorAll('button')].find(e => e.textContent==='读取当前列表').click(); return true }, null)
    for (let i=0;i<50;i++) { if (await cdp.evaluate(() => !!document.querySelector('[aria-label="选择 收藏的越南签证视频"]'), null)) break; await sleep(100) }
    assert.equal(await cdp.evaluate(() => !!document.querySelector('[aria-label="选择 收藏的越南签证视频"]'), null), true)
    await cdp.evaluate(() => { document.querySelector('[aria-label="选择 收藏的越南签证视频"]').click(); return true }, null)
    await screenshot('favorites-desktop')
    await cdp.evaluate(() => { [...document.querySelectorAll('button')].find(e => e.textContent==='导入所选到监控列表').click(); return true }, null)
    for (let i=0;i<50;i++) { if ((await service.snapshot()).watches.length===2) break; await sleep(100) }
    assert.equal((await service.snapshot()).watches.length, 2)
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/module` })
    for (let i=0;i<50;i++) { if (await cdp.evaluate(() => !!document.querySelector('.dy-native-window [aria-label="分析模型"]'), null)) break; await sleep(100) }
    assert.deepEqual(await cdp.evaluate(() => {
      const window = document.querySelector('.dy-native-window'), bounds = window.getBoundingClientRect()
      return { dialog: !!document.querySelector('.dy-dialog'), left: bounds.left, top: bounds.top, width: bounds.width, height: bounds.height }
    }, null), { dialog: false, left: 0, top: 0, width: 1280, height: 960 })
    await screenshot('independent-window-desktop')
    assert.equal(await cdp.evaluate(() => getComputedStyle(document.querySelector('.dy-workspace')).color, null), 'rgb(238, 238, 242)')
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
    await cdp.evaluate(() => { [...document.querySelectorAll('[role="tab"]')].find(e => e.textContent==='关注作品').click(); return true }, null)
    await sleep(100); await screenshot('watches-mobile')
    assert.equal(await cdp.evaluate(() => document.documentElement.scrollWidth <= innerWidth, null), true)
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 960, deviceScaleFactor: 1, mobile: false })
    for (const scheme of ['dark','light']) {
      await cdp.call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/login?scheme=${scheme}` })
      for (let i=0;i<50;i++) { if (await cdp.evaluate(() => !!document.querySelector('.fs-login-form'), null)) break; await sleep(100) }
      assert.equal(await cdp.evaluate(() => getComputedStyle(document.querySelector('.futurestaff-access')).color, null), scheme==='dark' ? 'rgb(238, 238, 242)' : 'rgb(15, 23, 42)')
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      assert.notEqual(await cdp.evaluate(() => getComputedStyle(document.activeElement).outlineStyle, null), 'none')
      await screenshot(`login-${scheme}`)
    }
    await cdp.call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/module?scheme=light` })
    for (let i=0;i<50;i++) { if (await cdp.evaluate(() => !!document.querySelector('[role="tab"]'), null)) break; await sleep(100) }
    await screenshot('independent-window-light')
    await cdp.evaluate(()=>{[...document.querySelectorAll('[role="tab"]')].find(el=>el.textContent==='自动获客').click();return true},null)
    await sleep(100)
    assert.equal(await cdp.evaluate(()=>document.body.textContent.includes('根据业务自动寻找客户'),null),true)
    assert.equal(await cdp.evaluate(()=>document.querySelector('input[type="checkbox"]').disabled,null),true)
    await screenshot('automatic-acquisition-light')
    for(const scheme of ['dark','light']) {
      await cdp.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/shell?scheme=${scheme}`})
      for(let i=0;i<50;i++){if(await cdp.evaluate(()=>!!document.querySelector('[aria-label="打开抖音获客"]'),null))break;await sleep(100)}
      assert.deepEqual(await cdp.evaluate(()=>[...document.querySelectorAll('[aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]')].map(e=>({background:getComputedStyle(e).backgroundColor,color:getComputedStyle(e).color})),null),Array(2).fill({background:'rgba(0, 0, 0, 0)',color:scheme==='dark'?'rgb(177, 178, 189)':'rgb(71, 85, 105)'}))
      assert.equal(await cdp.evaluate(()=>getComputedStyle(document.querySelector('.dshDesktopSidebarSurface')).backgroundColor,null),scheme==='dark'?'rgb(17, 18, 21)':'rgb(255, 255, 255)')
      await screenshot(`shell-${scheme}`)
      assert.equal(await cdp.evaluate(()=>{const launcher=document.querySelector('[aria-label="打开线上选品中心"]');launcher.setAttribute('aria-label','打开选品中心');return getComputedStyle(launcher).backgroundColor},null),'rgba(0, 0, 0, 0)')
    }
  } finally {
    cdp?.close(); const exited = new Promise(resolve => child.once('exit',resolve)); child.kill(); await Promise.race([exited,sleep(3000)])
    await new Promise(resolve => server.close(resolve)); await service.close(); await rm(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200})
  }
})
