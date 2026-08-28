import { readFile, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

import { parseRunnerClientConfig, type RunnerClientConfig } from './index.js'

function record(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`${name} must be an object`)
  return value as Record<string, unknown>
}

function text(value: unknown, name: string, minimum: number, maximum: number): string {
  if (typeof value !== 'string' || value.trim().length < minimum || value.length > maximum) throw new Error(`${name} is invalid`)
  return value.trim()
}

export async function enrollRunner(options: {
  readonly bootstrapFile: string
  readonly configFile: string
  readonly fetch?: typeof globalThis.fetch
}): Promise<RunnerClientConfig> {
  const bootstrap = record(JSON.parse(await readFile(options.bootstrapFile, 'utf8')), 'bootstrap config')
  if (Object.keys(bootstrap).sort().join(',') !== 'code,deviceName,gatewayUrl') throw new Error('bootstrap config has unknown fields')
  const gatewayUrl = new URL(text(bootstrap.gatewayUrl, 'gatewayUrl', 1, 2_048))
  if (gatewayUrl.protocol !== 'https:' || gatewayUrl.pathname !== '/' || gatewayUrl.search || gatewayUrl.hash
    || gatewayUrl.username || gatewayUrl.password) throw new Error('gatewayUrl is invalid')
  const code = text(bootstrap.code, 'enrollment code', 16, 200)
  const deviceName = text(bootstrap.deviceName, 'device name', 1, 100)
  const response = await (options.fetch ?? globalThis.fetch)(new URL('/runner/v1/enroll', gatewayUrl), {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code, deviceName }), signal: AbortSignal.timeout(30_000),
  })
  const payload = record(await response.json(), 'enrollment response')
  if (!response.ok) {
    const error = record(payload.error, 'enrollment error')
    throw new Error(`Runner enrollment failed: ${text(error.code, 'error code', 1, 100)}`)
  }
  const config = parseRunnerClientConfig(record(payload.data, 'enrollment data'))
  const stored = {
    url: config.url, token: config.token, tenantId: config.tenantId, userId: config.userId,
    runnerId: config.runnerId, deviceId: config.deviceId,
  }
  const temporary = `${options.configFile}.${process.pid}.tmp`
  await writeFile(temporary, `${JSON.stringify(stored, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, options.configFile)
  // Remove the usable code before unlinking so an unlink failure cannot leave
  // a replayable secret in the active configuration directory.
  await writeFile(options.bootstrapFile, '{"consumed":true}\n', { encoding: 'utf8', mode: 0o600 })
  await unlink(options.bootstrapFile)
  return config
}

export async function loadInstalledRunnerConfig(configFile: string): Promise<RunnerClientConfig> {
  try {
    return parseRunnerClientConfig(JSON.parse(await readFile(configFile, 'utf8')))
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
  }
  return enrollRunner({ bootstrapFile: path.join(path.dirname(configFile), 'bootstrap.json'), configFile })
}
