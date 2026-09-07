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
  const platformContract = isRecord(value?.platformContract) ? value.platformContract : {}
  const mockContract = isRecord(platformContract.mock) ? platformContract.mock : {}
  const devContract = isRecord(platformContract.dev) ? platformContract.dev : {}

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
  if (mockContract.mode !== 'local-mock') errors.push('A01 Mock mode must remain local-mock')
  if (mockContract.version !== '0.1.0') errors.push('A01 Mock contract version must remain 0.1.0')
  if (mockContract.platformCommit !== '93ca162566225894a8cd317b7bc51b096d16a0ec') {
    errors.push('platform contract commit does not match the A01b handoff')
  }
  if (mockContract.bundleSha256 !== '5ae4e07157b5c7c1b8007f514d47cc0bb05734841341f59c44c37a978b7f9fe9') {
    errors.push('platform contract bundle digest does not match the A01b handoff')
  }
  if (mockContract.baseUrl !== 'http://127.0.0.1:43821') errors.push('platform mock must use the fixed loopback endpoint')
  if (mockContract.clientId !== 'futurestaff-agent-pc-dev') errors.push('platform mock client ID is incorrect')
  if (devContract.mode !== 'platform-dev' || devContract.version !== '0.1.1' || devContract.status !== 'deployed-platform-dev') {
    errors.push('A02 DEV contract identity is incorrect')
  }
  if (devContract.platformCommit !== 'd789faceb7971deb111fec3e4948237d21e81346'
    || devContract.handoffCommit !== '2c31ed720d8f9ee4fd8087f758c928ea5f8c0ac2'
    || devContract.bundleSha256 !== '9921cc5084925ceea4e6e9d224e5434d4af294974a736a300ed34c73d2950687') {
    errors.push('A02 DEV contract provenance does not match the published handoff')
  }
  if (devContract.authorizationUrl !== 'https://dev.fsstory.net/login'
    || devContract.baseUrl !== 'https://dev.fsstory.net') {
    errors.push('A02 DEV coordinates must use the root-level dev.fsstory.net origin')
  }
  if (devContract.callbackUrl !== 'http://127.0.0.1:43821/callback'
    || devContract.clientId !== 'futurestaff-agent-pc-dev'
    || devContract.pkceMethod !== 'S256') {
    errors.push('A02 native client coordinates do not match the handoff')
  }
  if (devContract.productionEnabled !== false) errors.push('A02 pin must not enable PROD')

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
