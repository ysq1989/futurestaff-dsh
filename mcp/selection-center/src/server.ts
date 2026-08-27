import { McpServer } from '@modelcontextprotocol/server'
import type { StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import type { FutureStaffContext } from '@futurestaff/fs-core'
import { defineToolMetadata } from '@futurestaff/fs-core'
import type { SelectionCenterClient } from './client.js'
import { SelectionCenterError } from './client.js'
import {
  addProductsToPoolInputSchema, addProductsToPoolOutputSchema, getProductInputSchema, getProductOutputSchema,
  listProductPoolsInputSchema, listProductPoolsOutputSchema, searchProductsInputSchema, searchProductsOutputSchema,
} from './schemas.js'

export const selectionCenterToolMetadata = Object.freeze({
  search_products: defineToolMetadata({ execution: 'cloud', requiresApproval: false, tenantScoped: true }),
  get_product: defineToolMetadata({ execution: 'cloud', requiresApproval: false, tenantScoped: true }),
  list_product_pools: defineToolMetadata({ execution: 'cloud', requiresApproval: false, tenantScoped: true }),
  add_products_to_pool: defineToolMetadata({ execution: 'cloud', requiresApproval: true, tenantScoped: true }),
})

export function createSelectionCenterServer(client: SelectionCenterClient, context: FutureStaffContext): McpServer {
  const server = new McpServer({ name: 'futurestaff-selection-center', version: '0.2.0' }, {
    instructions: 'Search and read products before mutating product pools. Product-pool writes require user approval.',
  })

  server.registerTool('search_products', toolConfig('Search tenant-visible products', searchProductsInputSchema, searchProductsOutputSchema, 'search_products'),
    withErrors(input => client.searchProducts(context.current(), input)))
  server.registerTool('get_product', toolConfig('Get one tenant-visible product', getProductInputSchema, getProductOutputSchema, 'get_product'),
    withErrors(input => client.getProduct(context.current(), input.productId)))
  server.registerTool('list_product_pools', toolConfig('List tenant-visible product pools', listProductPoolsInputSchema, listProductPoolsOutputSchema, 'list_product_pools'),
    withErrors(input => client.listProductPools(context.current(), input)))
  server.registerTool('add_products_to_pool', toolConfig('Add products to a pool after explicit approval', addProductsToPoolInputSchema, addProductsToPoolOutputSchema, 'add_products_to_pool'),
    withErrors(input => client.addProductsToPool(context.current(), input)))
  return server
}

function toolConfig<Input extends StandardSchemaWithJSON, Output extends StandardSchemaWithJSON>(
  description: string,
  inputSchema: Input,
  outputSchema: Output,
  name: keyof typeof selectionCenterToolMetadata,
) {
  return { description, inputSchema, outputSchema, _meta: { 'futurestaff/tool': selectionCenterToolMetadata[name] } }
}

function withErrors<T>(handler: (input: T) => Promise<unknown>) {
  return async (input: T) => {
    try {
      const output = await handler(input)
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output as Record<string, unknown> }
    } catch (error) {
      const normalized = error instanceof SelectionCenterError ? error : new SelectionCenterError('INTERNAL', 'Unexpected Selection Center error', false)
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } }) }] }
    }
  }
}
