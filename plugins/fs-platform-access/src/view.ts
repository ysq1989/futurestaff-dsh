import { futureStaffLogoUrl } from './brand.js'
import type { PlatformAccessSnapshot } from './controller.js'
import type { PasswordLoginInput } from './contracts.js'
import type { LoginHints } from './login-preferences.js'

export interface PlatformAccessViewController {
  getSnapshot(): PlatformAccessSnapshot
  getLoginHints?(): LoginHints
  subscribe(listener: () => void): () => void
  startLogin(): Promise<void>
  loginWithPassword?(input: PasswordLoginInput): Promise<void>
  selectLoginTenant?(tenantId: string): Promise<void>
  refresh(): Promise<void>
  switchTenant(tenantId: string): Promise<void>
  logout(): Promise<void>
}

function escape(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}

function actionButton(action: string, label: string, kind: 'primary' | 'quiet' = 'quiet'): string {
  return `<button data-action="${action}" type="button" data-kind="${kind}">${label}</button>`
}

function loginForm(message = '先验证 FutureStaff 账号，再选择租户登录。各租户使用独立的本地工作空间。'): string {
  return `<p class="fs-lead">${escape(message)}</p><form class="fs-login-form" data-action="password-login"><label for="futurestaff-login-identifier">账号</label><input id="futurestaff-login-identifier" name="loginIdentifier" type="text" autocomplete="username" maxlength="254" required placeholder="邮箱、手机号或用户名"><label for="futurestaff-login-password">密码</label><input id="futurestaff-login-password" name="password" type="password" autocomplete="current-password" maxlength="128" required placeholder="请输入密码"><button type="submit" data-kind="primary">登录</button></form>`
}

function stateShell(phase: string, title: string, body: string, options: { alert?: boolean; busy?: boolean } = {}): string {
  const semantics = options.alert
    ? ' role="alert" aria-live="assertive"'
    : options.busy
      ? ' role="status" aria-live="polite" aria-busy="true"'
      : ''
  return `<section class="fs-panel fs-state" data-state="${phase}" aria-labelledby="futurestaff-access-title"${semantics}><img class="fs-state-mark fs-brand-logo" src="${futureStaffLogoUrl}" alt="FutureStaff"><div class="fs-state-copy"><div class="fs-kicker">FutureStaff 访问中心</div><h2 id="futurestaff-access-title">${title}</h2>${body}</div></section>`
}

export function renderPlatformAccessView(state: PlatformAccessSnapshot, hints: LoginHints = {}): string {
  const configuredModels = state.models ?? []
  if (state.phase === 'signed_out') {
    if (state.simulated) return stateShell('signed_out', '连接你的工作空间', `<div class="fs-actions">${actionButton('login', '模拟登录', 'primary')}</div>`)
    return stateShell('signed_out', '登录 FutureStaff', loginForm())
  }
  if (state.phase === 'loading') {
    return stateShell('loading', '正在登录', '<p class="fs-lead">正在读取账号、模型和应用授权…</p><div class="fs-skeletons" data-skeleton="true" aria-hidden="true"><span></span><span></span><span></span></div>', { busy: true })
  }
  if (state.phase === 'selecting_tenant') {
    const choices = state.tenants.map(item => `<option value="${escape(item.tenantId)}"${item.tenantId === hints.tenantId ? ' selected' : ''}>${escape(item.displayName)}</option>`).join('')
    return stateShell('selecting_tenant', '选择租户登录', `<p class="fs-lead">账号已验证。请选择本次工作的租户；登录后会打开该租户独立的对话与数据目录。</p><form class="fs-login-form" data-action="tenant-login"><label for="futurestaff-login-tenant">租户</label><select id="futurestaff-login-tenant" name="tenantId" required><option value="">请选择租户</option>${choices}</select><button type="submit" data-kind="primary">登录此租户</button></form><div class="fs-actions">${actionButton('logout', '返回账号登录')}</div>`)
  }
  if (state.phase === 'expired') {
    return stateShell('expired', '登录已过期', loginForm(state.error?.message ?? '请重新登录。'), { alert: true })
  }
  if (state.phase === 'error') {
    if (state.user === undefined) return stateShell('error', '登录失败', loginForm(state.error?.message ?? '请检查账号和密码。'), { alert: true })
    return stateShell('error', '加载失败', `<p class="fs-lead">${escape(state.error?.message ?? '请稍后重试。')}</p><div class="fs-actions">${actionButton('retry', '重试', 'primary')}${actionButton('logout', '退出登录')}</div>`, { alert: true })
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
  const models = configuredModels.length === 0
    ? '<div class="fs-empty" data-empty="models"><div class="fs-empty-mark" aria-hidden="true">0</div><strong>当前租户没有可用模型</strong><p>请联系平台管理员配置模型，或退出后重新选择有权限的租户登录。</p></div>'
    : `<ul class="fs-model-list">${configuredModels.map(item => `<li data-model-id="${escape(item.modelId)}"${item.modelId === state.activeModelId ? ' data-active="true"' : ''}><div><strong>${escape(item.displayName)}</strong><span>${escape(item.provider)} · ${escape(item.model)}</span></div>${item.modelId === state.activeModelId ? '<em>当前模型</em>' : ''}</li>`).join('')}</ul>`
  return `<section class="fs-panel" data-state="${state.phase}" aria-labelledby="futurestaff-access-title"><header class="fs-header"><div class="fs-identity"><div class="fs-avatar" aria-hidden="true">${initial}</div><div><div class="fs-kicker">FutureStaff 访问中心</div><h2 id="futurestaff-access-title">${userName}</h2>${userEmail}</div></div><div class="fs-header-actions">${actionButton('refresh', '刷新')}${actionButton('logout', '退出')}</div></header><div class="fs-summary"><span class="fs-environment-badge"><span aria-hidden="true"></span>平台配置已同步</span><span class="fs-count">${configuredModels.length} 个模型 · ${applicationCount} 个应用</span></div>${state.simulated ? '' : '<p class="fs-support">平台接入、模型来源和租户数据隔离由 FutureStaff 统一管理；主题、语言和对话显示可在通用设置中调整。</p>'}<div class="fs-tenant"><div><label for="futurestaff-tenant-select">当前租户</label><p>对话和本地数据归属于此租户。需要更换租户时，请退出后重新登录。</p></div><div class="fs-select-wrap">${state.simulated ? `<select id="futurestaff-tenant-select" data-action="switch-tenant">${tenantOptions}</select>` : `<strong id="futurestaff-tenant-select">${escape(activeTenant?.displayName ?? "")}</strong>`}${role}</div></div><div class="fs-apps-heading"><div><h3>可用模型</h3><p>由平台管理员统一配置，此处仅展示。</p></div><span aria-hidden="true">${configuredModels.length}</span></div>${models}<div class="fs-apps-heading"><div><h3>已授权应用</h3><p>仅展示当前租户允许访问的能力。</p></div><span aria-hidden="true">${applicationCount}</span></div>${applications}</section>`
}

/** Mount the framework-neutral B01a panel into a desktop-owned DOM slot. */
export function mountPlatformAccessPanel(root: HTMLElement, controller: PlatformAccessViewController): () => void {
  const render = (): void => {
    const hints = controller.getLoginHints?.() ?? {}
    root.innerHTML = renderPlatformAccessView(controller.getSnapshot(), hints)
    const identifier = root.querySelector<HTMLInputElement>('input[name="loginIdentifier"]')
    if (identifier) identifier.value = hints.loginIdentifier ?? ''
  }
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
  const submit = (event: SubmitEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLFormElement) || !['password-login','tenant-login'].includes(target.dataset.action ?? '')) return
    event.preventDefault()
    const data = new FormData(target)
    const loginIdentifier = data.get('loginIdentifier')
    const password = data.get('password')
    if (target.dataset.action === 'tenant-login') {
      const tenantId = data.get('tenantId')
      if (typeof tenantId === 'string' && tenantId) void controller.selectLoginTenant?.(tenantId)
      return
    }
    if (typeof loginIdentifier === 'string' && typeof password === 'string') {
      void controller.loginWithPassword?.({ loginIdentifier, password })
    }
  }
  const unsubscribe = controller.subscribe(render)
  root.addEventListener('click', activate)
  root.addEventListener('change', switchTenant)
  root.addEventListener('submit', submit)
  render()
  return () => {
    unsubscribe()
    root.removeEventListener('click', activate)
    root.removeEventListener('change', switchTenant)
    root.removeEventListener('submit', submit)
    root.replaceChildren()
  }
}
