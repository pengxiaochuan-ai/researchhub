# T16 skillKey CHECK 候选窄审

2026-11-12，仅审 `schema-candidate.sql` 与 `rollback.sql`，不执行 DDL。

结论：可由主循环在唯一受保护合成目标使用单个外层事务应用。本候选只把 `public.research_method_run.research_method_run_skill_key_check` 从现有 7 个 skillKey 扩至 8 个，唯一新增为 `descriptive-statistics`；没有添加自由 key、改行数据、RLS、ACL、触发器、其他约束或 Prisma 迁移历史。先取得该表 ACCESS EXCLUSIVE 锁，再精确核对原 validated CHECK 的完整 `pg_get_constraintdef`，原约束变更或未验证即中止；DROP/ADD 必须与 runner 外层事务绑定，不能按语句自动提交。ADD 为 validated CHECK，现有全部记录仍须通过。

回滚自带 BEGIN/COMMIT、row_security=off 和同表 ACCESS EXCLUSIVE 锁，先在不被 RLS 隐藏的全表核对不存在 descriptive 历史，再精确核对当前 8 项 validated CHECK，随后恢复 7 项。发现任何 descriptive 历史必须拒绝，不能删除运行记录以强行回滚。受保护 runner 必须继续校验 database/fixture 身份、禁止生产和额外权限扩张、保留旧行/安全定义/Prisma 历史指纹。

候选 SHA：`1ee76ae5a6071cb8670b69a7c950ef5d87e678b356d015bbf7a5fd85e9f838e4`；回滚 SHA：`eb9d238348af95801e892c30ec694bde2b5b28af13e3264a707e71d04cfc72a5`。该结论只涉及此 CHECK 改动，不能证明新 Skill/Agent 已授权启用、MethodsService 已执行或 Worker/业务验收完成。
