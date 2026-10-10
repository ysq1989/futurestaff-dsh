import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { serveStdio } from '@modelcontextprotocol/server/stdio'
import { BrowserAdapter, browserConfigSchema } from './browser.js'
import { DmEngine } from './engine.js'
import { FileStore } from './store.js'
import { createDmServer } from './server.js'

const file = process.env.DOUYIN_DM_CONFIG
if (!file || !path.isAbsolute(file)) throw new Error('Absolute DOUYIN_DM_CONFIG is required')
const config = z.object({
  identityMode: z.literal('single-subject'), subject: z.string().trim().min(1).max(200),
  deviceId: z.string().trim().min(1).max(100), live: z.boolean().default(false),
  stateFile: z.string().refine(path.isAbsolute), browser: browserConfigSchema,
}).strict().parse(JSON.parse(await readFile(file, 'utf8')))
if (config.live && JSON.stringify(config.browser).match(/REPLACE_WITH_|data-operator-verified-/)) {
  throw new Error('LIVE_CONFIG_NOT_CALIBRATED')
}
// These values come from the operator-owned config, never from Tool arguments.
const owner = createHash('sha256').update(JSON.stringify([config.subject, config.deviceId, config.browser.accountId])).digest('hex')
const store = new FileStore(config.stateFile)
await store.acquire()
const adapter = new BrowserAdapter(config.browser)
const engine = new DmEngine(owner, adapter, store, config.live)
try { await engine.init() } catch (error) { await store.close(); throw error }
let ticking = false
const timer = setInterval(() => {
  if (ticking) return
  ticking = true
  void engine.tick().catch(() => { process.stderr.write('Douyin task storage failure; stopping process\n'); process.exitCode = 1; void stop() })
    .finally(() => { ticking = false })
}, 1000)
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true; clearInterval(timer)
  try { await engine.pause() } finally { adapter.close(); await store.close() }
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { void stop().finally(() => process.exit()) })
process.stdin.on('end', () => { void stop().finally(() => process.exit()) })
void serveStdio(() => createDmServer(engine, config.browser.accountId, config.deviceId))
