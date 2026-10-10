import { useEffect, useRef, useState } from "react";
import type { AiDraftTask } from "../../../packages/core/content-types";
import { api, message, split } from "../client";

export function AiDrafting({
  base,
  title,
  topicId,
  sources,
  brandVersion,
  disabled,
  onApply,
}: {
  base: string;
  title: string;
  topicId: string;
  sources: string;
  brandVersion: number;
  disabled: boolean;
  onApply: (
    result: NonNullable<AiDraftTask["result"]>,
    topicId: string | null,
  ) => void;
}) {
  const [config, setConfig] = useState<{
    enabled: boolean;
    models: string[]; modelNames?: Record<string,string>;
  } | null>(null);
  const [model, setModel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [tasks, setTasks] = useState<AiDraftTask[]>([]);
  const [selected, setSelected] = useState<AiDraftTask | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unconfirmed, setUnconfirmed] = useState(false);
  const lock = useRef(false),
    alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void Promise.all([
      api<{ data: { enabled: boolean; models: string[]; modelNames?: Record<string,string> } }>(
        base + "/ai-drafts/config",
      ),
      api<{ data: AiDraftTask[] }>(base + "/ai-drafts"),
    ])
      .then(([c, t]) => {
        if (!alive.current) return;
        setConfig(c.data);
        setModel(
          c.data.models.includes("futurestaff")
            ? "futurestaff"
            : c.data.models[0] || "",
        );
        setTasks(t.data);
      })
      .catch((e) => {
        if (alive.current) setError(message(e));
      });
    return () => {
      alive.current = false;
    };
  }, [base]);
  async function refresh() {
    try {
      const [r, c] = await Promise.all([
        api<{ data: AiDraftTask[] }>(base + "/ai-drafts"),
        api<{ data: { enabled: boolean; models: string[]; modelNames?: Record<string,string> } }>(
          base + "/ai-drafts/config",
        ),
      ]);
      if (alive.current) {
        setTasks(r.data);
        setConfig(c.data);
        setModel((previous) =>
          c.data.models.includes(previous)
            ? previous
            : c.data.models.includes("futurestaff")
              ? "futurestaff"
              : c.data.models[0] || "",
        );
        setError("");
      }
    } catch (e) {
      if (alive.current) setError(message(e));
    }
  }
  async function generate() {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setSelected(null);
    try {
      const r = await api<{ data: AiDraftTask }>(
        base + "/ai-drafts",
        {
          title,
          topicId: topicId || null,
          brandVersion,
          model,
          instructions,
          sources: split(sources),
        },
        { "Idempotency-Key": crypto.randomUUID() },
      );
      if (alive.current) {
        setSelected(r.data);
        setTasks((previous) =>
          [r.data, ...previous.filter((t) => t.id !== r.data.id)].slice(0, 20),
        );
        setUnconfirmed(r.data.state !== "SUCCEEDED");
      }
    } catch (e) {
      if (alive.current) {
        setError(message(e));
        setUnconfirmed(true);
      }
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  const result = selected?.result;
  return (
    <div className="wide ai-drafting">
      <h3>AI 文章起草</h3>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!config ? (
        <p>正在核验 GEO 可用模型…</p>
      ) : !config.enabled ? (
        <p className="notice">AI 写稿尚未启用，可先使用免费本地提纲。</p>
      ) : (
        <>
          <div className="form-grid">
            <label>
              写稿模型
              <select
                aria-label="写稿模型"
                value={model}
                disabled={disabled || busy}
                onChange={(e) => setModel(e.target.value)}
              >
                {!config.models.length && (
                  <option value="">当前主体尚未向 GEO 开放模型</option>
                )}
                {config.models.map((m) => (
                  <option key={config.modelNames?.[m] || m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label>
              写作要求（可选）
              <textarea
                rows={2}
                maxLength={2000}
                value={instructions}
                disabled={disabled || busy}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </label>
          </div>
          <p className="notice">
            每次生成只调用所选 DSH 授权模型，费用按平台当前模型规则计算；这里不提供金额预算保证。事实引用只采用你提供的链接，生成后请人工核对。
          </p>
          {unconfirmed && (
            <p className="notice" role="status">
              上次结果未确认。先刷新任务记录核对；再次生成会发起新的模型调用，可能再次计费。
            </p>
          )}
          <button
            type="button"
            className="primary"
            disabled={
              disabled ||
              busy ||
              unconfirmed ||
              !model ||
              !title.trim() ||
              !brandVersion
            }
            onClick={() => void generate()}
          >
            {busy ? "AI 正在起草…" : "AI 起草文章"}
          </button>
          {unconfirmed && (
            <button
              type="button"
              disabled={disabled || busy}
              onClick={() => {
                setUnconfirmed(false);
                setSelected(null);
              }}
            >
              确认开始新的起草
            </button>
          )}
        </>
      )}
      <button type="button" disabled={busy} onClick={() => void refresh()}>
        刷新起草记录
      </button>
      {tasks.length > 0 && (
        <details open>
          <summary>最近起草记录（仅自己的请求）</summary>
          <ul>
            {tasks.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setSelected(t)}>
                  {t.input.title} · {t.model} ·{" "}
                  {t.state === "SUCCEEDED"
                    ? "已生成"
                    : t.state === "RUNNING"
                      ? "生成中"
                      : "结果未知"}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      {selected && (
        <div className="notice" role="status">
          请求 {selected.id} ·{" "}
          {selected.state === "SUCCEEDED"
            ? "已生成，可填入编辑器后保存草稿"
            : selected.state === "RUNNING"
              ? "生成中，请稍后刷新记录；不要重复提交"
              : `结果未知（${selected.error_code || "UNKNOWN"}），不会自动重试`}
        </div>
      )}
      {result && (
        <details open>
          <summary>AI 生成结果 · 待人工核对</summary>
          <h4>{result.title}</h4>
          <p>{result.summary}</p>
          <pre>{result.body}</pre>
          {result.sources.map((s) => (
            <p key={s}>
              <a href={s} target="_blank" rel="noopener noreferrer">
                {s}
              </a>
            </p>
          ))}
          <button
            type="button"
            disabled={disabled || busy}
            onClick={() => onApply(result, selected?.input.topicId || null)}
          >
            将生成结果填入编辑器
          </button>
          <p>
            此操作会替换当前标题、摘要、正文和引用。填写后还需点击“保存文章草稿”。
          </p>
        </details>
      )}
    </div>
  );
}
