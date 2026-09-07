import type { PlatformAccessController, PlatformAccessSnapshot } from './controller.js'

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

export function renderPlatformAccessView(state: PlatformAccessSnapshot): string {
  const banner = '<p role="note" data-mock="true">本地模拟数据 · 契约 0.1.0</p>'
  if (state.phase === 'signed_out') {
    return `<section data-state="signed_out"><h2>连接 FutureStaff</h2>${banner}<p>登录后查看租户和已授权应用。</p><button data-action="login">模拟登录</button></section>`
  }
  if (state.phase === 'loading') {
    return `<section data-state="loading" aria-busy="true"><h2>正在加载</h2>${banner}<p>正在读取登录、租户和应用授权…</p></section>`
  }
  if (state.phase === 'expired') {
    return `<section data-state="expired"><h2>登录已过期</h2>${banner}<p>${escape(state.error?.message ?? '请重新登录。')}</p><button data-action="login">重新登录</button></section>`
  }
  if (state.phase === 'error') {
    return `<section data-state="error"><h2>加载失败</h2>${banner}<p>${escape(state.error?.message ?? '请稍后重试。')}</p><button data-action="retry">重试</button><button data-action="logout">退出</button></section>`
  }

  const tenantOptions = state.tenants.map(item => `<option value="${escape(item.tenantId)}"${item.tenantId === state.activeTenantId ? ' selected' : ''}>${escape(item.displayName)}</option>`).join('')
  const applications = state.phase === 'no_apps'
    ? '<p data-empty="applications">当前租户没有已授权应用。</p>'
    : `<ul>${state.applications.map(item => `<li data-app-id="${escape(item.appId)}"><strong>${escape(item.displayName)}</strong><span>${escape(item.capabilities.join('、'))}</span></li>`).join('')}</ul>`
  return `<section data-state="${state.phase}"><header><div><h2>${escape(state.user?.displayName ?? 'FutureStaff 用户')}</h2>${banner}</div><button data-action="refresh">刷新</button><button data-action="logout">退出</button></header><label>当前租户<select data-action="switch-tenant">${tenantOptions}</select></label><h3>已授权应用</h3>${applications}</section>`
}

/** Mount the framework-neutral B01a panel into a desktop-owned DOM slot. */
export function mountPlatformAccessPanel(root: HTMLElement, controller: PlatformAccessController): () => void {
  const render = (): void => { root.innerHTML = renderPlatformAccessView(controller.getSnapshot()) }
  const activate = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const action = target.dataset.action
    if (action === 'login') void controller.loginWithMock()
    if (action === 'refresh') void controller.refresh()
    if (action === 'logout') void controller.logout()
    if (action === 'retry') {
      void (controller.getSnapshot().user === undefined ? controller.loginWithMock() : controller.refresh())
    }
  }
  const switchTenant = (event: Event): void => {
    const target = event.target
    if (target instanceof HTMLSelectElement && target.dataset.action === 'switch-tenant') {
      void controller.switchTenant(target.value)
    }
  }
  const unsubscribe = controller.subscribe(render)
  root.addEventListener('click', activate)
  root.addEventListener('change', switchTenant)
  render()
  return () => {
    unsubscribe()
    root.removeEventListener('click', activate)
    root.removeEventListener('change', switchTenant)
    root.replaceChildren()
  }
}
