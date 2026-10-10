import { randomUUID } from 'node:crypto'
import { createUserMessage, type GenerateOptions } from '@deepseek-ai/dsh-llm'
import { FutureStaffChatAdapter, chatOwnerKey, type ChatCredentials } from './chat.js'
import type { PlatformProtectedSecrets } from './session-vault.js'
import type { PlatformModel } from './contracts.js'

/** Host-only, tenant-authorized inference for product modules. No supplier credentials cross this boundary. */
export interface PlatformInferenceService {
  models(): Promise<readonly PlatformModel[]>
  generateText(input: {
    modelId: string; system: string; text: string; signal?: AbortSignal
  }): Promise<{ text: string; modelId: string; tenantId: string; userId: string }>
}

export function createPlatformInferenceService(options: {
  models: () => Promise<readonly PlatformModel[]>
  authorize: (modelId: string) => Promise<ChatCredentials>
  secrets: PlatformProtectedSecrets
  fetch?: typeof fetch
  origin?: string
}): PlatformInferenceService {
  return Object.freeze({
    models: options.models,
    async generateText(input: Parameters<PlatformInferenceService['generateText']>[0]) {
      if (!/^[0-9a-f-]{36}$/i.test(input.modelId) || !input.system.trim() || !input.text.trim()
        || input.system.length > 16000 || input.text.length > 32000) throw new Error('INFERENCE_INPUT_INVALID')
      input.signal?.throwIfAborted()
      // Resolve identity and model permission in Host for each call, including after tenant switch.
      const credentials = await options.authorize(input.modelId)
      credentials.signal.throwIfAborted()
      if (credentials.modelId !== input.modelId) throw new Error('MODEL_BINDING_MISMATCH')
      const sessionId = `product-analysis-${randomUUID()}`
      const adapter = new FutureStaffChatAdapter(async () => credentials, options.secrets, options.fetch, options.origin)
      const ownerKey = chatOwnerKey(options.origin ?? 'https://dev.fsstory.net', sessionId)
      try {
        let text = '', completed = false
        for await (const chunk of adapter.stream({
          provider: 'futurestaff', model: 'default', sessionId: sessionId as NonNullable<GenerateOptions['sessionId']>, system: input.system,
          messages: [createUserMessage({ content: [{ type: 'text', text: input.text }], source: { kind: 'user' } })],
          tools: [], maxTokens: 4096, ...(input.signal ? { signal: input.signal } : {}),
        })) {
          if (chunk.type === 'block-end') {
            if (chunk.block.type !== 'text') throw new Error('INFERENCE_NON_TEXT_OUTPUT')
            text += chunk.block.text
            if (text.length > 32000) throw new Error('INFERENCE_OUTPUT_LIMIT')
          }
          if (chunk.type === 'finish') completed = chunk.reason.kind === 'stop'
        }
        credentials.signal.throwIfAborted(); input.signal?.throwIfAborted()
        if (!completed || !text.trim()) throw new Error('INFERENCE_INCOMPLETE')
        return { text, modelId: credentials.modelId, tenantId: credentials.tenantId, userId: credentials.userId }
      } finally {
        adapter.dispose()
        // Standalone classification has no durable chat history; retain no per-comment transcript binding.
        await options.secrets.delete(ownerKey)
      }
    },
  })
}
