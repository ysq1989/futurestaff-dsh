import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { SidebarRootComponentProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { PlatformAccessSnapshot } from '../controller.js'

export interface SidebarAccountController {
  subscribe(listener: () => void): () => void
  getSnapshot(): PlatformAccessSnapshot
  logout(): Promise<void>
}

export function sidebarIdentity(snapshot: PlatformAccessSnapshot) {
  const tenant = ['ready', 'no_apps'].includes(snapshot.phase)
    ? snapshot.tenants.find(item => item.tenantId === snapshot.activeTenantId) : undefined
  return {
    tenantName: tenant?.displayName ?? 'FutureStaff Agent',
    logoUrl: tenant?.logoUrl ?? undefined,
    userName: tenant ? snapshot.user?.displayName ?? '用户' : '未登录',
  }
}

/** Read the installed shell's metadata, not a separately hardcoded UI version. */
export function sidebarVersion(search: string): string | undefined {
  const version = new URLSearchParams(search).get('dsh-desktop-version')
  return version && /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version) ? version : undefined
}

export const sidebarCss = `
.fs-sidebar{--dsh-sidebar-inline-padding:12px;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;padding:12px;gap:12px;background:var(--bg-secondary);color:var(--text-primary);font-size:14px}
.fs-sidebar button{font:inherit;color:inherit;cursor:pointer;border:0;background:transparent;border-radius:8px;min-height:36px}
.fs-sidebar button:hover{background:var(--bg-hover)}.fs-sidebar button:focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
.fs-sidebar-brand{display:flex;align-items:center;gap:9px;min-width:0}.fs-sidebar-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600}
.fs-sidebar-avatar{display:grid;place-items:center;flex-shrink:0;width:30px;height:30px;border-radius:8px;object-fit:contain;background:var(--bg-active);color:var(--accent-primary);font-weight:600}
.fs-sidebar-new{width:100%;flex-shrink:0;background:var(--accent-primary)!important;color:var(--fs-on-accent,#fff)!important;font-weight:600!important;margin-bottom:14px;box-shadow:0 3px 9px color-mix(in srgb,var(--accent-primary) 14%,transparent)}.fs-sidebar-new:hover{background:var(--accent-hover,var(--accent-primary))!important}
.fs-sidebar-tabs{display:flex;border-radius:10px;background:color-mix(in srgb,var(--accent-primary) 6%,var(--bg-secondary));padding:4px;gap:4px}.fs-sidebar-tabs button{flex:1;color:var(--text-secondary);min-height:34px}.fs-sidebar-tabs button[aria-selected=true]{background:var(--accent-primary);color:var(--fs-on-accent,#fff);font-weight:600;box-shadow:0 2px 6px color-mix(in srgb,var(--accent-primary) 12%,transparent)}
.fs-sidebar-region{flex:1;min-height:0;display:flex;flex-direction:column}.fs-sidebar-region[hidden]{display:none}.fs-sidebar-menu{gap:6px;overflow:auto}.fs-sidebar-menu:empty:after{content:'暂无菜单';color:var(--text-tertiary);padding:12px}
.fs-sidebar-footer{position:relative;flex-shrink:0;border-top:1px solid color-mix(in srgb,var(--accent-primary) 12%,var(--border-default));padding-top:10px}.fs-sidebar-user{display:flex;align-items:center;gap:9px;width:100%;text-align:left;padding:9px!important;background:color-mix(in srgb,var(--accent-primary) 6%,var(--bg-secondary))!important}.fs-sidebar-user-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fs-sidebar-version{display:block;text-align:center;color:var(--text-tertiary);font-size:11px;padding:5px}
.fs-sidebar-account{position:absolute;bottom:100%;left:0;right:0;z-index:20}.fs-sidebar-account[data-open=true]{background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:10px;padding:6px;box-shadow:0 8px 24px var(--fs-shadow)}
/* Keep the native settings modal and onboarding mounted; hide only its trigger row. */
.fs-sidebar-account[data-open=false]>.fs-sidebar-settings>div:not([data-slot]):first-child,.fs-sidebar-account[data-open=false]>.fs-sidebar-settings>[data-slot="sidebar.settings"]>div:first-child{display:none}.fs-sidebar-exit{width:100%;text-align:left;color:var(--error)!important;padding:8px!important}
.fs-sidebar[data-collapsed=true]{padding:12px 8px}.fs-sidebar[data-collapsed=true] .fs-sidebar-brand{justify-content:center}.fs-sidebar[data-collapsed=true] .fs-sidebar-tabs{flex-direction:column}.fs-sidebar[data-collapsed=true] .fs-sidebar-name,.fs-sidebar[data-collapsed=true] .fs-sidebar-version{display:none}
`

function SubjectLogo({ name, url }: { name: string; url: string | undefined }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [url])
  return url && !failed
    ? <img className="fs-sidebar-avatar" src={url} alt={`${name} Logo`} referrerPolicy="no-referrer" onError={() => { setFailed(true) }} />
    : <span className="fs-sidebar-avatar" aria-hidden="true">{Array.from(name)[0]}</span>
}

export function createAccountSidebar(controller: SidebarAccountController) {
  return function FutureStaffAccountSidebar({ collapsed, startSession, toggleSidebar, renderSlot }: SidebarRootComponentProps) {
    const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    const identity = sidebarIdentity(snapshot)
    const [tab, setTab] = useState<'sessions' | 'menu'>('sessions')
    const [accountOpen, setAccountOpen] = useState(false)
    const footer = useRef<HTMLDivElement>(null)
    const userButton = useRef<HTMLButtonElement>(null)
    const version = typeof window === 'undefined' ? undefined : sidebarVersion(window.location.search)
    useEffect(() => { setAccountOpen(false); setTab('sessions') }, [snapshot.activeTenantId, snapshot.user?.userId])
    useEffect(() => {
      if (!accountOpen) return
      const pointer = (event: PointerEvent) => {
        // Native settings dialogs are portals or fixed descendants; let them own dismissal.
        if (document.querySelector('[role="dialog"]')) return
        if (!footer.current?.contains(event.target as Node)) setAccountOpen(false)
      }
      const key = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) {
          setAccountOpen(false); userButton.current?.focus()
        }
      }
      document.addEventListener('pointerdown', pointer); document.addEventListener('keydown', key)
      return () => { document.removeEventListener('pointerdown', pointer); document.removeEventListener('keydown', key) }
    }, [accountOpen])
    const chooseTab = (next: 'sessions' | 'menu') => { setTab(next); if (collapsed) toggleSidebar() }
    const switchByKey = (event: React.KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
      event.preventDefault()
      const next = event.key === 'Home' ? 'sessions' : event.key === 'End' ? 'menu' : tab === 'sessions' ? 'menu' : 'sessions'
      chooseTab(next)
      document.getElementById(next === 'sessions' ? 'fs-sessions-tab' : 'fs-menu-tab')?.focus()
    }
    return <aside className="fs-sidebar" data-collapsed={collapsed} aria-label="主体导航">
      <style>{sidebarCss}</style>
      <header className="fs-sidebar-brand">
        {!collapsed && <><SubjectLogo name={identity.tenantName} url={identity.logoUrl} /><span className="fs-sidebar-name" title={identity.tenantName}>{identity.tenantName}</span></>}
        <button type="button" aria-label={collapsed ? '展开侧栏' : '收起侧栏'} onClick={toggleSidebar}>☰</button>
      </header>
      <div className="fs-sidebar-tabs" role="tablist" aria-label="侧栏内容" aria-orientation={collapsed ? 'vertical' : 'horizontal'} onKeyDown={switchByKey}>
        <button type="button" role="tab" id="fs-sessions-tab" tabIndex={tab === 'sessions' ? 0 : -1} aria-controls="fs-sessions-panel" aria-selected={tab === 'sessions'} onClick={() => { chooseTab('sessions') }}>会话</button>
        <button type="button" role="tab" id="fs-menu-tab" tabIndex={tab === 'menu' ? 0 : -1} aria-controls="fs-menu-panel" aria-selected={tab === 'menu'} onClick={() => { chooseTab('menu') }}>菜单</button>
      </div>
      <section key={`sessions:${snapshot.activeTenantId ?? 'signed-out'}`} className="fs-sidebar-region" id="fs-sessions-panel" role="tabpanel" aria-labelledby="fs-sessions-tab" hidden={tab !== 'sessions'}>
        <button type="button" className="fs-sidebar-new" aria-label="新会话" onClick={() => { startSession() }}>{collapsed ? '+' : '+ 新会话'}</button>
        {renderSlot('sidebar.workspaces', { wide: !collapsed, expandSidebar: () => { if (collapsed) toggleSidebar() } })}
      </section>
      <section key={`menu:${snapshot.activeTenantId ?? 'signed-out'}`} className="fs-sidebar-region fs-sidebar-menu" id="fs-menu-panel" role="tabpanel" aria-labelledby="fs-menu-tab" hidden={tab !== 'menu'}>
        {renderSlot('sidebar.footer.action', { wide: !collapsed })}
      </section>
      <footer className="fs-sidebar-footer" ref={footer}>
        <div className="fs-sidebar-account" data-open={accountOpen}>
          <div key={snapshot.activeTenantId ?? 'signed-out'} className="fs-sidebar-settings">{renderSlot('sidebar.settings', { wide: true })}</div>
          {accountOpen && <button type="button" className="fs-sidebar-exit" onClick={() => { setAccountOpen(false); void controller.logout() }}>退出登录</button>}
        </div>
        <button ref={userButton} type="button" className="fs-sidebar-user" aria-label={`${identity.userName}，用户菜单`} aria-expanded={accountOpen} onClick={() => { if (collapsed) toggleSidebar(); setAccountOpen(value => !value) }}>
          <span className="fs-sidebar-avatar" aria-hidden="true">{Array.from(identity.userName)[0]}</span>
          {!collapsed && <><span className="fs-sidebar-user-name">{identity.userName}</span><span aria-hidden="true">{accountOpen ? '⌃' : '⌄'}</span></>}
        </button>
        {!collapsed && <span className="fs-sidebar-version">{version ? `v${version}` : '版本信息不可用'}</span>}
      </footer>
    </aside>
  }
}
