import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'

type Slots = Context['slots']
type SlotName = Parameters<Slots['entries']>[0]
type Entry = ReturnType<Slots['entries']>[number]

/** Declarations precede occupants. Follow registration changes for the whole declaration lifetime. */
export function watchSlotComponents(
  slots: Slots,
  name: SlotName,
  matches: (entry: Entry) => boolean,
  wrap: (component: unknown) => unknown,
): () => void {
  const decorated = new Map<Entry, { original: unknown; replacement: unknown }>()
  let stopped = false
  const reconcile = () => {
    if (stopped) return
    const entries = slots.entries(name)
    for (const [entry, value] of decorated) {
      if (entries.includes(entry)) continue
      if (entry.component === value.replacement) entry.component = value.original
      decorated.delete(entry)
    }
    let changed: Entry | undefined
    for (const entry of entries) {
      if (!matches(entry) || decorated.has(entry)) continue
      const original = entry.component, replacement = wrap(original)
      decorated.set(entry, { original, replacement })
      entry.component = replacement
      changed = entry
    }
    if (!changed) return
    // The component is on the pinned ledger entry. Pulse a losing registration
    // so already-mounted native outlets see a new version without redeclaring children.
    const priority = Math.max(0, ...entries.map(entry => entry.options.priority ?? 0)) + 1
    const register = slots.register as (options: object, component: () => null) => () => void
    const dispose = register.call(slots, { ...changed.options, name, priority }, () => null)
    dispose()
  }
  const unsubscribe = slots.subscribe(name, reconcile)
  reconcile()
  return () => {
    stopped = true
    unsubscribe()
    for (const [entry, value] of decorated) {
      if (entry.component === value.replacement) entry.component = value.original
    }
    decorated.clear()
  }
}
