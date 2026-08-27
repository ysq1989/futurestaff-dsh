import * as z from 'zod/v4'

const id = z.string().trim().min(1).max(200)
const cursor = z.string().trim().min(1).max(2000)
const currency = z.string().regex(/^[A-Z]{3}$/)

export const moneySchema = z.object({ amountMinor: z.int().nonnegative(), currency })
export const productSummarySchema = z.object({
  productId: id,
  name: z.string().min(1),
  category: z.string().min(1),
  price: moneySchema,
  thumbnailUrl: z.url().optional(),
})
export const productDetailSchema = productSummarySchema.extend({
  description: z.string().optional(),
  imageUrls: z.array(z.url()).default([]),
  attributes: z.record(z.string(), z.string()).default({}),
})
export const productPoolSchema = z.object({
  poolId: id,
  name: z.string().min(1),
  productCount: z.int().nonnegative(),
})

export const searchProductsInputSchema = z.object({
  query: z.string().trim().min(1).max(500).optional(),
  category: z.string().trim().min(1).max(200).optional(),
  price: z.object({
    minMinor: z.int().nonnegative().optional(),
    maxMinor: z.int().nonnegative().optional(),
    currency,
  }).refine(value => value.minMinor === undefined || value.maxMinor === undefined || value.minMinor <= value.maxMinor, {
    message: 'minMinor must not exceed maxMinor',
  }).optional(),
  cursor: cursor.optional(),
  limit: z.int().min(1).max(100).default(20),
})
export const searchProductsOutputSchema = z.object({ items: z.array(productSummarySchema), nextCursor: cursor.optional() })
export const getProductInputSchema = z.object({ productId: id })
export const getProductOutputSchema = z.object({ product: productDetailSchema })
export const listProductPoolsInputSchema = z.object({ cursor: cursor.optional(), limit: z.int().min(1).max(100).default(20) })
export const listProductPoolsOutputSchema = z.object({ items: z.array(productPoolSchema), nextCursor: cursor.optional() })
export const addProductsToPoolInputSchema = z.object({
  poolId: id,
  productIds: z.array(id).min(1).max(100).refine(values => new Set(values).size === values.length, 'productIds must be unique'),
  idempotencyKey: z.string().trim().min(8).max(200),
})
export const addProductsToPoolOutputSchema = z.object({
  poolId: id,
  addedProductIds: z.array(id),
  existingProductIds: z.array(id),
})

export type SearchProductsInput = z.infer<typeof searchProductsInputSchema>
export type SearchProductsOutput = z.infer<typeof searchProductsOutputSchema>
export type GetProductOutput = z.infer<typeof getProductOutputSchema>
export type ListProductPoolsInput = z.infer<typeof listProductPoolsInputSchema>
export type ListProductPoolsOutput = z.infer<typeof listProductPoolsOutputSchema>
export type AddProductsToPoolInput = z.infer<typeof addProductsToPoolInputSchema>
export type AddProductsToPoolOutput = z.infer<typeof addProductsToPoolOutputSchema>
