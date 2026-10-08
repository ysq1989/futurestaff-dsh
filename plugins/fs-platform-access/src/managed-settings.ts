import { FileSettingsProvider } from '@deepseek-ai/dsh-settings-file'

// Product policy, not a Renderer-editable setting. New namespaces require review.
const personalNamespaces = new Set(['ui-theme', 'locale', 'ui-chat', 'ui-conversation', 'ui-onboarding', 'agent-presets'])
export const managedSettingsMessage = '此配置由 FutureStaff 统一管理，不能在 DSH 中修改。'

/** Keep the upstream file/locking lifecycle while making composition authoritative. */
export default class FutureStaffSettings extends FileSettingsProvider {
  protected override publish(document: Record<string, unknown>, source?: Parameters<FileSettingsProvider['publish']>[1]) {
    // Also applies to initial load, hot reload and the pre-write disk reconciliation.
    // Ignored legacy sections stay on disk; a preference write never deletes them.
    super.publish(Object.fromEntries(Object.entries(document).filter(([ns]) => personalNamespaces.has(ns))), source)
  }
  protected override persist(ns: Parameters<FileSettingsProvider['persist']>[0], section: Record<string, unknown>) {
    if (!personalNamespaces.has(ns)) return Promise.reject(new Error(managedSettingsMessage))
    return super.persist(ns, section)
  }
  override describe(options?: Parameters<FileSettingsProvider['describe']>[0]) {
    return super.describe(options).filter(section => personalNamespaces.has(section.ns))
  }
}
