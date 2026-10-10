import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Cdp} from '@futurestaff/douyin-dm-mcp/browser';
import {GeoDesktopService} from '../lib/service.js';
import {createGeoHandler} from '../lib/index.js';

const root=fileURLToPath(new URL('../../../',import.meta.url));
const output=path.join(root,'work','geo-local-review');await mkdir(output,{recursive:true});
const temporary=await mkdtemp(path.join(tmpdir(),'fs-geo-browser-'));
const executable=['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
if(!executable)throw Error('Isolated browser runtime is unavailable');
const controller=new AbortController();
const actor={tenantId:'00000000-0000-4000-8000-000000000001',userId:'00000000-0000-4000-8000-000000000003',namespace:'https://platform.fsstory.net',displayName:'隔离测试用户',tenantName:'隔离测试主体',permissions:['geo.admin'],signal:controller.signal};
const service=new GeoDesktopService({root:path.join(temporary,'data'),authorize:async()=>{controller.signal.throwIfAborted();return actor},inference:{models:async()=>[],generateText:async()=>{throw Error('REAL_INFERENCE_DISABLED')}}});
const post=async(url,body)=>service.dispatch({method:'POST',url,body});
const brand=await post('/api/geo/v1/brand',{version:0,brand:'GEO 示例品牌（测试）',business:'用于验证桌面本地业务流程的测试资料',facts:'全部为隔离测试数据'});assert.equal(brand.statusCode,200,brand.body);
const project=await post('/api/geo/v1/projects',{name:'本地推广计划（测试）'});assert.equal(project.statusCode,201,project.body);
const snapshot={phase:'ready',simulated:false,contractVersion:'0.1.1',activeTenantId:actor.tenantId,user:{userId:actor.userId,displayName:actor.displayName},tenants:[],applications:[{appId:'geo',tenantId:actor.tenantId}],models:[]};
const bundle=await build({stdin:{contents:`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import {apply as geo} from './plugins/fs-geo/src/client/index.tsx';
 import {apply as douyin} from './plugins/fs-douyin-ui/src/client/index.tsx';
 import {SystemPages,SystemMain} from './plugins/fs-platform-access/lib/client/system-pages.js';
 const pages=new SystemPages();pages.bindOwner('fixture-owner');let snapshot=${JSON.stringify(snapshot)};
 const listeners=new Set(),slots=[];
 const ctx={platformSystemPages:pages,platformClientSession:{getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)}},effect:fn=>fn(),slots:{inject:(_n,fn)=>fn(),register:(options,component)=>{slots.push({options,component});return()=>{}}}};
 douyin(ctx);geo(ctx);
 window.fixture={expire:()=>{snapshot={...snapshot,phase:'expired',applications:[]};pages.bindOwner('');for(const fn of listeners)fn()}};
 const launchers=slots.filter(s=>s.options.name==='sidebar.footer.action').sort((a,b)=>(a.options.order||0)-(b.options.order||0));
 createRoot(document.getElementById('root')).render(<div className="fixture-shell"><aside className="dshDesktopSidebarSurface"><h2>FutureStaff Agent</h2><p>隔离测试 · 本地数据库</p><h3>系统</h3>{launchers.map((s,i)=>React.createElement(s.component,{wide:true,key:i}))}</aside><main><SystemMain pages={pages} chat={<h1>会话（测试）</h1>}/></main></div>);
 `,resolveDir:root,loader:'tsx'},bundle:true,format:'esm',platform:'browser',write:false,jsx:'automatic'});
const js=bundle.outputFiles[0].text;
const handler=createGeoHandler(service,path.join(root,'plugins','fs-geo','lib','ui'));
const server=createServer((request,response)=>{
 if(request.url?.startsWith('/_futurestaff/geo/')){void handler(request,response);return}
 if(request.url==='/fixture.js'){response.setHeader('content-type','text/javascript');response.end(js);return}
 response.setHeader('content-type','text/html');response.end('<!doctype html><html><head><meta charset="utf-8"><style>html,body,#root{margin:0;height:100%;font:14px system-ui}.fixture-shell{display:flex;height:100vh}.fixture-shell aside{width:210px;flex:none;padding:16px;background:#fff;color:#475569;border-right:1px solid #e2e8f0}.fixture-shell main{flex:1;min-width:0;min-height:0}.fixture-shell aside button{display:block;background:transparent;border:0;cursor:pointer;text-align:left;color:inherit;margin:6px 0}.fs-system-body{height:100%}</style></head><body><div id="root"></div><script type="module" src="/fixture.js"></script></body></html>');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browserRoot=path.join(temporary,'browser');
const browser=spawn(executable,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${browserRoot}`,'--no-first-run','--no-default-browser-check','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let cdp;
async function waitFor(fn,label){for(let i=0;i<100;i++){if(await cdp.evaluate(fn,null))return;await sleep(100)}throw Error(label)}
try{
 let portFile;for(let i=0;i<100;i++){try{portFile=await readFile(path.join(browserRoot,'DevToolsActivePort'),'utf8');break}catch{await sleep(100)}}assert.ok(portFile,'isolated browser did not start');
 const port=portFile.split('\n')[0];const targets=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
 cdp=await Cdp.connect(targets.find(t=>t.type==='page').webSocketDebuggerUrl);
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:1440,height:960,deviceScaleFactor:1,mobile:false});
 await cdp.call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
 await waitFor(()=>!!document.querySelector('[aria-label="打开 GEO 系统"]'),'GEO peer launcher missing');
 assert.equal(await cdp.evaluate(()=>!!document.querySelector('[aria-label="打开抖音获客"]'),null),true);
 await cdp.evaluate(()=>{document.querySelector('[aria-label="打开 GEO 系统"]').click();return true},null);
 await waitFor(()=>document.querySelector('iframe')?.contentDocument?.body.textContent.includes('本地推广计划（测试）'),'GEO local campaign did not render');
 assert.equal(await cdp.evaluate(()=>document.querySelectorAll('[role="tab"]').length,null),1);
 const image=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'geo-peer-desktop.png'),Buffer.from(image.data,'base64'));
 await cdp.evaluate(()=>{document.querySelector('[aria-label="打开 GEO 系统"]').click();return true},null);assert.equal(await cdp.evaluate(()=>document.querySelectorAll('[role="tab"]').length,null),1);
 await cdp.call('Emulation.setDeviceMetricsOverride',{width:860,height:760,deviceScaleFactor:1,mobile:false});await sleep(150);
 const narrow=await cdp.call('Page.captureScreenshot',{format:'png'});await writeFile(path.join(output,'geo-peer-narrow.png'),Buffer.from(narrow.data,'base64'));
 await cdp.evaluate(()=>{window.fixture.expire();return true},null);await waitFor(()=>!document.querySelector('iframe'),'expired identity did not remove GEO page');
 controller.abort();await assert.rejects(service.dispatch({method:'GET',url:'/api/geo/v1/projects'}));
 console.log('Browser smoke PASS: GEO/Douyin peer launchers, local campaign, single tab, narrow window and logout removal. No real platform, inference or publication.');
}finally{
 cdp?.close();browser.kill();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await service.close();
 if(!path.resolve(temporary).startsWith(path.resolve(tmpdir())+path.sep)||!path.basename(temporary).startsWith('fs-geo-browser-'))throw Error('Temporary cleanup path rejected');
 for(let i=0;i<20;i++){try{await rm(temporary,{recursive:true,force:true});break}catch{await sleep(100)}}
}
