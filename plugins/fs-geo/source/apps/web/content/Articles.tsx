import { useState, type FormEvent } from "react";
import {
  stateNames,
  type Article,
  type Topic,
  type ContentSnapshot,
} from "../../../packages/core/content-types";
import { api, split } from "../client";
import type { Mutate } from "./ProfileTopics";
import { AiDrafting } from "./AiDrafting";

interface Draft {
  title: string;
  body: string;
  summary: string;
  topicId: string;
  sources: string;
}
const blank: Draft = {
  title: "",
  body: "",
  summary: "",
  topicId: "",
  sources: "",
};
export function Articles({
  base,
  articles,
  topics,
  reviews,
  disabled,
  canReview,
  mutate,
  reportError,
  brandVersion,
}: {
  base: string;
  articles: Article[];
  topics: Topic[];
  reviews: ContentSnapshot["reviews"];
  disabled: boolean;
  canReview: boolean;
  mutate: Mutate;
  reportError: (error: unknown) => void;
  brandVersion: number;
}) {
  const [selected, setSelected] = useState<Article | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [comment, setComment] = useState("");
  const [briefBusy, setBriefBusy] = useState(false);
  const [brief, setBrief] = useState("");
  const rows = articles.filter(
    (a) =>
      (!filter || a.state === filter) &&
      a.title.toLowerCase().includes(query.toLowerCase()),
  );
  function edit(article: Article | null) {
    setSelected(article);
    setBrief("");
    setComment("");
    setDraft(
      article
        ? {
            title: article.title,
            body: article.body,
            summary: article.summary,
            topicId: article.topic_id || "",
            sources: article.sources.join("\n"),
          }
        : blank,
    );
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const input = {
      title: draft.title,
      body: draft.body,
      summary: draft.summary,
      topicId: draft.topicId || null,
      sources: split(draft.sources),
    };
    if (
      await mutate(
        selected ? `/articles/${selected.id}` : "/articles",
        selected ? { ...input, version: selected.version } : input,
      )
    )
      edit(null);
  }
  async function outline() {
    setBriefBusy(true);
    try {
      const r = await api<{ data: { body: string } }>(`${base}/writing-brief`, {
        topic: draft.title,
      });
      setBrief(r.data.body);
    } catch (error) {
      reportError(error);
    } finally {
      setBriefBusy(false);
    }
  }
  return (
    <section className="panel" id="content-articles">
      <div className="section-heading">
        <h2>文章工作台</h2>
        <button disabled={disabled} onClick={() => edit(null)}>
          新建文章
        </button>
      </div>
      <div className="content-toolbar">
        <label>
          搜索文章
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <label>
          文章状态
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">全部状态</option>
            {["DRAFT", "IN_REVIEW", "APPROVED"].map((s) => (
              <option value={s} key={s}>
                {stateNames[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {rows.length ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>文章</th>
                <th>版本</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <details>
                      <summary>{a.title}</summary>
                      <p>{a.summary}</p>
                      <pre>{a.body}</pre>
                      {a.sources.map((source) => (
                        <p key={source}>
                          <a
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {source}
                          </a>
                        </p>
                      ))}
                    </details>
                  </td>
                  <td>v{a.version}</td>
                  <td>{stateNames[a.state]}</td>
                  <td>
                    <button disabled={disabled} onClick={() => edit(a)}>
                      编辑
                    </button>
                    {a.state === "DRAFT" && (
                      <button
                        disabled={disabled}
                        onClick={() =>
                          void mutate(`/articles/${a.id}/review`, {
                            version: a.version,
                            action: "SUBMIT",
                            comment,
                          })
                        }
                      >
                        提交审核
                      </button>
                    )}
                    {a.state === "IN_REVIEW" && (
                      <>
                        <button
                          disabled={disabled || !canReview}
                          onClick={() =>
                            void mutate(`/articles/${a.id}/review`, {
                              version: a.version,
                              action: "APPROVE",
                              comment,
                            })
                          }
                        >
                          审核通过
                        </button>
                        <button
                          disabled={disabled || !canReview}
                          onClick={() =>
                            void mutate(`/articles/${a.id}/review`, {
                              version: a.version,
                              action: "REJECT",
                              comment,
                            })
                          }
                        >
                          退回草稿
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
          当前页没有匹配文章。先写一篇真实、可核验的内容。
        </p>
      )}
      <label className="content-review-note">
        审核意见（提交审核或审核操作时保存）
        <input
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={disabled}
        />
      </label>
      {!canReview && (
        <p className="muted">文章可提审；审核通过或退回需要 GEO 管理员处理。</p>
      )}
      <h3>{selected ? `编辑文章 · v${selected.version}` : "撰写新文章"}</h3>
      {selected && (
        <p className="notice">
          保存会生成新版本并回到草稿；已有排期继续使用原审核版本。版本冲突时不会覆盖表单。
        </p>
      )}
      <form className="form-grid" onSubmit={save}>
        <label>
          文章标题
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            required
            maxLength={200}
            disabled={disabled}
          />
        </label>
        <label>
          对应选题
          <select
            value={draft.topicId}
            onChange={(e) => {
              const topic = topics.find((t) => t.id === e.target.value);
              setDraft({
                ...draft,
                topicId: e.target.value,
                title: draft.title || topic?.title || "",
              });
            }}
            disabled={disabled}
          >
            <option value="">暂不关联</option>
            {topics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </label>
        <label className="wide">
          文章摘要
          <textarea
            rows={2}
            value={draft.summary}
            maxLength={2000}
            disabled={disabled}
            onChange={(e) => setDraft({ ...draft, summary: e.target.value })}
          />
        </label>
        <div className="wide form-actions">
          <button
            type="button"
            disabled={disabled || briefBusy || !draft.title.trim()}
            onClick={() => void outline()}
          >
            {briefBusy ? "正在生成提纲…" : "生成写作提纲（免费）"}
          </button>
        </div>
        <AiDrafting base={base} title={draft.title} topicId={draft.topicId} sources={draft.sources} brandVersion={brandVersion} disabled={disabled}
          onApply={(result,topicId)=>setDraft(previous=>({...previous,...result,topicId:topicId||"",sources:result.sources.join("\n")}))} />
        {brief && (
          <details className="wide" open>
            <summary>本地写作提纲 · 未调用收费模型</summary>
            <pre>{brief}</pre>
            <button
              type="button"
              disabled={disabled}
              onClick={() =>
                setDraft({
                  ...draft,
                  body: draft.body ? `${draft.body}\n\n${brief}` : brief,
                })
              }
            >
              插入正文末尾
            </button>
          </details>
        )}
        <label className="wide">
          文章正文
          <textarea
            aria-label="文章正文"
            rows={12}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
            required
            maxLength={60000}
            disabled={disabled}
          />
        </label>
        <label className="wide">
          事实引用 URL（每行一个）
          <textarea
            rows={2}
            value={draft.sources}
            onChange={(e) => setDraft({ ...draft, sources: e.target.value })}
            disabled={disabled}
          />
        </label>
        <div className="wide form-actions">
          <button className="primary" disabled={disabled}>
            保存文章草稿
          </button>
          {selected && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => edit(null)}
            >
              取消编辑
            </button>
          )}
        </div>
      </form>
      <details>
        <summary>正文预览（纯文本 / Markdown 源文）</summary>
        <h3>{draft.title || "尚未填写标题"}</h3>
        <pre>{draft.body || "尚未填写正文"}</pre>
      </details>
      {reviews.length > 0 && (
        <details>
          <summary>审核历史（当前页）</summary>
          <ul>
            {reviews.map((r, i) => (
              <li key={i}>
                v{r.version} ·{" "}
                {
                  {
                    SUBMIT: "提交审核",
                    APPROVE: "审核通过",
                    REJECT: "退回草稿",
                  }[r.action as "SUBMIT"]
                }{" "}
                ·{" "}
                {new Date(r.created_at).toLocaleString("zh-CN", {
                  timeZone: "Asia/Shanghai",
                })}{" "}
                · {r.comment || "无意见"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
