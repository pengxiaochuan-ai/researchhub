# T05 方案发布整改事务契约

日期：2026-11-11。仅提取方案发布检查的整改同步/关闭逻辑，以便在已授权的 Study 事务内原子执行；不改变审批权限、产品流程或数据模型。

- `syncProtocolReleaseCaseInTransaction(user, tx, input)` 与 `closeProtocolReleaseCaseInTransaction(user, tx, input)` 使用调用方的 Prisma 事务，不创建嵌套事务。原公开方法保留原有租户事务包装并委托同一核心。
- 两个核心从服务端用户上下文获取 group/project scope；同步继续在事务内查询当前权限集，生成原有 envelope；创建、复检、关闭的来源、状态、版本、事件与审计保持原样。关闭无匹配案件返回零。
- 这些服务方法原本不独立判定方案发布权限：调用方必须在同一授权事务内验证真实身份、租户和 Study 父链、当前权限及功能开关；传入的用户 scope 和事务必须是该验证结果。不得把整改服务的 envelope 权限查询当作发布授权。
- 异常向上抛出，使发布检查及整改变更一并回滚；不允许缺失整改服务时静默跳过。定向测试仅验证服务契约，真实 PostgreSQL 与 HTTP 事务集成由 T05 主流程验收。
