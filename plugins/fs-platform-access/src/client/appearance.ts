import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-theme/client'

// Map the product palette through the public theme seam; do not edit upstream CSS.
const palette = {
  '--bg-primary': ['#eff6ff', '#17181b'], '--bg-secondary': ['#ffffff', '#111215'],
  '--bg-tertiary': ['#f8fafc', '#222327'], '--bg-elevated': ['#ffffff', '#26272c'],
  '--bg-hover': ['#dbeafe', '#2b2c32'], '--bg-active': ['#dbeafe', '#30313b'],
  '--text-primary': ['#0f172a', '#eeeef2'], '--text-secondary': ['#475569', '#b1b2bd'],
  '--text-tertiary': ['#64748b', '#92939f'], '--border-default': ['#cbd5e1', '#33343c'],
  '--accent-primary': ['#2563eb', '#60a5fa'], '--accent-hover': ['#1d4ed8', '#93c5fd'],
  '--fs-cyan': ['#475569', '#b1b2bd'], '--fs-button-start': ['#2563eb', '#2563eb'],
  '--fs-button-end': ['#1d4ed8', '#1d4ed8'], '--fs-on-accent': ['#ffffff', '#ffffff'],
  '--fs-shadow': ['rgba(24,25,32,.06)', 'rgba(0,0,0,.12)'],
  '--success': ['#16854c', '#4ade80'], '--warning': ['#91610b', '#fbbf24'],
  '--error': ['#bd334c', '#ff8da2'],
} as const
const aliases: Record<string, keyof typeof palette> = {
  'bg-base': '--bg-primary', 'bg-layer-1': '--bg-secondary', 'bg-layer-2': '--bg-tertiary',
  'bg-layer-3': '--bg-elevated', 'bg-overlay': '--bg-elevated', 'bg-module-platform': '--bg-primary',
  'label-primary': '--text-primary', 'label-primary-bluish': '--text-primary',
  'label-primary-foreground': '--text-primary', 'label-secondary': '--text-secondary',
  'label-tertiary': '--text-tertiary', 'label-caption': '--text-secondary', 'label-dimmed': '--text-tertiary',
  'border-l1': '--border-default', 'border-l2': '--border-default', 'border-l3': '--border-default',
  'brand-primary': '--accent-primary', 'brand-text': '--accent-primary',
  'interactive-bg-hover': '--bg-hover', 'interactive-bg-active': '--bg-active',
  'button-elevated-fill': '--bg-elevated', 'button-floating-fill': '--bg-elevated',
  'button-primary-fill': '--fs-button-start', 'button-primary-hover': '--fs-button-end',
  'toast-bg': '--bg-elevated', 'tooltip-bg': '--bg-elevated',
  'markdown-code-block': '--bg-secondary', 'markdown-code-block-banner': '--bg-tertiary',
  'markdown-inline-code': '--bg-tertiary', 'state-success-primary': '--success',
  'state-warn-primary': '--warning', 'state-error-primary': '--error',
}
export const appearanceTokens = Object.fromEntries([
  ...Object.entries(palette).map(([key, [light, dark]]) => [key, { light, dark }]),
  ...Object.entries(aliases).map(([name, key]) => [`--dsw-alias-${name}`, { light: palette[key][0], dark: palette[key][1] }]),
  ...['sidebar-fill', 'bubble', 'input-major', 'login-input', 'menu', 'selector'].map(name =>
    [`--dsw-specific-${name}`, { light: palette['--bg-secondary'][0], dark: palette['--bg-secondary'][1] }]),
])

export const appearanceCss = `
body[data-futurestaff-skin]{--font-family:'Segoe UI','Microsoft YaHei UI',system-ui,sans-serif;--radius-lg:12px;--radius-md:8px;--shadow-lg:0 16px 48px var(--fs-shadow);--dsh-desktop-frame-fill:var(--bg-secondary)!important;color:var(--text-primary);background:var(--bg-primary)}
body[data-futurestaff-skin] .dshDesktopConversationSurface{background:var(--bg-primary)}
body[data-futurestaff-skin] .dshDesktopSidebarSurface{background:var(--bg-secondary)!important}
body[data-futurestaff-skin] :is(.dshDesktopWindowsCaptionRow,.dshDesktopMacCaptionRow,.dshDesktopFrameTitlebar){background:var(--bg-secondary);border-bottom:1px solid var(--border-default)}
body[data-futurestaff-skin] :is([aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]){display:flex;align-items:center;justify-content:flex-start;gap:8px;min-height:36px;border:1px solid transparent;border-radius:8px;background:transparent;color:var(--text-secondary);font:inherit;text-align:left;cursor:pointer;transition:background .15s,color .15s}
body[data-futurestaff-skin] :is([aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]):hover{color:var(--text-primary);background:var(--bg-hover)}
body[data-futurestaff-skin] :is([aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]):focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}
body[data-futurestaff-skin] :is([aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]):disabled{opacity:.5;cursor:default}
.futurestaff-access{--fs-accent:var(--accent-primary);--fs-muted:var(--text-secondary);--fs-border:var(--border-default);color:var(--text-primary)}
.futurestaff-access .fs-panel{background:var(--bg-elevated);box-shadow:0 8px 24px var(--fs-shadow)}
.futurestaff-access button[data-kind=primary]{background:var(--fs-button-start);color:var(--fs-on-accent);box-shadow:none}
.futurestaff-access button[data-kind=primary]:hover{background:var(--fs-button-end)}
.futurestaff-access :is(.fs-avatar,.fs-state-mark){background:var(--fs-button-start);box-shadow:none}
.futurestaff-access :is(input,select){background:var(--bg-tertiary)}
.futurestaff-access select option{color:var(--text-primary);background:var(--bg-elevated)}
.futurestaff-access .fs-brand-logo{object-fit:contain;border-radius:0;background:transparent;box-shadow:none}
.futurestaff-login-gate{background:var(--bg-primary)}
.futurestaff-login-gate .fs-panel{background:var(--bg-elevated);border:1px solid var(--border-default);box-shadow:0 16px 48px var(--fs-shadow);position:relative;overflow:hidden}
.futurestaff-login-gate .fs-kicker{color:var(--text-secondary)}
@media(prefers-reduced-motion:reduce){body[data-futurestaff-skin] :is([aria-label="打开抖音获客"],[aria-label="打开线上选品中心"]){transition:none}}
`.replace(/^\.futurestaff/gm, 'body[data-futurestaff-skin] .futurestaff')
  // Installed 2.0.10 profiles may still use the shorter accessible launcher name.
  .replaceAll('[aria-label="打开线上选品中心"]', '[aria-label="打开线上选品中心"],[aria-label="打开选品中心"]')

/** Apply the requested light default once; later Appearance choices remain authoritative. */
export function adoptBlueWhiteDefault(theme: { setTheme(id: string): void }, storage: Pick<Storage, 'getItem' | 'setItem'>): void {
  const key = 'futurestaff.appearance.blue-white.v1'
  try { if (storage.getItem(key) === 'applied') return } catch { /* Apply light even when storage is blocked. */ }
  theme.setTheme('light')
  try { storage.setItem(key, 'applied') } catch { /* The next launch can safely retry this migration. */ }
}

export function installAppearance(ctx: Context): void {
  if (typeof document === 'undefined') return
  ctx.inject(['theme'], context => {
    context.effect(() => context.theme.overrideTokens('futurestaff-blue-white', appearanceTokens))
    // Storage contains only a migration marker, never account/session data.
    try { adoptBlueWhiteDefault(context.theme, window.localStorage) } catch { /* Storage may be disabled. */ }
    context.effect(() => {
      const style = document.createElement('style')
      style.dataset.pluginCss = 'futurestaff/blue-white'
      style.textContent = appearanceCss
      document.head.appendChild(style)
      document.body.setAttribute('data-futurestaff-skin', 'blue-white')
      return () => { style.remove(); document.body.removeAttribute('data-futurestaff-skin') }
    })
  })
}
