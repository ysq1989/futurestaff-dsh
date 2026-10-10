# 抖音模块独立原生窗口（2026-10-04）

- 目标：将桌面抖音模块从主窗口弹层改为独立系统窗口；重复打开聚焦已有窗口。
- 所有权：desktop-shell 的 ElectronShellGeneration 与新增 DesktopModuleWindow 管理原生窗口和 generation 能力；fs-douyin-ui 管理界面；现有平台授权、SQLite 和账号浏览器服务继续拥有其数据。
- 风险：共享桌面载体能力，按 High Risk 验证。无 Schema、新凭据、消息发送、提交或推送。main 基线 57bb64e2e012d6d5d45c2d631f3ef42c1c8711fa；所有既有开发差异保留，tasks/CURRENT.md 已有其他任务，不覆盖它。
- 契约：平台本地 ADR-0042；精确匹配本机 shell URL 加 futurestaff-module=douyin；只允许拥有的原生窗口使用现有 session 的本机 renderer capability。
- 实现：独立移动/缩放/最小化/关闭，单例聚焦；关闭/加载失败/桌面 teardown 撤销能力；UI 全窗口显示，在平台授权丢失时卸载数据视图。普通浏览器保留旧弹层兼容。
- 验证：桌面 86 项（模块窗口、ElectronRuntime、window options、browser-access）通过；抖音 Node 28 项与 React 13 项通过；新独立布局真实隔离浏览器夹具通过，已审阅 work/douyin-ui-review/independent-window-desktop.png。隐藏的真实 Electron 夹具通过，证明原生窗口没有 parent、同 session、单例和关闭回收，并未启动或重启安装的软件。
- 类型与构建：桌面 tsconfig.json/tsconfig.tests.json、抖音 typecheck 通过；完整 desktop build 与抖音 build 通过。无本模块 lint 配置；git diff --check 通过。
- 本机候选：work/douyin-window-release-4f4541e9-e942-499e-9241-8c4fa563f7a1，状态 prepared-not-installed。匹配当前 2.0.10；ASAR 的非 lib 清单及原 packed bytes 一致。候选包含 desktop lib、fs-douyin-ui lib 及 SHA-256 receipt。
- 本机安装：用户明确回复“授权”后，桌面 ASAR、desktop lib、默认及当前主体的 fs-douyin-ui lib 共四部分已成对安装并核验 SHA-256；原配置未改动。安装回执 work/douyin-window-installed.json。桌面备份 D:/FutureStaff Agent/backups/douyin-window-20261004-cd461703-9aae-45e5-b011-f7c8db744560；模块备份 C:/Users/Administrator/.dsh/backups/douyin-window-20261004-cd461703-9aae-45e5-b011-f7c8db744560。
- 实机观察：安装后 FutureStaff Agent 2.0.10 正常启动。Computer Use 观察主窗口显示“登录已过期”；未操作认证表单或绕过授权。实际点击独立窗口验收待用户重新登录；原生夹具与浏览器夹具不等于已部署软件完整验收。
