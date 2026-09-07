import assert from 'node:assert/strict'
import test from 'node:test'

import {
  loadDesktopFoundation,
  validateDesktopFoundation,
} from '../scripts/desktop-foundation.mjs'

test('desktop foundation pins the controlled DSH Desktop source', () => {
  const foundation = loadDesktopFoundation()

  assert.equal(foundation.desktopShell.repository, 'https://github.com/ysq1989/futurestaff-dsh-desktop.git')
  assert.equal(foundation.desktopShell.upstream, 'https://github.com/anywhere-labs/dsh-desktop.git')
  assert.equal(foundation.desktopShell.tag, 'v2.0.5')
  assert.match(foundation.desktopShell.baseCommit, /^[0-9a-f]{40}$/)
  assert.equal(foundation.desktopShell.baseCommit, '423406fe225442995902015cb6f10eed670ff115')
  assert.equal(foundation.desktopShell.releaseCommit, '3665790fede332762e716074afb319dc997f121c')
  assert.equal(foundation.desktopShell.license, 'MIT')
  assert.equal(foundation.desktopShell.deepseekHarness.commit, 'a66e4702047846cdaa10c66c9d3df3951f5ea70d')
})

test('FutureStaff desktop identity and storage cannot collide with upstream DSH Desktop', () => {
  const { product } = loadDesktopFoundation()

  assert.equal(product.name, 'FutureStaff Agent')
  assert.equal(product.appId, 'net.fsstory.agent.desktop')
  assert.equal(product.dataDirectory, 'FutureStaff Agent')
  assert.equal(product.logNamespace, 'FutureStaff Agent/logs')
  assert.notEqual(product.appId, 'ai.deepseek.dsh.desktop')
  assert.notEqual(product.dataDirectory, 'DSH Desktop')
})

test('unsafe third-party network surfaces are disabled by default', () => {
  const { securityDefaults } = loadDesktopFoundation()

  assert.deepEqual(securityDefaults.thirdPartyUpdates, {
    enabled: false,
    endpoint: null,
  })
  assert.equal(securityDefaults.communityMarket, false)
  assert.equal(securityDefaults.dshMarket, false)
  assert.equal(securityDefaults.sponsorAndAggregationLinks, false)
  assert.deepEqual(securityDefaults.remoteControl, {
    enabled: false,
    exposure: 'loopback',
  })
})

test('desktop foundation retains the required local shell capabilities', () => {
  const foundation = loadDesktopFoundation()

  assert.deepEqual(foundation.retainedCapabilities, [
    'window',
    'tray',
    'terminal',
    'profile',
    'recovery',
    'windows-installer',
  ])
  assert.deepEqual(validateDesktopFoundation(foundation), [])
})
