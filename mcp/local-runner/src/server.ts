import { McpServer } from '@modelcontextprotocol/server'
import { defineToolMetadata } from '@futurestaff/fs-core'

import type { LocalRunnerClient } from './client.js'
import { LocalRunnerClientError } from './client.js'
import {
  localCodexUsageInputSchema,
  localCodexUsageOutputSchema,
  localSystemInfoInputSchema,
  localSystemInfoOutputSchema,
} from './schemas.js'

function errorResult(error: unknown) {
  const normalized = error instanceof LocalRunnerClientError
    ? error
    : new LocalRunnerClientError('INTERNAL', 'Unexpected Local Runner error', false)
  return {
    isError: true,
    content: [{ type: 'text' as const, text: JSON.stringify({ error: { code: normalized.code, message: normalized.message, retryable: normalized.retryable } }) }],
  }
}

export function createLocalRunnerServer(client: LocalRunnerClient, deviceId: string): McpServer {
  const server = new McpServer({ name: 'futurestaff-local-runner', version: '0.1.0' }, {
    instructions: 'Use local_system_info for computer system information and local_codex_usage only for read-only Codex quota/reset status.',
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
      return errorResult(error)
    }
  })

  server.registerTool('local_codex_usage', {
    description: 'Read sanitized Codex and model-specific quota usage and reset windows from the configured FutureStaff Local Runner.',
    inputSchema: localCodexUsageInputSchema,
    outputSchema: localCodexUsageOutputSchema,
    _meta: { 'futurestaff/tool': metadata },
  }, async () => {
    try {
      const output = await client.getCodexUsage()
      return { content: [{ type: 'text' as const, text: JSON.stringify(output) }], structuredContent: output }
    } catch (error) {
      return errorResult(error)
    }
  })

  return server
}
