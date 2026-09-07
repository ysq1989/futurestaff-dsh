import type { PlatformAccessSnapshot } from './controller.js'

export interface PlatformAccessViewController {
  getSnapshot(): PlatformAccessSnapshot
  subscribe(listener: () => void): () => void
  startLogin(): Promise<void>
  refresh(): Promise<void>
  switchTenant(tenantId: string): Promise<void>
  logout(): Promise<void>
}

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function environmentBadge(state: PlatformAccessSnapshot): string {
  if (state.simulated) {
    return '<span class="fs-environment-badge fs-mock-badge" role="note" data-mock="true"><span aria-hidden="true"></span>本地 Mock · 契约 0.1.0</span>'
  }
  return '<span class="fs-environment-badge fs-dev-badge" role="note" data-dev="true"><span aria-hidden="true"></span>Platform DEV · 契约 0.1.1</span>'
}

function actionButton(action: string, label: string, kind: 'primary' | 'quiet' = 'quiet'): string {
  return `<button data-action="${action}" type="button" data-kind="${kind}">${label}</button>`
}

function stateShell(phase: string, title: string, body: string, options: { alert?: boolean; busy?: boolean } = {}): string {
  const semantics = options.alert
    ? ' role="alert" aria-live="assertive"'
    : options.busy
      ? ' role="status" aria-live="polite" aria-busy="true"'
      : ''
  return `<section class="fs-panel fs-state" data-state="${phase}" aria-labelledby="futurestaff-access-title"${semantics}><div class="fs-state-mark" aria-hidden="true">FS</div><div class="fs-state-copy"><div class="fs-kicker">FutureStaff 访问中心</div><h2 id="futurestaff-access-title">${title}</h2>${body}</div></section>`
}

export function renderPlatformAccessView(state: PlatformAccessSnapshot): string {
  if (state.phase === 'signed_out') {
    const body = state.simulated
      ? '登录后可查看已授权租户和应用。当前流程仅连接本机模拟服务，不会发送真实凭据。'
      : '使用系统浏览器登录 Platform DEV。凭据只保存在操作系统保护的本机存储中。'
    return stateShell('signed_out', '连接你的工作空间', `<p class="fs-lead">${body}</p>${environmentBadge(state)}<div class="fs-actions">${actionButton('login', state.simulated ? '模拟登录' : '登录 Platform DEV', 'primary')}</div>`)
  }
  if (state.phase === 'loading') {
    return stateShell('loading', '正在准备访问中心', `<p class="fs-lead">正在读取登录、租户和应用授权…</p>${environmentBadge(state)}<div class="fs-skeletons" data-skeleton="true" aria-hidden="true"><span></span><span></span><span></span></div>`, { busy: true })
  }
  if (state.phase === 'expired') {
    return stateShell('expired', '登录已过期', `<p class="fs-lead">${escape(state.error?.message ?? '请重新登录。')}</p>${environmentBadge(state)}<div class="fs-actions">${actionButton('login', '重新登录', 'primary')}</div>`, { alert: true })
  }
  if (state.phase === 'error') {
    return stateShell('error', '加载失败', `<p class="fs-lead">${escape(state.error?.message ?? '请稍后重试。')}</p>${environmentBadge(state)}<div class="fs-actions">${actionButton('retry', '重试', 'primary')}${actionButton('logout', '退出登录')}</div>`, { alert: true })
  }

  const tenantOptions = state.tenants.map(item => `<option value="${escape(item.tenantId)}"${item.tenantId === state.activeTenantId ? ' selected' : ''}>${escape(item.displayName)}</option>`).join('')
  const activeTenant = state.tenants.find(item => item.tenantId === state.activeTenantId)
  const applicationCount = state.applications.length
  const applications = state.phase === 'no_apps'
    ? '<div class="fs-empty" data-empty="applications"><div class="fs-empty-mark" aria-hidden="true">0</div><strong>当前租户没有已授权应用</strong><p>应用获得授权后会显示在这里。</p></div>'
    : `<ul class="fs-app-grid">${state.applications.map(item => `<li data-app-id="${escape(item.appId)}"><div class="fs-app-icon" aria-hidden="true">${escape(item.displayName.slice(0, 1).toUpperCase())}</div><div class="fs-app-copy"><strong>${escape(item.displayName)}</strong><span class="fs-app-id">${escape(item.appId)}</span><div class="fs-capabilities" aria-label="应用权限">${item.capabilities.map(capability => `<span data-capability="true">${escape(capability)}</span>`).join('')}</div></div></li>`).join('')}</ul>`
  const userName = escape(state.user?.displayName ?? 'FutureStaff 用户')
  const userEmail = state.user?.email == null ? '' : `<span class="fs-user-email">${escape(state.user.email)}</span>`
  const initial = escape((state.user?.displayName ?? 'F').slice(0, 1).toUpperCase())
  const role = activeTenant?.role === undefined ? '' : `<span class="fs-role">${escape(activeTenant.role)}</span>`
  return `<section class="fs-panel" data-state="${state.phase}" aria-labelledby="futurestaff-access-title"><header class="fs-header"><div class="fs-identity"><div class="fs-avatar" aria-hidden="true">${initial}</div><div><div class="fs-kicker">FutureStaff 访问中心</div><h2 id="futurestaff-access-title">${userName}</h2>${userEmail}</div></div><div class="fs-header-actions">${actionButton('refresh', '刷新')}${actionButton('logout', '退出')}</div></header><div class="fs-summary">${environmentBadge(state)}<span class="fs-count">${applicationCount} 个应用</span></div><div class="fs-tenant"><div><label for="futurestaff-tenant-select">当前租户</label><p>切换后会清除上一租户的本地缓存。</p></div><div class="fs-select-wrap"><select id="futurestaff-tenant-select" data-action="switch-tenant">${tenantOptions}</select>${role}</div></div><div class="fs-apps-heading"><div><h3>已授权应用</h3><p>仅展示当前租户允许访问的能力。</p></div><span aria-hidden="true">${applicationCount}</span></div>${applications}</section>`
}

/** Mount the framework-neutral B01a panel into a desktop-owned DOM slot. */
export function mountPlatformAccessPanel(root: HTMLElement, controller: PlatformAccessViewController): () => void {
  const render = (): void => { root.innerHTML = renderPlatformAccessView(controller.getSnapshot()) }
  const activate = (event: Event): void => {
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    const action = target.dataset.action
    if (action === 'login') void controller.startLogin()
    if (action === 'refresh') void controller.refresh()
    if (action === 'logout') void controller.logout()
    if (action === 'retry') {
      void (controller.getSnapshot().user === undefined ? controller.startLogin() : controller.refresh())
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
