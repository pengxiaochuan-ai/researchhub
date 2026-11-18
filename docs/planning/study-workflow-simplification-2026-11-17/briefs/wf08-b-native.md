# WF08 B · 原生续算围栏实施切片

2026-11-18，承接 `wf08-internal-contract.md`。A V5独评与真实整事务回滚预测已通过（`admission-prediction-2026-11-17T16-43-15-501Z-3dcd2f18`）；根现授权本切片产品编码，不提前启用消费者、HTTP 或页面。WF09–WF12不进入本切片。

## 工程裁定与具名文件

根已核当前 `ResearchMethodsService.descriptiveRuns()` 每次在私有方法内新建 `FormalDescriptiveRuns`，构造只传 prisma/worker/resolver/grant。仅修改后者不能让配置后的旧 prepare/create/cancel 识别 Job reservation，也不能把可信实例安全交给持久消费者。B允许最小增加可选可信依赖及内部方法入口，未配置的旧 app 保持原合同，不增 HTTP 恢复路由。

- `../app/server/src/research-methods/formal-descriptive-runs.ts`：只读固定 OperatorRef；同事务 prepare/绑定；queued/running 的私有受信续算；before-lock、dispatch/publish、两类 basis cleanup 的同事务 fence；旧入口 reservation/marker 防绕。
- `../app/server/src/research-methods/research-methods.service.ts`：增加可选 adapter 注入与内部适配入口，构造向 FormalDescriptiveRuns 传递同一可信 adapter；不改变无配置调用，不依赖在运行时覆盖 TS private 方法。
- 可新增单个 `../app/server/src/research-methods/descriptive-job-contract.ts` 存共享窄类型/注入 token，必要 helper 不另造通用任务框架。
- 对应 native 行为测试新增具名 job spec，原 formal/descriptive policy/workbench tests 保持；根保存所有上述文件 before/hash，后续 D 才装配到19501。
- 独立 consumer/repository/fence issuer 的 MJS 属 B 后续切片，在上述内部接口冻结后编码，避免两处独立定义接口。

## 接口约束

以内部合同第4–5节为准。内部 capability 只能由受信 issuer 创建，反序列化 JSON、复制 marker、caller boolean 和 settle capability 均不能获得 compute 权。固定 metadata marker不是授权。adapter 必须在原 official→tenant 锁后、所有 Session/source/Run 锁前核 Job；目标交叉绑定和发布 CAS 继续核同一代。Worker调用在事务外，原数值算法/映射/8秒边界不改。

Job逻辑Scope含studyId四字段，原生Prisma/T15 scope仅tenantId/studyGroupId/researchProjectId三字段，Study作为独立参数传入；不得直接将四字段展开进native where。根第三轮真实预测已证验收builder错误传入studyId导致PrismaValidationError，aisci_app只读诊断对比三字段成功，见`wf08/root/native-scope-readonly-diagnostic-v1.json`。B与D适配必须沿此边界，不修改原T15或Prisma来接纳无效字段。

OperatorRef冻结实际 agent/skill/backend+rules+ioContract 的摘要，消费不得再次选第一个 Agent。prepare 必须在传入的同一个物理事务内创建或复用 Session、queued Run、原 create audit、Job target 绑定，重启不重新 create。resume 对已发布结果只读，failed/cancelled不复活；未发布 running 在新的活代 CAS claim后允许确定性重算，不承诺物理CPU恰一次。

原无Job调用且未配置 adapter 不查 rh_analysis。配置后 pre-marker active reservation 跨authVersion守门，永久保留的原生 key 不可借用；终态后新非保留 key 不永久锁死同一 snapshot。精确既知成功幂等只读、详情及原独审保持。

## 行为验证与门禁

先 RED 再 GREEN，覆盖：拒绝接纳无 Session；原子 prepare 回滚；固定算子改动拒绝；queued/running同原Run接续；旧 generation 迟到成功、Worker失败及两个 markBasisBlocked 出口零写；取消结算能力不能派发；JSON伪造拒绝；旧 prepare/create/cancel 前置防绕；无配置旧应用保持。新测试写明 spy 仅为代码契约，真实执行仍由根后续新合成目标验证。

冻结源快照/相对patch、测试命令及输出。A冻结源不为B顺带重排，C full和D接线不提前实施。产品能力在四层和文档/Notion齐备之前始终标实施中。
