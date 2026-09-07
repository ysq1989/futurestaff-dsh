import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  applyBundledFutureStaffBootstrapIdentity,
  installBundledFutureStaffProfile,
} from '../src/futurestaff-profile.ts'
import { readDesktopProfileState } from '../src/profile-manager.ts'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'futurestaff-bundled-profile-'))
  const resourcesPath = join(root, 'resources')
  const source = join(resourcesPath, 'futurestaff-profile', 'profiles', 'futurestaff-alpha')
  const homeDir = join(root, 'home')
  const selectionStatePath = join(root, 'user-data', 'profile-selection', 'state.json')
  mkdirSync(source, { recursive: true })
  mkdirSync(join(source, 'node_modules'), { recursive: true })
  const files: Record<string, string> = {
    'package.json': JSON.stringify({
      name: '@futurestaff/profile-alpha',
      dsh: { profile: { bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'] } },
    }) + '\n',
    'cordis.patch.yml': '- insert: []\n',
    'pnpm-workspace.yaml': 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\nvirtualStoreDirMaxLength: 60\n',
    'pnpm-lock.yaml': "lockfileVersion: '9.0'\n\nsettings:\n  autoInstallPeers: false\n",
    'node_modules/.modules.yaml': 'nodeLinker: hoisted\npackageManager: pnpm@11.8.0\nvirtualStoreDirMaxLength: 60\n',
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
  it('owns an explicit non-authoritative bootstrap identity for the product Profile', () => {
    const environment: NodeJS.ProcessEnv = {
      FUTURESTAFF_IDENTITY_MODE: 'request-scoped',
      FUTURESTAFF_TENANT_ID: 'caller-controlled-tenant',
      FUTURESTAFF_USER_ID: 'caller-controlled-user',
    }
    expect(applyBundledFutureStaffBootstrapIdentity('futurestaff-alpha', environment)).toBe(true)
    expect(environment).toMatchObject({
      FUTURESTAFF_IDENTITY_MODE: 'single-subject',
      FUTURESTAFF_TENANT_ID: 'futurestaff-desktop-bootstrap-tenant',
      FUTURESTAFF_USER_ID: 'futurestaff-desktop-bootstrap-user',
    })

    const unrelated = { FUTURESTAFF_IDENTITY_MODE: 'request-scoped' }
    expect(applyBundledFutureStaffBootstrapIdentity('desktop', unrelated)).toBe(false)
    expect(unrelated.FUTURESTAFF_IDENTITY_MODE).toBe('request-scoped')
  })

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

  it('repairs the verified legacy bundled Profile left by the first-launch packaging defect', () => {
    const value = fixture()
    expect(installBundledFutureStaffProfile(value)).toBe('installed')
    const target = join(value.homeDir, 'profiles', 'futurestaff-alpha')
    const manifestPath = join(target, 'release-manifest.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { files: Record<string, string> }
    for (const relative of ['pnpm-workspace.yaml', 'pnpm-lock.yaml', 'node_modules/.modules.yaml']) {
      rmSync(join(target, relative), { force: true })
      delete manifest.files[relative]
    }
    writeFileSync(manifestPath, JSON.stringify(manifest) + '\n')
    writeFileSync(join(target, 'cordis.yml'), '[]\n')
    writeFileSync(join(target, 'pnpm-workspace.yaml'), 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n')

    expect(installBundledFutureStaffProfile(value)).toBe('repaired')
    expect(readFileSync(join(target, 'node_modules', '.modules.yaml'), 'utf8'))
      .toContain('packageManager: pnpm@11.8.0')
  })

  it('preserves a legacy bundled Profile when a managed file was changed', () => {
    const value = fixture()
    expect(installBundledFutureStaffProfile(value)).toBe('installed')
    const target = join(value.homeDir, 'profiles', 'futurestaff-alpha')
    writeFileSync(join(target, 'cordis.patch.yml'), '- user-change: true\n')

    expect(installBundledFutureStaffProfile(value)).toBe('preserved')
    expect(readFileSync(join(target, 'cordis.patch.yml'), 'utf8')).toBe('- user-change: true\n')
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
