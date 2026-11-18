# T10 context kind SQL 独立审查 · 2026-11-12

范围：只读核对 `context-kind-candidate.sql` SHA-256 `a4821abdfbbb0b75acc259fba8a130579ddbcde5e8ee411266a0b9e1bd164473` 与 `context-kind-rollback.sql` SHA-256 `3499b02fb5fc99644aa28ada5c04eb9aefab9882b908921e5c25a9c2521c4277`，对照 `server/study-tasks/schema.sql` 的原有约束、RLS、trigger 与 grants；未执行 SQL、未读取或修改业务数据。

候选仅替换 `rh_study_tasks.context.context_kind_check`，保留三个原类型并追加 `formal_response_ref`，既有非 none 的 source/parent/root/version/hash CHECK、任务与 actor 的 scope trigger、强制 RLS、现有授权不变。可供 root 在目标名称、数据库身份、当前约束定义、文件 hash 均校验后，仅对受保护合成库以单事务 apply；不可作为整个 T10 业务通过的证据。ALTER 获取表锁，原子事务中任一错误必须全部回滚，实施前后比较旧数据、约束、RLS、ACL 和 Prisma history 指纹。

rollback 显式事务与 ACCESS EXCLUSIVE 锁使检查和约束恢复之间没有并发插入窗口；`SET LOCAL row_security=off` 在无法绕过强制 RLS 时应报错而非漏看隐藏行；如存在任一 formal_response_ref 则必须中止，不删除或改写历史。执行角色需确实能全局读所有行并由 guard 验证，不能禁用 RLS 代替。候选不验证 revision 父链、固定 hash、当前权限或同意：这些必须由正式写入核心锁后验证并另做并发 PG/HTTP 测试，既有 context_scope_guard 只校验任务与账号 scope。数据库约束扩展本身不证明该新类型可安全开放。
