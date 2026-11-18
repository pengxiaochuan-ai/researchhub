# T07–T09 采集与访视核心独立审查

日期：2026-11-12。只读审核实现，独立运行定向单测和受保护合成库 PG 测试；仅更新审查记录与测试日志，未改业务代码、DDL、配置或重载服务。DataQuery、旧 query guard、尚未冻结的 UI、SMTP 发送不在范围内；文件哈希覆盖整个文件，不表示审过其中不相关新增代码。

## 当前结论

**本轮范围内无剩余 Critical / Important 阻断。** 初审四项及复审新增的可选证据问题均已修复，独立复验通过。此结论只覆盖下列源码和测试，不代表 T07–T09 整体完成、目标 HTTP/UI 已启用或专业用户验收通过。

## 发现与逐项复核

1. **P1，已修复：归档方案仍可开始或完成访视。** 初审 start/complete 的共同参与守门未检查协议状态。当前 `app/server/src/study-operations/study-operations.service.ts:3308` 明确只接受 executing/superseded，`formal-response-visits.ts:19` 的能力投影一致。独立实际 PG 已验证 draft 下开始/完成均拒绝；另将具有原批准政策和同意的旧方案设 archived，同样拒绝，回滚该局部状态后 superseded 旧入组仍可采集和完成。没有以禁止所有旧方案替代正确守门。

2. **P2，已修复：不更改答案而审阅退回，完成依据仍显示 current。** 当前 `formal-visit-evidence.ts:17–19` 把完成时 responseVersion 固定进依据，`:44–46` 同时核验当前版本、锁及最新审阅。PG 验证 completed→unlock→review_returned 后 requires_review；重新批准并锁定仍需显式 reverify；复核追加当前依据，保留原实际完成时间和历史。随后答案更正与再次复核也已执行。缺少旧版本依据仍为 legacy_unversioned，未补造历史。

3. **P1，已修复：H5 渠道撤回可与写入交错，且存在 invitation/session 倒序。** `study-outreach.service.ts:174` 撤回进入共同授权锁；`:410–430` 读取、写入及提交后重放共用当前 H5 守门，按授权锁→project/protocol→subject/enrollment/visit→invitation→session 加锁，锁后重新读取会话与父链。当前 feature、到期/撤销状态及精确渠道同意在 writer/receipt 之前校验；无 delivery 或可核验 grant 时拒绝，不默认放行。邀请创建在事务内重新检查渠道同意（`:275–276`）。PG 实际覆盖撤回先行导致等待后拒绝且无答卷/receipt 写入，以及草稿先行后撤回等待并生效；已提交同键重放和读取在渠道撤回后也拒绝。缺 delivery 的失败关闭和邀请重验是源码结论，未把它们另称为已执行的 PG 分支。

4. **P2，已修复：reverify 的成功回执无法恢复。** core 返回 `{visitId,...}`，初审 Hub 原样保存但 replay 要求 visit.id。当前 `researchhub/server/research-execution/visits.mjs:26` 对 start/complete/reverify 均在同事务操作后 core.read，保存安全访视投影。独立单测以真实 `{visitId}` 形状验证成功回执恢复；未改操作权限或完成历史。本项尚不声称真实 HTTP 回执恢复通过。

5. **P2，复审新增后已修复：可选已提交表单污染必需完成依据。** responseVersion 修复后原 complete 汇集所有 fulfillment，但仅给必需表单加版本，导致正常新完成立即显示 legacy_unversioned。当前 `study-operations.service.ts:1977–1983` 只自动汇入必需 fulfillment；`formal-visit-evidence.ts:30–45` 完整性也按实际必需 assignment 集合核验，避免原有/调用者附带可选新旧 ref 的另一入口。可选答卷、修订及 fulfillment 证据仍保留，不要求可选表单审阅锁定才允许完成。独立 PG 验证可选已提交未审锁时完成为 current，后续可选更正仍 current；附带可选新旧 ref 不污染结果，必需旧 ref 缺版本仍 legacy_unversioned。

## 已覆盖源码和边界


- `formal-response-{policy,authority,lock,writer,commands,query,review,assignment,visits}.ts`、`formal-visit-evidence.ts`；StudyForms/Outreach 的共同写调用；StudyOperationsService 的 updateVisitInTransaction/completeVisitInTransaction 与直接调用的父链守门；Hub formal-capture.mjs、visits.mjs 及相应 controller 装配。
- 当前账号、authVersion、租户/组/项目状态、feature、实际角色按钮权限在事务中重验；tenant_admin 不绕状态/同意/审计。Hub owner 没有因 owner 身份自动得到 fill/review 权限。review/lock/unlock 使用当前 study.review 与项目管理角色；更正使用 form.fill 加原作者或管理角色，普通写入口不冒充更正。
- 现场与 H5 进入同一 writer；H5 actor 使用服务端 session 数据库 ID，未将 token 写入 revision/receipt。策略内容与当前参与事实在父链锁后验证；成功同键可在 CAS 前恢复，其他输入复用同键冲突。receipt 不作为最新状态。
- 共同锁按 project/protocol 前置，再 subject/enrollment/visit、assignment/response。父链重读并比较 enrollment 协议和状态。不可变 revision、前版与 current CAS、投影、fulfillment、审计和 receipt 同一事务提交；未给旧 submitted 批量造 revision。已完成更正不删除原完成时间或 refs，追加新 revision 后会因 ref 改变进入 requires_review。
- fulfillment 只匹配固定 formVersionId，保存 FormalResponseRef；访视完成验证当前 revision、实际 assignment/subject/enrollment/visit/form 父链、最新审阅通过和锁。旧 template-key 匹配没有被用作新版正式满足证据。
- reviewIndependence 只读取批准政策的明确 required/not_required；其他 correction/locking/unlocking 自由文本未被解释为机器规则。通用工程权限、原因、CAS、锁和留痕不代表额外临床政策已得到认可。
- 已发布计分仅消费 FormVersion.scoring；未知算法或无评分字段为未计分，计分字段缺失不输出部分总分，0 与 false 保真；非有限输入和溢出拒绝。v1 canonical hash 明确 JSON、键序、Unicode 与有限数字，拒绝 undefined 和稀疏数组。

## 独立执行证据与边界

- [最终单测日志](../../../testing/evidence/research-t07-2026-11-12/capture-independent-review-final-unit.tap)：七个定向文件 **26/26 通过**，覆盖策略/科学计分/当前权限/锁序/writer/Hub采集/访视。前一轮 25 项日志保留；新增 history cursor 单测通过不构成 DataQuery 审查或实际运行结论。
- [最终真实 PG 日志](../../../testing/evidence/research-t07-2026-11-12/capture-independent-review-final-pg.tap)：**2/2 通过**。对应 `form-response-writer-pg.test.mjs` 和 `form-response-h5-race-pg.test.mjs`，以 `node --test --test-concurrency=1` 独立执行。前一轮 `capture-independent-review-pg.tap` 保留，未用后一次成功覆盖失败历史。
- 顺序 PG 覆盖现场/H5、0/false/缺失、stale CAS/同键恢复、pending_anchor、重复提交拒绝、draft/archived 拒绝及 superseded、review/lock/complete、退回/更正/reverify、渠道和研究同意撤回、可选证据边界、审计异常 SAVEPOINT 回滚。失败注入后检查 response version/currentRef/revision 数量；不代表所有阶段或所有 fulfillment/audit/receipt 的故障完整性已穷尽验证。
- 并发 PG 使用两条真实事务，通过 pg_blocking_pids 确认 H5 草稿与渠道撤回的双向等待；另覆盖现场不同 key 的同一草稿竞争，第二请求等待后 stale CAS 拒绝，最终一个版本和一个 receipt，同 key 后续恢复稳定。**未覆盖并发同 key、提交与审阅竞争、所有权限/feature 更改竞争。** 不能用共享 migration/multi/raw 锁测试替代这些未覆盖场景。
- 两个 PG 脚本先验证既有 fixture guard 与数据库 `wp01_test_full_baseline`；均创建唯一编号合成范围。顺序测试整体回滚，并发测试保留本轮独立合成 fixture；未修改既有业务数据或执行 DDL。事务包装与 feature service 有替身，SQL、锁和业务核心实际执行，不是 HTTP/真实渠道发送测试。合成批准政策不是临床政策或专业验收。
- 原 `capture-core-pg-root.tap` 故障注入在到达预期位置前被 VISIT_NOT_WRITABLE 阻断的失败记录继续保留。实现者报告独立 TypeScript 编译及相邻旧服务回归成功；本审查不将作者结果写成独立执行。

## 本轮冻结内容 SHA-256

以下为最终独立测试时源码；跨范围共享文件仅审查上文指定方法。

| 文件（相对工作区根） | SHA-256 |
|---|---|
| app/server/src/study-operations/study-outreach.service.ts | `44b2f3a17d98167fa1163e86d4360a6237652ddfecfa62e8f91383edc5e47f15` |
| app/server/src/study-operations/formal-visit-evidence.ts | `5062741135c4d49cbae7f64290c95b135ff219914a78f3a7817aa43cf10ce6c5` |
| app/server/src/study-operations/formal-response-visits.ts | `4364e694884530a51a175bfc716549e4b6747e0a59ad6d1cb39a7fdaa3df7dff` |
| app/server/src/study-operations/study-operations.service.ts | `d4bbbac4ad236598fa374925a0a4e142501ebf6754023b2f5cbaa336280df368` |
| researchhub/server/research-execution/visits.mjs | `d95caf0a41a1e4c07a33c2386dea8945029ba137ec305d80b9f8b28b7754e68b` |
| researchhub/server/research-execution/form-response-writer-pg.test.mjs | `7b854f27c2469ea61e535752ff794a640520115be4a6ba409ca1770a40a1ba98` |
| researchhub/server/research-execution/form-response-h5-race-pg.test.mjs | `4df8acc0a9740af32bcc20701301042005320d84803e8d3046e27a18945e28ef` |

建议下一项：由主循环在受控目标运行时完成当前 T07 采集与访视 HTTP、真实角色页面及丢响应恢复验收，再按四层证据推进后续任务；本审查不提前销项。
