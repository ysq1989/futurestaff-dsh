import { useMemo, useState } from 'react'

import type { ApprovalChoice, ApprovalResult, DraftPreview } from './model.js'

export interface ProductHubApprovalCardProps {
  draft: DraftPreview
  canApprove: boolean
  onApprove: (choice: ApprovalChoice) => Promise<void> | void
  result?: ApprovalResult
}

const templates: ReadonlyArray<{ value: ApprovalChoice['templateId']; label: string; detail: string }> = [
  { value: 'jade-luxe', label: '墨玉黑金', detail: '深色高端陈列' },
  { value: 'oriental-elegant', label: '东方雅致', detail: '留白与宋韵表达' },
  { value: 'minimal-gallery', label: '极简图集', detail: '突出商品图片' },
  { value: 'private-sales', label: '私享品鉴', detail: '适合定向客户' },
]

const currency = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  maximumFractionDigits: 0,
})

function expiryLabel(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function statusCopy(status: DraftPreview['status'] | ApprovalResult['status']): string {
  return {
    DRAFT: '等待确认',
    EXPIRED: '草稿已过期',
    REVIEWING: '平台审核中',
    REJECTED: '未通过发布检查',
    SUPERSEDED: '已有更新版本',
    PUBLISHED: '已发布',
  }[status]
}

export function ProductHubApprovalCard({ draft, canApprove, onApprove, result }: ProductHubApprovalCardProps) {
  const [title, setTitle] = useState(draft.name)
  const [templateId, setTemplateId] = useState<ApprovalChoice['templateId']>('jade-luxe')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const finalStatus = result?.status ?? draft.status
  const locked = finalStatus !== 'DRAFT'
  const titleValid = title.trim().length > 0 && title.trim().length <= 200
  const buttonLabel = draft.status === 'EXPIRED'
    ? '草稿已过期'
    : !canApprove
      ? '需要发布权限'
      : submitting
        ? '正在提交发布…'
        : locked
          ? statusCopy(finalStatus)
          : '确认并发布 H5'
  const selectedTemplate = useMemo(
    () => templates.find(template => template.value === templateId) ?? templates[0],
    [templateId],
  )

  async function submit(): Promise<void> {
    if (!canApprove || locked || !titleValid) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      await onApprove({ title: title.trim(), templateId })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '发布请求未完成，请稍后重试')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className="approval-card" aria-labelledby="draft-title">
      <header className="approval-card__header">
        <div className="approval-card__heading">
          <div className="approval-card__eyebrow">
            <span className="status-dot" data-status={finalStatus} aria-hidden="true" />
            <span>{statusCopy(finalStatus)}</span>
            <span aria-hidden="true">·</span>
            <span>{draft.products.length} 件商品</span>
          </div>
          <h1 id="draft-title">{draft.name}</h1>
          <p>{draft.description || 'Agent 已根据本次对话整理选品，请在发布前核对。'}</p>
        </div>
        <div className="approval-card__expiry">
          <span>{draft.status === 'EXPIRED' ? '已失效' : '草稿有效期至'}</span>
          <strong>{expiryLabel(draft.expiresAt)}</strong>
        </div>
      </header>

      <div className="approval-card__body">
        <section className="preview-region" aria-labelledby="preview-heading">
          <div className="section-heading">
            <div>
              <h2 id="preview-heading">发布内容预览</h2>
              <p>商品信息来自 Product Hub 服务端草稿，本页面不能修改商品事实。</p>
            </div>
            <span className="frozen-badge">已冻结预览</span>
          </div>
          <div className="product-grid">
            {draft.products.map((product, index) => (
              <article className="product-item" key={product.id}>
                <div className="product-item__image-wrap">
                  {product.mainImage
                    ? <img src={product.mainImage} alt="" className="product-item__image" />
                    : <div className="product-item__placeholder" aria-hidden="true">玉</div>}
                  <span className="product-item__index">{String(index + 1).padStart(2, '0')}</span>
                </div>
                <div className="product-item__content">
                  <h3>{product.title}</h3>
                  <p>{product.description || '暂无补充描述'}</p>
                  <strong>{currency.format(product.price)}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="approval-region" aria-labelledby="approval-heading">
          {result?.status === 'PUBLISHED' && result.url ? (
            <div className="published-result">
              <span className="published-result__icon" aria-hidden="true">✓</span>
              <p className="published-result__label">发布完成</p>
              <h2 id="approval-heading">客户页面已生成</h2>
              <p>{result.review.summary || '平台审核通过，公开 H5 已切换到本次发布版本。'}</p>
              <a href={result.url} target="_blank" rel="noreferrer">打开已发布 H5</a>
              <span className="published-result__release">版本 {result.releaseId.slice(0, 8)}</span>
            </div>
          ) : (
            <>
              <div className="section-heading section-heading--compact">
                <div>
                  <h2 id="approval-heading">确认发布设置</h2>
                  <p>批准动作仅代表本次草稿。</p>
                </div>
              </div>
              <div className="approval-form">
                <div className="approval-form__field">
                  <label htmlFor="product-hub-publication-title">发布标题</label>
                  <input
                    id="product-hub-publication-title"
                    value={title}
                    maxLength={200}
                    disabled={locked || submitting}
                    onChange={event => setTitle(event.currentTarget.value)}
                  />
                  {!titleValid && <small role="alert">请输入 1–200 个字符的发布标题</small>}
                </div>
                <div className="approval-form__field">
                  <label htmlFor="product-hub-template">页面模板</label>
                  <select
                    id="product-hub-template"
                    value={templateId}
                    disabled={locked || submitting}
                    onChange={event => setTemplateId(event.currentTarget.value as ApprovalChoice['templateId'])}
                  >
                    {templates.map(template => (
                      <option key={template.value} value={template.value}>{template.label}</option>
                    ))}
                  </select>
                  <small>{selectedTemplate?.detail}</small>
                </div>
              </div>
              <div className="publication-notice">
                <span aria-hidden="true">!</span>
                <p><strong>这是公开发布操作。</strong>批准后将创建不可变发布版本，经过平台审核与会员容量检查后生成客户可访问的 H5。</p>
              </div>
              {!canApprove && draft.status !== 'EXPIRED' && (
                <p className="permission-note">当前账号可查看草稿，但没有 Product Hub 发布权限。</p>
              )}
              {result?.status === 'REJECTED' && (
                <p className="result-error" role="alert">{result.review.summary || '本次内容未通过平台发布检查。'}</p>
              )}
              {result?.status === 'SUPERSEDED' && (
                <p className="result-error" role="alert">站点已有更新版本，本次草稿没有覆盖现有页面。</p>
              )}
              {submitError && <p className="result-error" role="alert">{submitError}</p>}
              <div className="approval-actions">
                <p>发布前请再次核对商品、价格与模板。</p>
                <button
                  type="button"
                  disabled={!canApprove || locked || submitting || !titleValid}
                  onClick={() => { void submit() }}
                >
                  {buttonLabel}
                  {!locked && !submitting && canApprove && <span aria-hidden="true">→</span>}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </article>
  )
}
