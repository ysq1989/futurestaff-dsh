import type { PasswordLoginInput } from './contracts.js'
import { platformOrigin, type PlatformEnvironment } from './environment.js'
import type { PlatformProtectedSecrets } from './session-vault.js'

export interface RememberedLoginHint { available: boolean; remembered: boolean; loginIdentifier?: string }
interface SavedLogin { version: 1; loginIdentifier: string; password: string }
interface LoginResult { phase: string; user?: { userId: string } }

/** Passwords stay in the OS-protected Host store and are never returned to the Renderer. */
export class RememberedLogin {
  private readonly key: string
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private readonly secrets: PlatformProtectedSecrets, environment: PlatformEnvironment) {
    platformOrigin(environment)
    this.key = `futurestaff.platform.remember-password.v1.${environment}`
  }
  private serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.queue.then(operation)
    this.queue = result.catch(() => {})
    return result
  }
  private async read(): Promise<SavedLogin | undefined> {
    if (!await this.secrets.available()) return undefined
    const text = await this.secrets.read(this.key)
    if (text === undefined) return undefined
    if (text.length > 4096) throw new Error('REMEMBERED_LOGIN_INVALID')
    const value = JSON.parse(text) as SavedLogin
    if (!value || Object.keys(value).sort().join(',') !== 'loginIdentifier,password,version'
      || value.version !== 1 || typeof value.loginIdentifier !== 'string'
      || !value.loginIdentifier.trim() || value.loginIdentifier.length > 254
      || typeof value.password !== 'string' || !value.password || value.password.length > 128) {
      throw new Error('REMEMBERED_LOGIN_INVALID')
    }
    return value
  }
  hint(): Promise<RememberedLoginHint> {
    return this.serialized(async () => {
      try {
        if (!await this.secrets.available()) return { available: false, remembered: false }
        const saved = await this.read()
        return { available: true, remembered: !!saved, ...(saved ? { loginIdentifier: saved.loginIdentifier } : {}) }
      } catch { return { available: false, remembered: false } }
    })
  }
  forget(): Promise<void> { return this.serialized(() => this.secrets.delete(this.key)) }
  login<T extends LoginResult>(input: PasswordLoginInput, remember: boolean | undefined,
    authenticate: (input: PasswordLoginInput) => Promise<T>): Promise<T> {
    return this.serialized(async () => {
      if (remember === false) await this.secrets.delete(this.key)
      let password = input.password
      if (!password && remember === true) {
        const saved = await this.read()
        if (!saved || saved.loginIdentifier !== input.loginIdentifier.trim()) throw new Error('REMEMBERED_LOGIN_REQUIRED')
        password = saved.password
      }
      const result = await authenticate({ ...input, password })
      if (remember === true && result.user && ['selecting_tenant', 'ready', 'no_apps'].includes(result.phase)) {
        try {
          if (await this.secrets.available() && password.length >= 1 && password.length <= 128
            && input.loginIdentifier.trim().length >= 1 && input.loginIdentifier.trim().length <= 254) {
            await this.secrets.write(this.key, JSON.stringify({ version: 1, loginIdentifier: input.loginIdentifier.trim(), password }))
          }
        } catch { /* Optional remembering cannot invalidate a verified login. */ }
      }
      return result
    })
  }
}
