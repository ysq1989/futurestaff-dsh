# FutureStaff 受管 DSH 设置

- 用户明确选择 FutureStaff 统一配置优先，固定部分 DSH 设置。本次为配置与共享运行时 High Risk；main 57bb64e2e0，保留所有既有工作，不提交/推送。持续抖音监控仍待实现，未取消。
- 所有权：平台插件提供受管 settings provider，Profile 控制插件组成，平台决定身份与模型。个人偏好保存于现有租户/用户目录。
- 优先级：FutureStaff composition 与平台授权高于 DSH settings.yaml。仅 ui-theme、locale、ui-chat、ui-conversation、ui-onboarding 可使用本地用户覆盖；未审查的新 namespace 默认不允许覆盖。
- Host 执行：读取和热重载忽略受管 namespace 的本地 section；写入底层 persist 拒绝，涵盖 update/replace/mutate/owner scope。保留文件原文及旧 section，不迁移、不删除。描述接口不发布不可编辑的通用表单。
- UI：关闭上游模型供应商设置、内置插件配置页、Cordis 插件操作面板和 Agent 预设选择。保留通用设置；平台授权模型仍由使用者选择。业务画像、监控选择和私信任务配置沿用业务页。
- 集成：复用已安装版本 0.1.2-rc.1 的 settings-file，构建期打包入平台插件 managed-settings 子入口，不修改 pinned Harness，不增加运行时安装步骤。SQLite 与平台 schema 不变。
- 边界：控制软件设置 API/界面及 settings.yaml 的值优先级；不是阻止本机管理员修改程序、Profile 或启动参数的 OS 防篡改机制。未改真实平台数据、授权或凭据。
- 验收：真实 provider + Cordis 注册，初次读取/热更新/直接 API/owner scope/持久化/跨目录隔离；个人偏好可写；受影响测试和构建；本机备份更新和启动。状态：本步实现、验证和本机发布完成。
- 检查：平台 102 项通过（含受管配置 5 项）；根目录 55 项通过；npm run check:workspaces 全部工作区测试与构建通过；平台 typecheck 通过；git diff --check 通过。没有新增配置 lint 命令，未宣称 lint 检查通过。审阅受管 provider、Profile 配置、子入口清单、构建脚本与部署回滚路径。
- 发布：仅更新 fs-platform-access 的 lib/公开子入口到 canonical futurestaff-alpha 和当前绑定租户 Profile，末尾追加 provider 名称与 UI 禁用策略，保留两处原数据目录。Host/Client/managed-settings 构建哈希匹配，无修改正式平台或真实消息。
- 回滚：C:/Users/Administrator/.dsh/backups/managed-settings-20261004-da73467c-be78-4723-8e6e-7ab70df458d0；先有序退出，按 receipt 恢复 original-0/original-1 和对应原 patch。数据和设置文件不删除。
- 实际原生启动：工作区和抖音入口存在，标准模式选择按钮已不存在，无启动失败提示；平台仍显示登录门禁，真实登录后通用设置/模型的人工验收保留。没有代操作用户认证。
- 后续：抖音持续监控和评论采集仍未完成；此前关注/收藏代码已更新，但真实页面适配待账号验收。其他非活动旧租户 Profile 未在本次自动升级，新增租户由 canonical 源复制受管代码。
