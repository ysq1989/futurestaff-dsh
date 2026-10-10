export const platforms = [
  "toutiao",
  "baijiahao",
  "sohu",
  "zhihu",
  "wechat",
  "website",
] as const;
export const platformNames: Record<string, string> = {
  toutiao: "今日头条",
  baijiahao: "百家号",
  sohu: "搜狐号",
  zhihu: "知乎",
  wechat: "微信公众号",
  website: "品牌官网",
};
export const stateNames: Record<string, string> = {
  DRAFT: "草稿",
  IN_REVIEW: "待审核",
  APPROVED: "已审核",
  PLANNED: "待发布",
  NEEDS_ACTION: "需人工处理",
  RUNNING: "执行中",
  SUBMITTED: "平台已接收 / 待审核",
  PUBLISHED: "已公开（人工登记）",
  FAILED: "失败",
  UNKNOWN: "结果未知",
  CANCELLED: "已取消",
};
export interface BrandProfile {
  version: number;
  business: string;
  audience: string;
  facts: string;
  tone: string;
}
export interface TenantBrand extends BrandProfile {
  brand: string;
  aliases: string[];
  domains: string[];
  competitors: string[];
}
export interface Topic {
  id: string;
  title: string;
  prompt_id: string | null;
  question: string | null;
}
export interface Article {
  id: string;
  version: number;
  state: string;
  title: string;
  body: string;
  summary: string;
  topic_id: string | null;
  sources: string[];
}
export interface Account {
  id: string;
  platform: string;
  label: string;
  mode: "MANUAL";
}
export interface Plan {
  id: string;
  article_id: string;
  version: number;
  account_id: string;
  platform: string;
  label: string;
  mode: string;
  state: string;
  scheduled_at: string;
  title: string;
  body: string;
  error_code: string | null;
}
export interface PublicationRecord {
  id: string;
  plan_id: string;
  url: string;
  published_at: string;
  note: string;
  provenance: "MANUAL_REPORT";
  title: string;
  platform: string;
  label: string;
}
export interface ContentSnapshot {
  profile: BrandProfile;
  topics: Topic[];
  articles: Article[];
  accounts: Account[];
  plans: Plan[];
  records: PublicationRecord[];
  reviews: {
    article_id: string;
    version: number;
    action: string;
    comment: string;
    created_at: string;
  }[];
  pagination: { page: number; pageSize: number };
  capabilities: { automaticPublishing: false; aiDrafting: boolean };
}
export interface AiDraftTask {
  id: string; project_id: string; actor_id: string; model: string;
  state: "RUNNING" | "SUCCEEDED" | "UNKNOWN";
  result: { title:string; summary:string; body:string; sources:string[] } | null;
  input: { topicId:string|null; title:string; model:string; instructions:string; sources:string[]; brandVersion:number };
  error_code: string|null; created_at:string;
}
