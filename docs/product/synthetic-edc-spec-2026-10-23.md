# WP06首切片：合成EDC采集与更正闭环＋AI质控解释

## 2026-11-05 · 取消开发费用限制，统一业务Token规则

用户明确不再使用开发5/10元、累计任务/请求数、临时报价过期及目的付费开关。当前本机运行入口只复用原租户/账号Token额度、并发原子预留、实际用量结算及失败待对账；不增加额度、清理历史预留或绕过业务授权。页面布局不变、历史可读，旧账本/收据保留为历史，不再参与运行准入。现行费用以[AI统一业务Token规则](business-ai-quota-2026-11-05.md)为准，下方旧费用/次数/核价描述仅为当时记录；[本机验证](../testing/business-ai-quota-2026-11-05.md)区分代码、环境、实际执行和用户专业验收。

版本：V0.1，2026-10-23；实施状态更新2026-10-25。用户已批准规格、九步计划、M01–M03及随后公开核价/原累计5元内合成AI验证。C01–C09本机技术交接：唯一独立评审0确认Critical/5Important/2Minor，主实施者七项修补复验关闭，未独立复签；专业AC10待用户。累计75笔known、保守¥1.464417/¥5。当前证据见[本轮联调](../testing/synthetic-edc-c06-c09-2026-10-25.md)，下文较早费用待确认、未接通和评审中为阶段历史；不重复索要原授权，不开放新增权限、云、远端运行配置或真实发布。

## 2026-10-25批准与实施检查点

按用户本轮授权在当前目录串行实施，独立代码总评审保留C09；仅专用合成环境、原两个账号/当前Study/本人包及报告草稿。C01–C05已接通本人包、保存/完成/原因更正/历史和真实保存记录的确定性DQ，取得阶段单元/PG/API/Chrome证据，见[阶段报告](../testing/synthetic-edc-2026-10-25.md)。C06–C09未完成，C06付费调用及有效核价待确认，不能称AI解释/报告/完整WP06或专业验收通过。下面编制时“待批准/仅文档/尚未开始”为历史，不再重复索要M01–M03批准。未列新权限、云、远端配置或真实发布仍在操作前停下确认。

配套：[最小授权清单](../planning/synthetic-edc-2026-10-23/authorization-scope.md)、[九步计划](../planning/synthetic-edc-2026-10-23/implementation-plan.md)、[独立文档评审](../planning/synthetic-edc-2026-10-23/review.md)。上位：[产品基线](product-baseline.md)、[WP05执行准备](research-execution-preparation-spec-2026-10-23.md)、[倒排](../planning/phase1-review-2026-10-19/reverse-schedule.md)。规格整体已由用户批准；本片仍不代替专业数据/临床配置确认或付费许可。

## 1. 目标与实现取舍

把WP05已保存的配置转为**真实持久化的合成录入记录**，而非临时试填：确认配置版本→合成被试/访视→保存→完成合成录入→带原因更正→确定性质控→原科研Agent解释→可追溯报告草稿。形成主验收任务中“实际录入数据驱动质控”的可体验业务环节。

WP05第二切片本机技术验证完成，专业AX09仍待用户；本片不能代签。专业评阅可与规格核对同步，若反馈改变字段、缺失或更正语义，必须在绑定该版配置前解决。不要求临床数据来启动合成开发；正式采集仍需P03/P11模板及角色/治理确认。

### 路线比较与推荐

| 路线 | 代码事实与代价 | 结论 |
| --- | --- | --- |
| 直接接旧正式FormAssignment/FormResponse | 分发要求published/locked；提交会计分、已提交不能再写；fixture入口还绑定onboarding/独立PI。没有现成答卷revision关系 | 不绕过发布/PI/计分；本片不采用 |
| 新建正式EDC实体与更正/锁定模型 | 要新增共享迁移、授权、正式治理和新旧兼容验证 | 不符合本片4～5天与不扩底座约束；留正式EDC专项 |
| 独立合成演练记录包，复用原产物版本/来源/审计及纯校验 | 无新物理表；不修改父方案head；真实落库并保留历史，但不具备正式EDC治理 | **推荐**，明确仅合成演练；不是新建第二套正式EDC或已完成整个WP06 |

载体为既有`ResearchArtifact(typeKey='research_report',status='draft')`及其Version/Source，contentBlocks严格标识`rh-synthetic-edc.v1`。这里的report仅作合成记录包存储分类，不出现在正式研究数据/已发布成果中，不冒充FormResponse。新增业务写入范围必须单独获批；不开放通用research_report接口。未来正式EDC不默认沿用JSON包或自动迁移本片数据，须另规格确定与正式表单/更正模型的映射；可复用本片校验、交互与反例。

## 2. 范围、角色与禁止事项

- 仅专用合成库`wp01_test_full_baseline`，原灵枢心域合成租户、原两个已授权账号、当前合成Study技术范围及本人新具名记录包；管理员同样只走本人流程，不因此取得另一账号数据。
- 每包一版WP05配置、一份CRF，从该配置显式选择两个不同访视；3～5个由服务器生成的合成编号，共6～10张记录。非空CRF最多12字段，沿number/integer/text/select/boolean五类；不推断条件字段或实际临床适用性。
- 包内编号不写Subject/Participant/Enrollment/Visit等正式实体；不收集姓名、联系方式、病历、视频或任何真实患者信息。编号、访视均显示“合成”。
- 采集记录保存/完成/更正、确定性质控快照、按需AI说明及新报告草稿纳入；新资产派生、跨研究复用本片只回归旧链，不宣称新数据已接资产。

正式Study/Protocol/VisitPlan/FormTemplate/FormVersion/FormAssignment/FormResponse/Subject/Visit/ScaleResult/质量放行表**零写入**。不开放正式采集、审批/签署、锁定/解锁、共享、发布、下载/导出、删除、H5、随机化、盲态、计分、样本量或统计分析。不新增Worker/Skill/角色/DB表，不修改旧源码/Schema/RLS/Client，不恢复WP01 T03–T24，不重启旧服务/扫描历史任务、不操作临床库、云或远端配置。

## 3. 可复用路径及本片适配

| 现有代码 | 复用方式／限制 |
| --- | --- |
| 旧`app/server/src/study-operations/study-forms-policy.ts` | normalizeFormSchema/normalizeAndValidateAnswers纯契约；外层明确硬类型与软范围，不调用scoreFormResponse或正式提交Service |
| `scripts/local-research-plans.mjs` | withDraft/inDraft、withScope、当前来源和本人权限；父草稿只读，不给它追加答卷/AI元数据 |
| `research-execution-preparation-contract.mjs` | 严格配置、preparationCurrent、basis/hash及preview缺失真值表；绑定保存版而不是未保存编辑值 |
| 旧`research-artifacts.service.ts` | 受控事务内createWithSourcesInTx、createVersion、原CAS/Source复制/审计；内部入口装配失败就阻断，不改旧Service绕过 |
| `local-knowledge-ai.mjs`及原Queue/Orchestrator/KB/Provider | 新互斥payload分支和当前提交重验；同一科研Agent，无新模型/工具/权限默认开通 |
| `synthetic-quality-contract.mjs`、`local-synthetic-quality.mjs` | 复用hash/定位/原子结果与历史思路，旧8条固定夹具和Python链继续原样；动态CRF不强塞其manifest |
| `synthetic-report-contract.mjs`、`local-synthetic-reports.mjs` | 复用事实与人工说明分离、原产物版本/来源的模式；新facts schema与独立窄渲染/读取分支，不伪造run、seed或Python provenance |
| S03/S04/S05母版、WP05真实组件、共享Button | 列表→访视记录→问题/更正历史，合法显式真实分支；局部CSS和原Shell，不搬旧后台Shell |

本片DQ执行的是原表单纯函数＋本片确定性规则`synthetic-crf-dq.v1`，在本机服务内执行并保存真实输入/结果/hash。**不声称运行原Python质控、ResearchMethodRun或完整WP07**，不制造这些记录去骗旧报告门槛；不需要新增数值Skill授权。

## 4. 绑定、数据与版本契约

`CollectionBlock`严格包含：`type/schemaVersion/purpose/ownerAccountId/binding/config/selectedVisitKeys/subjects/records/dataRevision/quality/pending/operations/seal`，可选`lastChange`记录本次更正diff；purpose固定`synthetic_capture_rehearsal`。seal为去除seal本身后的完整块canonical JSON之UTF8 SHA256，未知字段拒绝。quality/pending初始null；config是冻结的完整已保存WP05配置；binding由服务器读取真实tenant/account/group/project/父artifact和会话/知识库，保存`parentRootVersionNo/preparationRevisionNo/configHash/picoConfirmationHash/sourcesHash`及WP05 basis。客户端不得提交scope/owner/作者/时间/完整配置。

新包要求来源current、PICO已确认、准备current、没有该父草稿在途任务、所选两访视存在且CRF非空；配置仍可含明确未决临床时间/单位，但页面必须展示“仅演练，配置待专业确认”，不能称临床可用。规则语义有重大未决项时停绑定；本片不赋予“批准配置”动作。

每个`Record`：服务器生成`recordId/syntheticSubjectKey/visitKey/formKey`，`status='draft'|'recorded'`、`responseRevision`、`answers`、`updatedBy/updatedAt`、可空`recordedBy/recordedAt`。初始responseRevision=0；每个字段使用`{state:'value',value}`或`{state:'missing'|'not_measured'|'not_applicable'}`。不存在字段归一missing；0与false绝不转缺失；value为null/空白、未知key/state、多余属性、非有限数值、错误类型/选择值均400不保存。text最多500个UTF-16字符，无HTML/代码执行。

版本分离：

- 包的`artifact.currentVersionNo`是所有写入的CAS；`dataRevision`仅在答案或录入状态真实改变时递增，`responseRevision`仅该记录改变时递增。
- 首次建包dataRevision=0；保存草稿/完成/更正追加原ArtifactVersion，之前版本不可覆盖；最后一次更正的diff记录在新版本metadata（recordId、字段前后state/value、原因、作者、时间）。旧版本承载完整历史，不在当前块无限累积所有旧答卷。
- 保存相同内容但新requestKey可追加元数据版本来记录幂等/审计，不推进dataRevision/responseRevision；同key同输入返回原操作引用及当前视图，不重复追加/扣费。同key异输入409；读旧成功请求仍先验当前授权，不能回传受限历史。
- `dataHash=SHA256(canonicalJSON({configHash,selectedVisitKeys,records}))`；records按recordId排序，仅取id/三键/responseRevision/status/answers；对象键递归排序，数组保留明确约定顺序。不含当前时间、AI状态或包根CAS。
- DQ/AI入队元数据不自我推进数据revision；更正即使把值改回也有新revision，旧质控/AI/报告不得复活。
- 每包最多128个持久操作；版本索引每页20、最多20，cursor绑定本人/包；单版读取正整数。每张答卷请求及其他POST原始JSON均最多32KiB；服务端生成包块最大256KiB，超过明确拒绝并回滚，不能截断。沿实际Controller大小写/尾斜杠别名执行同一限制。

## 5. 保存、完成、更正与事务

| 动作 | 允许对象 | 规则 |
| --- | --- | --- |
| 保存合成草稿 | draft | 严格结构/类型；缺失或有限越界值可以保留并显示待核对，不能因旧validator抛首错而丢原值 |
| 完成合成录入 | draft | 固定当前responseRevision；可带缺失/范围问题，但须显式确认该版问题hash；状态recorded仅表示本轮录入完成，**不是已审核、数据有效或可分析** |
| 更正记录 | recorded | 原因去首尾空白后8～500字符；填写修改值→展示diff→确认，生成新responseRevision；不得原地覆盖或解除锁定（本片无锁） |
| 再次质控 | 当前包 | 服务器从已保存记录重算；可以检查尚有draft的包，明确未完成覆盖，不声称全研究DQ |

“软范围”是本片演练决定：先以去除min/max的同字段schema调用旧纯validator验证类型/选项，再以完整schema验证并把OUT_OF_RANGE分类为质控问题；其他错误不可降级保存。必填与缺失沿WP05真值表；not_applicable不自动豁免必填。临床正式表单的硬范围/提交规则不改变，亦不能据此判断临床允许带错提交。

每个写入在原共同授权/知识当前读取事务里重验账号/authVersion/租户/Study成员/角色、本人父方案/当前来源、包归属与marker/seal、冻结绑定、根CAS及响应revision；原产物版本＋操作记录＋审计同事务提交，失败全部回滚。新包创建使用原tenant+idempotencyKey唯一约束，前缀`rh-edc-20261023:`并绑定owner/父方案/请求hash，竞争只返回同一包，不制造重复编号。

答案/状态变化后quality投影标stale，原结果留历史；来源撤审/失权时隐藏整包/历史/AI/报告，不泄露正文。父方案任何根版本变化或准备改版后包只读stale，不自动重绑、自动迁移答案或放开更正；研究者从新确认配置另建新包。原包不删除，历史仍受当前来源权限检验。

## 6. 确定性质控、AI与报告

DQ固定检查：D01必填缺失；D02显式人工范围越界；D03该访视表尚未完成合成录入。类型/未知字段在保存前硬拒绝并给字段定位。定位固定`recordId/subjectKey/visitKey/formKey/fieldKey`，D03为record级；不使用数组下标或任意对象路径。每字段最多一个值发现、每记录一个未完成发现，共最多130项，不能截断后称全量检查。

`QualitySnapshot`：服务器生成id、`basis={dataRevision,dataHash,configHash}`、rulesVersion、findings、findingsHash、checkedRecordCount/recordedRecordCount等确定性计数、作者/时间。findingId为规则＋稳定记录/字段键的canonical hash；每次质控保存一份不可覆盖快照到新包版本，旧版仍可读。输入/规则/结果可独立复算；不设有效率、疗效、临床严重度或研究放行。字段值/边界与数量全部由确定性代码显示。

用户选择1～6条真实findingId，显式请求“AI解释所选问题”；零问题不调用，超出选择上限需分批人工发起，未解释项仍可见。沿原科研Agent的KB工具实际核对原固定审核片段（最多6），不换资料、不扩全文/整库/联网，不新增Agent。模型只收到去数值化规则事实、技术定位、已确认研究意图和获准片段；不送原答卷数值，不让模型算分/推阈值/填答案；字段自由文本视为不可信数据。

原`assertAnswer`真实Provider/usage/工具/整体资料引用门槛保持。新严格JSON恰一顶层items数组、1～6项，每项恰含`findingId/explanation/question/sourceRefs`，explanation为非空字符串、question允许空串，非空时必须以问号结束，二者各最多600字符；findingId必须在本次选择中且唯一，sourceRefs为最多6个不重复的真实KB正整数编号。资料事实必须在叙述中含有效`[n]`，每项sourceRefs与该项叙述真实出现的编号集合一致；整体至少一处叙述引用，不把JSON数组中的数字误当有效引用。规则依据和记录依据单独列出，不用无关文献硬贴；未返回的选择标“本轮未解释”。科学数值和操作补丁拒绝，准确技术ID/合法引用由白名单豁免；沿WP05科学数字反例，模型不能写配置/答案/审批状态。原模型、JSON模式、maxTokens最多1536及累计预算守门不变。

payload新增`researchSyntheticEdc:{kind:'quality_explanation',binding}`，与原researchPlan/researchDesign/researchExecutionPreparation互斥；binding冻结parent/collection/owner/scope/session/kb、configHash、dataRevision/dataHash、qualityId/findingsHash及选中idsHash。同包至多一个queued/processing；旧会话串行策略不变，不扩大跨草稿互斥。入队同事务保存包pending/幂等/审计＋原job；完成沿原beforeAssistant最终授权事务重验全部binding、真实claim和来源，再原子保存assistant与job.completed。答案可在AI运行时更正，最终若不再匹配必须阻断旧结果交付；失败/重启不自动重放收费任务。

AI结果在不可变assistant的`provenance.researchSyntheticEdcResult={binding,qualityId,items}`中，GET只投影，不能在GET修复包或清理旧任务；job中断明确显示，显式新任务前核对旧费用。失效结果不作为当前AI显示；可访问的历史必须标过期，不能因相同数值或hash复活。

**原会话读取同样守门，不能只保护新包GET和最终提交。** 原`GET /sessions/:id/knowledge-state`及`GET /sessions/:id/knowledge-sources/:messageId/:index`遇到上述新provenance，必须在只读当前授权事务里校验本片scope、原账号/Study/Agent权限、真实本人父草稿/包/会话/知识库、冻结父版本/配置、dataRevision/dataHash、qualityId/findingsHash和当前来源。只有资料仍有效不代表EDC解释仍current；未知/损坏新provenance拒绝而非落回普通问答。原三类任务和普通问答行为保持。

新scope撤销、原授权失效或任一关联来源restricted时，knowledge-state对该解释只给安全受限占位，移除正文、items/绑定细节及关联来源；knowledge-sources拒绝交付。仅数据/父版本/DQ失效而仍有访问权时，两路均标`sourceStatus:'stale',historical:true`并明确“不是当前数据解释”，只能显式历史核对，不能标current；所读资料仍以原消息封存版本为准，不偷偷换新来源。关联队列状态中可见的该新任务结果/provenance也遵同一投影，不从另一字段泄露。先完成真实解释，再更正、换父版或撤销本片scope，从包页与原会话两路实际复验。此范围只加新kind分支，不扩为旧会话系统重构。

报告是显式新建`data_quality_report/draft`，facts schema=`rh-synthetic-edc-report.v1`，从真实包版本＋QualitySnapshot确定性组装配置/记录版本、修改原因/前后值、未解决问题、规则/输入/结果hash、相关资料及真实AI消息引用（如有）。只接受当前包/当前DQ；AI未执行/未解释/失败必须明示，不靠报告成功掩盖AI缺失。人工说明最多6000字符，与机器事实分离，修订追加原产物版本；创建/修订重验包、DQ及当前来源，报告版本不改采集包dataRevision。Source用真实`data_snapshot`关联包版本和规则快照及原知识Source，不伪造research_method_run；旧报告/资产路径不接收新schema冒充旧报告。

## 7. 本机接口契约（拟实现，不是已开放公共API）

前缀`/research-plan-drafts/:planId/synthetic-collections`；客户端沿同源Cookie/真实Study Scope和精确路径白名单，不信任query作为授权。所有POST带requestKey（8～128 ASCII字母数字下划线短横）；除建包外带baseVersionNo正整数，修改记录再带baseResponseRevision。返回统一`{collection,operation}`（写）或`CollectionView`（读），operation只含该动作id/版本引用，当前受限视图不给原答案。

| 方法/后缀 | 严格输入（除公共字段） | 结果 |
| --- | --- | --- |
| POST 空 | `{parentRootVersionNo,preparationRevisionNo,visitKeys,subjectCount}` | 创建新包/冻结配置/6～10条draft记录，初始无答案；不用客户端配置 |
| GET 空 | cursor可空、limit1～20 | 本人/父方案/marker限定的包摘要及nextCursor，不回传全部答案 |
| GET `/:id` | 无body，可选`versionsBefore`正整数 | 配置/记录/当前DQ/AI状态/历史索引；历史索引最多20项，`nextVersionCursor`用于显式加载更早索引，cursor须为本包真实版本。分current/stale/restricted；每记录附当前validation.findings/findingsHash供完成确认，GET只读计算 |
| GET `/:id/versions/:versionNo` | 无body | 指定包版本只读，仍重验当前授权/来源；不回退到最新版 |
| POST `/:id/records/:recordId/drafts` | `{baseResponseRevision,answers}` | 仅draft保存；类型错400，范围/缺失可保存并提示 |
| POST `/:id/records/:recordId/completions` | `{baseResponseRevision,acknowledgeFindingsHash}` | 当前已保存答案完成合成录入；hash与服务器当前record问题一致 |
| POST `/:id/records/:recordId/corrections` | `{baseResponseRevision,answers,reason}` | 仅recorded，更正/diff/新revision |
| POST `/:id/quality-snapshots` | 无额外字段 | 从当前保存值执行确定性DQ并封存快照 |
| POST `/:id/explanation-jobs` | `{qualityId,findingIds}` | 原Agent任务，先过明确费用/权限/报价门槛 |
| POST `/:id/report-drafts` | `{qualityId}` | 新报告草稿；幂等key存在包operations中；报告创建＋包操作元数据及审计同事务，不改变数据revision |

报告GET/版本/说明修订在同一前缀下`/:id/report-drafts/:reportId`、`/versions/:versionNo`、POST`/notes`（`{baseVersionNo,requestKey,notes}`；此baseVersionNo指报告根CAS，服务器同时取当前包/DQ重验）；不开放generic artifacts或旧run报告路由。旧方案/准备API不改变。错误沿现有`{code,message}`：400结构/类型/容量，401失会话，403越权，404当前可访问包下不存在版本，409绑定/CAS/状态/幂等/在途冲突，422完成确认hash不符，429费用门槛，503依赖不可用；不泄露内部路径/凭证/无权标题。

## 8. 页面与UI/UE

S11准备页新增“建立合成采集演练”入口；S03列表、S04单记录/更正历史、S05质控/AI解释及报告草稿承接真实分支。合法参数为`collectionId/researchPlanId/studyGroupId/researchProjectId`，S04再带recordId；列表建立入口使用显式`syntheticCapture=1`。拒绝重复/混合demo参数，真实标记优先于demo，不造新全局导航。Study/方案/包/记录链返回保留上下文，S11邀请入口不变。

### 8.1 C09并发/历史补充契约（不扩范围）

- 完成确认绑定当前已保存`responseRevision + findingsHash`；任一变化立即撤销确认，不能随轮询自动确认新答案；包元数据变化不代替答案确认。
- 记录包列表保留已加载分页，不自动轮询/焦点刷新第一页；用户显式刷新重新从第一页读取。详情保留自动刷新，分页与刷新共享单飞gate。
- 报告自动读取单飞；慢于5秒仍可成功应用，不被下次timer淘汰。切换报告/版本、保存和身份失效可淘汰旧响应；dirty说明和原CAS不推进。
- 包历史返回`historical/readOnly/currentVersion`；历史内容保持不可变，DQ/AI是否当前必须相对真实head判断。数据/DQ/在途任务变更后不复活；仅报告等元数据变化不使同一数据/DQ过期，但历史投影始终明确historical。
- 无变化notes新请求明确`422 EDC_REPORT_NO_CHANGE`，不返回成功operation、不新增版本、不消费key；已成功请求同key重放仍幂等，同key异输入409。
- 所有故障注入脚本在PG事务内部围栏：命中注入抛原异常，未命中也强制abort，绝不在提交后才依赖测试断言；仅本轮新具名包。

沿原S03/S04/S05母版与WP05真实组件；仅局部业务区接线，不重新设计公共Shell。科研/管理员均验本人创建→列表→详情→保存→更正→历史→质控→报告，管理员跨账号仍拒绝；G02不增加管理权限/全Study视图。后端权限与页面动作同步，不只隐藏按钮。

操作/输入/主要表格14/22，AI及报告连续阅读16/28、最大48rem，辅助13/20，版本元数据12/18；关键错误/风险不降脚注。共享Button、原Markdown安全渲染与图标体系，无远程字体/新组件库/全局CSS。主动作区分“保存合成草稿”“完成合成录入”“更正记录”“检查已保存数据”“AI解释所选问题”，不称批准/通过/锁定。

UE01–UE10逐项验收：首次不满屏报错；提交定位首错；范围问题与硬错误分开；网络/409保输入不推进编辑基准；改回原值不拦离开；保存成功解除dirty；切记录/版本有未保存确认；慢轮询single-flight且不抹编辑；失权/退出/撤审立即清空，迟到读写不恢复；完成/更正显示实际对象、差异与待核对问题；AI真实阶段/范围/失败可辨；模态Tab/Esc/焦点恢复，复制成功才反馈且绑定目标版本。宽表只在可操作容器滚动，不缩字或藏主要操作。

两账号覆盖1440×900、1366×768、1920×1200、390×844及320 CSS px，另验Chrome原生200%缩放，记录computed字号/行高、PNG/WebM与控制台/请求；不将视口/DPR当缩放，不外推全站无障碍或手机适配通过。

## 9. 验收与四层证据

| 编号 | 可判定标准 | 任务 |
| --- | --- | --- |
| AC01 | 两原账号各自新包保存/刷新/重新登录恢复，准确显示冻结配置/记录版本与合成标记；旧准备preview仍零持久化 | C01–C03/C08 |
| AC02 | 0/false/缺失真值表、3～5×2×1容量；类型/未知字段硬拒绝，有限越界原值真实保存并被标出，重要说明不误称放行 | C01/C03/C04/C05 |
| AC03 | recorded记录不能走draft覆盖；更正原因/前后值/作者/时间可查；双请求旧根CAS/旧responseRevision拒绝；事务注入失败无半截版本/审计 | C02/C04/C08 |
| AC04 | 预置必填缺失、范围越界、未完成表定位到实际录入；更正并重检只按真实值变化，输入/规则/hash可复算；旧固定8条夹具未冒充 | C05/C08 |
| AC05 | 新任务实际执行原KB工具/Agent/Provider；保存query、来源URL或文档/区间/hash、时间、usage、状态及产物，选中问题可追溯；未执行/未解释明确标出 | C06/C08 |
| AC06 | 在途更正/撤审/失权或父方案改版后不得交付旧assistant；已完成后更正/换父版/撤销本片scope，从包页及原knowledge-state/knowledge-sources读均标历史或隐藏，不把旧解释标current；重复key不加费，失败不自动重试，旧值改回不复活 | C04/C06/C08 |
| AC07 | 报告机器事实与当前保存包/DQ一致，来源能返回准确历史；说明追加版；旧schema/run/资产不被替换，未执行AI不被报告掩盖 | C07/C08 |
| AC08 | 两账号/跨账号拒绝、单元＋真实合成PG事务＋真实浏览器/五视口/原生200%/失败恢复与截图录屏；旧源/角色/正式表/旧服务/历史保全 | C01–C09 |
| AC09 | 一次实施后独立代码总评审及修补复测、产品/使用/技术/测试文档和Notion完整；不拿本轮文档评审替代 | C09 |
| AC10 | 用户用一组未预运行合成样例，判断录入、更正、问题定位/AI解释及报告能用于下一步科研工作，确认不误当正式采集或临床结论 | C09后用户验收 |

每项记通过/失败/未测及原因；代码实现→本机配置启用→真实请求执行→用户专业效果四层分列。本轮全部业务项未开始；当前只验文档。实际证据在实施时创建新的`docs/test/evidence/2026-10-23-researchhub-wp06-synthetic-edc/`（父仓库相对路径），不得覆盖旧包。

## 10. 授权、工期与交付风险

32小时实施/验证/文档＋8小时缓冲＝4～5个8小时工作日，等待用户/费用/专业确认另计；不默认周末加班。九步计划及每日核对见配套。若10月26日获批且无等待，10月29日为4天技术交接目标，10月30日为缓冲结束；不是用户已批准日期或专业签收承诺。

首半天C01核定本地复用/当前授权/包载体；无法在不改旧源、角色/Schema/正式业务状态的前提下实现，停下报告，不切换成新正式EDC。第2/4日复估，预计超过40小时或缓冲耗尽先确认。配置专业反馈如改变采集语义重新冻结，不用旧演练绕过。

最小授权M01–M03均待用户明确批准；只有编制文档的授权当前有效。AI阶段须明确本片调用许可＋有效公开核价＋原累计5元账本可用额度；原63笔保守¥1.246815仅历史基准，报价至2026-10-24T10:03:30Z，不能凭余额自动续价/续额。本轮不核价、不调用、不充值；可先做获批的无费用步骤，但AC05未实跑不能销项。

截至10月23日，10月26日至11月13日仅15个周一至周五。保留11/04主验收链及11/06全一期剩余量复估，11/09–13预留回归/专业验收/获准交付准备。正式EDC的PI审阅/锁解锁/导出、正式模板、其余AI入口/完整联网和目标发布仍有未证实工作量；本片不替代这些能力、不默认为二期，也不能保证全部一期按期。11月中旬目标不变，准确验收日仍待预约。
