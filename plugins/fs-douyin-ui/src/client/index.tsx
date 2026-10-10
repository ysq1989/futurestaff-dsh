import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@futurestaff/fs-platform-access/client'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { DouyinSnapshot } from '../service.js'

type Action = Record<string, unknown>
export interface WorkspaceApi { get(): Promise<DouyinSnapshot>; act(action: Action): Promise<DouyinSnapshot> }
async function request(action?: Action) {
  const response = await fetch('/_futurestaff/douyin/v1/workspace', { method: action ? 'POST' : 'GET', cache: 'no-store',
    headers: { 'x-futurestaff-douyin': '1', ...(action ? { 'content-type': 'application/json' } : {}) },
    ...(action ? { body: JSON.stringify(action) } : {}) })
  if (!response.ok) {
    const result = await response.json().catch(() => ({})) as { error?: string }
    const messages: Record<string, string> = { ACCOUNT_CHECK_FAILED: '登录检查失败，请检查抖音页面是否加载完成、网络或验证提示，然后重试。浏览器会保留。',
      COLLECTOR_NOT_READY: '专用浏览器尚未连接或确认登录，请先检查抖音账号状态。', PAUSE_SENDING_FIRST: '请先暂停私信任务再启动采集。', MODEL_REQUIRED: '请先选择分析模型。', WATCH_REQUIRED: '请先添加或启用关注项。',
      BROWSER_REQUIRED: '请安装 Google Chrome 或 Microsoft Edge 后重试。', BROWSER_START_FAILED: '登录浏览器启动失败，请关闭专用浏览器后重试。',
      BROWSER_PROFILE_PATH_TOO_LONG: '浏览器配置目录过长，无法安全启动，请联系管理员调整本机数据目录。',
      BROWSER_START_TIMEOUT: '登录浏览器启动超时，请稍后重试。', BROWSER_TAB_FAILED: '无法连接登录标签页，请重新打开登录浏览器。',
      ACCOUNT_LOGIN_REQUIRED: '请先在抖音账号页面打开浏览器并检查登录状态。',
      LIBRARY_INCOMPLETE: '关注列表尚未读取完整，本次没有导入。请查看专用浏览器的网络或验证提示，再重试。',
      LIBRARY_PANEL_REQUIRED: '无法识别关注或收藏列表，请检查专用浏览器是否出现登录、验证提示，或页面布局已变化。本次没有导入。',
      LIBRARY_ACCOUNT_PAGE_REQUIRED: '请返回已登录账号的个人主页，并打开关注或收藏列表。',
      LIBRARY_EXPIRED: '列表已过期，请重新读取后选择。', LIBRARY_ITEM_UNAVAILABLE: '所选内容已不在当前列表，请重新读取。',
      LIBRARY_ACCOUNT_CHANGED: '抖音账号已变化，请重新检查登录并读取列表。', WATCH_LIMIT: '监控列表最多保存 500 条，本次未导入。请减少已有监控记录或使用分批选择导入。' }
    throw new Error(messages[result.error ?? ''] ?? acquisitionErrorNames[result.error??''] ?? '操作未完成。请检查平台登录、模型权限、输入内容和浏览器连接。')
  }
  return await response.json() as DouyinSnapshot
}
const api: WorkspaceApi = { get: () => request(), act: action => request(action) }
const acquisitionErrorNames:Record<string,string>={ACQUISITION_NOT_READY:'请先检查抖音登录状态并选择分析模型。',SEND_NOT_READY:'请先检查私信连接，校验通过后再启用自动私信。',SEND_CANDIDATE_REQUIRED:'请先获得有留言证据且已入选的目标用户，再检查私信连接。',SEND_RECIPIENT_UNVERIFIED:'无法验证私信窗口的收件人，本次没有发送。请检查专用浏览器的私信页面。',SEND_ACCOUNT_CHANGED:'抖音账号已变化，请重新检查登录状态。',SEND_RESULT_UNKNOWN:'发送结果无法确认，已停止自动任务；请人工检查，避免重复发送。',ACQUISITION_CONTEXT_CHANGED:'画像、模型或登录状态已变化，请重新确认启动。',ACQUISITION_FAILED:'自动任务未完成，请检查浏览器、模型权限或验证提示。',MONITOR_FAILED:'留言监控失败，已停止自动任务，请查看采集日志。'}
const tabs = ['抖音账号','目标画像','自动获客','关注账号','关注作品','评论分析','目标用户','私信任务','运行日志'] as const
Object.assign(acquisitionErrorNames,{
  MODEL_LOGIN_REQUIRED:'模型调用失败：平台登录或账号归属已失效，请重新登录。',MODEL_NOT_AUTHORIZED:'模型调用失败：当前主体无权使用所选模型，请重新选择。',MODEL_PROVIDER_UNAVAILABLE:'模型供应商调用失败，请在平台检查该模型的供应商连接。',MODEL_SERVICE_UNAVAILABLE:'模型服务暂时不可用，请检查平台服务后重试。',MODEL_RATE_LIMIT:'模型调用被限流或额度已用尽，请稍后重试或检查额度。',MODEL_STORAGE_UNAVAILABLE:'无法保存模型调用的账号归属，请检查本机受保护存储。',MODEL_SESSION_INVALID:'模型分析会话初始化失败，请联系管理员。',MODEL_OUTPUT_INVALID:'模型返回的内容不是有效 JSON，任务已停止；可尝试更换分析模型。',MODEL_OUTPUT_LIMIT:'模型返回内容过长，任务已停止。',MODEL_BINDING_INVALID:'模型返回的账号或模型归属不匹配，任务已停止。',INFERENCE_INPUT_INVALID:'发送给模型的业务画像或视频资料过长，请精简画像或缩小分析范围。',INFERENCE_INCOMPLETE:'模型响应未完整结束，请重试或检查模型服务连接。',INFERENCE_NON_TEXT_OUTPUT:'模型返回了不支持的工具或其他内容，请使用支持文字分析的模型。',INFERENCE_OUTPUT_LIMIT:'模型返回内容超过分析上限，任务已停止。',KEYWORDS_INVALID:'生成关键词失败：返回的检索词格式不符合要求。',DUPLICATE_KEYWORD_GROUP:'生成关键词失败：模型返回了重复的词组。',KEYWORDS_RESPONSE_INVALID:'生成关键词失败：模型返回的 JSON 缺少字段或字段类型错误。',SELECTION_RESPONSE_INVALID:'筛选视频失败：模型返回的 JSON 缺少字段或字段类型错误。',WORK_SELECTION_INVALID:'筛选视频失败：模型返回了无效或重复的结果序号。',EVIDENCE_NOT_IN_SOURCE:'模型引用了原文中不存在的证据，任务已停止。',KEYWORDS_FAILED:'失败步骤：业务关键词生成。请检查分析模型的响应。',SEARCH_FAILED:'失败步骤：抖音搜索。请检查专用浏览器是否完成加载或出现验证提示。',SELECTION_FAILED:'失败步骤：搜索结果的业务筛选。请检查分析模型的响应。',ACQUISITION_TIMEOUT:'自动查找超时，已停止；请检查模型响应速度及浏览器加载情况。',
})
type Tab = typeof tabs[number]
const reviewNames: Record<string, string> = { pending: '待审核', eligible: '高意向入选', approved: '已通过', excluded: '已排除', contacted: '已联系', 'opted-out': '拒绝联系' }
const classificationNames: Record<string, string> = { target: '目标用户', uncertain: '待确认', excluded: '非目标' }
const phaseNames: Record<string, string> = { idle: '暂无任务', draft: '待确认', running: '已启动', paused: '已暂停', completed: '已完成', blocked: '需人工检查' }
const scanErrorNames: Record<string, string> = { SCAN_SOURCE_MISMATCH: '返回内容与关注项不符，已停止', SCAN_PAGE_UNAVAILABLE: '作品页面已跳转，请检查浏览器', SCAN_DATA_UNAVAILABLE: '未读到作品或评论数据，请检查页面加载、登录或验证提示', SCAN_ACCOUNT_CHANGED: '抖音登录账号已变化，请重新检查账号', SCAN_SCHEMA_CHANGED: '作品或评论数据结构无法识别，已停止', SCAN_FAILED: '采集或分析失败，请检查浏览器和模型连接' }
const purposeNames: Record<string, string> = { direct: '直接办理', process: '费用与流程', obstacle: '办理障碍', 'travel-context': '出行场景' }
const lines = (value: string) => value.split('\n').map(s => s.trim()).filter(Boolean)
const defaultMessage='您好，看到您在咨询越南签证办理。如果仍需要协助，欢迎回复，我可以介绍办理流程。'
const localTime = (time: number) => time ? new Date(time).toLocaleString('zh-CN') : '—'

export const workspaceCss = `
.dy-workspace{--dy-bg:var(--bg-primary,var(--dsw-alias-bg-base));--dy-card:var(--bg-secondary,var(--dsw-alias-bg-layer-1));--dy-text:var(--text-primary,var(--dsw-alias-label-primary));--dy-muted:var(--text-secondary,var(--dsw-alias-label-secondary));--dy-border:var(--border-default,var(--dsw-alias-border-l1));--dy-accent:var(--accent-primary,var(--dsw-alias-brand-primary));color:var(--dy-text);background:var(--dy-bg);font:14px/1.5 var(--font-family,system-ui);padding:24px;min-width:0;overflow:auto;height:100%;box-sizing:border-box}
.dy-workspace *{box-sizing:border-box}.dy-workspace h1,.dy-workspace h2,.dy-workspace p{margin:0}.dy-workspace h1{font-size:24px}.dy-workspace h2{font-size:18px}.dy-header,.dy-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.dy-muted{color:var(--dy-muted)}.dy-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:20px 0}.dy-kpi,.dy-card{padding:20px;border:1px solid var(--dy-border);border-radius:var(--radius-lg,8px);background:var(--dy-card)}.dy-kpi strong{display:block;font-size:24px;margin-top:4px}.dy-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0}.dy-workspace button,.dy-workspace input,.dy-workspace select,.dy-workspace textarea{font:inherit;color:inherit;border:1px solid var(--dy-border);border-radius:var(--radius-md,6px);background:transparent;padding:8px 12px}.dy-workspace button{cursor:pointer;min-height:36px}.dy-workspace button[aria-selected=true],.dy-workspace .dy-primary{color:var(--dy-accent);background:color-mix(in srgb,var(--dy-accent) 12%,transparent);border-color:var(--dy-accent)}.dy-workspace button:disabled{opacity:.5;cursor:default}.dy-workspace :focus-visible{outline:2px solid var(--dy-accent);outline-offset:2px}.dy-workspace label{display:grid;gap:6px;font-weight:600}.dy-workspace label input,.dy-workspace label select,.dy-workspace label textarea{font-weight:400;width:100%;min-width:0}.dy-workspace textarea{min-height:96px;resize:vertical}.dy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.dy-stack{display:grid;gap:16px}.dy-full{grid-column:1/-1}.dy-table-wrap{overflow-x:auto;margin-top:16px}.dy-workspace table{width:100%;border-collapse:collapse;text-align:left}.dy-workspace th,.dy-workspace td{padding:12px 8px;border-bottom:1px solid var(--dy-border);vertical-align:top;overflow-wrap:anywhere}.dy-workspace th{font-weight:600;color:var(--dy-muted)}.dy-workspace td button{margin:0 6px 6px 0}.dy-workspace a{color:var(--dy-accent)}.dy-workspace blockquote{margin:8px 0;padding-left:12px;border-left:3px solid var(--dy-accent);white-space:pre-wrap}.dy-empty{text-align:center;padding:36px 16px;color:var(--dy-muted)}.dy-error{padding:12px;border:1px solid var(--error,var(--dy-border));border-radius:6px;margin:12px 0}.dy-keyword{display:inline-block;padding:4px 8px;margin:4px;border:1px solid var(--dy-border);border-radius:6px}.dy-state{padding:3px 8px;border-radius:6px;background:color-mix(in srgb,currentColor 8%,transparent);font-size:12px}.dy-native-window{position:fixed;inset:0;z-index:1500;background:var(--bg-primary,var(--dsw-alias-bg-base));overflow:auto}.dy-dialog{position:fixed;inset:24px;z-index:1300;pointer-events:auto;border:1px solid var(--dy-border);border-radius:12px;box-shadow:var(--shadow-lg);background:var(--dy-bg)}.dy-workspace select option{background:var(--dy-card);color:var(--dy-text)}
.dy-workspace{background:radial-gradient(ellipse at 92% 0%,color-mix(in srgb,var(--dy-accent) 9%,transparent),transparent 48%),var(--dy-bg);padding:32px}
.dy-header{padding-bottom:24px;border-bottom:1px solid var(--dy-border)}.dy-header h1{font-size:30px;letter-spacing:-.025em;font-weight:700}.dy-header p{margin-top:6px}.dy-header .dy-state{border:1px solid var(--dy-border);padding:6px 12px;color:var(--fs-cyan,var(--dy-accent));background:color-mix(in srgb,var(--dy-accent) 6%,transparent)}
.dy-kpis{gap:16px;margin:24px 0}.dy-kpi{position:relative;overflow:hidden;padding:20px 24px;background:linear-gradient(125deg,color-mix(in srgb,var(--dy-accent) 7%,var(--dy-card)),var(--dy-card));box-shadow:0 8px 24px var(--fs-shadow,transparent)}.dy-kpi::before{content:'';position:absolute;top:20px;bottom:20px;left:0;width:3px;background:var(--fs-cyan,var(--dy-accent));border-radius:4px}.dy-kpi strong{font-size:32px;font-weight:650;letter-spacing:-.03em;font-variant-numeric:tabular-nums}.dy-kpi:nth-child(even)::before{background:var(--dy-accent)}
.dy-tabs{gap:4px;padding:6px;border:1px solid var(--dy-border);border-radius:12px;background:var(--dy-card);width:fit-content;max-width:100%}.dy-workspace .dy-tabs button{border-color:transparent;color:var(--dy-muted);padding:9px 16px}.dy-workspace .dy-tabs button[aria-selected=true]{color:var(--dy-text);border-color:color-mix(in srgb,var(--dy-accent) 40%,transparent);background:color-mix(in srgb,var(--dy-accent) 16%,var(--dy-card));box-shadow:0 2px 8px var(--fs-shadow,transparent)}
.dy-card{padding:24px;box-shadow:0 8px 28px var(--fs-shadow,transparent)}.dy-card h2{font-size:18px;margin-bottom:4px}.dy-workspace :is(input,textarea,select){background:var(--bg-tertiary,var(--dy-card))}.dy-workspace button{transition:background .16s,border-color .16s,box-shadow .16s}.dy-workspace button:not(:disabled):hover{background:color-mix(in srgb,var(--dy-accent) 12%,var(--dy-card));border-color:color-mix(in srgb,var(--dy-accent) 55%,var(--dy-border))}.dy-workspace .dy-primary{background:linear-gradient(110deg,var(--fs-button-start,var(--dy-accent)),var(--fs-button-end,var(--dy-accent)));color:var(--fs-on-accent,var(--dy-text));border-color:transparent}.dy-workspace .dy-primary:not(:disabled):hover{background:linear-gradient(110deg,var(--fs-button-end,var(--dy-accent)),var(--fs-button-start,var(--dy-accent)))}
.dy-workspace th{background:color-mix(in srgb,var(--dy-accent) 5%,var(--dy-card));font-size:12px;letter-spacing:.02em}.dy-workspace tbody tr:hover{background:color-mix(in srgb,var(--dy-accent) 4%,var(--dy-card))}.dy-workspace td{padding-top:16px;padding-bottom:16px}.dy-error{background:color-mix(in srgb,var(--error,var(--dy-accent)) 8%,var(--dy-card));color:var(--error,var(--dy-text))}
@media(prefers-reduced-motion:reduce){.dy-workspace button{transition:none}}
.dy-workspace{background:var(--dy-bg)}.dy-kpi,.dy-card{background:var(--bg-elevated,var(--dy-card));box-shadow:none}.dy-kpi::before{display:none}.dy-kpi strong{font-size:30px}.dy-header .dy-state{background:transparent;color:var(--dy-muted);border-color:var(--dy-border)}.dy-tabs{background:transparent;border:0;border-bottom:1px solid var(--dy-border);border-radius:0;padding:0 0 12px;width:100%;gap:6px}.dy-workspace .dy-tabs button{border-radius:8px;padding:8px 14px}.dy-workspace .dy-tabs button[aria-selected=true]{background:var(--bg-active,var(--dy-card));border-color:transparent;box-shadow:none;color:var(--dy-text)}.dy-workspace .dy-primary{background:var(--fs-button-start,var(--dy-accent));box-shadow:none}.dy-workspace .dy-primary:not(:disabled):hover{background:var(--fs-button-end,var(--dy-accent))}.dy-workspace th{background:var(--bg-tertiary,var(--dy-card))}
.dy-dialog{inset:auto;top:32px;left:max(16px,calc((100vw - 1100px)/2));width:min(1100px,calc(100vw - 32px));height:calc(100vh - 64px)}.dy-dialog>.dy-header{cursor:move;touch-action:none;user-select:none}.dy-dialog>.dy-header button{cursor:pointer}.dy-workspace label input[type=checkbox]{width:auto;margin-right:8px}.dy-workspace fieldset{margin:0;padding:20px;border:1px solid var(--dy-border);border-radius:8px}
@media(max-width:760px){.dy-grid{grid-template-columns:1fr}.dy-kpis{grid-template-columns:repeat(2,1fr);gap:10px}.dy-workspace{padding:16px}.dy-dialog{inset:auto;top:8px;left:8px;width:calc(100vw - 16px);height:calc(100vh - 16px)}.dy-header h1{font-size:26px}.dy-card{padding:18px}.dy-tabs{width:100%}.dy-workspace .dy-tabs button{padding:8px 10px}.dy-kpi{padding:16px}.dy-kpi strong{font-size:28px}}
`

export function DouyinWorkspace({ onClose, transport = api, standalone = false }: { onClose?: () => void; transport?: WorkspaceApi; standalone?: boolean }) {
  const movable = !!onClose && !standalone
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null)
  const drag = useRef<{ pointer: number; x: number; y: number; left: number; top: number } | null>(null)
  const [data, setData] = useState<DouyinSnapshot | null>(null)
  const [notice, setNotice] = useState(''), [busyLabel, setBusyLabel] = useState('正在处理…')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false), [tab, setTab] = useState<Tab>('目标画像')
  const [profile, setProfile] = useState({ name: '', objective: '', include: '', exclude: '', seeds: '', reviewMode: 'manual', positive: '', uncertain: '', negative: '' })
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; kind: 'account' | 'work'; name: string } | null>(null)
  const [watch, setWatch] = useState({ name: '', url: '', interval: 10 })
  const [selected, setSelected] = useState<string[]>([])
  const [librarySelected, setLibrarySelected] = useState<string[]>([]), [librarySearch, setLibrarySearch] = useState('')
  const libraryToken = useRef('')
  const [message, setMessage] = useState(defaultMessage)
  const [scheduled, setScheduled] = useState(''), [interval, setIntervalSeconds] = useState(60)
  const [automatic,setAutomatic]=useState({send:false,maxMessagesPerDay:10,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30})
  const [confirmAutomatic,setConfirmAutomatic]=useState(false)
  const generation = useRef(0), currentOwner = useRef(''), pending = useRef(false)
  const container = useRef<HTMLDivElement>(null)
  const moveWindow = (left: number, top: number) => {
    const rect = container.current?.getBoundingClientRect()
    if (!rect) return
    setPosition({ left: Math.max(8, Math.min(left, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(top, window.innerHeight - rect.height - 8)) })
  }
  useEffect(() => {
    if (!movable) return
    const resize = () => {
      const rect = container.current?.getBoundingClientRect()
      if (rect) moveWindow(rect.left, rect.top)
    }
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [movable])
  const syncTimer = useRef<number | undefined>(undefined)
  const accept = (value: DouyinSnapshot) => {
    const nextToken = `${value.owner}:${value.library?.snapshotId ?? ''}`
    if (libraryToken.current !== nextToken) { setLibrarySelected([]); setLibrarySearch(''); libraryToken.current = nextToken }
    if (currentOwner.current && currentOwner.current !== value.owner) {
      setSelected([]); setDeleteTarget(null); setScheduled(''); setTab('目标画像'); setWatch({ name: '', url: '', interval: 10 })
      setMessage(defaultMessage);setAutomatic({send:false,maxMessagesPerDay:10,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30});setConfirmAutomatic(false)
    }
    currentOwner.current = value.owner; setData(value)
    setSelected(previous => previous.filter(id => {
      const c = value.candidates[id]
      return c && ['approved','eligible'].includes(c.review) && c.profileVersion === value.profile.version
    }))
  }
  useEffect(() => {
    let active = true
    const refresh = async () => {
      if (pending.current) return
      const token = ++generation.current
      try { const value = await transport.get(); if (active && token === generation.current) { accept(value); setError('') } }
      catch { if (active && token === generation.current) { setData(null); setSelected([]); setMessage(defaultMessage);setAutomatic({send:false,maxMessagesPerDay:10,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30});setConfirmAutomatic(false);setError('请先登录 FutureStaff，或重新连接本地工作区。') } }
    }
    void refresh(); const timer = window.setInterval(() => { void refresh() }, 10000)
    container.current?.focus()
    return () => { active = false; generation.current++; window.clearInterval(timer); window.clearInterval(syncTimer.current) }
  }, [transport])
  useEffect(() => {
    if (!data) return
    const p = data.profile
    setProfile({ name: p.name, objective: p.objective, include: p.include.join('\n'), exclude: p.exclude.join('\n'), seeds: p.seedKeywords.join('\n'), reviewMode: p.reviewMode,
      positive: p.examples.filter(e => e.classification === 'target').map(e => e.comment).join('\n'),
      uncertain: p.examples.filter(e => e.classification === 'uncertain').map(e => e.comment).join('\n'),
      negative: p.examples.filter(e => e.classification === 'excluded').map(e => e.comment).join('\n') })
  }, [data?.owner, data?.profile.version])
  useEffect(()=>{setConfirmAutomatic(false)},[data?.owner,data?.profile.version,data?.modelId,tab])
  useEffect(()=>{
    if(data?.acquisition?.phase==='running'&&data.acquisition.policy){
      const {message:approvedMessage,...settings}=data.acquisition.policy
      setMessage(approvedMessage);setAutomatic(settings);setConfirmAutomatic(false)
    }
  },[data?.owner,data?.acquisition?.phase,data?.acquisition?.expiresAt])
  const run = async (action: Action) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError(''); setNotice('');
    setBusyLabel(action.action === 'account-check' ? '正在检查抖音登录状态，请稍候…' : '正在处理…'); const token = ++generation.current
    let polling = false
    const timer = action.action === 'following-sync' ? window.setInterval(() => {
      if (polling) return
      polling = true
      void transport.get().then(value => {
        if (token === generation.current && value.owner === currentOwner.current && value.followingSync?.running)
          setBusyLabel(`正在同步我的关注，已读取 ${value.followingSync.count} 个账号…`)
      }).catch(() => {}).finally(() => { polling = false })
    }, 1000) : undefined
    syncTimer.current = timer
    if (action.action === 'following-sync') setBusyLabel('正在打开我的关注并加载列表…')
    try { const value = await transport.act(action); if (token === generation.current) {
      accept(value)
      if(action.action==='acquisition-start')setConfirmAutomatic(false)
      if(action.action==='sender-check')setNotice(value.browserReady?'私信收件人和输入框已校验，本次没有发送消息。':'私信连接尚未通过校验。')
      if (action.action === 'following-sync' && value.followingSync) setNotice(`同步完成：读取 ${value.followingSync.count} 个关注账号，新增 ${value.followingSync.added} 个，已有 ${value.followingSync.count - value.followingSync.added} 个。`)
      if (action.action === 'account-check') setNotice(value.account.phase === 'connected' ? '登录检查完成，已确认抖音账号。'
        : value.account.phase === 'awaiting-login' ? '检查完成，尚未确认登录。请确认浏览器已完成登录及验证，再点击检查登录状态。' : '检查完成，浏览器连接已断开，请重新打开登录浏览器。')
    } }
    catch (e) { if (token === generation.current) { setError(e instanceof Error ? e.message : '操作未完成');
      try { accept(await transport.get()) } catch { setData(null); setSelected([]); currentOwner.current = '' }
    } }
    finally { window.clearInterval(timer); pending.current = false; setBusy(false) }
  }
  const button = (label: string, action: Action, disabled = false) => <button type="button" className={['following-sync','acquisition-start'].includes(String(action.action)) ? 'dy-primary' : undefined} disabled={busy || disabled} onClick={() => { void run(action) }}>{label}</button>
  const watches = data?.watches.filter(w => w.kind === (tab === '关注账号' ? 'account' : 'work')) ?? []
  const libraryKind = tab === '关注账号' ? 'following' : 'favorites'
  const library = data?.library?.kind === libraryKind ? data.library : null
  const libraryItems = library?.items.filter(item => `${item.name} ${item.id}`.toLowerCase().includes(librarySearch.trim().toLowerCase())) ?? []
  const candidates = Object.values(data?.candidates ?? {})
  const approved = candidates.filter(c => ['approved','eligible'].includes(c.review) && c.profileVersion === data?.profile.version)
  const keys = Object.entries(data?.comments ?? {})
  const guardKeyboard = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') onClose?.()
    if (event.key !== 'Tab' || !onClose) return
    const focusable = container.current?.querySelectorAll<HTMLElement>('header[tabindex="0"],button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')
    const first = focusable?.[0], last = focusable?.[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return <div ref={container} tabIndex={-1} style={movable && position ? position : undefined} className={`dy-workspace${standalone ? ' dy-native-window' : onClose ? ' dy-dialog' : ''}`} role={standalone ? 'region' : onClose ? 'dialog' : undefined} aria-modal={onClose && !standalone ? true : undefined} aria-label="抖音获客" onKeyDown={guardKeyboard}>
    <style>{workspaceCss}</style>
    <header className="dy-header" tabIndex={movable ? 0 : undefined} aria-label={movable ? '移动抖音获客窗口' : undefined}
      title={movable ? '拖动标题栏移动窗口，也可聚焦后使用方向键' : undefined}
      onPointerDown={event => {
        if (!movable || event.button !== 0 || (event.target as Element).closest('button,input,select,a')) return
        const rect = container.current!.getBoundingClientRect()
        drag.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }
        event.currentTarget.setPointerCapture?.(event.pointerId); event.preventDefault()
      }}
      onPointerMove={event => {
        const current = drag.current
        if (current && current.pointer === event.pointerId) moveWindow(current.left + event.clientX - current.x, current.top + event.clientY - current.y)
      }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }} onLostPointerCapture={() => { drag.current = null }}
      onKeyDown={event => {
        if (!movable || event.target !== event.currentTarget || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return
        const rect = container.current!.getBoundingClientRect(); event.preventDefault()
        moveWindow(rect.left + (event.key === 'ArrowLeft' ? -20 : event.key === 'ArrowRight' ? 20 : 0), rect.top + (event.key === 'ArrowUp' ? -20 : event.key === 'ArrowDown' ? 20 : 0))
      }}><div><h1>抖音获客</h1><p className="dy-muted">持续关注内容，依据评论需求筛选用户。</p></div><div className="dy-toolbar"><span className="dy-state">本地保存 · FutureStaff 授权模型</span>{onClose && <button onClick={onClose}>{standalone ? '关闭窗口' : '关闭'}</button>}</div></header>
    {error && <div className="dy-error" role="alert">{error}</div>}
    {busy && <p role="status">{busyLabel}</p>}
    {notice && <p role="status">{notice}</p>}
    {!data ? <div className="dy-empty">{error ? '登录后重新打开本页面。' : '正在读取本地工作区…'}</div> : <>
      <div className="dy-kpis">{[['关注账号',data.watches.filter(w => w.kind === 'account').length],['关注作品',data.watches.filter(w => w.kind === 'work').length],['已记录评论',keys.length],['目标用户',candidates.length]].map(([name,count]) => <div className="dy-kpi" key={name}><span className="dy-muted">{name}</span><strong>{count}</strong></div>)}</div>
      <nav className="dy-tabs" role="tablist" aria-label="获客功能">{tabs.map(name => <button key={name} role="tab" aria-selected={tab === name} onClick={() => { setDeleteTarget(null); setTab(name) }}>{name}</button>)}</nav>
      <section className="dy-card dy-stack" role="tabpanel" aria-label={tab}>
        {tab === '目标画像' && <>
          <div className="dy-toolbar"><h2>定义你要找的用户</h2><span className="dy-muted">规则版本 {data.profile.version}</span></div>
          <div className="dy-grid">
            <label>分析模型<select aria-label="分析模型" disabled={busy} value={data.modelId ?? ''} onChange={e => { void run({ action: 'model', modelId: e.target.value }) }}><option value="" disabled>请选择平台模型</option>{data.models.map(model => <option key={model.modelId} value={model.modelId}>{model.displayName}</option>)}</select></label>
            <label>画像名称<input value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} maxLength={100}/></label>
            <label className="dy-full">业务目标<textarea value={profile.objective} onChange={e => setProfile({ ...profile, objective: e.target.value })}/></label>
            <label>包含条件（每行一条）<textarea value={profile.include} onChange={e => setProfile({ ...profile, include: e.target.value })}/></label>
            <label>排除条件（每行一条）<textarea value={profile.exclude} onChange={e => setProfile({ ...profile, exclude: e.target.value })}/></label>
            <label>种子关键词（每行一个）<textarea value={profile.seeds} onChange={e => setProfile({ ...profile, seeds: e.target.value })}/></label>
            <label>目标用户审核<select value={profile.reviewMode} onChange={e => setProfile({ ...profile, reviewMode: e.target.value })}><option value="manual">人工审核后入选</option><option value="high-intent-only">有明确证据的高意向用户自动入选</option></select><span className="dy-muted">修改画像后，旧的审核结果需要重新确认。</span></label>
          </div>
          <details><summary>判断示例（可选，每行一条）</summary><div className="dy-grid" style={{ marginTop: 16 }}>
            <label>目标用户示例<textarea value={profile.positive} onChange={e => setProfile({ ...profile, positive: e.target.value })}/></label>
            <label>非目标用户示例<textarea value={profile.negative} onChange={e => setProfile({ ...profile, negative: e.target.value })}/></label>
            <label>待确认示例<textarea value={profile.uncertain} onChange={e => setProfile({ ...profile, uncertain: e.target.value })}/></label>
          </div></details>
          <div className="dy-toolbar">{button('保存画像', { action: 'profile', profile: { ...data.profile, name: profile.name, objective: profile.objective, include: lines(profile.include), exclude: lines(profile.exclude), seedKeywords: lines(profile.seeds), reviewMode: profile.reviewMode,
            examples: [...lines(profile.positive).map(comment => ({ comment, classification: 'target' })), ...lines(profile.uncertain).map(comment => ({ comment, classification: 'uncertain' })), ...lines(profile.negative).map(comment => ({ comment, classification: 'excluded' }))] } })}{button('AI 拆解检索关键词', { action: 'keywords' }, !data.modelId)}</div>
          {!data.models.length && <p className="dy-muted">当前主体没有可用模型，请在 FutureStaff 检查模型授权。</p>}
          {data.keywords.map(group => <div key={group.purpose}><h3>{purposeNames[group.purpose] ?? group.purpose}</h3>{group.keywords.map(word => <span className="dy-keyword" key={word}>{word}</span>)}</div>)}
          <p className="dy-muted">关键词用于发现相关内容；是否为目标用户，要依据评论中的需求证据判断。</p>
        </>}
        {(tab === '关注账号' || tab === '关注作品') && <>
          <div className="dy-toolbar">{button('启动采集与分析', { action: 'monitor-start' }, !data.monitoring?.ready || data.account?.phase !== 'connected' || !data.modelId || !data.watches.some(w => w.enabled) || data.monitoring?.phase === 'running')}{button('暂停采集', { action: 'monitor-pause' }, data.monitoring?.phase !== 'running')}<span className="dy-state">{({ idle: '未启动', running: '运行中', paused: '已暂停', blocked: '执行失败，请查看日志' })[data.monitoring?.phase ?? 'idle']}</span></div>
          {!data.monitoring?.ready && <p className="dy-muted">请先到“抖音账号”打开专用浏览器、登录，并点击检查登录状态。</p>}
          {data.monitoring?.errorCode && <p role="alert">{scanErrorNames[data.monitoring.errorCode]}</p>}
          <p className="dy-muted">每次检查读取主页当前返回的最多 5 个作品，以及作品页面加载的最多 100 条评论；不会自动发送私信。</p>
          <h2>{tab}</h2><p className="dy-muted">{tab === '关注账号' ? '添加账号主页，便于跟踪该账号发布的内容。' : '添加视频或图文链接，保存需要关注的评论来源。'} 添加后点击“启动采集与分析”开始检查。</p>
          {button('根据业务查找账号和视频',{action:'discover'},!data.discoveryReady||data.account?.phase!=='connected'||!data.modelId)}
          {!!data.discoveries?.length&&<details><summary>业务匹配结果（{data.discoveries.length}）</summary><p className="dy-muted">相关作品已加入关注；作者账号仅作为内容来源，不代表有购买需求。</p>{data.discoveries.map(work=><div key={work.id} className="dy-card"><a href={work.url} target="_blank" rel="noreferrer">{work.name||'查看作品'}</a><p>{work.reason}</p>{work.quotes.map((quote,index)=><blockquote key={index}>{quote}</blockquote>)}<a href={work.accountUrl} target="_blank" rel="noreferrer">查看来源账号</a></div>)}</details>}
          <div className="dy-card dy-stack">
            <h3>{tab === '关注账号' ? '同步我的关注' : '从我的收藏选择作品'}</h3>
            {tab === '关注账号' ? <>
              <p className="dy-muted">一键打开自己的关注列表，自动滚动读取全部账号并去重保存。同步账号名称和主页链接，默认检查间隔 10 分钟；已有记录保持原设置。</p>
              <div className="dy-toolbar">{button('一键同步我的关注', { action: 'following-sync' }, data.account.phase !== 'connected')}</div>
              <details><summary>手动选择导入</summary><p className="dy-muted">在专用浏览器加载列表后，读取当前内容并勾选导入。</p>
                <div className="dy-toolbar">{button('打开关注列表', { action: 'library-open', kind: libraryKind }, data.account.phase !== 'connected')}{button('读取当前列表', { action: 'library-read', kind: libraryKind }, data.account.phase !== 'connected')}</div>
              </details>
            </> : <>
              <p className="dy-muted">打开收藏列表，再读取当前已加载的内容并勾选导入。</p>
              <div className="dy-toolbar">{button('打开我的收藏', { action: 'library-open', kind: libraryKind }, data.account.phase !== 'connected')}{button('读取当前列表', { action: 'library-read', kind: libraryKind }, data.account.phase !== 'connected')}</div>
            </>}
            {data.account.phase !== 'connected' && <p className="dy-muted">请先到“抖音账号”登录并检查状态。</p>}
            {library && <>
              <p>已读取 {library.items.length} 条 · 列表有效至 {localTime(library.expiresAt)}</p>
              <label>搜索列表<input value={librarySearch} onChange={e => setLibrarySearch(e.target.value)} placeholder="名称或 ID"/></label>
              <div className="dy-toolbar"><button disabled={busy || !libraryItems.length} onClick={() => setLibrarySelected([...new Set([...librarySelected, ...libraryItems.filter(item => !watches.some(w => w.id === item.id)).map(item => item.id)])])}>全选搜索结果</button><button disabled={busy || !librarySelected.length} onClick={() => setLibrarySelected([])}>清空选择</button><span>已选择 {librarySelected.length} 条</span></div>
              {!libraryItems.length ? <p className="dy-muted">{library.items.length ? '没有匹配内容。' : '当前列表没有已加载的内容。可在浏览器加载后重新读取。'}</p> : <div className="dy-table-wrap"><table><thead><tr><th>选择</th><th>名称与来源</th><th>状态</th></tr></thead><tbody>{libraryItems.map(item => {
                const imported = watches.some(w => w.id === item.id)
                return <tr key={item.id}><td><input type="checkbox" aria-label={`选择 ${item.name || item.id}`} disabled={busy || imported} checked={librarySelected.includes(item.id)} onChange={e => setLibrarySelected(e.target.checked ? [...librarySelected, item.id] : librarySelected.filter(id => id !== item.id))}/></td><td><a href={item.url} target="_blank" rel="noopener noreferrer">{item.name || item.id}</a></td><td>{imported ? '已在监控列表' : '可导入'}</td></tr>
              })}</tbody></table></div>}
              <label>导入检查间隔（分钟）<input type="number" min={1} max={1440} value={watch.interval} onChange={e => setWatch({ ...watch, interval: Number(e.target.value) })}/></label>
              {button('导入所选到监控列表', { action: 'library-import', snapshotId: library.snapshotId, ids: librarySelected, intervalSeconds: watch.interval * 60 }, !librarySelected.length || !Number.isInteger(watch.interval) || watch.interval < 1 || watch.interval > 1440)}
            </>}
          </div>
          <form className="dy-grid" onSubmit={e => { e.preventDefault(); void run({ action: 'watch', kind: tab === '关注账号' ? 'account' : 'work', name: watch.name, url: watch.url, intervalSeconds: watch.interval * 60 }) }}>
            <label>备注名称<input value={watch.name} onChange={e => setWatch({ ...watch, name: e.target.value })} maxLength={200}/></label>
            <label>检查间隔（分钟）<input type="number" min={1} max={1440} value={watch.interval} onChange={e => setWatch({ ...watch, interval: Number(e.target.value) })}/></label>
            <label className="dy-full">{tab === '关注账号' ? '账号主页链接' : '视频或图文链接'}<input type="url" required placeholder={tab === '关注账号' ? 'https://www.douyin.com/user/…' : 'https://www.douyin.com/video/…'} value={watch.url} onChange={e => setWatch({ ...watch, url: e.target.value })}/></label>
            <div><button className="dy-primary" disabled={busy}>添加关注</button></div>
          </form>
          {deleteTarget && <div className="dy-card dy-stack" role="alertdialog" aria-label="删除关注项"><h3>删除“{deleteTarget.name}”？</h3><p>从监控列表移除并暂停采集，已采集评论和拒绝联系记录保留。</p><div className="dy-toolbar"><button type="button" disabled={busy} onClick={() => setDeleteTarget(null)}>取消</button><button type="button" disabled={busy} onClick={() => { const target = deleteTarget; setDeleteTarget(null); void run({ action: 'watch-delete', id: target.id, kind: target.kind, confirmation: '确认删除' }) }}>确认删除</button></div></div>}
          {!watches.length ? <div className="dy-empty">还没有关注内容，添加第一条链接。</div> : <div className="dy-table-wrap"><table><thead><tr><th>名称与来源</th><th>间隔</th><th>状态</th><th>操作</th></tr></thead><tbody>{watches.map(w => <tr key={w.id}><td><strong>{w.name || w.id}</strong><br/><a href={w.url} target="_blank" rel="noopener noreferrer">打开抖音来源</a></td><td>{w.intervalSeconds / 60} 分钟</td><td>{w.enabled ? '等待采集连接' : '已暂停'}</td><td>{button(w.enabled ? '暂停关注' : '恢复关注', { action: 'toggle', kind: w.kind, id: w.id, enabled: !w.enabled })}<button type="button" disabled={busy} onClick={() => setDeleteTarget({ id: w.id, kind: w.kind, name: w.name || w.id })}>删除</button></td></tr>)}</tbody></table></div>}
        </>}
        {tab === '评论分析' && <><h2>评论与判断证据</h2><p className="dy-muted">只分析已采集的公开评论；信息不足的评论保留为待确认。</p>{!keys.length ? <div className="dy-empty">暂无评论。持续采集接入后，评论会显示在这里。</div> : <div className="dy-table-wrap"><table><thead><tr><th>评论与作品</th><th>AI 判断</th><th>操作</th></tr></thead><tbody>{keys.map(([key,comment]) => { const decision = data.decisions[key]; return <tr key={key}><td><strong>{comment.title}</strong><p>{comment.text}</p><small className="dy-muted">{new Date(comment.collectedAt).toLocaleString('zh-CN')}</small></td><td>{decision ? <><span className="dy-state">{classificationNames[decision.classification]}</span><p>{decision.reason}</p>{decision.quotes.map((q,i) => <blockquote key={i}>{q.quote}</blockquote>)}{decision.profileVersion !== data.profile.version && <p>画像已变更，需要重新分析</p>}</> : '未分析'}</td><td>{button(decision ? '重新分析' : '分析评论', { action: 'analyze', key }, !data.modelId)}</td></tr> })}</tbody></table></div>}</>}
        {tab === '目标用户' && <><div className="dy-toolbar"><h2>目标用户</h2><button disabled={!approved.length} onClick={() => { setSelected(approved.map(c => c.recipient)); setTab('私信任务') }}>为入选用户创建私信</button></div><p className="dy-muted">同一用户的评论合并保存。拒绝联系后，不再进入发送名单。</p>{!candidates.length ? <div className="dy-empty">暂无目标用户。评论分析后会在这里显示需求和证据。</div> : <div className="dy-table-wrap"><table><thead><tr><th>用户 ID</th><th>需求与证据</th><th>状态</th><th>审核</th></tr></thead><tbody>{candidates.map(c => <tr key={c.recipient}><td>{c.recipient}</td><td>{c.commentKeys.map(key => { const d = data.decisions[key]; return d && <div key={key}><p>{d.need || d.reason}</p>{d.quotes.map((q,i) => <blockquote key={i}>{q.quote}</blockquote>)}</div> })}</td><td><span className="dy-state">{reviewNames[c.review]}</span></td><td>{button('通过', { action: 'review', recipient: c.recipient, decision: 'approve' }, ['opted-out','contacted'].includes(c.review))}{button('排除', { action: 'review', recipient: c.recipient, decision: 'exclude' })}{button('拒绝联系', { action: 'review', recipient: c.recipient, decision: 'opt-out' })}</td></tr>)}</tbody></table></div>}</>}
        {tab === '抖音账号' && <div className="dy-stack"><h2>登录抖音账号</h2><p>点击下方按钮打开专用浏览器（优先使用 Google Chrome，未安装时使用 Edge），在抖音网站扫码或使用手机号登录，然后返回检查登录状态。</p><p className="dy-muted">浏览器登录状态只保存在本机，按当前平台账号和主体隔离；不会读取日常浏览器的账号或上传 Cookie。</p><p role="status">{data.account?.phase === 'connected' ? `已登录：${data.account.accountId}` : data.account?.phase === 'awaiting-login' ? '浏览器已打开，等待登录或检查账号' : '尚未连接抖音账号'}</p><div className="dy-toolbar">{button('打开抖音登录浏览器', { action: 'account-open' })}{button('检查登录状态', { action: 'account-check' }, !data.account || data.account.phase === 'disconnected')}{button('断开账号', { action: 'account-disconnect' }, !data.account || data.account.phase === 'disconnected')}</div><p className="dy-muted">断开会关闭专用浏览器并暂停任务，保留本机登录状态。要退出抖音登录，请在专用浏览器内使用抖音的退出入口。登录成功后仍需完成真实页面发送校准，当前不会发送私信。</p></div>}
        {tab==='自动获客'&&<div className="dy-stack">
          <div className="dy-toolbar"><h2>根据业务自动寻找客户</h2><span className="dy-state">{phaseNames[data.acquisition?.phase??'idle']}</span></div>
          <p>根据当前画像搜索账号和视频，筛选相关作品，再定期分析新留言。视频相关不等于留言者有需求。</p>
          <fieldset disabled={busy||data.acquisition?.phase==='running'} className="dy-grid">
            <label>重新查找间隔（分钟）<input type="number" min={10} max={1440} value={automatic.discoveryIntervalMinutes} onChange={e=>{setConfirmAutomatic(false);setAutomatic({...automatic,discoveryIntervalMinutes:Number(e.target.value)})}}/></label>
            <label>本次运行时长（分钟）<input type="number" min={5} max={1440} value={automatic.durationMinutes} onChange={e=>{setConfirmAutomatic(false);setAutomatic({...automatic,durationMinutes:Number(e.target.value)})}}/></label>
            <label>发送间隔（秒）<input type="number" min={30} max={600} value={automatic.intervalSeconds} onChange={e=>{setConfirmAutomatic(false);setAutomatic({...automatic,intervalSeconds:Number(e.target.value)})}}/></label>
            <label>每日最多私信人数<input type="number" min={1} max={50} value={automatic.maxMessagesPerDay} onChange={e=>{setConfirmAutomatic(false);setAutomatic({...automatic,maxMessagesPerDay:Number(e.target.value)})}}/></label>
            <label className="dy-full">私信文案<textarea value={message} onChange={e=>{setConfirmAutomatic(false);setMessage(e.target.value)}}/></label>
            <label className="dy-full"><span><input type="checkbox" checked={automatic.send} disabled={!data.browserReady} onChange={e=>{setConfirmAutomatic(false);setAutomatic({...automatic,send:e.target.checked})}}/> 对符合需求的留言自动私信</span></label>
          </fieldset>
          <p className="dy-muted">今日已使用 {data.outreachBudget??0} 次发送额度（北京时间）。已联系或拒绝联系的用户不会重复发送，发送结果不明时会停止。</p>
          <p className="dy-muted">{data.profile.reviewMode==='high-intent-only'?'自动私信只处理有留言原文证据的高意向用户。':'当前画像采用人工审核：先通过符合需求的留言。要自动入选，请在目标画像中选择高意向自动入选。'}</p>
          {button('检查私信连接',{action:'sender-check'},!approved.length||data.account?.phase!=='connected')}
          {!data.browserReady&&<p className="dy-muted">可以先仅运行搜索和留言分析。出现符合需求的目标用户后检查私信连接，校验通过才能启用自动私信；检查不会发送消息。</p>}
          {confirmAutomatic&&<div role="alertdialog" aria-label="确认自动获客" className="dy-card dy-stack"><p>将按“{data.profile.name}”运行 {automatic.durationMinutes} 分钟，每 {automatic.discoveryIntervalMinutes} 分钟重新查找。{automatic.send?`允许自动私信符合条件的用户，每日至多 ${automatic.maxMessagesPerDay} 人，间隔至少 ${automatic.intervalSeconds} 秒。`:'本次只查找、监控和分析留言。'}</p>{automatic.send&&<blockquote>{message}</blockquote>}<div className="dy-toolbar"><button onClick={()=>setConfirmAutomatic(false)}>取消</button>{button('确认启动自动获客',{action:'acquisition-start',policy:{...automatic,message},confirmation:'确认启动自动获客'})}</div></div>}
          <div className="dy-toolbar"><button disabled={busy||!data.discoveryReady||!data.modelId||data.account?.phase!=='connected'||data.acquisition?.phase==='running'} onClick={()=>setConfirmAutomatic(true)}>启动自动获客</button>{button('暂停自动获客',{action:'acquisition-pause'},data.acquisition?.phase!=='running')}</div>
          {data.acquisition?.errorCode&&<p role="alert">{scanErrorNames[data.acquisition.errorCode]??acquisitionErrorNames[data.acquisition.errorCode]??'自动任务未完成，请检查运行日志和浏览器页面。'}</p>}
        </div>}
        {tab === '私信任务' && <>
          <div className="dy-toolbar"><h2>预约私信</h2><span className="dy-state">{phaseNames[data.sending.phase]}</span></div>
          <p className="dy-muted">先核对名单和文案，再确认启动。单次预约最多 50 人；浏览器未连接时可以保存预览。</p>
          <fieldset disabled={busy}><legend>选择入选用户（{selected.length} 人）</legend>{!approved.length ? <p className="dy-muted">请先在目标用户列表完成审核。</p> : approved.map(c => <label key={c.recipient} style={{ display: 'inline-flex', marginRight: 16 }}><input type="checkbox" checked={selected.includes(c.recipient)} onChange={e => setSelected(e.target.checked ? [...selected,c.recipient] : selected.filter(id => id !== c.recipient))}/>{c.recipient}</label>)}</fieldset>
          <div className="dy-grid"><label className="dy-full">私信内容<textarea maxLength={500} value={message} onChange={e => setMessage(e.target.value)}/><span className="dy-muted">{message.length}/500</span></label><label>预约时间<input type="datetime-local" required value={scheduled} onChange={e => setScheduled(e.target.value)}/></label><label>每条发送间隔（秒）<input type="number" min={30} max={3600} value={interval} onChange={e => setIntervalSeconds(Number(e.target.value))}/></label></div>
          <div><button className="dy-primary" disabled={busy || !selected.length || !scheduled || !message.trim()} onClick={() => { const time = new Date(scheduled); if (!Number.isFinite(time.getTime())) { setError('请选择有效的预约时间。'); return } void run({ action: 'preview', input: { recipients: selected, message, scheduledAt: time.toISOString(), intervalSeconds: interval, durationSeconds: 3600, maxMessages: Math.min(selected.length,50) } }) }}>生成发送预览</button></div>
          {data.preview && <div className="dy-card dy-stack"><h3>待确认的发送预览</h3><p>{data.preview.plan.recipients.length} 人 · {new Date(data.preview.plan.scheduledAt).toLocaleString('zh-CN')} · 间隔 {data.preview.plan.intervalSeconds} 秒</p><p className="dy-muted">执行窗口 {data.preview.plan.durationSeconds / 60} 分钟，最多发送 {data.preview.plan.maxMessages} 条。</p><blockquote>{data.preview.plan.message}</blockquote><details><summary>核对完整收件名单</summary>{data.preview.plan.recipients.join('、')}</details></div>}
          <div className="dy-toolbar">{button('确认启动预约', { action: 'start', previewId: data.preview?.previewId ?? '', confirmation: '确认启动' }, !data.preview || !data.browserReady || !data.sending.live || data.sending.phase !== 'draft')}<p>已发送 {data.sending.sent} 条 · 下次执行 {localTime(data.sending.nextAt)}</p>{button('暂停发送', { action: 'pause' })}</div>
          {!data.sending.live && <p className="dy-muted">当前真实发送未启用。需先连接并验证抖音浏览器账号；预览不会发送消息。</p>}
          <p className="dy-muted">退出登录、切换主体或修改筛选规则后，需要重新确认任务。软件关闭后，预约不会自动恢复发送。</p>
        </>}
        {tab === '运行日志' && <><h2>运行日志</h2><p className="dy-muted">记录实际执行的操作和发送事件，仅展示当前账号与主体的数据。</p><div className="dy-table-wrap"><table><thead><tr><th>时间</th><th>任务</th><th>状态</th></tr></thead><tbody>{[
          ...(data.runtimeLogs ?? []).map(item => ({ at: item.at, task: ({ acquisition: '自动获客', discover: '业务搜索', 'sender-check': '检查私信连接', 'acquisition-start': '启动自动获客', 'acquisition-pause': '暂停自动获客', 'watch-delete': '删除关注', watch: '添加关注', toggle: '关注状态', 'account-open': '打开浏览器', 'account-check': '检查账号', 'following-sync': '同步关注', analyze: '评论分析', start: '启动发送', pause: '暂停发送', preview: '发送预览', monitor: '采集与分析', 'monitor-start': '启动采集', 'monitor-pause': '暂停采集' } as Record<string,string>)[item.action] ?? '工作区操作', status: item.code ? (scanErrorNames[item.code] ?? acquisitionErrorNames[item.code] ?? '执行失败') : ({ started: '开始', completed: '完成', failed: '失败' })[item.phase] })),
          ...data.sending.events.map(item => ({ at: item.at, task: '私信任务', status: item.event })),
        ].sort((a,b) => b.at-a.at).map((item,index) => <tr key={index}><td>{new Date(item.at).toLocaleString('zh-CN')}</td><td>{item.task}</td><td>{item.status}</td></tr>)}</tbody></table></div>{!(data.runtimeLogs?.length || data.sending.events.length) && <div className="dy-empty">暂无运行记录</div>}</>}
      </section>
    </>}
  </div>
}

export function moduleWindowUrl(root: string): string {
  const url = new URL(root); url.hash = ''; url.searchParams.set('futurestaff-module', 'douyin'); return url.href
}
export const inject = ['slots', 'platformClientSession','platformSystemPages']
export function apply(ctx: Context) {
  const listeners = new Set<(open: boolean) => void>(); let open = false
  const change = (value: boolean) => { open = value; for (const listener of listeners) listener(value) }
  const standalone = new URL(window.location.href).searchParams.get('futurestaff-module') === 'douyin'
  function Launcher({ wide }: { wide: boolean }) {
    return <button type="button" aria-label="打开抖音获客" onClick={() => {
      ctx.platformSystemPages.open('douyin')
    }} style={{ width: '100%', padding: '8px 10px' }}>{wide ? '抖音获客' : '抖'}</button>
  }
  function Surface() {
    const [visible, setVisible] = useState(open)
    const controller = ctx.platformClientSession
    const session = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
    useEffect(() => { listeners.add(setVisible); return () => { listeners.delete(setVisible) } }, [])
    if (standalone) return ['ready','no_apps'].includes(session.phase)
      ? <DouyinWorkspace standalone key={`${session.activeTenantId}:${session.user?.userId}`} onClose={() => window.close()}/>
      : <div className="dy-workspace dy-native-window dy-stack"><style>{workspaceCss}</style><h1>抖音获客</h1><p role="status">请在 FutureStaff 主窗口完成登录和主体选择。</p><button onClick={() => window.close()}>关闭窗口</button></div>
    return visible && ['ready','no_apps'].includes(session.phase)
      ? <DouyinWorkspace key={`${session.activeTenantId}:${session.user?.userId}`} onClose={() => { change(false); document.querySelector<HTMLButtonElement>('[aria-label="打开抖音获客"]')?.focus() }}/> : null
  }
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({ name: 'sidebar.footer.action', id: 'futurestaff-douyin-launcher', order: -15 }, Launcher))
  function Page(){
    const controller=ctx.platformClientSession
    const session=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot)
    return ['ready','no_apps'].includes(session.phase)?<DouyinWorkspace key={`${session.activeTenantId}:${session.user?.userId}`}/>:<p>请先完成登录和主体选择。</p>
  }
  const registerPage=()=>ctx.platformSystemPages.register({id:'douyin',title:'抖音获客',component:Page,close:async()=>{await api.act({action:'acquisition-pause'})}})
  if(typeof ctx.effect==='function')ctx.effect(registerPage,'futurestaff-douyin: system page');else registerPage()
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'futurestaff-douyin-workspace', order: 30 }, Surface))
}
