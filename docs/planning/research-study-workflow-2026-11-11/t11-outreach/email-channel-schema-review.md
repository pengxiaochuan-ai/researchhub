# T12 email 联系方式约束独立窄审 · 2026-11-12

结论：只允许经 fixture guard 确认的本机合成库、具表所有权的受控事务内应用 forward 候选；不授权生产、其他库、Prisma migration deploy/db push 或直接执行 rollback。仅审核约束变化，不代表发送、回收或业务验收。没有读取/输出 SMTP 凭证。

- Forward `app/server/prisma/migrations/20261112030000_participant_email_channel/migration.sql` SHA256 `ef41733e9bedd8127408491fbe10f429e04cdbe564b55b066629d051a8f2cc0e`；移除原 channel CHECK 并重新建立原两种加 email，不更新任何业务行、权限或 RLS。两条 DDL 必须由调用方在一个数据库事务执行并在任何错误时整体回滚：文件自身没有 BEGIN/COMMIT，不能逐句独立提交。
- 只读现场核对：guard 指向目标合成库，真实 `public.participant_contact_channel_check` 原值仅 `sms_sandbox`、`wecom_sandbox`；该表 RLS 与 FORCE RLS 均开启，owner `aisci_owner`，应用账号有 SELECT/INSERT/UPDATE/DELETE，无 TRUNCATE；候选不更改这些既有权限，审查并不扩权。DDL 执行前仍需再次核目标、hash、约束与旧行指纹，事务内断言保留旧行/RLS/ACL、仅 CHECK 扩充，失败回滚并留证。
- Rollback `researchhub/docs/planning/research-study-workflow-2026-11-11/t11-outreach/rollback.sql` SHA256 `3e642c68949f71d91100c40850a8d73b7e61587769b737e3d7250acc80eb98c0`。事务内 `row_security=off` + `ACCESS EXCLUSIVE` 先锁表，再全局检查存在任意 email 联系方式则拒绝；被 RLS 限制的执行角色不得把隐藏行当空（PostgreSQL 会拒绝受限查询）。本机受控 owner 实际是 superuser/BYPASSRLS，可执行全局检查；其他角色须另核。检查成功后恢复原 CHECK，未删除或更改任何联系方式。检查与 DDL 全事务，失败回滚；锁期间并发写等待。不能对已经存在 email 的库执行回滚，更不能删除历史来绕过检查。
- 不能仅凭本窄审认为邮箱业务链可用；真实消息发送、同意授权、收件验证和专业业务验收另计。
