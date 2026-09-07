import {
  parseApprovalResult,
  parseDraftPreview,
  type ApprovalIntent,
  type ApprovalResult,
  type DraftPreview,
} from './model.js'

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface ProductHubApprovalClientOptions {
  baseUrl: string
  getApplicationToken: () => Promise<string>
  fetcher?: Fetcher
}

export class ProductHubClientError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
    this.name = 'ProductHubClientError'
  }
}

export class ProductHubApprovalClient {
  private readonly baseUrl: string
  private readonly fetcher: Fetcher

  constructor(private readonly options: ProductHubApprovalClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/u, '')
    this.fetcher = options.fetcher ?? fetch
  }

  async loadDraft(draftId: string): Promise<DraftPreview> {
    const payload = await this.request(`/api/product-hub/desktop/v1/selection-drafts/${encodeURIComponent(draftId)}`)
    return parseDraftPreview(this.data(payload))
  }

  async approve(draftId: string, intent: ApprovalIntent): Promise<ApprovalResult> {
    const payload = await this.request(
      `/api/product-hub/desktop/v1/selection-drafts/${encodeURIComponent(draftId)}/approvals`,
      {
        method: 'POST',
        body: JSON.stringify({
          idempotencyKey: intent.idempotencyKey,
          title: intent.title,
          templateId: intent.templateId,
        }),
      },
    )
    return parseApprovalResult(this.data(payload))
  }

  private data(payload: unknown): unknown {
    const envelope = typeof payload === 'object' && payload !== null
      ? payload as Record<string, unknown>
      : null
    if (envelope === null || !('data' in envelope)) {
      throw new ProductHubClientError(502, 'Product Hub returned an invalid response')
    }
    return envelope.data
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    const token = await this.options.getApplicationToken()
    if (token.trim() === '') throw new ProductHubClientError(401, 'Product Hub authorization is unavailable')
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      credentials: 'omit',
    })
    const payload = await response.json().catch(() => null) as unknown
    if (!response.ok) {
      const detail = typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>).detail
        : null
      throw new ProductHubClientError(
        response.status,
        typeof detail === 'string' ? detail : 'Product Hub request failed',
      )
    }
    return payload
  }
}
