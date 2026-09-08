import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DESKTOP_INSTALLER_QUIT_FLAG } from '../src/desktop-installer-quit.ts'

describe('Windows NSIS running-app handoff', () => {
  it('ships a branded welcome page, review page, and correctly sized artwork', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')
    const sidebar = readFileSync(join(process.cwd(), 'build', 'installerSidebar.bmp'))
    const header = readFileSync(join(process.cwd(), 'build', 'installerHeader.bmp'))
    const headerPixelOffset = header.readUInt32LE(10)
    const headerRowStride = (150 * 3 + 3) & ~3
    let highlightedHeaderPixels = 0
    for (let y = 0; y < 57; y += 1) {
      for (let x = 75; x < 150; x += 1) {
        const offset = headerPixelOffset + y * headerRowStride + x * 3
        if (Math.max(header[offset] ?? 0, header[offset + 1] ?? 0, header[offset + 2] ?? 0) >= 128) {
          highlightedHeaderPixels += 1
        }
      }
    }

    expect(script).toContain('!macro customWelcomePage')
    expect(script).toContain('LangString futurestaffWelcomeTitle 1033')
    expect(script).toContain('LangString futurestaffWelcomeTitle 2052')
    expect(script).toContain('LangString futurestaffWelcomeTitle 1028')
    expect(script).toContain('!macro customPageAfterChangeDir')
    expect(script).toContain('nsDialogs::Create 1018')
    expect(script).toContain('nsDialogs::CreateControl STATIC')
    expect(script).not.toContain('!include nsDialogs.nsh')
    expect(script).toContain('StrCmp $futurestaffReviewDialog error')
    expect(script).toContain('GetDlgItem $0 $HWNDPARENT 1037')
    expect(script).toContain('GetDlgItem $0 $HWNDPARENT 1038')
    expect(script).not.toContain('MUI_HEADER_TEXT')
    expect(script).toContain('$INSTDIR')
    expect(sidebar.readInt32LE(18)).toBe(164)
    expect(sidebar.readInt32LE(22)).toBe(314)
    expect(sidebar.readUInt16LE(28)).toBe(24)
    expect(sidebar.readUInt32LE(30)).toBe(0)
    expect(header.readInt32LE(18)).toBe(150)
    expect(header.readInt32LE(22)).toBe(57)
    expect(header.readUInt16LE(28)).toBe(24)
    expect(header.readUInt32LE(30)).toBe(0)
    expect(highlightedHeaderPixels).toBeGreaterThan(100)
  })

  it('checks for the exact app before requesting orderly shutdown', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')
    const firstDetection = script.indexOf('!insertmacro FIND_PROCESS')
    const request = script.indexOf(DESKTOP_INSTALLER_QUIT_FLAG)
    const wait = script.indexOf('dsh_installer_wait_for_exit:')
    const fallback = script.indexOf('dsh_installer_scoped_fallback:')

    expect(script).toContain('!macro customCheckAppRunning')
    expect(script).toContain('Var pid')
    expect(script).toContain('ExecWait')
    expect(script).toContain('$INSTDIR\\${APP_EXECUTABLE_FILENAME}')
    expect(script).toContain('!insertmacro IS_POWERSHELL_AVAILABLE')
    expect(firstDetection).toBeGreaterThanOrEqual(0)
    expect(request).toBeGreaterThan(firstDetection)
    expect(wait).toBeGreaterThan(request)
    expect(fallback).toBeGreaterThan(wait)
  })

  it('waits for graceful disposal before using the scoped builder fallback', () => {
    const script = readFileSync(join(process.cwd(), 'build', 'installer.nsh'), 'utf8')

    expect(script).toContain('$R1 < 60')
    expect(script).toContain('Sleep 500')
    expect(script).toContain('!insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 0')
    expect(script).toContain('!insertmacro KILL_PROCESS "${APP_EXECUTABLE_FILENAME}" 1')
    expect(script).not.toContain('taskkill')
    expect(script).not.toContain('nsProcess::KillProcess')
    expect(script).not.toContain('getProcessInfo.nsh')
  })
})
