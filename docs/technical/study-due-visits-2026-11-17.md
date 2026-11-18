# WF05 今日待访视技术记录

2026-11-17：本模块V3已在本机合成目标验证，**WF05已完成（本机合成）：最新准入联动、当前全前端、末次保护及读取切片来源补证均根验；Notion同步记录见finalmanifest**；WF06未开始。临床/生产未验。当前合同见[brief](../planning/study-workflow-simplification-2026-11-17/briefs/wf05.md)、[API合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf05-api-contract.md)和[验收报告](../testing/study-workflow-wf05-2026-11-17.md)。

## 只读原生边界

新增`GET /api/research-studies/:id/due-visits?limit=&cursor=`，仅注册原controller的4行import/factory/GET/分派增量，旧路由保持。`createDueVisitsService({studies,core:{authorize},now=Date.now})`的`list(principal,studyId,query)`复用`withResearchStudyTransaction(...,'read')`及其授权锁，再调用原`authorizeFormalResponse(tx,principal,group,project,'read')`核DB当前actor/authVersion（0合法）。不误要求study.review、form.fill或执行写权，不以Hub配置/URL/旧角色代替当前读取权限。

服务只用`tx.subjectVisit.findMany`最小投影，不调原昂贵访视list/project表单、评分、文件或完成证据投影。精确tenant/group/project、非fixture及未删除Subject、有效enrolled/grouped/in_progress Enrollment、scheduled Visit与允许未完成状态先筛，再ID升序take limit+1。VisitPlan无acceptanceFixture字段；有该字段的Visit/Subject/Enrollment/Protocol过滤false。Protocol允许executing与合法superseded固定历史版。

单ID外键不证明复合父链。含limit+1 sentinel的每行都先核Subject/Enrollment/Plan/Protocol各自scope、`enrollment.subjectId===visit.subjectId`、`enrollment.protocolVersionId===visit.protocolVersionId===plan.protocolVersionId`及实际ID，再输出名称或cursor；不一致409 `DUE_VISIT_BINDING_UNAVAILABLE`。列表不授当前用途或采集启动许可，原S09继续完整守门。

## 日期、投影与cursor

同一注入clock取北京时间日历日`[start,end)`，`now()`可返回epoch毫秒或Date；windowStart<dayEnd包含今天晚些安排，attention不称已开始；windowStart空才退targetDate，未来日/pending_anchor/终止入组等排除，实际in_progress即使窗口未来也保留。overdue沿原状态或windowEnd早于今日start派生，不写回状态。日期显示固定Asia/Shanghai；完整窗口显示两端，缺windowEnd时先windowStart再targetDate。V1反向fallback日期P2的独立/正式RED与V2一行修复保留。

响应为`{studyId,day,timeZone:'Asia/Shanghai',items,nextCursor}`；item仅`visitId,subject:{id,subjectId},enrollmentId,protocolVersionId,visitPlan:{id,name,code},status,scheduleState,targetDate,windowStart,windowEnd,attention`，日期ISO或null，attention仅due/overdue/in_progress。没有人口学、答案、临床分数或文件正文。

limit原接口默认5、范围1..100；cursor最长2048字符，严格base64url/JSON字段绑定schema、DB actor/authVersion、tenant、Study、day/timeZone、afterId，无未知字段/重复键容忍。非法值/错scope或身份版本400，合法跨日409 `DUE_VISIT_DAY_CHANGED`；cursor不是授权凭证，每次重新授权。nextCursor只取本页最后实际ID，不取sentinel，也不从旧局部页浏览器过滤。

## V3客户端与页面

正式researchStudy模式S01只替换原更新空卡，旧execution-only入口保持。新只读session绑定accountId/authVersion/Study/URL，以epoch、AbortController、动态scope及render-bound gate隔离同账号version/URL的迟到和同次render旧回显；旧完成不能解锁新busy。首次/焦点/显式刷新/更多互斥，错误清旧页、失权不回退demo，无storage、dirty或beforeunload。

初始/刷新limit5；明确查看更多limit20，验证按每次requestLimit上限，不自动继续下一cursor。跨日409去cursor并回limit5，只补读今天第一页；返回6条同样拒绝并清旧页。真实22条首5+一次more17，2GET；已展示行进入原S09是1个导航动作，含该例展开则2个动作，不称总点击为1。

## 验证与失败保留

[V3十源冻结](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/implementation-freeze-v3.json)保持native四源与组件/CSS/S01相对V2原样；V3只改client helper及两测试。相关/独评99、独立JSX3、build5.61s；V2全前端1087pass/1skip为历史。原V3全前端attempt为1089总数/1084pass/4fail/1skip，保留为历史；F01新commands/assertApproved及Hub/video准入hook/schema装配后的共享联动已由根在74871实测通过。根最新共享源码[隔离构建](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/post-admission-build.log)4.71s通过；owner称两mock定向23pass、两表/20原active账号迁移check及两个真实PG通过，目标50810→74871，仍持窗完成异常回归，这些早先owner回报不代实际验收；根后续共享联动已通过，当前全前端已由attempt02完整通过；读取切片来源待项已由后续精确补证关闭，Notion同步记录见finalmanifest，不绕过其他会话守门。

真实原生PG是单物理aisci_app只读事务12检查，六HTTP GET另列；owned30580→50810。phase2两身份22条/一次more与原生逐ID/顺序一致，旧3步/新已展示1步同一固定访视，受控500清旧表、明确GET重试、clean reload无beforeunload；全程0本模块业务写，零表单分配/启动/答案。五宽/native200 collapsed5/expanded22、14/22/三点hit及最终保护有证，详[报告](../testing/study-workflow-wf05-2026-11-17.md)。

原native200展开PW PNG720×456是裁片失败，保留而不充完整物理尾部。[独评2.600000s证据](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-target-v3-stage2-evidence.json)从原WebM离线取[正确帧](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-native200-video-26s.png)：1440×1000（913内容+87padding），实际CSS720/DPR2，末link/refresh完整。JSON存准确`ffmpeg -ss 2.6 -i <原WebM> -frames:v 1 -update 1 <PNG>`命令数组、PTS、原WebM与PNG SHA；3.4s恢复zoom=1的帧明确排除。

## 外部新事件与完整保护

QA V1曾误把queued155当完整591总数，首次admit严格失败、0业务写/未落新before保留；V2按完整ID/hash/count动态保护，不降级为queued子集。V3 phase1功能通过但最终因一条新knowledge_session_create严格拒绝，原失败不覆盖。

[只读handoff](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/external-ai01-session-handoff-readonly.json)精确联接07:42Z用户另报修AI01的既有Session、base project非本Study，未读messages/Excel；不归因F01、不声称修复代理创建Session。新阶段必须先validator，5/5纯guard已核；仅transition校验副本排这一条原old set外的精确ID/hash/actor/action，再未改strict compare全旧行/591job/角色/科学/Word。实际独立新before原样包含该事件并继续保护，原before保留，0旧行减少。[过渡记录](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/root/external-read-phase-2026-11-17T08-08-24-335Z-b1bac/known-external-read-phase-transition.json)明确原窗口非全球0增量。

[最终audit](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/root/audit-2026-11-17T08-13-50-450Z-dc686/root-result.json)通过且0本模块业务写，完整591job/155queued及全部旧行/源/科学/Word、该已知新事件均保护。根已把目标窗口释放给F01；最新迁移/重载后的共享准入联动已由根实际通过，当前全前端和末次保护也已根验，读取切片来源后续补证已通过，WF05本机合成完成；Notion同步记录见finalmanifest，WF06代码未开始。

## 最新准入联动的实际保护边界

[根post-admission](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/root-result.json)已实际通过：PID74871、共享F01四源hash、准入application/event两表和两个QA身份approved metadata核定；9GET（6正向/3拒绝）及双身份真实Chrome首5→1more22，完整native scope href一致，PNG/WebM/0pageerror，0采集/业务写。根已目视本次两角色1440截图。QA-only driver/test新增81行、5guards通过，产品十源不变。

独立fresh before→after用原strict helper保护全旧行/fullhash、591job、科学/Word和精确auth allowlist；新准入两表仅按本窗口metadata前后一致另保护，不声称旧helper历史覆盖。旧stage2→fresh跨期audit新增42（含合法auth），所有原audit完整hash保留、其他原表exact，不能说42是F01业务或本次写；原baseline未改。当前全前端含两个真实rollback PG的post-admission attempt02完整通过：1176总/1175pass/1skip/0fail、90.806s；原1084/4fail/1skip仍只属历史attempt。读取切片来源已由后续补证关闭；Notion同步记录见finalmanifest。

## 最后全前端窗口与源版本停点

[当前全前端attempt02](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/full-frontend-post-admission-attempt02.log)1175pass/1skip/0fail，正确fixture配置[定向14/14](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/fixture-config-green-attempt02.log)。原post-admission attempt01与fixture-auth-recheck attempt01因合成slug/默认共享optimizer cache配置中止，不填写完整计数；[配置记录](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/fixture-config-attempts.json)与[真实504 probe](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/fixture-probe.json)保留，产品未为配置问题改动。

[最后audit](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/root/full-frontend-final-audit-2026-11-17T08-41-21-265Z.json)passed0业务写；只在RAM续用本次after作下一窗口before，旧文件不改。全旧行/fullhash、591job、科学/Word/角色以及准入两表另行完整rowhash前后exact；Chrome/Auth/两fixtures已关闭、主74871未动，根已向F01释放目标。

`sourceGateSliceContinuityPending=true`原样保留：F01 service目标加载2a90…而磁盘93dd…，另外三个shared源同hash。该末审当时的读取切片待项已由后续精确补证关闭，原audit字段不改；不得称全源无变化或背书F01独立新能力。WF05本机合成已完成，Notion同步记录见finalmanifest，WF06代码未开始。

## 后续来源连续性补证

[独立来源证明](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/admission-read-slice-continuity.json)通过。根按owner的list-only定位，在RAM还原原count-over SQL/return两行，首candidate wholeSHA命中此前目标捕获2a90…；[还原目标快照](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/admission-runtime-source-reconstructed.mjs)、[磁盘93dd快照](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/admission-disk-source-93dd.mjs)及[差异](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/admission-independent-list-delta.patch)保留。仅list body不同，其外全部bytes/imports及读取守门切片同hash；原audit的pending=true由此关闭，不覆写原证据。

policy无旧快照，仅owner明确不变声明与current hash/mtime，不冒称独立历史比对。[最终独评](../testing/evidence/study-workflow-simplification-2026-11-17/wf05/final-review.md)已关闭本项读取版本待项并独立重放旧strict保护；末次准入两表真实compare通过，但after数组未单独归档，不声称能从该文件独立重放这两表。WF05未调用独立list，不背书其验收，不新增目标I/O或重载。WF05已完成（本机合成）；Notion同步记录见finalmanifest，根继续最终映射。WF06仅设计预备，代码未开始。
