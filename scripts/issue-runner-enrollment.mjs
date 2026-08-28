import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

function identifier(value, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,200}$/.test(value)) throw new Error(`${name} is invalid`)
  return value
}

async function readOffers(file) {
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'))
    if (!parsed || !Array.isArray(parsed.offers)) throw new Error('enrollment offer file is invalid')
    return parsed.offers
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return []
    throw error
  }
}

export async function issueRunnerEnrollmentCode(options) {
  const tenantId = identifier(options.tenantId, 'tenantId')
  const userId = identifier(options.userId, 'userId')
  const ttlMinutes = Number(options.ttlMinutes)
  if (!Number.isSafeInteger(ttlMinutes) || ttlMinutes < 1 || ttlMinutes > 1_440) throw new Error('ttlMinutes must be 1–1440')
  const now = (options.now ?? Date.now)()
  const code = (options.createCode ?? (() => randomBytes(32).toString('base64url')))()
  if (typeof code !== 'string' || code.length < 16 || code.length > 200 || /[\r\n]/.test(code)) throw new Error('generated code is invalid')
  const expiresAt = now + (ttlMinutes * 60_000)
  const existing = await readOffers(options.offersFile)
  const active = existing.filter(offer => Number.isSafeInteger(offer.expiresAt) && offer.expiresAt >= now)
  const next = { offers: [...active, {
    codeSha256: createHash('sha256').update(code).digest('hex'), tenantId, userId, expiresAt,
  }] }
  await mkdir(path.dirname(options.offersFile), { recursive: true })
  const temporary = `${options.offersFile}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, options.offersFile)
  return Object.freeze({ code, expiresAt })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await issueRunnerEnrollmentCode({
    offersFile: path.resolve(process.env.RUNNER_ENROLLMENT_OFFERS_FILE ?? 'runner-enrollment.json'),
    tenantId: process.env.RUNNER_TENANT_ID,
    userId: process.env.RUNNER_USER_ID,
    ttlMinutes: Number(process.env.RUNNER_ENROLLMENT_TTL_MINUTES ?? '15'),
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
