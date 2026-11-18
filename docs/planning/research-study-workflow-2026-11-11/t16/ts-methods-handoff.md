# T16 TS / MethodsService 接线交接

2026-11-12。本步骤实现代码及边界测试，**未配置启用、未从目标API执行新方法、未取得真实业务结果**。Python Worker / schema 由主循环独立实施；本实现未修改它们，也未改 Hub shared controller/runtime/UI、执行DDL或发信。当前只支持已被 T15 服务端 allowlist 限定的合成 Study，不能宣称临床/生产可用。

## 实际入口与注入

```js
const {ResearchMethodsService}=loadExistingTsModule(...);
const methods=new ResearchMethodsService(
  prisma, actualTenantFeaturesService, actualResearchMethodWorkerClient,
  actualDataQualityReleaseService,
  {assertCurrent:analysisService.assertCurrent},
);
const runs=createT16Runs({studies:actualStudyService,methods});
```

第5参数是可信进程内 resolver，Nest token 为 `ANALYSIS_BASIS_RESOLVER`，默认缺失时新方法明确503，旧方法保持。resolver 直接使用 T15 `assertCurrent(tx,user,scope,studyId,snapshotId,phase)`；不能以返回固定允许的函数替代。prisma 必须同时支持实际 forTenant 和 withTenantTransaction，前者供原 workbench 真实 Agent/Skill/Session 选择，后者供授权/来源/claim/发布/审核短事务。不得以固定 Session/Agent/Skill 行或永远允许的 feature 类代替。

原 `createFromWorkbench` 查本租户 active research Agent、现用户 AgentAccess 和已发布 SkillAssignment，实际创建/复用 workbench session；新 key 对应 contextKey `descriptive-statistics`、title“描述统计”。`create` 对此 key 分派至 FormalDescriptiveRuns；它继续按当前账户/authVersion、实际active租户/group/project、会话、Agent/Skill精确版本与当前 feature 守门，再由 T15 判断分析权限和当前用途。普通研究者仍需真实组/项目成员、workbench/chat.use及T15 data.analyze。租户管理员按ADR0006免逐Study成员/组按钮限制，不修改共用角色伪造chat.use；真实Agent/Skill/feature、来源与用途限制仍在。其余旧方法走原代码分支。

### Workbench 会话守门修复冻结

descriptive 的 `createFromWorkbench` 当前先调用 `FormalDescriptiveRuns.prepareWorkbench`，在同一 `withAuthorizationMutation` 事务中核当前账户/authVersion、active scope、普通研究者成员/chat.use、真实Agent/Skill/feature，随后实际 `assertCurrent(...,'snapshot')` 加 `buildDescriptiveInput`，才查找/创建会话；已有run分支也先验证当前来源，再读取原session。准备事务提交后继续原create/claim重新核验。不采用独立预查后再写Session，失败准备不留下Session或Run；旧skill路径保持。root对policy的null-prototype values及特殊变量key守门未被本修复覆盖。

本增量4项专属单测RED→GREEN，覆盖当前账户/版本/成员/按钮/feature/Agent/Skill/来源/project拒绝零写、管理员无需成员/按钮、实际投影失败先于session lookup、事务提交后再进入原create。Methods全目录 **114/114** 与全量 `tsc --noEmit` **通过**；此处最新编译结论覆盖下方初次冻结的并发T14阻断快照。证据及4文件hash位于 `docs/testing/evidence/research-t16-2026-11-12/workbench-session-guard/`。没有重载目标runtime、DDL、改角色或改主三例。独立reviewer另报告真实PG过期authVersion/missing snapshot零Session/Run与管理员实际Worker正例；其外层合成回滚证据不当作独立提交并发或完整业务验收。

## Hub adapter 接口

工厂 `server/research-analysis/t16-runs.mjs:createT16Runs({studies,methods})`，每次先以 Study wrapper 授权并提交解析事务，再调用 Methods，避免嵌套同 scope 锁：

- `create(user,studyId,{requestKey,snapshotId})` → 原 MethodRun 呈现与 receipt `{requestKey,action:'analysis.run.create',targetId:studyId,runId}`。不接客户端答案、rows、hash或basis。
- `list(user,studyId)` → `{studyId,items,limit:50}`；最新50，当前失效项只有 blocked 元数据，没有数值/来源/环境。没有虚构总数或全量已读结论。
- `read(user,studyId,runId)` → 当前可用的完整呈现；失效/失权拒绝，不降级为旧数值。
- `receipt(user,studyId,requestKey)` → 按同 actor、Study、key 对实际 run 只读恢复；404仍未知，不创建/重派。
- `review(user,studyId,runId,{requestKey,conclusion,comment})` → 实际审核与最小receipt。conclusion=confirmed/returned/needs_input，comment必填。角色只取当前数据库 tenant_admin / pi / methodologist，不信任客户端 reviewRole。
- `reviewReceipt(user,studyId,runId,requestKey)` → 同 actor/run 的审核事实定位；先当前basis与方法权限，404不重试审核。
- `cancel(user,studyId,runId)` → 当前方法权限下只取消未终结状态，返回最小 `{id,status,stage,errorCode}`；允许失效来源的元数据取消，迟到Worker不能发布。

MethodsService 同时提供 `getDescriptiveReceipt`、`getDescriptiveReviewReceipt`、`getDescriptiveListItem` 供 adapter 使用。Hub路由、同源/JSON、前端未知结果恢复及站内确认由主循环后续接入，本文件不冒称已经挂载。

## 精确本机配置需求

只在受保护合成范围配置，不跑通用 seed 或给全部租户默认装备。

1. 已批准且当前可用的 T15 plan/review/snapshot，服务端 syntheticStudyIds 明确包含该 Study。
2. 本租户 `research_methods_worker` entitlement enabled；actual WorkerClient 指向已认证的真实本机 Worker，默认65,536字节/8秒上限。
3. 普通研究者须真实组/项目成员，角色含workbench/chat.use及T15 data.analyze；租户管理员不需要逐Study成员/组按钮。所有操作者都核真实active租户/group/project，审批规则及当前同意不因配置跳过。本步骤只读核对当前本机admin，role=tenant_admin/isTenantAdmin=true/active，group角色没有chat.use；没有改角色，已据此补无成员/无按钮管理员正例及普通研究者拒绝反例。
4. 本租户 active research Agent；研究者 AgentAccess 必须当前有效，管理员沿现 Methods 规则；实际 published SkillAssignment 必须有效，不能创建虚假会话绕过选择。
5. 独立 Skill version1，key `descriptive-statistics`，name“描述统计”，kind可沿 quality_alert，status published；backend精确 `{lib:'research-methods-worker',call:'descriptive-statistics',executorKey:'descriptive-statistics',operatorVersion:'descriptive-v1',runtime_state:'ready'}`，rules至少 `{llm_forbidden:true,auto_repair:'forbidden',analysis_basis_required:true,review_policy:'methodologist_or_pi_review'}`。两份 seed 源码已登记该定义，**没有运行 seed 或加入 DEFAULT_AGENT_SKILL_KEYS**。

## 数据库前置及版本

只读查询受保护 `wp01_test_full_baseline` 当前 CHECK，仍为原6项+diagnostic-evidence-assembly。候选 `schema-candidate.sql` 仅在外层事务下先 exclusive 锁并精确断言旧定义，再追加新 key；旧行、RLS、ACL、触发器均不变。SHA `1ee76ae5a6071cb8670b69a7c950ef5d87e678b356d015bbf7a5fd85e9f838e4`。rollback SHA `eb9d238348af95801e892c30ec694bde2b5b28af13e3264a707e71d04cfc72a5`，全局存在任何新方法历史就拒绝，不能删历史换回滚成功。必须独审后沿唯一canonical迁移链受控应用，不自行启动执行。

保留 global workerVersion `t19-1`，新 executor/operator version 独立 `descriptive-v1`。输入hash固定 actual worker input +完整AnalysisBasis+Skill版本+算子版本，algorithmParams保存SAP/map与subject单位；dataSources持有完整basis，来源固定修订在该不可变manifest内。数值由 Worker 返回，TS仅核有限性、列/分母/状态、完整JSON路径 evidence 同名同值与 manifestHash 假设，不重算均值或标准差。每次真正发出Worker前与发布前独立重验来源，外部调用不持数据库事务。

## 状态、故障和仍待验收

新运行同事务写 queued+来源/版本+审计，再一次认领 running；同key永远只回读已有状态，不能因 queued/running/failed 重派。未知响应保留原key恢复。Worker错误明确failed，无数值；dispatch/publish时basis失效抑制发布，当前方法授权仍有效时仅记录basis-invalid失败。账号/方法权限撤销时不另写失败伪装已收口，直接拒绝并保留原事实。取消、审核与claim状态竞争采用同一授权/row锁；review请求键审计与review事实/状态同事务。

旧来源更正/解锁/撤回/批准撤销后的数值不经详情/review/receipt返回；列表仅显式blocked元数据。旧运行与数值历史不删除。confirmed才completed；returned/needs_input只记事实并转待处理，需新请求运行，不自动重算。现terminal snapshot immutable触发器保持，review/cancel不改固定inputs/outputs。

代码冻结清单与证据：[freeze.json](../../../testing/evidence/research-t16-2026-11-12/ts-methods/freeze.json)。Methods全目录110/110与Hub adapter 2/2通过；包括projection/evidence/精确版本、integer不静默变换、单次认领/在途重放/Worker失败/来源失效/取消/审核回执/列表blocked、管理员ADR0006正反例，旧方法回归保持。该目录保留RED→GREEN和旧历史迁移测试失配的初始失败；历史迁移原文未修改。最终全量noEmit当前被并发T14的formal-feature-parser与formal-visit-evidence共7处诊断阻断，T16无诊断，不能宣称最终全量编译门禁通过；日志 `tsc-frozen-blocked-by-t14.log`，已通知其owner。未构建覆盖共享dist。

下一阶段必须：独立代码/SQL复审→受保护CHECK应用及RLS/旧行指纹→真实Study/会话/Agent/Skill/feature配置→实际MethodsService到Worker及Run/review/receipt持久→在途更正/撤回/失权/取消真实双事务→目标HTTP及S06两角色浏览器→独立oracle对照。当前单测中的授权/basis/Worker替身只证明代码契约，不能证明任何上述实际能力。

建议下一项：完成独立复审并应用受保护 CHECK 后，先执行三人真实基准的 Methods→Worker→Run→人工审核链，核对独立oracle再接S06。
