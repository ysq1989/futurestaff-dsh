# 抖音关注与收藏选择导入 v0.5.0

复用 `/_futurestaff/douyin/v1/workspace`，本机请求来源、原生认证门禁及平台授权均保持不变。新动作：

- `library-open`：`kind: following | favorites`，检查专用浏览器当前账号并打开自己的主页，尝试选择唯一语义控件。不能识别时由用户在浏览器打开对应列表。
- `library-read`：相同 kind；只读取当前账号主页中明确标识的关注弹窗，或选中的关注/收藏标签关联面板。没有区域证据时拒绝；不扫描整页推荐链接。最多返回 200 条已经加载且可见的内容。
- `library-import`：`snapshotId`、`ids`（1–200）、`intervalSeconds`（60–86400）。没有 URL、账号、身份、CDP、脚本输入。重新核对当前列表中的所选 ID 与 URL，按 kind 映射 account/work，批量原子去重写入既有 watches，上限 500。

新增响应 `library: null | { kind, accountId, snapshotId, expiresAt, items: [{ id, name, url }] }`，随机快照标识仅存 Host 内存，按当前 owner、会话和抖音账号绑定，5 分钟失效。刷新读取重置选择；断开、注销及重启清除。名称只以 React 文本展示，URL 只接受抖音 HTTPS 的 user/video/note 路径。

页面使用 DSH 主题和既有监控页，支持搜索、全选搜索结果、跳过已有项目、选择间隔、批量导入。用户可在专用浏览器滚动加载更多后重新读取。本版不声称取到完整关注/收藏，也不自动启用评论采集或私信。真实页面若缺少语义标记，将显示需检查列表的提示，待实际页面校准后扩展受控适配。

本地数据仍遵守 tenant-login-isolation-v0.1.0，无数据库版本变更。失败不反射页面文本、Cookie、令牌或路径，仅返回固定安全错误码。
