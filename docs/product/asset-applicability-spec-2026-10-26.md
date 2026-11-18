# WP09首切片：本人科研资产适用性AI核对＋人工复用建议

## 2026-11-05 · 取消开发费用限制，统一业务Token规则

用户明确不再使用开发5/10元、累计任务/请求数、临时报价过期及目的付费开关。当前本机运行入口只复用原租户/账号Token额度、并发原子预留、实际用量结算及失败待对账；不增加额度、清理历史预留或绕过业务授权。页面布局不变、历史可读，旧账本/收据保留为历史，不再参与运行准入。现行费用以[AI统一业务Token规则](business-ai-quota-2026-11-05.md)为准，下方旧费用/次数/核价描述仅为当时记录；[本机验证](../testing/business-ai-quota-2026-11-05.md)区分代码、环境、实际执行和用户专业验收。

## 2026-10-28 本机 AI 验收更新（AC10待用户）

本机费用守门仅为WP09增加一份绑定原审批、前9次请求及前88笔账本的新报价凭据；累计上限20具名任务、12次实际Provider请求、5元，不重置失败或历史费用。原账本报价仍过期，其他AI模块继续拒绝新调用。仅原两合成账号、当前Study与本人本轮对象，未增加角色、正式治理或共享能力。详见[费用守门补充](../planning/asset-applicability-2026-10-26/acceptance-fee-guard-2026-10-28.md)。

管理员此前未运行过的U04合成资产与目标组合已新建本人核对记录并完成一次真实原科研Agent调用：实际`kb_search`读取原KnowledgeService/pgvector已审核资料，模型返回定性解释并由服务端核对来源。累计11任务、10实际请求、89笔known、¥1.931292/¥5，0未知/预留，付费开关已关闭；本次新增¥0.031734。真实Chrome验证新结果、来源、16px/28px阅读文字、桌面/移动布局和另一账号拒读。此为本机技术验收证据，用户专业AC10仍待本人确认，不称一期或生产交付；下方2026-10-26状态保留历史。

## K08当前技术交接（2026-10-26，AC10待用户）

K06界面、K07联调及K08唯一独立代码总评审的技术工作已完成；专业AC10尚未签署，不称完整WP09/AI-15、一期或生产验收。独立原结论为With fixes（0 Critical、4 Important、无新增Minor），原文保留；主实施逐项RED→GREEN修补，不冒称独立二次复签。修补涉及明确倍数/分数表述的输入/资料/输出边界、空访视映射未声明、依据选择跨轮询保留及同基准自检提示；回归另修复在途轮询误取消历史目标读取。只改本用途，不改旧内核/权限/共享底座。

最新证据：browser-5ce391ba两账号26项（含真实在途轮询）；browser-auth-0d9780ee两账号12项；browser-visual-c05c9683两账号原生Chrome200%/键盘/字体；browser-review-97b2ea20两账号11项（本人新记录两次显式意见保存，不增AI）；前序本轮flow-dc2290c7的22项真实PG/CAS/幂等/意见链仍保留，不盲重跑。review-readback-92bc6049读取32记录126版本，0摘要受影响、0历史改写，三份原始真实模型输出通过新严格契约免费回放。free-gates-dba74990：404纯测试、1054旧内核测试、构建/保全/空白全部通过；691旧源码、115表41128前序行、三旧scope和八旧进程不变。PNG/WebM、失败与原评审均留痕。

本轮0新Provider/费用；累计仍10job/9实际HTTP/88笔known/¥1.899558，paid=false、任务额度已满，不因余额自动续跑。只用专用合成库，七个本机服务就绪，不接临床库、不动旧服务、不发布。用户可先阅读已有结果并体验意见闭环；正式AC10的新合成AI任务须另确认。后续仍保留11/04、11/06全一期复估和11月中旬交付目标，不借本片销掉其余业务/AI/正式治理。

完整证据与AC10验收卡见本片实测文档，原评审与作者复验见planning同日目录code-review.md；61项最终源码摘要见implementation-k08-checkpoint.json。Notion同步状态以最终回读收据为准。下方K06/K07“待总评审”和更早停止点均为历史，不恢复旧任务。


## K08评审修补约束（2026-10-26，待验证）

唯一独立代码总评审提出四项Important（原文见planning同日目录code-review.md）。本用途统一拦截明确倍数/分数表述，覆盖模型输入、资料摘录和输出；空visitKeys不是已声明，仍保留0/false；未提交依据切换及确认跨轮询保留并参与离开保护，成功保存/明确放弃/对应失权才清除；同基准自检按已验证sourceRoot.planId与targetPlan.id判断，派生参考语义独立。修补不改旧内核/权限/前序行，不自动新增模型验证；先核对现存记录摘要是否受影响，若需历史改写则停下确认。本节只是修补规格，尚非完成声明。

## K06/K07本机界面与全链技术验证（2026-10-26，K08待总评审）

用户已明确继续K06及既定后续。A02新资产核对族接通：本人源候选/目标固定版本→六组逐子项声明规则→已有真实AI定性解释及typed来源→免费规则或明确AI依据的人工意见→分批提交/固定历史。原资产/目标只读，不套用或新建研究；本轮派生参考目标不冒称新PICO确认。原Q01不支持固定历史URL，故目标通过既有versions接口在本页只读核对，源候选保留原固定历史回链。

真实Chrome：browser-d72086b8两账号26组（五视口、已有真实AI/来源/固定历史及错路由拒绝）；browser-flows-dc2290c7两账号22组（新建、真实PG保存/CAS/响应丢失原键重试、读完整性/网络故障恢复、真实U02/U03撤销、AI依据显式切换/同消息分批意见）；browser-auth-03bf0b6a两账号12组（非首项/固定历史精确探针、在途撤销/迟到200、实际Cookie换账号和退出）；browser-visual-b6fa3363两账号原生Chrome200%/键盘，Reading16/28、输入及重要限制14/22。相关PNG/WebM和初始失败永久保留。已观察并修正：无AI历史误禁目标读取、通用演示提示、错误A01新族继承旧动作、成功HTTP探针未传播U02/U03撤销。移动截图先等既有侧栏动画结束；测试自身字段集disabled判定及异步选项等待问题不记产品修补。

本轮0新Provider/费用，仍10job/9实际HTTP/88笔known/累计¥1.899558；paid=false且10job已满，不借余下HTTP次数启动新任务。六笔已批Token对账已收尾；不续额/充值、不改角色/旧源码/旧scope/前序行/旧服务。完整免费门禁free-gates-99436190为399纯测试＋1054旧内核、构建/保全/空白通过（其后仅本片路由窄修，最终门禁待收口）。仅本机合成技术证据；K08唯一独立代码总评审与用户专业AC10未完成，不称WP09整片/完整AI-15/一期或生产验收。下方旧K05停止点/无UI等为历史，不再作为当前指令。

## K05技术验证与对账收尾完成（2026-10-26）

2026-10-26：K05技术验证及本轮对账收尾已完成。原owner/admin各成功一轮、未预运行通用新例成功；最后具名任务在真实Provider在途撤U03后以APPLICABILITY_SCOPE_RESTRICTED终止且0assistant。仅新purpose采用模型明确选sourceIds→后端严格校验/确定性引用渲染，回模后先重验当前授权、最终原子提交仍再验；旧内核/角色/科学数值规则不改。累计10job（3成功/7失败，含1笔Provider前Token额度拒绝）、9次真实HTTP，88笔费用全部known，累计¥1.899558/¥5；上限10job/12HTTP，原79笔和全部失败保留，不充值/续额/自动重试，paid=false且0在途。本轮6笔已知Token预留均按分别批准的范围，经既有合成平台管理员与旧BillingService完成真实用量对账，0新额度/权限/历史预留修改；最后2601 Token已结算，不再有本轮待对账项。最终394纯测试/1054旧内核、构建/保全/空白通过，SDD Task5已登记complete。仅K05技术范围通过，不等于WP09整片交接或专业验收：K06新UI/K07全链/K08唯一独立评审及专业AC10未完成，当前请求止于K05，不自动开始K06。现有两账号身份页Chrome回归不是新工作台浏览器验收；以下早期停止点/待批/旧上限均为历史。

## K05最小契约调整已批准（2026-10-26）

在原Agent返回后、解析模型输出前，先重新校验当前双端授权/固定依据及真实任务绑定；当前仍授权才继续严格解析，最终原子提交处仍再次校验。这样在途撤销与无效模型输出同时出现时，撤销应优先使本轮失效，不由解析错误掩盖。仅新purpose接线，不改旧内核/权限或科学数值规则。第8次真实请求的撤销测试实际先被17/15个来源超过12上限拒绝，未证明授权中断；下面的顺序修补只可先以免费真实PG回滚证明，后续用户已将实际请求上限批准为12；第9次实际请求的revoke-final已明确以APPLICABILITY_SCOPE_RESTRICTED终止且0assistant，原超限输出失败保留，不改写为成功。

用户明确批准仅新分支的“定性解释＋明确选择来源标识→后端严格校验并统一渲染引用”，替代模型同时生成正文引用与typed清单。仅模型输出接口改为`{items:[{ruleId,explanation,question,sourceIds}]}`；sourceIds只允许真实`A<n>`资产、`T<n>`目标、`K<n>`可用材料标识，每项1–12个、唯一、至少一个同组A/T；缺失/错组/越权/不存在/不可用来源仍拒绝，不自动选择、猜测或补造。模型正文不含方括号引用，避免二次来源通道；问题为空或真问句，原每段600字/数值/指令限制及1–6唯一分组保持。

后端先验证模型严格JSON和所选标识，按真实modelView转为现有sourceRefs并把对应引用统一渲染到解释末尾，再执行原`parseApplicabilityResult`完整闭合校验；这是已批准的确定性展示规则，不是修复无效模型JSON/来源。已存Message/state/source/人工意见/API结构仍用原typed规范，旧内核/科学数值守门/权限/前端不变。来源标识不作为科学数值，普通正文即使复用索引数字仍由原科学边界拒绝。前三次及配对尝试失败全部保留，0assistant；原累计4请求/¥1.715166，后续最多余4实际请求，10job/8HTTP/原¥5无续额。以下停止点为本次批准前历史，不代表调整已实现或K05已通过。

## K05续验当前停止点与待评审契约

2026-10-26 K05续验：用户已批准最多10个任务（含已失败任务），实际Provider HTTP累计仍最多8、原累计费用¥5且不充值/续额/自动重试。当前4个付费任务／4次HTTP均known但未交付AI回答，83笔费用记录累计¥1.715166，held/unknown为0；scope已恢复paidAiApproved=false。前三次缺行内引用/引用超限/问句不合格；第四次原始输出仍缺行内引用并含未定义pico分组，本次配对输入压缩又引入整数索引不被旧数值守门识别的兼容缺陷，不能归因于旧系统单方。原691源码、115表41128前序行、三旧scope/角色及旧服务保全；不改旧内核/权限/科学数值规则、不重置79笔原前缀或失败计数。连续修补失败后暂停付费，等待评审仅限新分支的输出契约调整：模型明确选择来源标识，后端严格验证后确定性渲染引用；这是待批准建议，不是已实施/模型成功。K05未通过，K06–K08、真实Chrome及专业AC10均未开始/未验。以下较早4/6任务待批、81笔及2失败等状态仅为历史。

当前2026-10-26：F01实际2job/2HTTP执行原检索/模型，但因引用缺失或超限拒绝，0回答交付；新增¥0.105894，累计¥1.624860/¥5，81笔known。消息投影/费用接线及免费提示修订已部分验证，真实开关已false；job总上限4→6仅待批建议，当前门禁仍4job/8HTTP。K05未完成，K06–K08/本片Chrome/专业AC10未做，不能称AI-15已可用。以[最新台账](../planning/asset-applicability-2026-10-26/implementation-progress.md)为准，以下为历史检查点。


最新2026-10-26：用户已批准有条件F01核价＋4job/8实际Provider请求（含失败），原累计¥5不增加；已完成官方人民币核价及保守尺寸/预留可行性检查。真实模型装配/执行、UI和K08尚未完成，不能据此称能力生效；现状以[最新台账](../planning/asset-applicability-2026-10-26/implementation-progress.md)为准。以下审批前检查点保留历史。

版本V0.1，2026-10-26，**规格、八步及U01–U04已获用户明确批准；K01–K04免费后端门禁通过，K05部分实现；F01核价/付费仍未批准**。[实施台账](../planning/asset-applicability-2026-10-26/implementation-progress.md)区分代码/配置/真实执行/专业验收。当前370纯测试/1054既有内核及构建/保全通过，0新模型/费用；K05实际模型/消息投影、K06页面与真实Chrome、K07/K08最终评审和专业AC10未完成。下文编制阶段“待批准/仅文档”保留历史，前序专业待验保持。

关联：[最小授权](../planning/asset-applicability-2026-10-26/authorization-scope.md)、[八步计划](../planning/asset-applicability-2026-10-26/implementation-plan.md)、[源码核对](../planning/asset-applicability-2026-10-26/findings.md)、[文档评审](../planning/asset-applicability-2026-10-26/review.md)、[AI专项AI-15](../planning/phase1-review-2026-10-19/ai-special-design.md)、[WP08](crf-method-assets-spec-2026-10-26.md)。

## 1. 意图、选择与假设

让原两个合成账号在当前Study选择**本人方法资产候选的固定版本＋本人目标方案草稿固定版本**，看清声明字段差异、AI解释的依据/覆盖/限制，再记录“作为参考／需修改／暂不采用”和理由。退出产物是新的私有核对记录，不是已应用的模板、正式Protocol或方法学认可。

已选A：复用旧科研Agent和原产物/来源/队列，在ResearchHub本机窄适配层增加独立核对记录；不改原资产和目标方案。B（正式共享、跨Study应用与审批）扩大权限和治理，排除；C（另造多Agent/通用适配平台）扩大底座，排除。没有新重大选型，不替换既有Accepted ADR。

拟定并提请整体确认的实施决定：

- “一致”仅指明确声明的同名字段逐值一致，不是临床适用/等效、可正式复用或疗效结论。自由文本不同只显示“声明不同，待人工核对”。
- 目标方案没有结构化入排标准或未有效绑定执行配置时，登记“未检查”，不从正文、量表名或旧报告猜出条件。人工意见不消除缺失或确定性差异。
- 人工处置只写本片新核对记录，不采纳patch、不预填/修改目标方案或CRF、不新建Study，不把“作为参考”叫“已复用”。
- 本片用原Agent的受控KB编排分支，不宣称补齐完整OpenCode、Search/Fetch、18项AI或完整AI-15跨Study能力。原数值只在程序表格展示，LLM不接收历史结果/原答卷或生成科学数量。

## 2. 范围、环境与停止线

只`wp01_test_full_baseline`、原两账号、当前tenant/group/researchProject（当前合成Study）、登记的本人源资产/目标草稿及本轮新对象。管理员也不能看另一账号。前序数据库行/会话/消息/任务、报告、方案和候选只读；不修改其内容、版本、审核状态或元数据做反例。

U01–U04授权拟允许本轮新核对记录、新独立会话及具名新夹具；旧A01–A04/R01–R03不自动覆盖，也不修改旧scope/角色。旧原生服务仍实时授权。任何旧app源码/Schema/Client/RLS/角色/Feature/Skill/Agent配置/Worker/依赖改动、跨Study/新主体/云/远端运行配置/旧服务/真实发布均停下确认。WP01 T03–T24继续暂停。

不做：正式采集、随机化/计分/样本量/新统计、通用模板应用、资产共享/审批/删除/锁库/发布/下载导出、自动改方案、跨账号/跨Study复用、全局Copilot/治理状态平台、联网或付费解析。原轻微UI事项不顺手扩为全站整理。

**准入止损：**K01前4h内证明同事务两端完整授权、独立会话及原数值防护可承接。不能满足只交缺口与工期影响，不改旧内核兜底。半天一期覆盖清点只登记B01–B09/AI-01–18四层证据和高优先阻断，不自动实现其他WP。

## 3. 复用路径与必要窄出口

| 现有来源 | 本片使用/最小增量 |
| --- | --- |
| `scripts/local-crf-method-assets.mjs` | 现有read会另开事务，不能直接在提交里嵌套。只增`inAsset(tx,user,id,versionNo)`：复用stored/view、原A01/A02、根/祖先/报告/Source完整性校验，返回可信固定版view及原生来源；不写原候选，不改变既有六方法。 |
| `scripts/local-research-plans.mjs` | 使用既有`withScope/inDraft`及原知识共同授权锁，读当前head、固定version/hash、PICO真实确认出处、当前资料。目标历史view不充当当前head；源/目标都在一个授权事务内验证。 |
| `scripts/local-crf-methods-ai.mjs` | 借鉴原Queue的onJobCreate/prepare/accept/validateTurn/projectMessage模式，**不调用其已耗尽WP07额度，也不改terminal run**。 |
| `scripts/local-knowledge-ai.mjs`、原Sessions/KnowledgeChatQueue/Orchestrator/KbTools/Provider | 在现有本机装配中串接新任务分支、真实kb_search、模型JSON/定性投影、消息和来源投影；旧五类分支回归。不得变成无工具纯文本接口。 |
| 原ResearchArtifact/Version/Source/Audit | 新核对记录typeKey=research_report、status=draft；原事务创建/追加版本与审计。无新表/队列/Worker，不用GET修复或写事实。 |
| A02、CrfMethodAssetDetail/Workspace、共享Card/Button/安全Markdown | 仅显式新子入口和局部核对组件；原资产/历史/说明/派生及旧族不重写。两账号同一能力边界。 |

内部契约（拟新增，非当前可用API）：

```js
assets.inAsset(tx, user, assetId, versionNo)
// => {asset, nativeSources}; 不另开tx，不写入，显式历史须原A02
loadApplicabilityBasis(tx, user, {assetId, assetVersionNo, targetPlanId, targetVersionNo})
// => {binding, assetView, targetView, nativeSources, sources}; 两端真父/当前授权/head/hash
compareApplicability(basis) // => {schema:'rh-asset-applicability-rules.v1', items, coverage}
buildApplicabilityModel(basis, rules, sources) // => 去数值定性输入，非完整basis
parseApplicabilityResult(text, trusted) // => {items}; 严格JSON、引用、数值/指令门禁
createAssetApplicability({root,ids,plans,assets,prisma,storage,load,require,budget,scope,ownPurposeInTx})
// => {Controller,create,list,read,saveOpinions,run,setQueue,onJobCreate,prepare,accept,validateTurn,projectMessage,readMessageSource}
```

## 4. 双端绑定与规则

新marker=`rh-asset-applicability.v1`，prefix=`rh-asset-applicability-20261026:`。不可变basis绑定tenant/group/project/owner、sourceAsset(id/version/versionId/contentHash/snapshotHash/全祖先head)、根报告/方法/数据/DQ实际源指纹、targetPlan(id/version/versionId/contentHash/confirmationHash/configHash)、两端资料版本/hash、rulesVersion/rulesHash；另绑定独立executionSessionId/kbId。hash使用现有edcDigest/canonical规则，不对JSON键序临时猜测。

创建要求两端都是本人当前有效head；历史仅回看，不以旧version和当时许可发起新核对。源资产原报告含AI时沿原条件R02，未含AI不因此误禁；新核对AI另需U03/F01。目标stage=protocol_draft，须保留真实PICO确认出处；派生测试目标另标`targetConfirmationStatus=derived_reference_only`，原确认只证明原方案，不能冒称本轮新目标已独立确认。其核对是待确认草稿分析而非执行准入；源和目标可以是同一源方案，但界面明确“同一基准自检，不证明迁移到新研究”。

首版固定六组规则，每组一个稳定ruleId：`question`（P/I/C/O声明逐项）、`eligibility`（原模型无结构字段则未检查）、`outcomes`（key/definition/unit）、`visits`（key/时点/窗口及缺失）、`crf_mapping`（字段类型/required/options/结局—访视映射）、`method_scope`（原executor/coverage和目标明确声明，未声明则未检查）。按两端稳定key的**并集**生成子项；同key才逐值比较，不按中文相似度配对。单侧缺key必须生成可见的not_checked子项；两端均无结构时生成一个明确缺结构子项，不能因空数组就全组一致。

每个子项状态为`declared_equal|declared_difference|not_checked`；**不产生组级单一状态或总体适用结论**，始终列全部子项及未检查覆盖，不能用组标题“一致”掩盖混合状态。逐值比较保留null≠0、false≠缺失、数字0、字符串/对象选项允许值。范围/单位/时间参数只由程序比较或展示，不作换算、临床推荐或LLM判断。每组可有子定位（最多32项/组），超限422，不静默截断；旧config各自容量保持原规格。目标executionPreparation只有basis/head仍有效时参与，否则对应配置组未检查，不能自动重绑。总体不输出“适用/不适用”、兼容分或通过率。golden必须含同组同时出现三种子状态。

## 5. 新核对记录、状态与原子性

每账号最多30记录，每条最多30版，列表20/页；基础快照≤1MiB、一个contentBlock≤1536KiB、Markdown≤512KiB；POST原始body≤32KiB。basis中的旧报告只保留必要版本引用，不复制完整历史报告正文/答卷/结果；程序显示比较所需原声明字段，机器事实与用户意见分离。旧源最多100候选/8层血缘等限制不变。

创建只提交四个引用字段和requestKey，服务端自取资料；新记录v1保存basis/rules、空opinions，**不写两端head或pending**。后续只有本片新记录v→v+1；使用原Artifact版本CAS。AI请求冻结recordVersion/basisHash/rulesHash/selectedSourcesHash/executionSessionId；任务payload=`researchAssetApplicability:{kind:'applicability',binding,requestHash,requestKey}`，与原五类意图严格互斥。

实施细化（2026-10-26）：原Artifact服务自行分配ID，而独立会话context必须含recordId。仅本机新purpose持久化调用预先分配UUID，并在该次原服务的researchArtifact.create参数内注入此ID（精确新marker/prefix校验、一次性、不允许命中既有ID）；随后原Service创建Version/Source并与新Session/审计/回执同事务提交。不先存半成品再改v1，不写前序行，不修改原Service/Schema。注入与会话任一失败必须全回滚，实际验证前不称兼容通过。

AI入队与本片记录pending/job/audit/操作回执在同一原授权事务。最终assistant与job终态沿原队列事务先validateTurn再提交；不回写来源、target或terminal方法run。AI结果保存在不可变Message.provenance，本片GET只投影；意见保存另追加记录版本，指向同一resultMessageId及baseRecordVersion，不修改assistant。

请求键8–128 ASCII字母数字/下划线/短横，按tenant/account跨本片动作统一审计回执。相同键相同输入返回原operation，不重复版本/入队/费用；同键异输入、跨动作/跨目标/跨来源409。成功但丢响应可同键重查/重试；先查回执再判容量/过期，但返回仍重验当前授权，不能因旧成功泄漏失权内容。decisions为1–6条、ruleId唯一（重复400）；理由1–1000字符，只允许六组ruleId和`reference|revise|decline`。同依据下按ruleId更新当前map，未提交的组保留；改已有决定/理由也只追加新版本，历史保留作者/时刻/旧值。当前map完全相同422不增版。

意见依据判别：resultMessageId=null则basisKind=rules；非null则basisKind=ai且须指向本record当前可用完成结果，服务器自取执行版。opinionHead固定{basisKind,basisHash,rulesHash,resultMessageId,executionRecordVersion,lastRecordVersion}，rules分支的resultMessageId和executionRecordVersion为null；lastRecordVersion两分支均为实际头版。AI分支要求精确消息/执行版。每次请求必须提交basisChangeConfirmed布尔值；首次/同依据用false。已有意见转换rules↔ai或不同AI消息时，未确认返回409且不写；UI明确告知旧意见仍可从历史查阅，确认true后在新版本以本次decisions建立新map，不把旧依据意见搬入。非切换却传true返回400。不强制AI成功才能记录免费规则意见，不能混用依据。

状态分列：job真实queued/processing/completed/failed/cancelled；sourceStatus=`current|stale|restricted`；AI=`not_requested|pending|current|failed|stale|unavailable`。同依据意见连续追加时lastRecordVersion随本片版本推进，不重验当前根版必须等于原AI执行版。本片请求新AI仅推进record版及lastRecordVersion，不偷偷切换已有意见依据；queued/processing禁止保存意见，完成/失败后原依据仍明确，选新AI意见须上述显式确认。来源或外部上下文变更中断旧链。旧版本始终只读。任一源/祖先/target或资料换版，即使内容改回，旧记录stale只读；401/403或源失权隐藏整个私有正文/差异/引用，恢复不自动重发写入/AI，不自动重绑。

锁顺序：沿原官方→tenant授权锁，再同scope账号串行锁；先源资产原lockOrigins顺序(plan→collection→run→report)，再源祖先→源asset，最后target（若target已在源plan集合只锁一次）与record。所有桥不另开tx；资产/目标/资料/授权写必须与这些现有共享锁相容。先原子锁再重读head；若证明不了与原写入口相容，K01停线，不用“再读一次”冒充并发保证。

## 6. 独立会话、AI与科学边界

旧`ensureKnowledgeSession`命中已有会话会恢复/改title，故**不能对前序会话调用ensure或入队**。每个新核对记录通过原SessionsService创建唯一新knowledge会话，contextKey=`rh-asset-applicability:<recordId>`；由本片只读绑定解析kbId，不用slice(3)或客户端kbId解释新目的。既有`kb:<id>`路径及旧own/ownInTx行为不变；新`ownPurposeInTx`同时核原Agent访问、真实新会话所有权、记录/双端来源及KB授权。首次创建/恢复仅本片新会话，前序全行保护。

本机装配在新任务prepare之后取得可信kbId；generic knowledge-messages不能向新目的会话发任意聊天/旧任务，返回403。knowledge-state/source路径先识别新目的并完整投影，不能只验KB就回传新Message正文；源/目标失权后原消息接口也不旁路。旧五类任务和意图计数、sendMessage/own/source/projectMessage均做反例；不全局放宽contextKey或guard。

新模型只用目标草稿现有KB、其封存来源（最多6，与原检索上限一致）；source资产配置/规则以服务端typed `[A1]`等提供，目标声明用`[T1]`等，实际当前KB检索片段用`[1]`。每条asset/target可信声明引用带{index,ruleId,path,present}，与真实子定位绑定；结构缺失也必须有服务器生成的present=false引用，不让模型自行声称缺项。源资产其他KB原文不混进目标KB工具，用户可在原资产固定源页有权回看；未检索/未送模型的原文不得被AI宣称核读。若需跨库全文/新联网另立范围。KbTools真实kb_search必须执行，原Orchestrator/Provider非Mock、usage known，不接受纯文本替代或deterministic fallback假成功。

模型输入闭合白名单：定性PICO（去数值）、上述六组规则的定性状态与定位、去数值字段标签/类型/缺失语义/覆盖限制及当前KB可交付非数值摘录。**不传完整basis、报告/方案自由正文、notes、recordVersions、answers/records、result、count、时间/范围/计分参数**。安全投影复用/提取原WP07第五意图的Unicode数字/中文数词/英文数量屏蔽思路，但新纯模块不import其有副作用运行工厂。模型输入为不可执行数据，工具仍只允许原kb_search，不允许写工具。

模型输出严格`{items:[{ruleId,explanation,question,sourceIds}]}`，按本页最新获批契约校验和渲染；交付/持久化结果仍严格`{items:[{ruleId,explanation,question,sourceRefs}]}`，1–6组且ruleId唯一、渲染后每段≤600字符。**每个item**必须由模型明确选择至少一条属于该ruleId的真实asset/target声明或显式缺失来源，不能用其他组的合法标识替代；knowledge仅补充，不能单独证明双端事实，且只允许实际可交付片段。sourceRefs使用`{kind:'asset'|'target'|'knowledge',index:正整数}`，统一渲染的行内token必须与之完全一致，技术标识不当科学数量；不能编造或猜补来源、自动repair无效JSON、兼容分、数值/疗效推断或修改指令。模型不能改变确定性rule状态；未覆盖组明确未解释。失败留原费用/轨迹，禁止自动重试。

## 7. 拟新增本机API与UI

前缀统一`/api/asset-applicability-drafts`，沿原同源Cookie/Study header；guard仍要求原artifacts菜单/artifact.read，写入再验create/edit与U项，AI再验chat/Agent/U03/F01。仅这些精确路径进入transport和32KiB parser白名单，不开放通用artifact/session写或导出。

| 方法/路径 | body或query | 返回 |
| --- | --- | --- |
| POST base | assetId,assetVersionNo,targetPlanId,targetVersionNo,requestKey | {record,operation:{id,recordId,versionNo}} |
| GET base | limit=1–20,before? | {items,nextCursor}，每项重验两端 |
| GET `/:id` | 无query | RecordView |
| GET `/:id/versions/:no` | no=1–30，无query | RecordView(readOnly=true) |
| POST `/:id/opinions` | baseVersionNo,resultMessageId(null或精确id),basisChangeConfirmed,decisions:[{ruleId,decision,reason}],requestKey | {record,operation} |
| POST `/:id/jobs` | baseVersionNo,basisHash,requestKey | {record,operation:{id,jobId}}，F01未批403，不派发 |

所有body/query拒未知/重复/混合字段。实际RecordView为{id,title,version,currentVersion,sourceStatus,readOnly,canOpinions,canReadHistory,canAi,basis,basisHash,rules,rulesHash,opinions,opinionHead,opinionHistory,opinionsUnavailable,contentMd,executionSessionId,kbId,versions,job,ai}；双端引用在basis.binding.sourceAsset/targetPlan，覆盖在rules.coverage，不另造assetRef/targetRef/actions字段。包含新会话ID只作精确读取引用，不作授权。400类型/未知字段，401未登录，403目的/实际权限失效，404不存在版本，409版本/来源/异输入键冲突，422无变化/无可用证据/结构超限/模型拒绝，429容量/额度，503服务暂不可用；沿原{code,message}输出，不暴露内部异常/凭证。GET不得以空列表掩盖403/失败。

入口保持A02：源候选选择“核对复用条件”→选本人目标草稿→确认固定双端版本→创建新核对记录→按需请求AI→人工记录意见→固定版回链。新增query族`assetApplicability=1`及`applicabilityId`、可选`applicabilityVersion`；scope参数沿当前两Study标识，不与旧crfMethodAssets/assetDrafts/researchPlanId族混合，任一新标记无效不回退demo。原A01/A02/S07入口只增具名局部链接与返回上下文，不复制Shell或改全局导航。

UI/UE：A02原母版、共享Card/Button/安全Markdown；一个h1/逐级标题；声明对比14/22、AI长文16/28/48rem、说明13/20、短元信息12/18。左右源/目标折为窄屏上下顺序，不缩字体；差异/未检查/限制不藏tooltip。加载、无目标、未配置AI、来源过期/失权、服务失败各自明确。read health与mutation CAS错误分离：完整性失败隐藏不可信内容，临时读失败标上次读取且禁写，保允许保留的dirty/CAS/key，成功重验才恢复；精确探针绑定当前record/当前或历史版及两端，不用列表首项授权代替当前目标。切目标/身份失效代次，403清内容并释放busy/reading，迟到200不得复活；意见dirty单飞刷新不暗推CAS，真实保存后才提示成功，导航/放弃保护不阻止退出账号。

## 8. 授权、测试与验收

U01–U04是本片目的范围，F01是独立费用许可，完整见清单；缺任一不初始化补权。当前没有scope文件、审计或fixture启用；本稿并不批准新权限。原5元累计上限不重置，不核价、不充值、不自动续额。

| 标准 | 最小证据/任务 |
| --- | --- |
| AC01 双端当前绑定 | 两账号本人真实资产/目标、版本/hash/原生来源；错父/跨人/跨Study拒绝，源和target版本分别变化不得混用（K01/K02/K07） |
| AC02 差异可靠 | 完整手核golden覆盖六组、声明相同/差异/未检查、null/0/false、缺映射、混合options、配置stale；不临床推断（K01/K03） |
| AC03 只写新对象 | 旧源/目标/32表前序全部行/旧scope/角色/旧服务与账本前缀保全；独立新会话不触旧行（K01/K02/K07） |
| AC04 原子与幂等 | 真PG双连接、跨根容量、CAS、不同动作同key、故障命中及全回滚、丢响应同key只一次效果（K03/K04/K07） |
| AC05 原Agent真实执行 | 两账号真实成功、第三未预运行通用合成例、实际kb_search/Provider/usage/来源；在途失权无assistant交付；付费次数须F01（K05/K07） |
| AC06 科学与引用 | 输入/输出数字、中英数词/Unicode、假来源、JSON/提示注入、不支持范围全部拒绝/未检查；历史结果无泄入，模型不能改rules（K01/K05） |
| AC07 人工处置与历史 | 免费规则意见/AI意见明确区分，同结果分批意见续接，真实冲突保输入，无变化422、固定历史只读（K04/K06） |
| AC08 当前授权及失效 | 新purpose细分U02/U03撤销、目标/源单独失权、会话旁路、迟到200、恢复不自动重跑；旧scope副本反例与真scope撤销分列（K02/K05/K07） |
| AC09 UI/文档与总评审 | 两账号Chrome完整任务、五视口1440/1366/1920/390/320、原生200%、键盘/失败恢复、computed字号、PNG/WebM；一次代码总评审及文档/Notion（K06–K08） |
| AC10 用户专业效果 | 用户用未预运行合成材料判断依据清楚、差异有帮助、知道不能直接套用；技术断言不代签，不预设效率/准确率提升（K08用户） |

每项永久分“代码实现／本机配置启用／真实请求实际执行／业务结果用户确认”。F01未批或模型/工具失败则AC05未通过或阻断，不能靠免费步骤称整片交付；真实target版本失效测试必须只改U04新目标，不能改前序样例。只读doc阶段不运行这些测试或截图，不将旧证据当本片结果。

## 9. 工期、交接与待确认

24h实施/验证/文档＋8h缓冲＝3天＋1天，八步见计划；K01含前半天覆盖清点/复用止损，不另开长期审计。若10/27批准且输入/费用许可及时，10/27–29实施、10/30缓冲是条件窗口；等待专业/付费许可另列，不默认周末。11/04全一期缺口/A0预演、11/06范围/日期复估、11/09–13冻结/专业回归与2026年11月中旬目标保持，不保证全量一期已能容纳，也不将已承诺能力自动改二期。

本轮提交确认：规格和八步、U01–U04边界（尤其独立新会话及新具名夹具）。F01核价/模型调用在实施到K05前再次确认；未批准不核价/派发。AI是否真正有科研价值由用户AC10验收。使用手册/旧系统版本记录只在未来能力实际变化后更新，本次仅标规划提案。
