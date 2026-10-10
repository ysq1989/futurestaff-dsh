import { useState, type FormEvent } from "react";
import { api, message, split } from "./client";
import type { TenantBrand } from "../../packages/core/content-types";
export function BrandSettings({
  brand,
  canManage,
  onSaved,
}: {
  brand: TenantBrand | null;
  canManage: boolean;
  onSaved: () => Promise<void>;
}) {
  const [draft, setDraft] = useState(
    brand || {
      version: 0,
      brand: "",
      aliases: [],
      domains: [],
      competitors: [],
      business: "",
      audience: "",
      facts: "",
      tone: "",
    },
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(event.currentTarget);
    try {
      const result = await api<{ data: TenantBrand }>("/brand", {
        ...draft,
        aliases: split(f.get("aliases")),
        domains: split(f.get("domains")),
        competitors: split(f.get("competitors")),
      });
      setDraft(result.data);
      setNotice("主体品牌已保存，所有推广计划统一使用这份资料。");
      try { await onSaved(); } catch(error) { setError(`品牌已保存，但刷新失败：${message(error)}。请重新进入品牌资料页面，不要重复提交。`); }
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  const disabled = !canManage || busy;
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>品牌资料</h1>
          <p>一个主体对应一个品牌，推广计划共同使用这里的资料。</p>
        </div>
        <span className="badge">主体唯一品牌</span>
      </header>
      {!canManage && (
        <p className="notice">品牌资料由 GEO 管理员维护。当前账号可以查看。</p>
      )}
      {!brand && (
        <p className="notice">
          先由管理员配置品牌，再创建推广计划。不同品牌应在不同主体中管理。
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      <section className="panel">
        <h2>{brand ? "维护主体品牌" : "配置主体品牌"}</h2>
        <form className="form-grid" onSubmit={save}>
          <label>
            品牌名称
            <input
              required
              maxLength={120}
              value={draft.brand}
              disabled={disabled || draft.version > 0}
              onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            />
          </label>
          <label>
            品牌别名
            <input
              name="aliases"
              defaultValue={draft.aliases.join(",")}
              disabled={disabled}
            />
          </label>
          <label>
            官网域名
            <input
              name="domains"
              defaultValue={draft.domains.join(",")}
              placeholder="不含 https://，多个用逗号分隔"
              disabled={disabled}
            />
          </label>
          <label>
            竞品品牌
            <input
              name="competitors"
              defaultValue={draft.competitors.join(",")}
              disabled={disabled}
            />
          </label>
          <label>
            业务与产品
            <textarea
              aria-label="业务与产品"
              maxLength={6000}
              rows={3}
              value={draft.business}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, business: e.target.value })}
            />
          </label>
          <label>
            目标客户与地区
            <textarea
              aria-label="目标客户与地区"
              maxLength={2000}
              rows={3}
              value={draft.audience}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, audience: e.target.value })}
            />
          </label>
          <label className="wide">
            事实资料与来源
            <textarea
              aria-label="事实资料与来源"
              maxLength={12000}
              rows={4}
              value={draft.facts}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, facts: e.target.value })}
            />
          </label>
          <label>
            文章语气
            <input
              maxLength={500}
              value={draft.tone}
              disabled={disabled}
              onChange={(e) => setDraft({ ...draft, tone: e.target.value })}
            />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={disabled}>
              {busy ? "保存中…" : "保存主体品牌"}
            </button>
            <span>资料版本 {draft.version}</span>
          </div>
        </form>
        <p className="muted">
          品牌名称配置后锁定，防止将原有内容和测量误归给其他品牌。别名、官网、竞品和业务资料可统一更新。
        </p>
      </section>
    </>
  );
}
