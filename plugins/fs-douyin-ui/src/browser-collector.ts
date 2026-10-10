import { z } from 'zod'
import type { Cdp } from '@futurestaff/douyin-dm-mcp/browser'
import { commentContextSchema } from '@futurestaff/douyin-dm-mcp/lead-analysis'

const id = z.string().regex(/^[0-9]{5,30}$/)
const recipient = z.string().regex(/^MS4wLjAB[A-Za-z0-9_-]{10,150}$/)
const postSchema = z.object({ status_code: z.literal(0), aweme_list: z.array(z.object({
  aweme_id: id, desc: z.string().max(3000), author: z.object({ sec_uid: recipient }), images: z.array(z.unknown()).max(100).nullable().optional(),
})).max(100) })
const commentsSchema = z.object({ status_code: z.literal(0), comments: z.array(z.object({
  cid: z.string().regex(/^[0-9]{5,30}$/), aweme_id: id, text: z.string().min(1).max(2000),
  create_time: z.number().int().min(0).max(4102444800), user: z.object({ sec_uid: recipient }),
})).max(100) })
const searchSchema = z.object({status_code:z.literal(0),data:z.array(z.object({aweme_info:postSchema.shape.aweme_list.element.optional()})).max(100)})
export function responseMatches(input: string, kind: 'account' | 'work' | 'search', resource: string) {
  const url=new URL(input)
  if(url.origin!=='https://www.douyin.com'||url.username||url.password)return false
  return kind==='search' ? url.pathname==='/aweme/v1/web/general/search/single/'&&url.searchParams.get('keyword')===resource
    :kind==='account' ? url.pathname==='/aweme/v1/web/aweme/post/'&&url.searchParams.get('sec_user_id')===resource
    :url.pathname==='/aweme/v1/web/comment/list/'&&url.searchParams.get('aweme_id')===resource
}

/** Accept only page-initiated responses for the exact watched public resource. */
export function scanResponse(urlInput: string, input: unknown, kind: 'account' | 'work' | 'search', resourceId: string) {
  const url = new URL(urlInput)
  if (url.origin !== 'https://www.douyin.com' || url.username || url.password) return null
  if(kind==='search'&&responseMatches(urlInput,kind,resourceId)){
    const data=searchSchema.parse(input)
    return {kind:'search' as const,works:data.data.flatMap(row=>row.aweme_info?[row.aweme_info]:[]).slice(0,10).map(work=>({
      id:work.aweme_id,url:`https://www.douyin.com/${work.images?.length?'note':'video'}/${work.aweme_id}`,
      name:work.desc.slice(0,200),description:work.desc,accountUrl:`https://www.douyin.com/user/${work.author.sec_uid}`,
    }))}
  }
  if (kind === 'account' && url.pathname === '/aweme/v1/web/aweme/post/' && url.searchParams.get('sec_user_id') === resourceId) {
    const data = postSchema.parse(input)
    if (data.aweme_list.some(work => work.author.sec_uid !== resourceId)) throw Error('SCAN_SOURCE_MISMATCH')
    return { kind: 'account' as const, works: data.aweme_list.slice(0, 5).map(work => ({
      url: `https://www.douyin.com/${work.images?.length ? 'note' : 'video'}/${work.aweme_id}`, name: work.desc.slice(0,200), id: work.aweme_id,
    })) }
  }
  if (kind === 'work' && url.pathname === '/aweme/v1/web/comment/list/' && url.searchParams.get('aweme_id') === resourceId) {
    const data = commentsSchema.parse(input), collectedAt = new Date().toISOString()
    if (data.comments.some(comment => comment.aweme_id !== resourceId)) throw Error('SCAN_SOURCE_MISMATCH')
    return { kind: 'work' as const, comments: data.comments.map(comment => commentContextSchema.parse({
      commentId: comment.cid, workId: resourceId, recipient: comment.user.sec_uid,
      title: '', description: '', text: comment.text, parentText: '',
      publishedAt: new Date(comment.create_time * 1000).toISOString(), collectedAt,
    })) }
  }
  return null
}

export async function readWatchedPage(cdp: Cdp, url: string, kind: 'account' | 'work' | 'search', resourceId: string, signal: AbortSignal): Promise<NonNullable<ReturnType<typeof scanResponse>>> {
  signal.throwIfAborted()
  const source = new URL(url)
  if (source.origin !== 'https://www.douyin.com' || source.username || source.password || source.hash
    || (kind==='search' ? source.pathname!==`/search/${encodeURIComponent(resourceId)}`||source.search!=='?type=video'
      :source.search|| (kind === 'account' ? source.pathname !== `/user/${resourceId}` : ![`/video/${resourceId}`, `/note/${resourceId}`].includes(source.pathname)))) throw Error('SCAN_SOURCE_MISMATCH')
  let result: ReturnType<typeof scanResponse> = null, failure: Error | undefined
  const allowed = new Map<string, string>(), pending = new Set<Promise<void>>()
  const response = cdp.on('Network.responseReceived', raw => {
    const event = raw as { requestId?: string; type?: string; response?: { url?: string; status?: number; encodedDataLength?: number } }
    if (!event.requestId || !['XHR','Fetch'].includes(event.type ?? '') || event.response?.status !== 200 || !event.response.url) return
    try {
      const matches = responseMatches(event.response.url,kind,resourceId)
      if (matches && allowed.size < 20) allowed.set(event.requestId, event.response.url)
    } catch {}
  })
  const finished = cdp.on('Network.loadingFinished', raw => {
    const event = raw as { requestId?: string; encodedDataLength?: number }
    const responseUrl = event.requestId && allowed.get(event.requestId)
    if (!responseUrl || signal.aborted || result || failure) return
    allowed.delete(event.requestId!)
    if (typeof event.encodedDataLength !== 'number' || event.encodedDataLength > 1_000_000) { failure = Error('SCAN_SCHEMA_CHANGED'); return }
    const job = (async () => {
      try {
        const body = await cdp.call('Network.getResponseBody', { requestId: event.requestId })
        signal.throwIfAborted()
        if (body.base64Encoded || typeof body.body !== 'string' || body.body.length > 1_000_000) throw Error('SCAN_SCHEMA_CHANGED')
        const parsed = scanResponse(responseUrl, JSON.parse(body.body), kind, resourceId)
        if (!result) result = parsed
      } catch (error) { failure = error instanceof Error && error.message === 'SCAN_SOURCE_MISMATCH' ? error : Error('SCAN_SCHEMA_CHANGED') }
    })()
    pending.add(job); void job.finally(() => pending.delete(job))
  })
  try {
    await cdp.call('Network.enable', { maxTotalBufferSize: 2_000_000, maxResourceBufferSize: 1_000_000 })
    signal.throwIfAborted()
    await cdp.call('Page.navigate', { url })
    const deadline = Date.now() + 12_000
    while (!result && !failure && Date.now() < deadline) {
      signal.throwIfAborted()
      await new Promise(resolve => setTimeout(resolve, 200))
    }
    signal.throwIfAborted()
    if (failure) throw failure
    if (!result) throw Error('SCAN_DATA_UNAVAILABLE')
    const pageDeadline = Date.now() + 5000
    let current: { origin: string; path: string; loaded: boolean }
    do {
      signal.throwIfAborted()
      current = await cdp.evaluate<{ origin: string; path: string; loaded: boolean }>(() => ({ origin: location.origin, path: location.pathname, loaded: document.readyState === 'complete' }), null)
      if (current.loaded) break
      await new Promise(resolve => setTimeout(resolve, 200))
    } while (Date.now() < pageDeadline)
    const expected = new URL(url)
    if (!current.loaded || current.origin !== expected.origin || current.path.replace(/\/$/,'') !== expected.pathname.replace(/\/$/,'')) throw Error('SCAN_PAGE_UNAVAILABLE')
    return result as NonNullable<ReturnType<typeof scanResponse>>
  } finally {
    response(); finished(); allowed.clear()
    await Promise.allSettled([...pending])
    try { await cdp.call('Network.disable') } catch {}
  }
}
