/** Install the immutable FutureStaff product Profile shipped beside the app archive. */

import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { selectDesktopProfile } from './profile-manager.ts'

const PROFILE_NAME = 'futurestaff-alpha'
const PROFILE_RESOURCE_DIRECTORY = 'futurestaff-profile'
const RELEASE_MANIFEST = 'release-manifest.json'
const EXPECTED_SCHEMA_VERSION = 1
const EXPECTED_PRODUCT_VERSION = '0.1.0'
const EXPECTED_DSH_VERSION = '0.1.2-rc.1'
const MAX_MANIFEST_BYTES = 1024 * 1024
const MAX_PROFILE_FILES = 256

interface ReleaseManifest {
  readonly schemaVersion: number
  readonly profile: string
  readonly productVersion: string
  readonly dshVersion: string
  readonly files: Record<string, string>
}

export interface BundledFutureStaffProfileOptions {
  readonly resourcesPath: string
  readonly homeDir: string
  readonly selectionStatePath: string
}

export type BundledFutureStaffProfileResult = 'absent' | 'installed' | 'preserved'

function safeRelativePath(value: string): boolean {
  if (value.length === 0 || value.includes('\\') || isAbsolute(value)) return false
  const parts = value.split('/')
  return parts.every(part => part.length > 0 && part !== '.' && part !== '..')
}

function readManifest(source: string): ReleaseManifest {
  const path = join(source, RELEASE_MANIFEST)
  const stats = lstatSync(path)
  if (!stats.isFile() || stats.isSymbolicLink() || stats.size > MAX_MANIFEST_BYTES) {
    throw new Error('FutureStaff release Profile manifest is unsafe')
  }
  const value = JSON.parse(readFileSync(path, 'utf8')) as Partial<ReleaseManifest>
  if (value.schemaVersion !== EXPECTED_SCHEMA_VERSION
    || value.profile !== PROFILE_NAME
    || value.productVersion !== EXPECTED_PRODUCT_VERSION
    || value.dshVersion !== EXPECTED_DSH_VERSION
    || value.files === null || typeof value.files !== 'object' || Array.isArray(value.files)) {
    throw new Error('FutureStaff release Profile manifest is incompatible')
  }
  const entries = Object.entries(value.files)
  if (entries.length === 0 || entries.length > MAX_PROFILE_FILES
    || entries.some(([name, digest]) => !safeRelativePath(name) || !/^[0-9a-f]{64}$/u.test(digest))) {
    throw new Error('FutureStaff release Profile file inventory is invalid')
  }
  return value as ReleaseManifest
}

function inventory(root: string, current = root): string[] {
  const files: string[] = []
  for (const entry of readdirSync(current, { withFileTypes: true })) {
    const absolute = join(current, entry.name)
    const stats = lstatSync(absolute)
    const item = relative(root, absolute).split(sep).join('/')
    if (stats.isSymbolicLink()) throw new Error(`FutureStaff release Profile contains a link: ${item}`)
    if (stats.isDirectory()) files.push(...inventory(root, absolute))
    else if (stats.isFile()) files.push(item)
    else throw new Error(`FutureStaff release Profile contains an unsupported entry: ${item}`)
  }
  return files.sort()
}

function verifySource(source: string): ReleaseManifest {
  const root = lstatSync(source)
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('FutureStaff release Profile root is unsafe')
  const manifest = readManifest(source)
  const actual = inventory(source).filter(file => file !== RELEASE_MANIFEST)
  const expected = Object.keys(manifest.files).sort()
  if (actual.length !== expected.length || actual.some((file, index) => file !== expected[index])) {
    throw new Error('FutureStaff release Profile contents do not match its manifest')
  }
  for (const relativePath of actual) {
    const digest = createHash('sha256').update(readFileSync(join(source, relativePath))).digest('hex')
    if (digest !== manifest.files[relativePath]) {
      throw new Error(`FutureStaff release Profile digest mismatch: ${relativePath}`)
    }
  }
  return manifest
}

function copyVerifiedTree(source: string, target: string): void {
  mkdirSync(target, { recursive: false, mode: 0o700 })
  for (const relativePath of inventory(source)) {
    const sourcePath = join(source, relativePath)
    const targetPath = join(target, relativePath)
    mkdirSync(dirname(targetPath), { recursive: true, mode: 0o700 })
    copyFileSync(sourcePath, targetPath)
  }
}

/**
 * Install and select the bundled Profile only for a fresh desktop selection.
 * Existing Profile data and selection state are never overwritten.
 */
export function installBundledFutureStaffProfile(
  options: BundledFutureStaffProfileOptions,
): BundledFutureStaffProfileResult {
  const source = resolve(options.resourcesPath, PROFILE_RESOURCE_DIRECTORY, 'profiles', PROFILE_NAME)
  if (!existsSync(source)) return 'absent'
  verifySource(source)

  const target = resolve(options.homeDir, 'profiles', PROFILE_NAME)
  if (existsSync(target)) return 'preserved'
  const profilesDir = dirname(target)
  mkdirSync(profilesDir, { recursive: true, mode: 0o700 })
  const staging = join(profilesDir, `.${basename(target)}.creating-${process.pid}-${randomUUID()}`)
  try {
    copyVerifiedTree(source, staging)
    verifySource(staging)
    if (existsSync(target)) throw new Error('FutureStaff release Profile appeared during installation')
    renameSync(staging, target)
    if (!existsSync(options.selectionStatePath)) {
      selectDesktopProfile(options.selectionStatePath, options.homeDir, PROFILE_NAME)
    }
    return 'installed'
  } catch (cause) {
    rmSync(staging, { recursive: true, force: true })
    throw cause
  }
}
