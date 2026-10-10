import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { createElement, useState } from 'react'

const PRODUCT_HUB_ORIGINS = ['https://product-dev.fsstory.net','https://product.fsstory.net']
const SESSION_ROUTE = '/_futurestaff/platform-dev/session'

interface ProductHubSession {
  readonly phase?: unknown
  readonly activeTenantId?: unknown
  readonly applications?: unknown
}

async function getSession(): Promise<ProductHubSession> {
  const response = await globalThis.fetch(SESSION_ROUTE, {
    method: 'GET', headers: { accept: 'application/json', 'x-futurestaff-session': '1' },
    cache: 'no-store',
  })
  if (!response.ok) throw new Error('session unavailable')
  const value: unknown = await response.json()
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid session')
  return value as ProductHubSession
}

/** Use only the current tenant's server-authorized application entry. */
export function productHubHome(snapshot: ProductHubSession): string | null {
  if (snapshot.phase !== 'ready' || typeof snapshot.activeTenantId !== 'string'
    || !Array.isArray(snapshot.applications)) return null
  const authorized = snapshot.applications.find(item => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) return false
    const app = item as Record<string, unknown>
    const links = app.deepLinks
    return app.appId === 'product_hub' && app.tenantId === snapshot.activeTenantId
      && typeof app.baseUrl === 'string' && PRODUCT_HUB_ORIGINS.includes(app.baseUrl)
      && Array.isArray(app.capabilities) && app.capabilities.includes('product_hub.read')
      && links !== null && typeof links === 'object' && !Array.isArray(links)
      && (links as Record<string, unknown>).home === '/product-hub'
  })
  return authorized ? `${(authorized as Record<string, unknown>).baseUrl}/product-hub` : null
}

function ProductHubLauncher({ wide }: { readonly wide: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const open = async (): Promise<void> => {
    if (pending) return
    setPending(true)
    setError('')
    try {
      const url = productHubHome(await getSession())
      if (url === null) {
        setError('当前租户未获选品中心访问权限，请检查平台授权。')
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      setError('无法读取平台授权，请稍后重试。')
    } finally {
      setPending(false)
    }
  }
  return createElement('div', { style: { width: '100%' } },
    createElement('button', {
      type: 'button', 'aria-label': '打开线上选品中心', disabled: pending,
      onClick: () => { void open() },
      style: { display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px' },
    }, createElement('span', { 'aria-hidden': true }, '◇'),
    wide ? createElement('span', null, pending ? '正在打开…' : '选品中心') : null),
    error ? createElement('span', { role: 'alert', style: { display: 'block', padding: '4px 10px', fontSize: 12 } }, error) : null)
}

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'futurestaff-product-hub', order: -20,
  }, ProductHubLauncher))
}
