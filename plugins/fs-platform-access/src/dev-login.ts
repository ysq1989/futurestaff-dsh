import type { AuthCallbackInput, AuthResult } from './contracts.js'
import type { PlatformProtectedSecrets, PlatformSessionVault } from './session-vault.js'

export type PlatformDevLoginErrorCode =
  | 'transaction-failure'
  | 'exchange-busy'
  | 'exchange-failure'
  | 'storage-failure'

export class PlatformDevLoginError extends Error {
  constructor(readonly code: PlatformDevLoginErrorCode, message: string) {
    super(message)
    this.name = 'PlatformDevLoginError'
  }
}

interface PkceBoundary {
  begin(): { readonly authorizationUrl: string }
  consume(callbackUrl: string): AuthCallbackInput
  cancel(): void
  diagnostics(): { readonly pending: boolean }
}

interface DevAuthApi {
  login(input: AuthCallbackInput, signal?: AbortSignal): Promise<AuthResult>
  logout(refreshToken: string | undefined, signal?: AbortSignal): Promise<void>
}

interface SessionVaultBoundary {
  save(value: { readonly session: AuthResult['session']; readonly user: AuthResult['user'] }): Promise<void>
  clear(): Promise<void>
  diagnostics(): Promise<{ readonly available: boolean; readonly state: 'stored' | 'empty' | 'unavailable' }>
}

export interface PlatformDevLoginDependencies {
  readonly pkce: PkceBoundary
  readonly api: DevAuthApi
  readonly vault: SessionVaultBoundary
}

function failure(code: PlatformDevLoginErrorCode, message: string): PlatformDevLoginError {
  return new PlatformDevLoginError(code, `fs-platform-access: ${message}`)
}

export class PlatformDevLoginCoordinator {
  #exchanging = false

  constructor(private readonly dependencies: PlatformDevLoginDependencies) {}

  begin(): { readonly authorizationUrl: string } {
    if (this.#exchanging) throw failure('exchange-busy', 'an authorization exchange is already running.')
    try { return this.dependencies.pkce.begin() } catch {
      throw failure('transaction-failure', 'the authorization transaction could not be started.')
    }
  }

  async complete(callbackUrl: string, signal?: AbortSignal): Promise<void> {
    if (this.#exchanging) throw failure('exchange-busy', 'an authorization exchange is already running.')
    this.#exchanging = true
    let result: AuthResult | undefined
    try {
      let input: AuthCallbackInput
      try { input = this.dependencies.pkce.consume(callbackUrl) } catch {
        throw failure('transaction-failure', 'the authorization callback was rejected.')
      }
      try { result = await this.dependencies.api.login(input, signal) } catch {
        throw failure('exchange-failure', 'the platform authorization exchange failed.')
      }
      try {
        await this.dependencies.vault.save({ session: result.session, user: result.user })
      } catch {
        try { await this.dependencies.api.logout(result.session.refreshToken, signal) } catch { /* best effort */ }
        throw failure('storage-failure', 'the protected platform session could not be saved.')
      }
    } finally {
      this.#exchanging = false
    }
  }

  cancel(): void { this.dependencies.pkce.cancel() }

  async diagnostics(): Promise<{
    readonly pending: boolean
    readonly exchanging: boolean
    readonly vault: 'stored' | 'empty' | 'unavailable'
  }> {
    let vault: 'stored' | 'empty' | 'unavailable' = 'unavailable'
    try { vault = (await this.dependencies.vault.diagnostics()).state } catch { /* bounded diagnostic */ }
    return Object.freeze({
      pending: this.dependencies.pkce.diagnostics().pending,
      exchanging: this.#exchanging,
      vault,
    })
  }
}

// Keep the service structurally compatible without adding a runtime dependency.
export type PlatformDevLoginVault = PlatformSessionVault
export type PlatformDevLoginProtectedSecrets = PlatformProtectedSecrets
