import { createServer } from 'node:http'
import { fireEvent, render, screen } from '@testing-library/react'
import { createElement, type ComponentType } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { apply as applyClient } from './client/index.js'
import { apply as applyHost } from './index.js'

describe('Product Hub DSH plugin', () => {
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('registers only additive official client slots', () => {
    const injected: string[] = []
    const registrations: Array<Record<string, unknown>> = []
    applyClient({ slots: {
      inject: (name: string, register: () => void) => { injected.push(name); register() },
      register: (options: Record<string, unknown>) => { registrations.push(options); return () => {} },
    } } as never)
    expect(injected).toEqual(['sidebar.footer.action', 'shell.overlay'])
    expect(registrations).toEqual([
      { name: 'sidebar.footer.action', id: 'futurestaff-product-hub', order: -20 },
      { name: 'shell.overlay', id: 'futurestaff-product-hub', order: 20 },
    ])
  })

  it('opens and closes the overlay with only a validated draft deep link', async () => {
    window.history.replaceState({}, '', '/?productHubDraft=68cd8450-6a26-4c70-9440-e6618a295a70')
    const components: ComponentType<Record<string, unknown>>[] = []
    applyClient({ slots: {
      inject: (_name: string, register: () => void) => { register() },
      register: (_options: Record<string, unknown>, component: ComponentType<Record<string, unknown>>) => {
        components.push(component)
        return () => {}
      },
    } } as never)
    const Launcher = components[0]
    const Overlay = components[1]
    if (Launcher === undefined || Overlay === undefined) throw new Error('client slots unavailable')
    const launcher = render(createElement(Launcher, { wide: true }))
    fireEvent.click(screen.getByRole('button', { name: '打开选品中心' }))
    launcher.unmount()
    render(createElement(Overlay))
    expect(screen.getByTitle('选品中心工作台')).toHaveAttribute(
      'src', '/_futurestaff/product-hub-ui/?draft=68cd8450-6a26-4c70-9440-e6618a295a70',
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: '选品中心' })).not.toBeInTheDocument()
  })

  it('serves only allowlisted built assets with restrictive headers', async () => {
    let route: { handler: (request: never, response: never) => Promise<void> } | undefined
    applyHost({
      effect: (register: () => void) => { register() },
      webServer: { register: (candidate: typeof route) => { route = candidate; return () => {} } },
    } as never)
    const server = createServer((request, response) => { void route?.handler(request as never, response as never) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const address = server.address()
      if (address === null || typeof address === 'string') throw new Error('test server unavailable')
      const origin = `http://127.0.0.1:${address.port}`
      const page = await fetch(`${origin}/_futurestaff/product-hub-ui/`)
      expect(page.status).toBe(200)
      expect(page.headers.get('content-security-policy')).toContain("frame-ancestors 'self'")
      expect(page.headers.get('cache-control')).toBe('no-store')
      expect(await page.text()).toContain('/_futurestaff/product-hub-ui/assets/')
      const rejected = await fetch(`${origin}/_futurestaff/product-hub-ui/../package.json`)
      expect(rejected.status).toBe(404)
    } finally { server.close() }
  })
})
