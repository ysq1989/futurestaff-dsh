import { randomUUID } from 'node:crypto'

import {
  localCodexUsageOutputSchema,
  localSystemInfoOutputSchema,
  type LocalCodexUsage,
  type LocalSystemInfo,
} from './schemas.js'

export class LocalRunnerClientError extends Error {
  constructor(readonly code: string, message: string, readonly retryable: boolean) {
    super(message)
    this.name = 'LocalRunnerClientError'
  }
}

export interface LocalRunnerClient {
  getSystemInfo(): Promise<LocalSystemInfo>
  getCodexUsage(): Promise<LocalCodexUsage>
}

type ClientOptions = {
  readonly baseUrl: string
  readonly token: string
  readonly runnerId: string
  readonly timeoutMs?: number
  readonly fetch?: typeof globalThis.fetch
  readonly requestId?: () => string
  readonly log?: (event: Readonly<Record<string, unknown>>) => void
}

export function createHttpLocalRunnerClient(options: ClientOptions): LocalRunnerClient {
  const baseUrl = new URL(options.baseUrl)
  if (!['http:', 'https:'].includes(baseUrl.protocol)) throw new Error('baseUrl must use HTTP or HTTPS')
  if (options.token.trim().length < 32) throw new Error('dispatch token is invalid')
  if (!options.runnerId.trim()) throw new Error('runnerId is required')
  const fetcher = options.fetch ?? globalThis.fetch
  const timeoutMs = options.timeoutMs ?? 30_000

  const request = async <T>(path: string, parse: (value: unknown) => T): Promise<T> => {
    const requestId = options.requestId?.() ?? randomUUID()
    const startedAt = Date.now()
    let outcome = 'failed'
    try {
      const response = await fetcher(new URL(path, baseUrl), {
        method: 'POST', signal: AbortSignal.timeout(timeoutMs),
        headers: { authorization: `Bearer ${options.token}`, 'content-type': 'application/json', 'x-request-id': requestId },
        body: JSON.stringify({ runnerId: options.runnerId }),
      })
      if (!response.ok) {
        const retryable = response.status === 503 || response.status === 504
        throw new LocalRunnerClientError(response.status === 504 ? 'RUNNER_TIMEOUT' : response.status === 503 ? 'RUNNER_UNAVAILABLE' : 'GATEWAY_ERROR', 'Local Runner request failed', retryable)
      }
      const envelope = await response.json() as unknown
      if (typeof envelope !== 'object' || envelope === null || !('data' in envelope)) throw new LocalRunnerClientError('INVALID_RESPONSE', 'Gateway returned an invalid response', false)
      const value = parse((envelope as { data: unknown }).data)
      outcome = 'succeeded'
      return value
    } catch (error) {
      if (error instanceof LocalRunnerClientError) throw error
      const timeout = error instanceof DOMException && error.name === 'TimeoutError'
      throw new LocalRunnerClientError(timeout ? 'RUNNER_TIMEOUT' : 'GATEWAY_UNAVAILABLE', timeout ? 'Local Runner request timed out' : 'Local Runner Gateway is unavailable', true)
    } finally {
      try { options.log?.({ event: 'local_runner_mcp_request_completed', requestId, path, outcome, durationMs: Date.now() - startedAt }) } catch { /* telemetry must not change Tool outcome */ }
    }
  }

  return Object.freeze({
    getSystemInfo: () => request('/internal/v1/system-info', value => {
      const parsed = localSystemInfoOutputSchema.safeParse(value)
      if (!parsed.success) throw new LocalRunnerClientError('INVALID_RESPONSE', 'Gateway returned an invalid response', false)
      return parsed.data
    }),
    getCodexUsage: () => request('/internal/v1/codex-usage', value => {
      const parsed = localCodexUsageOutputSchema.safeParse(value)
      if (!parsed.success) throw new LocalRunnerClientError('INVALID_RESPONSE', 'Gateway returned an invalid Codex usage response', false)
      return parsed.data
    }),
  })
}
