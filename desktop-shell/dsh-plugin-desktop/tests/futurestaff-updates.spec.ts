import type { Context } from '@deepseek-ai/cordis'
import { generateKeyPairSync, sign } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { apply, type Config } from '../src/futurestaff-updates.ts'
import type { DesktopTrayItem } from '../src/runtime.ts'

const keys = generateKeyPairSync('ed25519')
const config: Config = { manifestUrl: 'https://updates.fsstory.net/stable.json',
  publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(), signerThumbprint: 'A'.repeat(40), background: true }
function signed(version = '2.0.11'): Response {
  const artifact = { url: 'https://updates.fsstory.net/setup.exe', sha256: 'a'.repeat(64), size: 100 }
  const payload = JSON.stringify({ schemaVersion: 1, productId: 'net.fsstory.agent.desktop', platform: 'win32', arch: 'x64',
    version, notes: 'Release notes', installer: artifact, rollback: { ...artifact, version: '2.0.9' } })
  return Response.json({ payload, signature: sign(null, Buffer.from(payload), keys.privateKey).toString('base64') })
}
function harness(options: { configured?: boolean; accept?: boolean; version?: string; packaged?: boolean; reject?: boolean } = {}) {
  const notice = vi.fn(async () => {})
  const confirm = vi.fn(async () => options.accept ?? false)
  const install = vi.fn(async () => {})
  const notify = vi.fn()
  const request = vi.fn(async () => { if (options.reject) throw new Error('offline'); return signed(options.version) })
  const unregister = vi.fn()
  const trayDispose = vi.fn()
  let tray: DesktopTrayItem | undefined
  let dispose: (() => void) | undefined
  const ctx = { desktopRuntime: { platform: 'win32', locale: 'zh', updates: { isPackaged: options.packaged ?? true,
    currentVersion: '2.0.10', request, notify, futureStaff: { notice, confirm, install } },
  registerTrayItem: (item: DesktopTrayItem) => { tray = item; return { refresh() {}, dispose: trayDispose } } },
  webServer: { port: 43821, register: vi.fn(() => unregister) },
  effect: (fn: () => (() => void)) => { dispose = fn() },
  } as unknown as Context
  apply(ctx, options.configured === false ? { ...config, manifestUrl: '' } : config)
  return { notice, confirm, install, notify, request, unregister, trayDispose,
    check: () => tray!.invoke(), dispose: () => dispose!(), ctx }
}
afterEach(() => { vi.useRealTimers() })

it('reports missing source without any external request', async () => {
  const h = harness({ configured: false }); await h.check(); h.dispose()
  expect(h.notice).toHaveBeenCalledWith(expect.stringContaining('尚未配置'))
  expect(h.request).not.toHaveBeenCalled(); expect(h.install).not.toHaveBeenCalled()
})
it('reports unsupported developer builds without querying a release feed', async () => {
  const h = harness({ packaged: false }); await h.check(); h.dispose()
  expect(h.notice).toHaveBeenCalledWith(expect.stringContaining('Windows x64'))
  expect(h.request).not.toHaveBeenCalled()
})
it('reports latest version and never offers downgrade', async () => {
  const h = harness({ version: '2.0.10' }); await h.check(); h.dispose()
  expect(h.notice).toHaveBeenCalledWith(expect.stringContaining('最新版本'))
  expect(h.confirm).not.toHaveBeenCalled(); expect(h.install).not.toHaveBeenCalled()
})
it.each([false, true])('downloads only after user acceptance %s', async accept => {
  const h = harness({ accept }); await h.check(); h.dispose()
  expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({ version: '2.0.11', notes: 'Release notes' }))
  expect(h.install).toHaveBeenCalledTimes(accept ? 1 : 0)
})
it('reports failed checks without executing anything', async () => {
  const h = harness({ reject: true }); await h.check(); h.dispose()
  expect(h.notice).toHaveBeenCalledWith(expect.stringContaining('失败')); expect(h.install).not.toHaveBeenCalled()
})
it('coalesces concurrent manual checks into a single confirmation', async () => {
  const h = harness({ accept: true })
  await Promise.all([h.check(), h.check(), h.check()]); h.dispose()
  expect(h.request).toHaveBeenCalledOnce(); expect(h.confirm).toHaveBeenCalledOnce(); expect(h.install).toHaveBeenCalledOnce()
})
it('background checks notify once without prompting or installing, and dispose removes resources', async () => {
  vi.useFakeTimers()
  const h = harness()
  await vi.advanceTimersByTimeAsync(60_000)
  await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
  expect(h.notify).toHaveBeenCalledOnce(); expect(h.confirm).not.toHaveBeenCalled(); expect(h.install).not.toHaveBeenCalled()
  h.dispose()
  await vi.advanceTimersByTimeAsync(6 * 60 * 60_000)
  expect(h.request).toHaveBeenCalledTimes(2); expect(h.unregister).toHaveBeenCalledOnce(); expect(h.trayDispose).toHaveBeenCalledOnce()
})
