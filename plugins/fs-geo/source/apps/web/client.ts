export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
let epoch = 0;
let context: string | null = null;
export function resetContext() {
  epoch++;
  context = null;
}
function invalidate() {
  resetContext();
  window.dispatchEvent(new Event("geo-session-invalid"));
}
export async function api<T>(
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<T> {
  const startedEpoch = epoch;
  const response = await fetch(`/_futurestaff/geo/api/geo/v1${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? { ...extraHeaders, "x-futurestaff-geo": "1" }
        : { "content-type": "application/json", "x-futurestaff-geo": "1", ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json();
  if (startedEpoch !== epoch)
    throw new ApiError(409, "CONTEXT_CHANGED", "主体或会话已变化，请重新核验");
  if (!response.ok) {
    if (
      response.status === 401 ||
      [
        "APPLICATION_ACCESS_DENIED",
        "PLATFORM_INVALID_RESPONSE",
        "PLATFORM_UNAVAILABLE",
      ].includes(payload.error?.code)
    )
      invalidate();
    throw new ApiError(
      response.status,
      payload.error?.code || "NETWORK_ERROR",
      payload.error?.message || "请求失败",
    );
  }
  const received = [
    response.headers.get("X-GEO-Tenant"),
    response.headers.get("X-GEO-User"),
  ].join("/");
  if (context && context !== received) {
    invalidate();
    throw new ApiError(409, "CONTEXT_CHANGED", "主体或账号已变化，请重新核验");
  }
  context = received;
  return payload as T;
}
export interface Session {
  tenantId: string;
  userId: string;
  displayName: string;
  tenantName: string;
  permissions: string[];
}
export interface Project {
  id: string;
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
  product_id: string;
  model: string;
  channel: string;
  search_state: string;
  provenance: string;
  answer: string;
  question: string;
  citations: string[];
  state: string;
  sha256: string;
  raw_response: unknown;
}
export interface Metric {
  productId: string;
  model: string;
  channel: string;
  searchState: string;
  provenance: string;
  validAnswers: number;
  failedAnswers: number;
  mentionRate: number | null;
  citationRate: number | null;
  shareOfVoice: number | null;
}
export function message(error: unknown) {
  return error instanceof Error ? error.message : "请求未完成，请重试";
}
export function split(value: FormDataEntryValue | null) {
  return String(value || "")
    .split(/[,，\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}
