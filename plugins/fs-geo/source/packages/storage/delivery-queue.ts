import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import type { Identity } from "../platform/identity.js";
import { GeoError } from "../core/errors.js";
import type {
  DeliveryResult,
  PublicationExecutor,
  PublicationTask,
} from "../adapters/publication-executor.js";
import { Repository, type Queryable } from "./repository.js";

interface Job {
  id: string;
  tenant_id: string;
  project_id: string;
  article_id: string;
  version: number;
  account_id: string;
  scheduled_at: string;
  state: string;
  lease_token: string;
  title: string;
  body: string;
  request_hash: string;
}
const enqueueInput = z
  .object({
    articleId: z.uuid(),
    version: z.number().int().positive(),
    accountId: z.uuid(),
    scheduledAt: z.iso.datetime({ offset: true }),
    key: z.string().regex(/^[a-zA-Z0-9_-]{8,64}$/),
  })
  .strict();
const selectJob =
  "select j.*,v.title,v.body from geo_delivery_jobs j join geo_article_versions v on (j.tenant_id,j.project_id,j.article_id,j.version)=(v.tenant_id,v.project_id,v.article_id,v.version)";

// Internal storage seam for a future authorized execution service. Not exposed by API.
export class DeliveryQueue {
  constructor(private repo: Repository) {}
  private scoped<T>(
    actor: Identity,
    project: string,
    fn: (q: Queryable) => Promise<T>,
  ) {
    if (
      !actor.permissions.some((p) => ["geo.admin", "geo.operator"].includes(p))
    )
      throw new GeoError("FORBIDDEN", 403, "执行任务需要 GEO 操作权限");
    return this.repo.forTenant(actor.tenantId, async (q) => {
      await this.repo.project(q, project);
      return fn(q);
    });
  }
  enqueue(
    actor: Identity,
    project: string,
    value: z.infer<typeof enqueueInput>,
  ) {
    const input = enqueueInput.parse(value);
    const hash = createHash("sha256")
      .update(
        JSON.stringify([
          project,
          input.articleId,
          input.version,
          input.accountId,
          new Date(input.scheduledAt).toISOString(),
        ]),
      )
      .digest("hex");
    return this.scoped(actor, project, async (q) => {
      const existing = (
        await q.query<Job>(`${selectJob} where j.idempotency_key=$1`, [
          input.key,
        ])
      ).rows[0];
      if (existing) {
        if (existing.request_hash !== hash)
          throw new GeoError(
            "IDEMPOTENCY_CONFLICT",
            409,
            "幂等键已绑定其他任务",
          );
        return existing;
      }
      const article = (
        await q.query<{ state: string }>(
          "select state from geo_articles where project_id=$1 and id=$2 and version=$3 for update",
          [project, input.articleId, input.version],
        )
      ).rows[0];
      if (!article || article.state !== "APPROVED")
        throw new GeoError(
          "ARTICLE_NOT_APPROVED",
          409,
          "仅已审核的当前版本可以进入执行队列",
        );
      if (
        !(
          await q.query(
            "select id from geo_publication_accounts where project_id=$1 and id=$2",
            [project, input.accountId],
          )
        ).rows.length
      )
        throw new GeoError("NOT_FOUND", 404, "账号不属于当前项目");
      await q.query(
        "insert into geo_delivery_jobs(id,tenant_id,project_id,article_id,version,account_id,scheduled_at,idempotency_key,request_hash,state) values($1,$2,$3,$4,$5,$6,$7,$8,$9,'PLANNED') on conflict(tenant_id,idempotency_key) do nothing",
        [
          randomUUID(),
          actor.tenantId,
          project,
          input.articleId,
          input.version,
          input.accountId,
          input.scheduledAt,
          input.key,
          hash,
        ],
      );
      const row = (
        await q.query<Job>(`${selectJob} where j.idempotency_key=$1`, [
          input.key,
        ])
      ).rows[0];
      if (row.request_hash !== hash)
        throw new GeoError("IDEMPOTENCY_CONFLICT", 409, "幂等键已绑定其他任务");
      await this.repo.audit(q, actor, "geo.delivery.queued", row.id);
      return row;
    });
  }
  get(actor: Identity, project: string, id: string) {
    return this.scoped(actor, project, async (q) => {
      const row = (
        await q.query<Job>(`${selectJob} where j.project_id=$1 and j.id=$2`, [
          project,
          id,
        ])
      ).rows[0];
      if (!row) throw new GeoError("NOT_FOUND", 404, "任务不存在或无权访问");
      return row;
    });
  }
  claim(actor: Identity, project: string, id: string, now = Date.now()) {
    return this.scoped(actor, project, async (q) => {
      const target = (
        await q.query<Job>(`${selectJob} where j.project_id=$1 and j.id=$2`, [
          project,
          id,
        ])
      ).rows[0];
      if (!target) throw new GeoError("NOT_FOUND", 404, "任务不存在或无权访问");
      const locked = (
        await q.query<{ locked: boolean }>(
          "select pg_try_advisory_xact_lock(hashtextextended($1,0)) as locked",
          [`${actor.tenantId}/${project}/${target.account_id}`],
        )
      ).rows[0].locked;
      if (!locked) return null;
      const expired = await q.query<{ id: string }>(
        "update geo_delivery_jobs set state='UNKNOWN',result=$1 where project_id=$2 and account_id=$3 and state='RUNNING' and lease_expires_at<=$4 returning id",
        [
          JSON.stringify({
            state: "UNKNOWN",
            errorCode: "EXECUTION_INTERRUPTED",
          }),
          project,
          target.account_id,
          new Date(now).toISOString(),
        ],
      );
      for (const row of expired.rows)
        await this.repo.audit(q, actor, "geo.delivery.unknown", row.id);
      if (
        (
          await q.query(
            "select id from geo_delivery_jobs where project_id=$1 and account_id=$2 and state='RUNNING'",
            [project, target.account_id],
          )
        ).rows.length
      )
        return null;
      const next = (
        await q.query<{ id: string }>(
          "select id from geo_delivery_jobs where project_id=$1 and id=$2 and state='PLANNED' and scheduled_at<=$3 for update skip locked",
          [project, id, new Date(now).toISOString()],
        )
      ).rows[0];
      if (!next) return null;
      const token = randomUUID();
      await q.query(
        "update geo_delivery_jobs set state='RUNNING',lease_token=$1,lease_expires_at=$2 where project_id=$3 and id=$4",
        [token, new Date(now + 180000).toISOString(), project, id],
      );
      await this.repo.audit(q, actor, "geo.delivery.claimed", id);
      return { ...target, state: "RUNNING", lease_token: token };
    });
  }
  finish(
    actor: Identity,
    project: string,
    id: string,
    token: string,
    result: DeliveryResult,
  ) {
    if (!["SUBMITTED", "PUBLISHED", "FAILED", "UNKNOWN"].includes(result.state))
      throw new GeoError(
        "PUBLICATION_RESULT_INVALID",
        422,
        "执行结果不能作为发布结果持久化",
      );
    return this.scoped(actor, project, async (q) => {
      const row = (
        await q.query<Job>(
          "update geo_delivery_jobs set state=$1,result=$2 where project_id=$3 and id=$4 and state='RUNNING' and lease_token=$5 and lease_expires_at>now() returning *",
          [result.state, JSON.stringify(result), project, id, token],
        )
      ).rows[0];
      if (!row)
        throw new GeoError(
          "DELIVERY_LEASE_CONFLICT",
          409,
          "执行租约已结束，保留未知结果并核查平台记录",
        );
      await this.repo.audit(
        q,
        actor,
        `geo.delivery.${result.state.toLowerCase()}`,
        id,
      );
      return row;
    });
  }
  async dispatch(
    actor: Identity,
    project: string,
    id: string,
    executor: PublicationExecutor,
    now = Date.now(),
  ) {
    const job = await this.claim(actor, project, id, now);
    if (!job) return null;
    // claim transaction is committed before any external I/O.
    const task: PublicationTask = {
      id: job.id,
      tenantId: job.tenant_id,
      projectId: job.project_id,
      accountId: job.account_id,
      version: job.version,
      title: job.title,
      body: job.body,
      scheduledAt: new Date(job.scheduled_at).toISOString(),
    };
    const result = await executor.execute(task, now);
    return this.finish(actor, project, id, job.lease_token, result);
  }
}
