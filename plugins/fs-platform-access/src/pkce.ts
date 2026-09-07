import { createHash, randomBytes as nodeRandomBytes, timingSafeEqual } from 'node:crypto'
import {
  PLATFORM_CLIENT_ID,
  type AuthCallbackInput,
} from './contracts.js'

const AUTHORIZATION_URL = 'https://dev.fsstory.net/login'
const CALLBACK_URL = 'http://127.0.0.1:43821/callback'
const TRANSACTION_TTL_MS = 5 * 60_000
const RANDOM_BYTES = 32
const PKCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u

export type PlatformPkceErrorCode =
  | 'transaction-pending'
  | 'no-pending-transaction'
  | 'invalid-callback'
  | 'state-mismatch'
  | 'transaction-expired'

export class PlatformPkceError extends Error {
  constructor(readonly code: PlatformPkceErrorCode, message: string) {
    super(message)
    this.name = 'PlatformPkceError'
  }
}

export interface PlatformPkceDependencies {
  readonly randomBytes?: (size: number) => Uint8Array
  readonly now?: () => number
}

interface PendingTransaction {
  readonly verifier: string
  readonly state: string
  readonly expiresAt: number
}

function error(code: PlatformPkceErrorCode, message: string): PlatformPkceError {
  return new PlatformPkceError(code, `fs-platform-access: ${message}`)
}

function base64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url')
}

function equal(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, 'utf8')
  const rightBytes = Buffer.from(right, 'utf8')
  try {
    return leftBytes.byteLength === rightBytes.byteLength && timingSafeEqual(leftBytes, rightBytes)
  } finally {
    leftBytes.fill(0)
    rightBytes.fill(0)
  }
}

export class PlatformPkceTransaction {
  readonly #randomBytes: (size: number) => Uint8Array
  readonly #now: () => number
  #pending: PendingTransaction | undefined

  constructor(dependencies: PlatformPkceDependencies = {}) {
    this.#randomBytes = dependencies.randomBytes ?? nodeRandomBytes
    this.#now = dependencies.now ?? Date.now
  }

  begin(): { readonly authorizationUrl: string } {
    if (this.#pending !== undefined) {
      throw error('transaction-pending', 'an authorization transaction is already pending.')
    }
    let verifierBytes: Uint8Array
    let stateBytes: Uint8Array
    try {
      verifierBytes = this.#randomBytes(RANDOM_BYTES)
      stateBytes = this.#randomBytes(RANDOM_BYTES)
    } catch {
      throw error('invalid-callback', 'secure authorization randomness is unavailable.')
    }
    if (!(verifierBytes instanceof Uint8Array) || verifierBytes.byteLength !== RANDOM_BYTES
      || !(stateBytes instanceof Uint8Array) || stateBytes.byteLength !== RANDOM_BYTES) {
      throw error('invalid-callback', 'secure authorization randomness is unavailable.')
    }
    try {
      const verifier = base64url(verifierBytes)
      const state = base64url(stateBytes)
      if (!PKCE_PATTERN.test(verifier) || !PKCE_PATTERN.test(state)) {
        throw error('invalid-callback', 'secure authorization randomness is invalid.')
      }
      const challenge = createHash('sha256').update(verifier, 'ascii').digest('base64url')
      this.#pending = Object.freeze({ verifier, state, expiresAt: this.#now() + TRANSACTION_TTL_MS })
      const url = new URL(AUTHORIZATION_URL)
      url.searchParams.set('client_id', PLATFORM_CLIENT_ID)
      url.searchParams.set('redirect_uri', CALLBACK_URL)
      url.searchParams.set('state', state)
      url.searchParams.set('code_challenge', challenge)
      url.searchParams.set('code_challenge_method', 'S256')
      return Object.freeze({ authorizationUrl: url.href })
    } finally {
      Buffer.from(verifierBytes.buffer, verifierBytes.byteOffset, verifierBytes.byteLength).fill(0)
      Buffer.from(stateBytes.buffer, stateBytes.byteOffset, stateBytes.byteLength).fill(0)
    }
  }

  consume(rawCallbackUrl: string): AuthCallbackInput {
    const pending = this.#pending
    if (pending === undefined) {
      throw error('no-pending-transaction', 'there is no pending authorization transaction.')
    }
    this.#pending = undefined
    if (this.#now() > pending.expiresAt) {
      throw error('transaction-expired', 'the authorization transaction expired.')
    }
    let url: URL
    try { url = new URL(rawCallbackUrl) } catch {
      throw error('invalid-callback', 'the authorization callback is invalid.')
    }
    const keys = [...url.searchParams.keys()].sort()
    if (url.origin + url.pathname !== CALLBACK_URL || url.username !== '' || url.password !== ''
      || url.hash !== '' || keys.join(',') !== 'code,state') {
      throw error('invalid-callback', 'the authorization callback is invalid.')
    }
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (code === null || code.length === 0 || code.length > 512 || /[\0-\x1f\x7f]/u.test(code)
      || state === null || !PKCE_PATTERN.test(state)) {
      throw error('invalid-callback', 'the authorization callback is invalid.')
    }
    if (!equal(state, pending.state)) {
      throw error('state-mismatch', 'the authorization callback state did not match.')
    }
    return Object.freeze({ code, codeVerifier: pending.verifier, redirectUri: CALLBACK_URL, state })
  }

  cancel(): void { this.#pending = undefined }

  diagnostics(): { readonly pending: boolean } {
    return Object.freeze({ pending: this.#pending !== undefined })
  }
}

export const platformPkceConstants = Object.freeze({
  authorizationUrl: AUTHORIZATION_URL,
  callbackUrl: CALLBACK_URL,
  transactionTtlMs: TRANSACTION_TTL_MS,
})
