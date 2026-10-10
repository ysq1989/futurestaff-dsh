import test from 'node:test'
import assert from 'node:assert/strict'
import { JSDOM } from 'jsdom'
import { openPrivateConversation,privateConversation } from '../lib/outreach-dom.js'
const recipient='MS4wLjABfixture_recipient_12345'
function page(peer=recipient){
  const dom=new JSDOM(`<section data-e2e="user-info"><button id="private">私信</button></section><section role="dialog"><header><a href="/user/${peer}">用户资料</a></header><div contenteditable="true"></div><button id="send">发送</button><div data-message-id="old" data-direction="outgoing">旧消息</div></section>`,{url:`https://www.douyin.com/user/${recipient}`,runScripts:'outside-only'})
  Object.defineProperty(dom.window.document,'readyState',{value:'complete'})
  dom.window.Element.prototype.getBoundingClientRect=()=>({width:20,height:20})
  const editor=dom.window.document.querySelector('[contenteditable]')
  Object.defineProperty(editor,'innerText',{get:()=>editor.textContent})
  editor.setAttribute('tabindex','0')
  return {dom,editor,invoke:args=>dom.window.eval(`(${privateConversation.toString()})`)(args),open:()=>dom.window.eval(`(${openPrivateConversation.toString()})`)(recipient)}
}
test('private sender refuses a different visible receiver before inserting or sending text',()=>{
  const p=page('MS4wLjABdifferent_recipient_12345')
  try{assert.throws(()=>p.invoke({recipient,operation:'focus'}),/SEND_RECIPIENT_UNVERIFIED/);assert.equal(p.editor.textContent,'')}finally{p.dom.window.close()}
})

test('a recipient in the contact list cannot impersonate the selected conversation header',()=>{
  const p=page('MS4wLjABdifferent_recipient_12345')
  p.dom.window.document.querySelector('[role="dialog"]').insertAdjacentHTML('beforeend',`<nav><a href="/user/${recipient}">联系人</a></nav>`)
  try{assert.throws(()=>p.invoke({recipient,operation:'check'}),/SEND_RECIPIENT_UNVERIFIED/)}finally{p.dom.window.close()}
})
test('verified private pane focuses an empty unique editor and sends only the exact approved text',()=>{
  const p=page();let clicked=0,opened=0
  p.dom.window.document.getElementById('private').onclick=()=>opened++
  p.dom.window.document.getElementById('send').onclick=()=>clicked++
  try{
    assert.equal(p.open(),true);assert.equal(opened,1)
    const before=p.invoke({recipient,operation:'focus'});assert.equal(before.receipts.length,1)
    p.editor.textContent='未经批准的内容'
    assert.throws(()=>p.invoke({recipient,operation:'send',message:'已批准文案'}),/SEND_EDITOR_UNAVAILABLE/);assert.equal(clicked,0)
    p.editor.textContent='已批准文案';p.invoke({recipient,operation:'send',message:'已批准文案'});assert.equal(clicked,1)
  }finally{p.dom.window.close()}
})
