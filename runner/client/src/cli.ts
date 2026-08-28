import { connectRunner } from './index.js'

connectRunner({
  url: process.env.RUNNER_GATEWAY_URL,
  token: process.env.RUNNER_DEVICE_TOKEN,
  tenantId: process.env.RUNNER_TENANT_ID,
  userId: process.env.RUNNER_USER_ID,
  runnerId: process.env.RUNNER_ID,
  deviceId: process.env.RUNNER_DEVICE_ID,
})
