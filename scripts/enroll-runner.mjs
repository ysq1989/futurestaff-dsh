import { createHash, randomBytes } from 'node:crypto'
import { writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

function identifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/.test(value)) throw new Error(`${name} is invalid`)
  return value
}

export async function createRunnerEnrollment(options) {
  const tenantId = identifier(options.tenantId, 'tenantId')
  const userId = identifier(options.userId, 'userId')
  const runnerId = identifier(options.runnerId, 'runnerId')
  const deviceId = identifier(options.deviceId, 'deviceId')
  const token = options.token ?? randomBytes(48).toString('base64url')
  if (typeof token !== 'string' || token.length < 32 || token.length > 512 || /[\r\n]/.test(token)) throw new Error('token is invalid')
  const gatewayUrl = new URL(options.gatewayUrl)
  if (gatewayUrl.protocol !== 'wss:' || gatewayUrl.pathname !== '/runner/v1/connect' || gatewayUrl.search) {
    throw new Error('gatewayUrl must be the secure Runner endpoint')
  }
  const clientEnvPath = resolve(options.clientEnvPath)
  const bindingsPath = resolve(options.bindingsPath)
  const clientEnv = [
    `RUNNER_GATEWAY_URL=${gatewayUrl.href}`,
    `RUNNER_DEVICE_TOKEN=${token}`,
    `RUNNER_TENANT_ID=${tenantId}`,
    `RUNNER_USER_ID=${userId}`,
    `RUNNER_ID=${runnerId}`,
    `RUNNER_DEVICE_ID=${deviceId}`,
    '',
  ].join('\n')
  const bindings = {
    bindings: [{
      tenantId, userId, runnerId, deviceId,
      capabilities: ['local.system_info', 'local.codex_usage'],
      tokenSha256: createHash('sha256').update(token).digest('hex'),
    }],
  }
  await writeFile(clientEnvPath, clientEnv, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  try {
    await writeFile(bindingsPath, `${JSON.stringify(bindings, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  } catch (error) {
    throw new Error('binding file was not created; remove the new client env before retrying', { cause: error })
  }
  return Object.freeze({ runnerId, deviceId, clientEnvPath, bindingsPath })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await createRunnerEnrollment({
    tenantId: process.env.RUNNER_TENANT_ID,
    userId: process.env.RUNNER_USER_ID,
    runnerId: process.env.RUNNER_ID,
    deviceId: process.env.RUNNER_DEVICE_ID,
    gatewayUrl: process.env.RUNNER_GATEWAY_URL ?? 'wss://dsh.fsstory.net/runner/v1/connect',
    clientEnvPath: process.env.RUNNER_CLIENT_ENV_PATH ?? 'runner/client/.env',
    bindingsPath: process.env.RUNNER_BINDINGS_PATH ?? 'runner-bindings.json',
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
