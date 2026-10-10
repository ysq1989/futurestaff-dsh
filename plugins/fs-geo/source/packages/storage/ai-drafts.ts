import { createHash, randomUUID } from "node:crypto";
import { GeoError } from "../core/errors.js";
import type { DraftingInput } from "../core/ai-drafting.js";
import type { TenantBrand, AiDraftTask } from "../core/content-types.js";
import type { Repository } from "./repository.js";
import type { Identity } from "../platform/identity.js";

const selection =
  "select id,project_id,actor_id,model,input,result,case when state='RUNNING' and created_at<now()-interval '180 seconds' then 'UNKNOWN' else state end as state,case when state='RUNNING' and created_at<now()-interval '180 seconds' then 'EXECUTION_INTERRUPTED' else error_code end as error_code,created_at from geo_ai_drafts";
export class AiDraftRepository {
  constructor(private repo: Repository) {}
  create(actor: Identity, project: string, key: string, input: DraftingInput) {
    const hash = createHash("sha256")
      .update(JSON.stringify([project, input]))
      .digest("hex");
    return this.repo.forTenant(actor.tenantId, async (q) => {
      await this.repo.project(q, project);
      const existing = (
        await q.query<AiDraftTask & { request_hash: string }>(
          "select * from geo_ai_drafts where idempotency_key=$1",
          [key],
        )
      ).rows[0];
      if (existing) {
        if (existing.actor_id !== actor.userId)
          throw new GeoError("FORBIDDEN", 403, "请求属于其他成员");
        if (existing.request_hash !== hash)
          throw new GeoError(
            "IDEMPOTENCY_CONFLICT",
            409,
            "本次请求内容已变化，请核对原任务",
          );
        return { id: existing.id, isNew: false, brand: null };
      }
      const brand = (
        await q.query<TenantBrand>("select * from geo_tenant_brands")
      ).rows[0];
      if (!brand || brand.version !== input.brandVersion)
        throw new GeoError(
          "BRAND_VERSION_CONFLICT",
          409,
          "品牌资料已变化，请刷新后生成",
        );
      if (!brand.business.trim() || !brand.facts.trim())
        throw new GeoError(
          "BRAND_FACTS_REQUIRED",
          422,
          "请先补充品牌业务和可核验事实资料",
        );
      if (
        input.topicId &&
        !(
          await q.query(
            "select id from geo_topics where project_id=$1 and id=$2",
            [project, input.topicId],
          )
        ).rows.length
      )
        throw new GeoError("NOT_FOUND", 404, "选题不存在或不属于当前计划");
      const id = randomUUID();
      const inserted = (
        await q.query<{ id: string }>(
          "insert into geo_ai_drafts(id,tenant_id,project_id,actor_id,idempotency_key,request_hash,model,state,input) values($1,$2,$3,$4,$5,$6,$7,'RUNNING',$8) on conflict(tenant_id,idempotency_key) do nothing returning id",
          [
            id,
            actor.tenantId,
            project,
            actor.userId,
            key,
            hash,
            input.model,
            JSON.stringify({ ...input, brand }),
          ],
        )
      ).rows[0];
      if (!inserted) {
        const other = (
          await q.query<{ id: string; actor_id: string; request_hash: string }>(
            "select id,actor_id,request_hash from geo_ai_drafts where idempotency_key=$1",
            [key],
          )
        ).rows[0];
        if (other.actor_id !== actor.userId)
          throw new GeoError("FORBIDDEN", 403, "请求属于其他成员");
        if (other.request_hash !== hash)
          throw new GeoError("IDEMPOTENCY_CONFLICT", 409, "请求内容冲突");
        return { id: other.id, isNew: false, brand: null };
      }
      await this.repo.audit(q, actor, "geo.ai_draft.started", id);
      return { id, isNew: true, brand };
    });
  }
  list(actor: Identity, project: string, id?: string) {
    return this.repo.forTenant(actor.tenantId, async (q) => {
      await this.repo.project(q, project);
      return (
        await q.query<AiDraftTask>(
          `${selection} where project_id=$1 and actor_id=$2${id ? " and id=$3" : ""} order by created_at desc,id limit 20`,
          id ? [project, actor.userId, id] : [project, actor.userId],
        )
      ).rows;
    });
  }
  finish(
    actor: Identity,
    project: string,
    id: string,
    result: AiDraftTask["result"],
    error: string | null,
  ) {
    return this.repo.forTenant(actor.tenantId, async (q) => {
      const updated = await q.query(
        "update geo_ai_drafts set state=$1,result=$2,error_code=$3,finished_at=now() where id=$4 and project_id=$5 and actor_id=$6 and state='RUNNING' returning id",
        [
          result ? "SUCCEEDED" : "UNKNOWN",
          result ? JSON.stringify(result) : null,
          error,
          id,
          project,
          actor.userId,
        ],
      );
      if (!updated.rows.length)
        throw new GeoError("DRAFT_ALREADY_COMPLETED", 409, "起草任务已结束");
      await this.repo.audit(
        q,
        actor,
        result ? "geo.ai_draft.completed" : "geo.ai_draft.unknown",
        id,
      );
    });
  }
}
