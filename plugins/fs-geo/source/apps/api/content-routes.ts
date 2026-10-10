import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  accountInput,
  articleInput,
  editInput,
  planInput,
  recordInput,
  reviewInput,
  topicInput,
  writingBrief,
} from "../../packages/core/content.js";
import { GeoError } from "../../packages/core/errors.js";
import { csvCell } from "../../packages/core/metrics.js";
import { ContentRepository } from "../../packages/storage/content-repository.js";
import type { Repository } from "../../packages/storage/repository.js";
import type { Identity } from "../../packages/platform/identity.js";
import {
  TenantBrandRepository,
  tenantBrandInput,
} from "../../packages/storage/tenant-brand.js";

export function contentRoutes(
  app: FastifyInstance,
  repo: Repository,
  principal: (request: object) => Identity,
  writingEnabled = false,
) {
  const content = new ContentRepository(repo);
  const tenantBrand = new TenantBrandRepository(repo);
  app.get("/api/geo/v1/brand", async (request) => ({
    data: await tenantBrand.get(principal(request)),
  }));
  app.post("/api/geo/v1/brand", async (request) => ({
    data: await tenantBrand.save(
      principal(request),
      tenantBrandInput.parse(request.body),
    ),
  }));
  const base = "/api/geo/v1/projects/:id";
  type Params = { id: string; articleId: string; planId: string };
  const project = (params: Params) => z.uuid().parse(params.id);
  app.get<{ Params: Params }>(`${base}/content`, async (request) => {
    const page = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(100).default(20),
      })
      .strict()
      .parse(request.query);
    const data=await content.snapshot(
        principal(request),
        project(request.params),
        page.page,
        page.pageSize,
      );
    data.capabilities.aiDrafting=writingEnabled;
    return {data};
  });
  app.post<{ Params: Params }>(`${base}/brand-profile`, async (request) => {
    await repo.getProject(principal(request), project(request.params));
    throw new GeoError(
      "BRAND_PROFILE_MOVED",
      409,
      "品牌资料已改为主体统一管理，请前往品牌资料页面维护",
    );
  });
  app.post<{ Params: Params }>(`${base}/topics`, async (request, reply) =>
    reply.code(201).send({
      data: await content.createTopic(
        principal(request),
        project(request.params),
        topicInput.parse(request.body),
      ),
    }),
  );
  app.post<{ Params: Params }>(`${base}/articles`, async (request, reply) =>
    reply.code(201).send({
      data: await content.createArticle(
        principal(request),
        project(request.params),
        articleInput.parse(request.body),
      ),
    }),
  );
  app.post<{ Params: Params }>(
    `${base}/articles/:articleId`,
    async (request) => ({
      data: await content.editArticle(
        principal(request),
        project(request.params),
        z.uuid().parse(request.params.articleId),
        editInput.parse(request.body),
      ),
    }),
  );
  app.post<{ Params: Params }>(
    `${base}/articles/:articleId/review`,
    async (request) => ({
      data: await content.review(
        principal(request),
        project(request.params),
        z.uuid().parse(request.params.articleId),
        reviewInput.parse(request.body),
      ),
    }),
  );
  app.post<{ Params: Params }>(`${base}/accounts`, async (request, reply) =>
    reply.code(201).send({
      data: await content.createAccount(
        principal(request),
        project(request.params),
        accountInput.parse(request.body),
      ),
    }),
  );
  app.post<{ Params: Params }>(
    `${base}/publication-plans`,
    async (request, reply) =>
      reply.code(201).send({
        data: await content.createPlan(
          principal(request),
          project(request.params),
          planInput.parse(request.body),
        ),
      }),
  );
  app.post<{ Params: Params }>(
    `${base}/publication-plans/:planId/cancel`,
    async (request) => {
      z.object({}).strict().parse(request.body);
      return {
        data: await content.cancel(
          principal(request),
          project(request.params),
          z.uuid().parse(request.params.planId),
        ),
      };
    },
  );
  app.post<{ Params: Params }>(
    `${base}/publication-records`,
    async (request, reply) =>
      reply.code(201).send({
        data: await content.record(
          principal(request),
          project(request.params),
          recordInput.parse(request.body),
        ),
      }),
  );
  app.post<{ Params: Params }>(`${base}/writing-brief`, async (request) => {
    const input = z
      .object({ topic: z.string().trim().min(1).max(200) })
      .strict()
      .parse(request.body);
    const actor = principal(request);
    const id = project(request.params);
    const brand = await repo.getProject(actor, id);
    const snapshot = await content.snapshot(actor, id, 1, 1);
    return {
      data: {
        body: writingBrief(brand.brand, snapshot.profile, input.topic),
        provenance: "LOCAL_BRIEF",
        charged: false,
      },
    };
  });
  app.get<{ Params: Params }>(
    `${base}/content/export`,
    async (request, reply) => {
      const actor = principal(request);
      const id = project(request.params);
      const all = [];
      for (let page = 1; page <= 11; page++) {
        const rows = (await content.snapshot(actor, id, page, 100)).records;
        all.push(...rows);
        if (all.length > 1000)
          throw new GeoError(
            "EXPORT_LIMIT",
            422,
            "发布记录同步导出最多 1000 条",
          );
        if (rows.length < 100) break;
      }
      reply
        .header(
          "Content-Disposition",
          'attachment; filename="geo-publications.csv"',
        )
        .type("text/csv; charset=utf-8");
      return (
        "\uFEFF" +
        [
          "title,platform,account,url,published_at,provenance,note",
          ...all.map((r) =>
            [
              r.title,
              r.platform,
              r.label,
              r.url,
              new Date(r.published_at).toISOString(),
              r.provenance,
              r.note,
            ]
              .map(csvCell)
              .join(","),
          ),
        ].join("\r\n")
      );
    },
  );
}
