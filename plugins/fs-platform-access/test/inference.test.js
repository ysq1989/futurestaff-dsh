import assert from 'node:assert/strict'
import test from 'node:test'
import { createPlatformInferenceService } from '../lib/inference.js'

const modelId = '30000000-0000-4000-8000-000000000001'
const otherModelId = '30000000-0000-4000-8000-000000000002'
function setup(options = {}) {
  const cache = new Map(), controller = new AbortController(), calls = []
  const secrets = { available: () => true, has: async k => cache.has(k), read: async k => cache.get(k),
    write: async (k,v) => { cache.set(k,v) }, delete: async k => { cache.delete(k) } }
  const service = createPlatformInferenceService({
    models: async () => [{ modelId, displayName: '所选模型' }, { modelId: otherModelId, displayName: '另一个模型' }],
    authorize: async selected => ({ modelId: selected, userId: 'user-a', tenantId: 'tenant-a', accessToken: 'private-fixture-token', signal: controller.signal }),
    secrets,
    fetch: async (url, init) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ type: 'result', content: '{"classification":"target"}', toolCalls: [], finishReason: 'stop' })+'\n',
        { headers: { 'content-type': 'application/x-ndjson', 'x-futurestaff-chat-contract': '0.1.0' } })
    }, ...options,
  })
  return { service, cache, calls, controller }
}

test('selected model goes through existing Platform transport and returns no credentials', async () => {
  const s = setup()
  const result = await s.service.generateText({ modelId: otherModelId, system: '按规则判断', text: '需要办签证' })
  assert.equal(result.modelId, otherModelId)
  assert.equal(JSON.parse(s.calls[0].init.body).modelId, otherModelId)
  assert.equal(s.calls[0].url, 'https://dev.fsstory.net/desktop/v1/chat')
  assert.equal(s.calls[0].init.headers.authorization, 'Bearer private-fixture-token')
  assert.doesNotMatch(JSON.stringify(result), /private-fixture-token/)
  assert.equal(s.cache.size, 0)
})

test('Host authorization denial cannot reach inference transport', async () => {
  const s = setup({ authorize: async () => { throw new Error('MODEL_NOT_AUTHORIZED') } })
  await assert.rejects(s.service.generateText({ modelId, system: '规则', text: '评论' }), /MODEL_NOT_AUTHORIZED/)
  assert.equal(s.calls.length, 0)
})

test('tenant cancellation and mismatched model binding reject before a request', async () => {
  const s = setup(); s.controller.abort()
  await assert.rejects(s.service.generateText({ modelId, system: '规则', text: '评论' }))
  assert.equal(s.calls.length, 0)
  const mismatch = setup({ authorize: async () => ({ modelId: otherModelId, userId: 'u', tenantId: 't', accessToken: 'private', signal: new AbortController().signal }) })
  await assert.rejects(mismatch.service.generateText({ modelId, system: '规则', text: '评论' }), /MODEL_BINDING_MISMATCH/)
  assert.equal(mismatch.calls.length, 0)
})

test('partial output and oversized inputs are rejected, temporary ownership is removed', async () => {
  const s = setup({ fetch: async () => new Response(JSON.stringify({ type: 'result', content: 'partial', toolCalls: [], finishReason: 'max-tokens' })+'\n',
    { headers: { 'content-type': 'application/x-ndjson', 'x-futurestaff-chat-contract': '0.1.0' } }) })
  await assert.rejects(s.service.generateText({ modelId, system: '规则', text: '评论' }), /INFERENCE_INCOMPLETE/)
  assert.equal(s.cache.size, 0)
  await assert.rejects(s.service.generateText({ modelId, system: '规则', text: 'x'.repeat(32001) }), /INFERENCE_INPUT_INVALID/)
})


test('production module inference stays on PROD and cleans its environment-scoped transient binding', async () => {
  const s = setup({ origin: 'https://platform.fsstory.net' })
  await s.service.generateText({ modelId, system: '规则', text: '评论' })
  assert.equal(s.calls[0].url, 'https://platform.fsstory.net/desktop/v1/chat')
  assert.equal(s.cache.size, 0)
})
