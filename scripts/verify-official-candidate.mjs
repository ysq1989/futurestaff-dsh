import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const manifest = JSON.parse(readFileSync(new URL('../desktop/official-candidate.json', import.meta.url), 'utf8'))

function git(directory, ...args) {
  return execFileSync('git', ['-C', directory, ...args], { encoding: 'utf8' }).trim()
}

export function verifyOfficialCandidate(repositoryRoot = root, target = manifest) {
  const errors = []
  const source = resolve(repositoryRoot, target.path ?? '')
  if (target.schemaVersion !== 1 || target.status !== 'migration-candidate') errors.push('invalid candidate manifest')
  if (target.repository !== 'https://github.com/deepseek-ai/deepseek-harness.git') errors.push('unexpected upstream repository')
  if (target.tag !== 'dsh-v0.1.7-rc.2' || target.commit !== '477b4f420553e8a52c2fbccc464d7561b239c443') {
    errors.push('official Desktop source is not pinned to the reviewed candidate')
  }
  if (target.path !== 'official-desktop' || relative(repositoryRoot, source) !== target.path) {
    errors.push('candidate path must be the owned official-desktop checkout')
  }
  if (target.productAppId !== 'net.fsstory.agent.desktop' || target.productName !== 'FutureStaff Agent') {
    errors.push('product identity is missing')
  }
  if (errors.length > 0) return errors
  try {
    if (git(repositoryRoot, 'branch', '--show-current') !== 'main') errors.push('product checkout must remain on main')
    if (git(source, 'rev-parse', 'HEAD') !== target.commit) errors.push('official source commit differs from candidate pin')
    if (git(source, 'status', '--porcelain', '--untracked-files=no') !== '') errors.push('official source has tracked modifications')
    if (git(source, 'remote', 'get-url', 'origin') !== target.repository) errors.push('official source origin differs from candidate pin')
    const packageJson = JSON.parse(readFileSync(join(source, 'apps', 'desktop', 'package.json'), 'utf8'))
    if (packageJson.name !== target.desktopPackage || packageJson.version !== target.desktopVersion) {
      errors.push('official Desktop package identity differs from candidate pin')
    }
    const gitlink = git(repositoryRoot, 'ls-files', '--stage', '--', target.path).split(/\s+/u)
    if (gitlink[0] !== '160000' || gitlink[1] !== target.commit) errors.push('product index does not pin the official source')
  } catch (error) {
    errors.push(`cannot verify official Desktop checkout: ${error instanceof Error ? error.message : String(error)}`)
  }
  return errors
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = verifyOfficialCandidate()
  if (errors.length > 0) {
    for (const error of errors) console.error(error)
    process.exitCode = 1
  } else {
    console.log(`Official Desktop candidate pinned: ${manifest.tag}@${manifest.commit}`)
    console.log('Migration candidate only; product packaging and release gates remain closed.')
  }
}
