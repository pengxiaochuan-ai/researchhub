# 阶段4 · 有限v2计划、快照与切片运行技术交接

2026-11-13；代码已落，单元验证完成；数据库迁移、真实PG/HTTP/Worker/Word联调尚由主循环执行。没有应用DDL、调用HTTP/模型、改动旧T15/T16/T17或共享入口。只服务当前登记的6例、3显式arm、4逻辑访视/5物理计划的软件模拟。

## 构造与准入

`createFullStudyAnalysis({studies,load,resolveCase,cursorSecret?})`，模块`server/research-analysis/full-study-analysis.mjs`。`studies.withResearchStudyTransaction`和`load`均为真实既有事务/核心；`resolveCase(tx,scope)`是可信服务端注入，不是请求体。未登记/错父链/变更登记或固定表单hash均拒绝。

case格式沿`full-study-simulation-case-v1`，必须包含scope、真实Study/protocol/policy及hash、baseDate、6subject/3arm各2、5visitPlans、forms固定schema/scoring hash、variables、generator(version/seed/manifestHash)与assumptions。seed允许固定整数或字符串。稳定metadata不纳入动态clock/approvedPlan；保留outcomes引用。protocolHash由可信准入回调按固定协议内容核实，不含普通执行状态变化。

本轮变量只有phq9_total/fang_total/hamd17_total，`source:'score_total',fieldKey:'total',valueType:'number',unit:'分'`。这里total是固定修订的score键，不冒充原问卷answer字段。PHQ允许numeric-sum-v1历史score无scoreComplete但complete=true且total有限；Fang/HAMD必须scoreComplete=true。source_code_9、pulse_review_required及unresolvedItems原因保留，0/false不丢。模态仅绑定原文件/处理任务及非表单fulfillment的元数据和状态，不宣称原始提取/多模态临床建模。

## analysis接口

- `configuration(user,studyId)` → `{studyId,schemaVersion,caseMetadata,capabilities}`。
- `submitPlan(user,studyId,{requestKey,definition})`：definition仅接受`{schemaVersion:'full-study-simulation-v2',caseId,protocolVersionId,sapVersion,variableMapVersion,reason}`；固定caseMetadata由服务器填入，禁客户指定subject/阈值/答案。
- `list/readPlan/reviewPlan/preview/release/readSnapshot/receipt/assertCurrent`与既有analysis同名。动作回执action为`full.analysis.plan.submit / full.analysis.plan.review / full.analysis.release`。
- `approvedPlan(tx,scope,{studyId?,protocolVersionId?})`供execution内部调用。只认本case最新计划及其最新审批，不回退旧批准计划；返回`{id,version:'full-study-simulation-v2',status:'approved',contentHash,protocolVersionId,protocolHash,policyId,policyHash}`。审批不依赖enroll，提交/审批前须已有真实已批准方案/政策。
- preview/release要求本次6例全部18个适用访视完成且completionIntegrity=current；所有已提交来源必须review_approved、locked、revision/hash/scoreAlgorithm与固定表单一致。更正、unlock、使用条件、form/profile变化阻止当前快照使用。
- `release`在同一事务写真实root和每个非空slice的独立`rh_analysis.snapshot`行，返回`{planId,snapshotId,manifestHash,qualityGateId,qualityGateVersion,sliceSnapshots:[{sliceId,snapshotId,manifestHash,...}]}`；不创建虚拟旧snapshot ID。

root schema=`full-study-simulation-root-v2`，含caseMetadata、analysisPlan、observations、slices、quality、qualityEvaluation。slice schema=`full-study-simulation-slice-v2`，包含真实rootSnapshotId/rootManifestHash、sliceId、单variable、subject唯一有效行、分母/双端来源。slice保持旧Methods要求的subject统计单位，每字段独立有效人集，因此HAMD缺项不会删除有效PHQ。旧Methods对该真实slice快照照常验证、派发descriptive-v1及核对数值证据。

分母恒等式：population=eligible+notApplicable，eligible=valid+missing；notCollected/incompleteScore与reasons是missing的细分，不能重复相加。healthy后续与HAMD V2是not_applicable，不是missing。无有效值为no_valid_data；不存在虚构Worker outputs。配对公式固定followup-baseline，保存两端ref及paired-followup-minus-baseline-v1。样本标准差与全部统计值仍由旧Worker生成。

## 多切片运行与报告交接

`createFullStudyRuns({studies,analysis,methods})`，模块`full-study-runs.mjs`。

- `create(user,studyId,{requestKey,snapshotId})`登记独立AuditLog runGroup及真实slice引用，仅最多处理首1片。返回`{id,runGroupId,status,reviewStatus,remaining,stateHash,slices,capabilities,...}`。
- `process(user,studyId,runGroupId,{requestKey,expectedStateHash,limit:1})`显式推进一片。持久claim+operation幂等、group advisory lock、状态hash防并发；Methods/Worker在外层事务提交后调用。GET read/receipt不创建或重跑。未闭合claim明确FULL_STUDY_PROCESS_PENDING，不猜测成功或盲重发。
- `list/read/capabilities/receipt/review/reviewReceipt/cancel`保留相应职责。review必须全部非空片计算完成（旧Methods的needs_review或completed），逐片用既有Methods.review；任一未确认片阻止报告。cancel拒绝尚未闭合的dispatch claim，避免交叉派发。
- `confirmedBundleInTransaction(tx,user,scope,studyId,runGroupId)`供报告当前事务调用；`confirmedBundle(user,studyId,runGroupId)`为外层事务版本。内部不嵌套事务。每个实际run经当前snapshot、最新confirmed review与buildT17Report完整数值证据核验。事务内root来源证明缓存仅在同一已锁事务复用，不跨请求。

返回`{schemaVersion:'full-study-confirmed-runs-v2',studyId,planId,snapshotId,manifestHash,runGroupId,basis,caseMetadata,quality,slices}`。每片含`sliceId,kind,armCode,logicalVisit,baselineVisit,variable,denominators,sources,status`；confirmed片另含`methodRunId,executorVersion,outputs,numericEvidence,basis,actualRun`。empty片为no_valid_data/not_applicable，不含actualRun/outputs。父报告adapter只能复制已确认数值，并清楚区分算子输入有效N与完整适用分母；不得把runGroup伪装MethodRun。

quality含queries/deviations以及modalities元数据：`{schemaVersion:'full-study-modality-metadata-v1',status:'recorded_metadata_only',fileCount,requirementCount,statusCounts,files:[...],requirements:[...]}`。文件SHA若来源未声明则null；文件/任务/fulfillment变化进入root hash，既有报告交付受当前来源重验。

## 唯一增量迁移候选与回滚

旧文件`docs/planning/research-study-workflow-2026-11-11/t15/schema-candidate.sql`不改。候选`v2-analysis-parent-candidate.sql`只CREATE OR REPLACE原parents函数，保留原v1条件与scope/protocol/actor/review/manifest/quality父链；v2独立分支要求6例/3变量/3forms/5plans与实际父链，slice必须指向同scope/plan/review已放行root且rows/denominators/sources与root切片一致。不改变RLS/ACL、无新增业务表。

主循环先在guard确认的合成库只读保存`pg_get_functiondef`、prosrc及md5、旧表/权限/函数owner指纹；必须人工比对当前parents与旧基线，候选内静态prosrc MD5进一步拒绝未知旧函数（如有其他补丁，先重新评审rebase，不抹掉补丁）。在同一事务`SET LOCAL rh_migration.expected_parents_md5='<读到的完整函数md5>'`后执行候选，首轮ROLLBACK作dry-run；验证原v1正反例和v2父链后才另行决定提交。保存替换后完整函数md5供回滚fence。

`v2-analysis-parent-rollback-candidate.sql`要求`rh_migration.expected_v2_parents_md5`匹配，且**没有任何v2计划**才恢复原函数。已有v2数据拒绝回滚，不删除历史来强行通过。所有SQL均不在服务启动自动执行。

## 已执行验证与未完成事项

15项v2模块测试，覆盖入组前审批、禁止客户覆盖、root/slice真实记录、源更正失效、独立有效分母、0/false/9/Fang待复核、healthy NA、双来源变化、无有效值无Worker、审批/claim与确认后bundle。连同旧T15/T16/T17纯回归共34项通过，原Python descriptive_statistics 4项通过。测试中的Methods/PG边界为受控测试依赖，不能据此宣称真实运行能力已启用。

仍待父：候选SQL真实dry-run/应用、trusted registration接线、真实PG/HTTP与Worker轨迹、39个预期非空切片实际有效范围核对、报告审核发布/Word存储读回、完整科研/管理界面验收。未调用付费AI，未替代应用离线生成报告。
