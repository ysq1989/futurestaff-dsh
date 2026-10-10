import { useSyncExternalStore } from 'react'
import type { AuthorizedApplication } from '../contracts.js'
import type { PlatformAccessSnapshot } from '../controller.js'
import type { SidebarAccountController } from './sidebar.js'

const catalog = [
  { id: 'erp', title: 'FutureStaff ERP', description: '进销存与业务管理' },
  { id: 'hub', title: 'FutureStaff Hub', description: '货源集市' },
  { id: 'shop', title: 'FutureStaff Shop', description: '商城管理' },
  { id: 'ai', title: 'FutureStaff AI', description: '企业 AI 能力中枢' },
  { id: 'geo', title: 'FutureStaff GEO', description: '品牌内容与 AI 可见性' },
  { id: 'immigration', title: '越南签证', description: '签证业务工作台' },
  { id: 'platform', title: '管理平台', description: '主体、应用与权限管理' },
]
export interface DirectoryItem { id: string; title: string; description: string; pageId?: string; url: string | null }

/** A navigation hint only; the target system still validates its own session. */
export function applicationHome(snapshot: Pick<PlatformAccessSnapshot, 'phase' | 'activeTenantId'>, app: AuthorizedApplication): string | null {
  if (snapshot.phase !== 'ready' || !snapshot.activeTenantId || app.tenantId !== snapshot.activeTenantId || !app.capabilities.length) return null
  try {
    const base = new URL(app.baseUrl)
    if (base.protocol !== 'https:' || base.username || base.password
      || !(base.hostname === 'fsstory.net' || base.hostname.endsWith('.fsstory.net'))) return null
    const path = app.deepLinks.home ?? '/'
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
    const home = new URL(path, base)
    return home.origin === base.origin ? home.href : null
  } catch { return null }
}

export function systemDirectory(snapshot: PlatformAccessSnapshot, pages: readonly { id: string; title: string }[]): DirectoryItem[] {
  const items = new Map<string, DirectoryItem>(catalog.map(item => [item.id, { ...item, url: null }]))
  for (const app of snapshot.applications) {
    if (app.appId === 'product_hub') continue
    const url = applicationHome(snapshot, app)
    if (!url) continue
    const existing = items.get(app.appId)
    items.set(app.appId, { id: app.appId, title: existing?.title ?? app.displayName, description: existing?.description ?? '已授权应用', url })
  }
  for (const page of pages) {
    if (page.id.startsWith('cloud:') || page.id === 'product_hub') continue
    const existing = items.get(page.id)
    items.set(page.id, { id: page.id, title: existing?.title ?? page.title, description: existing?.description ?? '本地业务工作台', pageId: page.id, url: existing?.url ?? null })
  }
  return [...items.values()]
}

export function createCloudSystemPage(controller: SidebarAccountController, appId: string) {
  return function CloudSystemPage() {
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    const item = systemDirectory(snapshot, []).find(entry => entry.id === appId)
    return <section className="fs-cloud-entry">
      <span className="fs-cloud-kicker">系统工作台</span>
      <h1>{item?.title ?? '系统入口'}</h1><p>{item?.description}</p>
      {item?.url ? <><p>使用当前主体的授权入口进入工作台。云端页面将在浏览器中打开。</p>
        <button type="button" onClick={() => {
          const current = controller.getSnapshot()
          const app = current.applications.find(entry => entry.appId === appId)
          const url = app ? applicationHome(current, app) : null
          if (url) window.open(url, '_blank', 'noopener,noreferrer')
        }}>打开工作台 ↗</button></> : <p role="status">当前主体尚无可用入口，请核对平台授权。</p>}
    </section>
  }
}
