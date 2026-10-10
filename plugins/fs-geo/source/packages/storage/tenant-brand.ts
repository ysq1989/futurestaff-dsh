import { z } from "zod";
import { GeoError } from "../core/errors.js";
import type { Identity } from "../platform/identity.js";
import type { Repository } from "./repository.js";
import type { TenantBrand } from "../core/content-types.js";
const text = z.string().trim().min(1).max(120);
const domain = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/);
export const tenantBrandInput = z
  .object({
    version: z.number().int().min(0),
    brand: text,
    aliases: z.array(text).max(30).default([]),
    domains: z.array(domain).max(30).default([]),
    competitors: z.array(text).max(30).default([]),
    business: z.string().trim().max(6000).default(""),
    audience: z.string().trim().max(2000).default(""),
    facts: z.string().trim().max(12000).default(""),
    tone: z.string().trim().max(500).default(""),
  })
  .strict()
  .refine(
    (v) =>
      new Set(
        [v.brand, ...v.competitors].map((x) =>
          x.normalize("NFKC").toLowerCase(),
        ),
      ).size ===
      v.competitors.length + 1,
    "目标品牌与竞品名称不能重复",
  );
export class TenantBrandRepository {
  constructor(private repo: Repository) {}
  get(actor: Identity) {
    return this.repo.forTenant(
      actor.tenantId,
      async (q) =>
        (
          await q.query<TenantBrand>(
            "select brand,version,aliases,domains,competitors,business,audience,facts,tone from geo_tenant_brands",
          )
        ).rows[0] || null,
    );
  }
  save(actor: Identity, input: z.infer<typeof tenantBrandInput>) {
    if (!actor.permissions.includes("geo.admin"))
      throw new GeoError("FORBIDDEN", 403, "主体品牌资料需要 GEO 管理员维护");
    return this.repo.forTenant(actor.tenantId, async (q) => {
      await q.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [
        `${actor.tenantId}/tenant-brand`,
      ]);
      const current = (
        await q.query<TenantBrand>(
          "select brand,version,aliases,domains,competitors,business,audience,facts,tone from geo_tenant_brands",
        )
      ).rows[0];
      if ((current?.version || 0) !== input.version)
        throw new GeoError(
          "BRAND_VERSION_CONFLICT",
          409,
          "主体品牌资料已更新，请刷新后保存",
        );
      if (
        current &&
        current.brand.normalize("NFKC").toLowerCase() !==
          input.brand.normalize("NFKC").toLowerCase()
      )
        throw new GeoError(
          "BRAND_IDENTITY_LOCKED",
          409,
          "当前主体已绑定品牌，不能更换成另一个品牌",
        );
      const row = (
        await q.query<TenantBrand>(
          "insert into geo_tenant_brands(tenant_id,brand,version,aliases,domains,competitors,business,audience,facts,tone) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict(tenant_id) do update set version=excluded.version,aliases=excluded.aliases,domains=excluded.domains,competitors=excluded.competitors,business=excluded.business,audience=excluded.audience,facts=excluded.facts,tone=excluded.tone returning brand,version,aliases,domains,competitors,business,audience,facts,tone",
          [
            actor.tenantId,
            current?.brand || input.brand,
            input.version + 1,
            JSON.stringify(input.aliases),
            JSON.stringify(input.domains),
            JSON.stringify(input.competitors),
            input.business,
            input.audience,
            input.facts,
            input.tone,
          ],
        )
      ).rows[0];
      await this.repo.audit(q, actor, "geo.tenant_brand.saved", actor.tenantId);
      return row;
    });
  }
}
