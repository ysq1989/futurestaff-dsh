import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { parse } from 'yaml'
import { workspaceMarketPatch, workspaceProfilePatch } from '../lib/workspace.js'

const desktopRequire = createRequire(new URL('../../../desktop-shell/dsh-plugin-desktop/package.json', import.meta.url))
const { default: AgentPresets } = await import(pathToFileURL(desktopRequire.resolve('@deepseek-ai/dsh-agent-presets')).href)
const identity = { environment: 'production', tenantId: '10000000-0000-4000-8000-000000000001', userId: '20000000-0000-4000-8000-000000000001' }

test('new and upgraded workspace preset rows satisfy the installed Host schema', () => {
  for (const patch of [workspaceProfilePatch(identity), workspaceMarketPatch(identity)]) {
    const row = parse(patch).find(row => row.id === 'agent-presets')
    const config = AgentPresets.Config(row.config)
    assert.equal(config.default, 'standard')
    assert.equal(config.includeShippedRoot, true)
    assert.equal(config.includeUserRoot, false)
    assert.equal(config.roots.length, 1)
    assert.equal(config.roots[0].trust, 'system')
    const { default: omitted, ...broken } = row.config
    assert.equal(omitted, 'standard')
    assert.throws(() => AgentPresets.Config(broken), /default/)
  }
})
