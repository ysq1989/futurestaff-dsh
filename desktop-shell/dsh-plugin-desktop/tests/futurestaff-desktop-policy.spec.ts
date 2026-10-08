import { describe, expect, it } from 'vitest'
import { futureStaffDesktopPolicy } from '../src/futurestaff-desktop-policy.ts'

describe('FutureStaff managed desktop policy', () => {
  it('fixes the selected configuration without depending on a profile name', () => {
    expect(futureStaffDesktopPolicy('win32')).toEqual({
      mode: 'advanced', macosMaterial: 'transparent', windowsMaterial: 'mica',
      openBrowser: false, networkExposure: 'loopback', market: 'disabled',
      notifications: { enabled: true, notifyOnTurnCompletion: true, notifyOnTurnFailure: true,
        notifyOnJobCompletion: true, notifyOnJobFailure: true },
    })
  })

  it('preserves recovery defaults and Linux compatibility', () => {
    const recovery = futureStaffDesktopPolicy('win32', true)!
    expect(recovery).toMatchObject({ mode: 'compatibility', windowsMaterial: 'off',
      macosMaterial: 'off', openBrowser: false, networkExposure: 'loopback', market: 'disabled' })
    expect(Object.values(recovery.notifications)).toEqual([false, false, false, false, false])
    expect(futureStaffDesktopPolicy('linux')!.mode).toBe('compatibility')
  })
})
