import { connectRunner, loadInstalledRunnerConfig } from './index.js'

const installedConfig = process.env.FUTURESTAFF_RUNNER_CONFIG?.trim()
const config = installedConfig
  ? await loadInstalledRunnerConfig(installedConfig)
  : {
      url: process.env.RUNNER_GATEWAY_URL,
      token: process.env.RUNNER_DEVICE_TOKEN,
      tenantId: process.env.RUNNER_TENANT_ID,
      userId: process.env.RUNNER_USER_ID,
      runnerId: process.env.RUNNER_ID,
      deviceId: process.env.RUNNER_DEVICE_ID,
    }
if (installedConfig) process.stdout.write(`${JSON.stringify({ level: 'info', event: 'runner_configuration_ready' })}\n`)
connectRunner(config)
