import { arch, hostname, platform, release } from 'node:os'

import {
  RunnerReplayGuard,
  authorizeRunnerJob,
  type RunnerBinding,
  type RunnerJob,
  type RunnerJobResult,
} from '@futurestaff/local-runner-protocol'
import WebSocket from 'ws'

export { enrollRunner, loadInstalledRunnerConfig } from './enrollment.js'

export interface RunnerClientDescription { readonly url: string; readonly runnerId: string; readonly deviceId: string }
export interface RunnerClientConfig extends RunnerClientDescription {
  readonly tenantId: string
  readonly userId: string
  readonly token: string
  describe(): RunnerClientDescription
}

function value(input: unknown, name: string): string {
  if (typeof input !== 'string' || input.trim() === '' || input.length > 2_048) throw new Error(`${name} is invalid`)
  return input.trim()
}

export function parseRunnerClientConfig(input: unknown): RunnerClientConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) throw new Error('client config must be an object')
  const raw = input as Record<string, unknown>
  const url = value(raw.url, 'url')
  const parsedUrl = new URL(url)
  if (parsedUrl.protocol !== 'wss:' && !(parsedUrl.protocol === 'ws:' && ['127.0.0.1', 'localhost', '::1'].includes(parsedUrl.hostname))) {
    throw new Error('Runner URL must use wss except on loopback')
  }
  if (parsedUrl.pathname !== '/runner/v1/connect' || parsedUrl.search !== '' || parsedUrl.hash
    || parsedUrl.username || parsedUrl.password) throw new Error('Runner URL path or credentials are invalid')
  const token = value(raw.token, 'token')
  if (token.length < 32 || token.length > 512) throw new Error('token length is invalid')
  const runnerId = value(raw.runnerId, 'runnerId')
  const deviceId = value(raw.deviceId, 'deviceId')
  const tenantId = value(raw.tenantId, 'tenantId')
  const userId = value(raw.userId, 'userId')
  return Object.freeze({
    url, token, tenantId, userId, runnerId, deviceId,
    describe: () => Object.freeze({ url, runnerId, deviceId }),
  })
}

export async function executeLocalJob(raw: unknown, binding: RunnerBinding): Promise<RunnerJobResult> {
  const job = authorizeRunnerJob(binding, raw, Date.now())
  if (job.tool.name !== 'local.system_info') throw new Error('unsupported local tool')
  if (Object.keys(job.tool.arguments).length !== 0) throw new Error('local.system_info does not accept arguments')
  return Object.freeze({
    protocolVersion: 1,
    kind: 'runner.job-result',
    jobId: job.jobId,
    runnerId: job.runnerId,
    outcome: 'succeeded',
    value: Object.freeze({ platform: platform(), arch: arch(), release: release(), hostname: hostname() }),
    completedAt: Date.now(),
  })
}

export function nextReconnectDelay(attempt: number, random: () => number = Math.random): number {
  const exponential = Math.min(30_000, 1_000 * (2 ** Math.max(0, attempt)))
  return Math.min(30_000, Math.round(exponential * (1 + (0.2 * random()))))
}

export function connectRunner(rawConfig: unknown): { close(): void } {
  const config = parseRunnerClientConfig(rawConfig)
  let stopped = false
  let socket: WebSocket | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined
  let reconnect: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  const binding: RunnerBinding = Object.freeze({
    tenantId: config.tenantId, userId: config.userId, runnerId: config.runnerId,
    deviceId: config.deviceId, capabilities: Object.freeze(['local.system_info']),
  })
  const replayGuard = new RunnerReplayGuard()

  const connect = () => {
    if (stopped) return
    socket = new WebSocket(config.url, { headers: { authorization: `Bearer ${config.token}` }, perMessageDeflate: false })
    socket.on('open', () => {
      attempt = 0
      socket?.send(JSON.stringify({
        protocolVersion: 1, kind: 'runner.register', runnerId: config.runnerId,
        deviceId: config.deviceId, capabilities: ['local.system_info'],
      }))
      heartbeat = setInterval(() => socket?.send(JSON.stringify({
        protocolVersion: 1, kind: 'runner.heartbeat', runnerId: config.runnerId,
        deviceId: config.deviceId, sentAt: Date.now(),
      })), 10_000)
      heartbeat.unref()
    })
    socket.on('message', async data => {
      let job: RunnerJob
      try {
        job = replayGuard.accept(binding, JSON.parse(data.toString()), Date.now())
      } catch {
        socket?.close(4400, 'invalid job')
        return
      }
      try {
        socket?.send(JSON.stringify(await executeLocalJob(job, binding)))
      } catch {
        socket?.send(JSON.stringify({
          protocolVersion: 1, kind: 'runner.job-result', jobId: job.jobId, runnerId: config.runnerId,
          outcome: 'failed', error: { code: 'LOCAL_TOOL_REJECTED', message: 'local job rejected', retryable: false },
          completedAt: Date.now(),
        }))
      }
    })
    socket.on('close', code => {
      if (heartbeat) clearInterval(heartbeat)
      if (stopped || code === 4401 || code === 4403) return
      reconnect = setTimeout(connect, nextReconnectDelay(attempt++))
      reconnect.unref()
    })
    socket.on('unexpected-response', (_request, response) => {
      if (response.statusCode === 401 || response.statusCode === 403) stopped = true
      response.resume()
      socket?.terminate()
    })
    socket.on('error', () => { /* close drives bounded reconnect */ })
  }
  connect()
  return Object.freeze({ close: () => {
    stopped = true
    if (heartbeat) clearInterval(heartbeat)
    if (reconnect) clearTimeout(reconnect)
    socket?.close(1000, 'client stopped')
  } })
}
