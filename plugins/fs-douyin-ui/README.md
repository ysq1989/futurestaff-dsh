# DSH 抖音获客

独立 DSH Host/Client 插件。FutureStaff Alpha 的源码 Profile 已注册本插件，入口为侧栏“抖音获客”。使用框架内页面、现有 FutureStaff 登录和授权模型，不打开外部业务网页。

页面包含模型与画像、关注账号、关注作品、评论及证据、目标用户审核和预约私信。持续采集尚未接入；列表为空时不伪造内容或运行状态。

关注账号／关注作品页支持从专用浏览器的“我的关注／我的收藏”读取已加载列表，搜索、勾选并批量导入。导入前再次校验账号及所选内容，重复项目跳过；没有可验证的列表区域时拒绝读取。实际抖音页面适配仍需用登录账号验收，不能从离线夹具推出真实网站可用。

正式登录工作空间把数据库保存于 `.futurestaff/workspaces/production/<tenantUUID>/users/<userUUID>/douyin/leads.sqlite`，身份来自平台验证结果。没有显式数据库配置的独立挂载兼容 `.futurestaff/douyin/<Profile路径SHA256>/leads.sqlite`。SQLite位于发行Profile之外，重建发行Profile不删除业务数据。未选择租户前不采用旧共享记录。

构建：`npm run build -w @futurestaff/fs-douyin-ui`（自动先构建平台与业务核心依赖）。

验证：`npm run test -w @futurestaff/fs-douyin-ui`；Node 22.16+，有可用隔离Chrome/Edge时执行真实浏览器夹具，截图存于忽略的 `work/douyin-ui-review/`。夹具不使用真实平台推理或真实抖音账号。

Host 配置默认 `live:false`。可信Profile可配置绝对 `database` 路径及已经校准的 `browser`（契约见 `mcp/douyin-dm/config.example.json`）；浏览器配置不能从Renderer、评论或模型输出取得。占位配置拒绝live模式。点击预览不会发消息；必须另行核对并确认启动。只有软件运行且授权未失效时才执行一次预约，重新打开后不自动续发。

契约：`docs/specs/douyin-desktop-v0.3.0.md`、`docs/specs/douyin-library-v0.5.0.md`、`docs/specs/tenant-login-isolation-v0.1.0.md`。源码构建不会自动更新安装软件；本机模块发布记录见 `tasks/douyin-library-import.md`。真实私信保持关闭。

账号登录优先使用已安装的 Google Chrome，缺失时回退 Edge；Chrome 使用单独目录，保留原 Edge 登录数据。登录只打开一个标签页，检查本人账号会话时显示进度与明确结果，核验异常保留浏览器供重试。本机修复及验证记录见 `tasks/douyin-login-fix.md`。

桌面原生独立窗口代码已接通：需同步安装本次 desktop-shell 构建与 fs-douyin-ui 构建，桌面入口创建/聚焦一个独立系统窗口；普通 Web 模式继续使用弹层。实现和本机候选记录见 `tasks/douyin-independent-window.md`；未安装新桌面壳时不能宣称该能力已生效。
