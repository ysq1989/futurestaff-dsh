import { z } from 'zod'
import type { LeadAnalyzer, TargetProfile } from '@futurestaff/douyin-dm-mcp/lead-analysis'
import { diagnosed } from './task-diagnostics.js'

export const discoveredWorkSchema=z.object({id:z.string().regex(/^[0-9]{5,30}$/),url:z.string().url(),name:z.string().max(200),description:z.string().max(3000),accountUrl:z.string().url()}).strict()
export type DiscoveredWork=z.infer<typeof discoveredWorkSchema>
export interface DiscoveryPort {search(owner:string,keyword:string,signal:AbortSignal):Promise<DiscoveredWork[]>}
export async function discoverWorks(port:DiscoveryPort,analyzer:LeadAnalyzer,input:{owner:string;tenantId:string;userId:string;profile:TargetProfile;modelId:string;keyword:string;signal:AbortSignal}) {
  const keyword=z.string().trim().min(1).max(80).refine(value=>!/[<>\r\n]|https?:/i.test(value)).parse(input.keyword)
  const raw=await diagnosed('SEARCH',input.signal,async()=>z.array(discoveredWorkSchema).max(10).parse(await port.search(input.owner,keyword,input.signal)))
  input.signal.throwIfAborted()
  const unique=[...new Map(raw.map(work=>{
    const url=new URL(work.url),account=new URL(work.accountUrl)
    if(url.origin!=='https://www.douyin.com'||url.username||url.password||url.search||url.hash||![`/video/${work.id}`,`/note/${work.id}`].includes(url.pathname)
      ||account.origin!==url.origin||account.username||account.password||account.search||account.hash||!/^\/user\/MS4wLjAB[A-Za-z0-9_-]{10,150}$/.test(account.pathname))throw Error('SCAN_SOURCE_MISMATCH')
    return [work.id,work] as const
  })).values()]
  if(!unique.length)return []
  const result=await diagnosed('SELECTION',input.signal,()=>analyzer.selectWorks(input.profile,unique.map(work=>work.description),input.modelId,input.signal))
  input.signal.throwIfAborted()
  if(result.tenantId!==input.tenantId||result.userId!==input.userId)throw Error('PRINCIPAL_CHANGED')
  return result.items.filter(item=>item.relevant).map(item=>({...unique[item.index]!,reason:item.reason,quotes:item.quotes}))
}
