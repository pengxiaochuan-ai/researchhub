# T05 转版与 T06 参与事件窄审

日期：2026-11-12。独立评审只读指定源码、测试及已有证据；仅编写本报告，没有执行 DDL、服务、模型、邮件或角色变更。

**结论：本次冻结点的 T05 正常转版执行未发现未解决的 blocking；T06 修正 ACL 后的单个 canonical SQL 可在指定受保护合成库执行，且已读到主循环提交记录。** 这不代表 T05/T06 整体完成。T05 新增只读回执恢复接口是本冻结点之后的增量，须由主循环另审；正常转版的真实 HTTP/UI 验证亦由主循环继续。T06 旧入组核心、HTTP/UI 和退出/撤回全链尚不能据本审查销项。

## 审核指纹

| 范围 | 实际审核 SHA256 |
| --- | --- |
| `researchhub/server/research-execution/protocol-migration.mjs`，正常 execute 冻结点 | `ea869961c8e3478c2c0f38d822d05765a84edce41e094de22b252c3a11aa8e7e` |
| `app/server/src/study-operations/protocol-migration-lock.ts` | `88dc81736d3b5f0bb99c9d74ba7afe77ae6b05c23a932eb2beb2fbedb1887543` |
| `app/server/src/study-operations/protocol-task-lock.ts` | `ec5abb279ffd5c7db73cc2ddd0136ed48d391c53bf4b685cfc678501ebffbcbe` |
| `app/server/prisma/migrations/20261112010000_study_participation_event/migration.sql`，最终 ACL 版 | `5bbaf33225b366f690eb3e9ba484f3074ca6b999376964150342fd4b11643e47` |

以上为审查快照。后续文件变化不自动继承本结论，尤其不涵盖随后新增的 receipt 查询/恢复路径。

## T05 正常转版执行

已确认 `createProtocolMigrationService.execute` 使用实际 Study 授权事务，调用正常 `executeMigrationInTransaction`；不再按数据库名放行，也不再固定抛出不可执行错误。核对点如下：

- 同事务核验当前 Study 父链、有效角色与 feature，再取得 actor/request 锁。回执绑定 actor、操作、目标、请求 hash 和 Study；合法历史回执先于最新 CAS 返回，改内容、撤权或跨 Study 不可借此读取/执行。
- 新执行验证原预览 token、过期时间、目标 revision、固定政策及完整影响快照。在 project→target protocol→排序后的 subjects/enrollments/visits/tasks 锁内重读，等待后再次检查有效期和变化；只有未开始且无证据、政策兼容的入组允许转版。
- approved 目标调用真实 core activation；executing 目标重新核验真实 release gate 与 fixed references。批准政策、固定 Form/Scale/Outcome 的检查继续有效，不以 published 元数据代替材料可用性。
- 旧任务和访视只取消并保留，入组指针更新、新访视和要求事实生成、审计与回执在同一事务；数量/CAS 不符或生成异常必须回滚。审计记录来源/目标政策及旧新访视关联。
- `lockCaptureBinding` 保留并重查原 enrollment 绑定；共同 subject→enrollment→visit 锁防止等待后的旧采集写入。任务依赖批量操作先按 subject 排序再锁任务，旧现场/H5、量表、资料、照片、导入及相关访视写入已检查对应 guard 接入。此为指定改动范围审查，不宣称全仓所有写入口均已认证。
- 本次发现的 T05/T06 衔接缺口已补：snapshot 将同 scope 下 subject 或 enrollment 的 `study_participation_event` 计入 evidence。已有筛选/同意/参与事实时首版转版明确阻断，不复制旧事实替代新版同意。

早前 Outcome 来源缺失问题也已复核修正：结局必须指定本方案访视；data_field 唯一对应该访视固定表单字段；scale 对应该访视固定量表和合法 scoreKey；未知来源阻断。待审队列的当前权限、账号/租户/authVersion cursor、分页 continuation 和受控站内链接未发现新增阻断；列表可见性不代替真正 canApprove。

## T06 canonical SQL 与事件边界

核对 `StudyParticipationEvent` schema、SQL、`participation-events.ts`、`participation-authority.ts`、`participation-gate.ts` 及契约：

- FORCE RLS 限 tenant/group/project；trigger 核对 Subject、Enrollment、Protocol、已批准 Policy/hash 父链及被替代事件归属。事件只追加，UPDATE/DELETE 被拒绝；sequence 唯一和按 scope/subject/version 检索索引与调用方式匹配。
- 必需字段 NOT NULL，条件 CHECK 对可空 reason/method/signer/textVersion/scope 使用 coalesce，不因 SQL NULL 逻辑绕过。effectiveAt 不晚于 recordedAt；撤回/退出/不适用需理由，人工筛选须 manual，同意授予需签署主体及相应文本版本/用途范围。
- 初版 SQL `afaa99a03cccbd81345c17816c234f8f2410651af4584884ab8634980bf9987f` 静态只写 GRANT SELECT/INSERT，未覆盖目标既有 owner 默认 ACL。主循环实际权限断言发现应用角色仍有 UPDATE/DELETE 后，**整个事务已回滚，不能记已应用**。
- 最终 SQL 显式 `REVOKE ALL PRIVILEGES ... FROM aisci_app, PUBLIC` 后只 GRANT SELECT/INSERT。已重新全文审查并批准上述 `5bbaf...` 精确版本，仅限现有 fixture guard、同事务目标/marker/runId/角色检查、实际 ACL 断言和 fixture_run 文件 hash 留痕。禁止 migrate deploy、篡改 Prisma 历史或借此授权生产。
- 当前服务以真实账号/authVersion、租户/组/项目、study.execute 和 feature 守门；Hub owner 不自动授执行权。人工筛选、同意版本/用途及不适用依据须对应固定政策，不猜临床规则。已入组后的撤回/退出目前明确拒绝，尚未实现状态投影和后续采集/处理阻断，不能称撤回已经全链生效。

## 实际证据边界

| 证据 | 本次已核对的含义 |
| --- | --- |
| [T05 release PG](../../testing/evidence/research-t05-2026-11-11/release-pg.json) | 10 项实际数据库/core 检查：提交、审核、启用、历史默认保留、Remediation、回滚及退回；非 HTTP/专业验收 |
| [T05 非转版 HTTP](../../testing/evidence/research-t05-2026-11-11/http-result.json) | 6 项真实 HTTP 提交/审批/默认启用链；不能代替历史转版 HTTP |
| [队列与引用 PG](../../testing/evidence/research-t05-2026-11-11/queue-references-pg.json) | 6 项真实受限角色、分页、撤权、范围及空表单阻断 |
| [批量导入 PG](../../testing/evidence/research-t05-2026-11-11/multi-import-pg.json)、[访视 writer PG](../../testing/evidence/research-t05-2026-11-11/visit-writer-pg.json) | 已读取并发等待/绑定变化及反序批量无死锁记录；范围仅文件所列反例 |
| T05 `protocol-migration-preview-pg.test.mjs` 与实施者冻结回报 | 已读实际数据库测试实现及真实 core release/fixedRefs/approved activation、token、快照变化、撤权、回滚和参与事件阻断。测试使用 fixture Study wrapper，并在受保护事务中回滚；评审者没有重跑，不能称真实 Hub HTTP 已验证 |
| [T06 migration](../../testing/evidence/research-t06-2026-11-12/migration.json) | 已读取最终 `5bbaf...`、syntheticOnly、wp01_test_full_baseline、committed=true、Prisma 历史未改、业务行修改 0；DDL 由主循环执行 |
| [T06 participation PG](../../testing/evidence/research-t06-2026-11-12/participation-pg.json) | 9 项记录包含真实前置发布链、三类固定政策参与事实回读、site/无执行权拒绝和事件/审计回滚；不等于旧入组入口、HTTP/UI 或专业验收 |

## 交回主循环

1. 审查新增只读 receipt 恢复增量，完成正常转版实际 HTTP/UI 及证据归档；不得用本冻结点审查替代新增路径验证。
2. 同步仍过时的 T05 转版阻断说明，以及 T06 契约中的锁顺序为实际 auth→project→protocol→subject。此为文档同步事项，不把旧文字当新代码结论。
3. 继续 T06 入组接线和明确尚未开放的退出/撤回边界。保持代码、目标环境、实际执行和专业结果四层分列，不替用户签收。

建议下一项：由主循环完成转版回执恢复增量复核与真实 HTTP/UI 闭环，随后继续 T06 入组核心接线和原子性验证。

## 主循环增量复核（2026-11-12）

已读 `createProtocolMigrationService.receipt` 与 controller 路由：只读查询先复核当前 Study 和发布管理权，以当前 tenant/actor/requestKey 取现有回执，再核对 execute 操作、Study、目标 protocol；不返回预览 token、不重放写入。未查到为 404，当前权限缺失先返回 403。接口不依赖原预览仍在有效期，可用于提交未知结果的恢复。

全新 [19501 HTTP 合成案例](../../testing/evidence/research-t05-2026-11-11/rh-t05-migration-http-a8554a3d/http-result.json) 实测配置、政策检查/审批/启用、真实旧核心入组、候选分页、阻断预览、批准方案启用与选定入组转版，以及过期后的执行同键重放和只读回执查询。已开始访视与旧版参与事实保持原版；未选入组不变；被选原任务/访视取消但来源版保留，新增访视要求为 missing。无发布管理权的另账号实际 403。先前一次脚本误预期其返回 404 的失败轨迹保留，属于验收断言修正，未跳过权限检查。页面恢复与真实浏览器仍由 UI 子任务收口，不据 HTTP 单独标 T05 完成。
