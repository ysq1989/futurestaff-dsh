export interface TenantIsolationBoundary {
  abortRequests(): void | Promise<void>
  clearRequestCache(): void | Promise<void>
  clearWorkspace(): void | Promise<void>
  clearApplicationCredentials(): void | Promise<void>
}

export class InMemoryTenantResources implements TenantIsolationBoundary {
  readonly requests = new Set<AbortController>()
  readonly requestCache = new Map<string, unknown>()
  readonly workspace = new Map<string, unknown>()
  readonly applicationCredentials = new Map<string, string>()

  abortRequests(): void {
    for (const request of this.requests) request.abort()
    this.requests.clear()
  }

  clearRequestCache(): void { this.requestCache.clear() }
  clearWorkspace(): void { this.workspace.clear() }
  clearApplicationCredentials(): void { this.applicationCredentials.clear() }
}

export async function clearTenantBoundary(boundary: TenantIsolationBoundary): Promise<void> {
  await boundary.abortRequests()
  await boundary.clearRequestCache()
  await boundary.clearWorkspace()
  await boundary.clearApplicationCredentials()
}
