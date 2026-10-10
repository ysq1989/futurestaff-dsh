import { useCallback, useEffect, useState, useRef } from "react";
import {
  IconBuilding,
  IconChartBar,
  IconPlug,
  IconSettings,
  IconSun,
  IconMoon,
  IconLayoutDashboard,
  IconChevronRight,
  IconShieldCheck,
  IconMenu2,
} from "@tabler/icons-react";
import {
  api,
  message,
  resetContext,
  type Session,
  type Project,
  ApiError,
} from "./client";
import { Projects } from "./Projects";
import { ProjectWorkspace } from "./ProjectWorkspace";

import { Overview } from "./Overview";
import { AccountControl } from "./AccountControl";
import { BrandSettings } from "./BrandSettings";
import type { TenantBrand } from "../../packages/core/content-types";
function Brand() {
  return (
    <div className="brand">
      <img src="/_futurestaff/geo/brand/futurestaff-icon.svg" alt="FutureStaff" />
      <span>
        FutureStaff<span className="brand-dot">.</span>
        GEO
      </span>
    </div>
  );
}
type Agent = {
  productId: string;
  channel: string;
  readiness: string;
  verifiedAt: string | null;
};
export function App() {
  const generation = useRef(0);
  const hadSession = useRef(false);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [createRequested, setCreateRequested] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tenantBrand, setTenantBrand] = useState<TenantBrand | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [light, setLight] = useState(false);
  const reload = useCallback(async () => {
    const started = generation.current;
    const s = await api<{ data: Session }>("/session");
    const [p, a, b] = await Promise.all([
      api<{ data: Project[]; pagination: { totalItems: number } }>(
        `/projects?page=${page}`,
      ),
      api<{ data: Agent[] }>("/agents"),
      api<{ data: TenantBrand | null }>("/brand"),
    ]);
    if (started !== generation.current) return;
    hadSession.current = true;
    setSession(s.data);
    setProjects(p.data);
    setTotal(p.pagination.totalItems);
    setAgents(a.data);
    setTenantBrand(b.data);
  }, [page]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => {
        if (active)
          setError(e instanceof ApiError && e.status === 401 ? "" : message(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reload]);
  useEffect(() => {
    const clear = () => {
      generation.current++;
      setSession(null);
      setProject(null);
      setProjects([]);
      setAgents([]);
      setTenantBrand(null);
      setError(
        hadSession.current
          ? "FutureStaff 会话或 GEO 授权已失效，请重新登录"
          : "",
      );
    };
    window.addEventListener("geo-session-invalid", clear);
    return () => window.removeEventListener("geo-session-invalid", clear);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
  }, [light]);
  async function logout() { window.parent.postMessage({type:'futurestaff-geo-close'},window.location.origin); }
  function navigate(next: string) {
    setView(next);
    setProject(null);
    setMenuOpen(false);
    setCreateRequested(false);
  }
  async function refreshView() {
    setRefreshing(true);
    setError("");
    try {
      await reload();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setRefreshing(false);
    }
  }
  if (loading && !session)
    return (
      <main className="login">
        <Brand />
        <p role="status">正在核验 FutureStaff 身份…</p>
      </main>
    );
  if (!session) return <main className="login"><Brand /><h1>GEO 工作区尚不可用</h1><p role="alert">{error || '请在 DSH 主窗口完成登录，并确认当前主体的 GEO 应用授权。'}</p><button onClick={() => void logout()}>返回 DSH</button></main>;
  const canWrite = session.permissions.some((p) =>
    ["geo.admin", "geo.operator"].includes(p),
  );
  const role = session.permissions.includes("geo.admin")
    ? "GEO 管理员"
    : canWrite
      ? "GEO 操作员"
      : "只读访问";
  const tenantLabel =
    session.tenantName === session.tenantId
      ? "当前工作空间"
      : session.tenantName;
  const viewLabel =
    view === "overview"
      ? "概览"
      : view === "projects"
        ? "推广计划"
        : view === "agents"
          ? "Agent 接入"
          : view === "brand"
            ? "品牌资料"
            : "接入设置";
  function selectProject(selected: Project) {
    setProject(selected);
    setView("projects");
    setCreateRequested(false);
    setMenuOpen(false);
  }
  return (
    <div className="shell">
      {menuOpen && (
        <button
          className="sidebar-scrim"
          aria-label="关闭导航"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside className={`workspace-sidebar ${menuOpen ? "is-open" : ""}`}>
        <Brand />
        <div className="tenant-context">
          <IconBuilding size={20} />
          <div>
            <strong title={session.tenantId}>{tenantLabel}</strong>
            <small>主体授权空间</small>
          </div>
        </div>
        <span className="nav-caption">工作空间</span>
        <nav aria-label="主导航">
          {[
            ["overview", "概览", IconLayoutDashboard],
            ["brand", "品牌资料", IconBuilding],
            ["projects", "推广计划", IconChartBar],
            ["agents", "Agent 接入", IconPlug],
            ["integration", "接入设置", IconSettings],
          ].map(([id, label, Icon]) => {
            const Glyph = Icon as typeof IconChartBar;
            return (
              <button
                key={String(id)}
                className={view === id ? "active" : ""}
                aria-current={view === id ? "page" : undefined}
                onClick={() => navigate(String(id))}
              >
                <Glyph size={18} />
                {String(label)}
              </button>
            );
          })}
        </nav>
        <AccountControl
          name={session.displayName}
          role={role}
          onLogout={logout}
        />
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="topbar-location">
            <button
              className="mobile-nav-toggle"
              aria-label="打开导航"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              <IconMenu2 size={20} />
            </button>
            <nav className="breadcrumb" aria-label="当前位置">
              <button onClick={() => navigate("overview")}>工作空间</button>
              <IconChevronRight size={14} />
              <span>{viewLabel}</span>
              {project && (
                <>
                  <IconChevronRight size={14} />
                  <strong>{project.name}</strong>
                </>
              )}
            </nav>
          </div>
          <div className="topbar-tools">
            <span className="role-label">
              <IconShieldCheck size={14} />
              {role}
            </span>
            <button
              aria-label={light ? "切换暗色" : "切换亮色"}
              onClick={() => setLight(!light)}
            >
              {light ? <IconMoon size={18} /> : <IconSun size={18} />}
            </button>
          </div>
        </header>
        <main className="content">
          <p className="workspace-identity">
            当前身份：{tenantLabel} · {session.displayName}
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {view === "overview" ? (
            <Overview
              projects={projects}
              total={total}
              targetCount={agents.length}
              canWrite={canWrite}
              brand={tenantBrand}
              onBrand={() => navigate("brand")}
              refreshing={refreshing}
              onRefresh={() => void refreshView()}
              onProjects={() => navigate("projects")}
              onCreate={() => {
                navigate("projects");
                setCreateRequested(true);
              }}
              onSelect={selectProject}
              onAgents={() => navigate("agents")}
            />
          ) : view === "brand" ? (
            <BrandSettings
              key={`${session.tenantId}/${tenantBrand?.version || 0}`}
              brand={tenantBrand}
              canManage={session.permissions.includes("geo.admin")}
              onSaved={reload}
            />
          ) : view === "projects" ? (
            project ? (
              <ProjectWorkspace
                key={project.id}
                project={project}
                canWrite={canWrite}
                canReview={session.permissions.includes("geo.admin")}
                back={() => setProject(null)}
              />
            ) : (
              <>
                <Projects
                  projects={projects}
                  canWrite={canWrite}
                  select={selectProject}
                  refresh={reload}
                  initialCreateOpen={createRequested}
                  brandConfigured={Boolean(tenantBrand)}
                  onBrand={() => navigate("brand")}
                />
                <div className="pagination">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(page - 1)}
                  >
                    上一页
                  </button>
                  <span>
                    第 {page} 页 · 共 {total} 个计划
                  </span>
                  <button
                    disabled={page * 20 >= total}
                    onClick={() => setPage(page + 1)}
                  >
                    下一页
                  </button>
                </div>
              </>
            )
          ) : view === "agents" ? (
            <>
              <header className="page-heading">
                <div>
                  <h1>Agent 接入</h1>
                  <p>
                    模型能力由 FutureStaff AI
                    统一提供。接入目标需真实验收后启用。
                  </p>
                </div>
              </header>
              <div className="notice">
                当前均为接入目标，尚未验证；网页采集需要独立适配。没有自动生成的曝光数据。
              </div>
              <section className="panel table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Agent</th>
                      <th>渠道</th>
                      <th>状态</th>
                      <th>真实验证时间</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents.map((a) => (
                      <tr key={a.productId}>
                        <td>{a.productId}</td>
                        <td>{a.channel}</td>
                        <td>
                          <span className="badge">产品接入尚未验证</span>
                        </td>
                        <td>{a.verifiedAt || "尚未验证"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </>
          ) : (
            <>
              <header className="page-heading">
                <div>
                  <h1>接入设置</h1>
                  <p>统一管理账号身份、主体权限与模型调用入口。</p>
                </div>
              </header>
              <section className="panel">
                <dl>
                  <dt>登录与租户</dt>
                  <dd>
                    复用 DSH 当前登录与工作区；每次操作由 Host 核验 GEO 应用权限。
                  </dd>
                  <dt>当前主体</dt>
                  <dd>
                    <code>{session.tenantId}</code>
                  </dd>
                  <dt>当前权限</dt>
                  <dd>{session.permissions.join("、")}</dd>
                  <dt>模型与计费</dt>
                  <dd>
                    使用 DSH 已授权模型；调用按平台规则计费，模型任务需要明确发起。
                  </dd>
                  <dt>业务数据</dt>
                  <dd>
                    业务数据保存在本机，按环境、主体和成员隔离；不会自动同步到其他电脑。
                  </dd>
                </dl>
              </section>
            </>
          )}
          <footer className="workspace-footer">
            © 2026 FutureStaff. All rights reserved.
          </footer>
        </main>
      </div>
    </div>
  );
}
