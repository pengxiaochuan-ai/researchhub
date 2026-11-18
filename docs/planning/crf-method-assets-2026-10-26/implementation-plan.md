# WP08真实方法报告资产候选与复用准备 · 八步实施计划

> For agentic workers: 用户已明确批准规格、八步及A01–A04，选择当前目录串行实施＋独立总评审；使用superpowers:executing-plans逐任务执行，不派实施代理或逐任务评审。V01–V07完成；V08唯一原代码评审With fixes的三Important已由作者一次修补复验（324/1054及整链/专项通过），文档/Notion已回读，本机技术交接、AC10待用户；原编制阶段措辞保留历史。文档评审不替代实施后V08代码总评审。保留脏改动，不自动分支/worktree/提交/推送。

**Goal：**本人当前WP07方法报告固定为私有资产候选，能核对来源/配方/待确认条件、修订说明、读历史、派生并回原报告版。

**Architecture：**新marker/prefix窄适配，沿原plans.withScope→methods.inRun→reports.inReport的同一事务，使用原Artifact/Version/Source/Audit。候选schema不冒充旧seed；新显式A01/A02分支复用母版，原族默认路径不改。

**Tech Stack：**现有React18/JSX/Vite、NestJS适配层/Prisma/PostgreSQL、Node test与已安装Playwright/Chrome；不加依赖/Worker/算法。

**Spec：**[实施规格](../../product/crf-method-assets-spec-2026-10-26.md)，配套[授权](authorization-scope.md)与[源码证据](findings.md)。规格为约束，本片命令/脚本已按实测台账实现运行；状态型夹具已经消耗，不可盲重跑。

## Global Constraints

- 原两账号、同一合成tenant/group/project，仅wp01_test_full_baseline；旧根来源只读，本片新候选/新具名夹具才可写，不接临床/云/远端配置。
- 不修改app/旧源码、Schema/Client/RLS/Role/Feature/Skill/Assignment/Agent/Worker，不调用旧工厂补权，不恢复WP01 T03–T24，不增加通用资产目录/调度平台。
- marker=`rh-crf-method-asset.v1`、prefix=`rh-crf-method-asset-20261026:`、typeKey=research_report/status=draft；原terminal run所有字段、根报告/父候选/方案/记录不写。
- notes≤6000字符、每份≤30版、派生≤8层（根0）、每账号本片≤100份、列表≤20；snapshot≤768KiB、contentBlock≤1MiB、Markdown≤512KiB，POST原始32KiB；超限明确拒绝不截断。
- A01–A04未批准不做对应执行；scope0600/非符号链接/≤64KiB、每账号登记≤18根；原scope/旧授权不改，新增目的不等于新增角色。
- 原已生成解释只读复用，不调用模型/重新检索/计算数值，不将旧汇总加入可执行配方，原5元/79笔/4次用完不续期/续额。
- 操作14/22，Reading16/28/48rem，辅助13/20、元信息12/18；原Shell/五导航/Card/Button，所有受影响科研/管理/后端同时验证，真实Chrome PNG/WebM与原生200%。

## Review Focus

1. 同为data_quality_report但来自旧seed/错run/伪造body；以及旧资产schema中的dataset诱使新族误拷贝答案/历史数值——V01/V02真实来源及字段白名单反例。
2. 根报告只改notes或祖先换版、内容改回、历史自证current；没有AI的根误受R02限制或附AI候选绕R02——V02/V04/V07按当前head及条件授权反例。
3. 两连接同根不同键、跨动作同键、无变化notes、超限时合法重试；注入未命中却成功提交——V03/V04/V07事务/CAS/回执反例。
4. 慢读期间失权→迟到200→恢复后busy不释放，dirty刷新暗推CAS、列表翻页被轮询重置、固定报告回链误选最新——V05/V06/V07实际Chrome组合。
5. 为负例修改了前序报告/原grant/历史数据，或免费回归脚本重放模型——V01/V07保全及无模型guard；不能跑旧整段付费/写旧样例harness。

## 文件边界与接口

拟新增：`scripts/crf-method-assets-contract.mjs`、`.test.mjs`；`scripts/local-crf-method-assets.mjs`；`src/crf-method-assets-session.js`与`scripts/crf-method-assets-session.test.mjs`；`pages/shared/CrfMethodAssetWorkspace.jsx`（身份/列表/请求）和`CrfMethodAssetDetail.jsx`（阅读/说明/历史/派生）、局部`crf-method-assets.css`；`tests/fixtures/crf-method-assets.mjs`；本片`crf-method-assets-{api,boundaries,browser,free-gates,preservation}.mjs`验证脚本，均在实施获批后创建。

必要修改：`local-crf-methods-reports.mjs`只增inReport；`local-knowledge-ai.mjs`一次装配factory/Controller，不新增queue kind；`local-knowledge.mjs`登记新Controller与新notes/derive精确32KiB路径；`knowledge-session.js`增加新白名单；`CrfMethodsReport.jsx/Workspace.jsx`新封装入口/固定报告选择与busy联动；`crf-methods-session.js`成对回链参数；`missing-main.jsx`显式分流；`research-design-session.js`真实身份；`platform-shell.js/platform-frontend.js`仅新族页头/入口说明（含关联S06过时待接入文案）。旧SyntheticAssetWorkspace/旧资产服务/contract/route不重写。

```js
reports.inReport(tx,user,planId,collectionId,runId,reportId,versionNo?)
// => {report,reportVersionId,nativeSources,run}; 原同tx完整验权/真父/facts/Source
buildCrfMethodAssetSnapshot({report,reportVersionId,run})
// => {snapshot,snapshotHash}; 只当前已保存报告；历史证据与字段白名单reuseRecipe分离
crfMethodAssetSourceState({snapshot,report,ancestors})
// => current|stale|restricted；report/ancestors是已经原服务验证的view
crfMethodAssetNotesOperation(state,body)
// => {idempotent,notes,operation:{key,hash,versionNo}}；无变化抛CRF_ASSET_NO_CHANGE
deriveCrfMethodAssetLineage(parent)
// => 固定{id,version,contentHash,notes}祖先数组，≤8层/同根；根snapshot不变
renderCrfMethodAsset(snapshot,notes,lineage)
// => escaped Markdown；historical facts不得冒充目标研究结果
createCrfMethodAssets({root,ids,plans,methods,reports,storage,load,require,scope})
// => {Controller,create,read,list,save,derive}；create/notes/derive统一{asset,operation}
readCrfMethodAssetLocation(pageId,search)
// => {scope,assetId?,versionNo?}; 新旧族/无效/重复参数拒绝
makeCrfMethodAssetUrl(pageId,scope,assetId?,versionNo?)
makeCrfMethodReportUrl(scope,planId,collectionId,runId,reportId,versionNo)
crfMethodAssetRequestAllowed(method,path)
// 仅规格§7精确路径；同源transport不开放通用artifact/export
```

公共view/错误/页内字段以spec §7为准；内部nativeSources不随客户端body输入。tx只由plans.withScope产生，reports.inReport不另开事务；factory本身不更新授权。根报告版变化独立于factsHash变化，不能只比facts判断新旧。

## 工时与依赖

| 任务 | 小交付 | 小时 | 依赖/门槛 |
| --- | --- | ---: | --- |
| V01 | 复用/授权/保全/golden | 3 | 规格/计划/A01–A04批准 |
| V02 | 同事务报告桥、scope与来源状态 | 3 | V01；首4h复用不成立停线 |
| V03 | 初始候选原子创建/读取/分页 | 4 | V02、A01 |
| V04 | 说明/CAS/历史/本人派生 | 3 | V03、A02/A03 |
| V05 | S06入口/固定版回链与A01列表 | 3 | V03；不依赖新模型 |
| V06 | A02配方/说明/历史/派生交互 | 3 | V04/V05 |
| V07 | 实际PG/两账号Chrome/全链保全 | 3 | V02–V06、A04 |
| V08 | 唯一代码总评审/修补/文档交接 | 2 | V07，AC10用户另验 |
| 缓冲 | 仅本片缺陷/评审返工 | 8 | 不增加功能 |
| 合计 | 24h实施验证文档＋8h缓冲 | **32** | **3天＋1天** |

第1天V01＋V02＋V03前2h，第2天V03余2h＋V04＋V05，第3天V06＋V07＋V08，第4天修补。每步文档/单元/API同步，不等最后3h补全部测试；首4h、第2天末、第3天末复估。收费/专业等待单列；超32h、新权限/旧源/云/远端配置/发布先确认，不靠减测试兜工期。

### Task 1: V01 · 复用门槛与新来源纯契约（3h）

**文件：**新contract/test/fixture/preservation（4），只读原报告/资产/Artifact/guards。**消费：**spec §2–4/授权；**产出：**snapshot/recipe契约、旧行/旧源/账本保全基线及新增scope拟登记根。

- [x] 先写`real_report_not_legacy_seed`、`recipe_excludes_answers_and_historical_results`、`no_AI_is_not_fake_explained`。断言schema不符/报告非current或非head拒绝；配方无answers/records/result/dataset/seed，而历史证据保留原方法数值/coverage/真实AI状态，原输入不变。
- [x] 按spec §4.1逐字段实现闭合recipe投影，固化完整golden JSON、每层unknown-key与嵌套答案注入反例；不能spread原facts/config再删禁用键。原时间null不变0、config.notes不进入配方，正常历史facts含result/recordVersions不误拒。
- [x] Run `node --test scripts/crf-method-assets-contract.test.mjs`；Expected RED缺实现/上述断言，然后最小实现`buildCrfMethodAssetSnapshot/renderCrfMethodAsset`→GREEN，不执行Worker/模型。
- [x] 在获批合成目标只读核原角色/原父/原Source和已存在权限；`node scripts/crf-method-assets-preservation.mjs baseline`：新本片基线，保护所有前序行/旧源/原角色Schema/旧8进程/79账本前缀及整文件，不覆盖WP07旧基线。新scope仅批准后创建、审计一次，原授权不写；没有原权限则停止。

**退出：**AC01/AC04契约与复用门槛通过；报告同tx出口是否能不改旧源表达已核对，不能把HTTP200当全部来源验证。

### Task 2: V02 · 同事务报告桥与当前来源（3h）

**文件：**local-crf-methods-reports窄出口、新adapter及api/boundaries测试（4）。**消费：**V01、plans.withScope、methods.inRun；**产出：**reports.inReport、A项scope/current/真父验证。

- [x] API/PG RED `report_bridge_same_tx_no_parent_write`、`wrong_parent_or_cross_owner_denied`、`selected_AI_requires_R02_but_no_AI_does_not`：插入测试审计后原桥拒绝必须同tx回滚；错plan/collection/run/report/旧seed或损坏Source不得交付。
- [x] 增`inReport`仅复用原loadReport并返回真实VersionId/Source；不得调用外层read另开tx。新factory消费既有plans而非重建带初始化的工厂；原scope及旧角色保持。
- [x] 在隔离新scope副本装配原报告/AI服务，测试R01/R03/附AI时R02拒绝及不附AI例外；不改正式运行的旧scope/grant、不请求Provider。`node scripts/crf-method-assets-api.mjs --mode local-synthetic --case bridge` Expected全部检查通过/父对象整行不变/0模型；失败停线。

**退出：**AC02真链当前校验与原子可复用；首4h不能证明则报告最小新增需求，不做旧服务修补。

### Task 3: V03 · 新候选原子创建、当前读取与分页（4h）

**文件：**新adapter/contract、knowledge-session白名单、local-knowledge-ai装配、api/boundaries（分步≤5主文件）。**消费：**V02可信report/原Source；**产出：**spec §7 create/read/list。

- [x] RED `same_report_two_keys_one_root`、`same_key_changed_parent_conflict`、`create_audit_or_sources_failure_rolls_back`。独立PG连接同根不同key只一个Artifact/初始Version，成功回执可按键分别存在；同键跨操作/异输入409；故障注入未命中也强制事务abort。
- [x] 保留原withScope中official→tenant的排他pg_advisory_xact_lock及全事务生命周期，容量/回执不能在锁外判断。不新增锁平台或修改旧源码，原链不符则停线。实施接口核对发现`same_key_different_actions_serialized`须消费V04说明/派生接口，故与`different_roots_capacity_serialized`合并至V04退出前联合验证；不减少测试、不越过V05、不增加24＋8h预算。
- [x] 实现spec §5同tx源锁顺序（授权→父方案SHARE→记录包SHARE→run UPDATE→报告SHARE→候选父UPDATE）/服务端snapshot/Sources/请求回执，只锁不改源。增加`source_change_before_lock_rejected`与`source_writer_waits_for_snapshot_then_marks_stale`实际两连接反例；不能用同事务读取代替来源head互斥。当前读/列表精确owner/Study/prefix/marker，分页createdAt/id、limit+1、错误游标403，restricted不泄漏正文；无历史扫描。
- [x] `node scripts/crf-method-assets-api.mjs --mode local-synthetic --case create-read-list` Expected两账号新候选、实际Source/hash、幂等/越权/未知键/32KiB/分页通过；`node scripts/crf-method-assets-boundaries.mjs --mode local-synthetic --case atomic-create` Expected命中/未命中注入均0残留。只认新本片任务，不写旧候选。

**退出：**AC03，当前报告封装可用但不提前称A02交互/派生已完成。

### Task 4: V04 · 说明、版本与派生血缘（3h）

**文件：**contract/test、新adapter、api/boundaries（4）。**消费：**V03新block/receipt；**产出：**notes/history/derivations及current/stale/restricted。

- [x] 纯RED `notes_no_change_422_no_operation`、`parent_changed_back_still_stale`、`derive_eighth_is_last`：无变化不写成功key；子notes空/root snapshot不变；祖先v2即使文本回旧值仍使v1派生stale；第9层拒绝。
- [x] 最小实现`crfMethodAssetNotesOperation/deriveCrfMethodAssetLineage/crfMethodAssetSourceState`与原Version/Sources/Audit原子写。历史readOnly、root report head换版也stale，不只比较facts；同键已成功重试回实际operation，新版本/新notes同键409，容量满合法重试不新增。
- [x] `node --test scripts/crf-method-assets-contract.test.mjs` Expected GREEN；`node scripts/crf-method-assets-boundaries.mjs --mode local-synthetic --case notes-lineage` Expected独立连接CAS/祖先错根/环/30版/100份/8层/原子回滚通过。根报告换版仅用A04新具名报告，所有旧行摘要不变。

**退出：**AC05/AC06服务端部分；无附AI报告仍可正常封装/读取。

V03→V04接口裁决：本步退出前补`different_roots_capacity_serialized`、`same_key_different_actions_serialized`真实两连接测试及容量满合法重试；属于V03原定计数/回执验证随其依赖接口完成后联验，不扩大底座或测试权限。通过前不得进入V05或声称AC03/AC05完整通过。

### Task 5: V05 · S06报告封装入口、回链与A01列表（3h）

**文件：**session/test、新Workspace、S06 Report/Workspace、crf-methods-session与必要装配分流（逐小步≤5主文件）。**消费：**V03 API/原profile；**产出：**新路由/精确白名单/集中页头身份与列表。

- [x] session纯RED：`new_route_never_falls_back_to_legacy_or_demo`、`fixed_report_pair_and_run_required`，断言新旧混合/重复query/版本31/外域路径拒绝；合法回链原reportId/versionNo完整保留，不将报告版当run输入版。
- [x] 新显式A01/A02分流先于旧assetDrafts；补designIdentityMode/集中页头及唯一新Controller/32KiB notes/derive边界。旧族组件不改、默认母版不变。S06“形成我的方法资产候选”只对已读当前head且clean/有权限，重复点击与响应丢失保同键；新GET不覆盖未保存说明。
- [x] `node --test scripts/crf-method-assets-session.test.mjs` Expected GREEN；`node scripts/crf-method-assets-browser.mjs --mode local-synthetic --case entry-list` Expected两账号真实身份/S06创建→A01与超过20项分页/错误恢复/前序资产只读往返通过。不以demoStore创建冒充PG。

**退出：**AC07入口部分；关联S06过时提示只在本次触及处修正，别的旧文案不清扫。

### Task 6: V06 · A02复用准备、说明与历史（3h）

**文件：**新Detail/局部CSS、新Workspace、browser脚本（4）。**消费：**V04/V05、现有公共Card/Button/Markdown/fence；**产出：**配方/待确认条件与原历史报告分区、说明/CAS/历史/派生/固定版返回。

- [x] Chrome RED `dirty_conflict_keeps_original_CAS`、`slow_read_revoke_late200_restore_not_busy_forever`、`historical_link_opens_exact_report_not_latest`：真实409保留输入；慢GET已认证200在新scope失权后不得复活，恢复可重读；旧报告版明确只读不选最新。
- [x] 最小UI：原信息层级/字号、可展开技术hash、single-flight/身份对象fence，清私有状态时同步清busy/reading/ref；列表仅手动刷新，原始CAS不随dirty轮询推进，显式确认才弃改，unknown source不回示例。派生后新notes空，原AI标已复用消息而非新推理。
- [x] `node scripts/crf-method-assets-browser.mjs --mode local-synthetic --case detail` Expected两账号说明/历史/派生/返回、字体computed14/22与16/28、错误焦点/键盘通过；snapshot/results/源报告整行不变，无共享/导出/已应用按钮。

**退出：**AC07/AC08业务交互成立；不能仅截图固定模板称业务验收。

### Task 7: V07 · 全链、风险、布局与旧链保全（3h）

**文件：**api/boundaries/browser/free-gates/preservation与专项记录（验证脚本按同目的分case）。**消费：**V02–V06/A04；**产出：**两账号真实新候选链与失效反例、前序链只读保全。

- [x] `node scripts/crf-method-assets-boundaries.mjs --mode local-synthetic --case sources`：A04新包更正→旧新run/DQ/report正确stale，根报告notes换版/祖先改回不复活，真实Scope撤销/恢复与隔离原R02/R03报告链拒绝、失败不残留。仅新夹具可变；隔离原服务反例与公开浏览器scope反例分开，不冒称真实Role已更新。
- [x] `node scripts/crf-method-assets-browser.mjs --mode local-synthetic --case end-to-end`：两账号已有真实AI报告→本人新候选→notes/history/派生→固定报告回链；A04无AI新报告如实显示未请求。五视口1440/1366/1920/390/320、原生Chrome200%分别PNG/WebM，局部长标题/表格可达、单h1/标题层级/computed实测，退出与迟到GET不串身份。
- [x] `node scripts/crf-method-assets-free-gates.mjs --mode local-synthetic`：全部本机纯套件/既有编译内核、Hub构建、只读旧源/历史/原权限Schema/旧进程/账本整文件与原前缀、git diff --check；Expected全通过且0模型。基线302与1054为前序记录，最终以实际新计数，不预填测试成功。
- [x] 免费gates显式排除旧付费/会修改前序夹具的harness；scope/故障/费用共享状态测试串行，finally恢复精确字节。保留全部RED/初始失败/既有Node/chunk告警。API验证实际Source/事务与原run/report只读，不能只用Mock模拟。

**退出：**AC01–08及AC09测试保全部分，AC10用户未预运行材料另验；不以本片封装补称新AI/联网/正式Asset。

### Task 8: V08 · 唯一独立代码总评审与交接（2h＋按需缓冲）

**文件：**本片精确source/hash清单、技术/测试报告、产品living spec/changes/使用说明、根06版本记录及Notion。

- [x] 派唯一fresh只读代码总评审，按本片新增文件＋必要集成分支，不扫整脏分支；提供本spec/计划/Review Focus及主实现Ruling。当前文档评审不能算这一步，不派额外实现代理。
- [x] 主实现核对并重新定级；确认重要问题一次RED→GREEN修补/完整相关回归，Minor登记，原独立结论保留，不派第二评审或称作者复验为独立复签。超原缓冲/新增范围先确认。
- [x] 同步spec/product-baseline/product-changes/使用说明/根06版本记录/技术测试/Notion回读；四层各列证据。给本机入口/失败限制/凭据文件位置，不复制秘密；保持现有服务/旧系统不动，无提交推送/发布。
- [x] 交用户验AC10：能分清历史证据、软件复用配置与待重新确认项；不能代用户判断临床/方法学适用。下一完整WP08治理/跨Study/导出或其他AI切片须另确认，不自动扩开发。

## 编制阶段文档验收与批准点（以下为历史）

本轮只校验规格AC→A01–A04→V01–V08映射、真实接口/容量/签名、24＋8=32h、Markdown链接/证据与状态；做一次只读文档总评审、同步Notion并提交用户。未来脚本不存在不代表失败，未执行也不能称通过；不运行PG/模型/浏览器/服务。原WP07专业AC10未签，当前批准只对文档编制，不提前勾本计划实施步骤。
