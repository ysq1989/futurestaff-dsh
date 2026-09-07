import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { App } from './App.js'

describe('Product Hub approval workbench', () => {
  afterEach(() => window.history.replaceState({}, '', '/'))

  it('explains that there is no approval work when the draft list is empty', () => {
    window.history.replaceState({}, '', '/?state=empty')
    render(<App />)

    expect(screen.getByRole('heading', { name: '没有待确认的选品草稿' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '返回对话' })).toHaveAttribute('href', '#conversation')
  })

  it('lets the operator retry a recoverable loading error', async () => {
    window.history.replaceState({}, '', '/?state=error')
    render(<App />)

    screen.getByRole('button', { name: '重新加载' }).click()
    expect(await screen.findByRole('heading', { name: '秋日玉镯精选' })).toBeInTheDocument()
  })

  it('loads a real desktop draft only through the injected authorized client', async () => {
    window.history.replaceState({}, '', '/?draft=68cd8450-6a26-4c70-9440-e6618a295a70')
    const client = {
      loadDraft: async () => ({
        draftId: '68cd8450-6a26-4c70-9440-e6618a295a70', name: '服务端选品草稿', description: null,
        status: 'DRAFT' as const, expiresAt: '2026-09-08T13:00:00Z',
        products: [{ id: 'p1', title: '服务端商品', description: null, price: 100, mainImage: null, images: [] }],
      }),
      approve: async () => { throw new Error('not used') },
    }

    render(<App connectClient={async () => ({ client, canApprove: false })} />)

    expect(screen.getByRole('region', { name: '正在加载选品草稿' })).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: '服务端选品草稿' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '需要发布权限' })).toBeDisabled()
  })
})
