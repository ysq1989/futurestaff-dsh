import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Cdp } from '@futurestaff/douyin-dm-mcp/browser'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const executable = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
test('blue system navigation works in a real browser at desktop and narrow widths', { skip: !executable, timeout: 30000 }, async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'fs-system-ui-'))
  const output = path.join(root, 'work', 'blue-system-directory')
  await mkdir(output, { recursive: true })
  const bundle = await build({ stdin: { resolveDir: root, loader: 'tsx', contents: `
    import React,{useState} from 'react';import{createRoot}from'react-dom/client';
    import{createAccountSidebar}from'./plugins/fs-platform-access/src/client/sidebar.tsx';
    import{SystemPages,SystemMain}from'./plugins/fs-platform-access/src/client/system-pages.tsx';
    import{appearanceTokens}from'./plugins/fs-platform-access/src/client/appearance.ts';
    const pages=new SystemPages(),listeners=new Set();let snapshot={phase:'ready',user:{userId:'fixture-user',displayName:'测试用户'},activeTenantId:'a',tenants:[{tenantId:'a',displayName:'系统体验'}],applications:[{appId:'erp',tenantId:'a',displayName:'ERP',baseUrl:'https://erp-dev.fsstory.net',deepLinks:{home:'/erp'},capabilities:['erp.read']}],models:[]};
    const controller={getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},logout:async()=>{snapshot={...snapshot,phase:'signed_out'};listeners.forEach(fn=>fn())}};
    pages.register({id:'douyin',title:'抖音获客',component:()=> <section style={{padding:24}}><h1>抖音获客</h1><p>隔离界面验收 · 不执行业务操作</p><label>目标画像<input defaultValue="越南签证办理需求"/></label></section>});
    pages.register({id:'geo',title:'GEO 品牌运营',component:()=> <section style={{padding:24}}><h1>GEO 品牌运营</h1></section>});
    const Sidebar=createAccountSidebar(controller,pages);
    for(const[key,value]of Object.entries(appearanceTokens))document.documentElement.style.setProperty(key,value.light);
    window.fixture={pages,controller,setDark:()=>{for(const[key,value]of Object.entries(appearanceTokens))document.documentElement.style.setProperty(key,value.dark)}};
    function App(){const[collapsed,setCollapsed]=useState(false);return <div style={{display:'flex',height:'100vh',minWidth:0}}><div style={{width:collapsed?72:264,flexShrink:0}}><Sidebar collapsed={collapsed} width={264} toggleSidebar={()=>setCollapsed(x=>!x)} startSession={()=>{}} renderSlot={name=>name==='sidebar.settings'?<div><button>账号设置</button></div>:<div>最近会话</div>}/></div><main style={{flex:1,minWidth:0}}><SystemMain pages={pages} chat={<section style={{padding:24}}><h1>FutureStaff Agent</h1><textarea aria-label="会话输入" defaultValue="保留的会话草稿"/></section>}/></main></div>}
    createRoot(document.getElementById('root')).render(<App/>);
  ` }, bundle: true, write: false, format: 'iife', jsx: 'automatic' })
  const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FutureStaff UI review</title><style>*{box-sizing:border-box}body{margin:0;font-family:Segoe UI,Microsoft YaHei,sans-serif;background:var(--bg-primary);color:var(--text-primary)}input,textarea{display:block;max-width:100%;padding:10px;border:1px solid var(--border-default);border-radius:6px;font:inherit}h1{font-size:24px}</style><div id="root"></div><script src="/fixture.js"></script></html>'
  const server = createServer((req, res) => { res.setHeader('content-type', req.url === '/fixture.js' ? 'application/javascript' : 'text/html; charset=utf-8');res.end(req.url === '/fixture.js' ? bundle.outputFiles[0].text : html) })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const child = spawn(executable, ['--headless=new', '--disable-background-networking', '--no-first-run', '--no-default-browser-check', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${dir}/browser`, 'about:blank'], { windowsHide: true, stdio: 'ignore' })
  let cdp
  try {
    let portFile
    for (let i=0;i<80;i++) { try { portFile = await readFile(path.join(dir,'browser','DevToolsActivePort'),'utf8');break } catch { await sleep(100) } }
    assert.ok(portFile)
    const targets=await(await fetch(`http://127.0.0.1:${portFile.split('\n')[0]}/json/list`)).json()
    cdp=await Cdp.connect(targets.find(item=>item.type==='page').webSocketDebuggerUrl)
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false})
    await cdp.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`})
    for(let i=0;i<80;i++){if(await cdp.evaluate(()=>!!document.getElementById('fs-menu-tab'),null))break;await sleep(100)}
    await cdp.evaluate(()=>document.getElementById('fs-menu-tab').click()||true,null)
    assert.equal(await cdp.evaluate(()=>getComputedStyle(document.querySelector('.fs-sidebar')).backgroundColor,null),'rgb(29, 78, 216)')
    assert.equal(await cdp.evaluate(()=>document.querySelectorAll('.fs-sidebar-system').length,null),8)
    assert.equal(await cdp.evaluate(()=>document.querySelector('.fs-sidebar').textContent.includes('选品中心'),null),false)
    await cdp.evaluate(()=>document.querySelector('[aria-label="打开抖音获客"]').click()||true,null)
    await cdp.evaluate(()=>document.querySelector('[aria-label="打开FutureStaff ERP"]').click()||true,null)
    await cdp.evaluate(()=>document.querySelector('[aria-label="打开抖音获客"]').click()||true,null)
    assert.equal(await cdp.evaluate(()=>document.querySelectorAll('.fs-system-tab').length,null),2)
    await cdp.evaluate(()=>{const tab=document.querySelector('.fs-system-tab [aria-selected=true]');tab.focus();tab.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));return true},null)
    assert.equal(await cdp.evaluate(()=>document.querySelector('.fs-system-tab [aria-selected=true]').textContent,null),'FutureStaff ERP')
    assert.equal(await cdp.evaluate(()=>document.activeElement.id,null),'fs-system-tab-cloud:erp')
    await cdp.evaluate(()=>document.querySelector('[aria-label="打开抖音获客"]').click()||true,null)
    const image=await cdp.call('Page.captureScreenshot',{format:'png'})
    await writeFile(path.join(output,'desktop.png'),Buffer.from(image.data,'base64'))
    await cdp.evaluate(()=>document.getElementById('fs-sessions-tab').click()||true,null)
    assert.equal(await cdp.evaluate(()=>document.querySelector('[aria-label="会话输入"]').value,null),'保留的会话草稿')
    await cdp.evaluate(()=>document.getElementById('fs-menu-tab').click()||true,null)
    await cdp.evaluate(()=>document.querySelector('[aria-label="测试用户，用户菜单"]').click()||true,null)
    assert.equal(await cdp.evaluate(()=>document.querySelector('.fs-sidebar-account').getAttribute('data-open'),null),'true')
    await cdp.call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true})
    await cdp.evaluate(()=>document.querySelector('[aria-label="收起侧栏"]').click()||true,null)
    assert.equal(await cdp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth,null),true)
    assert.ok(await cdp.evaluate(()=>document.querySelector('.fs-sidebar-account').getBoundingClientRect().width>=200,null))
    await cdp.evaluate(()=>{window.fixture.setDark();return true},null)
    assert.equal(await cdp.evaluate(()=>getComputedStyle(document.querySelector('.fs-sidebar')).backgroundColor,null),'rgb(20, 43, 88)')
    const narrow=await cdp.call('Page.captureScreenshot',{format:'png'})
    await writeFile(path.join(output,'narrow-dark.png'),Buffer.from(narrow.data,'base64'))
    await cdp.evaluate(async()=>{await window.fixture.controller.logout();return true},null)
    assert.equal(await cdp.evaluate(()=>window.fixture.pages.getSnapshot().tabs.length,null),0)
  } finally { cdp?.close();child.kill();await new Promise(resolve=>server.close(resolve)) }
})
