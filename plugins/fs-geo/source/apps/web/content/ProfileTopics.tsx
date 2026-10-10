import { useState, type FormEvent } from "react";
import type { BrandProfile, Topic } from "../../../packages/core/content-types";
import type { Prompt } from "../client";
export type Mutate = (path: string, input: unknown) => Promise<boolean>;
export function ProfileTopics({
  profile,
  topics,
  prompts,
  disabled,
  mutate,
}: {
  profile: BrandProfile;
  topics: Topic[];
  prompts: Prompt[];
  disabled: boolean;
  mutate: Mutate;
}) {
  const [title, setTitle] = useState("");
  const [promptId, setPromptId] = useState("");
  async function topic(event: FormEvent) {
    event.preventDefault();
    if (await mutate("/topics", { title, promptId: promptId || null }))
      setTitle("");
  }
  return (
    <>
      <section className="panel" id="content-profile">
        <h2>主体品牌资料</h2>
        <p className="muted">
          当前计划使用主体统一资料。请在左侧“品牌资料”页面维护，更新后所有计划共同使用。
        </p>
        <dl>
          <dt>业务与产品</dt>
          <dd>{profile.business || "待补充"}</dd>
          <dt>目标客户与地区</dt>
          <dd>{profile.audience || "待补充"}</dd>
          <dt>事实资料与来源</dt>
          <dd style={{ whiteSpace: "pre-wrap" }}>
            {profile.facts || "待补充"}
          </dd>
        </dl>
        <small>主体资料版本 {profile.version}</small>
      </section>
      <section className="panel" id="content-topics">
        <h2>选题计划</h2>
        <form className="form-grid" onSubmit={topic}>
          <label>
            文章选题
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              disabled={disabled}
            />
          </label>
          <label>
            关联测量问题
            <select
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              disabled={disabled}
            >
              <option value="">暂不关联</option>
              {prompts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.question}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button disabled={disabled} className="primary">
              添加选题
            </button>
          </div>
        </form>
        {topics.length ? (
          <ul className="content-topic-list">
            {topics.map((t) => (
              <li key={t.id}>
                <strong>{t.title}</strong>
                <small>{t.question || "尚未关联测量问题"}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            还没有选题。添加客户关心的话题，再据此撰写文章。
          </p>
        )}
      </section>
    </>
  );
}
