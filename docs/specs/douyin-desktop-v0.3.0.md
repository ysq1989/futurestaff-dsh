# DSH 抖音获客界面及本地数据库 v0.3.0

2026-10-03。用户明确选择 DSH 内开发界面、本地数据库存储以及 FutureStaff 授权模型。本轮在前序分析核心上完成桌面插件；不引入平台业务数据库或新平台 API。

## 产品入口

`@futurestaff/fs-douyin-ui` 为独立 Host/Client 插件，加入 FutureStaff Alpha Profile 的来源定义及可迁移发行包装配。使用 DSH 侧栏的“抖音获客”入口和框架内页面，不替换聊天、选品中心或 Harness。依赖现有平台登录服务及 shared client session，退出登录和切换主体时立即卸载旧页面，避免旧主体数据留在新页面。

页面包含：用户选择的平台模型与可编辑画像、AI 检索词拆解、关注账号、关注视频/图文、评论分析及原文证据、目标用户审核/排除/拒绝联系、预约私信预览/启动/暂停。模型只来自当前主体的授权目录；默认画像为明确需要办理越南签证的人，关键词不能代替评论需求证据。

## 本地存储契约

使用运行时 `node:sqlite`，无需第三方数据库进程或原生扩展。最低 Node 22.16；开发验证运行时为 Node 24.16。Node 对该模块的稳定性标记仍需按版本检查，见 [官方 SQLite 文档](https://nodejs.org/docs/latest-v24.x/api/sqlite.html)。

默认数据库为 `<OS用户目录>/.futurestaff/douyin/<Profile绝对路径SHA256>/leads.sqlite`，非Desktop本地运行使用 `local` 分区。Profile 路径只来自 Host `desktopProfiles.current.dir`。数据位于发行 Profile 文件之外，升级或重建 Profile 不删除用户数据。可由可信 Host 配置显式指定绝对 `database` 路径；Renderer不能指定。

本地 Schema 版本由 `PRAGMA user_version` 管理，v1 创建 `lead_state(owner, namespace, payload, revision)` 严格表。按服务端生成的 tenant+user SHA256 主键隔离 workspace/ui/send 三类状态，保留原核心的字段验证。使用事务、WAL和乐观revision检查，拒绝其他Host的陈旧覆盖；未知未来版本不降级。新数据库初始化只修改模块自身数据库，无平台 Alembic 迁移或生产数据变更。旧独立JSON账本不自动导入，不覆盖旧文件。

本地SQLite不加密；保密边界是当前操作系统账号及数据目录权限。供应商密钥和平台tokens不进入数据库、Renderer或日志。没有遥测、评论同步或数据导出功能。

## Host 与权限

Host提供 `douyinLeads` 服务及单一精确路由 `/_futurestaff/douyin/v1/workspace`。请求必须为loopback、合法本地主机、同源（提供Origin时）和固定自定义header；拒绝cross-site请求。GET读取当前主体状态，POST仅接受严格action联合、32KiB JSON及业务界限。主体来自 `platformDevLogin.authorizeLocal()`，没有tenant/user/header输入授权。错误不反射凭据、模型输出或本地路径。

采集器只通过可信Host服务 `recordScan` 入库，没有公开任意评论入库的Renderer路由或模型Tool。模型请求复用前序 `platformInference`、当前所选modelId、逐次平台授权及会话取消信号。

## 预约和撤销

私信预览由已审核候选生成，名单、文案、时间、间隔和数量展示后，通过单独“确认启动预约”操作批准。默认 `live:false`，未配置浏览器时可以保存预览，但启动按钮关闭。真实浏览器配置只来自可信Host Profile配置，禁止Renderer修改CDP地址、账号或选择器；占位配置不能启用live。现有独立MCP不在共享Profile注册通用浏览器能力。

Host调度连接原DmEngine，仅处理一次预约；每条发送前检查当前主体、会话信号、当前规则和候选资格。拒绝联系、规则/模型变化暂停并清除预览，注销/切换主体的信号立即取消执行。成功后标记已联系；拒绝联系不能通过“排除”或新的正向分析重置。中断/不明结果沿用持久attempting与unknown阻断规则。重开软件不恢复启动授权。

## 验收与范围

2026-10-09 内置浏览器采集增量：采集器由 Host 的 AccountBrowser 实现，
复用其服务端 owner 绑定的专用标签页，不从 Renderer 获取 CDP 地址、账号、
选择器或响应数据。启动要求已检查登录、已选择授权模型和已启用关注项。
逐轮采集前后调用既有同源 self 验证，账号变化停止。订阅该标签页页面自身
请求产生的 Network 响应，仅读取 www.douyin.com 的 aweme/post（sec_user_id
精确匹配）和 comment/list（aweme_id 精确匹配）成功响应；再次检查每个作品
作者及每条评论作品 ID。每个响应最多 1 MB，字段经严格边界验证。
一次主页检查最多取返回的 5 个作品，一次作品检查最多取当前页面返回的
100 条评论；不声称完整历史作品或完整评论翻页。缺少匹配响应、页面跳转、
身份变化或结构不支持时停止并显示固定错误码，不反射正文、凭据或堆栈。
页面响应格式是当前适配器的验收契约，尚需用户真实页面验收；不推断缺失
的评论 ID、时间、用户 ID。公开评论按原工作区和平台授权模型边界处理。
停止采集后等待已取消任务结算，再允许关注删除、账号或列表操作。
取消/注销/重启不恢复启动授权，私信 live 配置仍保持关闭。
采用现有 SQLite namespace，日志仅新增可选固定错误码，无表结构迁移。
调度每轮只处理一个到期最早的来源、最多分析 5 条待分析评论。未读取到
的公开作品标题及父评论保持空白，关注项备注不能代替原始公开证据。

验证SQLite恢复、隔离、revision冲突、未来版本拒绝、模型白名单、请求边界、关键词/评论/审核到预约链、注销撤销、实际Cordis挂载与释放、React主要操作和隔离Edge桌面/移动布局。浏览器夹具使用模拟平台模型和临时数据库；不连接真实平台或抖音账号。

仍未实现：关键词自动搜索、关注账号新作品发现、持续评论采集、周期发送和真实DOM校准。界面明确显示采集尚未启用，不把关注启用状态描述为监控正在运行。现有安装包未更新，未执行安装、重启、提交、推送或真实私信。

回退：从Profile来源移除本插件条目即可恢复原桌面；本地数据库保留，旧MCP账本与平台Schema不受影响。未来版本不自动重写旧Schema，错误时停止模块而非清空数据。
