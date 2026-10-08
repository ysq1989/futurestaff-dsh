import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { apply } from '../lib/client/index.js'
const { SlotCore } = createRequire(new URL('../../../desktop-shell/dsh-plugin-desktop/package.json', import.meta.url))('@deepseek-ai/dsh-client-ui-slots')

test('product UI decorates real native registry entries without redeclaring child slots or losing injected props', () => {
  const core = new SlotCore(), single = { kind: 'single', scope: 'root' }
  core.register({ name: 'root', children: {
    sidebar: single, conversation: single,
    'conversation.chat.node': { kind: 'keyed', scope: 'root' },
    'settings.section': { kind: 'list', scope: 'root' },
    'shell.overlay': { kind: 'list', scope: 'root' },
  } }, () => null)
  const sidebarChildren = {
    'sidebar.brand.mark': single, 'sidebar.brand.name': single,
    'sidebar.workspaces': single, 'sidebar.settings': single,
    'sidebar.footer.action': { kind: 'list', scope: 'root' },
  }
  const conversationChildren = { 'conversation.hero.brand.mark': single,
    'conversation.hero.agentPreset': single,
    'conversation.session.header.actions': { kind: 'list', scope: 'root' } }
  const Original = () => null, inject = () => ({ startSession: () => {} })
  core.register({ name: 'sidebar', locale: 'sidebar', inject, children: sidebarChildren }, Original)
  core.register({ name: 'conversation', locale: 'conversation', inject, children: conversationChildren }, Original)
  core.register({ name: 'conversation.hero.agentPreset', locale: 'settings.agentPreset', inject }, Original)
  const sidebar = core.entries('sidebar')[0], conversation = core.entries('conversation')[0]
  assert.equal(sidebar.options.locale, undefined)
  const disposers = []
  apply({ slots: {
    entries: name => core.entries(name),
    subscribe: (name, listener) => core.subscribe(name, listener),
    register: (options, component) => core.register(options, component),
    inject: (_name, callback) => { const dispose = callback(); disposers.push(dispose); return dispose },
  } })
  assert.equal(core.entries('sidebar')[0], sidebar)
  assert.equal(core.entries('conversation')[0], conversation)
  assert.equal(sidebar.children, sidebarChildren)
  assert.equal(conversation.children, conversationChildren)
  assert.equal(conversation.inject, inject)
  assert.equal(conversation.locale, 'conversation')
  assert.notEqual(sidebar.component, Original)
  const hero = conversation.component({ t: key => `original:${key}`, renderSlot: () => null })
  assert.equal(hero.props.t('hero.headline'), 'FutureStaff Agent')
  assert.equal(hero.props.t('hero.preview'), '')
  assert.equal(hero.props.t('placeholder.hero'), 'original:placeholder.hero')
  const mode = core.entries('conversation.hero.agentPreset')[0].component({ t: key => key })
  assert.equal(mode.props.t('presetStandardName'), '普通模式')
  assert.equal(mode.props.t('presetPtcName'), '任务模式')
  for (const dispose of disposers.reverse()) dispose()
  assert.equal(sidebar.component, Original)
  assert.equal(conversation.component, Original)
  assert.doesNotThrow(() => core.register({ name: 'sidebar.workspaces' }, () => null))
})
