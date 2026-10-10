# Accepted implementation backlog

## 抖音持续评论获客与定时私信

用户已确认使用普通账号浏览器操作、可配置画像和 FutureStaff 授权模型。已完成核心见 `tasks/douyin-lead-analysis.md`；以下拆为后续原子任务，整体功能未完成。

1. 已完成：Host运行装配、主体隔离SQLite与每条发送前资格检查，见 `tasks/douyin-desktop-ui.md`。
2. 已完成：DSH模型/画像/关注/评论证据/候选审核/预约界面，见 `docs/specs/douyin-desktop-v0.3.0.md`。
3. 浏览器采集：受控关键词检索、账号新作品发现、评论翻页与增量采集；真实账号DOM校准后才进行外部验收。
4. 周期发送：周期规则、每日额度、恢复行为与暂停；保持发送授权和审计。真实发送需要用户单独批准。

契约和验收：`docs/specs/douyin-lead-workflow-v0.2.0.md`。不得将单元测试或夹具通过描述为真实抖音自动获客已可用。
