import { z } from "zod";
import { GeoError } from "../core/errors.js";
export interface PlatformConfig {
  platformUrl: string;
  publicUrl: string;
  clientId: string;
  pkceSecret: string;
}
export interface Identity {
  tenantId: string;
  userId: string;
  displayName: string;
  tenantName: string;
  permissions: string[];
}
export type Fetcher = typeof fetch;
const schema = z.object({
  user: z.object({
    id: z.uuid(),
    tenant_id: z.uuid(),
    full_name: z.string().nullish(),
    display_name: z.string().nullish(),
    is_active: z.boolean().optional().refine(value => value !== false),
    username: z.string().nullish(),
  }),
  module: z.object({ module_id: z.string(), client_id: z.string() }),
  permissions: z.array(z.string()),
});
export class PlatformIdentity {
  constructor(
    public config: PlatformConfig,
    private fetcher: Fetcher = fetch,
  ) {}
  cookieName() {
    return `__Host-${this.config.clientId.replace("futurestaff-", "futurestaff_").replaceAll("-", "_")}`;
  }
  onlyCookie(cookie: string | undefined) {
    const name = this.cookieName();
    const item = cookie
      ?.split(";")
      .map((x) => x.trim())
      .find((x) => x.startsWith(`${name}=`));
    if (
      !item ||
      item.length > 8192 ||
      /[\r\n]/.test(item) ||
      item === `${name}=`
    )
      throw new GeoError("UNAUTHENTICATED", 401, "请使用 FutureStaff 登录");
    return item;
  }
  async request(path: string, options: RequestInit = {}) {
    if (!['/api/auth/module-session','/api/auth/module-token','/api/auth/module-logout'].includes(path)) {
      throw new GeoError('PLATFORM_PATH_REJECTED',500,'身份接口路径未获允许');
    }
    const host = new URL(this.config.publicUrl).host;
    try {
      // Node fetch can ignore Host overrides. The fixed GEO auth proxy keeps the
      // registered authority host and delegates verification to Platform.
      return await this.fetcher(new URL(path, this.config.publicUrl), {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          ...Object.fromEntries(new Headers(options.headers)),
          host,
          "x-forwarded-host": host,
          "x-forwarded-proto": "https",
        },
      });
    } catch {
      throw new GeoError(
        "PLATFORM_UNAVAILABLE",
        503,
        "FutureStaff 身份服务暂不可用",
      );
    }
  }
  async authenticate(cookie: string | undefined): Promise<Identity> {
    const response = await this.request("/api/auth/module-session", {
      headers: { cookie: this.onlyCookie(cookie) },
    });
    if (response.status === 401)
      throw new GeoError(
        "UNAUTHENTICATED",
        401,
        "FutureStaff 会话已失效，请重新登录",
      );
    if (response.status === 403)
      throw new GeoError(
        "APPLICATION_ACCESS_DENIED",
        403,
        "当前主体或账号未获 GEO 应用授权",
      );
    if (!response.ok)
      throw new GeoError("PLATFORM_UNAVAILABLE", 503, "GEO 平台接入尚未就绪");
    let parsed;
    try {
      parsed = schema.safeParse(await response.json());
    } catch {
      throw new GeoError("PLATFORM_INVALID_RESPONSE", 502, "身份响应无法验证");
    }
    if (
      !parsed.success ||
      parsed.data.module.module_id !== "geo" ||
      parsed.data.module.client_id !== this.config.clientId
    )
      throw new GeoError(
        "PLATFORM_INVALID_RESPONSE",
        502,
        "身份响应与 GEO 应用不匹配",
      );
    const { user, permissions } = parsed.data;
    if (
      !permissions.some((x) =>
        ["geo.read", "geo.operator", "geo.admin"].includes(x),
      )
    )
      throw new GeoError(
        "APPLICATION_ACCESS_DENIED",
        403,
        "当前账号没有 GEO 权限",
      );
    return {
      tenantId: user.tenant_id,
      userId: user.id,
      displayName: user.display_name || user.full_name || user.username || user.id,
      tenantName: user.tenant_id,
      permissions,
    };
  }
}
