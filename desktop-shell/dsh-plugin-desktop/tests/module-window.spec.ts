import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NativeImage, Session } from 'electron'
const native = vi.hoisted(() => {
  const windows: any[] = []
  const load = vi.fn(async () => {})
  class BrowserWindow {
    readonly webContents = { id: 100 + windows.length, on: vi.fn(), setWindowOpenHandler: vi.fn() }
    readonly once = vi.fn(); readonly removeMenu = vi.fn(); readonly destroy = vi.fn()
    readonly isDestroyed = vi.fn(() => false); readonly isMinimized = vi.fn(() => false)
    readonly restore = vi.fn(); readonly show = vi.fn(); readonly focus = vi.fn()
    readonly loadURL = load
    constructor(readonly options: unknown) { windows.push(this) }
  }
  return { windows, BrowserWindow, load, shell: { openExternal: vi.fn(async () => {}) } }
})
vi.mock('electron', () => ({ BrowserWindow: native.BrowserWindow, shell: native.shell }))
import { DesktopModuleWindow, douyinModuleWindowUrl } from '../src/module-window.ts'
const root = 'http://127.0.0.1:43120/?dsh-desktop-mode=extended&dsh-desktop-generation=fixture'
describe('owned native module window', () => {
  beforeEach(() => { native.windows.length = 0; vi.clearAllMocks() })
  function fixture() {
    const ids = new Set([73]), session = {} as Session
    return { ids, session, manager: new DesktopModuleWindow(root, session, {} as NativeImage, ids, vi.fn()) }
  }
  it('opens only the exact local module target, uses the authenticated session and focuses a singleton', () => {
    const { manager, ids, session } = fixture(), url = douyinModuleWindowUrl(root)
    for (const target of ['https://evil.invalid/', url + '&other=1', url.replace('douyin', 'other'), url.replace('127.0.0.1', 'localhost')]) expect(manager.open(target)).toBe(false)
    expect(native.windows).toHaveLength(0)
    expect(manager.open(url)).toBe(true)
    const window = native.windows[0]!
    expect(window.options).toMatchObject({ title: '抖音获客 · FutureStaff', webPreferences: { session, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true } })
    expect(window.options.parent).toBeUndefined(); expect(ids.has(window.webContents.id)).toBe(true)
    expect(window.loadURL).toHaveBeenCalledWith(url)
    window.isMinimized.mockReturnValue(true); expect(manager.open(url)).toBe(true)
    expect(native.windows).toHaveLength(1); expect(window.restore).toHaveBeenCalledOnce(); expect(window.focus).toHaveBeenCalledOnce()
    manager.close(); expect(window.destroy).toHaveBeenCalledOnce(); expect([...ids]).toEqual([73])
  })
  it('revokes renderer membership when closed and blocks navigation outside the module', () => {
    const { manager, ids } = fixture(), url = douyinModuleWindowUrl(root)
    manager.open(url); const window = native.windows[0]!
    const navigate = window.webContents.on.mock.calls.find(([name]: string[]) => name === 'will-navigate')[1]
    const allowed = { preventDefault: vi.fn() }; navigate(allowed, url + '#tab'); expect(allowed.preventDefault).not.toHaveBeenCalled()
    for (const target of [root, 'https://www.douyin.com/', 'javascript:alert(1)']) {
      const event = { preventDefault: vi.fn() }; navigate(event, target); expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    window.once.mock.calls.find(([name]: string[]) => name === 'closed')[1]()
    expect([...ids]).toEqual([73]); manager.open(url); expect(native.windows).toHaveLength(2)
  })
  it('removes the capability after failed document loading', async () => {
    const { manager, ids } = fixture()
    native.load.mockRejectedValueOnce(Error('fixture failure'))
    manager.open(douyinModuleWindowUrl(root)); await Promise.resolve()
    expect([...ids]).toEqual([73]); expect(native.windows[0]!.destroy).toHaveBeenCalledOnce()
  })
})
