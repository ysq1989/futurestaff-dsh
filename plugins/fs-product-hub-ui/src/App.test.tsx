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
})
