# T05 政策与迁移早期预审

2026-11-11。仅评审契约、Prisma schema、canonical SQL、`execution-policy-gate.ts`、`policy-input.mjs`、`policy-drafts.mjs` 及其依赖的现有 Study 授权事务。core 发布、API 和 PG 验证尚未完成，**不是最终验收**。未运行 DDL、服务或渠道，未读取 SMTP。

## 当前结论

本轮 SQL 指纹 `e29f4cab598bf0b146cf51faa340f06a3e83ce0c866eeab69259e8a8dc92dab7` **暂不放行应用到 fixture**，先解决下列两项最小阻断。修复后可复审，仅允许在 wp01 受保护合成环境对这一个 canonical SQL 做精确 hash、同事务守门和留痕；不运行全部 migrate deploy、不写 Prisma 历史、不用于生产。

| 优先级 | 问题 / 影响 | 最小修正 |
| --- | --- | --- |
| P1 | `check_protocol_approved_policy` 只校验 NEW 非空绑定的父链和 hash；已经 approved/executing/superseded/archived 的方案仍能将绑定清 NULL，或换绑同方案另一 approved policy。政策行自身不可变，但批准所依据的绑定可变 | 批准后的方案禁止改变 approvedPolicyVersionId/approvedPolicyHash；使用 `IS DISTINCT FROM` 包括 NULL。已存在但未绑定的旧方案不自动补绑/批准；如需特殊补绑，另定义明确受控路径。保留新 pending_review→approved 在同事务首次绑定能力 |
| P1 | 新表没有 aisci_app 授权。现有 fixture initializer 仅对初始化当时的 ALL TABLES 授权，未见 default privileges；RLS policy 不会赋予 SELECT/INSERT/UPDATE，目标应用路径可能直接 permission denied | canonical SQL 显式授予现有应用角色实际需要的 SELECT/INSERT/UPDATE；无删除政策版本的产品动作，不为方便测试额外授 DELETE。或先提供目标确有适用默认授权的证据，并将部署前置条件明确记录 |

两项已同步主循环及后端实施者。以上为指定文件在预审时点的问题，后续修复须以新 hash 复核，不得引用旧结论冒称新版本已执行。

## 已确认的正向边界

- 新表 ENABLE/FORCE RLS 同时限制 tenant/group/project，缺少上下文不能命中；父链 trigger 校验政策所属 Protocol 的四级范围。批准政策 UPDATE/DELETE 被拒绝，review 状态及责任时间成对约束；protocol 绑定验证政策已批准、同一 Protocol/租户/组/项目且 contentHash 相等。
- policy save 使用现有 Study 事务，在租户授权锁之后重读有效账号、authVersion、租户/组/项目范围；附加 feature 检查覆盖管理员。授权取当前账号和实际组/项目角色，Hub owner 身份本身不授审批管理权限。
- 保存使用 actor/request advisory lock，再锁 Protocol、确认父链，之后 replay；新写只允许 draft，并比较 expectedPolicyId，版本号串行递增。内容、审计和回执同事务；客户端不提供决定人或决定时间，服务端生成。
- 缺省章节被规范化为 missing，没有默认 not_applicable。后者须来源、理由、责任人和有效日期。site 必须 configured/study_wide；需受限中心或盲态机制的配置明确阻断。审核独立性 required 时禁止同录入人审核。
- schema/SQL 不改既有业务行；旧 Protocol 新列 NULL 不等于获准启用。初次新增表无需回填虚构临床政策；审批完成后再绑定真实版本。

## 后续实施必须兑现的契约

1. **审批原子性**：core 需在同一当前授权事务内锁 Protocol 和被审批政策，重查状态/expected policy、机器 gate、固定引用和发布事实，并重算 sections 的 canonical SHA256。不能仅信任可写 contentHash 字段或只检查其格式。政策 approved、reviewedBy/At、Protocol 绑定和批准审计共同提交；失败共同回滚。此处 core 尚未完成，不提前称通过。
2. **不可变版本与并发**：政策更新为追加版本；pending_review 退回 draft 才能继续配置，approved 后不能退回原地改。保存/提交/批准/启用及旧入口使用一致锁次序；授权撤销与 feature 变更须沿现有授权锁协议重验。合法已提交回执重试应先核对当前父链和权限，再返回原结果，不能被新 CAS 错误阻断。
3. **T06 可执行语义**：当前可机器判定的仅中心范围、盲态机制可用性和审核独立性。筛选、同意文本版本、用途、退出/保留/未来使用、安全、改错/锁定/解锁等 rules 目前是非空字符串，gate 通过仅证明材料完整性，不证明自动执行机制。T06/T09/T15 必须增加各自结构化条件和具体操作守门后才能消费，不能把 `executionPolicyIssues=[]` 当作采集、撤回处置或数据分析通行证。
4. **合成决定不成为临床默认**：当前实现没有合成默认值，这是正确边界。测试中 synthetic 的 not_applicable 只能绑定本次合成方案；不得模板化成所有研究默认、不自动复制成临床批准。用户提供真实政策前仍保持缺失/待核对；执行环境和业务记录需继续保持合成标识。

## 修复后单 SQL fixture 验证条件

- 使用现有 fixture guard，在同一直接连接事务重查数据库名、受保护 marker、syntheticOnly、runId、角色；若目标已有此表/列或 hash 不同即停，不拼接非 canonical 修补链。
- 执行一个最终 SQL 并把 hash/前后 schema/实际角色权限写入 fixture_run；不触 `_prisma_migrations`。生产仍使用唯一 Prisma 链另验基线与升级。
- 用受限 app 身份验证同范围读写、跨租户/组/项目 RLS、伪父链拒绝、无权账号拒绝、批准政策不可改删、批准绑定不可换/清空、错误 hash/错误父链拒绝、版本并发和回滚。先完成真实 PG 证据，再判断是否可接 API。
- 对此前旧 approved/executing 行保持原值；不得为了通过新 gate 补造政策。旧入口如何提示缺政策与阻断启用由 core 回归明确举证。

建议下一项：先修复应用角色授权和批准绑定不可变约束，再窄复审最终 SQL；随后完成锁内审批核心及受限角色 PG 反例。
