# 抖音界面本机部署（2026-10-03）

- 用户明确要求“部署一下”；目标是当前本机 FutureStaff Agent 2.0.10（`D:/FutureStaff Agent`），当前Profile为 `C:/Users/Administrator/.dsh/profiles/futurestaff-alpha`。
- 范围：本地开发Profile更新、受影响平台及抖音插件构建、备份与回滚、软件有序退出/重启、实际界面验收。无服务器部署、凭据变更、平台迁移、真实私信、提交或推送。
- 保留当前Profile设置、其他插件、原发行manifest和现有安装包。更新后的Profile属于用户授权的本地定制，不声称是新的签名/干净源码发行。
- 状态：已完成本机部署，安装程序版本仍为2.0.10。
- 更新：仅替换当前Profile的 `fs-platform-access` 构建产物，新增 `fs-douyin-ui` 构建产物及对应依赖/插件配置；使用软件已有 `--dsh-installer-quit` 通道有序退出后重启。
- 备份：`C:/Users/Administrator/.dsh/backups/douyin-ui-20261003-1e825541-0838-436c-8fe9-4f92654a5dd3`，含原配置、原平台插件及安装哈希receipt；安装后的文件与构建产物哈希一致。
- 实际验收：运行中的FutureStaff Agent已显示“打开抖音获客”入口，页面成功加载全部六个功能标签、默认越南签证画像和空工作区统计。当前主体没有可用授权模型，页面明确提示检查模型授权，AI按钮禁用；未进行真实推理。
- 本地存储：运行时已创建独立 `leads.sqlite` 及WAL文件，位于 `C:/Users/Administrator/.futurestaff/douyin/83817fbe8b3bfecc4a015f2480e0dd3280ab84d7b50a1130d804434189d2a114`；未读取用户记录。
- 验证：部署前受影响插件构建/检查已通过，部署后在真实桌面软件内检查入口及页面；仓库 `git diff --check` 通过。
- 限制：持续评论采集、周期发送和真实抖音DOM校准尚未完成；真实发送保持关闭。未创建新安装包、修改服务器、提交或推送。
