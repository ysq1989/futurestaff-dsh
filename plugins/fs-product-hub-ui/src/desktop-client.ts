import {
  getPlatformDevAccessSnapshot,
  getProductHubApplicationToken,
} from '@futurestaff/fs-platform-access/client'

import { ProductHubApprovalClient, ProductHubClientError } from './client.js'

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface ProductHubDesktopBinding {
  readonly activeTenantId: string
  readonly baseUrl: string
  readonly canApprove: boolean
}

export interface DesktopProductHubConnection {
  readonly client: Pick<ProductHubApprovalClient, 'loadDraft' | 'approve'>
  readonly canApprove: boolean
}

async function resolveBinding(fetcher: Fetcher): Promise<ProductHubDesktopBinding> {
  const snapshot = await getPlatformDevAccessSnapshot(fetcher)
  const activeTenantId = snapshot.activeTenantId
  const application = snapshot.applications.find(item => item.appId === 'product_hub')
  if (snapshot.phase !== 'ready' || activeTenantId === undefined || application === undefined
    || application.tenantId !== activeTenantId) {
    throw new ProductHubClientError(403, 'Product Hub authorization is unavailable')
  }
  return Object.freeze({
    activeTenantId,
    baseUrl: application.baseUrl,
    canApprove: application.capabilities.includes('product_hub.operator')
      || application.capabilities.includes('product_hub.admin'),
  })
}

/**
 * Connects Product Hub to the desktop Host without exposing the Platform session.
 * The binding is revalidated before every token mint so tenant switches and
 * authorization revocation cannot reuse a client created for older state.
 */
export async function createDesktopProductHubApprovalClient(
  fetcher: Fetcher = fetch,
): Promise<DesktopProductHubConnection> {
  const initial = await resolveBinding(fetcher)
  const client = new ProductHubApprovalClient({
    baseUrl: initial.baseUrl,
    fetcher,
    getApplicationToken: async () => {
      const current = await resolveBinding(fetcher)
      if (current.activeTenantId !== initial.activeTenantId || current.baseUrl !== initial.baseUrl) {
        throw new ProductHubClientError(409, 'Product Hub session changed; reconnect before continuing')
      }
      return getProductHubApplicationToken(current.activeTenantId, fetcher)
    },
  })
  return Object.freeze({ client, canApprove: initial.canApprove })
}
