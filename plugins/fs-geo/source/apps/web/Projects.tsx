import { useState, useRef, type FormEvent } from "react";
import { IconPlus, IconChevronRight, IconX } from "@tabler/icons-react";
import { api, message, type Project } from "./client";
export function Projects({
  projects,
  canWrite,
  select,
  refresh,
  initialCreateOpen = false,
  brandConfigured,
  onBrand,
}: {
  projects: Project[];
  canWrite: boolean;
  select: (project: Project) => void;
  refresh: () => Promise<void>;
  initialCreateOpen?: boolean;
  brandConfigured: boolean;
  onBrand: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(initialCreateOpen);
  const trigger = useRef<HTMLButtonElement>(null);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      await api("/projects", {
        name: data.get("name"),
      });
      form.reset();
      await refresh();
      setCreateOpen(false);
      trigger.current?.focus();
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>推广计划</h1>
          <p>
            所有推广计划统一使用当前主体品牌，分别管理内容、问题和测量证据。
          </p>
        </div>
        <button
          ref={trigger}
          className="primary"
          disabled={!canWrite || !brandConfigured}
          aria-expanded={createOpen}
          onClick={() => setCreateOpen(!createOpen)}
        >
          {createOpen ? <IconX size={16} /> : <IconPlus size={16} />}{" "}
          {createOpen ? "收起创建" : "新建计划"}
        </button>
      </header>
      {!brandConfigured && (
        <p className="notice">
          先配置主体品牌，再创建推广计划。
          <button onClick={onBrand}>配置品牌资料</button>
        </p>
      )}
      {createOpen && brandConfigured && (
        <section className="panel project-create">
          <h2>创建推广计划</h2>
          <form onSubmit={create} className="form-grid">
            <label>
              计划名称
              <input
                name="name"
                required
                maxLength={120}
                disabled={!canWrite || busy}
              />
            </label>
            <div className="form-actions wide">
              <button className="primary" disabled={!canWrite || busy}>
                {busy ? "创建中…" : "创建计划"}
              </button>
              {!canWrite && <span>当前账号只有只读权限</span>}
            </div>
            {error && (
              <p role="alert" className="error wide">
                {error}
              </p>
            )}
          </form>
        </section>
      )}
      <section className="project-list-section">
        <h2>
          计划列表 <small>{projects.length} 个已加载计划</small>
        </h2>
        <ProjectTable projects={projects} select={select} />
      </section>
    </>
  );
}

export function ProjectTable({
  projects,
  select,
}: {
  projects: Project[];
  select: (project: Project) => void;
}) {
  return projects.length ? (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>推广计划</th>
            <th>品牌</th>
            <th>官网</th>
            <th>竞品</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr key={project.id}>
              <td>
                <div className="project-identity">
                  <span className="project-avatar" aria-hidden="true">
                    {project.brand.slice(0, 1)}
                  </span>
                  <strong>{project.name}</strong>
                </div>
              </td>
              <td>{project.brand}</td>
              <td>{project.domains.join("、") || "未配置"}</td>
              <td>{project.competitors.join("、") || "未配置"}</td>
              <td>
                <button className="text-action" onClick={() => select(project)}>
                  进入计划
                  <IconChevronRight size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="empty project-empty">
      <h3>还没有推广计划</h3>
      <p>配置主体品牌并创建第一个推广计划后，管理内容、发布和测量证据。</p>
    </div>
  );
}
