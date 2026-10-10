import { z } from 'zod'

export type LibraryKind = 'following' | 'favorites'
export const libraryItemSchema = z.object({ id: z.string().min(5).max(160), url: z.string().url(), name: z.string().max(200) }).strict()
export const libraryResultSchema = z.object({ accountId: z.string().regex(/^MS4wLjAB[A-Za-z0-9_-]{10,150}$/),
  items: z.array(libraryItemSchema).max(500) }).strict()
export type LibraryResult = z.infer<typeof libraryResultSchema>

/** Runs inside the owned tab. Only a proven list region may contribute links. */
export function readLibraryDom(args: { kind: LibraryKind; accountId: string; advance?: boolean }): LibraryResult & { end?: boolean } {
  const visible = (el: Element) => { const rect = el.getBoundingClientRect(); return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden' }
  const label = (el: Element) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, '')
  const labels = args.kind === 'following' ? ['关注', '我的关注'] : ['收藏', '我的收藏']
  const matchesLabel = (el: Element) => labels.includes(label(el)) || (args.kind === 'following' && /^(?:我的)?关注(?:[0-9,]+(?:人)?|\([0-9,]+\)|（[0-9,]+）)$/.test(label(el)))
  if (location.origin !== 'https://www.douyin.com' || location.pathname.replace(/\/$/, '') !== `/user/${args.accountId}`)
    throw new Error('LIBRARY_ACCOUNT_PAGE_REQUIRED')
  const dialogs = [...document.querySelectorAll('[role="dialog"],dialog[open],[aria-modal="true"]')].filter(visible)
  let region: Element | undefined
  if (args.kind === 'following') {
    const matches = dialogs.filter(dialog => matchesLabel(dialog)
      || [...dialog.querySelectorAll('h1,h2,h3,[role="heading"]')].some(el => visible(el) && matchesLabel(el)))
    if (matches.length === 1) region = matches[0]
  }
  if (!region && !dialogs.length) {
    const selected = [...document.querySelectorAll('[role="tab"][aria-selected="true"]')].filter(el => visible(el) && matchesLabel(el))
    if (selected.length === 1) {
      const controlled = selected[0]!.getAttribute('aria-controls')
      const panel = controlled ? document.getElementById(controlled) : null
      const panels = [...document.querySelectorAll('[role="tabpanel"]')].filter(visible)
      region = panel && visible(panel) ? panel : panels.length === 1 ? panels[0] : undefined
      if (!region && args.kind === 'following') {
        // Douyin's own following overlay uses Semi tabs without a dialog or tabpanel.
        // Bind the active following tab to its fixed overlay and user search, rather than a CSS hash.
        const tab = selected[0]!, bar = tab.closest('[role="tablist"]')
        const tabs = bar ? [...bar.querySelectorAll('[role="tab"]')].filter(visible) : []
        const hasFans = tabs.some(el => /^粉丝(?:指数)?(?:\([0-9,]+\)|（[0-9,]+）)$/.test(label(el)))
        const overlays: Element[] = []
        for (let el = tab.parentElement; el && el !== document.body; el = el.parentElement) {
          if (getComputedStyle(el).position === 'fixed' && visible(el)) overlays.push(el)
        }
        if (hasFans && overlays.length === 1) {
          const overlay = overlays[0]!
          const searches = [...overlay.querySelectorAll('input')].filter(el => visible(el)
            && /^(搜索用户名字或抖音号|搜索用户名或抖音号)$/.test(el.getAttribute('placeholder') || ''))
          const active = [...overlay.querySelectorAll('[role="tab"][aria-selected="true"]')].filter(visible)
          if (searches.length === 1 && active.length === 1 && active[0] === tab) {
            // Searching hides followed accounts, so a filtered overlay is not a complete source.
            if (searches[0]!.value.trim()) throw new Error('LIBRARY_PANEL_REQUIRED')
            for (let el = bar?.parentElement; el && overlay.contains(el); el = el.parentElement) {
              if (el.contains(searches[0]!)) { region = el; break }
            }
          }
        }
      }
    }
  }
  if (!region) throw new Error('LIBRARY_PANEL_REQUIRED')
  const items = new Map<string, { id: string; url: string; name: string }>()
  const named = new Set<string>()
  for (const anchor of region.querySelectorAll('a[href]')) {
    if (!visible(anchor)) continue
    let url: URL
    try { url = new URL(anchor.getAttribute('href')!, location.origin) } catch { continue }
    const expression = args.kind === 'following' ? /^\/user\/(MS4wLjAB[A-Za-z0-9_-]{10,150})\/?$/ : /^\/(?:video|note)\/([0-9]{5,30})\/?$/
    const match = expression.exec(url.pathname)
    if (url.origin !== location.origin || url.username || url.password || !match || match[1] === args.accountId) continue
    const id = match[1]!, name = (anchor.getAttribute('title') || anchor.textContent || anchor.querySelector('img')?.getAttribute('alt')?.replace(/头像$/, '') || id).trim().slice(0, 200)
    const existing = items.get(id)
    // Avatar and name are separate links to the same account; prefer the visible name link.
    const explicitName = (anchor.getAttribute('title') || anchor.textContent || '').trim()
    if (!existing || (explicitName && !named.has(id)))
      items.set(id, { id, url: url.origin + url.pathname.replace(/\/$/, ''), name })
    if (explicitName) named.add(id)
    if (items.size >= (args.advance ? 500 : 200)) break
  }
  if (args.advance) {
    const end = [...region.querySelectorAll('p,span,div')].some(el => visible(el) && /^(暂时没有更多了|没有更多了|暂无关注|还没有关注任何人)$/.test(label(el)))
    const containers = [region, ...region.querySelectorAll('*')].filter(el => visible(el) && el.scrollHeight > el.clientHeight + 2
      && /auto|scroll/.test(getComputedStyle(el).overflowY))
    // Scroll only a verified list container, never the recommendations underneath it.
    const scroller = containers.sort((a, b) => b.querySelectorAll('a[href]').length - a.querySelectorAll('a[href]').length)[0]
    if (scroller) scroller.scrollTop += Math.max(100, scroller.clientHeight * .75)
    return { accountId: args.accountId, items: [...items.values()], end }
  }
  return { accountId: args.accountId, items: [...items.values()] }
}

/** The numeric profile counter often uses a div/span rather than an ARIA button. */
export function openLibraryDom(args: { kind: LibraryKind; accountId: string }): { opened: boolean; total: number | null } {
  if (location.origin !== 'https://www.douyin.com' || location.pathname.replace(/\/$/, '') !== `/user/${args.accountId}`)
    throw new Error('LIBRARY_ACCOUNT_PAGE_REQUIRED')
  const expression = args.kind === 'following' ? /^(?:我的)?关注(?:([0-9,]+)(?:人)?|\(([0-9,]+)\)|（([0-9,]+)）)?$/ : /^(?:我的)?收藏$/
  const matches = [...document.querySelectorAll('[role="tab"],button,[role="button"],a,div,span')].filter(el => {
    const rect = el.getBoundingClientRect()
    return rect.width > 0 && rect.height > 0 && getComputedStyle(el).visibility !== 'hidden'
      && expression.test((el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ''))
  })
  // A nested label and its clickable wrapper represent one control.
  const counted = args.kind === 'following' ? matches.filter(el => /[0-9]/.test(el.textContent || el.getAttribute('aria-label') || '')) : []
  // The sidebar also has a numbered following-feed badge. The personal counter
  // belongs to the profile's sibling following / fans / likes statistics row.
  const profileCounters = counted.filter(el => {
    const siblings = el.parentElement ? [...el.parentElement.children] : []
    const texts = siblings.map(sibling => (sibling.textContent || '').replace(/\s+/g, ''))
    return texts.some(text => /^粉丝[0-9,.]+(?:万|亿)?$/.test(text))
      && texts.some(text => /^获赞[0-9,.]+(?:万|亿)?$/.test(text))
  })
  const candidates = profileCounters.length ? profileCounters : counted.length ? counted : matches
  const controls = candidates.filter(el => !candidates.some(parent => parent !== el && parent.contains(el)))
  if (controls.length !== 1) return { opened: false, total: null }
  const control = controls[0]!, text = (control.getAttribute('aria-label') || control.textContent || '').replace(/\s+/g, '')
  const count = expression.exec(text), total = count?.[1] || count?.[2] || count?.[3]
  ;(control as HTMLElement).click()
  return { opened: true, total: total === undefined ? null : Number(total.replaceAll(',', '')) }
}
