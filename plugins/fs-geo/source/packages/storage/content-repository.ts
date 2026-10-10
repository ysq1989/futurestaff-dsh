import { randomUUID } from "node:crypto";
import { z } from "zod";
import { GeoError } from "../core/errors.js";
import {
  futureTime,
  reviewState,
  type BrandProfile,
  type Article,
  type Plan,
  type Account,
  type Topic,
  type PublicationRecord,
  type ContentSnapshot,
  type articleInput,
  type editInput,
  type reviewInput,
  type planInput,
  type accountInput,
  type recordInput,
  type topicInput,
} from "../core/content.js";
import { Repository, type Queryable } from "./repository.js";
import type { Identity } from "../platform/identity.js";

const articleJoin =
  "select a.id,a.version,a.state,v.title,v.body,v.summary,v.topic_id,v.sources from geo_articles a join geo_article_versions v on (a.tenant_id,a.project_id,a.id,a.version)=(v.tenant_id,v.project_id,v.article_id,v.version)";
const planJoin =
  "select p.*,v.title,v.body,ac.platform,ac.label,null::text as error_code from geo_publication_plans p join geo_article_versions v on (p.tenant_id,p.project_id,p.article_id,p.version)=(v.tenant_id,v.project_id,v.article_id,v.version) join geo_publication_accounts ac on (p.tenant_id,p.project_id,p.account_id)=(ac.tenant_id,ac.project_id,ac.id)";
export class ContentRepository {
  constructor(private repo: Repository) {}
  private scoped<T>(
    actor: Identity,
    project: string,
    fn: (q: Queryable) => Promise<T>,
  ) {
    return this.repo.forTenant(actor.tenantId, async (q) => {
      await this.repo.project(q, project);
      return fn(q);
    });
  }
  private async related(
    q: Queryable,
    project: string,
    kind: "topic" | "prompt" | "account",
    id: string | null,
  ) {
    if (!id) return;
    const table = {
      topic: "geo_topics",
      prompt: "geo_prompts",
      account: "geo_publication_accounts",
    }[kind];
    if (
      !(
        await q.query(`select id from ${table} where project_id=$1 and id=$2`, [
          project,
          id,
        ])
      ).rows.length
    )
      throw new GeoError("NOT_FOUND", 404, "关联资源不存在或不属于当前项目");
  }
  private async lockedArticle(
    q: Queryable,
    project: string,
    id: string,
    version: number,
  ) {
    const row = (
      await q.query<{ id: string; version: number; state: string }>(
        "select id,version,state from geo_articles where project_id=$1 and id=$2 for update",
        [project, id],
      )
    ).rows[0];
    if (!row) throw new GeoError("NOT_FOUND", 404, "文章不存在或无权访问");
    if (row.version !== version)
      throw new GeoError(
        "CONTENT_VERSION_CONFLICT",
        409,
        "文章已有新版本，请刷新，原编辑内容已保留在表单中",
      );
    return row;
  }
  snapshot(
    actor: Identity,
    project: string,
    page: number,
    size: number,
  ): Promise<ContentSnapshot> {
    return this.scoped(actor, project, async (q) => {
      const args = [project, size, (page - 1) * size];
      const profile = (
        await q.query<BrandProfile>(
          "select version,business,audience,facts,tone from geo_tenant_brands where tenant_id=$1",
          [actor.tenantId],
        )
      ).rows[0] || {
        version: 0,
        business: "",
        audience: "",
        facts: "",
        tone: "",
      };
      const topics = (
        await q.query<Topic>(
          "select t.id,t.title,t.prompt_id,p.question from geo_topics t left join geo_prompts p on (t.tenant_id,t.project_id,t.prompt_id)=(p.tenant_id,p.project_id,p.id) where t.project_id=$1 order by t.created_at desc,t.id limit $2 offset $3",
          args,
        )
      ).rows;
      const articles = (
        await q.query<Article>(
          `${articleJoin} where a.project_id=$1 order by a.created_at desc,a.id limit $2 offset $3`,
          args,
        )
      ).rows;
      const accounts = (
        await q.query<Account>(
          "select id,platform,label,mode from geo_publication_accounts where project_id=$1 order by created_at desc,id limit $2 offset $3",
          args,
        )
      ).rows;
      const plans = (
        await q.query<Plan>(
          `${planJoin} where p.project_id=$1 order by p.created_at desc,p.id limit $2 offset $3`,
          args,
        )
      ).rows;
      const records = (
        await q.query<PublicationRecord>(
          "select r.*,v.title,ac.platform,ac.label from geo_publication_records r join geo_publication_plans p on (r.tenant_id,r.project_id,r.plan_id)=(p.tenant_id,p.project_id,p.id) join geo_article_versions v on (p.tenant_id,p.project_id,p.article_id,p.version)=(v.tenant_id,v.project_id,v.article_id,v.version) join geo_publication_accounts ac on (p.tenant_id,p.project_id,p.account_id)=(ac.tenant_id,ac.project_id,ac.id) where r.project_id=$1 order by r.created_at desc,r.id limit $2 offset $3",
          args,
        )
      ).rows;
      const reviews = (
        await q.query<ContentSnapshot["reviews"][number]>(
          "select article_id,version,action,comment,created_at from geo_article_reviews where project_id=$1 order by created_at desc,id limit $2 offset $3",
          args,
        )
      ).rows;
      return {
        profile,
        topics,
        articles,
        accounts,
        plans,
        records,
        reviews,
        pagination: { page, pageSize: size },
        capabilities: { automaticPublishing: false, aiDrafting: false },
      };
    });
  }
  createTopic(
    actor: Identity,
    project: string,
    input: z.infer<typeof topicInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      await this.related(q, project, "prompt", input.promptId);
      const row = (
        await q.query<Topic>(
          "insert into geo_topics(id,tenant_id,project_id,title,prompt_id) values($1,$2,$3,$4,$5) returning *",
          [randomUUID(), actor.tenantId, project, input.title, input.promptId],
        )
      ).rows[0];
      await this.repo.audit(q, actor, "geo.topic.created", row.id);
      return row;
    });
  }
  private saveVersion(
    q: Queryable,
    actor: Identity,
    project: string,
    id: string,
    version: number,
    input: z.infer<typeof articleInput>,
  ) {
    return q.query(
      "insert into geo_article_versions(tenant_id,project_id,article_id,version,title,body,summary,topic_id,sources,created_by) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [
        actor.tenantId,
        project,
        id,
        version,
        input.title,
        input.body,
        input.summary,
        input.topicId,
        JSON.stringify(input.sources),
        actor.userId,
      ],
    );
  }
  createArticle(
    actor: Identity,
    project: string,
    input: z.infer<typeof articleInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      await this.related(q, project, "topic", input.topicId);
      const id = randomUUID();
      await q.query(
        "insert into geo_articles(id,tenant_id,project_id,version,state) values($1,$2,$3,1,'DRAFT')",
        [id, actor.tenantId, project],
      );
      await this.saveVersion(q, actor, project, id, 1, input);
      await this.repo.audit(q, actor, "geo.article.created", id);
      return (
        await q.query<Article>(
          `${articleJoin} where a.project_id=$1 and a.id=$2`,
          [project, id],
        )
      ).rows[0];
    });
  }
  editArticle(
    actor: Identity,
    project: string,
    id: string,
    input: z.infer<typeof editInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      await this.lockedArticle(q, project, id, input.version);
      await this.related(q, project, "topic", input.topicId);
      await this.saveVersion(q, actor, project, id, input.version + 1, input);
      await q.query(
        "update geo_articles set version=version+1,state='DRAFT' where project_id=$1 and id=$2",
        [project, id],
      );
      await this.repo.audit(q, actor, "geo.article.revised", id);
      return (
        await q.query<Article>(
          `${articleJoin} where a.project_id=$1 and a.id=$2`,
          [project, id],
        )
      ).rows[0];
    });
  }
  review(
    actor: Identity,
    project: string,
    id: string,
    input: z.infer<typeof reviewInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      const article = await this.lockedArticle(q, project, id, input.version);
      const state = reviewState(
        article.state,
        input.action,
        actor.permissions.includes("geo.admin"),
      );
      await q.query(
        "update geo_articles set state=$1 where project_id=$2 and id=$3",
        [state, project, id],
      );
      await q.query(
        "insert into geo_article_reviews(id,tenant_id,project_id,article_id,version,action,comment,actor_id) values($1,$2,$3,$4,$5,$6,$7,$8)",
        [
          randomUUID(),
          actor.tenantId,
          project,
          id,
          input.version,
          input.action,
          input.comment,
          actor.userId,
        ],
      );
      await this.repo.audit(
        q,
        actor,
        `geo.article.${input.action.toLowerCase()}`,
        id,
      );
      return { ...article, state };
    });
  }
  createAccount(
    actor: Identity,
    project: string,
    input: z.infer<typeof accountInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      const row = (
        await q.query<Account>(
          "insert into geo_publication_accounts(id,tenant_id,project_id,platform,label) values($1,$2,$3,$4,$5) returning id,platform,label,mode",
          [randomUUID(), actor.tenantId, project, input.platform, input.label],
        )
      ).rows[0];
      await this.repo.audit(
        q,
        actor,
        "geo.publication_account.created",
        row.id,
      );
      return row;
    });
  }
  createPlan(
    actor: Identity,
    project: string,
    input: z.infer<typeof planInput>,
  ) {
    return this.scoped(actor, project, async (q) => {
      await this.related(q, project, "account", input.accountId);
      if (input.mode === "AUTOMATIC")
        throw new GeoError(
          "PUBLISHER_NOT_VERIFIED",
          409,
          "头条自动发布尚未核验执行身份、账号与适配器，请使用手动发布待办",
        );
      const existing = (
        await q.query<{ id: string }>(
          "select id from geo_publication_plans where project_id=$1 and article_id=$2 and version=$3 and account_id=$4 and scheduled_at=$5",
          [
            project,
            input.articleId,
            input.version,
            input.accountId,
            input.scheduledAt,
          ],
        )
      ).rows[0];
      if (existing)
        return (
          await q.query<Plan>(`${planJoin} where p.project_id=$1 and p.id=$2`, [
            project,
            existing.id,
          ])
        ).rows[0];
      futureTime(input.scheduledAt);
      const article = await this.lockedArticle(
        q,
        project,
        input.articleId,
        input.version,
      );
      if (article.state !== "APPROVED")
        throw new GeoError(
          "ARTICLE_NOT_APPROVED",
          409,
          "仅已审核的当前文章版本可以排期",
        );
      const row = (
        await q.query<{ id: string }>(
          "insert into geo_publication_plans(id,tenant_id,project_id,article_id,version,account_id,scheduled_at,mode,state) values($1,$2,$3,$4,$5,$6,$7,'MANUAL','PLANNED') on conflict(tenant_id,project_id,article_id,version,account_id,scheduled_at) do update set scheduled_at=excluded.scheduled_at returning id",
          [
            randomUUID(),
            actor.tenantId,
            project,
            input.articleId,
            input.version,
            input.accountId,
            input.scheduledAt,
          ],
        )
      ).rows[0];
      await this.repo.audit(q, actor, "geo.publication_plan.created", row.id);
      return (
        await q.query<Plan>(`${planJoin} where p.project_id=$1 and p.id=$2`, [
          project,
          row.id,
        ])
      ).rows[0];
    });
  }
  cancel(actor: Identity, project: string, id: string) {
    return this.scoped(actor, project, async (q) => {
      const current = (
        await q.query<{ state: string }>(
          "select state from geo_publication_plans where project_id=$1 and id=$2 for update",
          [project, id],
        )
      ).rows[0];
      if (!current)
        throw new GeoError("NOT_FOUND", 404, "排期不存在或无权访问");
      if (current.state !== "PLANNED")
        throw new GeoError(
          "PUBLICATION_STATE_CONFLICT",
          409,
          "只有尚未发布的排期可以取消",
        );
      await q.query(
        "update geo_publication_plans set state='CANCELLED' where project_id=$1 and id=$2",
        [project, id],
      );
      await this.repo.audit(q, actor, "geo.publication_plan.cancelled", id);
      return { id, state: "CANCELLED" };
    });
  }
  record(actor: Identity, project: string, input: z.infer<typeof recordInput>) {
    return this.scoped(actor, project, async (q) => {
      if (new Date(input.publishedAt).getTime() > Date.now())
        throw new GeoError(
          "PUBLICATION_TIME_INVALID",
          422,
          "实际发布时间不能在未来",
        );
      const current = (
        await q.query<{ state: string }>(
          "select state from geo_publication_plans where project_id=$1 and id=$2 for update",
          [project, input.planId],
        )
      ).rows[0];
      if (!current)
        throw new GeoError("NOT_FOUND", 404, "排期不存在或无权访问");
      const existing = (
        await q.query<PublicationRecord>(
          "select * from geo_publication_records where project_id=$1 and plan_id=$2",
          [project, input.planId],
        )
      ).rows[0];
      if (existing) {
        if (
          existing.url !== input.url ||
          new Date(existing.published_at).getTime() !==
            new Date(input.publishedAt).getTime() ||
          existing.note !== input.note
        )
          throw new GeoError(
            "PUBLICATION_RECORD_CONFLICT",
            409,
            "已有发布记录，不能覆盖原证据",
          );
        return existing;
      }
      if (current.state !== "PLANNED")
        throw new GeoError(
          "PUBLICATION_STATE_CONFLICT",
          409,
          "该排期已结束，无法登记发布",
        );
      const row = (
        await q.query<PublicationRecord>(
          "insert into geo_publication_records(id,tenant_id,project_id,plan_id,url,published_at,note,provenance,created_by) values($1,$2,$3,$4,$5,$6,$7,'MANUAL_REPORT',$8) returning *",
          [
            randomUUID(),
            actor.tenantId,
            project,
            input.planId,
            input.url,
            input.publishedAt,
            input.note,
            actor.userId,
          ],
        )
      ).rows[0];
      await q.query(
        "update geo_publication_plans set state='PUBLISHED' where project_id=$1 and id=$2",
        [project, input.planId],
      );
      await this.repo.audit(
        q,
        actor,
        "geo.publication.manually_reported",
        row.id,
      );
      return row;
    });
  }
}
