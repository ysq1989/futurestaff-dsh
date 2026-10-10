import Fastify from "fastify";
import cookie from "@fastify/cookie";
import { contentRoutes } from "./content-routes.js";
import { aiDraftRoutes } from "./ai-draft-routes.js";
import { z } from "zod";
import { GeoError } from "../../packages/core/errors.js";
import {
  summarize,
  matchBrands,
  csvCell,
} from "../../packages/core/metrics.js";
import {
  PlatformIdentity,
  type Identity,
  type PlatformConfig,
} from "../../packages/platform/identity.js";
import { beginPkce, finishPkce } from "../../packages/platform/pkce.js";
import {
  Repository,
  type Evidence,
  type Project,
} from "../../packages/storage/repository.js";
import {
  AiGateway,
  parseCompletion,
} from "../../packages/adapters/ai-gateway.js";

const text = z.string().trim().min(1).max(120);
const projectInput = z.object({ name: text }).strict();
const promptInput = z
  .object({
    question: z.string().trim().min(1).max(4000),
    branded: z.boolean().default(false),
  })
  .strict();
const evidenceInput = z
  .object({
    promptId: z.uuid(),
    productId: text,
    model: text,
    channel: z.enum(["MODEL_API", "PRODUCT_WEB", "THIRD_PARTY"]),
    searchState: z.enum(["ENABLED", "DISABLED", "UNKNOWN"]),
    state: z.enum(["SUCCEEDED", "FAILED", "UNKNOWN"]).default("SUCCEEDED"),
    citationState: z.enum(["COMPLETE", "UNSUPPORTED", "UNKNOWN"]),
    answer: z.string().max(100000),
    citations: z
      .array(
        z
          .url()
          .refine((v) => ["http:", "https:"].includes(new URL(v).protocol)),
      )
      .max(100),
    collectedAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.state === "SUCCEEDED" && !data.answer.trim())
      ctx.addIssue({
        code: "custom",
        message: "成功证据需要原始回答",
        path: ["answer"],
      });
    if (new Date(data.collectedAt).getTime() > Date.now() + 60000)
      ctx.addIssue({
        code: "custom",
        message: "证据采集时间不能在未来",
        path: ["collectedAt"],
      });
  });
const pageSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
function uuid(value: unknown) {
  return z.uuid().parse(value);
}
function brand(project: Project) {
  return {
    name: project.brand,
    aliases: project.aliases,
    domains: project.domains,
    competitors: project.competitors,
  };
}
export async function makeApp({
  repo,
  identity,
  config,
  gateway,
  modelProducts = {},
  fixtureMode = false,
  writingEnabled = false,
  writingGateway,
  desktop = false,
  identityContext,
  describeModels,
}: {
  repo: Repository;
  identity: Pick<PlatformIdentity, "authenticate" | "request" | "onlyCookie" | "cookieName">;
  config: PlatformConfig;
  gateway?: Pick<AiGateway,"models"|"chat"|"draft">;
  modelProducts?: Record<string, string>;
  fixtureMode?: boolean;
  writingEnabled?: boolean;
  writingGateway?: Pick<AiGateway,"models"|"chat"|"draft">;
  desktop?: boolean;
  describeModels?: () => Promise<Record<string, string>>;
  identityContext?: (actor: Identity, next: () => void) => void;
}) {
  const app = Fastify({ logger: false, bodyLimit: 150000 });
  await app.register(cookie);
  const principals = new WeakMap<object, Identity>();
  function principal(request: object) {
    const value = principals.get(request);
    if (!value) throw new GeoError("UNAUTHENTICATED", 401, "请重新登录");
    return value;
  }
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError)
      return reply
        .code(422)
        .send({
          error: {
            code: "VALIDATION_ERROR",
            message: "请检查输入格式，禁止指定租户或未知字段",
            requestId: request.id,
          },
        });
    const safe =
      error instanceof GeoError
        ? error
        : new GeoError("INTERNAL_ERROR", 500, "GEO 服务暂不可用");
    return reply
      .code(safe.status)
      .send({
        error: {
          code: safe.code,
          message: safe.message,
          requestId: request.id,
        },
      });
  });
  app.addHook("onRequest", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "no-referrer");
    if (!request.routeOptions.url?.startsWith("/api/geo/v1/")) return;
    const actor = await identity.authenticate(request.headers.cookie);
    principals.set(request, actor);
    reply
      .header("X-GEO-Tenant", actor.tenantId)
      .header("X-GEO-User", actor.userId);
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method)) {
      if (request.headers.origin !== new URL(config.publicUrl).origin)
        throw new GeoError("ORIGIN_REJECTED", 403, "请从 GEO 工作台发起操作");
      if (
        !actor.permissions.some((x) =>
          ["geo.admin", "geo.operator"].includes(x),
        )
      )
        throw new GeoError("FORBIDDEN", 403, "当前账号只有只读权限");
    }
  });
  app.addHook('preHandler', (request, _reply, next) => {
    const actor = principals.get(request);
    if (actor && identityContext) identityContext(actor, next); else next();
  });
  app.get("/api/geo/status", async () => ({
    version: "0.2.1",
    identity: "FutureStaff Platform",
    module: "geo",
    collection: gateway ? "CONFIGURED_UNVERIFIED" : "NOT_CONFIGURED",
    tenantAuthority: "PLATFORM_SESSION",
  }));
  if (!desktop) {
  app.get("/api/geo/auth/start", async (_request, reply) => {
    const pkce = beginPkce(config.pkceSecret);
    const url = new URL("/login", config.platformUrl);
    url.search = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: `${config.publicUrl}/oauth/callback/futurestaff`,
      code_challenge: pkce.challenge,
      code_challenge_method: "S256",
      state: pkce.state,
    }).toString();
    reply.setCookie("__Host-geo_pkce", pkce.cookie, {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 300,
    });
    return reply.redirect(url.toString());
  });
  app.get("/api/geo/auth/callback", async (request, reply) => {
    reply.clearCookie("__Host-geo_pkce", {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    const input = z
      .object({
        code: z.string().min(1).max(512),
        state: z.string().min(16).max(512),
      })
      .strict()
      .parse(request.query);
    const verifier = finishPkce(
      config.pkceSecret,
      request.cookies["__Host-geo_pkce"] || "",
      input.state,
    );
    const upstream = await identity.request("/api/auth/module-token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_id: config.clientId,
        code: input.code,
        code_verifier: verifier,
        redirect_uri: `${config.publicUrl}/oauth/callback/futurestaff`,
      }),
    });
    if (!upstream.ok)
      throw new GeoError(
        "LOGIN_EXCHANGE_FAILED",
        401,
        "平台登录交换失败，请重新登录",
      );
    const cookies = upstream.headers.getSetCookie();
    const session = cookies.filter((value) =>
      value.startsWith(`${identity.cookieName()}=`),
    );
    if (
      session.length !== 1 ||
      !/;\s*Secure(?:;|$)/i.test(session[0]) ||
      !/;\s*HttpOnly(?:;|$)/i.test(session[0]) ||
      /;\s*Domain=/i.test(session[0]) ||
      !/;\s*Path=\/(?:;|$)/i.test(session[0])
    )
      throw new GeoError(
        "PLATFORM_INVALID_RESPONSE",
        502,
        "平台未返回有效的 GEO 主机会话",
      );
    reply.header("Set-Cookie", [
      ...((reply.getHeader("set-cookie") as string[]) || []),
      session[0],
    ]);
    return reply.redirect("/");
  });
  app.post("/api/geo/auth/logout", async (request, reply) => {
    if (request.headers.origin !== new URL(config.publicUrl).origin)
      throw new GeoError("ORIGIN_REJECTED", 403, "退出请求来源无效");
    try {
      await identity.request("/api/auth/module-logout", {
        method: "POST",
        headers: { cookie: identity.onlyCookie(request.headers.cookie) },
      });
    } finally {
      reply.clearCookie(identity.cookieName(), {
        secure: true,
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    }
    return { ok: true };
  });
  }
  app.get("/api/geo/v1/session", async (request) => ({
    data: principal(request),
  }));
  app.get("/api/geo/v1/ai-models", async (request) => {
    if (!gateway)
      throw new GeoError(
        "AI_GATEWAY_NOT_READY",
        503,
        "FutureStaff AI 的 GEO 服务身份尚未配置",
      );
    const models = await gateway.models(
      identity.onlyCookie(request.headers.cookie),
    );
    const names = describeModels ? await describeModels() : {};
    return {
      data: models.map((model) => ({
        model,
        displayName: names[model] || model,
        productId: modelProducts[model] || "futurestaff-ai",
        channel: "MODEL_API",
        searchState: "UNKNOWN",
      })),
    };
  });
  app.get("/api/geo/v1/agents", async () => ({
    data: [
      "doubao",
      "deepseek",
      "kimi",
      "qwen",
      "yuanbao",
      "chatgpt",
      "gemini",
      "custom-agent",
    ].map((productId) => ({
      productId,
      readiness: "PLANNED",
      channel: "MODEL_API",
      authority: "FUTURESTAFF_AI",
      webSearch: "UNKNOWN",
      citations: "UNKNOWN",
      verifiedAt: null,
    })),
    pagination: { page: 1, pageSize: 8, totalItems: 8 },
  }));
  app.get("/api/geo/v1/projects", async (request) => {
    const p = pageSchema.parse(request.query);
    return repo.listProjects(principal(request), p.page, p.pageSize);
  });
  app.post("/api/geo/v1/projects", async (request, reply) => {
    const input = projectInput.parse(request.body);
    return reply
      .code(201)
      .send({ data: await repo.createProject(principal(request), input) });
  });
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id",
    async (request) => ({
      data: await repo.getProject(principal(request), uuid(request.params.id)),
    }),
  );
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/prompts",
    async (request) => {
      const p = pageSchema.parse(request.query);
      return {
        data: await repo.prompts(
          principal(request),
          uuid(request.params.id),
          p.page,
          p.pageSize,
        ),
        pagination: { page: p.page, pageSize: p.pageSize },
      };
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/prompts",
    async (request, reply) => {
      const input = promptInput.parse(request.body);
      const projectId = uuid(request.params.id);
      const actor = principal(request);
      const project = await repo.getProject(actor, projectId);
      const branded =
        input.branded ||
        matchBrands(input.question, { ...brand(project), competitors: [] })
          .length > 0;
      return reply
        .code(201)
        .send({
          data: await repo.createPrompt(
            actor,
            projectId,
            input.question,
            branded,
          ),
        });
    },
  );
  app.post<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/evidence",
    async (request, reply) =>
      reply
        .code(201)
        .send({
          data: await repo.importEvidence(
            principal(request),
            uuid(request.params.id),
            evidenceInput.parse(request.body),
          ),
        }),
  );
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/evidence",
    async (request) => {
      const p = pageSchema.parse(request.query);
      const rows = await repo.evidence(
        principal(request),
        uuid(request.params.id),
        p.pageSize,
        (p.page - 1) * p.pageSize,
        !fixtureMode,
      );
      return { data: rows, pagination: { page: p.page, pageSize: p.pageSize } };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/metrics",
    async (request) => {
      const actor = principal(request);
      const id = uuid(request.params.id);
      const project = await repo.getProject(actor, id);
      const rows = (await repo.analysisRows(actor, id)).filter(row => fixtureMode || row.provenance !== 'FIXTURE');
      const groups = new Map<string, Evidence[]>();
      for (const row of rows) {
        const key = JSON.stringify([
          row.product_id,
          row.model,
          row.channel,
          row.search_state,
          row.provenance,
        ]);
        const items = groups.get(key) || [];
        items.push(row);
        groups.set(key, items);
      }
      return {
        data: [...groups.values()].map((items) => ({
          productId: items[0].product_id,
          model: items[0].model,
          channel: items[0].channel,
          searchState: items[0].search_state,
          provenance: items[0].provenance,
          ...summarize(
            items.map((x) => ({
              answer: x.answer,
              branded: x.branded,
              citations: x.citations,
              citationState: x.citation_state,
              state: x.state,
            })),
            brand(project),
          ),
        })),
      };
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/export",
    async (request, reply) => {
      const rows = await repo.evidence(
        principal(request),
        uuid(request.params.id),
        1001,
        0,
        !fixtureMode,
      );
      if (rows.length > 1000)
        throw new GeoError(
          "EXPORT_LIMIT",
          422,
          "当前同步导出最多 1000 条，请缩小范围",
        );
      const csv = [
        "product,model,channel,search,provenance,question,answer,citations",
        ...rows.map((x) =>
          [
            x.product_id,
            x.model,
            x.channel,
            x.search_state,
            x.provenance,
            x.question,
            x.answer,
            x.citations.join(" "),
          ]
            .map(csvCell)
            .join(","),
        ),
      ].join("\r\n");
      reply
        .header(
          "Content-Disposition",
          'attachment; filename="geo-evidence.csv"',
        )
        .type("text/csv; charset=utf-8");
      return `\uFEFF${csv}`;
    },
  );
  app.get<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/runs",
    async (request) => ({
      data: await repo.runs(principal(request), uuid(request.params.id)),
    }),
  );
  app.post<{ Params: { id: string } }>(
    "/api/geo/v1/projects/:id/runs",
    async (request, reply) => {
      const actor = principal(request);
      const projectId = uuid(request.params.id);
      await repo.getProject(actor, projectId);
      if (!gateway)
        throw new GeoError(
          "AI_GATEWAY_NOT_READY",
          503,
          "FutureStaff AI 的 GEO 服务身份尚未配置，采集保持关闭",
        );
      const input = z
        .object({ promptId: z.uuid(), model: z.string().min(1).max(200) })
        .strict()
        .parse(request.body);
      const key = z
        .string()
        .regex(/^[a-zA-Z0-9_-]{8,64}$/)
        .parse(request.headers["idempotency-key"]);
      const models = await gateway.models(
        identity.onlyCookie(request.headers.cookie),
      );
      if (!models.includes(input.model))
        throw new GeoError(
          "MODEL_NOT_ALLOWED",
          403,
          "该模型未向当前主体的 GEO 开放",
        );
      const task = await repo.createRun(
        actor,
        projectId,
        input.promptId,
        input.model,
        key,
      );
      if (!task.isNew) return { data: task.run };
      let raw: unknown = null;
      try {
        raw = await gateway.chat(
          identity.onlyCookie(request.headers.cookie),
          task.run.id,
          input.model,
          task.question,
        );
        const parsed = parseCompletion(raw);
        const run = await repo.finishRun(
          actor,
          task.run,
          {
            promptId: input.promptId,
            productId: modelProducts[input.model] || "futurestaff-ai",
            model: parsed.model,
            channel: "MODEL_API",
            searchState: "UNKNOWN",
            state: "SUCCEEDED",
            citationState: parsed.citationState,
            answer: parsed.answer,
            citations: parsed.citations,
            collectedAt: new Date().toISOString(),
          },
          raw,
          null,
          fixtureMode ? 'FIXTURE' : 'COLLECTED',
        );
        return reply.code(201).send({ data: run });
      } catch (error) {
        const run = await repo.finishRun(
          actor,
          task.run,
          null,
          raw,
          error instanceof GeoError ? error.code : "AI_RESULT_UNKNOWN",
        );
        return reply.code(201).send({ data: run });
      }
    },
  );
  contentRoutes(app, repo, principal,writingEnabled && !!(writingGateway||gateway));
  aiDraftRoutes(app,repo,principal,c=>identity.onlyCookie(c),writingGateway||gateway,writingEnabled,describeModels);
  return app;
}
