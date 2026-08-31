import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'

import {
  CODEX_USAGE_RUNNER_CAPABILITY,
  INITIAL_RUNNER_CAPABILITY,
  SUPPORTED_RUNNER_CAPABILITIES,
  parseRunnerRegistration,
  type RunnerBinding,
} from '@futurestaff/local-runner-protocol'
import { LocalRunnerRouter, RunnerRouterError, type RunnerChannel, type RunnerDispatch } from '@futurestaff/local-runner-router'
import WebSocket, { WebSocketServer, type RawData } from 'ws'

import { EnrollmentError, type EnrollmentService } from './enrollment.js'

export interface GatewayBinding extends RunnerBinding { readonly tokenSha256: string }
export interface GatewayConfig { readonly bindings: readonly GatewayBinding[] }
export interface GatewayLogEvent {
  readonly level: 'info' | 'warn' | 'error'
  readonly event: string
  readonly requestId: string
  readonly runnerId?: string
  readonly reason?: string
  readonly durationMs?: number
}

type GatewayOptions = GatewayConfig & {
  readonly host?: string
  readonly port?: number
  readonly path?: string
  readonly dispatchToken?: string
  readonly enrollment?: EnrollmentService
  readonly publicRunnerUrl?: string
  readonly log?: (event: GatewayLogEvent) => void
}

function bearerMatches(request: IncomingMessage, expectedToken: string): boolean {
  const header = request.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false
  const provided = header.slice(7)
  if (provided.length < 32 || provided.length > 512) return false
  return timingSafeEqual(createHash('sha256').update(provided).digest(), createHash('sha256').update(expectedToken).digest())
}

async function jsonBody(request: IncomingMessage): Promise<unknown> {
  let size = 0
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 4_096) throw new Error('request body is too large')
    chunks.push(buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

function systemInfo(value: unknown): Record<string, string> {
  const input = object(value, 'system info result')
  const output: Record<string, string> = {}
  for (const field of ['platform', 'arch', 'release', 'hostname']) output[field] = id(input[field], field)
  return Object.freeze(output)
}

function codexUsage(value: unknown): Record<string, unknown> {
  const input = object(value, 'codex usage result')
  if (input.source !== 'codex-app-server') throw new Error('codex usage source is invalid')
  if (typeof input.fetchedAt !== 'string' || input.fetchedAt.trim() === '') throw new Error('codex usage fetchedAt is invalid')
  const usage = object(input.usage, 'codex usage payload')
  return Object.freeze({ source: 'codex-app-server', fetchedAt: input.fetchedAt, usage: Object.freeze({ ...usage }) })
}

function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`)
  return value as Record<string, unknown>
}

function id(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) throw new Error(`${name} is invalid`)
  return value.trim()
}

export function parseGatewayConfig(value: unknown): GatewayConfig {
  const input = object(value, 'gateway config')
  if (!Array.isArray(input.bindings) || input.bindings.length === 0) throw new Error('bindings must be a non-empty array')
  const runnerIds = new Set<string>()
  const digests = new Set<string>()
  const bindings = input.bindings.map((raw, index) => {
    const binding = object(raw, `bindings[${index}]`)
    const runnerId = id(binding.runnerId, 'runnerId')
    const tokenSha256 = id(binding.tokenSha256, 'tokenSha256')
    if (!/^[a-f0-9]{64}$/.test(tokenSha256)) throw new Error('tokenSha256 must be 64 lowercase hex characters')
    if (runnerIds.has(runnerId) || digests.has(tokenSha256)) throw new Error('Runner IDs and token digests must be unique')
    runnerIds.add(runnerId)
    digests.add(tokenSha256)
    if (!Array.isArray(binding.capabilities) || binding.capabilities.length === 0) throw new Error('capabilities must be non-empty')
    const capabilities = binding.capabilities.map((capability, capabilityIndex) => id(capability, `capabilities[${capabilityIndex}]`))
    if (capabilities.some(capability => !(SUPPORTED_RUNNER_CAPABILITIES as readonly string[]).includes(capability))) throw new Error('unsupported capability')
    return Object.freeze({
      tenantId: id(binding.tenantId, 'tenantId'), userId: id(binding.userId, 'userId'),
      runnerId, deviceId: id(binding.deviceId, 'deviceId'),
      capabilities: Object.freeze(capabilities), tokenSha256,
    })
  })
  return Object.freeze({ bindings: Object.freeze(bindings) })
}

function authenticate(request: IncomingMessage, bindings: readonly GatewayBinding[]): GatewayBinding | undefined {
  const header = request.headers.authorization
  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return undefined
  const token = header.slice(7)
  if (token.length < 32 || token.length > 512) return undefined
  const actual = createHash('sha256').update(token).digest()
  let match: GatewayBinding | undefined
  for (const binding of bindings) {
    const expected = Buffer.from(binding.tokenSha256, 'hex')
    if (timingSafeEqual(actual, expected)) match = binding
  }
  return match
}

function rejectUpgrade(socket: import('node:stream').Duplex, status: 401 | 404): void {
  const label = status === 401 ? 'Unauthorized' : 'Not Found'
  socket.write(`HTTP/1.1 ${status} ${label}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
  socket.destroy()
}

export async function startRunnerGateway(options: GatewayOptions) {
  const config = parseGatewayConfig({ bindings: options.bindings })
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? 3090
  const path = options.path ?? '/runner/v1/connect'
  const dispatchToken = options.dispatchToken
  if (dispatchToken !== undefined && (dispatchToken.length < 32 || dispatchToken.length > 512)) throw new Error('dispatch token is invalid')
  const enrollment = options.enrollment
  const publicRunnerUrl = options.publicRunnerUrl
  if ((enrollment === undefined) !== (publicRunnerUrl === undefined)) throw new Error('enrollment and publicRunnerUrl must be configured together')
  if (publicRunnerUrl !== undefined) {
    const parsed = new URL(publicRunnerUrl)
    if (parsed.protocol !== 'wss:' || parsed.pathname !== path || parsed.search || parsed.hash
      || parsed.username || parsed.password) throw new Error('publicRunnerUrl is invalid')
  }
  const emit = options.log ?? (event => process.stdout.write(`${JSON.stringify(event)}\n`))
  const bindings = [...parseGatewayConfig({ bindings: [...config.bindings, ...(enrollment?.bindings ?? [])] }).bindings]
  const router = new LocalRunnerRouter({ bindings })
  let enrollmentWindowStartedAt = Date.now()
  let enrollmentAttempts = 0
  const dispatch = async (request: RunnerDispatch, requestId: string = randomUUID()) => {
    const startedAt = Date.now()
    try {
      const result = await router.dispatch(request)
      emit({ level: 'info', event: 'runner_job_completed', requestId, runnerId: request.runnerId, reason: 'succeeded', durationMs: Date.now() - startedAt })
      return result
    } catch (error) {
      emit({
        level: 'warn', event: 'runner_job_completed', requestId, runnerId: request.runnerId,
        reason: error instanceof Error && 'code' in error ? String(error.code) : 'failed', durationMs: Date.now() - startedAt,
      })
      throw error
    }
  }
  const sockets = new Set<WebSocket>()
  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}')
      return
    }
    if (request.method === 'POST' && ['/internal/v1/system-info', '/internal/v1/codex-usage'].includes(request.url ?? '') && dispatchToken) {
      void (async () => {
        const incomingRequestId = request.headers['x-request-id']
        const requestId = typeof incomingRequestId === 'string' && /^[A-Za-z0-9._-]{1,100}$/.test(incomingRequestId)
          ? incomingRequestId : randomUUID()
        response.setHeader('x-request-id', requestId)
        const startedAt = Date.now()
        let outcome = 'failed'
        try {
          if (!bearerMatches(request, dispatchToken)) {
            outcome = 'unauthorized'
            response.writeHead(401, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized', retryable: false } }))
            return
          }
          if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new Error('content type must be JSON')
          const body = object(await jsonBody(request), 'request body')
          if (Object.keys(body).length !== 1) throw new Error('request body has unknown fields')
          const runnerId = id(body.runnerId, 'runnerId')
          const isCodexUsage = request.url === '/internal/v1/codex-usage'
          const raw = await dispatch({
            runnerId,
            toolName: isCodexUsage ? CODEX_USAGE_RUNNER_CAPABILITY : INITIAL_RUNNER_CAPABILITY,
            arguments: {},
          }, requestId)
          const data = isCodexUsage ? codexUsage(raw) : systemInfo(raw)
          outcome = 'succeeded'
          response.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data }))
        } catch (error) {
          if (response.headersSent) return
          if (error instanceof RunnerRouterError) {
            const timeout = error.code === 'JOB_TIMEOUT'
            const unavailable = ['RUNNER_OFFLINE', 'RUNNER_STALE', 'RUNNER_NOT_CONFIGURED', 'CONNECTION_CLOSED'].includes(error.code)
            const status = timeout ? 504 : unavailable ? 503 : 500
            const code = timeout ? 'RUNNER_TIMEOUT' : unavailable ? error.code : 'INTERNAL'
            outcome = code
            response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({
              error: { code, message: timeout ? 'Runner timed out' : unavailable ? 'Runner is unavailable' : 'Internal dispatch error', retryable: timeout || unavailable },
            }))
          } else {
            outcome = 'invalid_request'
            response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: { code: 'INVALID_REQUEST', message: 'Invalid request', retryable: false } }))
          }
        } finally {
          emit({ level: outcome === 'succeeded' ? 'info' : 'warn', event: 'internal_dispatch_completed', requestId, reason: outcome, durationMs: Date.now() - startedAt })
        }
      })()
      return
    }
    if (request.method === 'POST' && request.url === '/runner/v1/enroll' && enrollment && publicRunnerUrl) {
      void (async () => {
        const requestId = randomUUID()
        const startedAt = Date.now()
        response.setHeader('x-request-id', requestId)
        response.setHeader('cache-control', 'no-store')
        let outcome = 'failed'
        try {
          if (Date.now() - enrollmentWindowStartedAt >= 60_000) {
            enrollmentWindowStartedAt = Date.now()
            enrollmentAttempts = 0
          }
          enrollmentAttempts += 1
          if (enrollmentAttempts > 30) {
            outcome = 'RATE_LIMITED'
            response.writeHead(429, { 'content-type': 'application/json', 'retry-after': '60' }).end(JSON.stringify({
              error: { code: 'RATE_LIMITED', message: 'Too many enrollment attempts', retryable: true },
            }))
            return
          }
          if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) throw new Error('content type must be JSON')
          const body = object(await jsonBody(request), 'request body')
          if (Object.keys(body).length !== 2) throw new Error('request body has unknown fields')
          const enrolled = await enrollment.redeem(id(body.code, 'code'), id(body.deviceName, 'deviceName'))
          router.addBinding(enrolled.binding)
          bindings.push(enrolled.binding)
          outcome = 'succeeded'
          response.writeHead(201, { 'content-type': 'application/json' }).end(JSON.stringify({ data: {
            url: publicRunnerUrl, token: enrolled.token,
            tenantId: enrolled.binding.tenantId, userId: enrolled.binding.userId,
            runnerId: enrolled.binding.runnerId, deviceId: enrolled.binding.deviceId,
          } }))
        } catch (error) {
          if (error instanceof EnrollmentError) {
            outcome = error.code
            const status = error.code === 'CODE_CONSUMED' || error.code === 'STATE_CONFLICT' ? 409 : 400
            response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify({
              error: { code: error.code, message: 'Enrollment failed', retryable: false },
            }))
          } else {
            outcome = 'INVALID_REQUEST'
            response.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({
              error: { code: 'INVALID_REQUEST', message: 'Invalid request', retryable: false },
            }))
          }
        } finally {
          emit({
            level: outcome === 'succeeded' ? 'info' : 'warn', event: 'runner_enrollment_completed',
            requestId, reason: outcome, durationMs: Date.now() - startedAt,
          })
        }
      })()
      return
    }
    response.writeHead(404).end()
  })
  const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024, perMessageDeflate: false })
  const alive = new WeakSet<WebSocket>()

  const acceptSocket = (socket: WebSocket, context: { binding: GatewayBinding; requestId: string }) => {
    sockets.add(socket)
    alive.add(socket)
    let connection: ReturnType<LocalRunnerRouter['attach']> | undefined
    let registered = false
    const channel: RunnerChannel = { send: job => socket.send(JSON.stringify(job)) }
    socket.on('message', (data: RawData) => {
      try {
        const message: unknown = JSON.parse(data.toString())
        if (!registered) {
          const registration = parseRunnerRegistration(message)
          const exactCapabilities = context.binding.capabilities.length === registration.capabilities.length
            && context.binding.capabilities.every(capability => registration.capabilities.includes(capability))
          if (registration.runnerId !== context.binding.runnerId
            || registration.deviceId !== context.binding.deviceId
            || !exactCapabilities) throw new Error('registration does not match authenticated device')
          connection = router.attach(registration, channel)
          registered = true
          emit({ level: 'info', event: 'runner_connected', requestId: context.requestId, runnerId: context.binding.runnerId })
          return
        }
        const envelope = object(message, 'Runner message')
        if (envelope.kind === 'runner.heartbeat') connection?.heartbeat(message)
        else if (envelope.kind === 'runner.job-result') connection?.complete(message)
        else throw new Error('unexpected Runner message kind')
      } catch {
        emit({ level: 'warn', event: 'runner_protocol_rejected', requestId: context.requestId, runnerId: context.binding.runnerId })
        socket.close(registered ? 4400 : 4403, registered ? 'protocol rejected' : 'registration rejected')
      }
    })
    socket.on('close', () => {
      sockets.delete(socket)
      connection?.disconnect()
      if (registered) emit({ level: 'info', event: 'runner_disconnected', requestId: context.requestId, runnerId: context.binding.runnerId })
    })
    socket.on('error', () => {
      emit({ level: 'warn', event: 'runner_socket_error', requestId: context.requestId, runnerId: context.binding.runnerId })
    })
    socket.on('pong', () => alive.add(socket))
  }

  const livenessTimer = setInterval(() => {
    for (const socket of sockets) {
      if (!alive.has(socket)) socket.terminate()
      else {
        alive.delete(socket)
        socket.ping()
      }
    }
  }, 15_000)
  livenessTimer.unref()

  server.on('upgrade', (request, socket, head) => {
    const requestId = randomUUID()
    const pathname = new URL(request.url ?? '/', 'http://runner.invalid').pathname
    if (pathname !== path) {
      emit({ level: 'warn', event: 'runner_upgrade_rejected', requestId, reason: 'path' })
      rejectUpgrade(socket, 404)
      return
    }
    const binding = authenticate(request, bindings)
    if (!binding) {
      emit({ level: 'warn', event: 'runner_upgrade_rejected', requestId, reason: 'credentials' })
      rejectUpgrade(socket, 401)
      return
    }
    websocketServer.handleUpgrade(request, socket, head, websocket => acceptSocket(websocket, { binding, requestId }))
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => { server.off('error', reject); resolve() })
  })
  const address = server.address() as AddressInfo
  return Object.freeze({
    router,
    url: `ws://${host}:${address.port}${path}`,
    httpUrl: `http://${host}:${address.port}/`,
    dispatch,
    close: async () => {
      clearInterval(livenessTimer)
      for (const socket of sockets) socket.terminate()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      websocketServer.close()
    },
  })
}
