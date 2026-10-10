import { platforms, type BrandProfile } from "./content-types.js";
export * from "./content-types.js";
import { z } from "zod";
import { GeoError } from "./errors.js";

const short = z.string().trim().min(1).max(200);
export const safeUrl = z
  .url()
  .max(2000)
  .refine(
    (v) =>
      ["http:", "https:"].includes(new URL(v).protocol) &&
      !new URL(v).username &&
      !new URL(v).password,
  );
export const profileInput = z
  .object({
    version: z.number().int().min(0),
    business: z.string().trim().max(6000),
    audience: z.string().trim().max(2000),
    facts: z.string().trim().max(12000),
    tone: z.string().trim().max(500),
  })
  .strict();
export const topicInput = z
  .object({ title: short, promptId: z.uuid().nullable().default(null) })
  .strict();
export const articleInput = z
  .object({
    title: short,
    body: z.string().trim().min(1).max(60000),
    summary: z.string().trim().max(2000).default(""),
    topicId: z.uuid().nullable().default(null),
    sources: z.array(safeUrl).max(30).default([]),
  })
  .strict();
export const editInput = articleInput
  .extend({ version: z.number().int().positive() })
  .strict();
export const reviewInput = z
  .object({
    version: z.number().int().positive(),
    action: z.enum(["SUBMIT", "APPROVE", "REJECT"]),
    comment: z.string().trim().max(2000).default(""),
  })
  .strict();
export const accountInput = z
  .object({ platform: z.enum(platforms), label: short })
  .strict();
export const planInput = z
  .object({
    articleId: z.uuid(),
    version: z.number().int().positive(),
    accountId: z.uuid(),
    scheduledAt: z.iso.datetime({ offset: true }),
    mode: z.enum(["MANUAL", "AUTOMATIC"]),
  })
  .strict();
export const recordInput = z
  .object({
    planId: z.uuid(),
    url: safeUrl,
    publishedAt: z.iso.datetime({ offset: true }),
    note: z.string().trim().max(2000).default(""),
  })
  .strict();
export function reviewState(
  state: string,
  action: z.infer<typeof reviewInput>["action"],
  admin: boolean,
) {
  if (action !== "SUBMIT" && !admin)
    throw new GeoError("FORBIDDEN", 403, "文章审核需要 GEO 管理员权限");
  if (action === "SUBMIT" && state === "DRAFT") return "IN_REVIEW";
  if (action === "APPROVE" && state === "IN_REVIEW") return "APPROVED";
  if (action === "REJECT" && state === "IN_REVIEW") return "DRAFT";
  throw new GeoError(
    "CONTENT_STATE_CONFLICT",
    409,
    "文章状态已变化，请刷新后按草稿、提审、审核顺序操作",
  );
}
export function futureTime(value: string, now = Date.now()) {
  if (!Number.isFinite(Date.parse(value)) || Date.parse(value) <= now)
    throw new GeoError(
      "SCHEDULE_INVALID",
      422,
      "请选择未来的发布时间（北京时间）",
    );
}
export function writingBrief(
  brand: string,
  profile: BrandProfile,
  topic: string,
) {
  return `# 写作任务：${topic}\n\n品牌：${brand}\n业务：${profile.business || "待补充"}\n目标读者：${profile.audience || "待补充"}\n语气：${profile.tone || "客观、实用"}\n\n## 可核验资料\n${profile.facts || "尚无资料，请先补充来源；不要编造事实。"}\n\n## 建议结构\n1. 直接回答读者的问题\n2. 解释选择标准与适用场景\n3. 使用可核验资料说明品牌能解决的问题\n4. 说明限制与引用来源\n\n不编造排名、客户案例、认证、价格或效果保证。此为本地写作提纲，未调用模型。`;
}
