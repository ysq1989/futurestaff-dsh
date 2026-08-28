import { McpServer } from '@modelcontextprotocol/server'
import { defineToolMetadata } from '@futurestaff/fs-core'

import type { LocalRunnerClient } from './client.js'
import { LocalRunnerClientError } from './client.js'
import { localSystemInfoInputSchema, localSystemInfoOutputSchema } from './schemas.js'

export function createLocalRunnerServer(client: LocalRunnerClient, deviceId: string): McpServer {
  const server = new McpServer({ name: 'futurestaff-local-runner', version: '0.1.0' }, {
    instructions: 'Use local_system_info only when current computer system information is needed.',
  })
  const metadata = defineToolMetadata({ execution: 'local', requiresApproval: true, tenantScoped: true, deviceId })
  server.registerTool('local_system_info', {
    description: 'Read operating-system information from the configured FutureStaff Local Runner.',
    inputSchema: localSystemInfoInputSchema,
    outputSchema: localSystemInfoOutputSchema,
    _meta: { 'futurestaff/tool': metadata },
  }, async () => {
    try {
      const output = await client.getSystemInfo()
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
    } catch (error) {
      const normalized = error instanceof LocalRunnerClientError ? error : new LocalRunnerClientError('INTERNAL', 'Unexpected Local Runner error', false)
      return { isError: true, content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } }) }] }
    }
  })
  return server
}
