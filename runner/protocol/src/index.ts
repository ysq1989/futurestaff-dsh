export const RUNNER_PROTOCOL_VERSION = 1 as const
export const INITIAL_RUNNER_CAPABILITY = 'local.system_info' as const
export const MAX_RUNNER_CLOCK_SKEW_MS = 30_000

export type RunnerProtocolErrorCode =
  | 'INVALID_ENVELOPE'
  | 'SUBJECT_MISMATCH'
  | 'RUNNER_MISMATCH'
  | 'DEVICE_MISMATCH'
  | 'CAPABILITY_DENIED'
  | 'JOB_EXPIRED'
  | 'JOB_NOT_YET_VALID'
  | 'JOB_REPLAYED'
  | 'REPLAY_WINDOW_FULL'

export class RunnerProtocolError extends Error {
  constructor(readonly code: RunnerProtocolErrorCode, message: string) {
    super(message)
    this.name = 'RunnerProtocolError'
  }
}

export interface RunnerSubject {
  readonly tenantId: string
  readonly userId: string
}

export interface RunnerBinding extends RunnerSubject {
  readonly runnerId: string
  readonly deviceId: string
  readonly capabilities: readonly string[]
}

export interface RunnerRegistration {
  readonly protocolVersion: 1
  readonly kind: 'runner.register'
  readonly runnerId: string
  readonly deviceId: string
  readonly displayName?: string
  readonly capabilities: readonly string[]
}

export interface RunnerHeartbeat {
  readonly protocolVersion: 1
  readonly kind: 'runner.heartbeat'
  readonly runnerId: string
  readonly deviceId: string
  readonly sentAt: number
}

export interface RunnerJob {
  readonly protocolVersion: 1
  readonly kind: 'runner.job'
  readonly jobId: string
  readonly subject: RunnerSubject
  readonly runnerId: string
  readonly deviceId: string
  readonly tool: {
    readonly name: string
    readonly arguments: Readonly<Record<string, unknown>>
  }
  readonly issuedAt: number
  readonly expiresAt: number
  readonly approval: {
    readonly required: boolean
    readonly approvalId?: string
  }
}

export type RunnerJobResult =
  | {
      readonly protocolVersion: 1
      readonly kind: 'runner.job-result'
      readonly jobId: string
      readonly runnerId: string
      readonly outcome: 'succeeded'
      readonly value: unknown
      readonly completedAt: number
    }
  | {
      readonly protocolVersion: 1
      readonly kind: 'runner.job-result'
      readonly jobId: string
      readonly runnerId: string
      readonly outcome: 'failed'
      readonly error: { readonly code: string; readonly message: string; readonly retryable: boolean }
      readonly completedAt: number
    }

function invalid(message: string): never {
  throw new RunnerProtocolError('INVALID_ENVELOPE', message)
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) invalid(`${name} must be an object`)
  return value as Record<string, unknown>
}

function identifier(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > 200) {
    invalid(`${name} must be a non-empty string of at most 200 characters`)
  }
  return value.trim()
}

function timestamp(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    invalid(`${name} must be a non-negative integer timestamp`)
  }
  return value
}

function v1Envelope(value: unknown, kind: string): Record<string, unknown> {
  const input = record(value, kind)
  if (input.protocolVersion !== RUNNER_PROTOCOL_VERSION || input.kind !== kind) {
    invalid(`${kind} requires protocolVersion 1 and the exact kind`)
  }
  return input
}

function capabilities(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) invalid('capabilities must be a non-empty array')
  const parsed = value.map((item, index) => identifier(item, `capabilities[${index}]`))
  if (new Set(parsed).size !== parsed.length) invalid('capabilities must not contain duplicates')
  return Object.freeze(parsed)
}

export function parseRunnerRegistration(value: unknown): RunnerRegistration {
  const input = v1Envelope(value, 'runner.register')
  const displayName = input.displayName === undefined ? undefined : identifier(input.displayName, 'displayName')
  const declaredCapabilities = capabilities(input.capabilities)
  if (declaredCapabilities.some(capability => capability !== INITIAL_RUNNER_CAPABILITY)) {
    throw new RunnerProtocolError('CAPABILITY_DENIED', 'Runner declared a capability not supported by protocol v1')
  }
  return Object.freeze({
    protocolVersion: RUNNER_PROTOCOL_VERSION,
    kind: 'runner.register' as const,
    runnerId: identifier(input.runnerId, 'runnerId'),
    deviceId: identifier(input.deviceId, 'deviceId'),
    ...(displayName === undefined ? {} : { displayName }),
    capabilities: declaredCapabilities,
  })
}

export function parseRunnerHeartbeat(value: unknown): RunnerHeartbeat {
  const input = v1Envelope(value, 'runner.heartbeat')
  return Object.freeze({
    protocolVersion: RUNNER_PROTOCOL_VERSION,
    kind: 'runner.heartbeat' as const,
    runnerId: identifier(input.runnerId, 'runnerId'),
    deviceId: identifier(input.deviceId, 'deviceId'),
    sentAt: timestamp(input.sentAt, 'sentAt'),
  })
}

export function parseRunnerJob(value: unknown): RunnerJob {
  const input = v1Envelope(value, 'runner.job')
  const subject = record(input.subject, 'subject')
  const tool = record(input.tool, 'tool')
  const args = record(tool.arguments, 'tool.arguments')
  const approval = record(input.approval, 'approval')
  if (typeof approval.required !== 'boolean') invalid('approval.required must be boolean')
  const approvalId = approval.approvalId === undefined ? undefined : identifier(approval.approvalId, 'approval.approvalId')
  if (approval.required && approvalId === undefined) invalid('approval.approvalId is required when approval is required')
  const issuedAt = timestamp(input.issuedAt, 'issuedAt')
  const expiresAt = timestamp(input.expiresAt, 'expiresAt')
  if (expiresAt <= issuedAt) invalid('expiresAt must be later than issuedAt')
  return Object.freeze({
    protocolVersion: RUNNER_PROTOCOL_VERSION,
    kind: 'runner.job' as const,
    jobId: identifier(input.jobId, 'jobId'),
    subject: Object.freeze({
      tenantId: identifier(subject.tenantId, 'subject.tenantId'),
      userId: identifier(subject.userId, 'subject.userId'),
    }),
    runnerId: identifier(input.runnerId, 'runnerId'),
    deviceId: identifier(input.deviceId, 'deviceId'),
    tool: Object.freeze({ name: identifier(tool.name, 'tool.name'), arguments: Object.freeze({ ...args }) }),
    issuedAt,
    expiresAt,
    approval: Object.freeze({ required: approval.required, ...(approvalId === undefined ? {} : { approvalId }) }),
  })
}

export function parseRunnerJobResult(value: unknown): RunnerJobResult {
  const input = v1Envelope(value, 'runner.job-result')
  const common = {
    protocolVersion: RUNNER_PROTOCOL_VERSION,
    kind: 'runner.job-result' as const,
    jobId: identifier(input.jobId, 'jobId'),
    runnerId: identifier(input.runnerId, 'runnerId'),
    completedAt: timestamp(input.completedAt, 'completedAt'),
  }
  if (input.outcome === 'succeeded') {
    if (!Object.hasOwn(input, 'value')) invalid('successful result must include value')
    return Object.freeze({ ...common, outcome: 'succeeded' as const, value: input.value })
  }
  if (input.outcome === 'failed') {
    const error = record(input.error, 'error')
    if (typeof error.retryable !== 'boolean') invalid('error.retryable must be boolean')
    return Object.freeze({
      ...common,
      outcome: 'failed' as const,
      error: Object.freeze({
        code: identifier(error.code, 'error.code'),
        message: identifier(error.message, 'error.message'),
        retryable: error.retryable,
      }),
    })
  }
  return invalid('outcome must be succeeded or failed')
}

export function authorizeRunnerJob(binding: RunnerBinding, value: unknown, now: number): RunnerJob {
  const job = parseRunnerJob(value)
  if (job.subject.tenantId !== binding.tenantId || job.subject.userId !== binding.userId) {
    throw new RunnerProtocolError('SUBJECT_MISMATCH', 'job subject does not match this Runner binding')
  }
  if (job.runnerId !== binding.runnerId) {
    throw new RunnerProtocolError('RUNNER_MISMATCH', 'job is addressed to another Runner')
  }
  if (job.deviceId !== binding.deviceId) {
    throw new RunnerProtocolError('DEVICE_MISMATCH', 'job is addressed to another device')
  }
  if (!binding.capabilities.includes(job.tool.name)) {
    throw new RunnerProtocolError('CAPABILITY_DENIED', 'Runner did not register the requested capability')
  }
  if (job.issuedAt - now > MAX_RUNNER_CLOCK_SKEW_MS) {
    throw new RunnerProtocolError('JOB_NOT_YET_VALID', 'job issue time exceeds the allowed clock skew')
  }
  if (now > job.expiresAt) throw new RunnerProtocolError('JOB_EXPIRED', 'job has expired')
  return job
}

export class RunnerReplayGuard {
  readonly #accepted = new Map<string, number>()

  constructor(readonly capacity = 10_000) {
    if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new RangeError('capacity must be a positive integer')
  }

  accept(binding: RunnerBinding, value: unknown, now: number): RunnerJob {
    for (const [jobId, expiresAt] of this.#accepted) {
      if (expiresAt < now) this.#accepted.delete(jobId)
    }
    const job = authorizeRunnerJob(binding, value, now)
    if (this.#accepted.has(job.jobId)) throw new RunnerProtocolError('JOB_REPLAYED', 'job was already accepted')
    if (this.#accepted.size >= this.capacity) {
      throw new RunnerProtocolError('REPLAY_WINDOW_FULL', 'replay window is full; refusing new work')
    }
    this.#accepted.set(job.jobId, job.expiresAt)
    return job
  }
}
