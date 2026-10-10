import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  api,
  message,
  split,
  type Project,
  type Prompt,
  type Evidence,
  type Metric,
} from "./client";
import { Collection } from "./Collection";
function percent(value: number | null) {
  return value === null ? "不可测" : `${(value * 100).toFixed(1)}%`;
}
function EvidenceInspector({ row }: { row: Evidence }) {
  return (
    <details>
      <summary>
        {row.product_id} · {row.model}{" "}
        <span className="badge">
            {row.provenance === "MANUAL_IMPORT" ? "手工导入" : row.provenance === 'FIXTURE' ? '测试数据' : "实际采集"}
        </span>
      </summary>
      <p>
        {row.channel} · 搜索：{row.search_state} · {row.state}
      </p>
      <h3>原始问题</h3>
      <p>{row.question}</p>
      <h3>原始回答</h3>
      <pre>{row.answer || "没有有效回答"}</pre>
      <h3>引用来源</h3>
      <ul>
        {row.citations.map((url, index) => (
          <li key={index}>
            <a href={url} target="_blank" rel="noopener noreferrer">
              {url}
            </a>
          </li>
        ))}
      </ul>
      <p className="muted">
        证据 SHA-256：<code>{row.sha256}</code>
      </p>
    </details>
  );
}
export function Workspace({
  project,
  canWrite,
  back,
}: {
  project: Project;
  canWrite: boolean;
  back: () => void;
}) {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [runs, setRuns] = useState<
    { id: string; model: string; state: string; error_code: string | null }[]
  >([]);
  const base = `/projects/${project.id}`;
  const reload = useCallback(async () => {
    const [p, e, m, r] = await Promise.all([
      api<{ data: Prompt[] }>(`${base}/prompts?pageSize=100`),
      api<{ data: Evidence[] }>(`${base}/evidence?page=${page}&pageSize=20`),
      api<{ data: Metric[] }>(`${base}/metrics`),
      api<{ data: typeof runs }>(`${base}/runs`),
    ]);
    setPrompts(p.data);
    setEvidence(e.data);
    setMetrics(m.data);
    setRuns(r.data);
  }, [base, page]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    reload()
      .catch((err) => {
        if (active) setError(message(err));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    kind: "prompt" | "evidence",
  ) {
    event.preventDefault();
    const form = event.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api(
        `${base}/${kind === "prompt" ? "prompts" : "evidence"}`,
        kind === "prompt"
          ? { question: f.get("question") }
          : {
              promptId: f.get("promptId"),
              productId: f.get("productId"),
              model: f.get("model"),
              channel: f.get("channel"),
              searchState: f.get("searchState"),
              answer: f.get("answer"),
              citations: split(f.get("citations")),
              citationState: f.get("citationState"),
              collectedAt: new Date(String(f.get("collectedAt"))).toISOString(),
            },
      );
      form.reset();
      await reload();
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="back" onClick={back}>
        ← 推广计划
      </button>
      <header className="page-heading">
        <div>
          <h1>{project.name}</h1>
          <p>
            {project.brand} · {project.domains.join("、") || "官网待配置"}
          </p>
        </div>
        <span className="badge">模型 API / 产品网页分别统计</span>
      </header>
      <nav className="workspace-sections" aria-label="项目章节"><a href="#geo-questions">用户问题</a><a href="#geo-measurement">模型测量</a><a href="#geo-comparison">Agent 对比</a><a href="#geo-evidence">原始证据</a></nav>
      <div className="notice">
        模型测量需要主体开通 GEO 系统
        AI。已有回答也可导入，始终标记为“手工导入”；Agent 支持状态需真实验证。
      </div>
      {error && (
        <div role="alert" className="error">
          {error}{" "}
          <button
            onClick={() => {
              setError("");
              void reload().catch((e) => setError(message(e)));
            }}
          >
            重新加载
          </button>
        </div>
      )}
      {loading ? (
        <p role="status" className="loading">
          正在读取项目数据…
        </p>
      ) : (
        <>
          <section className="panel" id="geo-questions">
            <h2>用户问题</h2>
            <form
              onSubmit={(event) => void submit(event, "prompt")}
              className="inline-form"
            >
              <label className="grow">
                用户会问什么？
                <input
                  name="question"
                  required
                  maxLength={4000}
                  disabled={!canWrite || busy}
                />
              </label>
              <button className="primary" disabled={!canWrite || busy}>
                {busy ? "保存中…" : "添加问题"}
              </button>
            </form>
            {prompts.length ? (
              <ul className="prompt-list">
                {prompts.map((p) => (
                  <li key={p.id}>
                    {p.question}{" "}
                    {p.branded && (
                      <span className="badge">含品牌 · 排除自然提及指标</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">
                还没有问题。先添加一个真实用户会问的问题。
              </p>
            )}
          </section>
          <Collection
            base={base}
            prompts={prompts}
            canWrite={canWrite}
            refresh={reload}
          />
          {runs.length > 0 && (
            <section className="panel">
              <h2>
                测量记录 <small>最近 100 条</small>
              </h2>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>请求 ID</th>
                      <th>模型</th>
                      <th>状态</th>
                      <th>错误代码</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <code>{r.id}</code>
                        </td>
                        <td>{r.model}</td>
                        <td>{r.state}</td>
                        <td>{r.error_code || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
          <section className="panel">
            <h2>导入已有回答证据</h2>
            <p>
              请保留实际回答和采集时间。无法确认的搜索状态或引用完整性选择“未知”。
            </p>
            <form
              onSubmit={(event) => void submit(event, "evidence")}
              className="form-grid"
            >
              <label>
                问题
                <select
                  name="promptId"
                  required
                  disabled={!canWrite || busy || !prompts.length}
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
                Agent / 产品
                <input
                  name="productId"
                  placeholder="doubao、deepseek 或其他"
                  required
                  disabled={!canWrite || busy}
                />
              </label>
              <label>
                实际模型版本
                <input
                  name="model"
                  defaultValue="unknown"
                  required
                  disabled={!canWrite || busy}
                />
              </label>
              <label>
                采集渠道
                <select name="channel" disabled={!canWrite || busy}>
                  <option value="PRODUCT_WEB">产品网页</option>
                  <option value="MODEL_API">模型 API</option>
                  <option value="THIRD_PARTY">第三方采集</option>
                </select>
              </label>
              <label>
                联网状态
                <select name="searchState" disabled={!canWrite || busy}>
                  <option value="UNKNOWN">未知</option>
                  <option value="ENABLED">已联网（有依据）</option>
                  <option value="DISABLED">未联网</option>
                </select>
              </label>
              <label>
                引用完整性
                <select name="citationState" disabled={!canWrite || busy}>
                  <option value="UNKNOWN">未知 / 无法测量</option>
                  <option value="COMPLETE">完整采集（允许没有引用）</option>
                  <option value="UNSUPPORTED">不支持引用</option>
                </select>
              </label>
              <label>
                实际采集时间
                <input
                  name="collectedAt"
                  type="datetime-local"
                  required
                  disabled={!canWrite || busy}
                />
              </label>
              <label className="wide">
                原始回答
                <textarea
                  name="answer"
                  rows={5}
                  required
                  maxLength={100000}
                  disabled={!canWrite || busy}
                />
              </label>
              <label className="wide">
                平台引用 URL
                <textarea
                  name="citations"
                  rows={2}
                  placeholder="每行一个引用 URL；普通正文链接不要填在此处"
                  disabled={!canWrite || busy}
                />
              </label>
              <div className="wide">
                <button
                  className="primary"
                  disabled={!canWrite || busy || !prompts.length}
                >
                  {busy ? "保存中…" : "保存证据"}
                </button>
              </div>
            </form>
          </section>
          <section className="panel" id="geo-comparison">
            <h2>Agent 对比</h2>
            <p>
              分渠道、模型、联网状态及证据来源独立统计；含品牌问题排除。指标是所收集样本的观察结果。
            </p>
            {metrics.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Agent / 模型</th>
                      <th>渠道 / 来源</th>
                      <th>搜索</th>
                      <th>有效 / 失败</th>
                      <th>提及率</th>
                      <th>引用率</th>
                      <th>竞品份额</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map((m, index) => (
                      <tr key={index}>
                        <td>
                          {m.productId}
                          <small>{m.model}</small>
                        </td>
                        <td>
                          {m.channel}
                          <small>
                        {m.provenance === "MANUAL_IMPORT"
                          ? "手工导入"
                          : m.provenance === 'FIXTURE' ? '测试数据' : "实际采集"}
                          </small>
                        </td>
                        <td>{m.searchState}</td>
                        <td>
                          {m.validAnswers} / {m.failedAnswers}
                        </td>
                        <td>{percent(m.mentionRate)}</td>
                        <td>{percent(m.citationRate)}</td>
                        <td>{percent(m.shareOfVoice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty">暂无可比较的证据，不显示估算分数。</div>
            )}
          </section>
          <section className="panel" id="geo-evidence">
            <div className="section-heading">
              <h2>原始证据</h2>
              <a className="button" href={`/_futurestaff/geo/api/geo/v1${base}/export`}>
                导出 CSV
              </a>
            </div>
            {evidence.length ? (
              evidence.map((row) => (
                <EvidenceInspector key={row.id} row={row} />
              ))
            ) : (
              <p className="empty">本页没有证据。</p>
            )}
            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                上一页
              </button>
              <span>第 {page} 页</span>
              <button
                disabled={evidence.length < 20}
                onClick={() => setPage(page + 1)}
              >
                下一页
              </button>
            </div>
          </section>
        </>
      )}
    </>
  );
}
