#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'

const DEFAULT_TIMEOUT_MS = 10_000
const SENSITIVE_KEY = /(token|secret|cookie|authorization|email|account.?id)/i

export function sanitizeUsage(value) {
  if (Array.isArray(value)) return value.map(sanitizeUsage)
  if (!value || typeof value !== 'object') return value
  const output = {}
  for (const [key, nested] of Object.entries(value)) {
    if (!SENSITIVE_KEY.test(key)) output[key] = sanitizeUsage(nested)
  }
  return output
}

export function normalizeUsageResponse(response) {
  if (!response || typeof response !== 'object') throw new Error('Codex returned an invalid rate-limit response')
  const result = response.result
  if (!result || typeof result !== 'object') {
    const message = response.error && typeof response.error === 'object' && typeof response.error.message === 'string'
      ? response.error.message
      : 'Codex did not return rate-limit data'
    throw new Error(message)
  }
  return Object.freeze({
    source: 'codex-app-server',
    fetchedAt: new Date().toISOString(),
    usage: sanitizeUsage(result),
  })
}

export async function readCodexUsage({ command = process.env.CODEX_BIN || 'codex', timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const child = spawn(command, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
  const lines = createInterface({ input: child.stdout })
  let nextId = 1
  const pending = new Map()
  let stderr = ''

  child.stderr.on('data', chunk => { if (stderr.length < 8_192) stderr += chunk.toString() })
  lines.on('line', line => {
    let message
    try { message = JSON.parse(line) } catch { return }
    if (message && Number.isSafeInteger(message.id) && pending.has(message.id)) {
      const settle = pending.get(message.id)
      pending.delete(message.id)
      settle.resolve(message)
    }
  })

  const request = (method, params = {}) => new Promise((resolve, reject) => {
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

  const close = () => {
    lines.close()
    if (!child.killed) child.kill()
  }

  try {
    child.once('error', error => {
      for (const waiter of pending.values()) waiter.reject(error)
      pending.clear()
    })
    const initialized = await request('initialize', {
      clientInfo: { name: 'futurestaff_ai_usage', title: 'FutureStaff AI Usage', version: '0.1.0' },
    })
    if (initialized.error) throw new Error(initialized.error.message || 'Codex initialization failed')
    child.stdin.write(`${JSON.stringify({ method: 'initialized', params: {} })}\n`)
    return normalizeUsageResponse(await request('account/rateLimits/read'))
  } catch (error) {
    const detail = stderr.trim()
    if (error && error.code === 'ENOENT') throw new Error('Codex CLI was not found. Install Codex or set CODEX_BIN.')
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail ? `; codex stderr: ${detail.slice(0, 500)}` : ''}`)
  } finally {
    close()
  }
}

async function main() {
  const usage = await readCodexUsage()
  process.stdout.write(`${JSON.stringify(usage, null, 2)}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch(error => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
