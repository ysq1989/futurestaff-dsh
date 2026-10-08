# 登录租户与本地工作空间 0.1.0

账号验证只获取授权租户列表，Host暂存五分钟的临时平台会话，密码仅暂存在Host内存，最多五分钟，选择、返回或过期时清除，不写入文件、不返回界面；不打开模型、应用、获客或对话。操作者选择租户后，调用既有 `desktop/v1/auth/password` 的 `tenantId` 字段，取得该成员的真实用户UUID。禁止用旧用户资料拼接租户切换响应。

新增受桌面本地访问门控保护的 POST `/_futurestaff/platform-dev/auth/tenant`，严格请求 `{tenantId}`。租户必须来自本次验证的授权列表；环境、用户、目录由Host决定。安全快照增加 `selecting_tenant`，其中无活动租户、模型、应用或凭据；全部业务授权在确认与Profile启动前拒绝。

固定工作空间数据根为 `~/.futurestaff/workspaces/<environment>/<tenantUUID>/users/<userUUID>/`，包含 `sessions/`、`storages/`、`attachments/`、独立设置、`session-search.sqlite` 和 `douyin/leads.sqlite`；抖音专用浏览器也位于其 `douyin/browser-accounts/`。UUID避免租户重名与改名；用户分区避免共用电脑上同租户成员混用。

新Profile明确配置核心的single-subject身份和collector角色，身份取自已验证平台登录；不依赖只对默认Alpha Profile注入的安装环境变量。现有工具审核与平台授权保持生效。首次通用DSH Profile启动可能显示桌面初始化向导，其完成状态与Profile分别记录。

Profile为 `fs-<environment>-<SHA256身份>`，具有Host校验的身份清单和独立OS保护会话键。通过桌面已有 `desktopProfiles.select` 有序重启到固定Profile；原进程始终保持登录门控。只复制发行插件代码、配置及既有hoisted包元数据，不复制对话、数据库、浏览器或凭据文件；不从公共仓库下载私有插件。

登录后的租户名称只读，更换租户必须退出、重新验证与选择。恢复与刷新核对固定租户身份，错误或不匹配时不能开放本地业务。平台API和Schema保持0.1.1，无平台迁移。

旧共享 `.dsh/sessions`、`.dsh/storages` 与旧获客数据库保留原处，不自动猜测所属租户。原Alpha成为登录入口，使用独立登录缓存目录；新租户初始历史为空。归属不明的数据迁移需单独审核。

验证：账户确认前授权拒绝、伪造租户拒绝、明确租户用户身份、Profile重启前禁止ready、错误恢复拒绝、环境/租户/成员目录和受保护会话隔离、源数据保留、仅代码发布、包元数据兼容、界面选择与退出回归。
