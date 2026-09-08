import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { describe, expect, it } from 'vitest'

describe('Windows assisted installer messages', () => {
  it('sets a clearer message for the slow install stage', () => {
    const messages = parse(readFileSync(join(process.cwd(), 'build', 'assistedMessages.yml'), 'utf8')) as {
      installing?: Record<string, string>
      futurestaffWelcomeTitle?: Record<string, string>
      futurestaffReviewSecurity?: Record<string, string>
    }

    expect(messages.installing?.zh_CN).toBe('FutureStaff Agent 正在安装，可能需要几分钟；请保持此窗口打开。')
    expect(messages.installing?.en).toContain('This may take several minutes')
    expect(messages.futurestaffWelcomeTitle?.zh_CN).toContain('AI 工作伙伴')
    expect(messages.futurestaffReviewSecurity?.en).toContain('Windows-protected sign-in')

    const installedMessages = parse(readFileSync(
      join(process.cwd(), 'node_modules', 'app-builder-lib', 'templates', 'nsis', 'messages.yml'),
      'utf8',
    )) as { installing?: Record<string, string> }
    expect(installedMessages.installing?.en).toContain('Installing FutureStaff Agent')
    expect(installedMessages.installing?.zh_CN).toContain('FutureStaff Agent 正在安装')
    expect(installedMessages.installing?.zh_TW).toContain('FutureStaff Agent 正在安裝')
  })
})
