import { useCallback, useEffect, useRef, useState } from "react";
import type { ContentSnapshot } from "../../../packages/core/content-types";
import { api, message, type Project, type Prompt } from "../client";
import { ProfileTopics } from "./ProfileTopics";
import { Articles } from "./Articles";
import { Publications } from "./Publications";
export function ContentOperations({
  project,
  canWrite,
  canReview,
  back,
}: {
  project: Project;
  canWrite: boolean;
  canReview: boolean;
  back: () => void;
}) {
  const [snapshot, setSnapshot] = useState<ContentSnapshot | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const active = useRef(true);
  const sequence = useRef(0);
  const mutationLock = useRef(false);
  const base = `/projects/${project.id}`;
  const reload = useCallback(async () => {
    const generation = ++sequence.current;
    const [content, questions] = await Promise.all([
      api<{ data: ContentSnapshot }>(
        `${base}/content?page=${page}&pageSize=20`,
      ),
      api<{ data: Prompt[] }>(`${base}/prompts?pageSize=100`),
    ]);
    if (!active.current || generation !== sequence.current) return;
    setSnapshot(content.data);
    setPrompts(questions.data);
  }, [base, page]);
  useEffect(() => {
    active.current = true;
    setLoading(true);
    setError("");
    void reload()
      .catch((e) => {
        if (active.current) setError(message(e));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });
    return () => {
      active.current = false;
      sequence.current++;
    };
  }, [reload]);
  async function mutate(path: string, input: unknown) {
    if (mutationLock.current || !canWrite) return false;
    mutationLock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await api(`${base}${path}`, input);
      try { await reload(); }
      catch (error) { if (active.current) setError(`操作已保存，但列表刷新失败：${message(error)}。请重新加载，不要重复提交。`); }
      if (active.current)
        setNotice("已保存，内容和记录仅在当前主体项目内可见。");
      return true;
    } catch (e) {
      if (active.current) setError(message(e));
      return false;
    } finally {
      mutationLock.current = false;
      if (active.current) setBusy(false);
    }
  }
  const disabled = !canWrite || busy || loading;
  return (
    <>
      <button className="back" onClick={back}>
        ← 推广计划
      </button>
      <header className="page-heading">
        <div>
          <h1>{project.name}</h1>
          <p>{project.brand} · 内容运营</p>
        </div>
        <span className="badge">资料 → 写稿 → 审核 → 排期 → 复测</span>
      </header>
      <nav className="workspace-sections" aria-label="内容运营章节">
        <a href="#content-profile">品牌资料</a>
        <a href="#content-topics">选题</a>
        <a href="#content-articles">文章</a>
        <a href="#content-accounts">渠道账号</a>
        <a href="#content-plans">发布排期</a>
        <a href="#content-records">发布记录</a>
      </nav>
      {!canWrite && (
        <p className="notice">
          当前账号只读，可以查看文章和记录；写稿、审核与发布管理需要授权。
        </p>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button
            disabled={busy || loading}
            onClick={() => {
              setError("");
              setLoading(true);
              void reload()
                .catch((e) => setError(message(e)))
                .finally(() => setLoading(false));
            }}
          >
            重新加载内容
          </button>
          <p>
            重载不会自动重提上一操作；版本冲突时先保留表单内容，再核对最新文章。
          </p>
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      {busy && <p role="status">正在保存，请勿重复提交…</p>}
      {loading && !snapshot ? (
        <p role="status" className="loading">
          正在读取内容运营数据…
        </p>
      ) : (
        snapshot && (
          <>
            <ProfileTopics
              key={`${project.id}/${snapshot.profile.version}`}
              profile={snapshot.profile}
              topics={snapshot.topics}
              prompts={prompts}
              disabled={disabled}
              mutate={mutate}
            />
            <Articles
              base={base}
              articles={snapshot.articles}
              topics={snapshot.topics}
              reviews={snapshot.reviews}
              disabled={disabled}
              canReview={canReview}
              mutate={mutate}
              reportError={(e) => setError(message(e))}
              brandVersion={snapshot.profile.version}
            />
            <Publications
              base={base}
              snapshot={snapshot}
              disabled={disabled}
              mutate={mutate}
            />
            <div className="pagination">
              <button
                disabled={page === 1 || busy}
                onClick={() => setPage(page - 1)}
              >
                内容上一页
              </button>
              <span>第 {page} 页 · 每类最多 20 条，搜索与筛选作用于当前页</span>
              <button
                disabled={
                  busy ||
                  ![
                    snapshot.topics,
                    snapshot.articles,
                    snapshot.accounts,
                    snapshot.plans,
                    snapshot.records,
                    snapshot.reviews,
                  ].some((rows) => rows.length === 20)
                }
                onClick={() => setPage(page + 1)}
              >
                内容下一页
              </button>
            </div>
          </>
        )
      )}
    </>
  );
}
