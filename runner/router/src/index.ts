import {
  RUNNER_PROTOCOL_VERSION,
  parseRunnerHeartbeat,
  parseRunnerJobResult,
  parseRunnerRegistration,
  type RunnerBinding,
  type RunnerHeartbeat,
  type RunnerJob,
  type RunnerJobResult,
  type RunnerRegistration,
} from '@futurestaff/local-runner-protocol'

export type RunnerRouterErrorCode =
  | 'RUNNER_NOT_CONFIGURED'
  | 'REGISTRATION_MISMATCH'
  | 'RUNNER_ALREADY_CONNECTED'
  | 'RUNNER_OFFLINE'
  | 'RUNNER_STALE'
  | 'CAPABILITY_DENIED'
  | 'RESULT_MISMATCH'
  | 'REMOTE_TOOL_FAILED'
  | 'JOB_TIMEOUT'
  | 'CONNECTION_CLOSED'

export class RunnerRouterError extends Error {
  constructor(readonly code: RunnerRouterErrorCode, message: string) {
    super(message)
    this.name = 'RunnerRouterError'
  }
}

export interface RunnerChannel {
  send(job: RunnerJob): void
}

export interface RunnerDispatch {
  readonly runnerId: string
  readonly toolName: string
  readonly arguments: Readonly<Record<string, unknown>>
  readonly approval?: { readonly required: boolean; readonly approvalId?: string }
}

export interface RunnerStatus {
  readonly runnerId: string
  readonly deviceId: string
  readonly online: boolean
  readonly stale: boolean
  readonly lastSeenAt?: number
  readonly capabilities: readonly string[]
}

type TimerHandle = unknown
type Pending = {
  readonly runnerId: string
  readonly resolve: (value: unknown) => void
  readonly reject: (error: RunnerRouterError) => void
  readonly timer: TimerHandle
}
type Session = { channel: RunnerChannel; lastSeenAt: number }

export interface LocalRunnerRouterOptions {
  readonly bindings: readonly RunnerBinding[]
  readonly now?: () => number
  readonly createJobId?: () => string
  readonly schedule?: (callback: () => void, delayMs: number) => TimerHandle
  readonly cancel?: (handle: TimerHandle) => void
  readonly heartbeatTtlMs?: number
  readonly jobTtlMs?: number
}

export class LocalRunnerRouter {
  readonly #bindings = new Map<string, RunnerBinding>()
  readonly #sessions = new Map<string, Session>()
  readonly #pending = new Map<string, Pending>()
  readonly #now: () => number
  readonly #createJobId: () => string
  readonly #schedule: (callback: () => void, delayMs: number) => TimerHandle
  readonly #cancel: (handle: TimerHandle) => void
  readonly #heartbeatTtlMs: number
  readonly #jobTtlMs: number

  constructor(options: LocalRunnerRouterOptions) {
    for (const binding of options.bindings) {
      if (this.#bindings.has(binding.runnerId)) throw new Error(`duplicate Runner binding: ${binding.runnerId}`)
      this.#bindings.set(binding.runnerId, Object.freeze({ ...binding, capabilities: Object.freeze([...binding.capabilities]) }))
    }
    this.#now = options.now ?? Date.now
    this.#createJobId = options.createJobId ?? (() => crypto.randomUUID())
    this.#schedule = options.schedule ?? ((callback, delayMs) => setTimeout(callback, delayMs))
    this.#cancel = options.cancel ?? (handle => clearTimeout(handle as ReturnType<typeof setTimeout>))
    this.#heartbeatTtlMs = options.heartbeatTtlMs ?? 30_000
    this.#jobTtlMs = options.jobTtlMs ?? 30_000
  }

  attach(value: unknown, channel: RunnerChannel) {
    const registration = parseRunnerRegistration(value)
    const binding = this.#bindings.get(registration.runnerId)
    if (!binding) throw new RunnerRouterError('RUNNER_NOT_CONFIGURED', 'Runner has no server-side binding')
    this.#assertRegistration(binding, registration)
    if (this.#sessions.has(binding.runnerId)) {
      throw new RunnerRouterError('RUNNER_ALREADY_CONNECTED', 'Runner already has an active connection')
    }
    const session: Session = { channel, lastSeenAt: this.#now() }
    this.#sessions.set(binding.runnerId, session)
    let connected = true
    return Object.freeze({
      heartbeat: (heartbeat: unknown) => {
        this.#assertCurrent(binding.runnerId, session, connected)
        const parsed = parseRunnerHeartbeat(heartbeat)
        this.#assertHeartbeat(binding, parsed)
        session.lastSeenAt = this.#now()
      },
      complete: (result: unknown) => {
        this.#assertCurrent(binding.runnerId, session, connected)
        this.#complete(binding.runnerId, result)
      },
      disconnect: () => {
        if (!connected) return
        connected = false
        if (this.#sessions.get(binding.runnerId) === session) this.#sessions.delete(binding.runnerId)
        this.#rejectRunner(binding.runnerId, 'CONNECTION_CLOSED', 'Runner connection closed before job completion')
      },
    })
  }

  status(runnerId: string): RunnerStatus {
    const binding = this.#bindings.get(runnerId)
    if (!binding) throw new RunnerRouterError('RUNNER_NOT_CONFIGURED', 'Runner has no server-side binding')
    const session = this.#sessions.get(runnerId)
    return Object.freeze({
      runnerId,
      deviceId: binding.deviceId,
      online: session !== undefined,
      stale: session !== undefined && this.#now() - session.lastSeenAt > this.#heartbeatTtlMs,
      ...(session === undefined ? {} : { lastSeenAt: session.lastSeenAt }),
      capabilities: binding.capabilities,
    })
  }

  dispatch(request: RunnerDispatch): Promise<unknown> {
    const binding = this.#bindings.get(request.runnerId)
    if (!binding) return Promise.reject(new RunnerRouterError('RUNNER_NOT_CONFIGURED', 'Runner has no server-side binding'))
    const session = this.#sessions.get(request.runnerId)
    if (!session) return Promise.reject(new RunnerRouterError('RUNNER_OFFLINE', 'Runner is offline'))
    if (this.#now() - session.lastSeenAt > this.#heartbeatTtlMs) {
      return Promise.reject(new RunnerRouterError('RUNNER_STALE', 'Runner heartbeat is stale'))
    }
    if (!binding.capabilities.includes(request.toolName)) {
      return Promise.reject(new RunnerRouterError('CAPABILITY_DENIED', 'Runner binding does not permit this tool'))
    }
    if (request.approval?.required && !request.approval.approvalId) {
      return Promise.reject(new RunnerRouterError('CAPABILITY_DENIED', 'An approval ID is required for this job'))
    }
    const issuedAt = this.#now()
    const jobId = this.#createJobId()
    const job: RunnerJob = Object.freeze({
      protocolVersion: RUNNER_PROTOCOL_VERSION,
      kind: 'runner.job',
      jobId,
      subject: Object.freeze({ tenantId: binding.tenantId, userId: binding.userId }),
      runnerId: binding.runnerId,
      deviceId: binding.deviceId,
      tool: Object.freeze({ name: request.toolName, arguments: Object.freeze({ ...request.arguments }) }),
      issuedAt,
      expiresAt: issuedAt + this.#jobTtlMs,
      approval: Object.freeze(request.approval ?? { required: false }),
    })
    return new Promise((resolve, reject) => {
      const timer = this.#schedule(() => this.#rejectJob(jobId, 'JOB_TIMEOUT', 'Runner job timed out'), this.#jobTtlMs)
      this.#pending.set(jobId, { runnerId: binding.runnerId, resolve, reject, timer })
      try {
        session.channel.send(job)
      } catch {
        this.#rejectJob(jobId, 'CONNECTION_CLOSED', 'Runner channel failed while sending the job')
      }
    })
  }

  #assertRegistration(binding: RunnerBinding, registration: RunnerRegistration): void {
    const exactCapabilities = binding.capabilities.length === registration.capabilities.length
      && binding.capabilities.every(capability => registration.capabilities.includes(capability))
    if (binding.deviceId !== registration.deviceId || !exactCapabilities) {
      throw new RunnerRouterError('REGISTRATION_MISMATCH', 'Runner registration does not match its server-side binding')
    }
  }

  #assertHeartbeat(binding: RunnerBinding, heartbeat: RunnerHeartbeat): void {
    if (heartbeat.runnerId !== binding.runnerId || heartbeat.deviceId !== binding.deviceId) {
      throw new RunnerRouterError('REGISTRATION_MISMATCH', 'Heartbeat identity does not match the connection binding')
    }
  }

  #assertCurrent(runnerId: string, session: Session, connected: boolean): void {
    if (!connected || this.#sessions.get(runnerId) !== session) {
      throw new RunnerRouterError('CONNECTION_CLOSED', 'Runner connection is no longer active')
    }
  }

  #complete(runnerId: string, value: unknown): void {
    const result = parseRunnerJobResult(value)
    const pending = this.#pending.get(result.jobId)
    if (!pending || result.runnerId !== runnerId || pending.runnerId !== runnerId) {
      throw new RunnerRouterError('RESULT_MISMATCH', 'Result does not match a pending job on this connection')
    }
    this.#pending.delete(result.jobId)
    this.#cancel(pending.timer)
    if (result.outcome === 'succeeded') pending.resolve(result.value)
    else pending.reject(new RunnerRouterError('REMOTE_TOOL_FAILED', `${result.error.code}: ${result.error.message}`))
  }

  #rejectJob(jobId: string, code: RunnerRouterErrorCode, message: string): void {
    const pending = this.#pending.get(jobId)
    if (!pending) return
    this.#pending.delete(jobId)
    this.#cancel(pending.timer)
    pending.reject(new RunnerRouterError(code, message))
  }

  #rejectRunner(runnerId: string, code: RunnerRouterErrorCode, message: string): void {
    for (const [jobId, pending] of this.#pending) {
      if (pending.runnerId === runnerId) this.#rejectJob(jobId, code, message)
    }
  }
}
