import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { createElement, useEffect, useMemo, useRef } from 'react'
import { PlatformMockApi } from '../api.js'
import { PlatformAccessController } from '../controller.js'
import { InMemoryTenantResources } from '../isolation.js'
import { mountPlatformAccessPanel } from '../view.js'

const ROUTE_PREFIX = '/_futurestaff/platform-mock'
const panelCss = `
.futurestaff-access{max-width:760px;color:var(--color-text,#172033)}
.futurestaff-access section{display:grid;gap:14px;border:1px solid color-mix(in srgb,currentColor 14%,transparent);border-radius:14px;padding:20px;background:color-mix(in srgb,currentColor 3%,transparent)}
.futurestaff-access header{display:flex;align-items:flex-start;gap:8px}.futurestaff-access header>div{flex:1}
.futurestaff-access h2,.futurestaff-access h3,.futurestaff-access p{margin:0}.futurestaff-access p{opacity:.72}
.futurestaff-access button,.futurestaff-access select{font:inherit;border:1px solid color-mix(in srgb,currentColor 24%,transparent);border-radius:8px;background:transparent;color:inherit;padding:8px 11px}
.futurestaff-access button{cursor:pointer}.futurestaff-access label{display:grid;gap:6px}
.futurestaff-access ul{display:grid;gap:8px;margin:0;padding:0;list-style:none}.futurestaff-access li{display:flex;justify-content:space-between;gap:12px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:9px;padding:12px}
.futurestaff-access li span,.futurestaff-access [data-mock=true]{font-size:.875rem;opacity:.68}
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
    createElement('style', null, panelCss),
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
