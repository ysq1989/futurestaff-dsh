import { useEffect, useState, type FormEvent } from "react";
import { api, message, type Prompt } from "./client";
export function Collection({
  base,
  prompts,
  canWrite,
  refresh,
}: {
  base: string;
  prompts: Prompt[];
  canWrite: boolean;
  refresh: () => Promise<void>;
}) {
  const [models, setModels] = useState<{ model: string; productId: string; displayName?: string }[]>(
    [],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    let active = true;
    api<{ data: { model: string; productId: string; displayName?: string }[] }>("/ai-models")
      .then((r) => {
        if (active) setModels(r.data);
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function collect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<{
        data: { state: string; error_code: string | null };
      }>(
        `${base}/runs`,
        { promptId: data.get("promptId"), model: data.get("model") },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      setNotice(
        result.data.state === "SUCCEEDED"
          ? "测量完成，原始回答已保存。"
          : `结果未知（${result.data.error_code || "UNKNOWN"}），请查看原任务，不要重复发起收费请求。`,
      );
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel" id="geo-measurement">
      <h2>模型 API 测量</h2>
      <p>
        使用 DSH 当前已授权的模型，每次提交测量一个问题，调用按平台规则计费。当前适配器不提供可核验的联网或来源引用元数据；产品网页采集尚未启用。
      </p>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <form onSubmit={(event) => void collect(event)} className="form-grid">
        <label>
          测量问题
          <select
            name="promptId"
            required
            disabled={busy || !canWrite || !prompts.length}
          >
            <option value="">选择问题</option>
            {prompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.question}
              </option>
            ))}
          </select>
        </label>
        <label>
          主体获准模型
          <select
            name="model"
            required
            disabled={busy || !canWrite || !models.length}
          >
            <option value="">
              {models.length ? "选择模型" : "AI 未开通或暂无可用模型"}
            </option>
            {models.map((m) => (
              <option key={m.model} value={m.model}>
                {m.displayName || m.model}
              </option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          disabled={busy || !canWrite || !models.length || !prompts.length}
        >
          {busy ? "测量中，请勿重复提交…" : "提交一次测量"}
        </button>
      </form>
    </section>
  );
}
