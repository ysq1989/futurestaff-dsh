import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { createElement, useEffect, useSyncExternalStore } from 'react'

const listeners = new Set<() => void>()
let opened = false
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const snapshot = (): boolean => opened
function setOpened(value: boolean): void {
  if (opened === value) return
  opened = value
  for (const listener of listeners) listener()
}

function draftUrl(): string {
  const value = new URLSearchParams(window.location.search).get('productHubDraft')
  const query = value !== null && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(value)
    ? `draft=${encodeURIComponent(value)}`
    : 'state=empty'
  return `/_futurestaff/product-hub-ui/?${query}`
}

function ProductHubLauncher({ wide }: { readonly wide: boolean }) {
  return createElement('button', {
    type: 'button',
    'aria-label': '打开选品中心',
    onClick: () => setOpened(true),
    style: { display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px' },
  }, createElement('span', { 'aria-hidden': true }, '◇'), wide ? createElement('span', null, '选品中心') : null)
}

function ProductHubOverlay() {
  const visible = useSyncExternalStore(subscribe, snapshot, snapshot)
  useEffect(() => {
    if (!visible) return
    const closeOnEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpened(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [visible])
  if (!visible) return null
  return createElement('section', {
    role: 'dialog', 'aria-modal': true, 'aria-label': '选品中心',
    style: { position: 'fixed', inset: 12, zIndex: 1000, pointerEvents: 'auto', borderRadius: 16, overflow: 'hidden', background: '#fff', boxShadow: '0 24px 80px rgba(0,0,0,.28)' },
  },
  createElement('button', {
    type: 'button', 'aria-label': '关闭选品中心', autoFocus: true, onClick: () => setOpened(false),
    style: { position: 'absolute', zIndex: 2, top: 14, right: 14, width: 36, height: 36, borderRadius: 18, border: '1px solid rgba(0,0,0,.15)', background: '#fff', cursor: 'pointer' },
  }, '×'),
  createElement('iframe', {
    title: '选品中心工作台', src: draftUrl(), referrerPolicy: 'no-referrer',
    style: { width: '100%', height: '100%', border: 0, background: '#fff' },
  }))
}

export const inject = ['slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action', id: 'futurestaff-product-hub', order: -20,
  }, ProductHubLauncher))
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'futurestaff-product-hub', order: 20,
  }, ProductHubOverlay))
}
