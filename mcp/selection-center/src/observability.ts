export type SelectionCenterOperation =
  | 'search_products'
  | 'get_product'
  | 'list_product_pools'
  | 'add_products_to_pool'

export interface SelectionCenterLogEvent {
  event: 'selection_center_request_completed'
  requestId: string
  operation: SelectionCenterOperation
  outcome: 'success' | 'error' | 'timeout'
  durationMs: number
  errorCode?: string
}

export interface SelectionCenterLogger {
  emit(event: SelectionCenterLogEvent): void
}

export const silentSelectionCenterLogger: SelectionCenterLogger = Object.freeze({ emit() {} })

export function createJsonStderrLogger(): SelectionCenterLogger {
  return Object.freeze({
    emit(event: SelectionCenterLogEvent): void {
      process.stderr.write(`${JSON.stringify(event)}\n`)
    },
  })
}
