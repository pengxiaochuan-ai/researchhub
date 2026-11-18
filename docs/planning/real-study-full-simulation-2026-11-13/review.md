# 本轮独立代码审查（2026-11-13）

审查范围：本轮 `server/research-simulation/*` 私有适配器、`scripts/local-full-study-simulation.mjs`、Study controller 的最小接线，以及 full-study projection → snapshot → Methods/Worker → confirmed bundle → T17 report adapter/Word renderer。仅合成模拟；本次未发 HTTP、连接数据库、改端口或调用模型。

## 实际发现及处理

### P1：运行组取消审计先于真实取消授权

原 `full-study-runs.cancel` 在 Study 及分析来源授权后即提交 group cancel 审计，再调用原 `Methods.cancel`。另一个具备当前分析读取条件、却不是原 group actor 或失去 Method agent 权限的账号，可以先使 group 永久变为 cancelled，后续才收到原 Methods 403。

已修复于 `server/research-analysis/full-study-runs.mjs`：原 actor/authVersion、当前原生 capability、第二事务下 group advisory lock、原始行 hash、未闭 claim 和原生事务内授权均通过后才写 cancel 审计。`authorizeCancelInTransaction(tx, actor, run)` 由本地装配调用原 `methods.descriptiveRuns().live(tx,actor,run,'snapshot',false)`，复用其 account/session/agent/skill 授权及行锁，不另建权限判断。已有 child 且 callback 缺失时明确失败。停止新派发的审计仍先于外层 public Methods.cancel。UI canCancel 也绑定同一原 actor 边界，canProcessRun 保持。

新增反例包含非 actor、原权限拒绝、capability 后撤权、事务内再次授权、未闭 claim、无 child 时 authVersion 变化、callback 缺失、child 行变化及 capability/命令一致性。首五项在原实现失败，修复后通过。Review 没有同类“先写无权 group 状态”路径；每个 child review 写入仍经过原 Methods.review 的当前事务授权。中途失败可能留下已合法审核的前缀，不冒充全组确认。

### P2：Fang/HAMD 缺处理状态仍被纳入有效数值

`scoreCell` 原先只在 processingStatus 存在且不是 scored 时拒绝。纯函数复现：两个非 PHQ 算法的 `{scoreComplete:true,total:7}`、没有 processingStatus，都返回 valid。当前新 writer 正常生成该状态，审查未证明存在坏的真实 revision；但读侧不符合冻结的来源规则。

已修复于 `full-study-projection.mjs`：非 `numeric-sum-v1` 的总分必须明确 processingStatus=scored，缺失状态返回 null/incomplete_score。保留 HAMD 原始特殊9及双脉等具体原因优先级；PHQ 仍接受原有 complete=true、有限 total、可缺 optional 功能题的版本。反例先失败（7 != null），随后通过；合法0分仍为0。

### P2：阶段拒绝后的上传暂存对象清理缺口

原 IngestService 在 withUploadPublication 前写 pp-* 暂存对象，失败清理仅识别 HttpException；模拟 guard 抛普通 researchError，导致拒绝仍可能留下无数据库绑定的对象。除新请求 guard 外，before callback 的 simulation.withExecutionTx 在计划撤批/来源改变时也会抛此类错误。

已反馈父任务，当前 `ingest-core-adapter.mjs` 已对 guard/conflict 及 before 两条路径统一转译 HttpException，使原服务执行原清理。未修改原 IngestService。此次执行的原 adapter 测试验证回执顺序、跨阶段重放及普通路径；没有使用真实对象存储验证清理，仍需目标环境证据。

### P2：未批准计划异常绕过 not_ready 响应

本地 resolveApprovedPlan 实际调用 fullAnalysis.approvedPlan；无已批计划时它抛 FULL_STUDY_PLAN_NOT_APPROVED，原 execution.current 的空 plan 判断无法执行，simulation/context 变为409而非明确 not_ready。

已反馈父任务；当前 execution.mjs 仅捕获该明确代码，转 SIMULATION_APPROVED_PLAN_REQUIRED/not_ready；其他异常继续抛出。新的窄捕获反例已执行通过。

## 已检查的真实代码连接

- controller 将 typed Study context 的 executionProjectId 转为实际科研 scope，原 authorizeFormalResponse 现查当前 account/tenant/authVersion 与父级成员关系，不从请求旧 role 推断管理员。
- 本地 trusted targets、数据库 synthetic marker 与 registration audit 共同决定模拟准入；没有把旧 v1 三例/BASELINE 白名单扩大或伪装成旧 snapshot。
- 采集私有模块图保留原 receipt 优先：新的 submit/draft/assign/outreach 才经过 stage guard；H5 只读和 receipt 的原授权仍为 stage-neutral；correction 在原无 receipt 分支检查。
- 每个非空切片有真实独立 snapshot ID；每个变量使用自己的有效人集和分母，配对差值保留双端来源。空/不适用切片不创建假 Methods run。
- confirmed bundle 校验真实 child run、当前根/子依据及真实人工审核，report builder 逐项核对原 Worker outputs/numericEvidence 后复制数值；Word renderer 从固定 presentation 表格构建并核对 Markdown 一致性。未发现重新估算统计值或把缺失补0的路径。

## 本次验证与边界

精确定向命令：

```sh
node --test server/research-analysis/full-study-projection.test.mjs server/research-analysis/full-study-analysis.test.mjs server/research-analysis/full-study-runs.test.mjs server/research-reports/full-study-adapter.test.mjs
node --test server/research-simulation/execution.test.mjs server/research-simulation/ingest-core-adapter.test.mjs
```

结果：22/22 与13/13，共35项通过。包括旧业务 report create/review/release/export/storage/download 测试实际调用 v2 renderer，但依赖为定向测试环境；不等于真实 PostgreSQL、HTTP Worker、对象存储或浏览器验收。

本次没有全仓测试，没有应用 v2 SQL，没有验证真实迁移/RLS/并发锁等待、真实邮件投递、阶段推进后的真实回执、完整39左右 child HTTP 调度、真实 Word 下载/版面或专业业务结果。上述由父任务的 owned runtime 验收继续举证。physical timepoint 修正由执行负责人处理，本审查未代改。未发现额外 P0/P1；这个结论仅覆盖所列代码与此次证据。

## 审查后本轮真实运行反馈的两项补充

### P2：当前文件已核对，访视读取仍显示不可完成

父任务的 owned runtime 发现：完成命令会先原生 refreshSystemVisitRequirements，读取投影却先从陈旧 missing fulfillment 初始化 requirementsReady。因此同一实际已 storageVerified 文件可在完成命令合法通过，但 GET canComplete=false 阻住用户入口。

按新增窄授权添加 `server/research-simulation/visit-projection.mjs` 与定向测试，不改原服务/controller。接口 `createSimulationVisitProjection({operations,readVisit,resolveCase}) -> async read(tx,user,scope,visitId)`。先原生读取授权；只有登记 case 的同 scope/subject/protocol/arm/plan 且未完成访视，才在只读代理里执行原 refresh，将其 upsert 写入内存，再以原生 reader 计算所有权限/表单/来源/anchor 条件，附 previewOnly=true。真正数据库 upsert、其他模型 mutation 和非 SELECT raw SQL 被拒绝；普通或已完成访视原样返回。

测试先证明原生 canComplete=false 的失败，再证明原 refresh+原 reader 的预览为 true、原 fulfillment 仍 missing、实际 tx upsert 调用0次。另覆盖缺 verified 文件、pending anchor、缺固定表单修订、普通/已完成、不匹配登记父链、意外写入被拒，原 reader 全局导出保持不变。4/4 通过。与 execution/projection/runs 定向合并31/31通过；前述命令加此新4项的已跑唯一测试共39项。该新适配器尚需父任务接线及真实 UI 证明，没有代替目标环境验收。

### P2：报告审核角色被分析执行权限误挡

父任务提出角色分工复核，代码确认：report readSource → confirmedBundle → group 固定 dispatch → analysis.assertCurrent → core.authorize(data.analyze)，会阻断拥有合法 artifact.read/review/release/export、却没有 data.analyze 的报告审核人。

已给父任务最小建议：group 默认仍 dispatch，confirmedBundle 内部固定 export；仅 assertCurrent 的内部 export 分支按当前 artifact.read 授权，保留原 native read 父链、当前角色/账号及来源证明；报告服务继续先验证具体 artifact 操作。直接 analysis/snapshot、Methods dispatch/publish 保持 data.analyze，controller 不从请求接受 phase。父任务已完成该最小分支和定向角色反例；本次再次执行 core.test 的 report-only reviewer 用例，通过“普通分析拒绝、内部 export 可重验、缺 artifact.read 拒绝”。独立真实 reviewer 的后续端到端验收尚未完成，不以该单测替代。


### P2：快照重验遗漏实际协议内容哈希

父任务最后核对发现：原 core.validateCase 只读取协议状态/批准 policy，不取实际 visitPlans，也未比较已登记 case.protocolHash；registration audit 的 caseHash 只能证明登记内容未改，不能证明实际协议内容未改。因此同一 protocol ID 的内容或 visit requirement 如变化，原分析重验仍可通过。

按窄授权仅改 full-study-core.mjs 与 core.test：在原 capture scope 锁下读取实际协议，包含按 sequence 排序的 visitPlans 与按 id 排序的 requirements，复用 presentProtocol(p).revision 对比 c.protocolHash，不匹配即 FULL_STUDY_PROTOCOL_CHANGED。既有 policy/源修订/父链校验及父任务刚添加的 export 角色分支保持。测试 fixture 使用完整实际协议结构，由 presentProtocol 计算登记 hash；同 ID 下 purpose 改变、固定 form requirement 改变的反例先失败（未拒绝），修复后通过。

本次精确回归 core + analysis + runs + report-adapter：21/21。包含纯角色与实际协议内容反例；未发真实 HTTP/DB、未重载正在进行的 owned runtime，真实 source invalidation 仍待父任务选定阶段后加载验证。

## 本轮统计延迟：实测与必要小优化

父任务实际 HTTP 顺序运行观察首 create 约60秒、每 slice process 约40秒，Worker 本身2–6毫秒。没有将该延迟归因于模型或算子，也没有跳过来源校验。

新增 `scripts/full-study-profile.mjs --local-synthetic`，在 fixture 双角色及登记 case 标记核对后，仅用 app 角色执行一次完整 core.project。原规则需要 SELECT FOR UPDATE，故不使用会拒绝原锁的 PG READ ONLY；代理拒所有模型写方法和非 SELECT raw，全部原锁与原来源校验仍执行，最后主动抛专用标记回滚。只记录模型/方法/SQL类别计数与耗时，不保存 SQL 值或来源内容。父任务暂停其 own CLI 且已确认无未闭 claim 后测量，未发 HTTP/Worker，也未重载服务。

第一次实测：墙钟5351.07ms，首次 tenant authlock 等待5.59ms，持锁后5344.90ms；共5328次DB调用。account和projectMembership各441次、各仅2种精确参数；feature/group/project/groupMembership各349次、各仅1种参数。原授权锁111次合计77.77ms。因此证据支持重复授权读取，不支持删锁。各数据库方法累计时间包含并发队列等待，不能直接相加为墙钟。

父任务明确授权后，仅新增 full-study-authorization-reads.mjs/test，并在 core.project 先显式取得原 tenant 授权锁，再使用单次投影局部代理。只缓存上述六模型的 findFirst/findUnique/findMany 精确参数；返回深克隆、并发同参复用 pending、失败删缓存、任何这些模型的 mutation 清理缓存。SQL、protocol/policy、subject/visit/enrollment、form/assignment/response/revision 和质量来源均不缓存。另将 runs.withCapabilities 原两次 group/current 根投影合成一次事务内 present+rows；公开原 Methods capabilities 仍在事务外实际复核。export角色、协议hash、取消fence均保留。

第二次同快照实测：墙钟3550.35ms，DB调用3065次；约减少33.7%墙钟、42.5%DB调用。account/projectMembership各降至3次，其余四类各2次（包含局部缓存之外的原入口授权）。所有非授权模型、来源读取及原行锁调用计数完全相同；授权锁由111增至112，增加的是显式入场锁。54 slices、18 observations及快照摘要 `1ea46092d6ba7b2e2d6d2686ea2648b32b961e70139c8077ba08db5174ec833e` 一致。证据在本轮 testing evidence 的 profile/core-project.json、core-project-after.json、comparison.json。

helper三个主要反例先RED；四个helper单测及runs单根重验反例均通过。当前full-study/simulation/report定向79/79，旧T15/T16/T17纯规则/投影/审核回执/报告/Word定向40/40，总119项通过；未运行旧PG专项或调用真实Worker。真实API端到端延迟改善尚待父任务单次重载后从原durable journal继续测量，不将5.35→3.55秒的单根profile当成整条HTTP链路已达目标。
