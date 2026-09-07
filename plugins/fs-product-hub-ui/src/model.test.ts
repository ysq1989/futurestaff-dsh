import { describe, expect, it } from 'vitest'

import { parseDraftPreview } from './model.js'

describe('parseDraftPreview', () => {
  it('accepts buyer-facing draft data without adding an authority field', () => {
    const draft = parseDraftPreview({
      draftId: '68cd8450-6a26-4c70-9440-e6618a295a70',
      name: '秋日玉镯精选',
      description: '预算 8,000 至 15,000 元，偏好春彩与冰润质感',
      status: 'DRAFT',
      expiresAt: '2026-09-08T13:00:00Z',
      products: [{
        id: 'ac252227-287c-4b8f-ad04-2a094a84c1a0',
        title: '春彩圆条手镯',
        description: '紫绿相融，条形饱满',
        price: 12800,
        mainImage: '/jade-spring.svg',
        images: [],
      }],
      tenantId: 'must-not-be-consumed',
    })

    expect(draft.products[0]?.title).toBe('春彩圆条手镯')
    expect(draft).not.toHaveProperty('tenantId')
  })

  it('rejects malformed product data instead of rendering partial facts', () => {
    expect(() => parseDraftPreview({
      draftId: 'draft-1',
      name: 'invalid',
      description: '',
      status: 'DRAFT',
      expiresAt: 'not-a-date',
      products: [],
    })).toThrow('Invalid Product Hub draft preview')
  })
})
