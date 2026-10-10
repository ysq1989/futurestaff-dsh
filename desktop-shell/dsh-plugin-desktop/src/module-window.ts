import { BrowserWindow, shell } from 'electron'
import type { NativeImage, Session } from 'electron'

/** Desktop-owned, exact local target; the renderer cannot supply an arbitrary URL. */
export function douyinModuleWindowUrl(root: string): string {
  const url = new URL(root)
  url.hash = ''
  url.searchParams.set('futurestaff-module', 'douyin')
  return url.href
}

/** One independently movable native module window per active shell generation. */
export class DesktopModuleWindow {
  private window: BrowserWindow | undefined
  private readonly url: string
  constructor(root: string, private readonly session: Session, private readonly icon: NativeImage,
    private readonly rendererIds: Set<number>, private readonly logError: (message: string) => void) {
    this.url = douyinModuleWindowUrl(root)
  }
  open(requested: string): boolean {
    if (requested !== this.url) return false
    const existing = this.window
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore()
      existing.show(); existing.focus(); return true
    }
    const window = new BrowserWindow({
      title: '抖音获客 · FutureStaff', width: 1180, height: 820, minWidth: 760, minHeight: 560,
      show: false, icon: this.icon,
      webPreferences: { session: this.session, contextIsolation: true, nodeIntegration: false,
        sandbox: true, webSecurity: true },
    })
    this.window = window
    this.rendererIds.add(window.webContents.id)
    window.removeMenu()
    window.webContents.setWindowOpenHandler(({ url }) => {
      try { const target = new URL(url); if (target.protocol === 'https:' && target.hostname === 'www.douyin.com' && !target.username && !target.password)
        void shell.openExternal(target.href).catch(() => { this.logError('dsh-plugin-desktop: Douyin source link failed to open') }) } catch {}
      return { action: 'deny' }
    })
    window.webContents.on('will-attach-webview', event => event.preventDefault())
    const navigate = (event: Electron.Event, target: string) => {
      // Only this local document may navigate. It cannot become a browser for arbitrary pages.
      try { const url = new URL(target); url.hash = ''; if (url.href !== this.url) event.preventDefault() }
      catch { event.preventDefault() }
    }
    window.webContents.on('will-navigate', navigate)
    window.webContents.on('will-frame-navigate', event => { if (event.isMainFrame) navigate(event, event.url); else event.preventDefault() })
    window.webContents.on('will-redirect', navigate)
    window.once('ready-to-show', () => { if (!window.isDestroyed()) { window.show(); window.focus() } })
    const id = window.webContents.id
    window.once('closed', () => { this.rendererIds.delete(id); if (this.window === window) this.window = undefined })
    void window.loadURL(this.url).catch(() => {
      this.logError('dsh-plugin-desktop: module window failed to load')
      this.rendererIds.delete(id)
      if (!window.isDestroyed()) window.destroy()
      if (this.window === window) this.window = undefined
    })
    return true
  }
  close(): void {
    const window = this.window; this.window = undefined
    if (!window) return
    this.rendererIds.delete(window.webContents.id)
    if (!window.isDestroyed()) window.destroy()
  }
}
