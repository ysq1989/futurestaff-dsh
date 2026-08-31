import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

const DEFAULT_TIMEOUT_MS = 10_000
const SENSITIVE_KEY = /(token|secret|cookie|authorization|email|account.?id)/i

type JsonRecord = Record<string, unknown>

function record(value: unknown): JsonRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as JsonRecord : undefined
}

export function sanitizeCodexUsage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeCodexUsage)
  const input = record(value)
  if (!input) return value
  const output: JsonRecord = {}
  for (const [key, nested] of Object.entries(input)) {
    if (!SENSITIVE_KEY.test(key)) output[key] = sanitizeCodexUsage(nested)
  }
  return output
}

export interface CodexUsageSnapshot {
  readonly source: 'codex-app-server'
  readonly fetchedAt: string
  readonly usage: JsonRecord
}

export function normalizeCodexUsageResponse(response: unknown): CodexUsageSnapshot {
  const envelope = record(response)
  if (!envelope) throw new Error('Codex returned an invalid rate-limit response')
  const result = record(envelope.result)
  if (!result) {
    const error = record(envelope.error)
    const message = typeof error?.message === 'string' ? error.message : 'Codex did not return rate-limit data'
    throw new Error(message)
  }
  return Object.freeze({
    source: 'codex-app-server' as const,
    fetchedAt: new Date().toISOString(),
    usage: Object.freeze(sanitizeCodexUsage(result) as JsonRecord),
  })
}

type ReadCodexUsageOptions = {
  readonly command?: string
  readonly timeoutMs?: number
}

export async function readCodexUsage(options: ReadCodexUsageOptions = {}): Promise<CodexUsageSnapshot> {
  const command = options.command ?? process.env.CODEX_BIN ?? 'codex'
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const child = spawn(command, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const lines = createInterface({ input: child.stdout })
  let nextId = 1
  let stderr = ''
  const pending = new Map<number, {
    resolve(value: unknown): void
    reject(error: Error): void
  }>()

  child.stderr.on('data', chunk => {
    if (stderr.length < 8_192) stderr += chunk.toString()
  })
  child.on('error', error => {
    for (const waiter of pending.values()) waiter.reject(error)
    pending.clear()
  })
  lines.on('line', line => {
    let message: unknown
    try { message = JSON.parse(line) } catch { return }
    const envelope = record(message)
    const responseId = envelope?.id
    if (typeof responseId !== 'number' || !Number.isSafeInteger(responseId)) return
    const waiter = pending.get(responseId)
    if (!waiter) return
    pending.delete(responseId)
    waiter.resolve(message)
  })

  const request = (method: string, params: JsonRecord = {}): Promise<unknown> => new Promise((resolve, reject) => {
    const id = nextId++
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error(`Codex app-server request timed out: ${method}`))
    }, timeoutMs)
    timer.unref?.()
    pending.set(id, {
      resolve: value => { clearTimeout(timer); resolve(value) },
      reject: error => { clearTimeout(timer); reject(error) },
    })
    child.stdin.write(`${JSON.stringify({ method, id, params })}\n`)
  })

  try {
    const initialized = record(await request('initialize', {
      clientInfo: { name: 'futurestaff_local_runner', title: 'FutureStaff Local Runner', version: '0.1.0' },
    }))
    const initError = record(initialized?.error)
    if (initError) throw new Error(typeof initError.message === 'string' ? initError.message : 'Codex initialization failed')
    child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`)
    return normalizeCodexUsageResponse(await request('account/rateLimits/read'))
  } catch (error) {
    const nodeError = error as NodeJS.ErrnoException
    if (nodeError?.code === 'ENOENT') throw new Error('Codex CLI was not found. Install Codex or set CODEX_BIN.')
    const detail = stderr.trim()
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`${message}${detail ? `; codex stderr: ${detail.slice(0, 500)}` : ''}`)
  } finally {
    lines.close()
    if (!child.killed) child.kill()
  }
}
