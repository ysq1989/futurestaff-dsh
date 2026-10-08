/** Local form hints never supply authorization, passwords or session credentials. */
export interface LoginHints { readonly loginIdentifier?: string; readonly tenantId?: string; readonly rememberPassword?: boolean; readonly rememberPasswordAvailable?: boolean; readonly rememberPasswordStatus?: string }
type PreferenceStore = Pick<Storage, 'getItem' | 'setItem'>
const key = 'futurestaff.login-hints.v1'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
interface Preferences { loginIdentifier?: string; tenants: Record<string, string> }

export class LoginPreferences {
  constructor(private readonly storage: () => PreferenceStore | undefined = () => {
    try { return typeof window === 'undefined' ? undefined : window.localStorage } catch { return undefined }
  }) {}

  private read(): Preferences {
    try {
      const text = this.storage()?.getItem(key)
      if (!text || text.length > 16_384) return { tenants: {} }
      const value = JSON.parse(text) as Preferences
      const tenants: Record<string, string> = Object.create(null)
      for (const [user, tenant] of Object.entries(value.tenants ?? {}).slice(-32)) {
        if (uuid.test(user) && typeof tenant === 'string' && uuid.test(tenant)) tenants[user] = tenant
      }
      return { ...(typeof value.loginIdentifier === 'string' && value.loginIdentifier.length <= 254
        ? { loginIdentifier: value.loginIdentifier } : {}), tenants }
    } catch { return { tenants: {} } }
  }

  hints(userId?: string): LoginHints {
    const value = this.read()
    const tenantId = userId && uuid.test(userId) ? value.tenants[userId] : undefined
    return { ...(value.loginIdentifier ? { loginIdentifier: value.loginIdentifier } : {}),
      ...(tenantId ? { tenantId } : {}) }
  }

  rememberIdentifier(identifier: string): void {
    const value = identifier.trim()
    if (!value || value.length > 254) return
    this.write({ ...this.read(), loginIdentifier: value })
  }

  rememberTenant(userId: string, tenantId: string): void {
    if (!uuid.test(userId) || !uuid.test(tenantId)) return
    const value = this.read()
    const tenants = Object.fromEntries(Object.entries(value.tenants).filter(([user]) => user !== userId).slice(-31))
    this.write({ ...value, tenants: { ...tenants, [userId]: tenantId } })
  }

  private write(value: Preferences): void {
    try { this.storage()?.setItem(key, JSON.stringify(value)) } catch { /* Remembering is optional; login still works. */ }
  }
}
