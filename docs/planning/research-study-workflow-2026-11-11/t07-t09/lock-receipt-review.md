# T06 回执恢复与 T07 共享锁增量独立审查

日期：2026-11-12。范围严格限定为本轮冻结的 subjects/enrollment receipt、两个 GET 路由及测试，以及 protocol-migration-lock、protocol-task-lock、worker-publication beforeClaim、ingest multi/upload 与 raw publication 锁增量。未审正在变化的正式答卷、StudyForms、StudyOps T09、UI 15 分钟恢复补丁；SMTP 预检不在发送验收范围。

## 结论与问题

无 Critical。共享锁增量在下述具体覆盖范围内未发现阻断。回执恢复初审发现一项 **Important / P2**，主循环已修复并经本轮增量源码复核与单测复跑确认；当前指定范围无未解决阻断，真实 HTTP/归档场景仍待验证。

**P2：历史参与回执被当前方案的执行条件阻断。** `researchhub/server/research-execution/enrollment.mjs:45` 在读本人回执前调用完整 `state()`。它绑定到 `app/server/src/study-operations/participation-events.ts:26` 的 `participationContext`，除当前身份、权限及被试父链外，还在第 35 行要求可用执行方案，并在第 46 行要求政策完整。具体反例：未入组被试的筛选或同意事件已经提交成功、响应丢失，随后方案归档且没有 executing 方案；仍有执行权限的本人按原键恢复时，已有 receipt 尚未查询便得到 `NO_EXECUTING_PROTOCOL`。历史结果是否成功不应依赖当前是否还能执行新命令。

最小修正：在同一现有授权事务复用当前 `authorizeParticipation` 和精确 subject/Study/scope 检查，再查询本人 receipt；历史恢复不调用完整执行状态准备。保持账号/authVersion/feature/权限与父链守门，不放宽命令入口，不跳过本人/action/target/key 比对。补“有本人回执、当前无可执行方案但权限仍有效”的恢复测试；失权仍应在读 receipt 前拒绝。该问题已发主循环。

修复复核：enrollment.receipt 现先调用 `core.authorize`，再查精确 scope、subject ID、deletedAt=null、acceptanceFixture=false，之后读取本人回执；controller 将 authorize 装配到既有 `authorizeParticipation`。record/enroll/get 的执行状态守门未改变。已读取主循环 `.tmp/t06-receipt-history-red.tap` 中新增反例的 `NO_EXECUTING_PROTOCOL` 失败及 green 文件的 12 项通过记录；本轮独立重跑 receipt 文件 5/5 通过（包含该反例）。这证明代码与单测修复，不代替真实已归档方案的 HTTP 恢复验收。

## 回执已核对项

- 上层 `withResearchStudyTransaction` 在事务内锁定授权并重验账号、authVersion、租户与 Study 访问；建档恢复还要求当前 canCreate，修复后的参与恢复通过既有 authorizeParticipation 重验执行权限及精确被试父链。
- repository 的 getReceipt SQL 同时限定 tenant_id、actor_id、request_key；恢复再限定保存的 action、target_id、result.studyId 和内嵌 receipt 的 action/target/key，不能取其他账号或其他 Study 的结果。
- 两个新增路由为 GET，返回 no-store，不执行 create/record/enroll、审计写入或命令重放。404 只表示未找到可确认结果，未被改写为原操作失败。
- 初审 receipt 文件 4/4 通过但未覆盖上述方案变化；修复后实际重跑同一文件为 5/5。主循环相关套件为 12 项，与本轮复跑不可相加为独立覆盖数。HTTP 和 UI 仍待目标环境验证。

## 共享锁已核对项

- `protocol-migration-lock.ts:9` 在 subject 锁前取得当前 scope 的 project FOR SHARE 和去重、按 SQL id 排序的固定 protocol FOR SHARE；缺少任何对象即拒绝。原 subject→enrollment→visit 锁后比较协议/状态仍在，未用新共享锁替代同意检查。
- `protocol-task-lock.ts` 对批量任务先解析全部父链，再锁全部固定协议和排序 subject，逐项重验绑定后锁排序 task 集合；检查旧 status/version/父链，避免按输入顺序逐个 subject 造成反向等待。普通无被试任务不被强加入组条件。
- `ingest.service.ts:116` 先锁全部准备快照中的协议，再锁 processing_task，再统一排序锁本次所有 subject，最后逐项比较 expectedEnrollment；上传路径第 401 行也在 subject 前锁 scope。草稿/导入回调前仍检查 task、来源和对象版本，未以 uploader 冒充当前操作人。
- `worker-publication.ts:32–36` 的顺序为授权锁→当前 worker 授权→可选 beforeClaim→assertLiveClaim→publish；未传回调的旧调用顺序保持。raw 的 beforeClaim 在 `raw-processing.service.ts:199–201` 只先取 project/protocol 锁，尚未占用 processing_task；之后 live claim 锁 task，再锁 subject/file 并重验入组及来源快照。并非在授权前或 claim 失效后写发布结果。
- 以上 manual/raw 路径实际是 project/protocol→processing_task→subject，与转版的 project 排他锁形成前置隔离；未将其误描述为所有路径一律 subject→processing_task。新回调不能包含外部调用或结果写入，当前 raw 回调只有查询及锁。

已读取真实 PG 证据：`docs/testing/evidence/research-t07-2026-11-12/migration-lock-pg.json`（真实 migration.execute 两个先后顺序）、`multi-import-lock-pg.json`（反向双被试批量与重叠输入）、`raw-worker-lock-pg.json`（等待项目锁期间 processing_task 未被占用、变版后拒绝且不调用发布）。它们支持对应锁行为，不能扩称完整导入或完整 raw 转版验收；raw 证据明确 fullMigration=false。`lock-unit-root.tap` 记录 35/35，通过证据由主循环生成，本轮未重跑 PG。原 40P01 失败文件继续保留，不以新成功覆盖问题历史。

## 审核源码 SHA-256

| 文件 | SHA-256 |
|---|---|
| researchhub/server/research-execution/subjects.mjs | efc76ba464ffe06ebbc00073517d486b8af9da0d013b34cce88af47c3c896bdb |
| researchhub/server/research-execution/enrollment.mjs（修复后） | 971534b60b68f14bb43be32f11ba6ff678fac28104643bbd1b7116d55c32fb5a |
| researchhub/server/research-studies/controller.mjs（仅审两个 GET 与 authorize 装配） | bf54b586a1b25e00731cf7ff86ee1dc75a91974ea184c19dbbcc338741a144cd |
| researchhub/server/research-execution/participation-receipts.test.mjs（修复后） | d0310f8f56c740405f1cd7ff3b2571292cb29219d843cd0e514724c8060822d2 |
| app/server/src/study-operations/protocol-migration-lock.ts | f0289305ff3104939299b0ad26dd8efc0055ea1a2dc4fa4340c6caa88e7907b2 |
| app/server/src/study-operations/protocol-task-lock.ts | df73b74fbd244a04e57024f22cd0b1f409412b5655eceb06c95cead6a2f0d904 |
| app/server/src/common/worker-publication.ts | 2ce303d401018a32929a73427b5c0724a6d78a92773c0420608ed3e651213d71 |
| app/server/src/ingest/ingest.service.ts | 4f3fd0964897b9d9380253454fa63f7e526bf2e34b01532b3190f0ea7acef1f6 |
| app/server/src/ingest/raw-processing.service.ts | 267f590dc455d5f6f77f7d4598ef36f000a8eaecc1b910bdd3396e463ecadfdc |

仅新增本审查文档，未编辑实现、DDL、服务或配置。服务实际启用、真实请求执行与业务结果仍由主循环分别举证，不以静态 review 或单测替代。
