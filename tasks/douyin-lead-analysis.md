# 抖音获客：画像、模型选择及工作区核心 Atomic Task

- 基线：main / 57bb64e2e0；保留既有桌面升级、产品插件、发行脚本及前序私信代码。
- 用户决定：使用 FutureStaff 平台模型，由使用者选择；目标画像可配置，默认为需要办理越南签证的用户。
- 范围：High Risk（模型权限/主体与潜在外部消息）；实现分析和本地工作区核心，扩展一次性预约。无真实推理、外部发送、部署、提交或推送。
- 契约：docs/specs/douyin-lead-workflow-v0.2.0.md。
- 修改：fs-platform-access 的可选模型授权及 Host-only inference；douyin-dm 的画像/分析/工作区和 scheduledAt；聚焦测试与文档。
- 验证：fs-platform-access 类型检查及84项测试通过；douyin-dm 类型检查及38项测试通过（含隔离 Edge/CDP 夹具）；根目录55项测试通过；相关构建及 git diff --check 通过。测试只使用模拟模型与浏览器内容，没有验证真实平台推理或抖音账号 DOM。
- 状态：核心完成，整体评论获客功能未完成。下一原子任务见契约，不覆盖 tasks/CURRENT.md 中的既有桌面任务。
- 必须交接：尚无UI、实时采集循环、周期发送、工作区到MCP/桌面的运行装配及发送资格撤销链；DOM需实际账号校准。不得宣称已上线或从平台模型选择即可开始持续获客。
