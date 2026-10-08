import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { watchSlotComponents } from '../lib/client/slot-components.js'
const { SlotCore } = createRequire(new URL('../../../desktop-shell/dsh-plugin-desktop/package.json', import.meta.url))('@deepseek-ai/dsh-client-ui-slots')
const tick = async () => { for (let i = 0; i < 4; i++) await Promise.resolve() }
const facade = core => ({ entries: name => core.entries(name), subscribe: (name, listener) => core.subscribe(name, listener),
  register: (options, component) => core.register(options, component) })

test('declaration before native registration still decorates the eventual sidebar and newly registered generations', async () => {
  const core = new SlotCore()
  core.register({ name: 'root', children: { sidebar: { kind: 'single', scope: 'root' } } }, () => null)
  const replacements = []
  const stop = watchSlotComponents(facade(core), 'sidebar', entry => entry.locale === 'sidebar', original => {
    const wrapped = () => original(); replacements.push(wrapped); return wrapped
  })
  assert.equal(replacements.length, 0)
  const original = () => null
  const remove = core.register({ name: 'sidebar', locale: 'sidebar' }, original)
  await tick()
  assert.equal(core.entries('sidebar')[0].component, replacements[0])
  assert.equal(core.entries('sidebar').length, 1)
  remove(); await tick()
  core.register({ name: 'sidebar', locale: 'sidebar' }, original); await tick()
  assert.equal(replacements.length, 2)
  assert.equal(core.entries('sidebar')[0].component, replacements[1])
  stop()
  assert.equal(core.entries('sidebar')[0].component, original)
})

test('late product decoration notifies already-mounted observers and leaves no pulse entry or notification loop', async () => {
  const core = new SlotCore()
  core.register({ name: 'root', children: { conversation: { kind: 'single', scope: 'root' } } }, () => null)
  const original = () => null, replacement = () => null
  core.register({ name: 'conversation' }, original); await tick()
  const version = core.getVersion('conversation')
  let observed
  const observer = core.subscribe('conversation', () => { observed = core.entriesOfSlot('conversation')[0].component })
  const stop = watchSlotComponents(facade(core), 'conversation', () => true, () => replacement)
  await tick()
  assert.ok(core.getVersion('conversation') > version)
  assert.equal(observed, replacement)
  assert.equal(core.entries('conversation').length, 1)
  const settled = core.getVersion('conversation'); await tick()
  assert.equal(core.getVersion('conversation'), settled)
  stop(); observer()
})
