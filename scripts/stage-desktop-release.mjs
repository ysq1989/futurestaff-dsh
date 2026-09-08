import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { stageReleaseProfile } from './stage-release-profile.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function git(checkout, ...args) {
  return execFileSync('git', ['-C', checkout, ...args], { encoding: 'utf8' }).trim()
}

export function validateDesktopPackagingContract(foundation, desktopManifest) {
  const errors = []
  if (desktopManifest.build?.appId !== foundation.product.appId) errors.push('desktop appId mismatch')
  if (desktopManifest.build?.productName !== foundation.product.name) errors.push('desktop productName mismatch')
  const resources = desktopManifest.build?.extraResources
  const profileResource = Array.isArray(resources)
    ? resources.find(item => item?.to === 'futurestaff-profile')
    : undefined
  if (profileResource?.from !== 'build/futurestaff-profile') {
    errors.push('desktop package does not declare the verified FutureStaff Profile resource')
  }
  return errors
}

export async function stageDesktopRelease(options = {}) {
  const foundation = JSON.parse(await readFile(path.join(root, 'desktop', 'foundation.json'), 'utf8'))
  const repositoryRoot = path.resolve(options.repositoryRoot ?? root)
  const checkout = path.join(repositoryRoot, foundation.desktopShell.source.path)
  const branch = git(repositoryRoot, 'branch', '--show-current')
  const status = git(repositoryRoot, 'status', '--porcelain')
  if (branch !== 'main') throw new Error(`product repository must be on main, found ${branch}`)
  if (status !== '') throw new Error('product repository has tracked or untracked changes')

  const gitlink = git(repositoryRoot, 'ls-tree', 'HEAD', 'desktop-shell/deepseek-harness').split(/\s+/u)[2]
  if (gitlink !== foundation.desktopShell.deepseekHarness.commit) {
    throw new Error('official deepseek-harness gitlink does not match the product lock')
  }
  if (git(checkout, '-C', 'deepseek-harness', 'status', '--porcelain') !== '') {
    throw new Error('official deepseek-harness checkout is modified')
  }

  const desktopRoot = path.join(checkout, 'dsh-plugin-desktop')
  const desktopManifest = JSON.parse(await readFile(path.join(desktopRoot, 'package.json'), 'utf8'))
  const contractErrors = validateDesktopPackagingContract(foundation, desktopManifest)
  if (contractErrors.length > 0) throw new Error(contractErrors.join('; '))

  const outputRoot = path.join(desktopRoot, 'build', 'futurestaff-profile')
  const result = await stageReleaseProfile({ sourceRoot: root, outputRoot })
  console.log(`Staged verified FutureStaff desktop resource at ${result.target}`)
  return { checkout, outputRoot, profile: result.target }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await stageDesktopRelease()
}
