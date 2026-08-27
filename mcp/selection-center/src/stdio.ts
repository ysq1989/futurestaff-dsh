import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { createIdentityContext } from '@futurestaff/fs-core'
import { createHttpSelectionCenterClient } from './client.js'
import { createSelectionCenterServer } from './server.js'

function required(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

const context = createIdentityContext({
  tenantId: required('FUTURESTAFF_TENANT_ID'),
  userId: required('FUTURESTAFF_USER_ID'),
  ...(process.env.FUTURESTAFF_DEVICE_ID?.trim() ? { deviceId: process.env.FUTURESTAFF_DEVICE_ID.trim() } : {}),
})
const client = createHttpSelectionCenterClient({
  baseUrl: required('SELECTION_CENTER_BASE_URL'),
  apiKey: required('SELECTION_CENTER_API_KEY'),
})

void serveStdio(() => createSelectionCenterServer(client, context))
console.error('FutureStaff Selection Center MCP is listening on stdio')
