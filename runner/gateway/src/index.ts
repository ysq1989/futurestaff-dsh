import { createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'

import { parseRunnerRegistration, type RunnerBinding } from '@futurestaff/local-runner-protocol'
import { LocalRunnerRouter, type RunnerChannel } from '@futurestaff/local-runner-router'
import WebSocket, { WebSocketServer, type RawData } from 'ws'

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
  readonly log?: (event: GatewayLogEvent) => void
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
    if (capabilities.some(capability => capability !== 'local.system_info')) throw new Error('unsupported capability')
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
  const emit = options.log ?? (event => process.stdout.write(`${JSON.stringify(event)}\n`))
  const router = new LocalRunnerRouter({ bindings: config.bindings })
  const sockets = new Set<WebSocket>()
  const server = createServer((request, response) => {
    if (request.url === '/healthz') {
      response.writeHead(200, { 'content-type': 'application/json' }).end('{"status":"ok"}')
    } else response.writeHead(404).end()
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
    const binding = authenticate(request, config.bindings)
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
    dispatch: async (request: Parameters<LocalRunnerRouter['dispatch']>[0]) => {
      const requestId = randomUUID()
      const startedAt = Date.now()
      try {
        const result = await router.dispatch(request)
        emit({
          level: 'info', event: 'runner_job_completed', requestId,
          runnerId: request.runnerId, reason: 'succeeded', durationMs: Date.now() - startedAt,
        })
        return result
      } catch (error) {
        emit({
          level: 'warn', event: 'runner_job_completed', requestId,
          runnerId: request.runnerId,
          reason: error instanceof Error && 'code' in error ? String(error.code) : 'failed',
          durationMs: Date.now() - startedAt,
        })
        throw error
      }
    },
    close: async () => {
      clearInterval(livenessTimer)
      for (const socket of sockets) socket.terminate()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
      websocketServer.close()
    },
  })
}
