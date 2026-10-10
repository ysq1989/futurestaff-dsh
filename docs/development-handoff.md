# FutureStaff Agent 换电脑开发交接

日期：2026-10-10。

## 仓库与范围

权威客户端仓库为 `https://github.com/ysq1989/FutureStaff-Agent.git`，由原 `futurestaff-dsh` 重命名而来，保留原 Git 历史。原先误建的同名平台快照仓库已删除。

本次提交保存当前客户端开发工作树，包括抖音模块、主体隔离与推理适配、系统页面导航、桌面模块窗口、测试、规格和任务记录。提交不是软件发布，也不表示各任务的真实网站验收或待办已经完成。

## 新电脑获取

```powershell
git clone --recurse-submodules https://github.com/ysq1989/FutureStaff-Agent.git
cd FutureStaff-Agent
git status --short --branch
git submodule status
```

必须新建检出目录。不要在此前误拉取的平台快照目录中直接执行 `git pull`，它们不是同一份 Git 历史。

需要 Node.js 22+（以各工程 `engines` 为准）、npm、Corepack/Yarn 和 pnpm。按 README 安装根工程与桌面工程依赖，再执行 `npm run check`。不要手动复制 `node_modules` 或构建输出。

两个上游子模块均固定提交，不能自动更新到最新分支：

- `desktop-shell/deepseek-harness`：`a66e4702047846cdaa10c66c9d3df3951f5ea70d`。
- `official-desktop`：`477b4f420553e8a52c2fbccc464d7561b239c443`，仅为迁移候选；不能把候选当成已经替换默认发行底座。

阅读 `docs/development.md`、`tasks/CURRENT.md` 和对应任务文件，区分已完成的源码验证、曾有的本机试运行和仍未完成的验收。只使用 `main`，保留本地工作；真实外部操作、部署、发布和用户数据改动须遵守既有授权边界。

## 配置与本机数据

客户端开发不需要照搬旧平台仓库的 Alembic、PostgreSQL、Redis 初始化流程。仅因更换电脑，不必安装 Docker；确有服务器容器或相应测试需求时再核对依赖。

仓库不包含 `.env`、用户会话、受保护凭据、浏览器账号 Profile、抖音 SQLite 数据、DSH 用户数据或发布签名密钥。按 `.env.example` 建立本机配置；凭据经安全渠道配置，不提交或输出。操作系统保护的凭据不保证可跨电脑复用，优先重新登录。

如需保留历史会话、文件和业务工作区，先确认实际 DSH 数据目录及账号/主体边界，再单独安全迁移。开发源码迁移不等于运行数据已备份。

## 本次验证

- `npm run check`：未完全通过。工作区类型检查、测试、产品构建通过；桌面布局检查停在 `verify-desktop-variants.mjs`，稳定版与 Beta 的 9 个源码路径存在未声明差异。
- `corepack yarn@4.18.0 --cwd desktop-shell workspace dsh-plugin-desktop build`：通过。
- `corepack yarn@4.18.0 --cwd desktop-shell workspace dsh-plugin-desktop typecheck`：通过。
- `corepack yarn@4.18.0 --cwd desktop-shell workspace dsh-plugin-desktop test`：114 个测试文件通过，1101 项测试通过，13 项跳过。
- `node --test test/*.test.js`：64 项通过。
- `node scripts/verify-official-candidate.mjs`：通过；两个子模块干净，固定提交可从上游获取。
- 暂存内容的敏感文件检查和 `git diff --cached --check`：通过；配置、凭据、数据库、浏览器 Profile 和本机运行数据未进入提交。

桌面差异清单涉及 `electron-runtime.ts`、`electron-shell-generation.ts`、`module-window.ts`、`startup-recovery-window.ts`，以及原生对话框的 HTML、React、CSS 和类型声明。应核对各差异的版本意图并按现有规则修复，不能简单关闭门禁或把未声明差异全部加入允许列表。完整桌面门禁后续阶段未执行；本次保存开发状态，不作为已验收发行物。
