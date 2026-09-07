import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { installBundledFutureStaffProfile } from '../src/futurestaff-profile.ts'
import { readDesktopProfileState } from '../src/profile-manager.ts'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'futurestaff-bundled-profile-'))
  const resourcesPath = join(root, 'resources')
  const source = join(resourcesPath, 'futurestaff-profile', 'profiles', 'futurestaff-alpha')
  const homeDir = join(root, 'home')
  const selectionStatePath = join(root, 'user-data', 'profile-selection', 'state.json')
  mkdirSync(source, { recursive: true })
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: '@futurestaff/profile-alpha',
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
    }) + '\n',
    'cordis.patch.yml': '- insert: []\n',
  }
  const hashes: Record<string, string> = {}
  for (const [name, contents] of Object.entries(files)) {
    writeFileSync(join(source, name), contents)
    hashes[name] = createHash('sha256').update(contents).digest('hex')
  }
  writeFileSync(join(source, 'release-manifest.json'), JSON.stringify({
    schemaVersion: 1,
    profile: 'futurestaff-alpha',
    productVersion: '0.1.0',
    dshVersion: '0.1.2-rc.1',
    files: hashes,
  }) + '\n')
  return { root, resourcesPath, source, homeDir, selectionStatePath }
}

describe('bundled FutureStaff Profile', () => {
  it('atomically installs and selects a verified Profile on first launch', () => {
    const value = fixture()
    expect(installBundledFutureStaffProfile(value)).toBe('installed')
    expect(readFileSync(join(value.homeDir, 'profiles', 'futurestaff-alpha', 'cordis.patch.yml'), 'utf8'))
      .toBe('- insert: []\n')
    expect(readDesktopProfileState(value.selectionStatePath)).toEqual({
      version: 2,
      active: 'futurestaff-alpha',
    })
  })

  it('preserves an existing Profile and selection state', () => {
    const value = fixture()
    const target = join(value.homeDir, 'profiles', 'futurestaff-alpha')
    mkdirSync(target, { recursive: true })
    writeFileSync(join(target, 'keep.txt'), 'user-owned\n')
    expect(installBundledFutureStaffProfile(value)).toBe('preserved')
    expect(readFileSync(join(target, 'keep.txt'), 'utf8')).toBe('user-owned\n')
  })

  it('rejects a modified bundled file before writing user data', () => {
    const value = fixture()
    writeFileSync(join(value.source, 'cordis.patch.yml'), '- changed: true\n')
    expect(() => installBundledFutureStaffProfile(value)).toThrow('digest mismatch')
  })

  it('is inactive when no product Profile resource is packaged', () => {
    const root = mkdtempSync(join(tmpdir(), 'futurestaff-no-profile-'))
    expect(installBundledFutureStaffProfile({
      resourcesPath: join(root, 'resources'),
      homeDir: join(root, 'home'),
      selectionStatePath: join(root, 'state.json'),
    })).toBe('absent')
  })
})
