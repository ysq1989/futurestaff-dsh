# FutureStaff 受管设置 v0.1.0

用户设置只覆盖个人偏好。受管 provider 使用现有 settings-file 的锁、持久化和监视生命周期，在 publish（初次加载、热重载、写入前磁盘核对）过滤非个人 namespace，在 persist 拒绝受管 namespace 写入。原文保持，旧的覆盖不自动采用。

允许编辑：ui-theme（外观/字体）、locale（语言）、ui-chat（对话显示）、ui-conversation（输入提交习惯）、ui-onboarding（欢迎页确认）。其他 namespace 采用 composition/schema 默认值，受管设置不作为可编辑通用表单返回。update/replace/mutate 与 owner scope 均不能绕过底层拒绝。

正式平台地址、授权、供应商接入、租户目录和插件构成来自平台与受管 Profile；DSH 本地偏好不能覆盖。用户仍可选择平台授权模型、业务目标画像、监控内容与任务参数。

本机管理员直接更改程序、Profile 或启动参数不属于本契约防篡改范围。当前发行源在 futurestaff-alpha；已有租户 Profile 需受控更新，新生成 Profile 使用该 provider。平台 API、业务数据库与文件格式不变。
