import test from 'node:test'
import assert from 'node:assert/strict'
import { scanResponse, readWatchedPage } from '../lib/browser-collector.js'
import { AccountBrowser } from '../lib/account-browser.js'

const account='MS4wLjABfixture_account_12345', other='MS4wLjABfixture_other_12345', work='123456789'
const url=`https://www.douyin.com/video/${work}`
const response=`https://www.douyin.com/aweme/v1/web/comment/list/?aweme_id=${work}`
const payload={status_code:0,comments:[{cid:'987654321',aweme_id:work,text:'电子签还没办，请问怎么申请？',create_time:1770000000,user:{sec_uid:other}}]}
function browser(body=payload, page=url) {
  const listeners=new Map(), calls=[]
  return { calls, listeners, on(method,listener){listeners.set(method,listener);return()=>listeners.delete(method)},
    async call(method,args){
      calls.push(method)
      if(method==='Page.navigate'){
        listeners.get('Network.responseReceived')?.({requestId:'r1',type:'Fetch',response:{url:response,status:200}})
        listeners.get('Network.loadingFinished')?.({requestId:'r1',encodedDataLength:400})
      }
      if(method==='Network.getResponseBody')return {body:JSON.stringify(body),base64Encoded:false}
      return {}
    }, async evaluate(fn){return fn.name==='readLoginAccount'?account:{origin:new URL(page).origin,path:new URL(page).pathname,loaded:true}}
  }
}
test('only the exact public resource response can contribute comments and timestamps',()=>{
  const result=scanResponse(response,payload,'work',work)
  assert.equal(result.comments[0].commentId,'987654321')
  assert.equal(result.comments[0].recipient,other)
  assert.equal(result.comments[0].publishedAt,new Date(1770000000000).toISOString())
  assert.equal(scanResponse(response.replace(work,'111111111'),payload,'work',work),null)
  assert.equal(scanResponse(response.replace('www.douyin.com','evil.invalid'),payload,'work',work),null)
  assert.throws(()=>scanResponse(response,{...payload,comments:[{...payload.comments[0],aweme_id:'111111111'}]},'work',work),/SCAN_SOURCE_MISMATCH/)
  assert.throws(()=>scanResponse(response,{status_code:0,comments:[{...payload.comments[0],create_time:undefined}]},'work',work))
})
test('account discovery requires matching authors, preserves image works and is bounded',()=>{
  const endpoint=`https://www.douyin.com/aweme/v1/web/aweme/post/?sec_user_id=${account}`
  const item={aweme_id:work,desc:'图文',author:{sec_uid:account},images:[{}]}
  const data={status_code:0,aweme_list:Array.from({length:10},()=>item)}
  const result=scanResponse(endpoint,data,'account',account)
  assert.equal(result.works.length,5);assert.equal(result.works[0].url,`https://www.douyin.com/note/${work}`)
  assert.throws(()=>scanResponse(endpoint,{status_code:0,aweme_list:[{...item,author:{sec_uid:other}}]},'account',account),/SCAN_SOURCE_MISMATCH/)
})
test('owned tab reads page-initiated bodies and releases network observers after completion',async()=>{
  const cdp=browser(), result=await readWatchedPage(cdp,url,'work',work,new AbortController().signal)
  assert.equal(result.comments.length,1);assert.equal(cdp.listeners.size,0)
  assert.equal(cdp.calls.at(-1),'Network.disable')
  assert.ok(!cdp.calls.includes('Network.getAllCookies'))
})
test('wrong page, malformed response and aborted scans never yield evidence',async()=>{
  await assert.rejects(readWatchedPage(browser(), 'https://evil.invalid/video/'+work,'work',work,new AbortController().signal),/SCAN_SOURCE_MISMATCH/)
  await assert.rejects(readWatchedPage(browser(payload,'https://www.douyin.com/user/self'),url,'work',work,new AbortController().signal),/SCAN_PAGE_UNAVAILABLE/)
  await assert.rejects(readWatchedPage(browser({token:'must-not-be-reflected'}),url,'work',work,new AbortController().signal),/SCAN_SCHEMA_CHANGED/)
  const abort=new AbortController();abort.abort()
  await assert.rejects(readWatchedPage(browser(),url,'work',work,abort.signal),{name:'AbortError'})
})
test('collector is bound to the logged-in owner and rechecks identity before returning evidence',async()=>{
  const owned=new AccountBrowser('unused'),cdp=browser(),owner='a'.repeat(64)
  owned.active={owner,cdp,state:{phase:'connected',accountId:account}}
  assert.equal(owned.ready(owner),true);assert.equal(owned.ready('b'.repeat(64)),false)
  const watch={url,kind:'work',id:work,name:'签证作品'}
  const result=await owned.scan(owner,watch,new AbortController().signal)
  assert.equal(result.works[0].comments[0].title,'') // A user's watch label is not published evidence.
  let reads=0
  cdp.evaluate=async fn=>fn.name==='readLoginAccount'?(++reads===1?account:other):{origin:'https://www.douyin.com',path:`/video/${work}`,loaded:true}
  await assert.rejects(owned.scan(owner,watch,new AbortController().signal),/SCAN_ACCOUNT_CHANGED/)
  assert.equal(owned.ready(owner),false)
})
