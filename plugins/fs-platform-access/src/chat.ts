import { createHash, randomUUID } from 'node:crypto'
import { LlmAdapter, LlmError, ToolCallId } from '@deepseek-ai/dsh-llm'
import type { ContentBlock, GenerateOptions, StreamChunk } from '@deepseek-ai/dsh-llm'
import type { PlatformProtectedSecrets } from './session-vault.js'

export interface ChatCredentials {
  readonly accessToken: string
  readonly userId: string
  readonly tenantId: string
  readonly modelId: string
  readonly signal: AbortSignal
}

const ENDPOINT = 'https://dev.fsstory.net/desktop/v1/chat'
const unavailable = () => new LlmError('平台聊天服务暂时不可用，请检查登录状态或联系管理员。', 'FUTURESTAFF_CHAT')
const invalid = () => new LlmError('平台聊天响应不完整或版本不兼容。', 'FUTURESTAFF_CONTRACT')
const textOnly = (blocks: readonly ContentBlock[]): string => blocks.map(block => {
  if (block.type !== 'text') throw new LlmError('当前平台聊天仅支持文字，请移除图片或其他附件。', 'FUTURESTAFF_TEXT_ONLY')
  return block.text
}).join('\n')

function messages(options: GenerateOptions): unknown[] {
  const result: unknown[] = options.system ? [{ role: 'system', content: options.system }] : []
  for (const message of options.messages) {
    if (message.content.some(block => block.type === 'tool-result')) {
      if (message.role !== 'user' || message.content.length !== 1 || message.content[0]?.type !== 'tool-result') throw invalid()
      const block = message.content[0]
      result.push({ role: 'tool', content: textOnly(block.content), toolCallId: block.toolCallId })
      continue
    }
    const content = textOnly(message.content.filter(block => block.type !== 'tool-call'))
    const toolCalls = message.content.filter(block => block.type === 'tool-call').map(block => ({
      id: block.id, name: block.name, arguments: block.arguments,
    }))
    result.push({ role: message.role, content, ...(toolCalls.length ? { toolCalls } : {}) })
  }
  return result
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Host-only platform transport. No renderer route exposes the bearer credential. */
export class FutureStaffChatAdapter extends LlmAdapter {
  #bindingQueue: Promise<void> = Promise.resolve()
  readonly #lifetime = new AbortController()

  constructor(
    private readonly authorize: () => Promise<ChatCredentials>,
    private readonly secrets: Pick<PlatformProtectedSecrets, 'read' | 'write'>,
    private readonly fetcher: typeof fetch = fetch,
  ) { super() }

  dispose(): void { this.#lifetime.abort() }
  override providerInfo() { return { id: 'futurestaff', name: 'FutureStaff 平台' } }
  override providerRetryPolicy() {
    return { mode: 'normal' as const, maxRetries: 0, retryableCodes: [], initialDelayMs: 0, maxDelayMs: 0, jitterRatio: 0 }
  }
  override async listModels() {
    return [{ provider: 'futurestaff', id: 'default', name: '平台默认模型', inputModalities: ['text'] as const }]
  }
  override async resolveModel(provider: string, model: string) {
    if (provider !== 'futurestaff' || model !== 'default') throw unavailable()
    return { provider, id: model, name: '平台默认模型', inputModalities: ['text'] as const, defaultMaxTokens: 4096 }
  }
  override async prepareCall(provider: string, model: string, signal?: AbortSignal) {
    const metadata = await this.resolveModel(provider, model)
    signal?.throwIfAborted()
    const credentials = await this.#credentials()
    return { model: metadata, stream: (options: GenerateOptions) => this.#stream(options, credentials) }
  }
  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    await this.resolveModel(options.provider, options.model)
    yield* this.#stream(options, await this.#credentials())
  }

  async #credentials(): Promise<ChatCredentials> {
    try { return await this.authorize() } catch {
      throw new LlmError('请在设置 → FutureStaff 检查登录与当前租户的可用模型；如有其他租户，可切换后重试。', 'FUTURESTAFF_AUTH')
    }
  }

  async #bind(options: GenerateOptions, credentials: ChatCredentials): Promise<void> {
    const sessionId = options.sessionId
    if (typeof sessionId !== 'string' || sessionId.length < 1 || sessionId.length > 256) {
      throw new LlmError('请在新建会话中使用平台聊天。', 'FUTURESTAFF_SESSION')
    }
    const key = `futurestaff.chat.owner.${createHash('sha256').update(sessionId).digest('hex')}`
    const owner = JSON.stringify({ userId: credentials.userId, tenantId: credentials.tenantId })
    const bind = async () => {
      credentials.signal.throwIfAborted()
      const existing = await this.secrets.read(key)
      if (existing !== undefined && existing !== owner) {
        throw new LlmError('此会话不属于当前账号或租户，请新建会话。', 'FUTURESTAFF_TENANT')
      }
      if (existing === undefined) {
        if (options.messages.some(message => message.role === 'assistant'
          || message.content.some(block => block.type === 'tool-result'))
          || options.messages.filter(message => message.source.kind === 'user').length > 1) {
          throw new LlmError('旧会话没有平台归属记录，请新建会话。', 'FUTURESTAFF_SESSION')
        }
        await this.secrets.write(key, owner)
      }
    }
    const pending = this.#bindingQueue.then(bind, bind)
    this.#bindingQueue = pending.catch(() => {})
    await pending
  }

  async *#stream(options: GenerateOptions, credentials: ChatCredentials): AsyncIterable<StreamChunk> {
    try { await this.#bind(options, credentials) } catch (error) {
      credentials.signal.throwIfAborted()
      if (error instanceof LlmError) throw error
      throw new LlmError('无法保存此会话的账号归属，请检查本机受保护存储。', 'FUTURESTAFF_STORAGE')
    }
    const body = JSON.stringify({ requestId: randomUUID(), modelId: credentials.modelId,
      messages: messages(options), tools: options.tools ?? [], maxTokens: Math.min(options.maxTokens ?? 4096, 8192) })
    if (Buffer.byteLength(body) > 512 * 1024) throw new LlmError('会话内容过长，请新建会话。', 'FUTURESTAFF_LIMIT')
    const abort = new AbortController()
    const timeout = setTimeout(() => abort.abort(), 130_000)
    timeout.unref()
    const signal = AbortSignal.any([credentials.signal, abort.signal, this.#lifetime.signal,
      ...(options.signal ? [options.signal] : [])])
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      signal.throwIfAborted()
      let response: Response
      try {
        response = await this.fetcher(ENDPOINT, { method: 'POST', redirect: 'error', cache: 'no-store', signal,
          headers: { authorization: `Bearer ${credentials.accessToken}`, 'content-type': 'application/json', accept: 'application/x-ndjson' }, body })
      } catch { signal.throwIfAborted(); throw unavailable() }
      if (!response.ok) {
        await response.body?.cancel()
        if (response.status === 401) throw new LlmError('平台登录已失效，请在设置 → FutureStaff 重新登录。', 'FUTURESTAFF_AUTH')
        if (response.status === 403) throw new LlmError('当前租户无权使用所选模型，请切换租户或联系管理员。', 'FUTURESTAFF_MODEL_ACCESS')
        if (response.status === 429) throw new LlmError('平台聊天请求过于频繁或额度已用尽，请稍后重试。', 'FUTURESTAFF_CHAT_LIMIT')
        throw unavailable()
      }
      if (response.headers.get('x-futurestaff-chat-contract') !== '0.1.0'
        || !response.headers.get('content-type')?.startsWith('application/x-ndjson') || !response.body) {
        await response.body?.cancel(); throw invalid()
      }
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true })
      let buffer = '', total = 0, index = 0
      let started = false
      while (true) {
        signal.throwIfAborted()
        const read = await reader.read()
        if (read.done) break
        total += read.value.byteLength
        if (total > 3 * 1024 * 1024) throw invalid()
        buffer += decoder.decode(read.value, { stream: true })
        if (buffer.length > 2 * 1024 * 1024) throw invalid()
        let newline: number
        while ((newline = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newline)
          buffer = buffer.slice(newline + 1)
          let event: unknown
          try { event = JSON.parse(line) } catch { throw invalid() }
          if (!record(event)) throw invalid()
          if (event.type === 'text') {
            if (Object.keys(event).sort().join(',') !== 'text,type' || typeof event.text !== 'string') throw invalid()
            if (!started) { started = true; yield { type: 'block-start', index, blockType: 'text' } }
            yield { type: 'text-delta', index, text: event.text }
          } else if (event.type === 'error') {
            if (Object.keys(event).sort().join(',') !== 'code,type' || event.code !== 'PROVIDER_UNAVAILABLE') throw invalid()
            throw new LlmError('当前租户的模型服务调用失败，请联系平台管理员检查模型配置与供应商连接。', 'FUTURESTAFF_PROVIDER')
          } else if (event.type === 'result') {
            if (Object.keys(event).sort().join(',') !== 'content,finishReason,toolCalls,type'
              || typeof event.content !== 'string' || !Array.isArray(event.toolCalls)
              || event.toolCalls.length > 64
              || !['stop', 'tool-calls', 'max-tokens'].includes(String(event.finishReason))) throw invalid()
            const offered = new Set(options.tools?.map(tool => tool.name))
            const ids = new Set<string>()
            for (const call of event.toolCalls) {
              if (!record(call) || Object.keys(call).sort().join(',') !== 'arguments,id,name'
                || typeof call.id !== 'string' || !/^[A-Za-z0-9_.:-]{1,200}$/u.test(call.id)
                || ids.has(call.id) || typeof call.name !== 'string' || !offered.has(call.name)
                || typeof call.arguments !== 'string' || call.arguments.length > 65536) throw invalid()
              try { if (!record(JSON.parse(call.arguments))) throw invalid() } catch { throw invalid() }
              ids.add(call.id)
            }
            if ((event.toolCalls.length > 0) !== (event.finishReason === 'tool-calls')) throw invalid()
            if (started || event.content) {
              if (!started) {
                yield { type: 'block-start', index, blockType: 'text' }
                yield { type: 'text-delta', index, text: event.content }
              }
              yield { type: 'block-end', index: index++, block: { type: 'text', text: event.content } }
            }
            for (const call of event.toolCalls as { id: string; name: string; arguments: string }[]) {
              const id = ToolCallId(call.id)
              yield { type: 'block-start', index, blockType: 'tool-call' }
              yield { type: 'tool-call-delta', index, id, name: call.name, argumentsDelta: call.arguments }
              yield { type: 'block-end', index: index++, block: { type: 'tool-call', id, name: call.name, arguments: call.arguments } }
            }
            yield { type: 'finish', reason: { kind: event.finishReason as 'stop' | 'tool-calls' | 'max-tokens' } }
            return
          } else { throw invalid() }
        }
      }
      throw invalid() // EOF without an explicit terminal result is never success.
    } catch (error) {
      signal.throwIfAborted()
      if (error instanceof LlmError) throw error
      throw invalid()
    } finally {
      clearTimeout(timeout)
      await reader?.cancel().catch(() => {})
      reader?.releaseLock()
    }
  }
}
