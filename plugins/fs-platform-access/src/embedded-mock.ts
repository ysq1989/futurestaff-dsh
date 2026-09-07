import { PLATFORM_CLIENT_ID, PLATFORM_CONTRACT_VERSION, type PlatformErrorCode } from './contracts.js'

const TENANT_A = '10000000-0000-4000-8000-000000000001'
const TENANT_B = '10000000-0000-4000-8000-000000000002'
const meta = Object.freeze({ contractVersion: PLATFORM_CONTRACT_VERSION, simulated: true as const })
const tenants = Object.freeze([
  Object.freeze({ tenantId: TENANT_A, displayName: '模拟甲公司', slug: 'mock-company-a', logoUrl: null, role: 'member' }),
  Object.freeze({ tenantId: TENANT_B, displayName: '模拟乙公司', slug: 'mock-company-b', logoUrl: null, role: 'org_admin' }),
])
const applications = Object.freeze([
  Object.freeze({
    appId: 'agent', tenantId: TENANT_A, displayName: 'FutureStaff Agent', baseUrl: 'https://agent-dev.fsstory.net',
    deepLinks: Object.freeze({ home: '/', settings: '/settings' }), capabilities: Object.freeze(['agent.read']),
    contractRange: '>=0.1.0 <0.2.0',
  }),
  Object.freeze({
    appId: 'product_hub', tenantId: TENANT_A, displayName: '未来市集', baseUrl: 'https://product-dev.fsstory.net',
    deepLinks: Object.freeze({ home: '/product-hub', settings: '/product-hub/settings' }),
    capabilities: Object.freeze(['product_hub.read']), contractRange: '>=0.1.0 <0.2.0',
  }),
])

export interface EmbeddedMockResult {
  readonly status: number
  readonly body: unknown
}

function error(status: number, code: PlatformErrorCode, message: string, requestId: string): EmbeddedMockResult {
  return { status, body: { error: { code, message, retryable: false }, meta: { ...meta, requestId } } }
}

function bearer(headers: Readonly<Record<string, string | string[] | undefined>>): string | undefined {
  const value = headers.authorization
  return typeof value === 'string' && value.startsWith('Bearer ') ? value.slice(7) : undefined
}

function authorize(headers: Readonly<Record<string, string | string[] | undefined>>) {
  const token = bearer(headers)
  if (token === undefined) return { error: error(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.', 'mock-request-auth-required') }
  if (token === 'mock-access-wrong-audience') return { error: error(401, 'TOKEN_AUDIENCE_INVALID', 'The token is not valid for this desktop client.', 'mock-request-wrong-audience') }
  if (token === 'mock-access-expired') return { error: error(401, 'TOKEN_EXPIRED', 'The session token has expired.', 'mock-request-expired') }
  if (token === 'mock-access-no-membership') return { error: error(403, 'TENANT_MEMBERSHIP_REQUIRED', 'An active tenant membership is required.', 'mock-request-no-membership') }
  const allowed: Record<string, string> = {
    'mock-access-valid-tenant-a': TENANT_A,
    'mock-access-valid-tenant-a-rotated': TENANT_A,
    'mock-access-valid-tenant-b': TENANT_B,
    'mock-access-no-apps': TENANT_A,
  }
  const tenantId = allowed[token]
  return tenantId === undefined
    ? { error: error(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.', 'mock-request-auth-required') }
    : { token, tenantId }
}

/** Dependency-free deterministic implementation of the pinned local-only contract. */
export function dispatchEmbeddedMock(
  method: string,
  path: string,
  headers: Readonly<Record<string, string | string[] | undefined>>,
  body: unknown,
): EmbeddedMockResult {
  if (method === 'POST' && path === '/desktop/v1/auth/callback') {
    const payload = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {}
    if (payload.code === 'mock-code-no-membership') {
      return error(403, 'TENANT_MEMBERSHIP_REQUIRED', 'An active tenant membership is required.', 'mock-request-no-membership')
    }
    const valid = payload.clientId === PLATFORM_CLIENT_ID
      && payload.code === 'mock-code-success'
      && typeof payload.codeVerifier === 'string' && payload.codeVerifier.length >= 43 && payload.codeVerifier.length <= 128
      && payload.redirectUri === 'http://127.0.0.1:43821/callback'
      && typeof payload.state === 'string' && payload.state.length >= 16
    if (!valid) return error(400, 'INVALID_REQUEST', 'The request does not match the contract.', 'mock-request-invalid')
    return { status: 200, body: {
      session: { accessToken: 'mock-access-valid-tenant-a', refreshToken: 'mock-refresh-valid-tenant-a', tokenType: 'Bearer', expiresIn: 900, audience: PLATFORM_CLIENT_ID, activeTenantId: TENANT_A },
      user: { userId: '20000000-0000-4000-8000-000000000001', displayName: '模拟用户', email: 'demo.user@example.invalid' }, meta,
    } }
  }
  if (method === 'POST' && path === '/desktop/v1/auth/refresh') {
    const payload = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {}
    if (payload.clientId !== PLATFORM_CLIENT_ID) return error(401, 'TOKEN_AUDIENCE_INVALID', 'The token is not valid for this desktop client.', 'mock-request-wrong-audience')
    if (payload.refreshToken === 'mock-refresh-expired') return error(401, 'TOKEN_EXPIRED', 'The session token has expired.', 'mock-request-expired')
    if (payload.refreshToken !== 'mock-refresh-valid-tenant-a') return error(401, 'AUTHENTICATION_REQUIRED', 'Authentication is required.', 'mock-request-auth-required')
    return { status: 200, body: { session: { accessToken: 'mock-access-valid-tenant-a-rotated', refreshToken: 'mock-refresh-valid-tenant-a-rotated', tokenType: 'Bearer', expiresIn: 900, audience: PLATFORM_CLIENT_ID, activeTenantId: TENANT_A }, meta } }
  }
  if (method === 'POST' && path === '/desktop/v1/auth/logout') return { status: 200, body: { ok: true, revocationEffectiveWithinSeconds: 60, meta } }
  if ((method === 'GET' && path === '/desktop/v1/tenants') || (method === 'GET' && path === '/desktop/v1/apps')) {
    const auth = authorize(headers)
    if (auth.error !== undefined) return auth.error
    if (path.endsWith('/apps') && auth.token === 'mock-access-no-apps') return error(403, 'APPLICATION_ACCESS_DENIED', 'No applications are authorized for this tenant membership.', 'mock-request-no-apps')
    if (path.endsWith('/tenants')) return { status: 200, body: { activeTenantId: auth.tenantId, items: tenants, meta } }
    const items = auth.tenantId === TENANT_B
      ? [{ ...applications[0], tenantId: TENANT_B }]
      : applications
    return { status: 200, body: { activeTenantId: auth.tenantId, items, meta } }
  }
  if (method === 'POST' && path === '/desktop/v1/tenants/switch') {
    const auth = authorize(headers)
    if (auth.error !== undefined) return auth.error
    const payload = body !== null && typeof body === 'object' ? body as Record<string, unknown> : {}
    const target = payload.tenantId
    if (target !== TENANT_A && target !== TENANT_B) return error(403, 'TENANT_ACCESS_DENIED', 'The signed-in identity is not a member of the requested tenant.', 'mock-request-cross-tenant')
    return { status: 200, body: {
      tenant: tenants[target === TENANT_A ? 0 : 1],
      session: { accessToken: target === TENANT_A ? 'mock-access-valid-tenant-a' : 'mock-access-valid-tenant-b', refreshToken: target === TENANT_A ? 'mock-refresh-valid-tenant-a' : 'mock-refresh-valid-tenant-b', tokenType: 'Bearer', expiresIn: 900, audience: PLATFORM_CLIENT_ID, activeTenantId: target }, meta,
    } }
  }
  return error(404, 'NOT_FOUND', 'The mock route does not exist.', 'mock-request-not-found')
}
