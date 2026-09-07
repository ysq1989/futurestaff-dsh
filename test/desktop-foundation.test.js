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
  assert.equal(foundation.desktopShell.releaseCommit, 'bd54da63577a5d2595ced66060999e12468f42a8')
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

test('platform access preserves the immutable A01 Mock and pins the deployed A02 contract', () => {
  const { platformContract } = loadDesktopFoundation()

  assert.deepEqual(platformContract.mock, {
    mode: 'local-mock',
    version: '0.1.0',
    platformCommit: '93ca162566225894a8cd317b7bc51b096d16a0ec',
    bundleSha256: '5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9',
    baseUrl: 'http://127.0.0.1:43821',
    clientId: 'futurestaff-agent-pc-dev',
  })
  assert.deepEqual(platformContract.dev, {
    mode: 'platform-dev',
    version: '0.1.1',
    status: 'deployed-platform-dev',
    platformCommit: 'd789faceb7971deb111fec3e4948237d21e81346',
    handoffCommit: '2c31ed720d8f9ee4fd8087f758c928ea5f8c0ac2',
    bundleSha256: '9921cc5084925ceea4e6e9d224e5434d4af294974a736a300ed34c73d2950687',
    authorizationUrl: 'https://dev.fsstory.net/login',
    baseUrl: 'https://dev.fsstory.net',
    callbackUrl: 'http://127.0.0.1:43821/callback',
    clientId: 'futurestaff-agent-pc-dev',
    pkceMethod: 'S256',
    productionEnabled: false,
  })
})

test('FutureStaff Profile mounts platform access and Product Hub UI plugins', async () => {
  const [profilePackage, profilePatch, installer] = await Promise.all([
    readFile(new URL('../profile/futurestaff-alpha/package.json', import.meta.url), 'utf8'),
    readFile(new URL('../profile/futurestaff-alpha/cordis.patch.yml', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/install-profile.mjs', import.meta.url), 'utf8'),
  ])

  assert.match(profilePackage, /"@futurestaff\/fs-platform-access"/)
  assert.match(profilePatch, /id: futurestaff-platform-access[\s\S]*name: '@futurestaff\/fs-platform-access'/)
  assert.match(installer, /manifest\.dependencies\['@futurestaff\/fs-platform-access'\]/)
  assert.match(profilePackage, /"@futurestaff\/fs-product-hub-ui"/)
  assert.match(profilePatch, /id: futurestaff-product-hub-ui[\s\S]*name: '@futurestaff\/fs-product-hub-ui'/)
  assert.match(installer, /manifest\.dependencies\['@futurestaff\/fs-product-hub-ui'\]/)
})
