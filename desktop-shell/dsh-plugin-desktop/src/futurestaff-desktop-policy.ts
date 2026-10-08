/** Product-owned preferences; clients and persisted profile files are not policy authority. */
import { DESKTOP_APP_ID } from './product-identity.ts'
import type { DesktopSetupWizardSelection } from './setup-wizard-contract.ts'

export const FUTURESTAFF_MANAGED_DESKTOP = String(DESKTOP_APP_ID) === 'net.fsstory.agent.desktop'

export function futureStaffDesktopPolicy(platform: string, safeMode = false): DesktopSetupWizardSelection | undefined {
  if (!FUTURESTAFF_MANAGED_DESKTOP) return undefined
  return Object.freeze({
    mode: safeMode || platform === 'linux' ? 'compatibility' : 'advanced',
    macosMaterial: safeMode ? 'off' : 'transparent',
    windowsMaterial: safeMode ? 'off' : 'mica',
    openBrowser: false, networkExposure: 'loopback', market: 'disabled',
    notifications: Object.freeze({ enabled: !safeMode, notifyOnTurnCompletion: !safeMode,
      notifyOnTurnFailure: !safeMode, notifyOnJobCompletion: !safeMode, notifyOnJobFailure: !safeMode }),
  })
}

export function assertDesktopPolicy(value: object, expected: object): void {
  for (const [key, fixed] of Object.entries(expected)) {
    if (key === 'market' || key === 'notifications') continue
    if ((value as Record<string, unknown>)[key] !== fixed) throw new Error('FUTURESTAFF_DESKTOP_PREFERENCE_MANAGED')
  }
}

export function assertNotificationPolicy(value: object, expected: object): void {
  for (const [key, fixed] of Object.entries(expected)) {
    if ((value as Record<string, unknown>)[key] !== fixed) throw new Error('FUTURESTAFF_NOTIFICATION_PREFERENCE_MANAGED')
  }
}
