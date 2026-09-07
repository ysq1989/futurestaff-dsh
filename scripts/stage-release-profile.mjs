import { createHash } from 'node:crypto'
import { cp, lstat, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultOutput = path.join(scriptRoot, 'dist', 'desktop-profile')
const profileName = 'futurestaff-alpha'
const packages = ['fs-core', 'fs-platform-access']

function releasePackageManifest(source) {
  const keys = ['name', 'version', 'type', 'main', 'types', 'exports', 'dsh', 'peerDependencies']
  return Object.fromEntries(keys.filter(key => source[key] !== undefined).map(key => [key, source[key]]))
}

async function walkFiles(root, current = root) {
  const files = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name)
    const relative = path.relative(root, absolute).replaceAll('\\', '/')
    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) throw new Error(`release Profile cannot contain a symbolic link: ${relative}`)
    if (stats.isDirectory()) files.push(...await walkFiles(root, absolute))
    else if (stats.isFile()) files.push(relative)
    else throw new Error(`release Profile contains an unsupported filesystem entry: ${relative}`)
  }
  return files.sort()
}

async function sha256(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex')
}

export async function verifyReleaseProfile(outputRoot, sourceRoot = scriptRoot) {
  const target = path.join(outputRoot, 'profiles', profileName)
  const files = await walkFiles(target)
  const required = [
    'cordis.patch.yml',
    'package.json',
    'node_modules/@futurestaff/fs-core/package.json',
    'node_modules/@futurestaff/fs-platform-access/package.json',
  ]
  for (const relative of required) {
    if (!files.includes(relative)) throw new Error(`release Profile is missing ${relative}`)
  }
  if (files.some(file => /\/(?:src|test)\//u.test(`/${file}/`) || file.endsWith('/tsconfig.json'))) {
    throw new Error('release Profile contains development source, tests, or TypeScript configuration')
  }
  const sourceMarkers = [path.resolve(sourceRoot), path.resolve(sourceRoot).replaceAll('\\', '/')]
  for (const relative of files.filter(file => /\.(?:json|ya?ml|js|d\.ts)$/u.test(file))) {
    const contents = await readFile(path.join(target, relative), 'utf8')
    if (sourceMarkers.some(marker => contents.includes(marker))) {
      throw new Error(`release Profile contains a source-tree absolute path in ${relative}`)
    }
  }
  return files
}

export async function stageReleaseProfile(options = {}) {
  const sourceRoot = path.resolve(options.sourceRoot ?? scriptRoot)
  const outputRoot = path.resolve(options.outputRoot ?? defaultOutput)
  const profileSource = path.join(sourceRoot, 'profile', profileName)
  const target = path.join(outputRoot, 'profiles', profileName)
  await rm(outputRoot, { recursive: true, force: true })
  await mkdir(path.join(target, 'node_modules', '@futurestaff'), { recursive: true })
  await cp(path.join(profileSource, 'cordis.patch.yml'), path.join(target, 'cordis.patch.yml'))

  const dependencyVersions = {}
  for (const packageName of packages) {
    const packageRoot = path.join(sourceRoot, 'plugins', packageName)
    const sourceManifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'))
    if (typeof sourceManifest.version !== 'string') throw new Error(`${packageName} has no exact version`)
    dependencyVersions[sourceManifest.name] = sourceManifest.version
    const packageTarget = path.join(target, 'node_modules', '@futurestaff', packageName)
    await mkdir(packageTarget, { recursive: true })
    await cp(path.join(packageRoot, 'lib'), path.join(packageTarget, 'lib'), { recursive: true })
    await writeFile(
      path.join(packageTarget, 'package.json'),
      `${JSON.stringify(releasePackageManifest(sourceManifest), null, 2)}\n`,
    )
  }

  const profileManifest = JSON.parse(await readFile(path.join(profileSource, 'package.json'), 'utf8'))
  profileManifest.dependencies = dependencyVersions
  await writeFile(path.join(target, 'package.json'), `${JSON.stringify(profileManifest, null, 2)}\n`)

  const files = await verifyReleaseProfile(outputRoot, sourceRoot)
  const fileHashes = {}
  for (const relative of files) fileHashes[relative] = await sha256(path.join(target, relative))
  const foundation = JSON.parse(await readFile(path.join(sourceRoot, 'desktop', 'foundation.json'), 'utf8'))
  const releaseManifest = {
    schemaVersion: 1,
    profile: profileName,
    productVersion: profileManifest.version,
    dshVersion: '0.1.2-rc.1',
    platformContract: foundation.platformContract,
    files: fileHashes,
  }
  await writeFile(path.join(target, 'release-manifest.json'), `${JSON.stringify(releaseManifest, null, 2)}\n`)
  await verifyReleaseProfile(outputRoot, sourceRoot)
  return { outputRoot, target, releaseManifest }
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await stageReleaseProfile()
  console.log(`Staged relocatable ${profileName} Profile at ${result.target}`)
}
