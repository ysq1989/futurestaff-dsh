import assert from 'node:assert/strict'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { readLibraryDom, openLibraryDom } from '../lib/account-library.js'

const accountId = 'MS4wLjABown_account_12345', other = 'MS4wLjABcreator_account_12345'
function fixture(html, url = `https://www.douyin.com/user/${accountId}`) {
  const dom = new JSDOM(html, { url, runScripts: 'outside-only' })
  dom.window.Element.prototype.getBoundingClientRect = function () {
    return { width: this.closest('[hidden]') ? 0 : 100, height: this.closest('[hidden]') ? 0 : 30 }
  }
  return { dom, read: kind => dom.window.eval(`(${readLibraryDom.toString()})`)({ kind, accountId }), close: () => dom.window.close() }
}
test('following imports only visible canonical account links inside the proven following dialog', () => {
  const f = fixture(`<a href="/user/MS4wLjABrecommended_12345">推荐账号</a><div role="dialog"><h2>我的关注</h2>
    <a href="/user/${other}?from=list">创作者</a><a href="/user/${other}">重复</a>
    <a href="/user/${accountId}">自己</a><a href="https://evil.invalid/user/${other}">外站</a>
    <a hidden href="/user/MS4wLjABhidden_account_12345">隐藏</a><a href="javascript:alert(1)">脚本</a>
    <a href="/video/123456789">视频</a></div>`)
  try { assert.deepEqual(JSON.parse(JSON.stringify(f.read('following'))), { accountId, items: [{ id: other, url: `https://www.douyin.com/user/${other}`, name: '创作者' }] }) }
  finally { f.close() }
})
test('favorites require an active tab and read its panel, excluding recommendations and inactive panels', () => {
  const f = fixture(`<a href="/video/77777777">推荐</a><button role="tab" aria-selected="true" aria-controls="favorites">收藏</button>
    <div id="favorites" role="tabpanel"><a href="/video/123456789?from=collect">越南签证</a><a href="/note/23456789">图文</a></div>
    <div role="tabpanel"><a href="/video/99999999">自己的作品</a></div>`)
  try { assert.deepEqual([...f.read('favorites').items].map(i => i.id), ['123456789', '23456789']) }
  finally { f.close() }
})
test('whole-page links, the wrong account, unselected tabs and ambiguous dialogs fail closed', () => {
  for (const [html, url] of [
    ['<a href="/video/123456789">推荐</a>', undefined],
    ['<button role="tab" aria-selected="false">收藏</button><div role="tabpanel"></div>', undefined],
    ['<div role="dialog"><h2>关注</h2></div><div role="dialog"><h2>关注</h2></div>', undefined],
    ['<div role="dialog"><h2>关注</h2></div>', `https://www.douyin.com/user/${other}`],
    ['<div role="dialog"><h2>关注</h2></div>', `https://evil.invalid/user/${accountId}`],
  ]) {
    const f = fixture(html, url)
    try { assert.throws(() => f.read(html.includes('收藏') ? 'favorites' : 'following'), /LIBRARY_/) } finally { f.close() }
  }
})


test('numeric profile following counter opens once despite sidebar and nested labels', () => {
  const p = fixture('<nav><button>关注</button></nav><div id="counter"><span>关注</span><span>19</span></div>')
  try {
    let clicks = 0; p.dom.window.document.getElementById('counter').onclick = () => { clicks++ }
    const open = p.dom.window.eval(`(${openLibraryDom.toString()})`)
    assert.deepEqual(JSON.parse(JSON.stringify(open({ kind: 'following', accountId }))), { opened: true, total: 19 })
    assert.equal(clicks, 1)
  } finally { p.dom.window.close() }
})


function followingOverlay({ position = 'fixed', active = 'following', search = '', count = '(19)' } = {}) {
  return `<div style="position:${position}"><div class="arbitrary-dialog-hash"><div><div role="tablist">
    <div role="tab" aria-selected="${active === 'following'}">关注 ${count}</div>
    <div role="tab" aria-selected="${active === 'fans'}">粉丝 (7)</div>
    </div></div><input placeholder="搜索用户名字或抖音号" value="${search}">
    <div style="overflow-y:auto;height:200px"><a href="/user/${other}?from=following"><img alt="旧名字头像"></a>
    <a href="/user/${other}?from=following">真实作者</a></div></div></div>`
}

test('observed Semi following overlay with parenthesized counts needs no dialog or tabpanel', () => {
  for (const count of ['(19)', '（19）']) {
    const f = fixture(`<a href="/user/MS4wLjABbackground_12345">背景推荐</a>${followingOverlay({ count })}`)
    try {
      const result = f.read('following')
      assert.deepEqual(JSON.parse(JSON.stringify(result)), { accountId, items: [{ id: other, name: '真实作者', url: `https://www.douyin.com/user/${other}` }] })
    } finally { f.close() }
  }
})

test('custom overlay refuses fans, a non-overlay, active search and ambiguous fixed ancestry', () => {
  for (const html of [followingOverlay({ active: 'fans' }), followingOverlay({ position: 'relative' }),
    followingOverlay({ search: '签证' }), `<div style="position:fixed">${followingOverlay()}</div>`]) {
    const f = fixture(html)
    try { assert.throws(() => f.read('following'), /LIBRARY_PANEL_REQUIRED/) } finally { f.close() }
  }
})

test('numeric opener supports both parenthesis forms and waits for a unique profile counter', () => {
  for (const label of ['关注 (19)', '关注（19）', '关注 19人']) {
    const f = fixture(`<div id="counter">${label}</div><button>关注</button>`)
    try {
      const open = f.dom.window.eval(`(${openLibraryDom.toString()})`)
      assert.deepEqual(JSON.parse(JSON.stringify(open({ kind: 'following', accountId }))), { opened: true, total: 19 })
    } finally { f.close() }
  }
})


test('personal statistics counter wins over a numbered sidebar following-feed badge', () => {
  const f = fixture('<div><a href="/follow">关注<span>79</span></a></div><div><div id="counter">关注19</div><div>粉丝7</div><div>获赞48</div></div>')
  try {
    let opened = 0, feed = 0
    f.dom.window.document.getElementById('counter').onclick = () => { opened++ }
    f.dom.window.document.querySelector('a').onclick = () => { feed++ }
    const open = f.dom.window.eval(`(${openLibraryDom.toString()})`)
    assert.deepEqual(JSON.parse(JSON.stringify(open({ kind: 'following', accountId }))), { opened: true, total: 19 })
    assert.equal(opened, 1); assert.equal(feed, 0)
  } finally { f.close() }
})

test('observed fans-index label still proves the following overlay', () => {
  const f = fixture(followingOverlay().replace('粉丝 (7)', '粉丝指数 (7)'))
  try { assert.equal(f.read('following').items.length, 1) } finally { f.close() }
})
