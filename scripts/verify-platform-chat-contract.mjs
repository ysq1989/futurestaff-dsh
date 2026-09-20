/** Offline cross-repository contract consumer: stdin is the FastAPI test response. */
import assert from 'node:assert/strict'
import { FutureStaffChatAdapter } from '../plugins/fs-platform-access/lib/chat.js'

const input = []
for await (const chunk of process.stdin) input.push(chunk)
const envelope = JSON.parse(Buffer.concat(input).toString('utf8'))
const store = new Map()
const adapter = new FutureStaffChatAdapter(async () => ({
  accessToken: 'offline-test-token-not-a-credential', userId: 'offline-user', tenantId: 'offline-tenant',
  modelId: '10000000-0000-4000-8000-000000000001', signal: new AbortController().signal,
}), {
  read: async key => store.get(key), write: async (key, value) => { store.set(key, value) },
}, async () => new Response(envelope.body, { status: envelope.status, headers: envelope.headers }))
const chunks = []
for await (const chunk of adapter.stream({
  provider: 'futurestaff', model: 'default', sessionId: 'offline-cross-repository',
  messages: [{ id: 'm1', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] }],
})) chunks.push(chunk)
assert.equal(chunks.at(-1).reason.kind, 'stop')
assert.equal(chunks.find(chunk => chunk.type === 'block-end').block.text, '你好')
console.log('Python Platform → TypeScript DSH stream contract passed (offline).')
