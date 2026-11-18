# WP05研究设计工作台与AI辅助方案完善小步实施计划

## 最新交接：WP05首切片本机技术验证与评审修补完成

T01–T09真实实施验证及T10唯一一次独立代码总评审已完成；3项Important、2项Minor均由主实现核对修补复测，无第二次独立签认。最终190/190相关测试、1054/1054既有编译内核、构建及25项综合门禁通过（gates-6d67fff7），含两角色新材料全链各9项、实际在途来源撤审、五视口/原生200%、慢轮询及复制晚到反例。完整证据与用户专业体验A09见[最终实测报告](../../testing/research-design-workbench-2026-10-23.md)。

交接仅指本机合成技术能力，不是用户专业验收、完整WP05/一期或生产交付。累计52笔均known，保守¥0.984879/¥5，原33笔与旧源/旧服务/历史对象保持；无新权限、Schema、充值、自动续额或云/远端配置/发布。报价至2026-10-24 14:12:50北京时间，过期/费用未明停新调用。本次收尾不再调用模型。下一检查点为用户体验核对，不自动扩大业务范围；2026年11月中旬总体目标仍须逐片复估。

以下按阶段保留原记录；旧段落的“评审中/待批准/186项/22门禁”均为当时历史，当前结论以上段及最终报告为准。

## 2026-10-23执行检查点

T01–T09已完成限定本机技术验证，T10唯一一次独立代码总评审进行中；详细状态以[任务台账](task_plan.md)、[实施进度](progress.md)及[最新实测报告](../../testing/research-design-workbench-2026-10-23.md)为准。下方逐项为已批准的原实施检查清单，保留原顺序与工时，不用名义勾数冒充专业完成比例。新增e2e脚本与固定query/紧凑列表/技术ID澄清已记录于findings及规格；原失败保留，累计费用¥0.984879/¥5，不新增底座/权限。

> 2026-10-23用户已批准规格及本十步计划，使用superpowers:executing-plans逐项执行。主代理在当前目录串行实施＋一次独立总评审，不派并行实现代理、不创建worktree、不重复询问执行方式。各任务状态以task_plan/progress为准；批准不续费/续价或扩权。

**Goal：**在既有合成Study内，使本人方案草稿从列表继续，经证据核对、AI逐节建议及人工决策形成可追溯新版本，并接续已有合成DQ/报告/资产。

**Architecture：**以原ResearchArtifact/Version/Source、Sessions/KnowledgeChatQueue、科研Orchestrator KB分支和共同授权事务为唯一运行底座。ResearchHub新建薄设计模块和页面真实分支，保留原PICO/方案/下游契约，不改旧系统源码、模型或角色。

**Tech Stack：**现有React18/Vite/JS及复用TS UI、NestJS/Prisma/PG、原DeepSeekProvider、原TS/Python确定性合成DQ；不新增依赖/服务。

**Spec：**[实施规格V0.1](../../product/research-design-workbench-spec-2026-10-23.md)。日期2026-10-23；规格与本计划已由用户明确批准，费用及有效报价仍须独立检查。

## 全局约束

- 仅专用合成库`wp01_test_full_baseline`、原两个已授权合成账号、当前合成Study和本人草稿；注册/邀请不增AI或写授权。
- 不改旧业务源码/Schema/迁移/RLS/角色/旧Client，不扫历史任务/临床库，不重启旧服务；T03–T24暂停。
- 不开放正式立项、审批、锁库、共享、发布、导出、跨账号评阅；不重写Agent/队列/计费，不做完整联网检索。
- sources最多6，evidence最多12行，建议最多7条；正文24000字符（沿原UTF-16 length）；design/jobs 32KiB、design两类decisions各128KiB、原正文versions 192KiB，历史版本正整数最多6位、原操作上限64次、分页1–30，未知字段/重复ID拒绝。
- design是原根块的可选字段，保留旧marker/seal；旧任务stage不改，新payload用researchDesign.kind，不允许同时researchPlan和researchDesign。
- 所有写操作CAS/幂等/当前授权/真实父对象/来源重验；模型只读，科学数值不生成，人工确认不等于审批。
- 字号操作14/22、Reading16/28且48rem上限、辅助13/20、元信息12/18；Frozen Shell/五导航/Token不改。
- 先RED→最小实现→GREEN→真实合成集成/浏览器→文档。沿用户当前脏目录，仅记录限定文件/hash检查点，不自动git add/commit/push/reset/stash。
- 原5元累计账本不重置/续额。付费前需已有明确费用授权且有效报价；报价到期/未知扣费停线，不修改报价截止日期。新增费用/权限/云/远端配置/发布先确认。

## 评审重点及其测试归属

1. 旧demo标记/混合query、未登录或迟到响应不能把真实工作台切回演示或串对象：T02 route-generation、T09 browser-route。
2. 资料仅6片段，含反例和未报告项，不冒称全文/整库，不让排除证据进入方案：T03 source-coverage、T04 decision-pruning、T05 candidate-binding。
3. 旧无design草稿、PICO重确认、手工正文修订导致旧建议失效，不覆盖dirty/CAS：T01 legacy-schema、T06 stale-adoption、T07 history-refresh。
4. AI实际运行中撤审/撤权/版本变化/预算未知不能交付旧结果或重扣费：T03/T05 publication-fence、T09 in-flight/unknown-budget。
5. 新版方案不能沿用旧报告/资产数值或静默重绑，且长来源/200%无操作丢失：T08 lineage、T09 typography/zoom。

## 工期与检查点

| 任务 | 小交付 | 小时 | 依赖 |
| --- | --- | ---: | --- |
| T01 | 增量契约及旧版本兼容证明 | 2 | 用户批准 |
| T02 | 真实本人草稿工作台纵向接通 | 3 | T01 |
| T03 | 固定资料→真实AI证据表候选 | 4 | T01/T02及费用门槛 |
| T04 | 人工证据处置原子保存 | 4 | T03 |
| T05 | 证据/PICO/正文→真实逐节建议 | 4 | T04及费用门槛 |
| T06 | 采纳/修改/拒绝→新草稿版本 | 4 | T05 |
| T07 | 历史读取、差异及手工编辑失效规则 | 4 | T06 |
| T08 | 新版→已有合成DQ/报告/资产回归 | 3 | T07 |
| T09 | 两角色端到端、安全/交互浏览器 | 4 | T08 |
| T10 | 独立总评审、修补复测与文档交接 | 4 | T09 |
| 缓冲 | 上述任务的缺陷/评审返工，不添功能 | 4 | 按需 |
| 合计 | 36小时实施＋4小时缓冲 | **40** | 5个8小时工作日 |

第1天完成T01/T02并验证T03关键队列/来源绑定可行性（T01–T03共9小时，T03完整交付在第2天）；核对当前maxTokens<=1536能否承载紧凑样例，不改报价/模型/输出上限。第3天检查T05真实AI和T06闭环，未通过当天报剩余量/阻断。第5天目标交本片；4日仅是顺利复用的争取值，不压缩测试。若10月26日批准并开始且无等待，目标10月30日；不安排默认周末加班。

费用/专业反馈/环境故障等待不算有效实施工时，也不能隐藏对日期的影响。预计超过40小时即复估，不能自动延长或回到共享底座；11月中旬全项目交付风险仍需逐片复估。

## 文件与接口分工

下列为**实施时拟创建/修改**，目前只有文档存在；不把计划路径当现有能力。

| 文件（相对ResearchHub） | 单一职责 |
| --- | --- |
| 新`scripts/research-design-contract.mjs`及`.test.mjs` | design块、证据/建议边界校验、绑定/决策hash/追加正文纯函数 |
| 新`scripts/local-research-design.mjs` | 本人设计API、原事务/队列钩子、原产物版本写入，不实现第二套Worker |
| 改`scripts/local-research-plans.mjs` | 列表可选摘要/历史读取、手工版本失效；保留withScope/withDraft/inDraft和旧接口 |
| 改`scripts/local-knowledge-ai.mjs` | 装配新Controller，组合原队列create/prepare/prompt/accept/validate提交钩子 |
| 新`src/research-design-session.js`及`tests/research-design-session.test.mjs` | 路由/真实分支、请求代次、dirty与版本绑定、逐行diff纯函数 |
| 改`src/knowledge-session.js` | 仅放行规格7中的精确新路径，沿原Cookie/scope及错误语义 |
| 新`pages/shared/ResearchDesignWorkspace.jsx` | Q02本人列表及S07设计区域装配，复用原组件 |
| 新`pages/shared/ResearchDesignEvidence.jsx`、`ResearchDesignSuggestions.jsx` | 证据定位/处置、逐节建议/采纳表单与原文阅读，不复制Shell |
| 新`pages/shared/research-design.css` | 真实分支局部排版、响应式，引用现有Tokens |
| 改`pages/shared/workflow-main.jsx`、`ResearchPlanFlow.jsx` | Q02/S07真实分支与Q01进入/返回，旧演示/下游保持 |
| 改`src/knowledge-reuse/pages/knowledge/KbAgentPanel.tsx`、`src/platform-shell.js` | K01入口及Q02/S07真实页头映射；不改全局尺寸/身份 |
| 新`scripts/research-design-api.mjs`、`research-design-browser.mjs`、`research-design-boundaries.mjs`、`research-design-gates.mjs` | 本轮新夹具/API竞争/真实浏览器/验证编排，不复用历史任务ID |

引用旧源码仅限`app/server/src`已有知识/科研/产物/授权服务。若以上薄适配无法支持，不把内部入口升级成旧系统重构，停在复用缺口说明。

### 共享类型约定

`DesignView={version,contentHash,confirmation,sourceStatus,coverage,evidence,suggestions,decisions,job}`；restricted仅安全状态，无正文/引用/历史内容。证据行/建议字段及上限以规格5为准；`sourceId/rowId/suggestionId`服务器生成/验证，外部不能自报owner/scope/hash/作者。建议有明确kind=evidence_based|gap，baseContentHash为整个基础正文hash；七节未输出时显示未评估，不能静态补成功。结果适用性/入队v+1/处置revision/adoptionHead按规格6表执行。

`createLocalResearchDesign({plans,prisma,storage,load,require,budget,own}) -> {Controller,setQueue,onJobCreate,prepare,prompt,accept,validateTurn}`；onJobCreate采用现有`(tx,args,next)`签名，prepare采用`(user,jobId)`，prompt/accept/validateTurn分别`(turn)/(result,turn)/(tx,turn)`。未绑定设计任务返回null/空提示/不修改结果，未知/双绑定拒绝。队列实例由现有setQueue注入。

纯函数固定命名：`parseEvidenceCandidate(text,sources)`、`normalizeEvidenceDecisions(input,evidence)`、`parseDesignSuggestions(text,binding,evidence)`、`assertDesignBinding(binding,current)`、`applyDesignDecisions(contentMd,suggestions,decisions)`。前端纯函数：`isResearchDesignRoute(pageId,search,configured)`、`makeDesignWorkspaceUrl(pageId,scope,planId?)`、`diffDesignLines(before,after)`。不导出可绕过授权的通用写库函数。

## 本轮实施检查点（2026-10-23）

T01/T02已实施并在本机合成环境验证，见[实测报告](../../testing/research-design-workbench-2026-10-23.md)。T03–T10尚未完成；T03真实AI前原报价已过期，需确认核价及原累计5元范围调用，不自动续价/续额。原36＋4小时估计保留，等待确认时间单独记，不虚报完整切片完成。

## T01 增量契约与旧版本兼容（2小时）

**Files：**新`scripts/research-design-contract.mjs`及`.test.mjs`；读`research-plan-contract.mjs`和原产物版本契约。**产出：**以上5个纯函数的输入输出校验，design可缺省，旧marker不变。

- [x] 写`legacy-block-without-design`、`reject-source7-row13-suggestion8`、`reject-unknown-fields-and-double-binding`失败测试；断言原块无design仍可读、来源编号/引用区间/hash越界拒绝，中文/emoji/转义正文及多条修改后采纳按分接口字节上限不误拒/不截断；确定性待办派生不由模型填写。
- [x] `node --test scripts/research-design-contract.test.mjs`得到行为RED；缺依赖/语法/文件缺失不算充分的RED，先最小空实现确认断言失败。
- [x] 只实现边界/来源绑定/字符区间与确定性hash；不写DB或调用模型。原数值字符串子串匹配不作为新证据正确性依据。
- [x] 同命令GREEN，并跑`node --test scripts/research-plan-contract.test.mjs`；记录旧草稿兼容/无隐式迁移。

## T02 本人真实工作台（3小时）

**Files：**改`local-research-plans.mjs`、`workflow-main.jsx`；新`ResearchDesignWorkspace.jsx`、`src/research-design-session.js`及对应test。**消费：**原本人列表/当前scope。**产出：**原列表增加可选摘要，Q02真实分支、合法继续URL。

- [x] route-generation测试断言：`designWorkspace=1`优先于demo标记；无登录/无scope、混合demo项目ID拒绝；不同账号/草稿的迟到响应不覆盖；分页cursor跨scope拒绝。
- [x] `node --test tests/research-design-session.test.mjs` RED后最小实现；在列表API仍逐对象重验来源，不扫全库，不创建正式Project。
- [x] 同命令GREEN；新`scripts/research-design-api.mjs --case list`验证本人服务端列表/刷新、另一账号403和新注册/只读拒绝。API脚本实现归入本任务，不计为已经存在。
- [x] 沿现有真实Chrome工具完成Q02→原Q01继续的两角色烟测，保存本轮截图；若无授权启用本轮新夹具则停，不借历史写权限。

检查点：列表不是demo、未改权限/旧源码、T01兼容绿。保留受控源码/hash及原服务/账本/冻结证据摘要；不跑会改历史夹具的native all/reset。

## T03 固定资料到证据表（4小时）

**Files：**新`local-research-design.mjs`、`research-design-api.mjs`；改`local-knowledge-ai.mjs`；扩展contract及test。**消费：**原plans.withScope/withDraft/inDraft、原queue、固定6片段。**产出：**GET design、POST design/jobs(kind=evidence)、真实候选结果及工具轨迹。

- [ ] source-coverage/publication-fence反例：固定集缺一项、伪quote区间/hash、source越权、工具未执行、模型结构/科学数字违规、运行中来源变化均不能交付；预算未知不再入队。RED命令仍为contract套件。
- [ ] 最小装配`createLocalResearchDesign`；请求baseVersionNo=v，在原事务追加pending为v+1，executionVersionNo绑定v+1；prepare/prompt/accept/validateTurn通过原队列/assistant最终提交链执行。新payload与旧researchPlan不得双占。增加enqueue-v-plus-one测试证明不会把合法任务误判过期。
- [ ] 同命令GREEN；`node scripts/research-design-api.mjs --case evidence`在专用合成库验证原子入队/结果绑定；故障注入结果明确标注，不冒称真实模型成功。
- [ ] 只有费用/有效报价门槛满足才执行第一笔实际Agent证据整理；记录来源、query、job/message、模型/工具与费用。未满足标A04阻断，继续无费用任务，不自动续价/续额。

## T04 人工证据处置（4小时）

**Files：**改`local-research-design.mjs`、contract及test；新`ResearchDesignEvidence.jsx`；改Workspace挂载。**消费：**当前evidence resultMessageId/rowIds。**产出：**POST evidence-decisions及处置视图，原子新增版本。

- [ ] decision-pruning RED：排除/背景/待核验无理由拒绝、重复rowId/他人message/旧版本409、同键异输入409；同键重放不重复版本/审计；同一成功结果保存后以当前CAS再次处置可用且零模型/零检索；处置改回原值revision仍增加、旧建议不可复活。
- [ ] `normalizeEvidenceDecisions`及API只接受当前成功结果中的行；原产物Service与审计在共同授权事务写入，original source IDs不改。
- [ ] 单元GREEN；`node scripts/research-design-api.mjs --case evidence-decisions`测试独立请求并发与失败回滚，不在原账号上提交撤权/恢复。
- [ ] 浏览器展开原文、选择四类处置/理由、失败保输入/聚焦首错、保存后刷新同版本；科管各本人流程，不扩为协作审核。

## T05 基于证据的逐节建议（4小时）

**Files：**改contract及test、`local-research-design.mjs`、`local-knowledge-ai.mjs`；新`ResearchDesignSuggestions.jsx`。**消费：**确认PICO、方案正文hash、当前纳入证据/处置hash。**产出：**kind=refine任务、最多七条结构化建议及gap。

- [ ] candidate-binding RED：无include不能生成；exclude/needs_verification不能支持建议且原文不入模型正文、background仅背景；伪sectionKey/外来rowId/PICO冲突/科学数字候选拒绝；gap只能问题、伪kind拒绝、baseContentHash绑定整份正文；未报告项不得变成已证实疗效。
- [ ] 最小提示/结果解析和固定来源检索；不自动替换正文、不开放新工具。任何来源/正文/PICO/处置在途变化都使结果不能作为当前候选。
- [ ] contract GREEN；`node scripts/research-design-api.mjs --case refine`通过真队列/PG验证绑定和最终提交栅栏；显式保存正反结果。
- [ ] 费用门槛满足后真实Agent以紧凑输出完成逐节建议，在Chrome核对输入/来源/七节未知项；没有输出的节显示未评估。现有1536 token预算不足列阻断，不自动加长/拆分重试；保留失败计费，门槛不满足不宣称通过A04或“AI上线”。

检查点：至少原一账号真Agent“证据→人工处置→逐节建议”成立，技术与专业状态分开；否则第3天复估，不把Mock或API200当效果通过。

## T06 人工采纳、拒绝与新版本（4小时）

**Files：**改contract及test、`local-research-design.mjs`、`ResearchDesignSuggestions.jsx`；扩展客户端test。**消费：**当前成功建议、resultMessageId、基础正文hash。**产出：**POST design/decisions，确定性追加修订段和原子审计。

- [ ] stale-adoption RED：旧结果/外来建议/重复ID/正文已变/PICO重确认/撤审拒绝，拒绝无理由或edit_accept空白拒绝；追加超24000字符不截断，CAS冲突不丢输入；先采纳一条保存，再按当前CAS处理剩余项可用，已终结项不能重复追加；并发仅一方成功、手工改正文后剩余旧建议409。
- [ ] `applyDesignDecisions`仅追加具名修订段，保留原自由正文；未决项不采纳、相同决策不重复追加。同事务保存decision、正文/来源及adoptionHeadContentHash/版本链；继续未决项仅允许规格6的同结果决策链，不把head推进到任意新正文或将AI直接写正式字段。
- [ ] contract/client GREEN；`node scripts/research-design-api.mjs --case adoption`验证原子回滚/并发/幂等和权限不变。
- [ ] Chrome完成接受、修改后接受、拒绝/未决→显式保存→刷新，确认旧版未改、当前草稿仍draft，无审批/导出按钮。

## T07 历史、差异与手工修订（4小时）

**Files：**改`local-research-plans.mjs`、Workspace、`src/research-design-session.js`及test、`src/knowledge-session.js`。**消费：**旧版/新版原artifactId及合法版本。**产出：**GET历史版本、精确白名单、逐行diff及S07手工正文保存。

- [ ] history-refresh RED：不存在/非法版本、他人版本拒绝；旧无design正常只读；失权历史隐藏；dirty轮询不推进CAS、乱序/切账号不串、改回原值不拦离开。
- [ ] `diffDesignLines`做本机有界逐行差异，不引新diff依赖；复用原POST versions编辑接口。正文/PICO变动使当前旧建议不可采纳，历史保留决策；不自动解析重写旧自由文本。
- [ ] client及contract GREEN；`node scripts/research-design-api.mjs --case history`验证历史来源状态、手工保存后旧建议409。
- [ ] Chrome核对两个版本/复制失败/键盘/离开保护；关闭再打开读同一服务器版本。历史来源变更只能只读，撤审立即清空，不受dirty延迟。

## T08 原下游连续性（3小时）

**Files：**改`ResearchPlanFlow.jsx`、Workspace、KbAgentPanel、`src/platform-shell.js`；扩展`scripts/research-flow-contract.test.mjs`。**消费：**原Q01、合成DQ/run/report/asset功能。**产出：**K01→Q02→Q01/S07→原下游合法URL和真实页头。

- [ ] lineage RED：换方案版本仍携旧run/report query须清除当前选择并解释；旧报告不能自动重绑新方案；真实页头无示例标题/分享/审批。
- [ ] 仅增加进入/返回与可选design兼容，不改数值算子/旧产物。旧链有来源变化时沿原只读/拒绝，不给所有历史报告批量重新生成。
- [ ] `node --test scripts/research-flow-contract.test.mjs tests/research-flow-navigation.test.mjs` GREEN；`node scripts/research-design-api.mjs --case downstream`用新具名本人任务显式走新版→原TS/Python DQ→新报告/资产。
- [ ] `pnpm run build`及受影响路由浏览器核验；从当前manifest确定消费者，不用历史固定19页充数。

## T09 两角色全链路与风险验证（4小时）

**Files：**新`scripts/research-design-browser.mjs`、`research-design-boundaries.mjs`、`research-design-gates.mjs`；扩展API脚本；新`docs/testing/research-design-workbench-2026-10-23.md`。**消费：**T01–T08全部接口/页面。**产出：**A01–A08本轮独立证据。

- [ ] browser脚本先断言真实分支/来源/采纳/历史/新版下游，边界脚本先造独立请求竞争/失效反例；非本轮数据拒绝写入。
- [ ] `node scripts/research-design-gates.mjs --mode local-synthetic`编排上述纯测试、合成PG/真实浏览器/构建；实现脚本前不得声称此命令已通过。沿WP02既有安全内核命令，只跑无历史写入副作用的既有分组，不重build/替换旧dist或Client。
- [ ] 每原账号各用全新合成材料，经实际页面到新资产候选；至少记录4次实际设计请求的来源/模型/工具/费用状态。预算/quote不许执行则对应标阻断，不增加配额。
- [ ] 独立请求验跨账号/Study、WP02新账号零私有/只读拒绝、幂等/CAS、执行中source失效/父版变化/未知账单；撤权竞态优先用本轮事务回滚钩子，不提交原账号撤权/恢复。若真实跨实例撤权未测必须写明，不拿此片重开WP01。
- [ ] Chrome1440/1920/1366/390/320及原生200%：字号computed、溢出/原文/diff/错误/键盘焦点/dirty/慢请求/失败恢复/复制失败；两角色科研侧与管理侧本人入口，PNG/WebM/控制台预期错误均保留。
- [ ] 比对旧源码/进程/冻结证据/历史行与费用账本，真实结果记录代码/配置/执行三层，不勾专业验收。

## T10 独立总评审与交接（4小时＋最多4小时共用缓冲）

**Files：**本目录review/progress/task_plan；产品规格/基线/变更/使用说明；专项运行/测试文档及根`docs/product/06-版本更新记录.md`。**消费：**完整限定diff、A01–A08证据、未测清单。**产出：**一次独立只读代码总评审、主实现修补复测、用户验收包。

- [ ] 仅在全片实现后请求一次新的独立总评审；不同于本轮文档评审。评审检查需求、权限/当前授权、科学/来源、版本/计费、UI/故障；不自行实现或碰私有凭据。
- [ ] 主实现逐条核实Critical/Important，范围内先红后修再回归。新增权限/底座/云等范围先确认；不能为“全绿”关掉失败测试或删证据。Minor有处理/明确留项，不假称二次独立签认。
- [ ] 同步living spec、基线/变更/使用说明/专项/版本及Notion；保留旧段和子页。代码、目标配置、实际执行、专业结果分别标状态，专业由用户验。
- [ ] 本轮新证据目录`/Users/mac/aisciencesys/docs/test/evidence/2026-10-23-researchhub-wp05-design/`仅在实施获批后建立，source/evidence摘要与脱敏检查；若跨日期，以实际执行日目录另记，不覆盖旧冻结证据。
- [ ] 交付体验入口、合成材料、决策/版本/实际工具结果及一组未预排新材料，邀请用户按A09确认。无业务可用性意见则“本机技术验证完成、专业待验”，不是正式WP05/一期/生产完成。

## 本轮文档与后续实施的边界

本轮仅完成规格/本计划、一次独立文档可实施性评审、入口/倒排同步及文档检查；**不运行上述待创建脚本、模型、PG、浏览器或服务重启**。本轮review不是代码总评审，不能提前勾T10。下一步等待用户批准规格与计划，沿已经指定的串行＋独立总评审方式执行；有新费用等确认项时再停线。
