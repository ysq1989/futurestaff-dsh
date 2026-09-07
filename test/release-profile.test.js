import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { stageReleaseProfile, verifyReleaseProfile } from '../scripts/stage-release-profile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('stages a relocatable built-only FutureStaff Profile', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'futurestaff-release-profile-'))
  try {
    const result = await stageReleaseProfile({ sourceRoot: root, outputRoot: temporary })
    const files = await verifyReleaseProfile(temporary, root)
    assert.ok(files.includes('node_modules/@futurestaff/fs-core/lib/index.js'))
    assert.ok(files.includes('node_modules/@futurestaff/fs-platform-access/lib/client/index.js'))
    assert.ok(files.includes('node_modules/@futurestaff/fs-product-hub-ui/lib/client/index.js'))
    assert.ok(files.includes('node_modules/@futurestaff/fs-product-hub-ui/ui/index.html'))
    assert.ok(files.every(file => !file.includes('/src/') && !file.includes('/test/')))

    const profile = JSON.parse(await readFile(path.join(result.target, 'package.json'), 'utf8'))
    assert.deepEqual(profile.dependencies, {
      '@futurestaff/fs-core': '0.1.0',
      '@futurestaff/fs-platform-access': '0.1.0',
      '@futurestaff/fs-product-hub-ui': '0.1.0',
    })
    assert.ok(Object.values(profile.dependencies).every(value => !value.startsWith('file:')))
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})

test('pins the release runtime and platform contract in the staged manifest', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'futurestaff-release-profile-'))
  try {
    const result = await stageReleaseProfile({ sourceRoot: root, outputRoot: temporary })
    assert.equal(result.releaseManifest.dshVersion, '0.1.2-rc.1')
    assert.equal(result.releaseManifest.platformContract.mock.version, '0.1.0')
    assert.equal(
      result.releaseManifest.platformContract.mock.bundleSha256,
      '5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9',
    )
    assert.equal(result.releaseManifest.platformContract.dev.version, '0.1.1')
    assert.equal(
      result.releaseManifest.platformContract.dev.bundleSha256,
      '9921cc5084925ceea4e6e9d224e5434d4af294974a736a300ed34c73d2950687',
    )
    assert.equal(result.releaseManifest.platformContract.dev.productionEnabled, false)
  } finally {
    await rm(temporary, { recursive: true, force: true })
  }
})
