import { render, screen } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { ProductHubApprovalCard } from './ProductHubApprovalCard.js'
import type { DraftPreview } from './model.js'

const draft: DraftPreview = {
  draftId: '68cd8450-6a26-4c70-9440-e6618a295a70',
  name: '秋日玉镯精选',
  description: '预算 8,000 至 15,000 元，偏好春彩与冰润质感',
  status: 'DRAFT',
  expiresAt: '2026-09-08T13:00:00Z',
  products: [
    { id: 'p1', title: '春彩圆条手镯', description: '紫绿相融，条形饱满', price: 12800, mainImage: '/jade-spring.svg', images: [] },
    { id: 'p2', title: '冰糯飘花正圈', description: '底色清透，飘花舒展', price: 9800, mainImage: '/jade-ice.svg', images: [] },
  ],
}

describe('ProductHubApprovalCard', () => {
  it('shows the frozen products and makes the publication consequence explicit', () => {
    render(<ProductHubApprovalCard draft={draft} canApprove onApprove={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '秋日玉镯精选' })).toBeInTheDocument()
    expect(screen.getByText('春彩圆条手镯')).toBeInTheDocument()
    expect(screen.getByText('冰糯飘花正圈')).toBeInTheDocument()
    expect(screen.getByText(/批准后将创建不可变发布版本/)).toBeInTheDocument()
  })

  it('submits only the user-edited title and safe template choice', async () => {
    const user = userEvent.setup()
    const onApprove = vi.fn().mockResolvedValue(undefined)
    render(<ProductHubApprovalCard draft={draft} canApprove onApprove={onApprove} />)

    const title = screen.getByLabelText('发布标题')
    await user.clear(title)
    await user.type(title, '  春彩私享雅集  ')
    await user.selectOptions(screen.getByLabelText('页面模板'), 'oriental-elegant')
    await user.click(screen.getByRole('button', { name: '确认并发布 H5' }))

    expect(onApprove).toHaveBeenCalledWith({
      title: '春彩私享雅集',
      templateId: 'oriental-elegant',
    })
  })

  it('disables approval for read-only and expired drafts', () => {
    const { rerender } = render(
      <ProductHubApprovalCard draft={draft} canApprove={false} onApprove={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '需要发布权限' })).toBeDisabled()

    rerender(
      <ProductHubApprovalCard draft={{ ...draft, status: 'EXPIRED' }} canApprove onApprove={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: '草稿已过期' })).toBeDisabled()
  })

  it('shows the authoritative published URL only after publication succeeds', () => {
    render(
      <ProductHubApprovalCard
        draft={draft}
        canApprove
        onApprove={vi.fn()}
        result={{
          releaseId: 'release-1',
          status: 'PUBLISHED',
          url: 'https://dev.fsstory.net/product-hub/h5/site/jade2026',
          review: { approved: true, summary: '平台审核通过', risks: [] },
        }}
      />,
    )

    expect(screen.getByRole('link', { name: '打开已发布 H5' })).toHaveAttribute(
      'href',
      'https://dev.fsstory.net/product-hub/h5/site/jade2026',
    )
  })
})
