# DSH 抖音私信扩展

普通账号，浏览器方式：名单发一条文本、关键词自动回复。首版是源码开发扩展，尚未安装到桌面发行版，也未验证真实账号。

```powershell
cd D:\项目\futurestaff-dsh
npm run build -w @futurestaff/douyin-dm-mcp
npm run build -w @futurestaff/fs-core
npm run douyin:profile
```

本次开发环境已创建独立 Profile。安装命令在 Profile 已存在时拒绝覆盖；已有环境直接使用下面的启动示例即可。

复制 `config.example.json` 到忽略的 `work/douyin-dm/config.json`。它不包含可用的账号/会话选择器：`data-operator-verified-*` 是必须人工校准的占位符，不是抖音真实 DOM。账号和当前收件人标记必须返回真实 secUid；入站/出站必须有稳定消息 ID，并正确区分消息方向。不能通过注入伪账号标记满足校验。校准需在已授权账号上完成，页面改版后重新验收。

使用操作者独立的 Chrome 调试实例及两个已登录同账号的抖音 tab：inbox 保持消息页，sender 用于私信。CDP 只接收 `127.0.0.1`/`[::1]`，不替用户启动/登录 Chrome，不读 Cookie。状态及配置文件应限制为本机操作者可读写的 ACL。

`douyin:profile` 创建独立的 `douyin-private` Profile 和会话存储，不覆盖已存在的设置，不启动浏览器。启动示例（先设置本地授权主体/设备；与私有配置对应）：

```powershell
$env:DSH_HOME = 'D:/项目/futurestaff-dsh/.dsh/douyin-private-home'
$env:FUTURESTAFF_TENANT_ID = '<已授权的固定主体>'
$env:FUTURESTAFF_USER_ID = '<固定操作者>'
$env:FUTURESTAFF_DEVICE_ID = '<与配置一致的设备>'
$env:DOUYIN_DM_CONFIG = 'D:/项目/futurestaff-dsh/work/douyin-dm/config.json'
$env:DOUYIN_DM_ENTRY = 'D:/项目/futurestaff-dsh/mcp/douyin-dm/lib/stdio.js'
npm exec -- dsh --profile douyin-private --host 127.0.0.1 --port 3081 --no-open
```

模型配置沿用 DSH 支持的本地配置方式，不会复制平台供应商密钥。真实使用前须配置可用模型。不得挂到当前多租户桌面 Profile；该桌面的账号授权/登出桥尚未接入本扩展。已有独立 Profile 的 MCP 配置如下：

自行装配 Profile 时，还必须配置 `fs-core` 的 `toolScope: douyin-only`、关闭 `session-telemetry-otel` 并固定 `approval.policy: ask`；仓库提供的 `douyin-private` 已包含这些设置。

```yaml
- id: mcp-douyin-dm
  name: '@deepseek-ai/dsh-mcp-client'
  config:
    serverName: douyin-dm
    transport: stdio
    command: node
    args: ['D:/项目/futurestaff-dsh/mcp/douyin-dm/lib/stdio.js']
    env:
      DOUYIN_DM_CONFIG: 'D:/项目/futurestaff-dsh/work/douyin-dm/config.json'
    toolCallTimeoutMs: 35000
    failOnStartupError: true
```

保持 `live: false` 时可以预览/查看状态，启动必定拒绝。取得真实测试授权并校准后才设置 true。DSH 自然语言流程：

1. 给出 secUid 名单、文案、30 秒或更长间隔、最多数量、最长时长，调用 `douyin_dm_preview` 并展示账号和完整计划。
2. 用户确认后调用 `douyin_dm_start`，DSH 审批钩子再确认，传入原 previewId。不能修改原计划。
3. 自动回复用 `mode: reply` 及 `rules: [{contains: "价格", reply: "您好，请告诉我需要的型号。"}]`，同样预览再批准启动。启动前已加载消息不回复；仅监测 inbox tab 当前加载的消息，不会自动读取未加载会话。
4. `douyin_dm_status` 查看进度；`douyin_dm_pause` 随时暂停。重新启动需重新预览和审批。账号/页面不匹配、发送结果不明均停止。

进程异常退出后可能留下 `.lock`。先确认旧进程已退出，再人工移除锁；保留账本。发送中断后的 unknown 不自动重试，须核对真实发送记录后再处理私有账本。本版本没有自动重置按钮。

`sent` 指看到新增的当前收件人出站 DOM 项，不证明送达或已读。完整边界和验收见 [契约](../../docs/specs/douyin-dm-v0.1.0.md)。
