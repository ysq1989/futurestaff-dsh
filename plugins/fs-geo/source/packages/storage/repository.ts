import { randomUUID, createHash } from "node:crypto";
import { GeoError } from "../core/errors.js";
import type { Identity } from "../platform/identity.js";
export interface Queryable {
  query<T>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
export interface Database extends Queryable {
  transaction<T>(fn: (q: Queryable) => Promise<T>): Promise<T>;
}
export interface Project {
  id: string;
  tenant_id: string;
  name: string;
  brand: string;
  aliases: string[];
  domains: string[];
  competitors: string[];
}
export interface Prompt {
  id: string;
  question: string;
  branded: boolean;
}
export interface Evidence {
  id: string;
  prompt_id: string;
  product_id: string;
  model: string;
  channel: string;
  provenance: string;
  search_state: string;
  state: string;
  citation_state: string;
  answer: string;
  citations: string[];
  collected_at: string;
  branded: boolean;
  raw_response: unknown;
  sha256: string;
  question: string;
}
export interface ProjectInput {
  name: string;
}
const projectSelect = "select p.id,p.tenant_id,p.name,b.brand,b.aliases,b.domains,b.competitors from geo_projects p join geo_tenant_brands b on p.tenant_id=b.tenant_id";
export interface ImportInput {
  promptId: string;
  productId: string;
  model: string;
  channel: string;
  searchState: string;
  state: string;
  citationState: string;
  answer: string;
  citations: string[];
  collectedAt: string;
}
export interface Run {
  id: string;
  project_id: string;
  prompt_id: string;
  model: string;
  state: string;
  error_code: string | null;
  request_hash: string;
  created_at: string;
}
export class Repository {
  constructor(private db: Database) {}
  forTenant<T>(tenantId: string, fn: (q: Queryable) => Promise<T>) {
    return this.db.transaction(async (q) => {
      await q.query("set local role geo_runtime");
      await q.query("select set_config('app.tenant_id',$1,true)", [tenantId]);
      return fn(q);
    });
  }
  async project(q: Queryable, id: string) {
    const result = await q.query<Project>(
      `${projectSelect} where p.id=$1`,
      [id],
    );
    if (!result.rows[0])
      throw new GeoError("NOT_FOUND", 404, "项目不存在或无权访问");
    return result.rows[0];
  }
  listProjects(identity: Identity, page: number, size: number) {
    return this.forTenant(identity.tenantId, async (q) => {
      const count = await q.query<{ count: string }>(
        "select count(*) from geo_projects",
      );
      const rows = await q.query<Project>(
        `${projectSelect} order by p.created_at desc,p.id limit $1 offset $2`,
        [size, (page - 1) * size],
      );
      return {
        data: rows.rows,
        pagination: {
          page,
          pageSize: size,
          totalItems: Number(count.rows[0].count),
        },
      };
    });
  }
  createProject(identity: Identity, input: ProjectInput) {
    return this.forTenant(identity.tenantId, async (q) => {
      const brand = (await q.query<Project>("select * from geo_tenant_brands")).rows[0];
      if (!brand) throw new GeoError("BRAND_NOT_CONFIGURED",409,"请先由管理员配置当前主体的唯一品牌，再创建推广计划");
      const id = randomUUID();
      const result = await q.query<Project>(
        "insert into geo_projects(id,tenant_id,name,brand,aliases,domains,competitors,created_by) values($1,$2,$3,$4,$5,$6,$7,$8) returning *",
        [
          id,
          identity.tenantId,
          input.name,
          brand.brand,
          JSON.stringify(brand.aliases),
          JSON.stringify(brand.domains),
          JSON.stringify(brand.competitors),
          identity.userId,
        ],
      );
      await this.audit(q, identity, "geo.project.created", id);
      return result.rows[0];
    });
  }
  getProject(identity: Identity, id: string) {
    return this.forTenant(identity.tenantId, (q) => this.project(q, id));
  }
  prompts(identity: Identity, projectId: string, page: number, size: number) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const result = await q.query<Prompt>(
        "select * from geo_prompts where project_id=$1 order by created_at,id limit $2 offset $3",
        [projectId, size, (page - 1) * size],
      );
      return result.rows;
    });
  }
  createPrompt(
    identity: Identity,
    projectId: string,
    question: string,
    branded: boolean,
  ) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const id = randomUUID();
      const rows = await q.query<Prompt>(
        "insert into geo_prompts(id,tenant_id,project_id,question,branded) values($1,$2,$3,$4,$5) returning *",
        [id, identity.tenantId, projectId, question, branded],
      );
      await this.audit(q, identity, "geo.prompt.created", id);
      return rows.rows[0];
    });
  }
  importEvidence(identity: Identity, projectId: string, input: ImportInput) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const prompt = await q.query<Prompt>(
        "select * from geo_prompts where id=$1 and project_id=$2",
        [input.promptId, projectId],
      );
      if (!prompt.rows[0])
        throw new GeoError("NOT_FOUND", 404, "问题不存在或不属于该项目");
      const id = randomUUID();
      const raw = JSON.stringify(input);
      const digest = createHash("sha256").update(raw).digest("hex");
      const rows = await q.query<Evidence>(
        "insert into geo_evidence(id,tenant_id,project_id,prompt_id,product_id,model,channel,provenance,search_state,state,citation_state,answer,citations,raw_response,sha256,collected_at,imported_by) values($1,$2,$3,$4,$5,$6,$7,'MANUAL_IMPORT',$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *",
        [
          id,
          identity.tenantId,
          projectId,
          input.promptId,
          input.productId,
          input.model,
          input.channel,
          input.searchState,
          input.state,
          input.citationState,
          input.answer,
          JSON.stringify(input.citations),
          raw,
          digest,
          input.collectedAt,
          identity.userId,
        ],
      );
      await this.audit(q, identity, "geo.evidence.imported", id);
      return rows.rows[0];
    });
  }
  async createRun(
    identity: Identity,
    projectId: string,
    promptId: string,
    model: string,
    idempotencyKey: string,
  ) {
    const hash = createHash("sha256")
      .update(JSON.stringify([projectId, promptId, model]))
      .digest("hex");
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const prompt = await q.query<Prompt>(
        "select * from geo_prompts where project_id=$1 and id=$2",
        [projectId, promptId],
      );
      if (!prompt.rows[0]) throw new GeoError("NOT_FOUND", 404, "问题不存在");
      const inserted = await q.query<Run>(
        "insert into geo_runs(id,tenant_id,project_id,prompt_id,model,idempotency_key,request_hash,state,actor_id) values($1,$2,$3,$4,$5,$6,$7,'RUNNING',$8) on conflict(tenant_id,idempotency_key) do nothing returning *",
        [
          randomUUID(),
          identity.tenantId,
          projectId,
          promptId,
          model,
          idempotencyKey,
          hash,
          identity.userId,
        ],
      );
      const existing =
        inserted.rows[0] ||
        (
          await q.query<Run>(
            "select * from geo_runs where idempotency_key=$1",
            [idempotencyKey],
          )
        ).rows[0];
      if (existing.request_hash !== hash)
        throw new GeoError(
          "IDEMPOTENCY_CONFLICT",
          409,
          "同一幂等键对应了不同的测量内容",
        );
      return {
        run: existing,
        isNew: inserted.rows.length === 1,
        question: prompt.rows[0].question,
      };
    });
  }
  finishRun(
    identity: Identity,
    run: Run,
    input: ImportInput | null,
    raw: unknown,
    errorCode: string | null,
    provenance: 'COLLECTED' | 'FIXTURE' = 'COLLECTED',
  ) {
    return this.forTenant(identity.tenantId, async (q) => {
      if (input) {
        const id = randomUUID();
        const payload = JSON.stringify(raw);
        const digest = createHash("sha256").update(payload).digest("hex");
        await q.query(
          "insert into geo_evidence(id,tenant_id,project_id,prompt_id,product_id,model,channel,provenance,search_state,state,citation_state,answer,citations,raw_response,sha256,collected_at,imported_by,run_id) values($1,$2,$3,$4,$5,$6,'MODEL_API',$15,'UNKNOWN','SUCCEEDED',$7,$8,$9,$10,$11,$12,$13,$14)",
          [
            id,
            identity.tenantId,
            run.project_id,
            run.prompt_id,
            input.productId,
            input.model,
            input.citationState,
            input.answer,
            JSON.stringify(input.citations),
            payload,
            digest,
            input.collectedAt,
            identity.userId,
            run.id,
            provenance,
          ],
        );
      }
      const result = await q.query<Run>(
        "update geo_runs set state=$1,error_code=$2,raw_response=$3,finished_at=now() where id=$4 and state='RUNNING' returning *",
        [
          input ? "SUCCEEDED" : "UNKNOWN",
          errorCode,
          raw === null ? null : JSON.stringify(raw),
          run.id,
        ],
      );
      if (!result.rows[0])
        throw new GeoError("RUN_ALREADY_COMPLETED", 409, "测量已结束");
      await this.audit(
        q,
        identity,
        input ? "geo.run.completed" : "geo.run.unknown",
        run.id,
      );
      return result.rows[0];
    });
  }
  runs(identity: Identity, projectId: string) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      return (
        await q.query<Run>(
          "select id,project_id,prompt_id,model,case when state='RUNNING' and created_at<now()-interval '180 seconds' then 'UNKNOWN' else state end as state,case when state='RUNNING' and created_at<now()-interval '180 seconds' then 'EXECUTION_INTERRUPTED' else error_code end as error_code,created_at from geo_runs where project_id=$1 order by created_at desc limit 100",
          [projectId],
        )
      ).rows;
    });
  }
  evidence(identity: Identity, projectId: string, limit = 100, offset = 0, excludeFixtures = false) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const result = await q.query<Evidence>(
        "select e.*,p.branded,p.question from geo_evidence e join geo_prompts p on p.tenant_id=e.tenant_id and p.project_id=e.project_id and p.id=e.prompt_id where e.project_id=$1" + (excludeFixtures ? " and e.provenance<>'FIXTURE'" : '') + " order by e.created_at desc,e.id limit $2 offset $3",
        [projectId, limit, offset],
      );
      return result.rows;
    });
  }
  analysisRows(identity: Identity, projectId: string) {
    return this.forTenant(identity.tenantId, async (q) => {
      await this.project(q, projectId);
      const result = await q.query<Evidence>(
        "select e.*,p.branded,p.question from geo_evidence e join geo_prompts p on p.tenant_id=e.tenant_id and p.project_id=e.project_id and p.id=e.prompt_id where e.project_id=$1",
        [projectId],
      );
      return result.rows;
    });
  }
  audit(q: Queryable, identity: Identity, event: string, resourceId: string) {
    return q.query(
      "insert into geo_audit(id,tenant_id,actor_id,event,resource_id) values($1,$2,$3,$4,$5)",
      [randomUUID(), identity.tenantId, identity.userId, event, resourceId],
    );
  }
}
