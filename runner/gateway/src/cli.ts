import { readFile } from 'node:fs/promises'

import { parseGatewayConfig, startRunnerGateway } from './index.js'

const configPath = process.env.RUNNER_GATEWAY_CONFIG_FILE
if (!configPath) throw new Error('RUNNER_GATEWAY_CONFIG_FILE is required')
const config = parseGatewayConfig(JSON.parse(await readFile(configPath, 'utf8')))
await startRunnerGateway({
  bindings: config.bindings,
  host: process.env.RUNNER_GATEWAY_HOST ?? '127.0.0.1',
  port: Number(process.env.RUNNER_GATEWAY_PORT ?? '3090'),
  ...(process.env.RUNNER_DISPATCH_TOKEN?.trim() ? { dispatchToken: process.env.RUNNER_DISPATCH_TOKEN.trim() } : {}),
})
