import {
  IconArrowRight,
  IconPlus,
  IconRefresh,
  IconPlug,
} from "@tabler/icons-react";
import type { TenantBrand } from "../../packages/core/content-types";
import type { Project } from "./client";
import { ProjectTable } from "./Projects";

export function Overview({
  projects,
  total,
  targetCount,
  canWrite,
  refreshing,
  onRefresh,
  onProjects,
  onCreate,
  onSelect,
  onAgents,
  brand,
  onBrand,
}: {
  projects: Project[];
  total: number;
  targetCount: number;
  canWrite: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onProjects: () => void;
  onCreate: () => void;
  onSelect: (project: Project) => void;
  onAgents: () => void;
  brand: TenantBrand | null;
  onBrand: () => void;
}) {
  return (
    <>
      <header className="page-heading">
        <div>
          <h1>概览</h1>
          <p>从用户问题到回答证据，洞察品牌在 AI 答案中的表现。</p>
        </div>
        <div className="page-actions">
          <button onClick={onRefresh} disabled={refreshing}>
            <IconRefresh size={16} />
            {refreshing ? "刷新中…" : "刷新"}
          </button>
          <button
            className="primary"
            onClick={brand ? onCreate : onBrand}
            disabled={!canWrite}
          >
            <IconPlus size={16} />
            {brand ? "新建计划" : "配置主体品牌"}
          </button>
        </div>
      </header>
      <section className="overview-summary" aria-label="工作空间概况">
        <div>
          <span>推广计划</span>
          <strong>{total}</strong>
          <button onClick={onProjects}>
            查看全部计划 <IconArrowRight size={14} />
          </button>
        </div>
        <div>
          <span>主体品牌</span>
          <strong style={{ fontSize: 20 }}>{brand?.brand || "尚未配置"}</strong>
          <button onClick={onBrand}>维护品牌资料</button>
        </div>
        <div>
          <span>Agent 接入目标</span>
          <strong>{targetCount}</strong>
          <button onClick={onAgents}>
            查看接入与验收状态 <IconArrowRight size={14} />
          </button>
        </div>
      </section>
      <section className="project-list-section">
        <div className="section-heading">
          <h2>推广计划</h2>
          <button className="text-action" onClick={onProjects}>
            查看全部 <IconArrowRight size={14} />
          </button>
        </div>
        <ProjectTable projects={projects.slice(0, 5)} select={onSelect} />
      </section>
      <section className="workspace-guide">
        <IconPlug size={24} />
        <div>
          <strong>从一份回答，开始品牌洞察</strong>
          <p>
            添加用户问题，选择主体授权模型进行测量，或导入已有回答；提及与引用分析始终基于保存的证据。
          </p>
        </div>
        <button onClick={onProjects}>
          进入品牌工作台 <IconArrowRight size={16} />
        </button>
      </section>
    </>
  );
}
