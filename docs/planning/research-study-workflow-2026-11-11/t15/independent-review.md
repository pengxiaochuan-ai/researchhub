# T15 AnalysisBasis 独立审查

2026-11-12。本次只审指定 T15 schema/core/service/projection；不实现产品、不执行 DDL、不重载、不发信。依据 T15 合同与主循环确认的三人通用合成案例。初审当时结论为 **SQL 可进入受保护应用验证，代码仍有 Important 阻断**（修复后最终独立结论见文末），不能据此宣布 T15 或真实分析验收完成。

## 候选 SQL 窄审

审查对象 `schema-candidate.sql` SHA-256 `b7782324249cffeadb36986c989a934622180c48a7e0e909f403a9a64fe1ad7a`。

未见必须先改的结构性阻断。候选只新增 `rh_analysis` schema、三张表和两个触发器函数，没有 ALTER 现有生产表或改 Prisma 历史。`plan` 通过 Study binding / public project / protocol 完整 scope 守门；review、snapshot 使用五列 scope/plan 复合外键；actor 需属于同 tenant。三表强制 RLS，策略精确 tenant/group/project，撤销 PUBLIC 和 aisci_app 表权限后只授 SELECT/INSERT，UPDATE/DELETE 被 immutable trigger 拒绝；没有授 TRUNCATE。schema 的 PUBLIC 权限与函数执行权限被显式撤销。

审阅和快照的触发器均使用相同 tenant+plan advisory transaction lock，审阅核单调 sequence，首次只能 approved；snapshot 锁后核引用的是最新 approved review，并核 manifest / gate 的 scope、plan、review、hash关联和 actor。应用层也按同键锁，不靠给不可变表 UPDATE 权限来 SELECT FOR UPDATE。DDL 本身无显式事务包装，必须由受保护 runner 在单个外层事务应用。

本结论允许主循环对唯一受保护 `wp01_test_full_baseline` 目标另行应用，**本审查没有执行 SQL**。应用后必须实际验证默认 ACL 未残留、aisci_app RLS/无上下文/错scope、错误父链/actor、更新删除拒绝、review/snapshot 竞争、整体回滚与现有表/Prisma 历史指纹。JSON 内容的科学来源与当前用途仍由真实服务重算守门，不能把数据库存入 JSON 当作来源已证明。

## 代码阻断

1. **Important：未知单位可被计划任意声明。** `server/research-analysis/t15-formal-projection.mjs:47` 只在源 schema 的 `field.unit` 已为字符串时比较；没有声明 unit 的源字段可由 plan 声明任意 unit，`:52` 再原样写入 manifest。独立最小探针已复现：无 unit 的 source 输出 `invented-kg`，见 `researchhub/.tmp/t15-unit-metadata-probe.json`。应把源 unit 规范为“明确声明的有效值或 null”，要求变量映射完全一致；未知单位不能通过管理员自由文本补成科学事实。补无单位→任意单位拒绝、null 保留、明确单位一致/不一致测试。

2. **Important：N/A-only 用途适配拒绝已确认的真实 benchmark。** `t15-analysis-core.mjs:42` 对 ethics/researchConsent/dataUse/withdrawal/blinding 全部要求 not_applicable。当前已批准主案例的 researchConsent/dataUse/withdrawal 为 configured，具备真实当前参与事实；不允许为通过测试改变其政策或伪造 N/A。最小方案是在 server syntheticStudyIds + 管理员结构化 synthetic plan 的合成限制内支持明确 configured 分支，dataUse.rules.scope 必须严格 `synthetic-research-only`，继续沿 `assertParticipationCapture` 逐人重验筛选、签署/版本、当前 granted 与精确 scope；ethics/blinding 仍按当前支持状态守门。不得从 purposes、retentionRule 或 futureUseRule 自由文本推导撤回后许可；当前撤回继续阻断。合同相应段需同步，真实临床用途仍不在本最小适配范围。

3. **Important：全 Study 质量事实可在当前质量重验后并发写入。** `t15-analysis-core.mjs:61–66` 将无 subject/visit 的 DataQuery / ProtocolDeviation 纳入 quality，而源批量锁和 plan 锁不能阻止这些无 parent 的旧写路径。`../app/server/src/study-operations/study-operations.service.ts:2651` / `:2699` 的 createDeviation、`:2809` / `:2912` 的 createQuery 在无 parent 时没有共同 authorization/parent 锁，closeDeviation `:2736` / `:2755`、closeQuery `:2938` / `:2948` 也没有同一事务守门。它们可以在 release 或 publish 重算质量后、其提交前写入新的阻断项，旧依据仍被发布。应让实际质量写路径与 T15 当前重验共享同一短事务锁顺序（例如 tenant authorization lock → parents → record），并把关闭及审计置于同事务；或采用已证明等效的串行守门。需两连接真实覆盖 Study级疑问/偏离与 release / publish 的交错。T08 正式疑问路径已有 tenant authorization lock，不应为修此缺口改变其业务语义。

## 已核对的正确边界

计划限三名明确 subject、单 protocol、BASELINE、descriptive、subject 统计单位和直映字段；不能提交 answers。当前角色从数据库读取并核 authVersion，普通读取另核实际 data.analyze，管理命令要求当前租户管理员。共享 Study transaction 决定实际 scope；server allowlist 缺失构造失败。源读取使用真实正式 response/revision/visit 导出，不用 EDC 演示行、CSV 缓存或自由文本数值；逐值保留 0、false、null 与未记录，固定修订 hash/responseVersion/definitionHash。快照重验 latest review、当前源、policy/consent/quality hash，原快照不可重写；Worker dispatch/publish/export 尚须按真实入口接入并验收。

服务写入的计划/审阅/快照、审计与 actor-bound receipt 共事务；同键先核当前权限。release 回执还重验当前快照，不把历史成功当当前可用。保存的 gate 明确是该 snapshot 内结构质量证据，不冒充 public DataQualityReleaseGate 或 ResearchMethodRun。

## 独立验证与冻结值

`node --test server/research-analysis/t15-analysis-core.test.mjs server/research-analysis/t15-formal-projection.test.mjs` **10/10 通过**，输出 `researchhub/.tmp/t15-independent-unit.tap`。这些是投影和输入契约单测；没有真实 SQL/service/Worker/HTTP/UI 执行，且上述单位反例未被既有测试覆盖。

| 文件 | SHA-256 |
|---|---|
| t15-analysis-core.mjs | `e6ae2a4709dcde3f67c329769f320fe05c62daa5eedcee187a78484f13901098` |
| t15-analysis-service.mjs | `772d3b14ad65f8526a113554a4d35324959ad89939d3ec74dcecf64fde618670` |
| t15-formal-projection.mjs | `cb2f9b9a9d4b09cf25092241da7075ec2036494edffe1351c46f67ec25c00624` |

建议下一项：实现者先关闭三个代码阻断，再在受保护目标完成真实 service/RLS/竞争回归，随后接 Worker 的 dispatch/publish 重验。

## 2026-11-12 修复后独立复核

原三项 Important 均已关闭，未发现本次指定 T15 范围内新增阻断。单位在计划校验与原值投影双处规范为“固定 schema 明确非空单位或 null”并要求完全相等（core:52、projection:47），未知源不能由计划填写 kg。合成政策（core:5–6）允许已批准 configured / not_applicable，但 server Study allowlist、明确三人 synthetic 计划、精确 configured dataUse.rules.scope=synthetic-research-only、blinding not_applicable 和真实逐人当前参与事实同时必需；撤回仍阻断，不解释自由文本历史保留例外。四个旧质量写入口现均在事务开始取得 tenant authorization advisory lock，读/写/审计共事务；T15 当前用途和投影重验也先取得同一锁，封住无 subject/visit 的 Study 级疑问/偏离并发窗口。

独立重新执行而非仅引用作者结果：

- `.tmp/t15-independent-final-unit.tap`：16/16，覆盖未知单位、配置用途和四入口事务锁。
- `.tmp/t15-independent-final-pg.tap`：1/1，受保护 `wp01_test_full_baseline` 全新三人 fixture，actual Study wrapper / 当前权威服务，`aisci_app` 角色实际 plan→review→snapshot→dispatch SQL。原值 0/false/null、错误单位拒绝、release CAS、actor 回执和审计故障回滚；来源解锁、全 Study 疑问/偏离、新批准序列、批准撤销及当前参与撤回均拒绝旧依据的新使用。整批外层回滚，不修改主 benchmark。
- `.tmp/t15-independent-final-lock-pg.tap`：8/8，四入口各两个方向真实连接 advisory 等待。诚实边界与作者相同：fixture 未提交，锁等待证明与另一 actual Basis PG 的业务失效证明组合使用，不冒称跨事务业务可见性或并发同键完整验收。

独立冻结 SHA 与作者一致：core `cdc09c834f721e15a93c2006260a385a2a8a4a62397e84db35412c2447edefa2`；service `9bc79285f208b3e471c770e0362ec7364c0f72ead2ea079d2a5017fc16bd9b3e`；projection `4dd454e1039945077d72f9ee954fb3de9c3d7c29ff6350f24f67d2bd85f5451c`；StudyOps `433e1b15820307ab7e9b39532068e6daa4e18ddc2a6207bbcbd648354d036d11`。本复核不执行 DDL、重载、SMTP、主案例数据写入；不替代 HTTP/真实 Worker/S06/交付四层验收。
