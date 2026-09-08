import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { validateDesktopPackagingContract } from '../scripts/stage-desktop-release.mjs'

const foundation = {
  product: { appId: 'net.fsstory.agent.desktop', name: 'FutureStaff Agent' },
}

test('accepts only the FutureStaff package identity and exact Profile resource destination', () => {
  assert.deepEqual(validateDesktopPackagingContract(foundation, {
    build: {
      appId: 'net.fsstory.agent.desktop',
      productName: 'FutureStaff Agent',
      extraResources: [{ from: 'build/futurestaff-profile', to: 'futurestaff-profile' }],
    },
  }), [])
})

test('rejects a shell package that could omit or misdirect the staged Profile', () => {
  assert.deepEqual(validateDesktopPackagingContract(foundation, {
    build: { appId: 'wrong', productName: 'DSH Desktop', extraResources: [] },
  }), [
    'desktop appId mismatch',
    'desktop productName mismatch',
    'desktop package does not declare the verified FutureStaff Profile resource',
  ])
})

test('stages only the desktop shell embedded in the product repository', () => {
  const source = readFileSync(new URL('../scripts/stage-desktop-release.mjs', import.meta.url), 'utf8')

  assert.match(source, /path\.join\(repositoryRoot, foundation\.desktopShell\.source\.path\)/)
  assert.doesNotMatch(source, /FUTURESTAFF_DESKTOP_SHELL_DIR|futurestaff-dsh-desktop/u)
})
