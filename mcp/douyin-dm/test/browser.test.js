import assert from 'node:assert/strict'
import test from 'node:test'
import { loopback, BrowserAdapter, Cdp } from '../lib/browser.js'

test('CDP URL allowlist rejects remote hosts, alternate protocols and credentials', () => {
  assert.equal(loopback('http://127.0.0.1:9222', ['http:']).hostname, '127.0.0.1')
  for (const url of ['http://example.com:9222', 'http://127.0.0.1.evil.test:9222', 'file:///C:/secret', 'http://user:pass@127.0.0.1:9222', 'http://127.0.0.1:9222?x=1'])
    assert.throws(() => loopback(url, ['http:']), /CDP_LOOPBACK_ONLY/)
})

test('fixed browser targets refuse another origin before connecting to its debugger', async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => Response.json([{ id: 'inbox', type: 'page', url: 'https://evil.test', webSocketDebuggerUrl: 'ws://127.0.0.1:9222/devtools/page/inbox' }])
  try {
    const adapter = new BrowserAdapter({ endpoint: 'http://127.0.0.1:9222', inboxTargetId: 'inbox', senderTargetId: 'sender', accountId: 'account_123', selectors: {} })
    await assert.rejects(adapter.check(), /DOUYIN_TAB_REQUIRED/)
  } finally { globalThis.fetch = original }
})

class Socket extends EventTarget {
  sent = []
  send(value) { this.sent.push(JSON.parse(value)) }
  close() { this.dispatchEvent(new Event('close')) }
  respond(data) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(data) })) }
}

test('CDP observers receive events independently of commands and are revoked on close', async () => {
  const socket=new Socket(),cdp=new Cdp(socket),events=[]
  const off=cdp.on('Network.responseReceived', event=>events.push(event))
  cdp.on('Network.responseReceived',()=>{throw Error('observer failed')})
  const pending=cdp.call('Page.enable')
  socket.respond({method:'Network.responseReceived',params:{requestId:'one'}})
  socket.respond({id:socket.sent[0].id,result:{enabled:true}})
  assert.deepEqual(await pending,{enabled:true});assert.deepEqual(events,[{requestId:'one'}])
  off();socket.respond({method:'Network.responseReceived',params:{requestId:'two'}})
  assert.equal(events.length,1);cdp.close()
  assert.equal(cdp.listeners.size,0)
})

test('CDP correlates responses and rejects disconnects without logging page data', async () => {
  const socket = new Socket(), cdp = new Cdp(socket)
  const first = cdp.call('Runtime.enable'), second = cdp.call('Page.enable')
  socket.respond({ id: socket.sent[1].id, result: { second: true } })
  socket.respond({ id: socket.sent[0].id, result: { first: true } })
  assert.deepEqual(await first, { first: true }); assert.deepEqual(await second, { second: true })
  const pending = cdp.call('Runtime.evaluate'); cdp.close()
  await assert.rejects(pending, /CDP_DISCONNECTED/)
})

test('CDP serializes message data as JSON and rejects page exceptions', async () => {
  const socket = new Socket(), cdp = new Cdp(socket)
  const text = "');window.evil=true;//\n价格"
  const result = cdp.evaluate(args => args.text, { text })
  const expression = socket.sent[0].params.expression
  const { runInNewContext } = await import('node:vm')
  const context = { window: {} }
  assert.equal(runInNewContext(expression, context), text); assert.equal(context.window.evil, undefined)
  socket.respond({ id: socket.sent[0].id, result: { result: { value: text } } })
  assert.equal(await result, text)
  const broken = cdp.evaluate(() => true, null)
  socket.respond({ id: socket.sent[1].id, result: { exceptionDetails: {} } })
  await assert.rejects(broken, /DOM_CHECK_FAILED/); cdp.close()
})
