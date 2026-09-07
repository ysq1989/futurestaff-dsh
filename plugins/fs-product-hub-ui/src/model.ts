export const draftStatuses = ['DRAFT', 'EXPIRED'] as const
export type DraftStatus = (typeof draftStatuses)[number]

export const approvalStatuses = ['REVIEWING', 'REJECTED', 'SUPERSEDED', 'PUBLISHED'] as const
export type ApprovalStatus = (typeof approvalStatuses)[number]

export interface ProductPreview {
  id: string
  title: string
  description: string | null
  price: number
  mainImage: string | null
  images: string[]
}

export interface DraftPreview {
  draftId: string
  name: string
  description: string | null
  status: DraftStatus
  expiresAt: string
  products: ProductPreview[]
}

export interface ApprovalReview {
  approved?: boolean
  summary?: string
  risks?: string[]
}

export interface ApprovalResult {
  releaseId: string
  status: ApprovalStatus
  review: ApprovalReview
  url: string | null
}

export interface ApprovalChoice {
  title: string
  templateId: 'jade-luxe' | 'oriental-elegant' | 'minimal-gallery' | 'private-sales'
}

export interface ApprovalIntent extends ApprovalChoice {
  idempotencyKey: string
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null
}

function nullableString(value: unknown): string | null | undefined {
  return value === null ? null : typeof value === 'string' ? value : undefined
}

function product(value: unknown): ProductPreview | null {
  const row = object(value)
  if (row === null) return null
  const id = string(row.id)
  const title = string(row.title)
  const description = nullableString(row.description)
  const mainImage = nullableString(row.mainImage)
  if (
    id === null
    || title === null
    || description === undefined
    || mainImage === undefined
    || typeof row.price !== 'number'
    || !Number.isFinite(row.price)
    || !Array.isArray(row.images)
    || !row.images.every(item => typeof item === 'string')
  ) return null
  return { id, title, description, price: row.price, mainImage, images: [...row.images] }
}

export function parseDraftPreview(value: unknown): DraftPreview {
  const row = object(value)
  const products = Array.isArray(row?.products) ? row.products.map(product) : []
  const expiresAt = string(row?.expiresAt)
  const status = row?.status
  const description = nullableString(row?.description)
  if (
    row === null
    || string(row.draftId) === null
    || string(row.name) === null
    || description === undefined
    || !draftStatuses.includes(status as DraftStatus)
    || expiresAt === null
    || Number.isNaN(Date.parse(expiresAt))
    || products.length === 0
    || products.some(item => item === null)
  ) throw new Error('Invalid Product Hub draft preview')
  return {
    draftId: row.draftId as string,
    name: row.name as string,
    description,
    status: status as DraftStatus,
    expiresAt,
    products: products as ProductPreview[],
  }
}

export function parseApprovalResult(value: unknown): ApprovalResult {
  const row = object(value)
  const review = object(row?.review)
  const status = row?.status
  const url = nullableString(row?.url)
  if (
    row === null
    || string(row.releaseId) === null
    || !approvalStatuses.includes(status as ApprovalStatus)
    || review === null
    || url === undefined
    || (status === 'PUBLISHED' && string(url) === null)
  ) throw new Error('Invalid Product Hub approval result')
  return {
    releaseId: row.releaseId as string,
    status: status as ApprovalStatus,
    review: {
      ...(typeof review.approved === 'boolean' ? { approved: review.approved } : {}),
      ...(typeof review.summary === 'string' ? { summary: review.summary } : {}),
      ...(Array.isArray(review.risks) && review.risks.every(item => typeof item === 'string')
        ? { risks: [...review.risks] as string[] }
        : {}),
    },
    url,
  }
}
