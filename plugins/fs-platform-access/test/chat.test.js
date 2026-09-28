import assert from 'node:assert/strict'
import test from 'node:test'
import { FutureStaffChatAdapter } from '../lib/chat.js'
import { apply as applyDefault } from '../lib/model-default.js'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as hostPlugin from '../lib/plugin.js'

const credentials = () => ({ userId: 'user-a', tenantId: 'tenant-a', modelId: '10000000-0000-4000-8000-000000000001',
  accessToken: 'host-only-private-token', signal: new AbortController().signal })
const options = () => ({ provider: 'futurestaff', model: 'default', sessionId: 'session-a',
  messages: [{ role: 'user', content: [{ type: 'text', text: '你好' }], source: { kind: 'user' }, id: 'message-a' }] })
const collect = async stream => { const chunks = []; for await (const chunk of stream) chunks.push(chunk); return chunks }
const response = (events, headers = {}) => new Response(events.map(event => JSON.stringify(event) + '\n').join(''), {
  headers: { 'content-type': 'application/x-ndjson', 'x-futurestaff-chat-contract': '0.1.0', ...headers },
})
const done = { type: 'result', content: '您好', toolCalls: [], finishReason: 'stop' }
function setup(fetcher = async () => response([{ type: 'text', text: '您好' }, done])) {
  const data = new Map()
  const secrets = { read: async key => data.get(key), write: async (key, value) => { data.set(key, value) } }
  let session = credentials()
  const adapter = new FutureStaffChatAdapter(async () => session, secrets, fetcher)
  return { adapter, secrets, session, setSession: value => { session = value } }
}

test('Host streams into DSH blocks with fixed endpoint and Host-only authentication', async () => {
  const bench = setup(async (url, init) => {
    assert.equal(url, 'https://dev.fsstory.net/desktop/v1/chat')
    assert.equal(init.headers.authorization, 'Bearer host-only-private-token')
    assert.equal(init.redirect, 'error')
    const body = JSON.parse(init.body)
    assert.equal(body.modelId, credentials().modelId)
    assert.equal(body.messages[0].content, '你好')
    assert.doesNotMatch(init.body, /host-only|tenant-a|user-a|apiKey|baseUrl/)
    return response([{ type: 'text', text: '您好' }, done])
  })
  const chunks = await collect(bench.adapter.stream(options()))
  assert.equal(chunks[0].type, 'block-start')
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(chunks.find(chunk => chunk.type === 'block-end').block.text, '您好')
  assert.doesNotMatch(JSON.stringify(chunks), /host-only/)
})

test('persistent session ownership prevents sending tenant A history under tenant B after restart', async () => {
  const bench = setup()
  await collect(bench.adapter.stream(options()))
  const foreign = new FutureStaffChatAdapter(async () => ({ ...credentials(), tenantId: 'tenant-b' }),
    bench.secrets, () => { throw new Error('must not call') })
  await assert.rejects(() => collect(foreign.stream(options())), /当前账号或租户/)
})

test('unbound legacy assistant history is not automatically adopted', async () => {
  const bench = setup(() => { throw new Error('must not call') })
  const request = options()
  request.messages.push({ ...request.messages[0], role: 'assistant' })
  await assert.rejects(() => collect(bench.adapter.stream(request)), /新建会话/)
})

test('truncated, wrong-version and unsafe response data fail closed without reflecting payloads', async () => {
  for (const fetcher of [
    async () => response([{ type: 'text', text: 'partial' }]),
    async () => response([done], { 'x-futurestaff-chat-contract': '999' }),
    async () => response([{ ...done, privateKey: 'must-not-escape' }]),
    async () => new Response('private-provider-details', { status: 500 }),
  ]) {
    const bench = setup(fetcher)
    await assert.rejects(() => collect(bench.adapter.stream(options())), error => {
      assert.doesNotMatch(error.message, /private-provider|must-not-escape/)
      return true
    })
  }
})

test('managed chat distinguishes tenant model access and provider failures without reflecting server details', async () => {
  for (const [status, code, message] of [
    [403, 'FUTURESTAFF_MODEL_ACCESS', /切换租户/],
    [429, 'FUTURESTAFF_CHAT_LIMIT', /额度/],
  ]) {
    const bench = setup(async () => new Response('private provider detail', { status }))
    await assert.rejects(() => collect(bench.adapter.stream(options())), error => {
      assert.equal(error.code, code)
      assert.match(error.message, message)
      assert.doesNotMatch(error.message, /private provider detail/)
      return true
    })
  }
  const provider = setup(async () => response([{ type: 'error', code: 'PROVIDER_UNAVAILABLE' }]))
  await assert.rejects(() => collect(provider.adapter.stream(options())), error => {
    assert.equal(error.code, 'FUTURESTAFF_PROVIDER')
    assert.match(error.message, /供应商连接/)
    return true
  })
})

test('missing current-tenant model gives a tenant-switch instruction before any HTTP call', async () => {
  let requests = 0
  const adapter = new FutureStaffChatAdapter(async () => { throw new Error('private model inventory') },
    { read: async () => undefined, write: async () => {} }, async () => { requests++; throw new Error('unexpected') })
  await assert.rejects(() => collect(adapter.stream(options())), error => {
    assert.equal(error.code, 'FUTURESTAFF_AUTH')
    assert.match(error.message, /当前租户的可用模型/)
    assert.doesNotMatch(error.message, /private model inventory/)
    return true
  })
  assert.equal(requests, 0)
})

test('switch/logout signal cancels the HTTP model request', async () => {
  const abort = new AbortController()
  let began
  const started = new Promise(resolve => { began = resolve })
  const bench = setup(async (_url, init) => {
    began()
    return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)))
  })
  bench.setSession({ ...credentials(), signal: abort.signal })
  const pending = collect(bench.adapter.stream(options()))
  await started
  abort.abort()
  await assert.rejects(pending)
})

test('tool proposal and matching result are projected without executing tools', async () => {
  const bench = setup(async () => response([{ ...done, content: '', finishReason: 'tool-calls',
    toolCalls: [{ id: 'call1', name: 'read_file', arguments: '{}' }] }]))
  const chunks = await collect(bench.adapter.stream({ ...options(), tools: [{ name: 'read_file', description: '', parameters: {} }] }))
  assert.equal(chunks.find(chunk => chunk.type === 'tool-call-delta').name, 'read_file')
  assert.equal(chunks.at(-1).reason.kind, 'tool-calls')
})

test('managed default ignores upstream settings and refuses local model overrides', async () => {
  let service
  applyDefault({ provide: (name, value) => { assert.equal(name, 'agentDefaultModel'); service = value } })
  assert.deepEqual(service.currentSelection(), { provider: 'futurestaff', model: 'default' })
  await assert.rejects(() => service.saveSelection({ provider: 'other', model: 'key-based' }), /平台管理/)
})

test('unoffered tools and unavailable protected storage cannot leak details or execute', async () => {
  const bench = setup(async () => response([{ ...done, finishReason: 'tool-calls',
    toolCalls: [{ id: 'call1', name: 'dangerous', arguments: '{}' }] }]))
  await assert.rejects(() => collect(bench.adapter.stream(options())))
  bench.secrets.read = async () => { throw new Error('private-store-path') }
  await assert.rejects(() => collect(bench.adapter.stream(options())), error => !error.message.includes('private-store'))
})

test('tool history preserves call/result correlation and rejects unsupported attachments', async () => {
  const bench = setup(async (_url, init) => {
    const body = JSON.parse(init.body)
    if (body.messages.length > 1) {
      assert.equal(body.messages[1].toolCalls[0].id, 'call1')
      assert.equal(body.messages[2].role, 'tool')
      assert.equal(body.messages[2].toolCallId, 'call1')
    }
    return response([done])
  })
  await collect(bench.adapter.stream(options()))
  const request = options()
  request.messages.push({ role: 'assistant', content: [{ type: 'tool-call', id: 'call1', name: 'read_file', arguments: '{}' }], source: { kind: 'model' } })
  request.messages.push({ role: 'user', content: [{ type: 'tool-result', toolCallId: 'call1', content: [{ type: 'text', text: 'result' }] }], source: { kind: 'tool' } })
  await collect(bench.adapter.stream(request))
  request.messages[0].content.push({ type: 'image', attachment: {} })
  await assert.rejects(() => collect(bench.adapter.stream(request)), /仅支持文字/)
})

test('real Cordis Host composition installs one managed route and releases it on disposal', async t => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  ctx.provide('webServer', { register: () => () => {} })
  ctx.provide('desktopProtectedSecrets', {
    available: async () => true, has: async () => false, read: async () => undefined,
    write: async () => {}, delete: async () => {},
  })
  await ctx.plugin(LlmRuntime)
  const fiber = await ctx.plugin(hostPlugin)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(ctx.agentDefaultModel.currentSelection(), { provider: 'futurestaff', model: 'default' })
  assert.deepEqual(ctx.llm.listProviders(), [{ id: 'futurestaff', name: 'FutureStaff 平台' }])
  const chunks = await collect(ctx.llm.stream(options()))
  assert.equal(chunks.at(-1).reason.kind, 'error')
  assert.match(chunks.at(-1).reason.failure.message, /登录/)
  await fiber.dispose()
  assert.deepEqual(ctx.llm.listProviders(), [])
})

test('real DSH LLM runtime accepts the managed adapter successful stream', async t => {
  const ctx = new Context()
  t.after(() => ctx.fiber.dispose())
  await ctx.plugin(LlmRuntime)
  ctx.llm.registerAdapter(['futurestaff'], setup().adapter)
  const chunks = await collect(ctx.llm.stream({ ...options(), messages: [createUserMessage({
    content: [{ type: 'text', text: 'hello' }], source: { kind: 'user' },
  })] }))
  assert.equal(chunks.at(-1).reason.kind, 'stop')
  assert.equal(chunks.find(chunk => chunk.type === 'block-end').block.text, '您好')
})

test('prepared calls retain the original auth generation instead of adopting a new tenant', async () => {
  let requests = 0
  const bench = setup(async () => { requests++; return response([done]) })
  const abort = new AbortController()
  bench.setSession({ ...credentials(), signal: abort.signal })
  const prepared = await bench.adapter.prepareCall('futurestaff', 'default')
  abort.abort()
  bench.setSession({ ...credentials(), tenantId: 'tenant-b' })
  await assert.rejects(() => collect(prepared.stream(options())))
  assert.equal(requests, 0)
})
