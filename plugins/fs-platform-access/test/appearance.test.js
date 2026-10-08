import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import { adoptBlueWhiteDefault, appearanceTokens, installAppearance } from '../lib/client/appearance.js'

test('blue-white adoption runs once and preserves subsequent user appearance choices', () => {
  const values = new Map(), calls = []
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const theme = { setTheme: id => calls.push(id) }
  adoptBlueWhiteDefault(theme, storage)
  calls.push('dark')
  adoptBlueWhiteDefault(theme, storage)
  assert.deepEqual(calls, ['light', 'dark'])
})

test('blocked local storage never breaks the access gate', () => {
  assert.doesNotThrow(() => adoptBlueWhiteDefault({ setTheme() {} }, {
    getItem() { throw new Error('disabled') }, setItem() { throw new Error('disabled') },
  }))
})

test('skin teardown releases the theme layer, stylesheet and product marker', () => {
  const originalDocument = globalThis.document, originalWindow = globalThis.window
  const styles = [], attributes = new Map(), disposed = []
  let layerRemoved = false
  globalThis.document = {
    createElement: () => ({ dataset: {}, remove() { styles.splice(styles.indexOf(this), 1) } }),
    head: { appendChild: style => styles.push(style) },
    body: { setAttribute: (key, value) => attributes.set(key,value), removeAttribute: key => attributes.delete(key) },
  }
  globalThis.window = { localStorage: { getItem: () => 'applied', setItem() {} } }
  const context = {
    theme: { overrideTokens(source, tokens) {
      assert.equal(source, 'futurestaff-blue-white'); assert.equal(tokens, appearanceTokens)
      return () => { layerRemoved = true }
    }, setTheme() { throw new Error('must retain existing preference') } },
    effect(fn) { disposed.push(fn()) },
    inject(names, fn) { assert.deepEqual(names,['theme']); fn(this) },
  }
  try {
    installAppearance(context)
    assert.equal(styles.length, 1); assert.equal(attributes.get('data-futurestaff-skin'),'blue-white')
    disposed.reverse().forEach(fn => fn())
    assert.equal(layerRemoved,true); assert.equal(styles.length,0); assert.equal(attributes.size,0)
  } finally { globalThis.document=originalDocument; globalThis.window=originalWindow }
})

test('both palette modes keep body, muted text and primary button labels readable at AA', () => {
  const luminance = hex => {
    const channels = hex.slice(1).match(/../g).map(x => parseInt(x,16)/255)
      .map(x => x <= .04045 ? x/12.92 : ((x+.055)/1.055)**2.4)
    return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722
  }
  const contrast = (a,b) => { const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05) }
  for (const mode of ['light','dark']) {
    for (const text of ['--text-primary','--text-secondary']) {
      for (const surface of ['--bg-primary','--bg-secondary','--bg-tertiary']) {
        assert.ok(contrast(appearanceTokens[text][mode],appearanceTokens[surface][mode])>=4.5,`${mode} ${text} on ${surface}`)
      }
    }
    for (const endpoint of ['--fs-button-start','--fs-button-end']) {
      assert.ok(contrast(appearanceTokens['--fs-on-accent'][mode],appearanceTokens[endpoint][mode])>=4.5)
    }
  }
})

test('installed upstream ThemeRuntime accepts the product layer and removes it across scheme changes', async () => {
  let exports
  const require = createRequire(import.meta.url)
  const bundle = await readFile(require.resolve('@deepseek-ai/dsh-client-ui-theme/client'),'utf8')
  // Render-only dependencies are unused by the real DOM-free ThemeRuntime.
  runInNewContext(bundle, { window: { __ModuleLoader__: { load: entry => { exports=entry.factory(() => ({})) } } } })
  const theme = new exports.ThemeRuntime({ effect: fn => fn(), emit() {} }, {
    subscribe: () => () => {}, getSnapshot: () => ({ value: { preference:'light',fontSize:14 } }), set: async () => {},
  })
  const release = theme.overrideTokens('futurestaff-test',appearanceTokens)
  assert.equal(theme.getTheme().active.tokens['--bg-primary'],'#eff6ff')
  theme.setTheme('dark')
  assert.equal(theme.getTheme().active.colorScheme,'dark')
  assert.equal(theme.getTheme().active.tokens['--dsw-alias-bg-base'],'#17181b')
  release()
  assert.equal(theme.getTheme().active.tokens['--bg-primary'],undefined)
  assert.equal(theme.getTheme().preference,'dark')
})
