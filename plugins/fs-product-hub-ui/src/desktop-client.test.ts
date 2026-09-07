import { describe, expect, it, vi } from 'vitest'

import { createDesktopProductHubApprovalClient } from './desktop-client.js'

const tenantId = '10000000-0000-4000-8000-000000000001'
const otherTenantId = '10000000-0000-4000-8000-000000000002'

function session(activeTenantId = tenantId, authorized = true, capability = 'product_hub.operator') {
  return {
    phase: authorized ? 'ready' : 'no_apps', simulated: false, contractVersion: '0.1.1',
    user: { userId: '20000000-0000-4000-8000-000000000001', displayName: 'DEV user', email: null },
    activeTenantId,
    tenants: [{ tenantId: activeTenantId, displayName: 'DEV tenant', slug: 'dev-tenant', logoUrl: null, role: 'member' }],
    applications: authorized ? [{
      appId: 'product_hub', tenantId: activeTenantId, displayName: 'Product Hub',
      baseUrl: 'https://dev.fsstory.net', deepLinks: { home: '/product-hub' },
      capabilities: [capability], contractRange: '>=0.1.1 <0.2.0',
    }] : [],
  }
}

describe('desktop Product Hub client', () => {
  it('revalidates the safe session, mints a short-lived token, then calls Product Hub', async () => {
    const calls: string[] = []
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(url)
      if (url === '/_futurestaff/platform-dev/session') {
        expect(init?.headers).toMatchObject({ 'x-futurestaff-session': '1' })
        return new Response(JSON.stringify(session()), { status: 200 })
      }
      if (url === '/_futurestaff/platform-dev/apps/product_hub/token') {
        expect(init?.headers).toMatchObject({ 'x-futurestaff-application': 'product_hub' })
        return new Response(JSON.stringify({
          accessToken: 'short-lived-product-hub-token-with-entropy', tokenType: 'Bearer', expiresIn: 60,
          audience: 'futurestaff-product-hub-dev', tenantId, permissions: ['product_hub.read'],
        }), { status: 200 })
      }
      expect(init?.headers).toEqual({
        authorization: 'Bearer short-lived-product-hub-token-with-entropy',
        'content-type': 'application/json',
      })
      return new Response(JSON.stringify({ data: {
        draftId: '68cd8450-6a26-4c70-9440-e6618a295a70', name: 'Draft', description: null,
        status: 'DRAFT', expiresAt: '2026-09-08T13:00:00Z', products: [{
          id: 'p1', title: 'Item', description: null, price: 100, mainImage: null, images: [],
        }],
      } }), { status: 200 })
    })

    const connection = await createDesktopProductHubApprovalClient(fetcher)
    expect(connection.canApprove).toBe(true)
    await connection.client.loadDraft('68cd8450-6a26-4c70-9440-e6618a295a70')

    expect(calls).toEqual([
      '/_futurestaff/platform-dev/session',
      '/_futurestaff/platform-dev/session',
      '/_futurestaff/platform-dev/apps/product_hub/token',
      'https://dev.fsstory.net/api/product-hub/desktop/v1/selection-drafts/68cd8450-6a26-4c70-9440-e6618a295a70',
    ])
    expect(JSON.stringify(fetcher.mock.calls)).not.toMatch(/platform-access-token|refresh-token/)
  })

  it('rejects a tenant switch before minting a token or calling Product Hub', async () => {
    let snapshots = 0
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe('/_futurestaff/platform-dev/session')
      snapshots += 1
      return new Response(JSON.stringify(session(snapshots === 1 ? tenantId : otherTenantId)), { status: 200 })
    })
    const { client } = await createDesktopProductHubApprovalClient(fetcher)

    await expect(client.loadDraft('draft')).rejects.toMatchObject({ status: 409 })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects missing Product Hub authorization before creating a client', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(session(tenantId, false)), { status: 200 }))
    await expect(createDesktopProductHubApprovalClient(fetcher)).rejects.toMatchObject({ status: 403 })
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('keeps a read-only member connected but disables approval', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(
      JSON.stringify(session(tenantId, true, 'product_hub.read')), { status: 200 },
    ))
    const connection = await createDesktopProductHubApprovalClient(fetcher)
    expect(connection.canApprove).toBe(false)
  })
})
