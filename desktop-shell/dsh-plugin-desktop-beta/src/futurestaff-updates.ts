/** Manual and background update checks confined to the FutureStaff release source. */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from './runtime.ts'
import { DESKTOP_UPDATE_CHECK_PATH } from './desktop-settings-contract.ts'
import { handleDesktopUpdateCheckRequest } from './desktop-settings-route.ts'
import { checkFutureStaffUpdate, type FutureStaffUpdateTrust } from './futurestaff-update.ts'
import { compareSemVerVersions } from './update-checker.ts'

export const name = 'futurestaff-updates'
export const inject = ['desktopRuntime', 'webServer']
export interface Config extends FutureStaffUpdateTrust { readonly background: boolean }
export const Config: z<Config> = z.object({
  manifestUrl: z.string().default(''), publicKey: z.string().default(''),
  signerThumbprint: z.string().default(''), background: z.boolean().default(true),
})

export function apply(ctx: Context, config: Config): void {
  ctx.effect(() => {
    const adapter = ctx.desktopRuntime.updates
    const native = adapter.futureStaff
    let disposed = false
    let active: Promise<void> | undefined
    let activeManual = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let controller: AbortController | undefined
    let announced: string | undefined
    const zh = (): boolean => ctx.desktopRuntime.locale === 'zh'
    const message = (cn: string, en: string): string => zh() ? cn : en
    const run = (manual: boolean): Promise<void> => {
      if (disposed) return Promise.resolve()
      // Manual actions arriving during a background check get their own visible result.
      if (active) return manual && !activeManual ? active.then(() => run(true)) : active
      activeManual = manual
      active = (async () => {
        if (!native) throw new Error('FUTURESTAFF_UPDATE_RUNTIME_REQUIRED')
        if (!config.manifestUrl || !config.publicKey || !config.signerThumbprint) {
          if (manual) await native.notice(message('尚未配置软件更新源，请联系管理员。', 'The update source is not configured. Contact your administrator.'))
          return
        }
        if (!adapter.isPackaged || ctx.desktopRuntime.platform !== 'win32' || process.arch !== 'x64') {
          if (manual) await native.notice(message('软件更新目前仅支持已安装的 Windows x64 版本。', 'Updates currently support installed Windows x64 builds.'))
          return
        }
        controller = new AbortController()
        const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)])
        const release = await checkFutureStaffUpdate(config, adapter.request, signal)
        if (disposed) return
        const comparison = compareSemVerVersions(adapter.currentVersion, release.version)
        if (comparison === null) throw new Error('UPDATE_VERSION_REJECTED')
        if (comparison >= 0) {
          if (manual) await native.notice(message(`当前已是最新版本（${adapter.currentVersion}）。`, `You are up to date (${adapter.currentVersion}).`))
          return
        }
        if (!manual) {
          if (announced !== release.version) adapter.notify({
            title: 'FutureStaff Agent',
            body: message(`发现新版本 ${release.version}，请通过版本按钮或托盘检查更新。`, `Version ${release.version} is available. Check for updates from the version button or tray.`),
          })
          announced = release.version
          return
        }
        if (await native.confirm(release) && !disposed) {
          await native.install(release, config, AbortSignal.any([controller.signal, AbortSignal.timeout(10 * 60_000)]))
        }
      })().catch(async () => {
        if (manual && !disposed && native) await native.notice(message('更新检查或安装包校验失败，请稍后重试或联系管理员。', 'The update check or installer verification failed. Try again or contact your administrator.'))
      }).finally(() => { active = undefined; controller = undefined })
      return active
    }
    const tray = ctx.desktopRuntime.registerTrayItem({ group: 'status', order: 10,
      label: () => message('检查软件更新', 'Check for updates'), invoke: () => run(true),
    })
    const unregister = ctx.webServer.register({ kind: 'exact', path: DESKTOP_UPDATE_CHECK_PATH,
      handler: (req, res) => handleDesktopUpdateCheckRequest(req, res,
        `http://127.0.0.1:${String(ctx.webServer.port)}`, () => run(true)),
    })
    const poll = (): void => {
      timer = setTimeout(() => { void run(false).finally(() => { if (!disposed) poll() }) }, 6 * 60 * 60_000)
      timer.unref()
    }
    if (config.background && config.manifestUrl && adapter.isPackaged) {
      timer = setTimeout(() => { void run(false).finally(() => { if (!disposed) poll() }) }, 60_000)
      timer.unref()
    }
    return () => { disposed = true; if (timer) clearTimeout(timer); controller?.abort(); tray.dispose(); unregister() }
  }, 'FutureStaff: signed release checks and confirmation-gated installation')
}
