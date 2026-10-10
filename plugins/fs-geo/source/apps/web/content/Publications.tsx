import { useState, type FormEvent } from "react";
import {
  platformNames,
  platforms,
  stateNames,
  type ContentSnapshot,
} from "../../../packages/core/content-types";
import type { Mutate } from "./ProfileTopics";
function beijing(value: string) {
  return new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
}
function beijingInput() {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(Date.now() - 60000));
  return parts.replace(" ", "T");
}
export function Publications({
  base,
  snapshot,
  disabled,
  mutate,
}: {
  base: string;
  snapshot: ContentSnapshot;
  disabled: boolean;
  mutate: Mutate;
}) {
  const [platform, setPlatform] = useState("toutiao");
  const [label, setLabel] = useState("");
  const [articleId, setArticleId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [planId, setPlanId] = useState("");
  const [url, setUrl] = useState("");
  const [publishedAt, setPublishedAt] = useState(beijingInput);
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const approved = snapshot.articles.filter((a) => a.state === "APPROVED");
  const pending = snapshot.plans.filter((p) => p.state === "PLANNED");
  async function account(event: FormEvent) {
    event.preventDefault();
    if (await mutate("/accounts", { platform, label })) setLabel("");
  }
  async function plan(event: FormEvent) {
    event.preventDefault();
    const article = approved.find((a) => a.id === articleId);
    if (!article) return;
    if (
      await mutate("/publication-plans", {
        articleId,
        version: article.version,
        accountId,
        scheduledAt: new Date(`${scheduledAt}:00+08:00`).toISOString(),
        mode: "MANUAL",
      })
    )
      setScheduledAt("");
  }
  async function record(event: FormEvent) {
    event.preventDefault();
    if (
      await mutate("/publication-records", {
        planId,
        url,
        publishedAt: new Date(`${publishedAt}:00+08:00`).toISOString(),
        note,
      })
    ) {
      setUrl("");
      setNote("");
      setPlanId("");
    }
  }
  function download(title: string, body: string) {
    const blob = new Blob([`# ${title}\n\n${body}`], {
      type: "text/markdown;charset=utf-8",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "geo-article.md";
    link.click();
    URL.revokeObjectURL(link.href);
  }
  return (
    <>
      <section className="panel" id="content-accounts">
        <h2>渠道账号</h2>
        <p className="muted">
          这里登记运营账号名称，不保存登录凭据。各渠道目前可手动发布；自动接入尚未验证。
        </p>
        <form className="form-grid" onSubmit={account}>
          <label>
            发布平台
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              disabled={disabled}
            >
              {platforms.map((p) => (
                <option key={p} value={p}>
                  {platformNames[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            账号名称
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              maxLength={200}
              required
              disabled={disabled}
            />
          </label>
          <div>
            <button disabled={disabled}>登记渠道账号</button>
          </div>
        </form>
        {snapshot.accounts.length ? (
          <ul className="content-topic-list">
            {snapshot.accounts.map((a) => (
              <li key={a.id}>
                <strong>
                  {platformNames[a.platform]} · {a.label}
                </strong>
                <small>手动发布 · 自动接入未验证</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">还没有渠道账号。先登记要运营的头条号。</p>
        )}
      </section>
      <section className="panel" id="content-plans">
        <h2>发布排期</h2>
        <p className="notice">
          当前排期是手动待办，到时需要你在对应平台发布。头条自动执行身份和账号尚未接通，不会自动投递。
        </p>
        <form className="form-grid" onSubmit={plan}>
          <label>
            已审核文章
            <select
              value={articleId}
              onChange={(e) => setArticleId(e.target.value)}
              required
              disabled={disabled}
            >
              <option value="">选择文章版本</option>
              {approved.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · v{a.version}
                </option>
              ))}
            </select>
          </label>
          <label>
            目标渠道账号
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              required
              disabled={disabled}
            >
              <option value="">选择账号</option>
              {snapshot.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {platformNames[a.platform]} · {a.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            计划发布时间（北京时间）
            <input
              type="datetime-local"
              value={scheduledAt}
              required
              disabled={disabled}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              className="primary"
              disabled={
                disabled || !approved.length || !snapshot.accounts.length
              }
            >
              创建手动发布待办
            </button>
            <button
              type="button"
              disabled
              title="执行身份、真实账号和头条适配器未核验"
            >
              自动发布 · 待接通
            </button>
          </div>
        </form>
        {!approved.length && (
          <p className="muted">先完成文章审核，才可以创建排期。</p>
        )}
        <label className="content-review-note">
          排期状态
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部状态</option>
            <option value="PLANNED">待发布</option>
            <option value="OVERDUE">已到期，待人工发布</option>
            <option value="PUBLISHED">已公开（人工登记）</option>
            <option value="CANCELLED">已取消</option>
          </select>
        </label>
        {snapshot.plans.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>内容版本</th>
                  <th>渠道账号</th>
                  <th>北京时间</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.plans
                  .filter(
                    (p) =>
                      !filter ||
                      (filter === "OVERDUE"
                        ? p.state === "PLANNED" &&
                          new Date(p.scheduled_at).getTime() <= Date.now()
                        : p.state === filter),
                  )
                  .map((p) => (
                    <tr key={p.id}>
                      <td>
                        <details>
                          <summary>
                            {p.title} · v{p.version}
                          </summary>
                          <pre>{p.body}</pre>
                        </details>
                      </td>
                      <td>
                        {platformNames[p.platform]} · {p.label}
                      </td>
                      <td>{beijing(p.scheduled_at)}</td>
                      <td>
                        {stateNames[p.state]}
                        {p.state === "PLANNED" && (
                          <small>
                            {new Date(p.scheduled_at).getTime() <= Date.now()
                              ? "已到期，需人工发布"
                              : "需在平台手动发布"}
                          </small>
                        )}
                      </td>
                      <td>
                        <button onClick={() => download(p.title, p.body)}>
                          下载排期正文
                        </button>
                        {p.state === "PLANNED" && (
                          <>
                            <button
                              disabled={disabled}
                              onClick={() => setPlanId(p.id)}
                            >
                              登记已发布
                            </button>
                            <button
                              disabled={disabled}
                              onClick={() =>
                                void mutate(
                                  `/publication-plans/${p.id}/cancel`,
                                  {},
                                )
                              }
                            >
                              取消排期
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">
            还没有排期。审核文章并登记账号后，安排首篇内容。
          </p>
        )}
      </section>
      <section className="panel" id="content-records">
        <div className="section-heading">
          <h2>发布记录</h2>
          <a className="button" href={`/_futurestaff/geo/api/geo/v1${base}/content/export`}>
            导出发布 CSV
          </a>
        </div>
        <p className="muted">
          在平台确认文章已公开后回填。人工登记不代表搜索收录或 AI
          引用，请在“效果测量”中单独复测。
        </p>
        <form className="form-grid" onSubmit={record}>
          <label>
            待登记排期
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              required
              disabled={disabled}
            >
              <option value="">选择待发布任务</option>
              {pending.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · {platformNames[p.platform]} · {p.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            文章公开链接
            <input
              type="url"
              value={url}
              required
              onChange={(e) => setUrl(e.target.value)}
              disabled={disabled}
              maxLength={2000}
            />
          </label>
          <label>
            实际发布时间（北京时间）
            <input
              type="datetime-local"
              value={publishedAt}
              required
              onChange={(e) => setPublishedAt(e.target.value)}
              disabled={disabled}
            />
          </label>
          <label>
            发布备注
            <input
              value={note}
              maxLength={2000}
              onChange={(e) => setNote(e.target.value)}
              disabled={disabled}
            />
          </label>
          <div>
            <button className="primary" disabled={disabled || !pending.length}>
              保存人工发布记录
            </button>
          </div>
        </form>
        {snapshot.records.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>文章</th>
                  <th>渠道</th>
                  <th>实际时间</th>
                  <th>证据来源</th>
                  <th>公开链接</th>
                </tr>
              </thead>
              <tbody>
                {snapshot.records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {r.title}
                      <small>{r.note}</small>
                    </td>
                    <td>
                      {platformNames[r.platform]} · {r.label}
                    </td>
                    <td>{beijing(r.published_at)}</td>
                    <td>人工登记 · 未自动核验</td>
                    <td>
                      <a href={r.url} target="_blank" rel="noopener noreferrer">
                        查看文章
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty">还没有发布记录。完成平台发布后登记真实链接。</p>
        )}
      </section>
    </>
  );
}
