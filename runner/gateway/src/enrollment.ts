import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { GatewayBinding } from './index.js'

export type EnrollmentErrorCode = 'CODE_INVALID' | 'CODE_EXPIRED' | 'CODE_CONSUMED' | 'STATE_CONFLICT'

export class EnrollmentError extends Error {
  constructor(readonly code: EnrollmentErrorCode, message: string) {
    super(message)
    this.name = 'EnrollmentError'
  }
}

interface EnrollmentOffer {
  readonly codeSha256: string
  readonly tenantId: string
  readonly userId: string
  readonly expiresAt: number
}

interface EnrollmentState {
  readonly version: 1
  readonly consumedCodeSha256: readonly string[]
  readonly bindings: readonly GatewayBinding[]
}

export interface EnrollmentResult { readonly binding: GatewayBinding; readonly token: string }
export interface EnrollmentService {
  readonly bindings: readonly GatewayBinding[]
  redeem(code: string, deviceName: string): Promise<EnrollmentResult>
}

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, name: string, max = 200): string {
  if (typeof value !== 'string' || value.trim() === '' || value.length > max) throw new Error(`${name} is invalid`)
  return value.trim()
}

function digest(value: unknown, name: string): string {
  const parsed = text(value, name)
  if (!/^[a-f0-9]{64}$/.test(parsed)) throw new Error(`${name} must be a SHA-256 digest`)
  return parsed
}

function offers(value: unknown): readonly EnrollmentOffer[] {
  const input = record(value, 'enrollment offers')
  if (!Array.isArray(input.offers)) throw new Error('offers must be an array')
  return Object.freeze(input.offers.map((raw, index) => {
    const offer = record(raw, `offers[${index}]`)
    if (!Number.isSafeInteger(offer.expiresAt) || (offer.expiresAt as number) < 0) throw new Error('expiresAt is invalid')
    return Object.freeze({
      codeSha256: digest(offer.codeSha256, 'codeSha256'),
      tenantId: text(offer.tenantId, 'tenantId'),
      userId: text(offer.userId, 'userId'),
      expiresAt: offer.expiresAt as number,
    })
  }))
}

function state(value: unknown): EnrollmentState {
  const input = record(value, 'enrollment state')
  if (input.version !== 1 || !Array.isArray(input.consumedCodeSha256) || !Array.isArray(input.bindings)) {
    throw new Error('enrollment state is invalid')
  }
  const consumed = input.consumedCodeSha256.map((value, index) => digest(value, `consumedCodeSha256[${index}]`))
  const bindings = input.bindings.map((raw, index) => {
    const binding = record(raw, `bindings[${index}]`)
    if (!Array.isArray(binding.capabilities) || binding.capabilities.length !== 1 || binding.capabilities[0] !== 'local.system_info') {
      throw new Error('persisted binding capabilities are invalid')
    }
    return Object.freeze({
      tenantId: text(binding.tenantId, 'tenantId'), userId: text(binding.userId, 'userId'),
      runnerId: text(binding.runnerId, 'runnerId'), deviceId: text(binding.deviceId, 'deviceId'),
      capabilities: Object.freeze(['local.system_info']), tokenSha256: digest(binding.tokenSha256, 'tokenSha256'),
    })
  })
  return Object.freeze({ version: 1, consumedCodeSha256: Object.freeze(consumed), bindings: Object.freeze(bindings) })
}

async function readState(stateFile: string): Promise<EnrollmentState> {
  try {
    return state(JSON.parse(await readFile(stateFile, 'utf8')))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return Object.freeze({ version: 1, consumedCodeSha256: Object.freeze([]), bindings: Object.freeze([]) })
    }
    throw error
  }
}

function digestMatches(candidate: string, expected: string): boolean {
  return timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(expected, 'hex'))
}

export async function createEnrollmentService(options: {
  readonly offersFile: string
  readonly stateFile: string
  readonly now?: () => number
  readonly createToken?: () => string
  readonly createId?: () => string
}): Promise<EnrollmentService> {
  let current = await readState(options.stateFile)
  let queue = Promise.resolve()
  const now = options.now ?? Date.now
  const createToken = options.createToken ?? (() => randomBytes(48).toString('base64url'))
  const createId = options.createId ?? randomUUID

  const persist = async (next: EnrollmentState) => {
    await mkdir(path.dirname(options.stateFile), { recursive: true })
    const temporary = `${options.stateFile}.${process.pid}.${randomUUID()}.tmp`
    await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, options.stateFile)
  }

  const redeemInternal = async (rawCode: string, rawDeviceName: string): Promise<EnrollmentResult> => {
    const code = text(rawCode, 'enrollment code')
    text(rawDeviceName, 'device name', 100)
    if (code.length < 16) throw new EnrollmentError('CODE_INVALID', 'enrollment code is invalid')
    const codeSha256 = createHash('sha256').update(code).digest('hex')
    if (current.consumedCodeSha256.some(value => digestMatches(value, codeSha256))) {
      throw new EnrollmentError('CODE_CONSUMED', 'enrollment code was already consumed')
    }
    const configuredOffers = offers(JSON.parse(await readFile(options.offersFile, 'utf8')))
    const offer = configuredOffers.find(value => digestMatches(value.codeSha256, codeSha256))
    if (!offer) throw new EnrollmentError('CODE_INVALID', 'enrollment code is invalid')
    if (now() > offer.expiresAt) throw new EnrollmentError('CODE_EXPIRED', 'enrollment code has expired')

    const token = createToken()
    if (token.length < 32 || token.length > 512) throw new Error('generated device token is invalid')
    const binding: GatewayBinding = Object.freeze({
      tenantId: offer.tenantId, userId: offer.userId,
      runnerId: `runner-${text(createId(), 'generated Runner ID')}`,
      deviceId: `device-${text(createId(), 'generated device ID')}`,
      capabilities: Object.freeze(['local.system_info']),
      tokenSha256: createHash('sha256').update(token).digest('hex'),
    })
    if (current.bindings.some(value => value.runnerId === binding.runnerId || value.tokenSha256 === binding.tokenSha256)) {
      throw new EnrollmentError('STATE_CONFLICT', 'generated Runner identity conflicts with existing state')
    }
    const next = Object.freeze({
      version: 1 as const,
      consumedCodeSha256: Object.freeze([...current.consumedCodeSha256, codeSha256]),
      bindings: Object.freeze([...current.bindings, binding]),
    })
    await persist(next)
    current = next
    return Object.freeze({ binding, token })
  }

  return Object.freeze({
    bindings: current.bindings,
    redeem: (code: string, deviceName: string) => {
      const operation = queue.then(() => redeemInternal(code, deviceName))
      queue = operation.then(() => undefined, () => undefined)
      return operation
    },
  })
}
