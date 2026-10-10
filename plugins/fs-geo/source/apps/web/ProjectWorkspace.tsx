import { useState } from "react";
import type { Project } from "./client";
import { Workspace } from "./Workspace";
import { ContentOperations } from "./content/ContentOperations";
export function ProjectWorkspace({
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
  const [section, setSection] = useState("content");
  return (
    <>
      <nav className="content-section-switch" aria-label="项目工作区">
        <button
          aria-pressed={section === "content"}
          onClick={() => setSection("content")}
        >
          内容运营
        </button>
        <button
          aria-pressed={section === "measurement"}
          onClick={() => setSection("measurement")}
        >
          效果测量
        </button>
      </nav>
      {section === "content" ? (
        <ContentOperations
          project={project}
          canWrite={canWrite}
          canReview={canReview}
          back={back}
        />
      ) : (
        <Workspace project={project} canWrite={canWrite} back={back} />
      )}
    </>
  );
}
