import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const foundationUrl = new URL('../desktop/foundation.json', import.meta.url)

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function loadDesktopFoundation() {
  return JSON.parse(readFileSync(foundationUrl, 'utf8'))
}

export function validateDesktopFoundation(value) {
  const errors = []
  const shell = isRecord(value?.desktopShell) ? value.desktopShell : {}
  const product = isRecord(value?.product) ? value.product : {}
  const security = isRecord(value?.securityDefaults) ? value.securityDefaults : {}
  const updates = isRecord(security.thirdPartyUpdates) ? security.thirdPartyUpdates : {}
  const remote = isRecord(security.remoteControl) ? security.remoteControl : {}

  if (value?.schemaVersion !== 1) errors.push('schemaVersion must be 1')
  if (product.name !== 'FutureStaff Agent') errors.push('product.name must be FutureStaff Agent')
  if (product.appId !== 'net.fsstory.agent.desktop') errors.push('product.appId is not the FutureStaff namespace')
  if (product.dataDirectory !== 'FutureStaff Agent') errors.push('product data directory is not isolated')
  if (product.logNamespace !== 'FutureStaff Agent/logs') errors.push('product log namespace is not isolated')
  if (shell.repository !== 'https://github.com/ysq1989/futurestaff-dsh-desktop.git') errors.push('controlled fork URL is incorrect')
  if (shell.upstream !== 'https://github.com/anywhere-labs/dsh-desktop.git') errors.push('upstream URL is incorrect')
  if (shell.tag !== 'v2.0.5') errors.push('desktop shell tag must remain v2.0.5')
  if (!/^[0-9a-f]{40}$/u.test(shell.baseCommit ?? '')) errors.push('desktop shell base commit must be an exact SHA')
  if (shell.releaseCommit !== null && !/^[0-9a-f]{40}$/u.test(shell.releaseCommit ?? '')) {
    errors.push('desktop shell release commit must be null or an exact SHA')
  }
  if (shell.license !== 'MIT') errors.push('desktop shell license must be MIT')
  if (shell.deepseekHarness?.modified !== false) errors.push('official deepseek-harness must remain unmodified')
  if (updates.enabled !== false || updates.endpoint !== null) errors.push('third-party updates must be disabled')
  if (security.communityMarket !== false || security.dshMarket !== false) errors.push('third-party markets must be disabled')
  if (security.sponsorAndAggregationLinks !== false) errors.push('sponsor and aggregation links must be disabled')
  if (remote.enabled !== false || remote.exposure !== 'loopback') errors.push('remote control must be disabled and loopback-only')

  const expectedCapabilities = ['window', 'tray', 'terminal', 'profile', 'recovery', 'windows-installer']
  if (JSON.stringify(value?.retainedCapabilities) !== JSON.stringify(expectedCapabilities)) {
    errors.push('required desktop capabilities changed')
  }
  return errors
}

function git(checkout, ...args) {
  return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim()
}

export function verifyDesktopCheckout(checkout, foundation = loadDesktopFoundation()) {
  if (!existsSync(checkout)) return [`desktop checkout does not exist: ${checkout}`]

  const errors = []
  const head = git(checkout, 'rev-parse', 'HEAD')
  const branch = git(checkout, 'branch', '--show-current')
  const origin = git(checkout, 'remote', 'get-url', 'origin')
  const upstream = git(checkout, 'remote', 'get-url', 'upstream')
  const gitlink = git(checkout, 'ls-tree', 'HEAD', 'deepseek-harness').split(/\s+/u)[2]
  const submoduleDiff = git(checkout, 'diff', '--name-only', '--', 'deepseek-harness')
  const desktopPackage = JSON.parse(readFileSync(join(checkout, 'dsh-plugin-desktop', 'package.json'), 'utf8'))
  const desktopPatch = readFileSync(join(checkout, 'dsh-plugin-desktop', 'cordis.patch.yml'), 'utf8')
  const identitySource = readFileSync(join(checkout, 'dsh-plugin-desktop', 'src', 'product-identity.ts'), 'utf8')
  const setupDefaults = readFileSync(join(checkout, 'dsh-plugin-desktop', 'src', 'setup-wizard-settings.ts'), 'utf8')
  const marketSource = readFileSync(join(checkout, 'dsh-plugin-desktop', 'src', 'desktop-market.ts'), 'utf8')

  if (head !== foundation.desktopShell.baseCommit && foundation.desktopShell.releaseCommit === null) {
    errors.push(`desktop HEAD ${head} is neither the pinned base nor a recorded release commit`)
  }
  if (foundation.desktopShell.releaseCommit !== null && head !== foundation.desktopShell.releaseCommit) {
    errors.push(`desktop HEAD ${head} does not match releaseCommit`)
  }
  if (branch !== 'main') errors.push(`desktop checkout must use main, found ${branch || 'detached HEAD'}`)
  if (origin !== foundation.desktopShell.repository) errors.push(`desktop origin mismatch: ${origin}`)
  if (upstream !== foundation.desktopShell.upstream) errors.push(`desktop upstream mismatch: ${upstream}`)
  if (gitlink !== foundation.desktopShell.deepseekHarness.commit) errors.push(`deepseek-harness gitlink mismatch: ${gitlink}`)
  if (submoduleDiff !== '') errors.push('deepseek-harness gitlink has local changes')
  if (desktopPackage.build?.appId !== foundation.product.appId) errors.push('desktop package appId does not match the product lock')
  if (desktopPackage.build?.productName !== foundation.product.name) errors.push('desktop package productName does not match the product lock')
  if (!identitySource.includes(`productName: '${foundation.product.name}'`)) errors.push('desktop runtime product name is not productized')
  if (!identitySource.includes(`appId: '${foundation.product.appId}'`)) errors.push('desktop runtime appId is not productized')
  if (!/id: desktop-updates[\s\S]*?disabled: true[\s\S]*?enabled: false/u.test(desktopPatch)) {
    errors.push('third-party desktop update plugin is not disabled')
  }
  if (!/openBrowser: false,[\s\S]*?networkExposure: 'loopback'/u.test(setupDefaults)) {
    errors.push('desktop browser/LAN defaults are not fail closed')
  }
  if (!/requested: 'disabled',[\s\S]*?effective: 'disabled'/u.test(marketSource)) {
    errors.push('desktop market default is not disabled')
  }
  return errors
}

function main() {
  const foundation = loadDesktopFoundation()
  const errors = validateDesktopFoundation(foundation)
  const checkout = process.env.FUTURESTAFF_DESKTOP_SHELL_DIR
  if (checkout) errors.push(...verifyDesktopCheckout(checkout, foundation))

  if (errors.length > 0) {
    for (const error of errors) console.error(`desktop foundation: ${error}`)
    process.exitCode = 1
    return
  }
  console.log(`FutureStaff desktop foundation valid: ${foundation.desktopShell.tag}@${foundation.desktopShell.baseCommit}`)
  console.log(`Controlled fork: ${foundation.desktopShell.repository}`)
  console.log(`Release commit: ${foundation.desktopShell.releaseCommit ?? 'pending local productization'}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
