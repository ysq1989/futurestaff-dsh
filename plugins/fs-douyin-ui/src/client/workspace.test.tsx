import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { DouyinWorkspace, apply, moduleWindowUrl, type WorkspaceApi } from './index.js'
import type { DouyinSnapshot } from '../service.js'
import { SystemPages, SystemMain } from '../../../fs-platform-access/lib/client/system-pages.js'
function systemPages(){ const pages=new SystemPages();pages.bindOwner('tenant-a:user-a');return pages }
import { vietnamVisaProfile } from '@futurestaff/douyin-dm-mcp/lead-analysis'

const modelId = '30000000-0000-4000-8000-000000000001'
function fixture(): DouyinSnapshot {
  return { owner: 'a'.repeat(64), version: 1, profile: structuredClone(vietnamVisaProfile), modelId: null, revision: 0,
    watches: [], comments: {}, decisions: {}, candidates: {}, models: [{ modelId, displayName: 'FutureStaff 模型 A' }], keywords: [], preview: null,
    sending: { phase: 'idle', mode: null, sent: 0, cursor: 0, expiresAt: 0, nextAt: 0, live: false, events: [] }, browserReady: false, library: null, followingSync: null, account: { phase: 'disconnected', accountId: null } }
}
function transport() {
  let state = fixture()
  const act = vi.fn(async (command: Record<string, unknown>) => {
    if (command.action === 'model') state.modelId = command.modelId as string
    if (command.action === 'profile') state.profile = command.profile as DouyinSnapshot['profile']
    if (command.action === 'watch') state.watches.push({ id: '123456789', kind: 'work', url: command.url as string, name: command.name as string, intervalSeconds: command.intervalSeconds as number, nextAt: 0, enabled: true })
    if (command.action === 'toggle') state.watches[0]!.enabled = command.enabled as boolean
    return structuredClone(state)
  })
  return { get: vi.fn(async () => structuredClone(state)), act, set: (value: DouyinSnapshot) => { state = value } }
}
describe('DSH local Douyin workspace', () => {
  it('shows the actually approved sending policy after the page reloads',async()=>{
    const api=transport(),state=fixture();state.browserReady=true
    state.acquisition={phase:'running',expiresAt:Date.now()+60_000,nextDiscovery:0,nextSend:0,errorCode:undefined,policy:{message:'已批准的业务文案',send:true,maxMessagesPerDay:3,intervalSeconds:120,durationMinutes:5,discoveryIntervalMinutes:30}}
    api.set(state);render(<DouyinWorkspace transport={api}/>);await screen.findByLabelText('分析模型')
    fireEvent.click(screen.getByRole('tab',{name:'自动获客'}))
    expect(screen.getByRole('checkbox',{name:'对符合需求的留言自动私信'})).toBeChecked()
    expect(screen.getByLabelText('私信文案')).toHaveValue('已批准的业务文案')
    expect(screen.getByLabelText('每日最多私信人数')).toHaveValue(3)
    expect(screen.getByRole('button',{name:'启动自动获客'})).toBeDisabled()
  })
  it('requires explicit automatic-policy confirmation and keeps private sending disabled before receiver calibration',async()=>{
    const api=transport(),state=fixture();state.modelId=modelId;state.discoveryReady=true;state.account={phase:'connected',accountId:'fixture-account'}
    api.set(state);render(<DouyinWorkspace transport={api}/>);await screen.findByLabelText('分析模型')
    fireEvent.click(screen.getByRole('tab',{name:'自动获客'}))
    expect(screen.getByRole('checkbox',{name:'对符合需求的留言自动私信'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'启动自动获客'}))
    expect(api.act).not.toHaveBeenCalled();expect(screen.getByRole('alertdialog',{name:'确认自动获客'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'确认启动自动获客'}))
    await waitFor(()=>expect(api.act).toHaveBeenCalledWith(expect.objectContaining({action:'acquisition-start',confirmation:'确认启动自动获客',policy:expect.objectContaining({send:false,maxMessagesPerDay:10})})))
  })
  it('moves the in-app window by its title bar, keeps it visible and leaves the close button usable', async () => {
    const api = transport(), close = vi.fn()
    render(<DouyinWorkspace transport={api} onClose={close}/>); await screen.findByLabelText('分析模型')
    const dialog = screen.getByRole('dialog', { name: '抖音获客' }), header = screen.getByLabelText('移动抖音获客窗口')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: 32, top: 32, width: 600, height: 500 } as DOMRect)
    const pointer = (type: string, x: number, y: number) => {
      const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
      Object.defineProperty(event, 'pointerId', { value: 1 })
      fireEvent(header, event)
    }
    pointer('pointerdown', 100, 100); pointer('pointermove', 140, 120); pointer('pointerup', 140, 120)
    expect(dialog.style.left).toBe('72px'); expect(dialog.style.top).toBe('52px')
    fireEvent.keyDown(header, { key: 'ArrowRight' })
    expect(dialog.style.left).toBe('52px')
    fireEvent.keyDown(header, { key: 'ArrowDown' })
    expect(dialog.style.top).toBe('52px')
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({ left: -100, top: -100, width: 600, height: 500 } as DOMRect)
    fireEvent(window, new Event('resize'))
    expect(dialog.style.left).toBe('8px'); expect(dialog.style.top).toBe('8px')
    fireEvent.click(screen.getByRole('button', { name: '关闭' }))
    expect(close).toHaveBeenCalledOnce()
  })
  it('asks before deleting a watch and shows actual runtime logs without enabling uncalibrated sending', async () => {
    const api = transport(), state = fixture()
    state.watches = [{ id: '123456789', kind: 'work', name: '测试作品', url: 'https://www.douyin.com/video/123456789', enabled: true, nextAt: 0, intervalSeconds: 600 }]
    state.runtimeLogs = [{ at: Date.now(), action: 'account-check', phase: 'completed' }]
    api.set(state)
    render(<DouyinWorkspace transport={api}/>); await screen.findByLabelText('分析模型')
    fireEvent.click(screen.getByRole('tab', { name: '关注作品' }))
    fireEvent.click(screen.getByRole('button', { name: '删除' }))
    expect(api.act).not.toHaveBeenCalled()
    expect(screen.getByRole('alertdialog', { name: '删除关注项' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))
    await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'watch-delete', id: '123456789', kind: 'work', confirmation: '确认删除' }))
    fireEvent.click(screen.getByRole('tab', { name: '运行日志' }))
    expect(screen.getByText('检查账号')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: '私信任务' }))
    expect(screen.getByRole('button', { name: '确认启动预约' })).toBeDisabled()
  })
  it('registers an additive sidebar entry and in-app workspace surface', () => {
    const names: string[] = [], registered: string[] = []
    apply({ platformSystemPages: systemPages(), slots: { inject: (name: string, fn: () => void) => { names.push(name); fn() }, register: (options: { id: string }) => { registered.push(options.id) } } } as never)
    expect(names).toEqual(['sidebar.footer.action','shell.overlay'])
    expect(registered).toEqual(['futurestaff-douyin-launcher','futurestaff-douyin-workspace'])
  })
  it('chooses only a catalog model and saves a user-defined target profile', async () => {
    const api = transport(); render(<DouyinWorkspace transport={api}/>)
    const selector = await screen.findByLabelText('分析模型')
    expect(screen.getByLabelText('画像名称')).toHaveValue('越南签证办理需求')
    fireEvent.change(selector, { target: { value: modelId } })
    await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'model', modelId }))
    await waitFor(() => expect(screen.getByRole('button', { name: '保存画像' })).not.toBeDisabled())
    fireEvent.change(screen.getByLabelText('业务目标'), { target: { value: '只找明确询问越南商务签证代办的用户' } })
    fireEvent.click(screen.getByRole('button', { name: '保存画像' }))
    await waitFor(() => expect(api.act).toHaveBeenCalledWith(expect.objectContaining({ action: 'profile', profile: expect.objectContaining({ objective: '只找明确询问越南商务签证代办的用户' }) })))
  })
  it('adds and pauses a watched work with no browser or external submission', async () => {
    const api = transport(); render(<DouyinWorkspace transport={api}/>)
    await screen.findByLabelText('分析模型'); fireEvent.click(screen.getByRole('tab', { name: '关注作品' }))
    fireEvent.change(screen.getByLabelText('备注名称'), { target: { value: '电子签攻略' } })
    fireEvent.change(screen.getByLabelText('视频或图文链接'), { target: { value: 'https://www.douyin.com/video/123456789' } })
    fireEvent.click(screen.getByRole('button', { name: '添加关注' }))
    expect(await screen.findByText('电子签攻略')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '暂停关注' }))
    await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'toggle', kind: 'work', id: '123456789', enabled: false }))
    expect(await screen.findByText('已暂停')).toBeInTheDocument()
  })
  it('shows candidate evidence and sends an explicit opt-out decision', async () => {
    const api = transport(), state = fixture(), key = 'b'.repeat(64)
    state.candidates.recipient_123 = { recipient: 'recipient_123', commentKeys: [key], profileVersion: 1, review: 'pending' }
    state.decisions[key] = { key, profileVersion: 1, modelId, classification: 'target', need: '需要办理电子签', reason: '明确需求', quotes: [{ source: 'comment', quote: '签证还没办，能帮忙吗？' }] }
    api.set(state); render(<DouyinWorkspace transport={api}/>)
    await screen.findByLabelText('分析模型'); fireEvent.click(screen.getByRole('tab', { name: '目标用户' }))
    expect(screen.getByText('签证还没办，能帮忙吗？')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '拒绝联系' }))
    await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'review', recipient: 'recipient_123', decision: 'opt-out' }))
  })
  it('keeps live sending disabled when showing a persisted plan preview', async () => {
    const api = transport(), state = fixture()
    state.preview = { previewId: 'c'.repeat(64), plan: { mode: 'outbound', recipients: ['recipient_123'], message: '测试预览', scheduledAt: '2026-10-04T04:00:00Z', intervalSeconds: 60, durationSeconds: 3600, maxMessages: 1 } }
    state.sending.phase = 'draft'; api.set(state); render(<DouyinWorkspace transport={api}/>)
    await screen.findByLabelText('分析模型'); fireEvent.click(screen.getByRole('tab', { name: '私信任务' }))
    expect(screen.getByText('测试预览')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '确认启动预约' })).toBeDisabled()
    expect(api.act).not.toHaveBeenCalled()
  })
  it('does not display local candidate data when the Host refuses access', async () => {
    const api: WorkspaceApi = { get: async () => { throw new Error('expired') }, act: async () => { throw new Error('unavailable') } }
    render(<DouyinWorkspace transport={api}/>); expect(await screen.findByRole('alert')).toHaveTextContent('请先登录 FutureStaff')
    expect(screen.queryByRole('tab', { name: '目标用户' })).not.toBeInTheDocument()
  })
  it('unmounts the open workspace immediately when the shared login state changes', async () => {
    const callbacks = new Set<() => void>()
    let session = { phase: 'ready', activeTenantId: 'tenant-a', user: { userId: 'user-a' } }
    const components: Record<string, React.ComponentType> = {}
    const controller = { getSnapshot: () => session, subscribe: (fn: () => void) => { callbacks.add(fn); return () => callbacks.delete(fn) } }
    const pages=systemPages()
    apply({ platformSystemPages: pages, platformClientSession: controller, slots: { inject: (_name: string, fn: () => void) => fn(), register: (options: { id: string }, component: React.ComponentType) => { components[options.id] = component } } } as never)
    const get = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture())))
    const Launcher = components['futurestaff-douyin-launcher']!, Surface = components['futurestaff-douyin-workspace']!
    render(<><Launcher/><SystemMain pages={pages} chat={<p>会话</p>}/></>)
    fireEvent.click(screen.getByRole('button', { name: '打开抖音获客' }))
    expect(await screen.findByLabelText('分析模型')).toBeInTheDocument()
    act(() => { session = { ...session, phase: 'loading' }; callbacks.forEach(fn => fn()) })
    expect(screen.queryByLabelText('分析模型')).not.toBeInTheDocument()
    get.mockRestore()
  })
})


it('opens account login through the bounded Host action without asking for cookies or passwords', async () => {
  const api = transport(); render(<DouyinWorkspace transport={api}/>)
  await screen.findByLabelText('分析模型')
  fireEvent.click(screen.getByRole('tab', { name: '抖音账号' }))
  expect(screen.getByText('尚未连接抖音账号')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '打开抖音登录浏览器' }))
  await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'account-open' }))
})

it('filters owned favorites, skips imported records and submits only snapshot selection IDs', async () => {
  const api = transport(), state = fixture()
  state.account = { phase: 'connected', accountId: 'MS4wLjABown_account_12345' }
  state.library = { kind: 'favorites', accountId: state.account.accountId!, snapshotId: 'e'.repeat(64), expiresAt: Date.now() + 300000,
    items: [{ id: '123456789', url: 'https://www.douyin.com/video/123456789', name: '签证攻略' },
      { id: '23456789', url: 'https://www.douyin.com/video/23456789', name: '已监控视频' }] }
  state.watches = [{ id: '23456789', kind: 'work', url: 'https://www.douyin.com/video/23456789', name: '已有', enabled: true, nextAt: 0, intervalSeconds: 600 }]
  api.set(state); render(<DouyinWorkspace transport={api}/>)
  await screen.findByLabelText('分析模型'); fireEvent.click(screen.getByRole('tab', { name: '关注作品' }))
  expect(screen.getByRole('checkbox', { name: '选择 已监控视频' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('搜索列表'), { target: { value: '签证' } })
  fireEvent.click(screen.getByRole('button', { name: '全选搜索结果' }))
  expect(screen.getByRole('checkbox', { name: '选择 签证攻略' })).toBeChecked()
  fireEvent.click(screen.getByRole('button', { name: '导入所选到监控列表' }))
  await waitFor(() => expect(api.act).toHaveBeenCalledWith({ action: 'library-import', snapshotId: 'e'.repeat(64), ids: ['123456789'], intervalSeconds: 600 }))
})


it('shows check progress and an explicit result when the account is still unconfirmed', async () => {
  const api = transport(), state = fixture()
  state.account = { phase: 'awaiting-login', accountId: null }; api.set(state)
  let resolve!: (value: DouyinSnapshot) => void
  api.act.mockImplementationOnce(() => new Promise<DouyinSnapshot>(r => { resolve = r }))
  render(<DouyinWorkspace transport={api}/>); await screen.findByLabelText('分析模型')
  fireEvent.click(screen.getByRole('tab', { name: '抖音账号' }))
  fireEvent.click(screen.getByRole('button', { name: '检查登录状态' }))
  expect(screen.getByText('正在检查抖音登录状态，请稍候…')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '检查登录状态' })).toBeDisabled()
  await act(async () => resolve(state))
  expect(await screen.findByText(/检查完成，尚未确认登录/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '检查登录状态' })).toBeEnabled()
})
it('shows an explicit successful check and preserves an actionable failure', async () => {
  const api = transport(), state = fixture()
  state.account = { phase: 'connected', accountId: 'MS4wLjABown_account_12345' }; api.set(state)
  render(<DouyinWorkspace transport={api}/>); await screen.findByLabelText('分析模型')
  fireEvent.click(screen.getByRole('tab', { name: '抖音账号' }))
  fireEvent.click(screen.getByRole('button', { name: '检查登录状态' }))
  expect(await screen.findByText('登录检查完成，已确认抖音账号。')).toBeInTheDocument()
  api.act.mockRejectedValueOnce(new Error('登录检查失败，请重试。'))
  fireEvent.click(screen.getByRole('button', { name: '检查登录状态' }))
  expect(await screen.findByRole('alert')).toHaveTextContent('登录检查失败，请重试。')
})


it('opens a system main-area tab without a popup on both current and older Desktop shells', async () => {
  const previous=window.location.href
  const components:Record<string,React.ComponentType<any>>={},pages=systemPages()
  const opener=vi.spyOn(window,'open').mockReturnValue(null)
  const session={phase:'ready',activeTenantId:'tenant-a',user:{userId:'user-a'}}
  const state=fixture(),get=vi.spyOn(globalThis,'fetch').mockImplementation(async()=>new Response(JSON.stringify(state)))
  try{
    window.history.replaceState({},'','/?dsh-desktop-mode=extended&dsh-desktop-version=2.0.21')
    apply({platformSystemPages:pages,platformClientSession:{subscribe:()=>()=>{},getSnapshot:()=>session},slots:{inject:(_name:string,fn:()=>void)=>fn(),register:(options:{id:string},component:React.ComponentType<any>)=>{components[options.id]=component}}} as never)
    const Launcher=components['futurestaff-douyin-launcher']!;render(<><Launcher/><SystemMain pages={pages} chat={<p>原有会话</p>}/></>)
    fireEvent.click(screen.getByRole('button',{name:'打开抖音获客'}))
    expect(await screen.findByLabelText('分析模型')).toBeInTheDocument()
    expect(pages.getSnapshot().active).toBe('douyin');expect(pages.getSnapshot().tabs).toHaveLength(1)
    expect(opener).not.toHaveBeenCalled();expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(()=>pages.select('sessions'));expect(screen.getByText('原有会话')).toBeVisible()
    act(()=>pages.select('systems'));expect(screen.getByLabelText('分析模型')).toBeVisible()
  }finally{opener.mockRestore();get.mockRestore();window.history.replaceState({},'',previous)}
})
it('renders the standalone workspace immediately and clears data when platform access is lost', async () => {
  const previous = window.location.href
  window.history.replaceState({}, '', '/?dsh-desktop-mode=extended&futurestaff-module=douyin')
  let session = { phase: 'ready', activeTenantId: 'tenant-a', user: { userId: 'user-a' } }
  const callbacks = new Set<() => void>(), components: Record<string, React.ComponentType<any>> = {}
  const get = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(fixture())))
  try {
    apply({ platformSystemPages: systemPages(), slots: { inject: (_name: string, fn: () => void) => fn(), register: (options: { id: string }, component: React.ComponentType<any>) => { components[options.id] = component } },
      platformClientSession: { subscribe: (fn: () => void) => { callbacks.add(fn); return () => { callbacks.delete(fn) } }, getSnapshot: () => session } } as never)
    const Surface = components['futurestaff-douyin-workspace']!; render(<Surface/>)
    expect(await screen.findByLabelText('分析模型')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: '抖音获客' })).toHaveClass('dy-native-window')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    act(() => { session = { ...session, phase: 'logged_out' }; callbacks.forEach(fn => fn()) })
    expect(screen.queryByLabelText('分析模型')).not.toBeInTheDocument()
    expect(screen.getByText('请在 FutureStaff 主窗口完成登录和主体选择。')).toBeInTheDocument()
  } finally { get.mockRestore(); window.history.replaceState({}, '', previous) }
})


it('syncs following with one action, progress feedback and a deduplicated result', async () => {
  const api = transport(), state = fixture()
  state.account = { phase: 'connected', accountId: 'MS4wLjABown_account_12345' }
  api.set(state)
  let finish!: (value: DouyinSnapshot) => void
  api.act.mockImplementationOnce(() => new Promise<DouyinSnapshot>(r => { finish = r }))
  render(<DouyinWorkspace transport={api}/>); await screen.findByLabelText('分析模型')
  fireEvent.click(screen.getByRole('tab', { name: '关注账号' }))
  fireEvent.click(screen.getByRole('button', { name: '一键同步我的关注' }))
  expect(api.act).toHaveBeenCalledWith({ action: 'following-sync' })
  expect(screen.getByText('正在打开我的关注并加载列表…')).toBeInTheDocument()
  state.followingSync = { running: true, count: 17, added: 0 }; api.set(state)
  expect(await screen.findByText('正在同步我的关注，已读取 17 个账号…', {}, { timeout: 2000 })).toBeInTheDocument()
  state.followingSync = { running: false, count: 19, added: 18 }
  await act(async () => finish(state))
  expect(await screen.findByText('同步完成：读取 19 个关注账号，新增 18 个，已有 1 个。')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '一键同步我的关注' })).toBeEnabled()
})
