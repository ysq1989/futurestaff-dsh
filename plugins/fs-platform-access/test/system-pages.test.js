import test from 'node:test'
import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { SystemPages,SystemMain } from '../lib/client/system-pages.js'

test('opening the same system focuses one tab, conversation switch preserves tabs and identity change clears them',()=>{
  const pages=new SystemPages(),component=()=>createElement('p',null,'模块正文')
  pages.register({id:'douyin',title:'抖音获客',component});pages.bindOwner('subject:user')
  pages.open('douyin');pages.open('douyin');assert.equal(pages.getSnapshot().tabs.length,1)
  pages.select('sessions');assert.equal(pages.getSnapshot().tabs.length,1)
  pages.select('systems');assert.equal(pages.getSnapshot().active,'douyin')
  const markup=renderToStaticMarkup(createElement(SystemMain,{pages,chat:createElement('p',null,'原有会话')}))
  assert.match(markup,/fs-chat-page" hidden/);assert.match(markup,/模块正文/);assert.doesNotMatch(markup,/role="dialog"/)
  pages.bindOwner('other:user');assert.equal(pages.getSnapshot().tabs.length,0);assert.equal(pages.getSnapshot().mode,'sessions')
  pages.bindOwner('');assert.throws(()=>pages.open('douyin'),/SYSTEM_PAGE_UNAVAILABLE/)
})
test('close waits for the owning module to cancel tasks and cannot mutate a newer subject',async()=>{
  const pages=new SystemPages();let finish
  pages.register({id:'douyin',title:'抖音获客',component:()=>null,close:()=>new Promise(resolve=>{finish=resolve})})
  pages.bindOwner('a:user');pages.open('douyin');const closing=pages.close('douyin')
  assert.equal(pages.getSnapshot().tabs.length,1)
  pages.bindOwner('b:user');pages.open('douyin');finish();await closing
  assert.equal(pages.getSnapshot().tabs.length,1)
})
