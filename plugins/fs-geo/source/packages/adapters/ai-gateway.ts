import { z } from "zod";
import { GeoError } from "../core/errors.js";
export class AiGateway {
  constructor(
    private config: { url: string; serviceToken: string },
    private fetcher: typeof fetch = fetch,
  ) {
    if (
      new URL(config.url).protocol !== "https:" ||
      config.serviceToken.length < 32
    )
      throw new GeoError("AI_GATEWAY_NOT_READY", 503, "AI 服务配置无效");
  }
  private async request(
    path: string,
    cookie: string,
    body?: unknown,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetcher(
        new URL(`/ai-api/runtime/v1/${path}`, this.config.url),
        {
          method: body === undefined ? "GET" : "POST",
          redirect: "error",
          signal: AbortSignal.timeout(body === undefined ? 15000 : 130000),
          headers: {
            "X-AI-Service-Token": this.config.serviceToken,
            "X-FutureStaff-Module-Session": cookie,
            ...(body === undefined
              ? {}
              : { "content-type": "application/json" }),
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );
    } catch {
      throw new GeoError(
        "AI_RESULT_UNKNOWN",
        503,
        "AI 请求结果未知，请勿重复发起收费调用",
      );
    }
    let payload: unknown;
    try {
      const text = await response.text();
      if (text.length > 1000000) throw new Error();
      payload = JSON.parse(text);
    } catch {
      throw new GeoError("AI_INVALID_RESPONSE", 502, "AI 响应无法完整验证");
    }
    if (!response.ok) {
      const error = z
        .object({
          error: z.object({ code: z.string().regex(/^[A-Z0-9_]{1,80}$/) }),
        })
        .safeParse(payload);
      throw new GeoError(
        error.success ? error.data.error.code : "AI_REQUEST_REJECTED",
        response.status >= 500 ? 503 : response.status,
        "FutureStaff AI 拒绝或未确认该请求，请核对模型授权与任务状态",
      );
    }
    return payload;
  }
  async models(cookie: string) {
    const data = z
      .object({
        systemId: z.literal("geo"),
        items: z.array(z.string().min(1).max(200)).max(1000),
      })
      .safeParse(await this.request("models", cookie));
    if (!data.success)
      throw new GeoError(
        "AI_INVALID_RESPONSE",
        502,
        "AI 模型目录与 GEO 系统不匹配",
      );
    return data.data.items;
  }
  chat(cookie: string, requestId: string, model: string, question: string) {
    return this.request("chat/completions", cookie, {
      requestId,
      scene: "geo-visibility",
      model,
      messages: [{ role: "user", content: question }],
      max_tokens: 2000,
    });
  }
  draft(cookie:string,requestId:string,model:string,messages:{role:"system"|"user";content:string}[]) {
    return this.request("chat/completions",cookie,{requestId,scene:"geo-article-drafting",model,messages,max_tokens:4000});
  }
}
export function parseCompletion(raw: unknown) {
  const parsed = z
    .object({
      model: z.string().optional(),
      choices: z
        .array(
          z.object({
            message: z.object({ content: z.string().min(1).max(100000) }),
            finish_reason: z.string().nullish(),
          }),
        )
        .min(1),
      citations: z
        .array(
          z
            .url()
            .refine((x) => ["http:", "https:"].includes(new URL(x).protocol)),
        )
        .max(100)
        .optional(),
    })
    .safeParse(raw);
  if (
    !parsed.success ||
    !parsed.data.choices[0].message.content.trim() ||
    parsed.data.choices[0].finish_reason === "length"
  )
    throw new GeoError(
      "AI_INVALID_RESPONSE",
      502,
      "AI 回答为空、截断或无法验证",
    );
  return {
    answer: parsed.data.choices[0].message.content,
    model: parsed.data.model || "unknown",
    citations: parsed.data.citations || [],
    citationState: parsed.data.citations ? "COMPLETE" : "UNKNOWN",
  };
}
