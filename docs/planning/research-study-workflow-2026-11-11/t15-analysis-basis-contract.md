# T15 正式变量与 AnalysisBasis 实施合同

2026-11-12。依当前 implementation-plan T15：正式答案→变量投影→质量放行→不可变快照。本轮新增 T15 实际源读取、计划审批/快照持久服务与测试；按主循环授权最小修改旧StudyOps四个质量写入口的共享锁与事务。作者未改controller/runtime/UI/Prisma、未执行DDL；主循环已独审并在受保护wp01应用canonical三表。实际PG与证据见末节；Worker/HTTP/UI由主循环继续集成，不能标T15整体完成。

## 实际可复用入口与缺口

| 现有源码 / 接口 | T15复用与限制 |
|---|---|
| `formal-response-query.ts:readFormalResponseInTransaction(tx,user,scope,assignmentId)` | 当前授权、父链、同意、mode、当前ref/版本/审阅/锁；读取真实FormAssignment/FormResponse，不从CSV缓存或EDC演示行取数。其守门是采集政策，不能当完整分析用途授权；适用历史保留分析但禁止新采集的研究须另建经明确政策批准的读取适配，不能绕过当前函数。 |
| `formal-response-history.ts:readFormalResponseRevisionInTransaction(tx,user,scope,assignmentId,ref)` | 精确scope/subject/enrollment/visit/form/protocol/policy与不可变envelope哈希；从revision.answers取原值，既有submitted无revision拒绝，不补历史。 |
| `formal-response-visits.ts:readFormalVisitInTransaction` | 固定visit/protocol、当前完成完整性。已完成但requires_review/legacy_unversioned拒绝正式分析来源；未完成访视不得伪造完成状态。 |
| `protocol-migration-lock.ts:lockCaptureScope/lockCaptureBinding` | 全批先auth→project→sorted protocols→sorted subjects→enrollment/visit，再逐答卷。不能在锁住一被试后才取另一协议锁。 |
| M10 `data-quality-release-policy.ts` | 复用canonicalManifestHash、createGateEvaluation、releaseGate、assertQualityReleased；精确manifest哈希/门版本/waiver时效，未知或空输入不可放行。 |
| M10 `DataQualityReleaseService` | `recordEvaluationWithTx`当前写规则版本t19-1、关联ResearchMethodRun并生成remediation；`assertCurrentReleasedWithTx`选择最新全项目gate，重新组装旧Feature/count清单且可能写stale。**不可直接绑定本T15快照**；需要同事务、显式snapshot/manifestHash/rulesetVersion/gateId适配，不能仅把参数JSON塞进去。release现为独立服务事务，也不能在Hub事务里嵌套调用。 |
| M11 `ResearchMethodsService.create/createFromWorkbench/withMethodPublication`、`ResearchMethodWorkerClient.execute` | 复用真正Run/审计/授权发布/Worker，不另建执行内核。现Methods发布重验session/agent/skill/feature，但尚未重验本AnalysisBasis；需T16增加执行前/发布前相同基准检查。旧DataService Feature分组/固定case-control不可作为本CRF来源；现Worker白名单不自动有描述统计。 |
| `StudyExecutionPolicyVersion` / `StudyParticipationEvent` | 已有批准policy与append-only参与事实。dataUse.purposes/scope、withdrawal effective/retention/futureUse目前主要是自由文本，不能推导机器允许；configured blinding现被executionPolicyIssues明确拒绝。 |
| Prisma `DataQualityReleaseGate` / `ResearchMethodRun` | 前者已有manifestHash/version/qualityRun关系；后者有inputHash/dataSources但无正式快照FK。**当前没有StudyAnalysisSnapshot模型**。本轮不伪造持久化，不把AgentStageSnapshot/全Studygate改名作正式数据快照。 |

## 一值一来源与统计单位

第一最小实现只支持明确选定的单protocol、固定FormVersion字段直接映射，不支持变换、推导分数、时间窗猜匹配或跨版本合并。一个观察行固定subjectId+enrollmentId+visitId+protocolVersionId；每个变量值固定formVersionId+fieldKey+formDefinitionHash（当前schema/scoring）+FormalResponseRef+responseVersion。多张表可映射到同一观察行，重复同一访视/重复变量映射拒绝；重复访视不能悄悄覆盖。

变量表由服务端批准/固定的variableMapVersion定义 `{key,formVersionId,fieldKey,valueType,unit}`。单位只保留明确声明，未知为null，不猜测/换算；number/integer/boolean/text/select类型必须与实际固定schema相符。字段原始0、false保持；不存在为`missing:not_recorded`，明确null为`missing:null`，空文本为`missing:blank`，不输出0替代。现答卷没有标准化未测/不适用原因，**不能从null猜not_measured/not_applicable**；如研究需要，先扩明确missing-reason映射并版本化。未知计分算法不投影总分；本轮仅字段直映，量表/文件/Feature来源待T10/T14明确版本接口再接。

`statisticalUnit`必填：subject或subject_visit。subject模式每被试只能一个已明确选择的访视，重复被试直接拒绝，绝不自动取首次/末次/均值；subject_visit允许同被试不同访视，但manifest同时保留rowCount/subjectCount及每个行身份。T16不能将subject_visit行数当独立受试者n；纵向推断方法仍需SAP与支持的算子。显式selection限定本批来源；本轮不自动计算全研究纳入/排除，完整cohort选择理由是集成前置材料。

## 最小源读取模块与精确注入接口

新增 `server/research-analysis/t15-formal-projection.mjs`，不注册路由、不创建数据库模型。`createT15FormalProjectionReader(deps)` 所有依赖必填，没有允许式默认：

```
lockSources(tx,user,scope,selection) -> void
// 集成方先锁当前tenant授权，真实Study绑定，再批量锁全部scope/parents，核来源没有软删/转版。
authorizeUse(tx,user,scope,{phase,input}) -> {
 decision:'allowed', executionPolicyVersionId, consentViewHash, blindingViewHash
}
// phase为snapshot/dispatch/publish/export；服务器当前data.analyze及实际Methods/Agent/Skill授权；
// 还须明确分析purpose、当前参与事实、已批准可机器执行的用途/撤回/盲态视图。缺政策拒绝。
readResponse = readFormalResponseInTransaction
readRevision = readFormalResponseRevisionInTransaction
readVisit = readFormalVisitInTransaction
normalizeSchema = normalizeFormSchema
canonicalManifestHash = M10同名纯函数
```

`input`固定 `{studyId,purposeKey,protocolVersionId,sapVersion,variableMapVersion,statisticalUnit,variables,observations}`；observations为 `{subjectId,enrollmentId,visitId,sources:FormalResponseRef[]}`。purposeKey必须来自已批准用途解析，不能由字符串命名本身取得授权。

`read(tx,user,scope,input,{phase})`先lockSources、authorizeUse，再从上述真实core读取；不接受客户端answers。核当前ref==选定ref、submitted+review_approved+locked、精确subject/enrollment/visit/form/protocol；任何错误整批失败、不静默剔除。完成访视必须completionIntegrity=current；未完成状态记录并交质量/SAP选择规则，不假冒已完成。取immutable revision.answers，生成深冻结的manifest+manifestHash。Hash复用M10，输入限定JSON有限标量，数组按明确身份排序；固定版本标记。请求中的sapVersion/mapVersion/selection必须由集成服务端批准对象解析，本模块的字符串校验不代表批准。

本轮使用当前capture reader是保守最小路径；它在撤回后直接拒绝。已明确允许撤回后特定历史用途的研究不得被默认批准，也不应被永久误禁：需解析批准的结构化政策及相应新读取适配后支持。合成not_applicable必须来自本研究已批准记录和实际参与事实，不能变成真实临床默认。

## 快照、放行与失效合同（设计基线，具体三表实现见末节）

1. `StudyAnalysisSnapshot`拟append-only持久内容：scope/Study、selection与排除原因、cutoff、protocol/SAP/map版本、投影manifest/hash、实际actor/time、当前policy/consent/blinding view hash。payload不可更新；current usability为独立治理事实。唯一canonical migration须另审RLS、最小ACL、完整父链、不可变trigger及防重复receipt，本轮不建第二迁移链。
2. `AnalysisBasis` = `{studyId,snapshotId,manifestHash,protocolVersionId,sapVersion,variableMapVersion,executionPolicyVersionId,consentViewHash,blindingViewHash,qualityGateId,qualityGateVersion}`。持久snapshotId与精确gateId缺一则不是可执行AnalysisBasis。未持久的manifest不能冒充已放行快照。
3. 质量清单针对本次source/field；先阻断未知历史、失审/解锁、未解决疑问、适用偏离、完成依据失效及用途/盲态缺失。疑问查询须复用T08实际ref绑定状态，适用临床范围/缺失率阈值须来自批准规则，不套旧age0–120等默认阈值。旧assembleQualityManifest中提交计数/Feature清单不替代答案。
4. 如沿旧public质量gate，`evaluateSnapshotWithTx(tx,actor,snapshotId,rulesetVersion,expectedHash)`需关联真实qualityRun；本轮已裁决改用末节snapshot内结构质量证据，不虚构qualityRun。`releaseSnapshotWithTx(...,gateId,expectedVersion,expectedManifestHash,reason)`先锁当前授权+snapshot/source+gate，复核当前规则/waiver，再调用M10纯releaseGate，CAS与审计同事务。role由当前账户及实际权限映射，不冒充PI；tenant_admin按ADR0006处理但仍受状态/用途/盲态限制。
5. `assertBasisCurrentWithTx(tx,actor,basis,phase)`必须读exact scope+snapshot+gate/version；重跑本源reader与用途resolver，比较manifest/policy/view hash，再用assertQualityReleased。任何更正、解锁、审阅退回、疑问重开、gate/waiver撤销/过期、用途撤回、角色/盲态范围变化均拒绝新使用。旧快照留历史，不重写原数值。
6. Worker排队前、真正dispatch前、结果publish前各重验；期间变化则cancel/blocked/stale并抑制结果发布，不能只靠异步失效通知。T17报告创建、导出/下载也重验。撤回已交付文件无法承诺收回，保留交付与处置事实。不能持数据库事务跨Worker调用；结果写回事务重取锁/重验。

## 验证与本轮交付边界

新增模块单测验证真实源接口调用契约、0/false/null/不存在、固定field/ref、重复访视与subject单位、读到陈旧/未审/未锁来源拒绝、当前授权先于值读取、同manifest可重核与深冻结、policy/view改变导致hash改变。测试替身只能证明接口/纯规则，不能证明目标来源已接入；集成后必须使用已有正式Study现场/H5/CSV修订而非新增EDC演示表，受保护PG验证真实readRevision哈希/当前锁，再做exact gate/persistence/Worker/HTTP/UI四层验收。

初始纯投影阶段缺口已由下节候选core/service继续实现：机器化合成用途、snapshot持久命令、固定质量证据及T08疑问查询。首轮冻结时尚未应用SQL/运行真实PG；现已由主循环受控应用并由作者执行PG（见末节），Worker/HTTP/UI仍须独立验收。无waiver路径。本轮没有统计计算、LLM数值或生产操作。

## 已裁决的最小持久与真实接口增量

主循环已确认采用三表 `rh_analysis.plan / plan_review / snapshot` 候选，均append-only。`plan`为管理员提交的显式软件合成AnalysisPlan；`plan_review`序列追加approved/revoked（无UPDATE），撤销即时阻止新快照、dispatch及publish；`snapshot`固定投影与M10纯规则产生的结构质量放行证据。snapshot内qualityGateId/version明确属于该行的持久放行证据，**不是public.DataQualityReleaseGate，也不虚构ResearchMethodRun外键**。三个表复用rh_research.operation的actor-bound回执与public.audit_log。需独立审SQL后沿唯一canonical链应用；当前候选不可自动启动或应用。

本轮唯一允许的机器用途：服务端配置允许的合成Study + 当前管理员明确声明synthetic数据 + 显式三名subjectIds + `BASELINE`访视 + 固定字段映射 + `purposeKey=synthetic-research-only` + `method=descriptive` + `statisticalUnit=subject`。研究/用途/撤回实际policy可为已批准configured或有据not_applicable，并经实际当前参与事实守门；configured dataUse.rules.scope必须严格为synthetic-research-only，盲态仍须已批准not_applicable；没有自由文本推导。该限制不是临床默认。plan必须先真实提交再真实review，snapshot人工release也由当前管理员执行。普通读取仍需现有data.analyze与当前scope，不把owner当PI。源数据尚未形成时返回未具备来源，绝不造修订或替被试填写。

新增实际入口工厂 `createT15AnalysisCore({load,syntheticStudyIds})` 绑定现有TS服务导出；syntheticStudyIds是显式本机软件验收范围，缺失拒绝构造。`createT15AnalysisService({studies,core,receipts})`复用withResearchStudyTransaction，公开submitPlan/reviewPlan/preview/release/readSnapshot/receipt/assertCurrent。所有写命令含requestKey；review包含expectedSequence，release包含当前previewHash；同key读取原结果前仍重验当前权限与适用源，过期/撤销不是自动重新写。队列/Worker须用assertCurrent的dispatch/publish阶段，不可只依赖创建时判断。

候选SQL具备精确scope RLS、Study/public parent链、最小SELECT/INSERT ACL抵消default arwd、不可改/删trigger、review单调序列及snapshot绑定批准review；应用前还需实际PG验证。append-only表用按Study+plan的transaction advisory lock序列化，不给应用UPDATE权限只为SELECT FOR UPDATE。全批源仍先统一父链锁。current计算包括当前正式疑问与访视偏离状态；本合成基准无waiver，任何未关闭项阻断放行，不套医学阈值。


## 2026-11-12 冻结点与集成接口

按主循环要求先冻结供独审，未运行DDL、未修改 shared controller/runtime/Prisma/UI。新增源码：`t15-formal-projection.mjs`、`t15-analysis-core.mjs`、`t15-analysis-service.mjs`；两个单测文件共10项通过（`.tmp/t15-core-freeze-unit.tap`），service通过`node --check`。这只证明投影与计划输入契约，不覆盖SQL/service实际事务；下一轮独审/apply后必须补真实PG与故障/并发测试，当前不能标T15完成。

API对象全部使用当前user与真实Study wrapper：

- `submitPlan(user,studyId,{requestKey,definition})` → planId/contentHash；不要求答案已提交，但须真实入组、参与事实与固定访视/form来源可用。
- `reviewPlan(user,studyId,planId,{requestKey,expectedSequence,decision,reason})` → reviewId/sequence；初次expectedSequence=0，只能approved；后续可revoked/approved，追加事实。revoked不要求源仍可采集，避免撤回后无法撤销。
- `preview(user,studyId,planId)` → manifest/manifestHash/evaluation；不写业务记录，源必须已提交、审阅并锁定。
- `release(user,studyId,planId,{requestKey,previewHash,reason})` → snapshotId/manifestHash/qualityGateId/qualityGateVersion；当前管理员手工放行，无waiver，重算CAS后同事务快照+审计+回执。
- `readSnapshot(user,studyId,snapshotId,phase='snapshot')` → `{basis,manifest,qualityGate}`；source、最新approved review、当前同意和quality全量重算。basis包含type、Study/snapshot/hash、plan/review、protocol/SAP/map、policy/consent/blinding哈希及quality id/version。
- `receipt(user,studyId,key,{action,targetId})`；action分别analysis.plan.submit/analysis.plan.review/analysis.release，target分别Study/plan/plan。先当前admin，再actor-bound历史回执。plan/review回执是历史动作确认，不代表当前批准；release回执必须重新核snapshot当前可用。
- `assertCurrent(tx,user,scope,studyId,snapshotId,phase)`为已有事务内接口，scope精确`tenantId/studyGroupId/researchProjectId`。调用方在事务开始设置同一scope上下文；phase仅snapshot/dispatch/publish/export。返回同readSnapshot；须在排队/真正运行前与交付前各调用，不能仅比较旧hash。

所有数值统计留给后续确定性worker，本模块只原值投影。合成scope为服务端显式允许Study列表；不接自由文本用途、不把not_applicable当临床通用默认。Study计划审阅锁先于批量project/protocol/排序subject锁；数据库三表仅SELECT/INSERT，review序列advisory串行，不借UPDATE权限锁不可变表。尚需PG验证真实RLS、SQL parent trigger、JSON/日期序列化、事务回滚、权限撤销、同键与并发，以及源更正/解锁/疑问重开/批准撤销后的dispatch和publish失效。


## 独审修复契约

固定schema无unit或空unit时，投影unit只能null；计划不得自行声称kg等单位。存在非空固定unit时须精确一致，既不换算也不补单位。批准计划时同步校验，不等到快照才发现。

既定合成benchmark的configured筛选/研究同意/数据使用同意/撤回政策保持原样。现有assertParticipationCapture仍在源锁后核最新事实及policy哈希；T15另要求configured dataUse.rules.scope精确synthetic-research-only，blinding必须not_applicable。source/reason/futureUse等自由文本不作机器授权；任何已撤回当前事实保守阻断，不解释历史保留例外。服务端Study allowlist和管理员显式synthetic plan仍同时必需。

全Study无subject疑问/偏离同样参与质量门。四个旧入口createQuery/closeQuery/createDeviation/closeDeviation在同一事务开始先取得现有tenant authorization advisory lock，再走原scope/parent/record与审计。T15读取/放行/交付已有同一锁，解决无parent记录并发漏读；不扩大权限、不改变正式答卷应走新入口的既有拒绝。不以锁代替当前权限。真实双连接须覆盖两个方向等待及提交后失效。


### 独审修复验证进度（迁移前阶段记录）

单位/配置policy两项原行为RED已保存；修复后12单元通过。四入口旧无锁行为RED已保存，修复后4单元通过，旧StudyOps32回归通过。受保护wp01两连接共8项通过，分别覆盖4入口的analysis锁先持有与writer先持有，`pg_stat_activity`实际观测advisory等待，全部新fixture回滚。锁测试竞争的read lane为T15使用的同一真实authorization lock；因fixture未提交，不冒称其已证明跨事务业务数据可见性。另已准备actualStudy/aisci_app的AnalysisBasis PG以证明真实质量release/publish失效，尚待canonical迁移后执行。证据在`docs/testing/evidence/research-t15-2026-11-12/`。


## 修复后最终冻结与真实PG边界

主循环完成独审后沿canonical文件仅在受保护`wp01_test_full_baseline`应用三表，SQL SHA仍`b7782324249cffeadb36986c989a934622180c48a7e0e909f403a9a64fe1ad7a`；应用与旧表/Prisma历史指纹证据为`schema-migration.json`。作者未执行DDL。

最终验证：16项定向单元、旧StudyOps32项、双连接锁8项全部通过；独立完整server tsc最终通过（初次由并行T16两项编译错误阻断，后主循环修复，未由本作者改T16）。`t15-analysis-pg-final.tap`为真实PostgreSQL业务链，actual Study wrapper/current authority/core服务，aisci_app角色写入plan/review/snapshot和actor-bound receipt。所用全新3人fixture在同一受保护事务内回滚，未写benchmark主3人、未改其现行政策。

该PG明确验证：configured筛选/研究同意/数据使用/撤回 + 实际参与事实；plan提交/审阅；尚无答案拒绝快照；三份真实正式修订审阅锁定后投影；0/false/null和未知unit保真；previewHash CAS释放；同键重放/改内容冲突；未知target回执404；审计异常令snapshot与receipt一并回滚；已有basis dispatch读取；来源解锁阻止publish；全Study无subject疑问与偏离分别阻断质量与使新快照publish失效；plan撤销阻断、重新批准使旧review绑定失效；withdrawn参与事实同时阻断新preview、dispatch和publish；失效账号会话先于回执返回。M10质量业务错误转换为HTTP409领域码，未把未放行伪装成500或成功。

这里的PG提交均是测试事务中真实SQL、最终整体回滚；不是19501 API或持久交付验收。锁测试证明真实两向advisory等待但不宣称未提交fixture的跨事务可见性；T15同键同时请求尚无独立双连接业务测试。真实benchmark现场/H5/CSV链路、worker实际数值执行与报告交付、HTTP/browser及用户业务验收仍由主循环接续，不能由本轮测试替代。

冻结源码SHA：core `cdc09c834f721e15a93c2006260a385a2a8a4a62397e84db35412c2447edefa2`；service `9bc79285f208b3e471c770e0362ec7364c0f72ead2ea079d2a5017fc16bd9b3e`；projection `4dd454e1039945077d72f9ee954fb3de9c3d7c29ff6350f24f67d2bd85f5451c`；shared StudyOps `433e1b15820307ab7e9b39532068e6daa4e18ddc2a6207bbcbd648354d036d11`（全文件值含此前工作，不代表本轮改全部）。
# 页面操作能力投影补充

计划列表/固定详情在实际core.authorize返回的当前服务端身份上投影canSubmitPlan/canReviewPlan/canReleaseSnapshot；本期仅当前tenant_admin可作这些合成计划写操作。普通data.analyze研究者仍可读取计划和预览，写端独立重验。元数据不把审批状态或质量阻断当作已放行，页面仍须先看当前预检与审核。无客户端角色/邮箱兜底。

