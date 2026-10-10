import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Repository } from "../../packages/storage/repository.js";
import type { Identity } from "../../packages/platform/identity.js";
import { AiDraftRepository } from "../../packages/storage/ai-drafts.js";
import {
  draftingInput,
  draftingMessages,
  parseDraft,
} from "../../packages/core/ai-drafting.js";
import { GeoError } from "../../packages/core/errors.js";
import {
  parseCompletion,
  type AiGateway,
} from "../../packages/adapters/ai-gateway.js";

export function aiDraftRoutes(
  app: FastifyInstance,
  repo: Repository,
  principal: (r: object) => Identity,
  cookie: (c: string | undefined) => string,
  gateway?: Pick<AiGateway,"models"|"chat"|"draft">,
  enabled = false,
  describeModels?: () => Promise<Record<string, string>>,
) {
  const drafts = new AiDraftRepository(repo);
  const base = "/api/geo/v1/projects/:id/ai-drafts";
  type Params = { id: string; draftId: string };
  app.get<{ Params: Params }>(base + "/config", async (request) => {
    await repo.getProject(
      principal(request),
      z.uuid().parse(request.params.id),
    );
    return {
      data: {
        enabled: enabled && !!gateway,
        models:
          enabled && gateway
            ? await gateway.models(cookie(request.headers.cookie))
            : [],
        modelNames: describeModels ? await describeModels() : {},
        maxOutputTokens: 4096,
      },
    };
  });
  app.get<{ Params: Params }>(base, async (request) => ({
    data: await drafts.list(
      principal(request),
      z.uuid().parse(request.params.id),
    ),
  }));
  app.get<{ Params: Params }>(base + "/:draftId", async (request) => {
    const row = (
      await drafts.list(
        principal(request),
        z.uuid().parse(request.params.id),
        z.uuid().parse(request.params.draftId),
      )
    )[0];
    if (!row) throw new GeoError("NOT_FOUND", 404, "起草请求不存在或无权查看");
    return { data: row };
  });
  app.post<{ Params: Params }>(base, async (request, reply) => {
    const actor = principal(request),
      project = z.uuid().parse(request.params.id);
    await repo.getProject(actor, project);
    if (!enabled || !gateway)
      throw new GeoError(
        "AI_DRAFTING_NOT_VERIFIED",
        409,
        "AI 写稿尚未启用，请核对 GEO 系统 AI 接入配置",
      );
    const input = draftingInput.parse(request.body);
    const key = z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,128}$/)
      .parse(request.headers["idempotency-key"]);
    const session = cookie(request.headers.cookie);
    if (!(await gateway.models(session)).includes(input.model))
      throw new GeoError(
        "MODEL_NOT_ALLOWED",
        403,
        "所选模型未向当前主体的 GEO 系统开放",
      );
    const task = await drafts.create(actor, project, key, input);
    if (task.isNew && task.brand) {
      let result = null,
        error = null;
      try {
        result = parseDraft(
          parseCompletion(
            await gateway.draft(
              session,
              task.id,
              input.model,
              draftingMessages(input, task.brand),
            ),
          ).answer,
          input,
        );
      } catch (e) {
        error = e instanceof GeoError ? e.code : "AI_RESULT_UNKNOWN";
      }
      await drafts.finish(actor, project, task.id, result, error);
    }
    const data = (await drafts.list(actor, project, task.id))[0];
    return reply.code(task.isNew ? 201 : 200).send({ data });
  });
}
