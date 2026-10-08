import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  DesktopDialogToneIcon,
  desktopDialogAdvisoryLines,
  desktopDialogButtonClassName,
  desktopDialogShowsToneIcon,
} from '../src/native-ui/desktop-dialog/App.tsx'
import { DesktopUpdateDialog } from '../src/native-ui/desktop-dialog/UpdateDialog.tsx'

describe('Desktop dialog native UI', () => {
  it('emphasizes update while keeping Later focused and original response indices intact', () => {
    const responses: number[] = []
    const view = DesktopUpdateDialog({ state: {
      message: '新版本已准备好', updateVersion: '2.0.21', detail: '<script>not executed</script>',
      advisory: '请先保存当前工作。', buttons: ['重启并更新', '稍后'], primaryId: 0, defaultId: 1, cancelId: 1,
    }, respond: index => { responses.push(index) } })
    const actions = view.props.children.at(-1).props.children
    expect(actions.map((action: { props: { children: unknown[] } }) => action.props.children.at(-1))).toEqual(['稍后', '重启并更新'])
    expect(actions[0].props.autoFocus).toBe(true)
    expect(actions[0].props.variant).toBe('outline')
    expect(actions[1].props.autoFocus).toBe(false)
    expect(actions[1].props.variant).toBe('default')
    actions[0].props.onClick(); actions[1].props.onClick()
    expect(responses).toEqual([1, 0])
    const html = renderToStaticMarkup(view)
    expect(html).toContain('v2.0.21')
    expect(html).toContain('&lt;script&gt;not executed&lt;/script&gt;')
    expect(html).not.toContain('<script>')
  })
  it('omits the leading tone icon for the centered Profile compatibility surface', () => {
    expect(desktopDialogShowsToneIcon('profile-compatibility')).toBe(false)
    expect(desktopDialogShowsToneIcon('default')).toBe(true)
    expect(desktopDialogButtonClassName('profile-compatibility', 0)).toBe('mr-auto')
    expect(desktopDialogButtonClassName('profile-compatibility', 1)).toBeUndefined()
    expect(renderToStaticMarkup(createElement(DesktopDialogToneIcon, {
      type: 'warning',
    }))).toContain('<svg')
  })

  it('renders each compatibility advisory line as its own block', () => {
    expect(desktopDialogAdvisoryLines('Summary:\n1. First\n2. Second\nRecommendation')).toEqual([
      'Summary:',
      '1. First',
      '2. Second',
      'Recommendation',
    ])
  })

})
