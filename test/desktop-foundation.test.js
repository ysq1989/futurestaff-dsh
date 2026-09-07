import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
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
  assert.equal(foundation.desktopShell.releaseCommit, '8f7dbd6ce960daa1e80a96010488b982932381bd')
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

test('B01a pins the published local-only platform contract bundle', () => {
  const { platformContract } = loadDesktopFoundation()

  assert.deepEqual(platformContract, {
    mode: 'local-mock',
    version: '0.1.0',
    platformCommit: '93ca162566225894a8cd317b7bc51b096d16a0ec',
    bundleSha256: '5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9',
    baseUrl: 'http://127.0.0.1:43821',
    clientId: 'futurestaff-agent-pc-dev',
    productionEnabled: false,
  })
})

test('FutureStaff Profile mounts the B01a Host and Web client plugin', async () => {
  const [profilePackage, profilePatch, installer] = await Promise.all([
    readFile(new URL('../profile/futurestaff-alpha/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../profile/futurestaff-alpha/cordis.patch.yml', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/install-profile.mjs', import.meta.url), 'utf8'),
  ])

  assert.match(profilePackage, /"@futurestaff\/fs-platform-access"/)
  assert.match(profilePatch, /id: futurestaff-platform-access[\s\S]*name: '@futurestaff\/fs-platform-access'/)
  assert.match(installer, /manifest\.dependencies\['@futurestaff\/fs-platform-access'\]/)
})
