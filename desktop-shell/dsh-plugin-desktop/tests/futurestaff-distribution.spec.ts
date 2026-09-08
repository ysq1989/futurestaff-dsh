import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  DESKTOP_APP_ID,
  DESKTOP_PRODUCT_NAME,
} from '../src/product-identity.ts'
import { defaultDesktopSetupWizardSettings } from '../src/setup-wizard-settings.ts'

const packageRoot = new URL('../', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('package.json', packageRoot), 'utf8')) as {
  repository?: { url?: string }
  build?: {
    appId?: string
    productName?: string
    win?: { artifactName?: string }
    nsis?: { artifactName?: string; shortcutName?: string }
  }
}
const patch = readFileSync(new URL('cordis.patch.yml', packageRoot), 'utf8')

describe('FutureStaff distribution defaults', () => {
  it('uses an isolated product, package, data, and log identity', () => {
    expect(DESKTOP_PRODUCT_NAME).toBe('FutureStaff Agent')
    expect(DESKTOP_APP_ID).toBe('net.fsstory.agent.desktop')
    expect(manifest.repository?.url).toBe('git+https://github.com/ysq1989/futurestaff-dsh-desktop.git')
    expect(manifest.build?.productName).toBe(DESKTOP_PRODUCT_NAME)
    expect(manifest.build?.appId).toBe(DESKTOP_APP_ID)
    expect(manifest.build?.win?.artifactName).toBe('FutureStaff-Agent-${version}-${arch}-Portable.${ext}')
    expect(manifest.build?.nsis?.artifactName).toBe('FutureStaff-Agent-${version}-${arch}-Setup.${ext}')
    expect(manifest.build?.nsis?.shortcutName).toBe(DESKTOP_PRODUCT_NAME)
  })

  it('starts with third-party updates, markets, and LAN access disabled', () => {
    const defaults = defaultDesktopSetupWizardSettings()
    expect(defaults.openBrowser).toBe(false)
    expect(defaults.networkExposure).toBe('loopback')
    expect(patch).toMatch(/id: desktop-updates[\s\S]*?disabled: true/u)
    expect(patch).toMatch(/id: desktop-updates[\s\S]*?enabled: false/u)
  })
})
