export interface FutureStaffIdentity {
  readonly tenantId: string
  readonly userId: string
  readonly deviceId?: string
}

export interface FutureStaffContext {
  current(): FutureStaffIdentity
}

export type ToolMetadata =
  | {
      readonly execution: 'cloud'
      readonly requiresApproval: boolean
      readonly tenantScoped: boolean
      readonly deviceId?: never
    }
  | {
      readonly execution: 'local'
      readonly requiresApproval: boolean
      readonly tenantScoped: boolean
      readonly deviceId: string
    }

function requiredIdentifier(name: string, value: string | undefined): string {
  const normalized = value?.trim()
  if (!normalized) throw new Error(`${name} must be a non-empty string`)
  return normalized
}

export function createIdentityContext(defaults: FutureStaffIdentity): FutureStaffContext {
  const base = Object.freeze({
    tenantId: requiredIdentifier('tenantId', defaults.tenantId),
    userId: requiredIdentifier('userId', defaults.userId),
    ...(defaults.deviceId === undefined ? {} : { deviceId: requiredIdentifier('deviceId', defaults.deviceId) }),
  })

  return Object.freeze({
    current(): FutureStaffIdentity { return base },
  })
}

export function defineToolMetadata(metadata: ToolMetadata): Readonly<ToolMetadata> {
  if (metadata.execution === 'local') {
    requiredIdentifier('deviceId', metadata.deviceId)
    if (!metadata.requiresApproval) throw new Error('local Tools must require approval')
  } else if ('deviceId' in metadata && metadata.deviceId !== undefined) {
    throw new Error('cloud Tool metadata cannot declare deviceId')
  }
  return Object.freeze({ ...metadata })
}
