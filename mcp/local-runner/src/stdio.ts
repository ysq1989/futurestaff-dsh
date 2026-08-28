import { serveStdio } from '@modelcontextprotocol/server/stdio'

import { createHttpLocalRunnerClient } from './client.js'
import { createLocalRunnerServer } from './server.js'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const client = createHttpLocalRunnerClient({
  baseUrl: required('RUNNER_GATEWAY_INTERNAL_URL'),
  token: required('RUNNER_DISPATCH_TOKEN'),
  runnerId: required('RUNNER_ID'),
  ...(process.env.RUNNER_DISPATCH_TIMEOUT_MS ? { timeoutMs: Number(process.env.RUNNER_DISPATCH_TIMEOUT_MS) } : {}),
  log: event => process.stderr.write(`${JSON.stringify(event)}\n`),
})

void serveStdio(() => createLocalRunnerServer(client, required('RUNNER_DEVICE_ID')))
console.error('FutureStaff Local Runner MCP is listening on stdio')
