import { createElement } from 'react'
import type { ComponentType } from 'react'

const copy: Readonly<Record<string, string>> = {
  presetStandardName: '普通模式',
  presetStandardDescription: '适合日常问答、查资料和处理文件，推荐使用。',
  presetPtcName: '任务模式',
  presetPtcDescription: '适合批量整理数据、生成报表等需要多个步骤的任务。',
}

interface ModeOption { readonly id: string; readonly trust: string }
interface ModeSnapshot { readonly options: readonly ModeOption[]; readonly current?: string }
const visibleSnapshots = new WeakMap<ModeSnapshot, ModeSnapshot>()

/** Keep platform roles and custom presets; hide developer modes in the new-session picker. */
export function visibleModes(snapshot: ModeSnapshot): ModeSnapshot {
  const cached = visibleSnapshots.get(snapshot)
  if (cached) return cached
  const options = snapshot.options.filter(option => option.trust !== 'system'
    || !['minimal', 'cordis'].includes(option.id) || option.id === snapshot.current)
  // Never mislabel a previously staged mode or alter its actual runtime selection.
  const visible = options.length === snapshot.options.length ? snapshot : { ...snapshot, options }
  visibleSnapshots.set(snapshot, visible)
  return visible
}

export function modePresentation(original: ComponentType<Record<string, unknown>>, picker = false) {
  return function FutureStaffModePresentation(props: Record<string, unknown>) {
    const t = props.t as (key: string, ...args: unknown[]) => unknown
    const useSeat = props.useAgentPresetSeat as ((selector: (snapshot: ModeSnapshot) => unknown) => unknown) | undefined
    return createElement(original, { ...props,
      t: (key: string, ...args: unknown[]) => copy[key] ?? t(key, ...args),
      ...(picker && useSeat ? {
        useAgentPresetSeat: (selector: (snapshot: ModeSnapshot) => unknown) => useSeat(snapshot => selector(visibleModes(snapshot))),
      } : {}),
    })
  }
}
