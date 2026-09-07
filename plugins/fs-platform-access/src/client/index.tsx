import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createElement, useEffect, useMemo, useRef } from 'react'
import { PlatformMockApi } from '../api.js'
import { PlatformAccessController } from '../controller.js'
import { InMemoryTenantResources } from '../isolation.js'
import { mountPlatformAccessPanel } from '../view.js'

const ROUTE_PREFIX = '/_futurestaff/platform-mock'
export const platformAccessPanelCss = `
.futurestaff-access{--fs-accent:#5b6cff;--fs-accent-soft:color-mix(in srgb,var(--fs-accent) 12%,transparent);--fs-border:color-mix(in srgb,currentColor 13%,transparent);--fs-muted:color-mix(in srgb,currentColor 66%,transparent);box-sizing:border-box;max-width:880px;min-width:0;color:var(--color-text,#172033);font-size:14px;line-height:1.5}
.futurestaff-access *{box-sizing:border-box}.futurestaff-access h2,.futurestaff-access h3,.futurestaff-access p{margin:0}.futurestaff-access button,.futurestaff-access select{font:inherit;color:inherit}
.futurestaff-access .fs-panel{display:grid;gap:22px;min-width:0;padding:26px;border:1px solid var(--fs-border);border-radius:20px;background:linear-gradient(145deg,color-mix(in srgb,var(--fs-accent) 5%,transparent),transparent 38%),color-mix(in srgb,currentColor 2.5%,transparent);box-shadow:0 18px 48px color-mix(in srgb,#111827 8%,transparent)}
.futurestaff-access .fs-header{display:flex;align-items:flex-start;justify-content:space-between;gap:18px}.futurestaff-access .fs-identity{display:flex;align-items:center;gap:13px;min-width:0}.futurestaff-access .fs-identity>div:last-child{min-width:0}.futurestaff-access .fs-avatar,.futurestaff-access .fs-state-mark{display:grid;flex:0 0 auto;place-items:center;width:46px;height:46px;border-radius:14px;background:linear-gradient(145deg,var(--fs-accent),#7c4dff);color:#fff;font-weight:760;letter-spacing:.02em;box-shadow:0 8px 18px color-mix(in srgb,var(--fs-accent) 27%,transparent)}
.futurestaff-access .fs-kicker{margin-bottom:2px;color:var(--fs-accent);font-size:.72rem;font-weight:760;letter-spacing:.09em;text-transform:uppercase}.futurestaff-access h2{overflow-wrap:anywhere;font-size:1.28rem;line-height:1.3}.futurestaff-access h3{font-size:1rem}.futurestaff-access .fs-user-email,.futurestaff-access .fs-app-id{display:block;overflow:hidden;color:var(--fs-muted);font-size:.8rem;text-overflow:ellipsis;white-space:nowrap}
.futurestaff-access .fs-header-actions,.futurestaff-access .fs-actions{display:flex;flex-wrap:wrap;gap:8px}.futurestaff-access button{min-height:38px;padding:8px 13px;border:1px solid var(--fs-border);border-radius:10px;background:color-mix(in srgb,currentColor 3%,transparent);cursor:pointer;transition:border-color .16s ease,background .16s ease,transform .16s ease}.futurestaff-access button:hover{border-color:color-mix(in srgb,var(--fs-accent) 55%,transparent);background:var(--fs-accent-soft)}.futurestaff-access button:active{transform:translateY(1px)}.futurestaff-access button[data-kind=primary]{border-color:transparent;background:var(--fs-accent);color:#fff;font-weight:680}
.futurestaff-access button:focus-visible,.futurestaff-access select:focus-visible{outline:3px solid color-mix(in srgb,var(--fs-accent) 35%,transparent);outline-offset:2px}
.futurestaff-access .fs-summary{display:flex;align-items:center;justify-content:space-between;gap:12px;min-width:0}.futurestaff-access .fs-mock-badge{display:inline-flex;align-items:center;gap:7px;min-width:0;padding:5px 9px;border:1px solid color-mix(in srgb,#e6a700 35%,transparent);border-radius:999px;background:color-mix(in srgb,#e6a700 10%,transparent);font-size:.76rem;font-weight:620}.futurestaff-access .fs-mock-badge>span{width:7px;height:7px;border-radius:50%;background:#e6a700;box-shadow:0 0 0 3px color-mix(in srgb,#e6a700 16%,transparent)}.futurestaff-access .fs-count{color:var(--fs-muted);font-size:.8rem;white-space:nowrap}
.futurestaff-access .fs-tenant{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,310px);align-items:end;gap:18px;padding:17px;border:1px solid var(--fs-border);border-radius:14px;background:color-mix(in srgb,currentColor 2%,transparent)}.futurestaff-access .fs-tenant label{font-weight:680}.futurestaff-access .fs-tenant p,.futurestaff-access .fs-apps-heading p,.futurestaff-access .fs-empty p,.futurestaff-access .fs-lead{color:var(--fs-muted)}.futurestaff-access .fs-tenant p,.futurestaff-access .fs-apps-heading p{margin-top:2px;font-size:.8rem}.futurestaff-access .fs-select-wrap{display:flex;align-items:center;gap:8px;min-width:0}.futurestaff-access select{width:100%;min-width:0;min-height:40px;padding:8px 34px 8px 11px;border:1px solid var(--fs-border);border-radius:10px;background:color-mix(in srgb,currentColor 2.5%,transparent)}.futurestaff-access .fs-role{flex:0 0 auto;padding:4px 7px;border-radius:7px;background:var(--fs-accent-soft);color:var(--fs-accent);font-size:.7rem;font-weight:700}
.futurestaff-access .fs-apps-heading{display:flex;align-items:center;justify-content:space-between;gap:12px}.futurestaff-access .fs-apps-heading>span{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--fs-accent-soft);color:var(--fs-accent);font-size:.78rem;font-weight:760}.futurestaff-access .fs-app-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:0;padding:0;list-style:none}.futurestaff-access .fs-app-grid li{display:flex;align-items:flex-start;gap:11px;min-width:0;padding:15px;border:1px solid var(--fs-border);border-radius:14px;background:color-mix(in srgb,currentColor 1.5%,transparent)}.futurestaff-access .fs-app-icon{display:grid;flex:0 0 auto;place-items:center;width:38px;height:38px;border-radius:11px;background:var(--fs-accent-soft);color:var(--fs-accent);font-weight:780}.futurestaff-access .fs-app-copy{min-width:0}.futurestaff-access .fs-app-copy>strong{display:block;overflow-wrap:anywhere}.futurestaff-access .fs-capabilities{display:flex;flex-wrap:wrap;gap:5px;margin-top:9px}.futurestaff-access [data-capability=true]{max-width:100%;padding:3px 7px;border:1px solid var(--fs-border);border-radius:999px;color:var(--fs-muted);font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:.68rem;overflow-wrap:anywhere}
.futurestaff-access .fs-empty{display:grid;justify-items:center;gap:5px;padding:30px 18px;border:1px dashed color-mix(in srgb,currentColor 20%,transparent);border-radius:14px;text-align:center}.futurestaff-access .fs-empty-mark{display:grid;place-items:center;width:42px;height:42px;margin-bottom:4px;border-radius:13px;background:var(--fs-accent-soft);color:var(--fs-accent);font-weight:780}
.futurestaff-access .fs-state{grid-template-columns:auto minmax(0,1fr);align-items:start}.futurestaff-access .fs-state-copy{display:grid;gap:11px;min-width:0}.futurestaff-access .fs-state .fs-state-mark{width:50px;height:50px}.futurestaff-access .fs-state .fs-actions{margin-top:4px}.futurestaff-access .fs-skeletons{display:grid;gap:8px;margin-top:4px}.futurestaff-access .fs-skeletons span{height:12px;border-radius:999px;background:linear-gradient(90deg,var(--fs-border),color-mix(in srgb,currentColor 7%,transparent),var(--fs-border));background-size:200% 100%;animation:fs-shimmer 1.25s ease-in-out infinite}.futurestaff-access .fs-skeletons span:nth-child(2){width:78%}.futurestaff-access .fs-skeletons span:nth-child(3){width:52%}
@keyframes fs-shimmer{to{background-position:-200% 0}}
@media (max-width: 640px){.futurestaff-access .fs-panel{gap:18px;padding:18px;border-radius:16px}.futurestaff-access .fs-header{display:grid}.futurestaff-access .fs-header-actions{width:100%}.futurestaff-access .fs-header-actions button{flex:1}.futurestaff-access .fs-tenant{grid-template-columns:1fr;gap:12px}.futurestaff-access .fs-app-grid{grid-template-columns:1fr}.futurestaff-access .fs-state{grid-template-columns:1fr}.futurestaff-access .fs-state-mark{display:none}.futurestaff-access .fs-actions button{flex:1}.futurestaff-access .fs-summary{align-items:flex-start;flex-direction:column}.futurestaff-access .fs-count{align-self:flex-end}}
@media (prefers-reduced-motion: reduce){.futurestaff-access *{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}
`

function sameOriginMockFetch(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  return fetch(`${ROUTE_PREFIX}${new URL(input instanceof Request ? input.url : input).pathname}`, init)
}

export function FutureStaffPlatformAccessSection() {
  const root = useRef<HTMLDivElement>(null)
  const controller = useMemo(() => new PlatformAccessController(
    new PlatformMockApi(sameOriginMockFetch),
    new InMemoryTenantResources(),
  ), [])
  useEffect(() => {
    if (root.current === null) return
    return mountPlatformAccessPanel(root.current, controller)
  }, [controller])
  return createElement('div', { className: 'futurestaff-access' },
    createElement('style', null, platformAccessPanelCss),
    createElement('div', { ref: root }),
  )
}

export const inject = ['slots']

/** Mount the FutureStaff access panel as an actual DSH Settings section. */
export function apply(ctx: ClientContext): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section', id: 'futurestaff-access', order: -10, label: 'FutureStaff',
  }, FutureStaffPlatformAccessSection))
}
