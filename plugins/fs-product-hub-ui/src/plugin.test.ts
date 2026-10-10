import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply as applyClient, productHubHome } from './client/index.js'
import { apply as applyHost, inject as hostInject } from './index.js'

const tenantId = '3a2826d6-df60-452e-9654-aa237c27cd12'
function session(overrides: Record<string, unknown> = {}) {
  return {
    phase: 'ready', activeTenantId: tenantId,
    applications: [{ appId: 'product_hub', tenantId, baseUrl: 'https://product-dev.fsstory.net',
      deepLinks: { home: '/product-hub' }, capabilities: ['product_hub.read'], ...overrides }],
  }
}

describe('Product Hub online launcher', () => {
  afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks() })

  it('registers one sidebar action and no local page server', () => {
    const names: string[] = []
    applyClient({ slots: {
      inject: (name: string, register: () => void) => { names.push(name); register() },
      register: () => () => {},
    } } as never)
    expect(names).toEqual(['sidebar.footer.action'])
    expect(hostInject).toEqual([])
    expect(applyHost()).toBeUndefined()
  })

  it('accepts only the active tenant authorized DEV Product Hub home', () => {
    expect(productHubHome(session())).toBe('https://product-dev.fsstory.net/product-hub')
    expect(productHubHome(session({ baseUrl: 'https://product.fsstory.net' }))).toBe('https://product.fsstory.net/product-hub')
    expect(productHubHome(session({ tenantId: '6d634444-2b0d-4ccd-af08-b44a41be3506' }))).toBeNull()
    expect(productHubHome(session({ baseUrl: 'https://evil.example' }))).toBeNull()
    expect(productHubHome(session({ deepLinks: { home: '//evil.example' } }))).toBeNull()
    expect(productHubHome(session({ capabilities: [] }))).toBeNull()
    expect(productHubHome({ ...session(), phase: 'signed_out' })).toBeNull()
  })

  it('rechecks the session on click and opens the online system', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(session()), { status: 200 }))
    const opener = vi.spyOn(window, 'open').mockImplementation(() => null)
    let Launcher: ComponentType<{ wide: boolean }> | undefined
    applyClient({ slots: {
      inject: (_name: string, register: () => void) => register(),
      register: (_options: unknown, component: ComponentType<{ wide: boolean }>) => {
        Launcher = component
        return () => {}
      },
    } } as never)
    if (Launcher === undefined) throw new Error('launcher missing')
    render(createElement(Launcher, { wide: true }))
    fireEvent.click(screen.getByRole('button', { name: '打开线上选品中心' }))
    await waitFor(() => expect(opener).toHaveBeenCalledWith(
      'https://product-dev.fsstory.net/product-hub', '_blank', 'noopener,noreferrer'))
    expect(fetcher).toHaveBeenCalledWith('/_futurestaff/platform-dev/session', expect.objectContaining({ method: 'GET', cache: 'no-store' }))
  })

  it('does not open a browser for an unauthorized tenant', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(session({ capabilities: [] })), { status: 200 }))
    const opener = vi.spyOn(window, 'open').mockImplementation(() => null)
    let Launcher: ComponentType<{ wide: boolean }> | undefined
    applyClient({ slots: {
      inject: (_name: string, register: () => void) => register(),
      register: (_options: unknown, component: ComponentType<{ wide: boolean }>) => {
        Launcher = component
        return () => {}
      },
    } } as never)
    if (Launcher === undefined) throw new Error('launcher missing')
    render(createElement(Launcher, { wide: true }))
    fireEvent.click(screen.getByRole('button', { name: '打开线上选品中心' }))
    await screen.findByRole('alert')
    expect(opener).not.toHaveBeenCalled()
  })
})
