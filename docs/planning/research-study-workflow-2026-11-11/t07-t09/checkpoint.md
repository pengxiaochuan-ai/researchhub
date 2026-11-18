# T07–T09 实施检查点（2026-11-12，未部署）

## 2026-11-12 · 最新执行状态

19501已由官方stop/start重载当前采集、访视和数据疑问/历史接口；最近本轮记录PID58957。T06回执真实200/404及Chrome恢复已通过，文档/Notion已同步。T07–T09真实HTTP包含0/false、两HTTP CAS、提交同键、审阅锁定/完成、更正失效和显式重核；T08真实HTTP固定历史疑问/回复并发/有理由关闭通过。安全来源与责任人DTO真实GET通过。S09/S05页面主链已有实际角色证据，异常与视觉仍在验，故T07–T09业务整页仍未销项。

T10 context kind扩展、T12 email channel CHECK均经交叉独立审查后，以fixture guard在合成目标单事务应用；旧行/安全/Prisma历史指纹不变。两个扩展均不等于任务产品适配或邮件触达已验收，尚未发送邮件。T11/T12新模块仍在开发，不在当前装配中。T13仅合同和CSV解析单元阶段。下方为历史快照，历史“暂勿重载/DDL未应用”等结论不覆盖本段当前状态。


## 2026-11-12 · 当前证据更新（优先于下方历史快照）

T07 canonical forward SHA256 `340a95acc2f8b16d35e0b903685d0cbd3e9a25e07383e88e0aa7d4172ee726e4` 已在fixture guard受控合成库应用；rollback SHA256 `22ce9ba20f552725a5d33a0e079edfee137d5bd151d0c17a928da945a3adbb8c` 已独立静态复核，未执行回滚。七张旧业务表及Prisma历史前后指纹不变，response新字段均初值；三张新表为空，强制RLS、应用角色仅SELECT/INSERT并有双guard。[实际记录](../../../testing/evidence/research-t07-2026-11-12/migration.json)。正式响应共同核心PG仍未完成，暂勿重载，不代表T07–T09已启用或验收。

共享锁真实转版双向等待和拒绝无半写、批量锁及worker先项目锁后claim已有合成PG证据；原40P01失败保留。worker证据不是完整转版，也不能泛称全仓锁序已保证。T06 S03/S04已有真实角色与异常页面证据；未知结果超时错误解禁正修复，单元通过不代表运行时启用。

状态：进行中，目标运行时仍为 T06；本检查点不是正式功能或验收完成。canonical 候选 `app/server/prisma/migrations/20261112020000_form_response_revision/migration.sql` SHA-256 `340a95acc2f8b16d35e0b903685d0cbd3e9a25e07383e88e0aa7d4172ee726e4`，rollback SHA-256 `89cf42573f6c172e35b295b16a68afa26b8e731c280c42b87572e067ee8256df`，含 FormResponse 新字段和 revision/review/receipt 模型的 Prisma schema `prisma validate` 通过。未 generate、未执行 DDL。回滚仅允许相关三张表为空且所有 response version 和引用保持初值时执行，避免丢失证据或草稿并发基准。独立 review、受控批准和应用由主循环完成。

已存：`app/server/src/study-operations/formal-response-{policy,authority,lock,writer}.ts`，明确 draft CAS、锁/更正状态、JSON v1 内容 hash、账户授权、共享 project/protocol 前置锁和事务写入；published 评分按 `FormVersion.scoring` 只支持确定 numeric-sum-v1，无计分、缺失或非有限数不假造总分。`study-forms.service.ts`、`study-outreach.service.ts` 两渠道初步调用共同 writer；旧 `study-forms.controller.ts` 传 expectedVersion/requestKey；旧前端 `StudyOperationsPage.tsx` 和 `QuestionnaireH5Page.tsx` 传相同基准并保留同输入重试键。正常入组但 assignment 尚无入组关联时锁后可绑定实际入组；旧已提交不自动生成历史。正式代码依赖候选新表和列，绝不在数据库应用及验证前重载。

当前单元测试 `researchhub/.tmp/t07-form-unit-checkpoint.tap`：14 项通过，分别覆盖分数 0/false/缺失/未支持/溢出、CAS/锁/原因/hash、前置锁顺序、权限、draft投影。`form-response-schema-red-pg.test.mjs` 仍对当前无新 schema 数据库给出预期失败。旧代码运行条件下的 server/web 独立 TypeScript 编译已通过，但这是编译证据而非 PG/HTTP/UI 验收。共享锁文件及批量前置锁由 workflow_t05_backend 持有，已将本地锁接入其 `lockCaptureScope`；不得覆盖其改动。

未完成：独立预审 canonical SQL/Prisma/rollback；批准后主循环以既有 fixture guard 仅在新合成目标库应用并保留前后指纹/ACL/RLS；准备并运行真实 PG 现场/H5 提交、草稿冲突、失权/撤回、丢响应重试、ref/fulfillment父链/不兼容版本、插入/生成失败事务回滚、转版并发双事务。必须检查 form writer 源码审查后才面向目标环境。审阅、策略独立性、锁定/有权解锁、带原因更正、访问与完整访视完成固定 refs 的业务入口仍未完成；目前 writer 的 correct 分支尚无对外授权入口。质量/分析失效传播、真实 HTTP/浏览器及专业用户验收亦未完成。H5 仅可按当前受限 session 身份绑定回执，绝不伪造账号或保存 token。

事务核心候选使用：调用方在当前事务先锁授权并重验权限、session、feature，再 `lockFormalResponseScope(tx,scope,assignment)` → `lockFormAssignment(tx,scope,assignment)` → `verifyFormalResponseEnrollment(tx,scope,assignment,captured)`；随即 `writeFormalResponseInTransaction(tx,{scope,actor:{kind,id},assignmentId,subjectId,enrollmentId,protocolVersionId},{requestKey,expectedVersion,kind,answers})`。对外 correct 需单独校验策略及预期revision；不能直接由普通写入口暴露。H5 启用前需验证活跃/已提交同键重放、撤权/过期先拒绝及会话占用与答卷同事务。候选尚未独立源码审查，所有以上均为待验证实现，不是安全结论。
