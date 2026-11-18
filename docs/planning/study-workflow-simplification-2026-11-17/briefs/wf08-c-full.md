# WF08 C · 整课题首片/批次接续与停止

2026-11-18。A V5 PG门禁已闭；B NativeV2、namespaceV1、consumerV3均代码独评通过。根B真实三例`b-pg-prediction-2026-11-17T17-47-30-660Z-0370cd8d`已过：强RLS、真实public Native+core SQL、原子bind、两cleanup旧代零写、真实cancel receipt/settle、三代与第四零Worker、外fresh零残留。该B门禁为ordinary/单物理连接代际模拟/无数值spy，不代称full、跨进程、HTTP或WF08完成；C承接同一功能，不开始D页面或WF09–12。

## 本项目标与具名文件

沿`wf08-internal-contract.md`第5–7节，用原full group/first/batch/audit/receipt实现后台推进、精确未发布接续及停止；保留既有每批合并来源核验与逐项授权/审计，不能改成39次独立全量核源而回退性能。

- `server/research-analysis/full-study-runs.mjs`、`full-study-batch-runs.mjs`：可选可信Job guard、内部prepare/reconcile/settle、group不可变Job关联、原legacy新写防绕；GET/审核保持。
- `scripts/full-study-methods-batch.mjs`、`full-study-methods-facade.mjs`：Job context、shared physical tx之前的Job fence、child独立真实cleanup受同cap约束、固定OperatorRef/prepare/resume公共入口与旧batch兼容。
- `scripts/full-study-workbench-prepare.mjs`：optimized legacy prepare同样在Session或source写前执行原Native reservation guard；未配置adapter路径不查询Job，精确已发布原生幂等读仍允许。
- 可新增窄`server/research-analysis/full-study-job-bridge.mjs`承接core的advance/reconcile/settle；只本项，不引入通用workflow/queue。
- 对应新行为测试及原相关回归。Native4源、core2源和A source/schema均冻结；若确需更改其边界，先报根精确原因及最小diff，不直接扩改。当前interfaceV2可容纳per-target Job上下文，优先复用。

## 私有桥接与锁序

root/candidate/claim生命周期仍由唯一consumer负责。C只实现真实full branch，cap不从HTTP构造。固定Scope3+Study独立，当前DB账号/authVersion(0合法)、权限/来源/质量/用途每个业务派发、publish及parent failed/finished都重核；不套通用worker授权、不用显示名兜底。

统一official→tenant→Job→group/claim→source/plan→Session→Run。advance在事务外取得ctx，进入真正parent事务后必须先Job guard，再withRootSourceGuard/withBatchResolver；可以用已冻结adapter.beforeLocks与本Job首个固定target的真实context作为元数据阶段入口锁Job/stamp，不能先准备Native Session/Run再倒拿group/source。reconcile只读原生/审计事实，不带cap/写hook；补欠finished由advance明确执行，GET不补写。

shared batch child的临时transaction override必须保留operation/context所需围栏，不能丢掉Native新增第三参数后就直接裸调用callback；每个child verify/beforeDispatch/outcome须落同一已先锁Job的physical tx。child cleanup仍用独立真实事务且携同adapter/cap/target，不绑定成无fence原实例，不复用已结束shared tx。lease/cap失效和401/403/DB不得被标科学basis失败。

## 原子绑定与精确恢复

新Job group只复制Job固定targets中的snapshotId/methodKey到原meta.slices（child前缀analysis-job-native-slice-，原hash tuple不变）。旧legacy full-slice、旧group/审计/原keys回看不改。新group/原create operation/首片原claim/Job.runGroupId+pending同事务；queued Native准备如另步，精确pending保持，不再claim另一组。

首片保原full-first key、limit1、expectedStateHash及原create/process requestDigest，first没有原targetsHash；batch保原limit3/BATCH_VERSION/targetsHash。Job另有jobTargetsHash，不互充。pending original body/key/hash、group/actor/version/source、slice/Run/inputHash/Job marker逐项交叉；不换latest CAS、第二group、任意Run或历史partial。

queued/running只对本Job绑定目标调用公共Native接续，已发布needs_review/completed/needs_input只读找回、不重算。已全部发布却缺finished只补parent审计/receipt与checkpoint，不发Worker、不加attempt。新批仍合并根来源核验；每个Native dispatch/publish、失败清理和parent attempt_failed/finished在同活代事务核定，旧代所有写零。

checkpoint写hook只能改group/pending/finished单调元数据，targets必须与同tx当前Job.targets完全一致；Run/inputHash绑定只经Native.bind。先写group/claim checkpoint再prepare Native，避免用陈旧ctx覆盖刚绑定的事实。

## 停止、错误及兼容

legacy full root create在任何group/source/Session写前挡active reservation/保留namespace；Job-bound group的旧process/cancel不得绕过consumer。原精确成功幂等读、GET及有权独审不需活lease。

不直接用旧full.cancel（会拒pending并取消已发布）。user-cancel只取消已绑定未发布，保全部已发布及审核；无Run/无group不造记录。pending claim逐目标证明已发布保留/已取消/从未创建且停止，写取消专属完成证据，不伪executionConfirmed:true。runtime-failure用独立purpose和safe failed结果，不能假取消人/receipt，也不受3计算额度阻断。

明确full来源或用途变更只使本Job控制面blocked，不借consumer写Native科学失败。C的core分类增量只接纳`full-study-methods-batch.mjs`既有23个sourceFaults且status409、`QualityGateError`的QUALITY_GATE_REQUIRED/QUALITY_GATE_STALE/QUALITY_GATE_BLOCKED；既有ordinary分类不变。经源核实的配置错误仅在status503且code为FULL_STUDY_BATCH_NATIVE_UNAVAILABLE、FULL_STUDY_BATCH_UNAVAILABLE、FULL_STUDY_PREPARE_UNAVAILABLE、FULL_STUDY_PUBLICATION_AUTHORITY_UNAVAILABLE、FULL_STUDY_PROCESS_AUTHORITY_UNAVAILABLE、FULL_STUDY_CANCEL_AUTHORITY_UNAVAILABLE时blocked。权限401/403仍只控制面受阻，Native0科学失败写；其他未列503/409、DB或网络未知继续保原绑定recovering，不按任意FULL_前缀分类。FULL_STUDY_CAPABILITIES_CONTEXT_CHANGED属于可重读的权限快照竞争，不当配置缺失。新的Job绑定/claim冲突码须待具体源落地后另经根核定，不预猜放宽。失权保已停止/受阻事实，不伪全部Native取消。

## 门禁

先before/hash及真实行为RED→GREEN：root/first/batch各持久切点、同键/原body、已发布欠finished、running接管、shared child两cleanup与parent failed/finished旧代0写、public legacy防绕、两种cancel/publish提交顺序、已发布needs_input保留、无group无Run停止、失权不伪停、auth0。旧native60/legacy batch35及full原相关回归按影响跑，fake只证明契约。

代码/桥接冻结及独评后，根另定full真实PG回滚资源/预算/driver；目标仍不持久迁移或启用。通过C技术门禁后才D装配真实Worker、服务重启/离页、双角色/五宽/native200/PNG-WebM及整项四层。旧591/155、V3partial35、科学/Word/全旧行始终保护，不代入任何历史队列。

## C 私有接口与当前代码边界

`createFullStudyRuns({...原依赖,jobAdapter})`仅在可信adapter完整时提供不可枚举的`jobBranch={advance(ctx),reconcile(tx,readContext),settle(tx,ctx,purpose)}`，不注册HTTP入口。facade提供`authorizeJobOperatorInTransaction(tx,actor,fixedRef)`（转原冻结Native公共只读入口）、`prepareJobBatchInTransaction(tx,actor,contexts,frame)`、`resumeJobBatch(actor,contexts,frame,publication?)`及`settleJobBatchInTransaction(tx,actor,contexts,purpose)`。`frame`仅`{studyId,rootSnapshotId}`；Native context仍是冻结Scope3/独立Study/固定operator/原私有cap，不能由JSON构造权限。

首片Native发布提交后，以独立、同活代parent事务补原FINISHED；该收尾失败保留已发布Run和原pending，后续只补元数据。后续最多3项仍共享原snapshot/dispatch/publish来源frame，batch Native发布和parent finished同事务。parent先锁Job，再group/claim/source；同事务读取当前targets重建context及checkpoint，不用advance初始null绑定覆盖Native.bind。原始作者/version从Job行读取，组/claim/原receipt/原publish按作者核定；有权取消人的Native cancel audit归其本人。

Job Native/adapter保持真实physical tx身份，来源assertCurrent仅映射该活frame的protected view；错tx、跨phase或过期frame拒绝，旧无adapter路径不变。中间reconcile只读原生元数据与真实claim结束审计，不重复全root投影；每批原Native三个phase各核一次共享root，parent claim一次，最终完成再核来源。first/batch保原body及各自digest；内部元数据失配用具名`ANALYSIS_JOB_BINDING_CHANGED/CLAIM_CHANGED`409，Native已失败用`ANALYSIS_JOB_NATIVE_FAILED`409，沿冻结core已知分类停止，不无限unknown重试。

停止只处理真实未发布的绑定Run（每批≤3），已发布`needs_review/completed/needs_input`只读保留，未创建目标不造Run。Job stop只写专属STOPPED及原Job控制结果，不写旧full.run.cancel审计，原有权独审/报告路径保持。runtime-failure若仅欠已成功pending的FINISHED，以settle-kind原purpose补returned；全目标已发布则completed，否则仅余下目标按耗尽proof结束，不造第四次Worker或把成功片标失败。以上为离线代码/fixture契约；真实C PG、Worker、跨进程与D四层仍由根另验。


## C / D 真实门禁补充：20秒规范下的V4预测切片

V3 actual已证明第一例取消/旧代零写，以及真实首片publication后generation2原claim补FINISHED（HTTP未重算、attempt不增加）；第二例合并batch/cleanup后触canonical20秒，原失败和零残留保护保留，不称C整体通过。当前C PG V4改为`first-atomic-cancel`、`first-finished-repair`、`no-group-stop-and-denials`三个限定回滚事务；真实Worker硬上界1，第二例补收尾即请求私有consumer.stop（不在回调中自等），余38未开始。固定source/权限/锁序/Native/20秒全部不变，预算详见`wf08-c-pg-budget.md`。

原limit3完整批次、共享source核验、cleanup与parent旧代零写、跨批恢复及full39真正完成均保留为D目标验收mandatory，连同重启/离页/late Worker/取消/撤销按真实目标一次性核定。C预测通过只解锁D装配与目标验收，不背书完整full后台能力，不取消任何原行为/单元契约或用户业务标准。
