import { readFile } from 'node:fs/promises'

import { createEnrollmentService } from './enrollment.js'
import { parseGatewayConfig, startRunnerGateway } from './index.js'

const configPath = process.env.RUNNER_GATEWAY_CONFIG_FILE
if (!configPath) throw new Error('RUNNER_GATEWAY_CONFIG_FILE is required')
const config = parseGatewayConfig(JSON.parse(await readFile(configPath, 'utf8')))
const enrollmentVariables = [
  process.env.RUNNER_ENROLLMENT_OFFERS_FILE,
  process.env.RUNNER_ENROLLMENT_STATE_FILE,
  process.env.RUNNER_PUBLIC_URL,
]
const enrollmentConfigured = enrollmentVariables.some(value => value?.trim())
if (enrollmentConfigured && enrollmentVariables.some(value => !value?.trim())) {
  throw new Error('Runner enrollment configuration is incomplete')
}
const enrollment = enrollmentConfigured ? await createEnrollmentService({
  offersFile: process.env.RUNNER_ENROLLMENT_OFFERS_FILE!.trim(),
  stateFile: process.env.RUNNER_ENROLLMENT_STATE_FILE!.trim(),
}) : undefined
await startRunnerGateway({
  bindings: config.bindings,
  host: process.env.RUNNER_GATEWAY_HOST ?? '127.0.0.1',
  port: Number(process.env.RUNNER_GATEWAY_PORT ?? '3090'),
  ...(process.env.RUNNER_DISPATCH_TOKEN?.trim() ? { dispatchToken: process.env.RUNNER_DISPATCH_TOKEN.trim() } : {}),
  ...(enrollment && process.env.RUNNER_PUBLIC_URL
    ? { enrollment, publicRunnerUrl: process.env.RUNNER_PUBLIC_URL.trim() }
    : {}),
})
