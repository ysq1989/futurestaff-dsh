import { useEffect, useState } from 'react'

import { ProductHubApprovalCard } from './ProductHubApprovalCard.js'
import type { ApprovalResult, DraftPreview } from './model.js'

const baseDraft: DraftPreview = {
  draftId: '68cd8450-6a26-4c70-9440-e6618a295a70',
  name: '秋日玉镯精选',
  description: '预算 8,000 至 15,000 元，偏好春彩、冰润质感与日常佩戴。',
  status: 'DRAFT',
  expiresAt: '2026-09-08T13:00:00Z',
  products: [
    { id: 'p1', title: '春彩圆条手镯', description: '紫绿相融，条形饱满', price: 12800, mainImage: '/jade-spring.svg', images: [] },
    { id: 'p2', title: '冰糯飘花正圈', description: '底色清透，飘花舒展', price: 9800, mainImage: '/jade-ice.svg', images: [] },
    { id: 'p3', title: '晴水贵妃手镯', description: '柔和晴水底，贴腕轻盈', price: 8600, mainImage: '/jade-water.svg', images: [] },
  ],
}

type Scenario = 'ready' | 'readonly' | 'expired' | 'loading' | 'empty' | 'error' | 'rejected' | 'superseded' | 'published'

function scenarioFromUrl(): Scenario {
  const scenario = new URLSearchParams(window.location.search).get('state')
  return ['readonly', 'expired', 'loading', 'empty', 'error', 'rejected', 'superseded', 'published'].includes(scenario ?? '')
    ? scenario as Scenario
    : 'ready'
}

export function App() {
  const [scenario, setScenario] = useState<Scenario>(scenarioFromUrl)
  const [result, setResult] = useState<ApprovalResult | undefined>(() => {
    if (scenario === 'published') {
      return {
        releaseId: '0a862c81-cae6-4d06-b932-754162745630',
        status: 'PUBLISHED',
        url: 'https://dev.fsstory.net/product-hub/h5/site/jade2026',
        review: { approved: true, summary: '平台审核通过，未发现不适合公开展示的内容。', risks: [] },
      }
    }
    if (scenario === 'rejected') {
      return {
        releaseId: 'f3547162-42e7-4c72-a7d2-3400c1f7759c',
        status: 'REJECTED',
        url: null,
        review: { approved: false, summary: '平台审核未通过，请回到 Product Hub 检查商品公开状态。', risks: ['包含暂不可公开展示的商品'] },
      }
    }
    if (scenario === 'superseded') {
      return {
        releaseId: '8afac0a2-d405-4870-a63b-2a6dad77e3f3',
        status: 'SUPERSEDED',
        url: null,
        review: { approved: false, summary: '该草稿已被更新版本替代，请重新读取后确认。', risks: [] },
      }
    }
    return undefined
  })

  useEffect(() => {
    const onPopState = () => setScenario(scenarioFromUrl())
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  async function approve(): Promise<void> {
    await new Promise(resolve => window.setTimeout(resolve, 850))
    setResult({
      releaseId: '0a862c81-cae6-4d06-b932-754162745630',
      status: 'PUBLISHED',
      url: 'https://dev.fsstory.net/product-hub/h5/site/jade2026',
      review: { approved: true, summary: '平台审核通过，未发现不适合公开展示的内容。', risks: [] },
    })
  }

  function retry(): void {
    window.history.replaceState({}, '', window.location.pathname)
    setScenario('ready')
  }

  const draft = scenario === 'expired' ? { ...baseDraft, status: 'EXPIRED' as const } : baseDraft

  return (
    <div className="workbench-shell">
      <aside className="workbench-sidebar" aria-label="工作台导航">
        <a className="brand" href="#main" aria-label="FutureStaff Agent 首页">
          <span className="brand__mark" aria-hidden="true">F</span>
          <span><strong>FutureStaff</strong><small>Agent 工作台</small></span>
        </a>
        <nav>
          <a href="#conversation"><span aria-hidden="true">⌁</span> 对话</a>
          <a href="#tasks"><span aria-hidden="true">✓</span> 任务</a>
          <a className="is-active" href="#product-hub"><span aria-hidden="true">◇</span> 选品中心</a>
        </nav>
        <div className="workspace-user">
          <span className="workspace-user__avatar">林</span>
          <span><strong>林晓</strong><small>翠玉雅集 · 管理员</small></span>
        </div>
      </aside>
      <main className="workbench-main" id="main">
        <header className="workbench-header">
          <div>
            <span className="workbench-header__context">选品中心 / 发布确认</span>
            <h2>核对 Agent 推荐结果</h2>
          </div>
          <button type="button" aria-label="更多操作">•••</button>
        </header>
        <div className="workbench-content">
          <div className="agent-note">
            <span className="agent-note__avatar" aria-hidden="true">F</span>
            <p><strong>已完成选品。</strong>我根据你的预算和风格偏好整理了 3 件商品。发布属于对外操作，需要你核对后明确批准。</p>
          </div>
          {scenario === 'loading' ? (
            <section className="state-panel state-panel--loading" aria-label="正在加载选品草稿">
              <div /><div /><div />
            </section>
          ) : scenario === 'empty' ? (
            <section className="state-panel">
              <span className="state-panel__icon state-panel__icon--empty" aria-hidden="true">◇</span>
              <h1>没有待确认的选品草稿</h1>
              <p>当 Agent 完成选品后，待发布内容会出现在这里。你也可以回到对话发起新的选品任务。</p>
              <a className="state-panel__action" href="#conversation">返回对话</a>
            </section>
          ) : scenario === 'error' ? (
            <section className="state-panel" role="alert">
              <span className="state-panel__icon">!</span>
              <h1>暂时无法读取选品草稿</h1>
              <p>平台连接没有完成，请检查登录状态后重试。草稿内容没有被修改。</p>
              <button type="button" onClick={retry}>重新加载</button>
            </section>
          ) : (
            <ProductHubApprovalCard
              draft={draft}
              canApprove={scenario !== 'readonly'}
              onApprove={approve}
              {...(result === undefined ? {} : { result })}
            />
          )}
          <p className="workbench-footnote">FutureStaff Agent 仅整理和展示建议，商品事实、权限、审核与发布状态由 Product Hub 服务端确认。</p>
        </div>
      </main>
    </div>
  )
}
