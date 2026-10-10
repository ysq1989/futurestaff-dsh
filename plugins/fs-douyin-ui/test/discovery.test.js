import test from 'node:test'
import assert from 'node:assert/strict'
import { LeadAnalyzer,vietnamVisaProfile } from '@futurestaff/douyin-dm-mcp/lead-analysis'
import { discoverWorks } from '../lib/discovery.js'
import { scanResponse } from '../lib/browser-collector.js'
const modelId='30000000-0000-4000-8000-000000000001',account='MS4wLjABfixture_account_12345'
const work={id:'123456789',url:'https://www.douyin.com/video/123456789',name:'电子签办理',description:'越南电子签办理材料介绍',accountUrl:`https://www.douyin.com/user/${account}`}
function setup(items,output={items:[{index:0,relevant:true,reason:'业务相关',quotes:['越南电子签办理']}]}){
  const requests=[]
  const analyzer=new LeadAnalyzer({models:async()=>[{modelId}],generateText:async input=>{requests.push(input);return {tenantId:'tenant-a',userId:'user-a',modelId,text:JSON.stringify(output)}}})
  return {requests,run:()=>discoverWorks({search:async()=>items},analyzer,{owner:'a'.repeat(64),tenantId:'tenant-a',userId:'user-a',modelId,profile:vietnamVisaProfile,keyword:'越南电子签',signal:new AbortController().signal})}
}
test('search responses are bound to the exact keyword and preserve Host source identities',()=>{
  const url='https://www.douyin.com/aweme/v1/web/general/search/single/?keyword='+encodeURIComponent('越南电子签')
  const payload={status_code:0,data:[{aweme_info:{aweme_id:work.id,desc:work.description,author:{sec_uid:account}}}]}
  assert.equal(scanResponse(url,payload,'search','其他业务'),null)
  const result=scanResponse(url,payload,'search','越南电子签')
  assert.equal(result.works[0].url,work.url);assert.equal(result.works[0].accountUrl,work.accountUrl)
})
test('model sees only descriptions and accepted results keep browser-proven URLs',async()=>{
  const s=setup([work,work]),result=await s.run()
  assert.equal(result.length,1);assert.equal(result[0].url,work.url)
  assert.doesNotMatch(s.requests[0].text,/MS4w|123456789|https:/)
})
test('remote source, fabricated evidence and duplicate selections fail before insertion',async()=>{
  const wrong=setup([{...work,url:'https://evil.invalid/video/123456789'}])
  await assert.rejects(wrong.run(),/SCAN_SOURCE_MISMATCH/);assert.equal(wrong.requests.length,0)
  await assert.rejects(setup([work],{items:[{index:0,relevant:true,reason:'相关',quotes:['不存在的证据']}]}).run(),/EVIDENCE_NOT_IN_SOURCE/)
})
