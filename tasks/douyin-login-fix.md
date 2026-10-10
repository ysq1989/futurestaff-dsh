# 抖音登录回归修复（2026-10-04）

- 用户报告：登录打开两个标签、未使用 Chrome、检查状态没有反馈。范围为现有 fs-douyin-ui 账号流程，无数据库迁移或消息发送。
- 基线：main；保留既有未提交的全部开发工作。本次修改 account-browser.ts、Host 安全错误码、Client 检查反馈与相关回归测试，更新账号契约。
- 修复：优先查找所有 Chrome 安装路径，再回退 Edge；启动单个空白页，通过 CDP 复用该页进入抖音个人页，重复打开复用当前会话。按原 owner 分区保留本机浏览器数据。
- 核验：只读取同源当前会话本人账号接口的 sec_uid，不从个人主页地址、输入或文字推断登录；异常保留浏览器并返回安全错误码，UI 展示进行中、未确认、成功、失败。关注／收藏准备阶段在核验后打开已验证账号的规范个人页。
- 实际页面诊断：当前已登录浏览器存在两个抖音标签，地址仍为 /user/self；同源本人接口 HTTP 200、status_code 0，账号格式有效。仅记录布尔结果，没有输出 Cookie、响应原文或账号标识。
- 验证：最终模块 Host/DOM/SQLite/真实隔离浏览器 28 项及 React 11 项全部通过（39 项）。typecheck、模块 build、git diff --check 通过。无配置 lint 命令。
- Chrome 常见 Application 路径未发现安装，进一步检查系统 App Paths 注册表后发现实际安装在 LOCALAPPDATA/Google/Chrome/Bin/chrome.exe；已补充该路径并执行 Chrome 单标签回归。
- 发布：已执行现有备份／哈希校验／有序退出／重启流程；两处 Profile 模块哈希匹配。仅更新 canonical 与当前主体 Profile 的 fs-douyin-ui，保留配置、数据库及浏览器目录。备份为 C:/Users/Administrator/.dsh/backups/douyin-login-fix-20261004-3a6253a0-a845-44e4-85b6-8bd4075d0d14。
- 部署后应用进程及本机监听端口已恢复。直接诊断请求被 Host 认证层拒绝（forbidden），没有尝试绕过；安装后软件内完整点击流程待用户验收。实际登录识别已在更新前的当前抖音会话验证，单标签启动与 UI 反馈已通过隔离浏览器／React 测试。

- Chrome Bin 路径补充后再次运行完整 39 项测试并发布；最终构建备份为 C:/Users/Administrator/.dsh/backups/douyin-login-fix-20261004-b9e54f70-9f37-4653-83e6-1252ac8282bc，两处模块哈希匹配。初次备份保留修复前模块。


## 2026-10-05 登录检查再次失败

- 用户报告登录检查失败。实机诊断：专用 Chrome 进程已不存在，而旧 Host 仍显示浏览器已打开。原实现未观察 child exit，重复打开沿用失效 CDP；同时每次检查主动 Page.navigate，会中断扫码回跳并使异步本人接口执行环境销毁，单次异常即失败。
- 修复：观察自有 Chrome 进程退出并关闭 CDP、清除 active；检查时对已退出进程再次兜底。当前页直接核验同源 authenticated self，不再重新导航；DOM/context/暂时超时在既有 8 秒窗口内重试。持续失败保留浏览器并返回 allowlist 错误。账号、owner、取消与发送约束保持，无 schema 或 Cookie 修改。
- 验证：完整模块 46 Node + 14 React 共 60 项通过；增强真实隔离 Chrome 回归验证用户关闭后状态断开，再次打开确实启动新进程；focused account-browser 16 项通过。typecheck/build 与 git diff --check 通过，无配置 lint。
- 本机更新：六处哈希和配置保持检查通过，备份 C:/Users/Administrator/.dsh/backups/following-sync-20261005-e0a4a2f1-45e3-4d42-9463-9f20c4678d34，receipt work/following-sync-installed.json。平台测试账号进入同一系统体验租户，模块账号页显示未连接且检查按钮禁用。真实抖音重新登录及最终 19 条保存尚未验收。

- 安装后实机核验：打开专用 Chrome 成功，点击“检查登录状态”后返回“检查完成，尚未确认登录”，没有原先 ACCOUNT_CHECK_FAILED；浏览器保持打开。当前 authenticated self 未确认身份，Chrome 原生“发生个人资料错误”提示仍出现。这一资料问题没有通过修改/删除 profile 或凭据处理；最终登录成功和关注保存不得宣称通过。
