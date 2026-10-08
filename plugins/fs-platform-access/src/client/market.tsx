import { createElement as h, useEffect, useState } from 'react'

interface Card { templateId: string; version: string; name: string; description: string;
  category: string; capabilityBullets: string[]; compatible: boolean; unavailableReason: string | null; presetId?: string }
const prefix = '/_futurestaff/agent-market'
async function request(suffix: string, body?: unknown) {
  const response = await fetch(`${prefix}/${suffix}`, { method: body ? 'POST' : 'GET',
    headers: { 'x-futurestaff-market': '1', ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) })
  if (!response.ok) throw new Error('暂时无法获取或添加角色，请检查登录、平台接口和本地运行时。')
  return response.json()
}
export function AgentMarketSection() {
  const [catalog, setCatalog] = useState<Card[]>([])
  const [mine, setMine] = useState<Card[]>([])
  const [tab, setTab] = useState<'catalog' | 'mine'>('catalog')
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  useEffect(() => {
    let active = true
    setBusy(true)
    // Local roles remain visible when the remote catalog is unavailable.
    void Promise.allSettled([request('catalog'), request('mine')]).then(results => {
      if (!active) return
      const [remote, local] = results
      if (remote?.status === 'fulfilled') setCatalog(remote.value.items)
      else setError('平台市场暂时不可用，已有本地角色仍可从新会话中选择。')
      if (local?.status === 'fulfilled') setMine(local.value.items)
      else setError('请先登录并进入主体工作空间。')
      setBusy(false)
    })
    return () => { active = false }
  }, [reload])
  async function install(card: Card) {
    setBusy(true); setError(''); setNotice('')
    try {
      await request('install', { templateId: card.templateId, version: card.version })
      setMine((await request('mine')).items)
      setNotice('角色已添加并设为新会话默认角色；已有会话保持原角色版本。')
    } catch (e) { setError(e instanceof Error ? e.message : '添加失败') }
    finally { setBusy(false) }
  }
  const cards = (tab === 'catalog' ? catalog : mine).filter(c => (!category || c.category === category)
    && `${c.name} ${c.description} ${c.capabilityBullets.join(' ')}`.toLowerCase().includes(search.toLowerCase()))
  return h('section', { className: 'futurestaff-market', 'aria-label': 'Agent 市场' },
    h('style', null, `.futurestaff-market{color:var(--text-primary);display:grid;gap:16px}.futurestaff-market input,.futurestaff-market select,.futurestaff-market button{font:inherit;color:inherit;background:var(--bg-elevated);border:1px solid var(--border-default);border-radius:8px;padding:8px}.futurestaff-market button{cursor:pointer}.futurestaff-market button:disabled{opacity:.5;cursor:default}.futurestaff-market :focus-visible{outline:2px solid var(--accent-primary);outline-offset:2px}.fs-market-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}.fs-market-card{border:1px solid var(--border-default);border-radius:12px;padding:16px;overflow-wrap:anywhere}.fs-market-card h3{margin-top:0}.fs-market-controls{display:flex;flex-wrap:wrap;gap:8px}`),
    h('h2', null, 'Agent 市场'), h('p', null, '角色模板来自 FutureStaff 平台，使用 DSH 本地能力执行。'),
    h('div', { className: 'fs-market-controls' },
      h('button', { onClick: () => setTab('catalog'), 'aria-pressed': tab === 'catalog' }, '平台市场'),
      h('button', { onClick: () => setTab('mine'), 'aria-pressed': tab === 'mine' }, `我的 Agent (${mine.length})`),
      h('button', { disabled: busy, onClick: () => setReload(value => value + 1) }, '同步目录'),
      h('input', { 'aria-label': '搜索角色', placeholder: '搜索角色或能力', value: search, onChange: (e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value) }),
      h('select', { 'aria-label': '角色分类', value: category, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setCategory(e.target.value) },
        h('option', { value: '' }, '全部分类'), ...Array.from(new Set([...catalog, ...mine].map(c => c.category))).sort().map(c => h('option', { key: c, value: c }, c)))),
    error ? h('p', { role: 'alert' }, error) : null,
    notice ? h('p', { role: 'status' }, notice) : null,
    busy ? h('p', { role: 'status' }, '正在处理…') : null,
    h('div', { className: 'fs-market-grid' }, ...cards.map(card => {
      const installed = mine.some(r => r.templateId === card.templateId && r.version === card.version)
      const older = mine.some(r => r.templateId === card.templateId && r.version !== card.version)
      return h('article', { className: 'fs-market-card', key: `${card.templateId}-${card.version}` },
        h('h3', null, card.name), h('p', null, card.description),
        h('ul', null, ...card.capabilityBullets.map((b, i) => h('li', { key: i }, b))),
        h('small', null, `版本 ${card.version.slice(0, 12)}`),
        tab === 'catalog' ? h('div', null,
          h('button', { disabled: busy || !card.compatible || installed, onClick: () => { void install(card) } },
            installed ? '已添加' : older ? '添加并使用新版本' : '添加并使用'),
          card.unavailableReason ? h('p', null, card.unavailableReason) : null)
          : h('p', null, '在新会话中选择此角色。'))
    })),
    !busy && cards.length === 0 ? h('p', null, '暂无符合条件的角色。') : null)
}
