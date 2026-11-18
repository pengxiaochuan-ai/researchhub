# WP07真实合成CRF方法执行与AI结果解读小步实施计划

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

D01–D07技术检查完成，D08独立原评审及重要项作者复验完成，AC10专业验收保留。D05按本轮批准的总4次（含历史失败1次）完成两账号成功＋在途负例，D07只复核既有消息不重放收费；79笔known/¥1.518966/¥5、held0，本片请求额度用完。D06原Artifact新报告/notes/历史及D07更正重检/失权/迟到/五视口/原生200%已有真实证据。原24h＋8h缓冲、3＋1工作日估算保持，不把工具墙钟时间冒充实际人日，返工从原缓冲列支。下方早期阻断是历史；不自动进入WP08或扩大底座。




D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 2026-10-26续行批准

本片调用总上限最多4次（含已失败1次，后续最多3次）已获用户批准；原5元/报价不刷新，旧回执及76笔保留，新增独立次数批准回执。D05严格正文引用/科学数值拒绝规则不放宽；先免费验证可信请求与计数边界，再执行原两账号成功/在途反例三项。通过后继续D06→D07→D08，不提前总评审、不扩底座。下方2026-10-25停点是历史，不是当前待批事项。

## 当前执行停点（2026-10-25）

F01及[最小存储修正](d05-terminal-binding-adjustment.md)均已批准。终态run完全只读，原job/消息/审计关联已通过真实Queue/PG首门槛和原子/幂等/在途排斥测试；修正仍从原8h缓冲预算列支，不扩24＋8h或共享底座。首笔真实Provider known费用¥0.012051，但正文引用缺失，按原契约拒绝交付，D05不销项。原3次已消耗1次，若保持两账号成功＋在途负例仍需3次，超原剩余2次；已暂停本片付费入口，待次数计划确认，不自动重试、续价或提前进入D06/D08。免费检查及失败证据见implementation-progress.md。

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` task-by-task. 用户指定当前目录串行实施＋一次实施后独立代码总评审；不派实现代理、不创建worktree、不自动提交/推送。规格、八步、R01–R03、F01和最小存储修正已批准，当前新增确认只针对失败后的最小调用次数调整；原费用/报价硬门槛不变。文档评审不替代D08代码评审或用户专业验收。

**Goal:** 把本人真实保存CRF冻结到可复算方法run，经原Worker和科研Agent形成可追溯结果/报告草稿，不扩大共享底座。

**Architecture:** 原包不可变Version＋新ResearchMethodRun.inputSummary快照引用/紧凑manifest；复用旧WorkerClient/数值政策，新增CRF窄投影而非搬用全Study质量门。原Queue/最终assistant事务增加第五互斥意图；新方法报告通过原Artifact/Version/Source/Audit保存，旧四类任务和报告schema不变。

**Tech Stack:** 既有React18/Vite/JS＋JSDoc、NestJS/Prisma/PostgreSQL、原Python t19-1与科研Agent；不新增依赖/表/Worker/Skill/角色。

**Spec:** [实施规格V0.1](../../product/synthetic-crf-methods-spec-2026-10-25.md)；[最小授权R01–R03及F01](authorization-scope.md)。本文件为8个独立可验证任务，24h＋8h=32h，3天实施＋1天缓冲。

## 全局约束

- 原两合成账号/当前Study/本人本轮新包、run、报告；仅wp01_test_full_baseline，正式实体/放行表零写；旧源/Schema/RLS/Client/角色/既有授权/旧服务/历史保持。
- 原包3–5 SIM×2访视×1 CRF/1–12字段；分访视最多24组；0/false是有效值，四状态保留；人工范围未设就不设，无年龄等默认值。
- 仅research-data-quality/t19-1，公开投影仅missing-rate/range-check及本人包计数。旧20%/50%阈值、全Study计数占位、range finding.n和全局验收矩阵不能作为本片业务标准。
- 请求32KiB、inputSummary128KiB、manifest60KiB、完整Worker请求≤65,536字节/8秒、raw response128KiB、投影64KiB；每包≤30 run/每页≤20；AI选择/返回≤6组，每段≤600；notes≤6000/报告≤30版。超限拒绝，不静默截断。
- 原binding＋dataBasis＋DQ id/hash决定freshness；根元数据不等于数据版。冻结旧版读取不能使stale变current，改回数据也不复活旧结果。
- 原run状态/CAS/新scope/原Skill/真父对象、原最终publication事务沿用；只调度本次新ID，不扫描/恢复旧queued，重启只读interrupted。
- R01–R03未批不做对应写/执行；F01未批/核价无效不调用模型。失败不自动重试或续额；费用/撤权/服务故障等共享状态验证严格串行。
- 操作/输入/表格14/22，Reading16/28/48rem，辅助13/20，元信息12/18；局部样式、共享Shell和Button不改。

## Review Focus

1. 看似合法的CRF值：0/false、未适用/未测、选填缺失、不同访视分母、手工范围缺省，不得变成默认年龄或独立样本假设——D01/D02/D03。
2. Worker“成功”但语义不适用：固定20%/50%、range.n=1、未覆盖零值/全Study矩阵，必须隔离并显示coverage，不能进入AI/报告——D01/D03/D05/D06。
3. 数据或权限在途中变化：创建/认领/Worker前/结果或assistant提交/历史读取同一可信链，CAS/失权/真父冲突拒绝交付——D02/D03/D05/D07。
4. 慢轮询/分页/历史/dirty/迟到200：共享single-flight、身份fence、保存保留原CAS，不使busy卡死或历史复活——D04/D06/D07。
5. 失败测试本身意外提交或计费：注入未命中必须事务内abort、免费与付费门禁隔离、同键不重放、原记录保全——D03/D05/D07。

## 文件与跨任务接口

拟新增：

- `scripts/synthetic-crf-methods-contract.mjs`、`.test.mjs`：快照/manifest/coverage/result投影/比较纯函数；`tests/fixtures/synthetic-crf-methods.mjs`为最小严格CRF/golden数据，不重用旧seed。
- `scripts/local-crf-methods.mjs`：新scope/旧授权/原run事务、精确Controller、只调度新ID及实际Worker。`scripts/synthetic-crf-methods-preservation.mjs`：只读核对/新片基线，不覆盖WP06原基线。
- `scripts/local-crf-methods-ai.mjs`、`synthetic-crf-methods-ai-contract.mjs`、`synthetic-crf-methods-projection.test.mjs`：第五意图/实际引用/原消息投影及当前提交守门。
- `scripts/local-crf-methods-reports.mjs`、`synthetic-crf-methods-report-contract.mjs`、`.test.mjs`：新报告facts、说明与原生Sources/事务。
- `src/crf-methods-session.js`、`scripts/synthetic-crf-methods-session.test.mjs`；`pages/shared/CrfMethodsWorkspace.jsx`（输入/列表/结果/对比）、`CrfMethodsInterpretation.jsx`、`CrfMethodsReport.jsx`及`crf-methods.css`。
- 验证脚本`synthetic-crf-methods-{api,worker,browser,ai-live,boundaries,free-gates}.mjs`，最终命令见任务；证据建父仓库`docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/`，不用旧目录假装新证据。

必要修改限定：`scripts/local-synthetic-edc.mjs`仅暴露验证后的同事务冻结版读取；`local-knowledge-ai.mjs`装配/第五任务和原state/source；`local-knowledge.mjs`32KiB精确新路由及controller注册；`src/knowledge-session.js`精确白名单；`missing-main.jsx`/`platform-frontend.js`/`research-design-session.js`/`platform-shell.js`仅显式S06真实路由与身份/页头适配；`SyntheticEdcWorkspace.jsx`叶子链接。不为整理代码重构上述文件，旧默认分支不变。

接口签名采用JSDoc，后续任务只消费下列结果，不另造近似名字：

```js
buildCrfMethodInput(packet, quality, packetVersion)
// => {snapshot,manifest,inputHash,manifestHash,coverage}
projectCrfMethodResult(snapshot, workerResponse)
// => {result,resultHash}; result.evidenceGroups最多24
compareCrfMethodRuns(left, right)
// => 按visitKey/fieldKey的只读并列结果或不兼容错误
parseCrfMethodInterpretation(text, trusted)
// => {items:[{evidenceIds,explanation,question,sourceRefs}]}
createLocalCrfMethods(options)
// => {Controller,withRun,inRun,read,setAi}; options复用{root,ids,plans,edc,prisma,load,require,scope}
// withRun(user,planId,collectionId,runId,permission,cb)
// inRun(tx,user,planId,collectionId,runId,permission,cb)
// cb(tx,parent,state,packet,runView,rawRun)；先重验R01/原授权/真父，再回调
createCrfMethodsAi(options)
// => {setQueue,onJobCreate,prepare,prompt,providerOptions,toolEvidence,accept,validateTurn,projectMessage,readMessageSource}
// prepare可信DTO、Provider两入口/最终JSON及去数值工具视图严格遵守spec §6装配表
createCrfMethodReports(options)
// => {create,read,save}; 消费methods.withRun/inRun和AI当前不可变消息投影
```

snapshot包含marker、真实包version引用、原13项binding、dataBasis、DQ id/hash、responseRevision列表、adapterVersion/coverage/manifest。原inputHash固定不随AI/pending/notes改变；resultHash只覆盖投影结果。runVersion为真实updatedAt ISO字符串，job/报告入队以其CAS，幂等先核同键输入再决定是否写。原返回与错误形状以spec §8为准。

## 工时、依赖与退出检查点

| 任务 | 小交付 | 小时 | 依赖 |
| --- | --- | ---: | --- |
| D01 | 窄复用/授权/保全门槛＋golden契约 | 4 | 规格计划已批；PG只读核对遵守既有专用库边界 |
| D02 | 预览/原子冻结新run/本人读取及S05入口 | 3 | D01、R01 |
| D03 | 实际Worker/认领/成功失败提交闭环 | 4 | D02、R01及既有Worker/Skill许可 |
| D04 | S06结果/比较/分页与过期交互 | 3 | D02/D03 |
| D05 | 原Agent结果解释与最终/读取守门 | 4 | D03/D04、R02、F01及有效报价 |
| D06 | 新方法报告/notes/历史及真实来源 | 2 | D03/D05、R03；未验AI不销AC07 |
| D07 | 两账号新材料全链/失效/原链/布局回归 | 2 | D02–D06 |
| D08 | 唯一实施后独立总评审、修补交接/文档 | 2 | D07 |
| 缓冲 | 仅本片缺陷、评审返工 | 8 | 按需，不追加能力 |
| 合计 | 24小时实施验证＋8小时缓冲 | **32** | **3天＋1天** |

第1天D01＋D02＋D03前1h；第2天D03余3h＋D04＋D05前2h；第3天D05余2h＋D06/D07/D08；第4天最多8h修补。测试和产品/技术文档随任务累计，不全部推迟最后2h；若独立反馈超过缓冲，不擅自第二轮扩范围。D01首半天、D04后第2天末、D08第3天末复估，等待和专业反馈单列。

### D01 · 四小时复用门槛与纯契约

**文件：** contract/test、golden fixture、preservation脚本（4个）；只读旧Worker/Policy/Skill规则及当前装配。

**消费：** 本规格§3–4、原syntheticDataBasis/原Worker协议；**产出：** `buildCrfMethodInput/projectCrfMethodResult`、带每visit分母与coverage的golden夹具、冻结新片源/原75笔前缀保全方案。

- [x] 写RED测试`zero_false_are_present`、`missing_states_are_distinct`、`per_visit_denominator`：3人×2访视，第一访视0/false非缺失，未测/未适用计入缺失但分类不丢；最多24组；不同访视不混为n=6。
- [x] 写RED测试`no_demographic_defaults_or_raw_rows`、`legacy_gate_not_business_rule`：不带年龄0–120/原答卷/原因/文本入Worker；20%/50%和全Study零值只可存在raw诊断，不进入projectedResult/模型输入/报告；range.n=1不等同异常人数。
- [x] `node --test scripts/synthetic-crf-methods-contract.test.mjs`确认因未实现/明确断言失败，再最小纯函数实现，GREEN；纯测试不运行模型/Worker。
- [x] 在既有专用合成许可内核对原run创建/数值校验/现有Feature/Skill/Assignment及可加载WorkerClient，保全691旧源/Schema/既有角色和历史；不调用旧工厂初始化。需新增原权限/算法/旧源或无法投影即停，记录超4h影响。

**退出：** AC01/AC02成立，输入来源和旧协议不适用字段有明确表；不能仅以Workerhealth或类型可编译判通过。

### D02 · 预览与原子冻结新run（3h）

**文件：** `local-crf-methods.mjs`、`local-synthetic-edc.mjs`窄暴露、`knowledge-session.js`、`SyntheticEdcWorkspace.jsx`链接、`synthetic-crf-methods-api.mjs`（主实现≤4个）。

**消费：** D01契约与R01；**产出：** `GET method-preview`、`POST/GET method-runs`、`GET method-runs/:runId`、methods.withRun/inRun/read。

- [x] API RED：未接接口失败；写`own_packet_snapshot_no_parent_write`、`duplicate_key_and_competing_create`。两个独立连接、不同key同包同时创建必须一成功一409，同key仅一个run/审计，同key异输入409；当前包/父方案版本/dataRevision不变，客户端manifest/额外字段400。
- [x] 最小Controller/事务：旧共同授权锁→spec §5包级事务advisory排他锁→锁内重读R01/原Feature/Skill/本人父链/head/DQ/同键/活动/容量→真实Version引用/inputHash→新queued row＋审计原子写；无包根更新。只读预览不写。仅放行spec §8精确同源路径，32KiB边缘限制同时接装配。
- [x] 用`node scripts/synthetic-crf-methods-api.mjs --mode local-synthetic`验证两账号各本人新包；跨本人/错误父/旧seed run/未审来源拒绝，事务尾部注入回滚。注入回调未抛也必须事务内abort；不写历史包。
- [x] S05新增叶子入口，按钮名称/目标带合法Study/plan/collection，不改原DQ/报告/邀请。记录本阶段尚未实际计算，不伪造数值。

**退出：** AC02/AC04创建部分、本人身份/来源/原子性有真实PG/API证据，R01未批则仅纯契约不写库。

### D03 · 实际方法执行与提交（4h）

**文件：** `local-crf-methods.mjs`、contract/test、`synthetic-crf-methods-worker.mjs`、`local-knowledge-ai.mjs`装配（主实现3个）；不修改旧Worker或新开端口。

**消费：** D02原始run/withRun/inRun、D01投影；**产出：** 实际needs_review/failed/interrupted、resultHash/numericEvidence/coverage与私有trace。

- [x] RED `only_one_claim`、`inflight_data_change_no_delivery`、`worker_unavailable_not_zero`、`projection_rejects_duplicate_or_unknown_metric`。两个独立认领一个成功，错误版本/未知operator/缺指标/自动修复标记/科学数值来源错误拒绝。
- [x] 只在创建本次新ID提交后调度，CASqueued→validating→running，冻结token/inputHash/随机启动instanceId，PID仅诊断；Worker前再验当前授权/父/数据/DQ，调用原WorkerClient.execute。通过原fetchImpl接点核对实际请求body/input摘要和本次claim/返回，保存受控trace，不声称Worker回签hash；完整请求65,536字节。raw响应经原policy再做纯CRF投影，不调用旧全Studymapper/release service。
- [x] 成功在同事务重验并CAS保存结果＋审计；失败提交也校验token/instanceId/版本/原授权，不得无条件update或elevated兜底。增加相同PID但不同instanceId反例：旧在途只读interrupted，不占当前活动、不扫描历史、无自动补跑。
- [x] `node scripts/synthetic-crf-methods-worker.mjs --mode local-synthetic`：真实本机HTTP/golden、一次0/false样例、更正后显式新run、在途改数据/重检阻断；保存请求/响应/hash/算子版本/时间。故障代理仅拦本轮具名请求，不停旧服务，不影响历史任务。

**退出：** AC03/AC04/AC05方法侧通过；不把协议accepted或raw blocking数当业务通过。

### D04 · S06结果、比较与慢读取（3h）

**文件：** `CrfMethodsWorkspace.jsx`、`crf-methods.css`、`crf-methods-session.js`、`synthetic-crf-methods-session.test.mjs`；既有missing-main/platform映射按必要显式分流接入，不改默认demo/Shell。

**消费：** D02/03 view与compareCrfMethodRuns；**产出：** 本人输入预览→显式执行→实际结果/coverage→旧新并列、返回S05。

- [x] session纯RED：`explicit_route_no_demo_fallback`、`wrong_comparison_rejected`、`single_flight_does_not_starve_slow_result`；`node --test scripts/synthetic-crf-methods-session.test.mjs`。
- [x] 结果表程序呈现真实数字/单位/分母、覆盖范围和未适用；没有结果/失败不显示0。compare仅同owner/collection/config/adapter，对比旧run显示stale，不恢复覆盖或算推断指标。
- [x] Chrome RED→GREEN：分页超过20项、响应跨轮询周期、切run、未知ID、actual200迟到logout/撤权；结果选择绑定resultHash，列表不自动回第一页，busy必释放。主视口先1440×900，阶段截图/录屏。
- [x] `node scripts/synthetic-crf-methods-browser.mjs --mode local-synthetic --case methods`核验两账号实际结果页/返回/失败/键盘，读取原Shell真实身份及computed14/22与16/28。

**退出：** AC06方法侧可操作，不用旧数值表截图或DOM单独替代实际数据。

### D05 · 真实AI解释与原消息/引用边界（4h）

**文件：** 新AI adapter/contract/projection.test、`CrfMethodsInterpretation.jsx`、`local-knowledge-ai.mjs`第五任务分支（主实现4个）。

**消费：** D03可信result、D04真实当前runVersion、原队列/ownInTx/budget；**产出：** 原Message不可变研究方法解释、第五族投影及真实方法/KB引用。

- [x] 纯RED `five_payload_families_exclusive`、`no_numeric_or_raw_input_to_model`、`method_and_knowledge_refs_never_confused`、`damaged_provenance_never_QA_fallback`；至少方法引用且逐项实际正文对应，科学数字/虚构路径/patch/超6项拒绝。`node --test scripts/synthetic-crf-methods-projection.test.mjs`。
- [x] 原queue同事务写job（第五kind含选择/请求hash/真实版本）/user message＋审计；终态run包括artifactRefs/updatedAt完全只读。共同授权锁→本人run行锁→重读真实父/数据/DQ/版本→精确有界在途查询与同键校验。原final publication事务和原knowledge-state/source从真实job重验同一binding；有标记但损坏一律restricted。按用户本轮批准的最小存储修正实施，不改旧Schema/触发器。
- [x] 按spec §6表接入prepare可信DTO/prompt/providerOptions/toolEvidence/accept；测试chat与chatWithTools实际参数、system/grounding/工具可见文本均去科学数值，第五kind不进入通用assertAnswer/强制KB分支，旧四族不变。原KB原文/hash与modelView分离。
- [x] UI显式选1–6组，禁止未运行/失败/过期run请求AI；来源[M1]回本次真实方法组，[1]回实际审核KB；数字表由程序渲染。pending/failed/费用未知分开，无自动重试或假成功。
- [x] **F01/有效核价先确认**，然后`node scripts/synthetic-crf-methods-ai-live.mjs --approved-four-call-round`：两个原账号新包各一次真实Agent/工具/Provider/usage/引用；另一次新具名在途变更拒绝交付，费用保留。脚本不进免费gates，失败不自动重新执行。

**退出：** AC05/AC07真实执行成立；费用未批则明确AI未验收、不进入声称完整D07的交接。

### D06 · 新方法报告与本人说明（2h）

**文件：** report adapter/contract/test、`CrfMethodsReport.jsx`；父工作台只挂载子组件/传busy，不重写原EDC报告。

**消费：** methods.inRun/withRun、D03结果与D05消息；**产出：** spec §8新report-drafts/read/notes/history和原生Sources。

- [x] RED `real_run_facts_and_coverage_only`、`notes_do_not_change_method_result`、`no_op_notes_is_422`、`report_cannot_bypass_revoked_method_or_AI`。`node --test scripts/synthetic-crf-methods-report-contract.test.mjs`。
- [x] 新schema独立草稿；当前run/resultHash及显式解释选择重验，原Artifact/Sources/Audit原子创建。notes仅追加原新报告Version/CAS，不改facts或旧报告；无AI的真实状态不能写成已解释。
- [x] API/Chrome：实际数值/方法来源一致，说明冲突/dirty/历史readonly、慢轮询、AI scope失效后的报告隐藏，原WP06旧报告字节/源保持；无审批/导出/资产按钮。

**退出：** AC08真实闭环；若2h不足从8h缓冲明确登记，不能临时砍源校验或复用旧不兼容schema。

### D07 · 全链与原链保全回归（2h）

**文件：** `synthetic-crf-methods-browser.mjs`、`-boundaries.mjs`、`-free-gates.mjs`及本片测试报告。复用前序合法只读/纯gates，不能执行会改旧fixture的整段脚本。

**消费：** D02–06全部；**产出：** 两账号全新CRF→方法→解释→报告真实证据、风险/布局/旧链回归。

- [x] 复核D05本轮两个账号新包的0/false/缺失/范围→DQ→真实Worker→真实AI→新报告完整证据，并在原本轮包内完成更正/重检/旧新比较；不重放付费AI。原D05三项目标加此前失败，按新增批准共4次全部消费，D07只读取已有trace/消息；若需额外模型请求先列明原因/数量并复核F01许可与预算，不自动调用。专业AC10另留未预运行材料给用户，不预先背测试结果。
- [x] `node scripts/synthetic-crf-methods-boundaries.mjs --mode local-synthetic`：current-head history不复活、原消息/方法引用/报告撤权一致、两次独立提交冲突、故障注入命中/未命中都事务内回滚、actual迟到响应不复活、失败不重复费用。
- [x] Chrome五视口1440/1366/1920/390/320及原生200%、实际computed/PNG/WebM、键盘与错误恢复；科研/管理员/后端三侧及相关列表详情历史同时核对，未测明确列出。
- [x] `node scripts/synthetic-crf-methods-free-gates.mjs --mode local-synthetic`：全部纯测试、原编译内核、`pnpm run build`、只读旧源/Schema/授权/旧8进程/保护历史、原账本前缀及费用known/固定5元、`git diff --check`；执行期间不跑收费/撤权/故障共享状态脚本。回归原账号邀请/知识/WP05/旧run报告资产只读，不把其成功算作新CRF结果。

**退出：** AC02–08及AC09测试/保全部分技术证据完整；AC09的独立评审和最终文档留D08关闭。保留所有初始failure和已知告警，不用最终绿色抹去失败。

### D08 · 唯一实施后独立总评审与交接（2h＋按需缓冲）

**文件：** 精确本片source/hash清单、`docs/testing/synthetic-crf-methods-2026-10-25.md`、本片ledger与产品/使用/技术/版本文档。

- [x] 当前目录脏改动按明确文件和必要共享分支限定，派唯一fresh只读代码总评审；不派实现代理，不把本轮文档评审算成代码评审，不全分支扫无关改动。
- [x] 对确认Critical/Important逐项主实现先复现再最小修补/复验；独立原结论保留，不能称主实现关闭是二次独立复签。超缓冲/新权限/新费用/新范围停下。
- [x] 同步living spec/product-baseline/product-changes、使用说明、根06版本记录及专项技术/测试、Notion回读；四层分别汇报。未做云/真实发布不写客户上线更新；不自动提交推送。
- [x] 提交可用本机入口/凭据文件位置/实际trace与失败限制，用户用未预运行样例验AC10；技术通过不代签，不从D08自动启动WP08。

## 静态自检与当前状态

编制阶段需逐项核对：spec §1–11→R01–R03/F01→AC01–10→D01–08；消费/产出签名和命令一致、小时数24＋8、实体/费用/旧后台边界不扩。上述脚本是**未来实现落点**，没有创建/运行也不能写“测试通过”。本轮只验证Markdown引用、必需段落、工时与git空白，并同步Notion；规格/授权/计划等待用户确认。
