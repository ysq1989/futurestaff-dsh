import { describe, expect, it, vi } from 'vitest'

import { ProductHubApprovalClient } from './client.js'

describe('ProductHubApprovalClient', () => {
  it('sends only the approval intent with the short-lived application token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: {
        draftId: '68cd8450-6a26-4c70-9440-e6618a295a70',
        siteId: '86ed0c95-9254-4880-9225-4f349a49f678',
        releaseId: '0a862c81-cae6-4d06-b932-754162745630',
        status: 'PUBLISHED',
        review: { approved: true, summary: '平台审核通过', risks: [] },
        url: 'https://dev.fsstory.net/product-hub/h5/site/jade2026',
        replayed: false,
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } }))
    const client = new ProductHubApprovalClient({
      baseUrl: 'https://dev.fsstory.net',
      getApplicationToken: async () => 'short-lived-product-hub-token',
      fetcher,
    })

    await client.approve('68cd8450-6a26-4c70-9440-e6618a295a70', {
      idempotencyKey: 'approval-intent-20260907',
      title: '春彩私享雅集',
      templateId: 'jade-luxe',
    })

    const request = fetcher.mock.calls[0]?.[1] as RequestInit
    expect(request.headers).toEqual({
      authorization: 'Bearer short-lived-product-hub-token',
      'content-type': 'application/json',
    })
    expect(JSON.parse(String(request.body))).toEqual({
      idempotencyKey: 'approval-intent-20260907',
      title: '春彩私享雅集',
      templateId: 'jade-luxe',
    })
  })

  it('maps platform error details to a user-safe client error', async () => {
    const client = new ProductHubApprovalClient({
      baseUrl: 'https://dev.fsstory.net',
      getApplicationToken: async () => 'short-lived-product-hub-token',
      fetcher: vi.fn().mockResolvedValue(new Response(
        JSON.stringify({ detail: 'Selection draft has expired' }),
        { status: 409, headers: { 'content-type': 'application/json' } },
      )),
    })

    await expect(client.loadDraft('68cd8450-6a26-4c70-9440-e6618a295a70'))
      .rejects.toMatchObject({ status: 409, message: 'Selection draft has expired' })
  })
})
