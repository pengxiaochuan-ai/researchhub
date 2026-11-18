# T18 更正脚本独立只读审查

2026-11-12。审查对象为 `scripts/research-t18-correction.mjs`，SHA256 `9e02aa9438b6c43c70058fdec61465a9b02dc93608e52ebdd7dca869f999dd7b`，205行。按根授权只读对照[更正验收契约](t18-correction-acceptance.md)、现行S09/S05 DTO与已通过主capture/basis/Methods证据。未导入或执行候选脚本，未发HTTP、连接数据库、操作主三例、修改实现或删除sentinel。

**第1—5节保留历史发现及修复过程；第6节记录真实基线Report proof形成后的最终输入对齐。** 第6节范围内已无新增执行前阻断，根另行负责已验源码/runtime守门及唯一实际更正执行，不由旧准备态措辞推断当前状态。

**结论：保持准备态，不允许执行。** line23 的 `CORRECTION_SCRIPT_INCOMPLETE_FAIL_CLOSED` 位于全部请求、浏览器及数据库调用之前，当前封口有效。下面列出的P2/Important属于未来验收脚本的漏检或执行门禁缺口，不是已复现的产品后端缺陷；补齐后仍需根按真实S10基线和Report proof重新审阅，不能直接删除sentinel开跑。

## 1. 实际核对的固定输入与DTO

| 输入 | 现存通过证据 | SHA256 |
| --- | --- | --- |
| 原三通道capture | [main-capture-ca263fff/result.json](../../testing/evidence/research-t18-2026-11-12/main-capture-ca263fff/result.json) | `558d0e89db082c2f4051d33e8425fe5c10f21a679ce1c5e426217a785ab0481e` |
| 原批准计划/依据 | [main-basis-41f5ebd1/result.json](../../testing/evidence/research-t18-2026-11-12/main-basis-41f5ebd1/result.json) | `cb8828d201fc9f2c9e01e72ba719048ae4a122756c974f463589b45c783e278f` |
| 原真实Worker/人工确认 | [main-method-d7213f7b/result.json](../../testing/evidence/research-t18-2026-11-12/main-method-d7213f7b/result.json) | `6327313d3da8fcafa69934edade3ad78a3b2434948dbac96821a6df69f277de0` |

Methods实际Run为 `cmwdd8a1g0031luw3dlzct2dg`，completed/confirmed；其basisSha与上表依据摘要一致。创建由researcher、人工确认由admin完成。候选line166分别使用这两个actor读取Methods原回执，与已经保存的事实相符。Run的environment/dataSources和reviewReceipt的runId也是现行DTO，没有将其他D6队列替代原三人。

已逐行对照的页面行为：S09当前修订中的解锁、更正diff、审核、锁定、完成依据reverify，以及S05当前计划的preview/release。候选action/path、expectedVersion/expectedRef、共享确认弹窗、分析previewHash及原回执action/target大体对应现行实现。CSV的optional_value在原capture中为显式null；候选line198正确按该持久事实断言missing='null'，没有重复要求revision.source='import'。

Report proof尚未生成。本轮不伪造该证明、预设成功指针或猜各动作原actor；line12–22只作为必需输入门槛草稿，不能代替S10真实交付证据。

## 2. 必须在执行前收口的发现

### P2 / Important：每次POST前缺少runtime身份守门

位置：候选line114–117、125–135、140–147。脚本没有读取19501的runtime.pid/ready/ids，更没有在两个实际dispatch入口（浏览器route.continue和negativeExport fetch）前核对。line54的fixture guard只核数据库目标，line157只核一次HTTP账号；两者不能证明后续POST仍发给同一已审实例。

共享runtime已在本轮多次切换。若切换发生在前置GET后、确认点击前，候选仍会发送改变主ONSITE或创建快照的POST。应沿已通过main-method的方式冻结实际runtime标识，并在每次业务POST真正发出前复核ready/pid/tenant及完整ids；变化时保留journal并停线，不自重启、不以新键重发。负导出也必须经过相同门禁。

### P2 / Important：原H5/CSV的当前response.version没有冻结复核

位置：候选line72–82。originalSubjects核ref、answers、locked、review及visit.version，但遗漏contract明确要求的response.version。H5或CSV被并发解锁再锁定等操作后，ref/答案/最终锁定审阅可以相同、response.version已推进，该函数仍通过，无法证明原渠道未被额外触碰。

[纯离线反例](../../testing/evidence/research-t18-2026-11-12/correction-independent-review-9e02aa94/offline-counterexamples.json) `original-response-version` 使用真实原H5结构，仅将response.version从3改为5；候选选取的全部字段比较仍通过。应同时核原response.id/status/version和精确assignment/visit绑定；H5冻结的全部原始不可变字段须与h5Original对应，而不只依赖line38的ref相等。CSV保留原已确认导入证明，不重导入。

### P2 / Important：合并any检查不能证明SubjectVisit追加了ref2

位置：候选line191–192。`hasRef([visitEvidence,...fulfillments],ref)`将访视与履约项混在一起，只要任一记录有ref2就通过。更正时履约项可以已经刷新到ref2；即使SubjectVisit.evidenceRefs仍只有ref1，本断言也通过，未证明reverify保留并追加访视历史。

离线反例 `visit-evidence-union` 已实证：visit仅ref1、fulfillment仅ref2时，两项合并断言全通过，visit本身没有ref2。现行后端 `formal-visit-evidence.ts:98–101`明确对SubjectVisit写 `[...prior,...refs]`并审计prior/current。应分别核SubjectVisit原数组为前缀/完整保留、存在此次当前ref2及responseVersion，再核各精确必采fulfillment；同时比对reverify原回执、version推进、原actualCompletedAt不变，不能用两种记录相互代证。

### P2 / Important：来源错误码前缀过宽，且漏值断言只查顶层

位置：候选line103–111、119。`/^ANALYSIS_/`会接受选择错误、配置/用途不可用、计划未批准等非本次来源更正原因。仅排除顶层outputs/numericEvidence/manifest/contentMd，也不能排除嵌套输出；list/capabilities检查更只核少数字段。

离线反例 `source-code-and-nested-values`：`ANALYSIS_SELECTION_INVALID`加`details.outputs`可通过现有断言。这不是目标接口已经泄值的证据，而是harness无法识别该错误响应。应按阶段和endpoint固定可接受的精确来源错误集合；保持账号/计划/配置有效，最终旧snapshot仍精确要求ANALYSIS_BASIS_STALE。按实际错误DTO、列表metadata与capabilities的允许字段核对无正文/数值/answers/rows/sourceHash；caps还应核reviewStatus=confirmed。Methods列表允许outputs={}，不能错误要求字段完全不存在。

### P2 / Important：负导出没有证明operation零新增

位置：候选line84–97、114–121。before/after只核job/file/version/source，未读`rh_research.operation`，因此即使拒绝请求错误持久化了operation而未建job，脚本仍将其写入history并清pending。contract要求拒绝后job/file/operation均零新增。

应在原actor、原negative key、action和target精确范围内，以同一个受保护READ ONLY查询核零operation；保留原key和409响应。不得为了核对调用POST或换新key。若POST响应不明，保持pending、仅原GET/已批准只读持久核对并停线；不能将receipt404或409当作“可以再发”。

### P2 / Important：新preview与snapshot的主例后置条件不足

位置：候选line197–201。validAnalysisPreview用于通用投影，允许未完成访视；line198只核cell值/ref，没有额外要求本次三访视均completed/current，也未逐行核原visit/enrollment及当前responseVersion。离线反例 `incomplete-preview`将ONSITE行置为in_progress/not_completed，同时保留规定新ref2和值；validAnalysisPreview和候选逐格检查均通过，违反本次主例契约。

release后仅比较新snapshotId、manifestHash及manifest，未用现行validAnalysisSnapshot核新basis/qualityGate；尤其没有断言新qualityGateId不同于旧值。应核三人、原visit/enrollment、completed/current和每格精确来源；使用真实release回执、新snapshot DTO与原批准计划对应核planReviewId、purpose/protocol/SAP/map、gate状态/版本/摘要，新gateId不同；再确认原计划definition/contentHash/reviewId/sequence仍不变。不能仅由“manifest相等”推出整个快照和批准链正确。

### P2 / Important（Report proof对齐项）：报告原回执一律用admin，未携原actor

位置：候选line14、110–111、167。T17 repository.getReceipt按tenant+actor_id+request_key读取（`server/research-studies/repository.mjs:10`）；管理员也不能代读另一actor的原操作。候选报告四动作都用admin，而Report proof仅记录key，没有按动作记录原actor或对应会话。

若后续S10由researcher创建、admin审核/发布，line167会在更正前得到404；更正后也不能用admin404代替原researcher回执的来源409。本次没有Report proof，不能宣布实际失败或假定全admin。应待真实S10证据形成后封存每动作原actor/action/target/key，并按原actor只读核对；无法读取即停线，不换管理员、不改权限、不重放POST。Methods这部分的researcher/admin分工目前正确，应保留。

## 3. 已正确的封口与执行前待交接项

- line23的无条件sentinel有效，未完成部分不可达；line8还要求显式执行参数与Report proof。不能将本审查当作执行许可。
- 原三人及benchmark名称、原ref1、H5源/oracle摘要、ONSITE原0/选填0/false有前置断言；浏览器业务写只允许armed的ONSITE四动作、其visit.reverify及同plan快照。没有H5/CSV写入口、重邀、重建subject或旧Run取消/重算。
- 每次UI POST在route放行前持久记录原key/body，写后核精确原回执；旧未知pending只GET并停root审，未发现自动未知POST重试。line162遇任何已确认部分history也停线，这是科学上安全的保守选择，不能为提速删掉。
- 现行保护DB调用使用withFixtureTransaction的`{readOnly:true}`；fixture-guard先SET TRANSACTION READ ONLY再核marker；候选readonlyDb只有查询，无DDL、seed或SQL写。该结论来自只读源码审查，本轮没有连接DB。
- line190保留原Run、旧snapshot及报告摘要/来源；line201要求旧新snapshot metadata仍在，同plan创建，不调用刻意锁ref1的main-basis脚本。列表上限50/快照分页的范围须按现行合同保持，不能因未显示而声称删除。
- 当前输出只到更正后新snapshot，不运行新的Methods或报告；`passed:true`及`t18-main-correction-current`最终须明确为“更正/失效/新依据阶段通过”，不能写成更正后统计报告整链通过。新Run/Report必须单独真实执行并核generic-v2.correction基准。

执行前另需根/作者明确：

1. **已确认阶段的人工续验方案**：保留原journal，按原键只读确认各阶段、当前ref/version和历史，再经根批准从下一未做动作继续；不要求自动恢复。当前history非空就停的策略安全，但未完成阶段续跑尚不可用。
2. **超时与独有归档**：line111、117、158的fetch补有限AbortSignal，保留未知状态；将最终journal复制进唯一证据目录，结果不要只指向可变私有statePath。归档不得包含cookie/SMTP等凭证。
3. **输入链绑定与最终Report proof**：line29当前capture指针应与basis.captureFile/hash绑定，method.basisSha/Study/plan也应与实际读取basis字节对应；Report proof需来自真实S10/MinIO/DOCX通过证据，逐动作actor和文件/数值/可打开记录最终对齐，不猜未生成的DTO字段。原capture/basis成功指针与旧文件不得覆盖。

## 4. 独立验证范围与证据

本轮仅运行独立的纯离线结构反例，未运行/导入候选；没有HTTP、SQL连接或写入。证据为 [offline-counterexamples.json](../../testing/evidence/research-t18-2026-11-12/correction-independent-review-9e02aa94/offline-counterexamples.json)，SHA256 `aa4529ece7427ac07f9fa7b883ffea699aedb76f417cdec1f46ef73f257499ef`。四项反例分别展示visit union误通过、无关错误码/嵌套值漏检、未完成preview误通过、原response.version变化漏检；`candidateAccepts:true`代表验收断言存在漏检，不是产品已发生数据变化。

纯模块 `src/formal-analysis-session.js`当次SHA为 `f31af81c3307e9871ba7601e94c7cb31aaf8f42864c13a62c873c086b901effe`。S09回执/请求路径对照 `src/formal-capture-session.js`、CaptureAssignment/Visit；S05对照FormalAnalysisWorkspace及t15-analysis-service；Report回执对照t17-reports和repository。具体反例输入及三份主基线文件摘要已封存在JSON中。

未改候选、未删sentinel；本轮没有对候选运行node --check或任何执行命令。以上P2闭合、真实Report proof完成且根最终对齐前，保持准备态。

## 5. 4ad52d45修订复核（仍不可执行）

作者后续冻结候选SHA256 `4ad52d455ce4b268bf5a0dab27a717ea8ab434f224096062012a0cdd7648744f`，新增纯helper `research-t18-correction-guards.mjs` SHA256 `d09c493eae84b328c375841d7068e9fa57c445007628b6a65f81897836840057`。sentinel移至line25仍原样存在。本节是后续只读复核，不覆盖原9e02aa94反例证据。

独立重跑作者纯测试4/4；另用真实原三人capture/basis结构重放原4类反例，独立测试4/4：原H5/CSV response.version/绑定、SubjectVisit本体追加与版本、来源精确码/嵌套值、三例completed/current与responseVersion错配现在均拒绝。源码/日志及摘要封存于[独有目录](../../testing/evidence/research-t18-2026-11-12/correction-independent-review-4ad52d45/)，包含[独立测试](../../testing/evidence/research-t18-2026-11-12/correction-independent-review-4ad52d45/guards-independent.test.mjs)、两份TAP及[冻结记录](../../testing/evidence/research-t18-2026-11-12/correction-independent-review-4ad52d45/review-freeze.json)。只运行纯helper测试，未导入/运行主候选、调用HTTP或连接SQL。

| 原项 | 修订复核 |
| --- | --- |
| runtime每POST门禁 | line58冻结ready/pid/完整ids，line121负导出与line136/138浏览器dispatch复验；变化停线，无重启/POST重试 |
| 原H5/CSV版本 | line78调用assertOriginalCapture完整current版本/绑定；line81核完成状态，line83核CSV原导入回执，line85核H5全部冻结历史字段；本项纯反例已拒绝 |
| 访视历史证据 | line196独立核SubjectVisit原数组前缀及新ref2/responseVersion，再核对应fulfillment；line193核reverify原回执和version推进 |
| 来源阻断/清敏 | 新helper精确4码及递归禁值；line111–112收敛list/caps metadata并核confirmed，最终snapshot仍精确STALE |
| 负导出零operation | line119/124在受保护READ ONLY内按tenant/原actor/原key核零operation，并继续比对job/file；没有SQL写 |
| 新preview/snapshot | line202精确三visit/enrollment/version/completed/current，line206使用validAnalysisSnapshot并核新gateId不同、等release回执；释放后原计划复核仍有下述剩余项 |
| Report原actor | line15显式要求四动作证明all-admin，line161逐个比对当前admin accountId/authVersion；不再默许混合actor回执被admin代读。此为保守fail-closed输入限制，真实Report proof未形成，不能判定实际actors已对齐 |

还有两处应在执行前补齐的P2/Important，已发作者及根：

1. **line174首次ONSITE current未完整核原版本**：仍只核ref、answers、locked/review，没有对原capture调用assertOriginalCapture。原snapshot/report检查后若并发解锁复锁推进同ref的response.version，此处可把未知版本接为首次unlock基准。首次写前应同样核原ONSITE完整current与绑定；H5/CSV已经补好，不能漏掉唯一被写对象。
2. **line206释放后的updatedPlan未核原批准字段**：只确认旧新snapshot列表存在，未重新比较definition/contentHash/review.decision/reviewId/sequence。释放前line199已核，但释放后应再核，避免把并发改变后的计划当作“同原批准计划已验证”。

附带交接项已改善：capture指针与basis.captureFile及摘要绑定，method.basisSha/Study/plan/oracle绑定；遗漏fetch已加超时；成功结果明确phase=`correction-and-new-basis-only`并将journal复制到唯一目录，保存输入摘要/runtime PID。history非空仍停根审，属于安全保守策略，阶段续验不自动开放。真实Report proof/actor schema与上述两项闭合后，还须根最终审阅；当前不提供执行批准。

### 726af4e6两处补充复核

作者随后仅补这两处，当前候选SHA256 `726af4e661c4374d8419f91c398c2dbbe394f76b2aeeca0c2cf2e43b33416f17`，helper仍为d09c493e。独立只读确认line174已调用assertOriginalCapture核ONSITE原current；line206已在新snapshot读取后比较updatedPlan原definition/contentHash、approved及reviewId/sequence。上述两项P2代码层闭合。归档冻结记录明确区分先前4ad审查与后续726补充，没有用新字节冒充旧freeze。

当前没有新增未闭合的纯harness代码发现；**真实Report proof与四动作原actor尚待S10形成后最终对齐，sentinel保持、主脚本仍不可执行**。all-admin证明限制只提供fail-closed前置条件，不代表已经证明实际四动作都由admin完成。纯测试通过不证明主更正链、SQL持久事实或来源失效真实HTTP已执行。

## 6. 真实基线Report proof最终输入对齐

根完成主基线S10与最终五页DOCX审阅后，独立只读对齐执行前候选 `33eb9c5c85eea1ef214293b210628c6d6ab49c039c7c258888a3461c98e55677` 和真实[main-report-217cd513/result.json](../../testing/evidence/research-t18-2026-11-12/main-report-217cd513/result.json)，其SHA为 `2dccc9a9de94d6c590a2e29a78544911834daadabf53394b05dc1569c8fc5f11`。**本次实际输入检查通过，无新增Report schema、actor、文件或原主例保护阻断。** 未执行或导入候选、未发API/连接SQL/操作浏览器，未重做已关闭的大审或业务链。

- proof为passed/syntheticOnly/released/version1、原job ready/docx；真实artifact为 `rh-formal-report-54284b85-c8de-4983-b485-3577dbd40775`，job为 `cmwdivydv000llul1ceeucubw`。顶部所需Report字段、四原key、file metadata及路径均真实存在，未构造占位proof。
- create/review/release/export四actor逐项与真实confirmed-journal、各自原key/target/receipt相等，均 `rh-kb-local-b0e2af9d-admin`、authVersion5、sessionRole admin；不是由当前管理员代读其他actor的假设。脚本执行前仍GET当前auth/me逐actor核对，若身份变化须停线。
- 原下载DOCX实际12552字节，SHA `96e4dde7396871bcba5d04e32a72ead4b4f3895fffeb9905d977e95567815799`，与ready file完全相等，ZIP可读且含真实Word document.xml；根rootVisualReview指向相同DOCX、五页PNG摘要逐份匹配。独立本轮仅核证据字节/QA引用，没有冒称再次逐页图像验收。technical-result原passed:false/rootDocxReviewPending:true保留，最终result只增加/更改根QA晋级字段，其他事实逐对象相等。
- report.inputSha256中的benchmark/capture/basis/method/oracle逐份与当前冻结原文件相等；basis.captureFile/hash、method.basisSha及same Study/plan/snapshot/Run均相等。原Run `cmwdd8a1g0031luw3dlzct2dg`、旧snapshot `t15-snapshot-abbde046-27b9-4113-b7ce-9a1ece74ca90`保持；报告保存的完整Run依据/数值/numericEvidence与原Methods runFile相等。
- 原三人仍对应benchmark、ref1、locked/review_approved和completed/current，现场原答案0/选填0/false、H5原ref与源摘要均一致。候选仍按原726守门逐次核H5/CSV current/版本/历史/导入来源，不增加它们的写入口；解锁更正仅原ONSITE，旧basis/Run/report/job/file和原四回执要求精确来源拒绝，新preview/snapshot与同原approved计划及新gate核验均保留。

独立从33eb仅去除新增UI freeze import/proof声明、6处调用及输出proof字段，所得字节SHA精确还原先前已审726af4e6。业务守门没有其余变动；T05另审新增guard调用点，不由本节自签其真实运行。根同时报告已用真实proof运行至sentinel且0请求，本审查自身未执行这一步。源码/原726重建/guard差异及[独立实际proof对齐结果](../../testing/evidence/research-t18-2026-11-12/correction-report-proof-independent-33eb9c5c/actual-proof-alignment.json)保存于[独有目录](../../testing/evidence/research-t18-2026-11-12/correction-report-proof-independent-33eb9c5c/)。

本结论仅关闭“真实Report proof尚待形成”的输入缺口；当前权限、源SHA/runtime、旧依据真实409/不泄值、数据库历史不变及新snapshot必须由根在独占更正窗口实际执行并留痕。临床/生产未验，proof中的userBusinessReviewPending仍如实保留，不影响已授权合成软件流程继续，也不冒称用户业务最终签认。
