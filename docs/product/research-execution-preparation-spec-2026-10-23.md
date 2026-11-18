# WP05第二切片：研究执行准备工作台与AI方案—访视—CRF一致性检查

## 2026-11-17 · WF03方案审核与启用

正式Study的S11／固定版S07沿用原“方案审核与启用”卡片。草稿保存后继续显示缺项；“提交审核”复用当前有效发布检查，或自动检查后重新核对当前方案、政策、固定材料及提交权限，全部就绪才提交。检查受阻时保留结果及输入，不要求用户先另点一次检查；原独立检查入口仍可使用。草稿仍允许保存不完整内容。

待审版当前具备批准及后续启用管理权、原独立审核和材料条件满足时，主动作是“批准并启用”。一次站内确认展示冻结的方案／政策版本，批准后重新核对当前状态、同一政策和启用条件再启用；次要“仅批准”及已批准版的“启用方案”保留。每一步沿原权限、原生状态门禁与审计，启用只作用于后续入组，不迁移既有入组或访视。

结果未知时先“核对上次检查／提交／批准／启用结果”。核回检查或批准成功后，须明确“继续提交审核”或“继续启用”；已成功阶段不再办理。未查到结果不代表未执行，只在页面允许时显式重试原操作。临时离页／切换身份保留原操作的最小恢复标记，旧确认和迟到结果失效；政策正文与原因不存入恢复标记。新编辑保留，检查期间新增科学输入会停止后续提交；纯读取或无在途未知的已知阶段不单独拦截离页。

本机3个合成方案最终执行中，6项PG预测完整回滚，双角色及独立审核、B治理进入／返回、D两阶段恢复、五宽与原生200%通过。A实际原生成功由严格回执只读核定，不能称该次正常连办UI验收通过；真实临床与生产未验。见[最终业务事实](../testing/evidence/study-workflow-simplification-2026-11-17/wf03/root/audit-2026-11-17T05-32-14-921Z-93c81/native-audit.json)、[工程契约](../planning/study-workflow-simplification-2026-11-17/briefs/wf03-api-contract.md)。下方本人执行准备草稿的历史契约不因此自动取得正式审批或采集权限。

## 2026-11-17 · WF02已审核模板带入

S11原“方案基准与当前状态”卡片内增加折叠的“从已审核方案带入”：搜索后直接预览固定表单/量表版本、访视、结局映射及相对当前草稿的差异，一次“确认差异并带入草稿”建立独立draft并继续编辑，保留原页四卡与历史。源和目标均需当前精确配置权；仅原生data_field/scale结局可移植，原研究专属form_score及未知来源明确阻断，不能继承模拟注册。原政策、人群/访视分支适用、同意和独立审阅须在当前研究确认，批准/启用不复制。

未保存输入先保留；unknown只读核对原操作，允许在新标签页核对已保存方案，原tab的pending保持。404/found:false不推定未执行，显式重试保持原意图；迟到身份结果不回显。管理员与普通科研、3真实导入及回滚/恢复/五宽与原生200%已验证；当前draft尚未提交，治理队列不增待办。[验收与限制](../testing/study-workflow-wf02-2026-11-17.md)。

## 2026-11-05 · 取消开发费用限制，统一业务Token规则

用户明确不再使用开发5/10元、累计任务/请求数、临时报价过期及目的付费开关。当前本机运行入口只复用原租户/账号Token额度、并发原子预留、实际用量结算及失败待对账；不增加额度、清理历史预留或绕过业务授权。页面布局不变、历史可读，旧账本/收据保留为历史，不再参与运行准入。现行费用以[AI统一业务Token规则](business-ai-quota-2026-11-05.md)为准，下方旧费用/次数/核价描述仅为当时记录；[本机验证](../testing/business-ai-quota-2026-11-05.md)区分代码、环境、实际执行和用户专业验收。

版本V0.2（实施记录，已批准契约保持），日期2026-10-23。状态：**代码、E08唯一评审修补及本机技术复测完成，AX09专业验收待用户**。最终文档/Notion交接证据另见本片final-validation.json，不以技术复测替代。当前目录串行实施；下文“仅文档/待批准”为编制时历史。

## 当前实施状态（不改变下列已批准契约）

已接通本人配置、人工映射/规则/临时试填、原科研Agent实际一致性核对、分批意见、历史差异/目标配置复制及显式重绑。两账号全新材料各9项UI整链、旧下游失效8项、真实在途撤审无assistant交付；评审三项实际风险均RED→GREEN修补，217/217相关测试、1054/1054原内核、构建及28项免费综合检查通过，无二次独立复签。详见[实测报告](../testing/research-execution-preparation-2026-10-23.md)。

用户本轮另批准原累计5元内核价/调用；63笔known，累计保守¥1.246815，本片11笔¥0.261936，含失败费用，无充值/自动续额。只用专用合成环境、原两账号/当前Study/本人草稿；无新增权限、正式表写入、旧源码/旧服务/云/远端配置/发布操作。不称专业验收、完整WP05/一期/正式采集或生产交付完成。

配套：[小步计划](../planning/research-execution-preparation-2026-10-23/implementation-plan.md)、[核对与裁决](../planning/research-execution-preparation-2026-10-23/findings.md)、[评审](../planning/research-execution-preparation-2026-10-23/review.md)、[任务](../planning/research-execution-preparation-2026-10-23/task_plan.md)。上位：[产品基线](product-baseline.md)、[AI专项](../planning/phase1-review-2026-10-19/ai-special-design.md)、[倒排](../planning/phase1-review-2026-10-19/reverse-schedule.md)。

## 1. 意图、现状与路线

让研究者把本人已确认PICO的方案草稿，转成**可人工核对的执行准备配置草稿**：结局定义→访视→CRF字段映射，保存版本、检查缺项/结构冲突、查看AI解释并修订。退出产物是后续WP06的输入候选，不是已批准、可直接开展临床采集的Protocol。

首切片已在本机技术交接，用户专业A09仍待验收。当前资料/方案最多6个封存片段、真实Agent KB分支、合成DQ及报告/资产候选可复用；完整OpenCode/联网、正式Study/Protocol/EDC、审批共享导出均不能据此销项。旧researchProjectId是当前执行范围，不把它重新命名成独立产品Study或Project。

采用**本人原方案产物的可选执行准备块＋现有页面真实分支＋旧纯表单契约**。用户已选择此前推荐的窄切片；具体容量/接口/head规则为本稿提出的实现决定，随整体批准。

替代方案：直接创建正式Protocol/表单会扩大业务授权、写入和治理；另建平行配置平台/通用表单设计器超出4日范围；只追加聊天文本不能成为可校验的访视/CRF配置，均不采用。不更换框架、运行内核或共享库架构，因此不新增取代既有Accepted ADR的选型。

## 2. 最小范围与明确不做

| 编号 | 本片交付 | 最小边界 |
| --- | --- | --- |
| X01 | 本人执行准备入口/状态/列表摘要 | Q02/S07沿本人草稿进入S11真实分支；当前Study及原两账号，无第二个Study |
| X02 | 方案绑定与配置修订 | 固定当前方案/PICO/资料基准；结局定义、访视和字段由人填写，缺项可保存草稿 |
| X03 | 一份CRF与无持久采集预览 | 一份具名合成模板，初始基线/随访两项仅作软件占位，不预设临床时间或量表 |
| X04 | 规则检查＋真实AI解释/缺项问题 | 确定性规则结果和AI候选分开；有位置、依据和覆盖范围，AI不自动改配置 |
| X05 | 人工意见、历史与失效 | 记录已核对/需修订及原因，修订追加版本；不将确认意见当审批或问题已修复 |

仅专用合成库`wp01_test_full_baseline`、原两个已授权合成账号、当前合成Study及本人本轮草稿。管理员只走本人流程，不能因管理员身份查看另一账号草稿。无成员/只读账号仍是拒绝反例，不增授权。

不创建或更新正式StudyProtocolVersion、VisitPlan、FormTemplate/FormVersion/FormAssignment/FormResponse、Subject、Visit、ScaleResult，不新建Project/Study/成员/角色或迁移历史。预览不写受试者、答卷或结果。无激活、表单发布、审批、采集提交、锁解锁、共享、下载导出、H5、随机化、盲态、计分/样本量、任意统计、复杂条件表单、多中心设计器或自动联网。原合成DQ/报告链仅回归，不将新配置接成正式采集。

不恢复WP01 T03–T24，不改旧业务源码/Schema/RLS/Client/后台扫描，不重启旧服务，不访问临床库或远端配置；若原复用入口无法满足，停在缺口报告，不借4日预算扩底座。

## 3. 复用点及禁止误用

| 现有位置 | 本片消费方式 |
| --- | --- |
| `scripts/local-research-plans.mjs` | 原withDraft/inDraft、本人授权、当前来源、seal、formatContent、原版本/CAS/审计；保留旧无新增块草稿 |
| `scripts/local-research-design.mjs` / `research-design-contract.mjs` | 沿已验证的任务绑定/科学叙述/操作key防重思路；只增准备任务互斥，不重构旧证据和采纳能力 |
| `scripts/local-knowledge-ai.mjs` | 原会话、KnowledgeChatQueue、Orchestrator KB分支、KbTools、DeepSeekProvider及预算/最终发布重验；新增互斥任务种类 |
| 旧`app/server/src/study-operations/study-forms-policy.ts` | 用normalizeFormSchema及normalizeAndValidateAnswers作确定性契约；外层严格字段/容量校验，不调用scoreFormResponse |
| 旧`study-operations.service.ts` / `study-forms.service.ts`、Prisma模型 | 仅作为后续映射语义和状态参考，不实例化正式写入Service。listTemplates会初始化内置模板，createProtocolVersion会写正式对象，均不当无副作用读接口 |
| `pages/shared/ResearchDesignWorkspace.jsx`、`ResearchDesignHistory.jsx`、`src/research-design-session.js` | 复用真实路由、dirty/请求代次、单次在途刷新及版本差异；新增局部组件，不复制Shell |

必要启动装配仅本机适配器、Controller及精确parser；不新增队列、Worker、Agent、数据库表、feature或角色grant。实施E01只读确认现有artifact.edit及原Agent授权能覆盖该本人草稿动作；不能覆盖时先提交最小授权申请，不悄悄增权。

## 4. 数据契约与容量

原PLAN_MARKER/schemaVersion/产物typeKey=`protocol_draft`、status=`draft`保持。原根块新增可选`executionPreparation`，内容和来源记录仍由原ResearchArtifactVersion保存；旧无此块正常读取。正文24000 UTF-16字符和根operations最多64次保持，准备不拼进正文、不截断正文，也不把未知旧块丢掉。

准备块：`schemaVersion:1`、`purpose:'synthetic_execution_preparation'`、`basis`、`headVersionNo`、`revisionNo`、`config`、`rules`、`pending`、`opinionHead`、`decisions`。schema未知或不完整拒绝，不从演示/localStorage修复。`check`只存在于GET返回投影，来自不可变assistant结果，不回写已保存准备块。pending保留job引用，是否在途由真实job.status判断，不能只因非空就永久阻断。

`basis`保存服务器核实的来源方案`artifactId/versionNo/contentHash`、PICO确认hash、固定source集合hash；真实tenant/account/group/project/session/kb由服务端绑定。`headVersionNo`是当前连续准备链根版本，`revisionNo`是配置修订号，不与根CAS混用。AI绑定还包含configHash、规则版本/结果hash及executionVersionNo。

精确hash：contentHash=`SHA256(UTF8(editablePlanContent(plan.v.contentMd)))`，不含provenance附注或新增配置元数据；picoConfirmationHash取服务器原`plan.block.confirmation.hash`，不以仅含PICO值的picoHash替代。sourcesHash沿首切片digest：对象key递归字典序、数组保持原顺序的JSON之UTF8 SHA256，输入为原完整plan.block.sources，不重建retrievedAt或重排片段。basisHash/configHash/rulesHash同样canonical digest各自严格对象；规则对象无当前时间字段，时间仅运行元数据。head另行判断，不能仅因hash相等而复活旧结果。

`config`为以下严格结构（未知字段拒绝）：

- `label`最长120字符，`outcomes`最多8项，每项`key/label/definition/unit`；key ASCII字母起始，允许字母数字下划线，最长64，稳定且唯一。definition最长1000，label120，unit40；空定义/单位允许但显式待定。PICO结局仅只读参考，人显式登记结局，不能用中文相似度自动拆分/确认。
- `visits`最多4项，`key/name/order/targetDayOffset/windowBeforeDays/windowAfterDays`；name120、order唯一正整数1–4。日期偏移允许null，非null为整数[-3650,3650]，前后窗口null或整数[0,365]。这些是接口安全边界，不是临床推荐；初始全部时间参数null，不默认0或生成临床安排。
- `form`恰一份，`key/name/schema`，schema=`form-schema.v1`，最多12字段；字段仅key/label/type/required/min/max/options，沿旧number/integer/text/select/boolean。字段key与上述key规则一致，label120；数值边界需有限且min<=max，选择项最多12、value64/label120且唯一；非数值字段不接min/max，非select不接options。禁score、代码、公式、附件及HTML。
- `mappings`最多24条，严格`outcomeKey/fieldKey/visitKeys/unit`，引用必须存在，组合不重复；每条最多4访视，unit最长40、允许空且显式待定。`missingStates`固定为missing/not_measured/not_applicable，不与0、false、空字符串混同；`notes`最长1000。

空配置可保存草稿，非法类型/重复key/悬空引用/超容量一律400不落库；未填临床内容不能靠默认值伪装完整。列表不显示参数全文。配置总原始JSON请求<=128KiB；任务/预览/意见/重绑各<=32KiB，实际Controller大小写/尾斜杠路径同限制。GET历史版本正整数最多6位，每次单版本，索引最多30项；不新增无限历史聚合接口。

## 5. 版本、幂等、互斥与失效

| 动作 | 原根版本/配置revision | 必要规则 |
| --- | --- | --- |
| 首次保存准备 | v→v+1 / 1 | 已确认PICO、方案已保存、当前来源；basis指向真实v，head=v+1 |
| 本片改配置 | v→v+1 / r→r+1 | 当前head与CAS相等；basis不变，重算规则，旧AI和意见失效 |
| 本片AI入队 | v→v+1 / r不变 | pending、job和head=v+1同事务；executionVersionNo=v+1，冻结config/rules/basis |
| AI完成后的GET | 不新增版本 | 只读不可变assistant结果；验证job/result绑定及当前head/来源，不在GET修复数据 |
| 保存人工核对意见 | v→v+1 / r不变 | 当前resultMessageId与head；记录作者/原因/原结果，head推进；不更改config/rules |
| 其他原草稿写入 | 根版本改变 / 准备不推进head | PICO、正文、证据/建议操作均保守使准备stale，即使正文改回也不复活 |
| 显式重绑 | v→v+1 / r→r+1 | 原来源仍current且无在途任务；人确认新基准及理由，保留配置/旧basis历史，旧AI失效，不自动生成 |

陈旧配置仅可看历史、复制目标JSON供人工核对，不自动写入当前编辑区；不能直接继续检查/保存意见。重绑后仍是未审批草稿。来源权限/审核失效统一失效身份/请求代次、刷新门闩和在途反馈并隐藏全部内容（即使dirty）；历史读取受限后，普通读/写迟到也不能恢复。hash变化但仍可访问则标stale，不假装当前。

所有持久操作使用原共同授权锁与产物事务，重验当前账号/成员、实际父草稿/来源、CAS/head。requestKey为8–128 ASCII字母数字下划线/短横；原operations与原job表统一防重：同已完成请求同输入返回原结果，不新增版本/费用；异输入或免费key改用收费拒绝409。不能让新任务绕过首切片的免费key保护。

原PICO/protocol、design evidence/refine、准备consistency三类生产者共用“本草稿至多一项queued/processing”检查；所有初查与最终入队、正文/PICO/证据/建议/准备写都覆盖三处pending。pending缺job/父对象不符视为上下文错误，不当空闲。失败不自动重试/重放，显式新任务先核对旧费用。

原子边界分两次：入队在同一原授权事务写新准备版本（含seal/config/rules/head/pending）、操作/审计及job，任一步失败全回滚。完成在原queue最终发布事务里先validateTurn再写assistant不可变结果及job.completed/assistantMessageId；失败不得留下可见assistant。accept仅把校验后的结果附在该assistant的provenance，不另写准备版本；GET只投影读取，不修复数据。意见保存另在原授权事务追加准备版本/意见/审计，不改已完成job或assistant。新任务只改本机适配钩子，不扩大旧内核授权。

连续意见判据：第一次意见要求当前根版本=head=任务executionVersionNo；保存后opinionHead固定`resultMessageId/executionVersionNo/basisHash/configHash/rulesHash/revisionNo`，仅lastRootVersionNo随本片意见推进。后续须当前根版本=head=opinionHead.lastRootVersionNo且前述六项与同一不可变结果全部相符，未终结itemId才允许写；不得再要求当前根版本等于原executionVersionNo。没有连续opinionHead时只能从原执行版本开始，任何外部根写打断后不可自动接续，配置修订/重绑均清当前意见head并保留历史。

队列payload仅新增`researchExecutionPreparation:{kind:'consistency',binding}`，与researchPlan/researchDesign严格互斥；binding冻结真实scope/owner/artifact、basisHash/configHash/rulesHash/revisionNo及executionVersionNo。新prepare/accept/validateTurn钩子沿现有本机Controller/Orchestrator/queue事务组合，不新增validateBeforeAssistant的平行写通道；当前local-knowledge-ai.beforeAssistant必须调用新validateTurn，再沿原来源发布门禁。

## 6. 检查、AI与科学边界

确定性规则版本`execution-preparation.rules.v1`：R01结局定义/单位待定；R02结局无有效字段映射；R03映射无访视；R04访视时间未确认；R05字段配置的required/缺失语义待核对；R06人工声明的同一结局单位与所选字段单位无法确认一致；R07上游准备基准陈旧。结构错误在保存前拒绝，不混成可忽略warning。R06字段单位来自单独的人工结局映射声明，不让模型推导单位换算。规则返回稳定findingId、ruleKey、targetPaths、severity=`missing|conflict|stale`及服务器事实；事实可复算，无“完整度百分比”。

R05明确判据：被映射到结局的字段required不是true时登记“采集必需性待核对”，不自动改成必填；固定缺失语义始终展示。R06不比较自由文本猜单位，mappings[].unit与outcome.unit均非空且不同则conflict，任一空则missing；无单位的定性结局由人同时明确填“不适用”，不由程序推断。这只是声明差异，不判断医学单位等价。

最多展示24条确定性发现（多项按ruleKey+targetPath稳定排序），超过时阻断AI并显示“检查容量不足”，不悄悄截断后报全部完成。保存草稿本身不要求没有缺项/冲突，显示“待专业确认”，没有“通过/可启动研究”状态。

空集合也有确定判据：outcomes为空记R01定位outcomes；visits为空记R03定位visits；form.schema.fields为空记R05定位form.fields，不能因遍历零项就显示无问题。targetPaths采用稳定key路径：outcomes或outcomes.{key}.definition/unit、visits或visits.{key}.timing、form.fields或form.fields.{key}.required、mappings.{outcomeKey}.{fieldKey}.visitKeys/unit、basis。每个发现/AI项1–4条路径，去重且必须属于本配置生成的白名单；不接受任意点路径、数组下标或__proto__/prototype/constructor等保留key。每项findingIds 0–4条且实际存在。findingId=`'epf_'+SHA256(canonicalJSON({ruleKey,targetPaths:sortedUniquePaths})).slice(0,24)`；不依赖数组顺序、描述或时间，key重命名视为新目标；用revisionNo/rulesHash区分不同快照，不能拿相同findingId跨版本复用意见。

预览外层真值表：只按当前已保存schema逐字段适配和收集错误，旧normalizeAndValidateAnswers只承担类型/范围/选项检查，不承担required/缺失校验；不得一次整表抛错导致只显示首个错误。

| 输入 | required=true | required=false |
| --- | --- | --- |
| 未提供该字段 | state归一为missing，REQUIRED_MISSING | state归一为missing，无必填错误 |
| 明确missing/not_measured/not_applicable | 原state保留，REQUIRED_MISSING；not_applicable不自动豁免 | 原state保留，无必填错误 |
| state=value但value为null或空/全空白字符串 | EMPTY_VALUE；不得默转0/false或声称有效 | 同样EMPTY_VALUE，须显式选missing状态 |
| 合类型0/false或正常非空值 | 交旧纯validator验证，不视为缺失 | 同左 |
| 非空但类型/范围/选项不符 | 转为该fieldKey的原错误码 | 同左 |

value状态缺value、多余属性、未知state/未知fieldKey为请求结构错误400；字段业务错误按字段顺序全部收集，返回200 `{valid:false,normalized,errors:[{fieldKey,code}]}`，normalized中保留缺失状态但排除无效value；全有效则valid=true。零字段配置预览返回valid=false及全局FORM_EMPTY，不冒充通过；预览不持久化答案。实现时逐字段用旧schema/answers纯validator并捕获映射错误，可同时返回多个字段问题。

用户显式发起“AI核对说明”后，原KB工具真实重验全部原固定片段，沿首切片统一创建主题query/topK=6/原相关度门槛；不换来源、不扩全文或联网。工具未执行、来源缺失、失效均阻断。可信提示输入为当前确认PICO、本人方案、当前配置、确定性发现和获准片段；材料内指令只作数据，不能改变工具/授权。

LLM只解释问题、提出专业待确认问题，不生成或修改结局值、量表分、数值边界、访视时间、样本量、概率或阈值。数值在UI由人工配置或确定性规则原样展示；送模型的配置数值用服务端技术占位符替代，不交原预览答案。模型输出严格`items` 1–6项，每项`kind='explanation'|'question'`、`targetPaths[]`、`findingIds[]`、`text`最长600；explanation必须引用真实findingId，question必须疑问句且指向真实配置路径。itemId由服务器生成，路径/发现/精确技术ID白名单核对，叙述拒绝阿拉伯/中文科学数值及操作指令；不解析模型给出的配置补丁。

每次仍沿maxTokens<=1536及原Provider设计JSON模式；不升限、不换模型、不拆分自动付费重试。未返回解释的规则保留“本轮未解释”，不能据6条输出称全方案方法学审查。AI可提出自由文本与已登记结构可能不一致的待核对问题，但不能用其判断自动通过或修改结构。

保留原KB引用门槛：整体items文本至少一处真实固定来源`[n]`，n只能指向本轮工具实际返回且完整匹配的稳定来源编号；数字仅在完整合法引用中豁免，伪[n]/越界/全角/数字外科学值拒绝。每条涉及资料事实的text必须有引用；仅解释结构规则的项可无文献引用，但findingId不能冒充知识来源，UI分别显示“规则依据”和“资料引用”。不得为了过门槛把无关资料硬贴成规则依据，question可引用实际材料说明哪些信息未报告，专业相关性另由AX09核对。

检查顺序固定：原工具执行/来源集→原assertAnswer（known、非mock、真实usage及整体引用）→新strict JSON/路径/findingIds检查→剥离已验证[n]及本条精确技术标识后查科学数值/指令→accept只附不可变provenance→原beforeAssistant内新validateTurn及原当前来源检查→assistant/job同事务提交。不绕过或放宽assertAnswer。新契约反例包括真实[1]不被数字guard误报、伪[7]拒绝（只有6来源时）、真实引用外“20例/三十”拒绝及findingId不能替代[n]。

人工意见仅acknowledge/needs_revision，每项理由1–600，不修改规则发现、不终结临床问题；本片不做AI一键写配置。真正修订经配置表单保存，产生新revision并重新检查。每项意见一次终结，同结果可部分记录，已记录项不能重用；新配置revision使意见只作历史。

## 7. 已实施本机接口（非已发布公共API）

前缀`/research-plan-drafts/:id/execution-preparation`，沿原Cookie/Study Scope、`artifacts`菜单及`artifact.read`，持久写再要`artifact.edit`，AI另验原会话/Agent授权。只允许固定原两账号/当前Study/本人真实草稿，不把URL当授权。

| 方法/后缀 | 严格输入 | 返回/容量 |
| --- | --- | --- |
| GET 空后缀 | 无body | `{id,version,sourceStatus,preparationStatus,basis,revisionNo,config,rules,job,check,decisions,versions,budget}`；restricted仅安全状态，不给配置/正文/历史 |
| POST `/versions` | `{baseVersionNo,requestKey,basisVersionNo,config}` | 首次basisVersionNo必须等于baseVersionNo；后续须等于现有basis版本。原子保存后返回GET view；128KiB |
| GET `/versions/:versionNo` | 路径整数 | 本人指定旧版本配置/依据/核对记录；沿当前授权/来源；无副作用 |
| POST `/previews` | `{baseVersionNo,revisionNo,answers}` | 仅当前已保存配置，32KiB；`answers[fieldKey]={state:'value',value}`或`{state:missingState}`；未知/混合字段拒绝，服务端剥离missing后调用旧纯validator并合并必填/缺失结果。返回字段级errors，不持久答案/不算分/不调用模型 |
| POST `/jobs` | `{baseVersionNo,requestKey,revisionNo}` | 原队列consistency任务，32KiB，原子入队v+1；GET查状态，不另建job服务 |
| POST `/decisions` | `{baseVersionNo,requestKey,resultMessageId,decisions}` | 每项`itemId/action/reason`，最多6、不可重复；32KiB |
| POST `/rebindings` | `{baseVersionNo,requestKey,reason}` | reason1–600；当前方案为新basis，保留旧版本；32KiB |

GET不新建模板、准备块、版本或业务对象。错误沿既有`{code,message}`：400输入/字节/科学输出契约；401失会话；403本人/Study授权；409 CAS、head、来源、重复key/在途；429预算/有效报价阻断。不得返回密码、内部文件路径、模型密钥或无权资源标题。预览错误返回200及errors用于编辑反馈，但请求结构错误仍400。

## 8. 页面与UI/UE验收

页面为工作区：Q02本人列表/S07设计详情新增准备入口及摘要；S11仅在`executionPreparation=1`且合法studyGroupId/researchProjectId/researchPlanId时进入真实准备分支。S11现有团队/设置入口和WP02邀请不变；S01本片不改演示总览，明确不借此接全站研究页。无真实配置显示未配置/登录/拒绝，不转固定demo或localStorage成功。

S11保留已有母版的公共Shell、页头及上下文导航；业务区按方案基准、访视/字段、映射与预览、检查与意见组织，不新增一级导航或改变Frozen Token。与S07已确认真实分支对照1440×900；需要改变母版结构则先确认，不擅自扩为全局设计。

复用共享Button、现有表单/提示/版本diff样式。主要动作分别为“保存配置草稿”“检查配置”“AI核对说明”，不叫“启动/批准研究”。规则检查是确定性结果，点击只读重算当前已保存版本，无模型费用；保存时已重算，未保存先提示保存。预览输入仅内存，换配置/对象清空并说明，不显示成已采集；离开预览无需伪造已保存。

操作/输入14/22，连续方案/AI阅读16/28且最大48rem，辅助13/20，版本元数据12/18，风险/错误不降脚注；一页一个h1。宽映射表放可操作滚动容器，不缩字、裁列或仅hover显示全文。1440/1366/1920、390/320视口及实际Chrome200%检查，不用DPR代替缩放；本片局部验证不称全站适配。

UE01–UE10均适用：合法返回与基准；单次在途/代次隔离；空配置/服务失败/受限分开；首次不报满屏错，提交后首错聚焦；CAS/网络失败保dirty；无自动保存假文案；保存成功清dirty，改回原值不拦离开；模态焦点/关闭恢复；忙碌防重复；AI阶段/覆盖/来源/未知可见；复制绑定目标版本与promise代次，失败有手动复制。退出/撤审即隐藏敏感内容，即使dirty；迟到响应不得恢复。

科研人员与管理员均完整走本人新建/列表摘要/详情/编辑/历史/AI，另验管理员跨账号拒绝；管理端不增全Study配置或审核功能。后台同样拒绝越权与旧版本提交，原账号/邀请/知识/首切片/合成下游联动回归。

## 9. 验收与证据映射

| 编号 | 可验收结果 | 任务 |
| --- | --- | --- |
| AX01 | 两原账号从本人草稿进入、保存/刷新恢复；旧无块可读、列表摘要/返回正确、跨账号/只读/未邀请拒绝 | E01/E02/E03/E07 |
| AX02 | 一份新具名合成模板、人登记结局/访视/字段/映射；容量/类型/缺失0与false/选择项/单位冲突按golden校验 | E01/E02/E03/E04 |
| AX03 | 预置未映射结局、未确认时间、单位声明差异、无必需性、缺字段被定位；修订后对应发现按真实规则变化 | E04/E07 |
| AX04 | 实际原Agent/KB工具/Provider核对；query/source/hash/time/usage/result可查，非Mock。数值未交模型计算，伪ID/指令/科学数值输出拒绝并留失败费用 | E05/E07 |
| AX05 | 部分人工意见、终结防重、历史差异、CAS/同键幂等；元数据入队不自我stale，其他写/改回正文也不复活，显式重绑保历史 | E02/E05/E06/E07 |
| AX06 | 三类pending互斥、入队/最终提交当前授权/来源/version重验；真实在途撤审不交付旧配置/assistant；免费key不能变收费 | E05/E07 |
| AX07 | dirty/失败/慢轮询/迟到响应/复制、键盘和字号/五视口/原生200%，两角色实际截图录屏；旧知识/账号/设计/合成下游不退化 | E03/E06/E07 |
| AX08 | 旧源/Schema/角色/服务/历史行/冻结证据保全，新具名夹具独立；28＋4小时、独立代码评审修补、文档及Notion同步 | E01/E07/E08 |
| AX09 | 用户用未预运行合成材料判断配置有助于采集准备、问题忠实可定位、不会误当专业批准；意见记录与实际产物对应 | E08及用户验收 |

四层分别记录代码契约、本机配置启用、真实请求执行、用户专业可用性；技术未全过不能称技术完成，AX09未通过不能称业务验收。文档评审不能代替实施后的唯一代码总评审；代码评审Critical/Important须处理后复测，无二次签认则如实注明。

未来证据根`docs/test/evidence/2026-10-23-researchhub-wp05-execution-preparation/`相对父项目；仅新目录，原WP05第一切片manifest/文档历史不可覆盖。实施时才创建API/Chrome脚本及证据，不把本稿里的命令和夹具当已存在或已跑。

## 10. 工期、准备与批准点

28小时实现/验证/文档＋4小时缓冲＝32小时，按4个8小时工作日，不默认周末加班。若10月26日获批开工且无等待，目标10月29日技术交接；准确日期随批准/环境/专业反馈调整，不以AI速度隐去验证时间。首日先核对复用/原授权/原Client加载，出现必须新权限/结构/旧源变更即报告并停该分支；第2/4日复估，超过32小时需重新确认。

本轮仅文档；现有报价记录到2026-10-24 14:12:50北京时间，原累计保守¥0.984879/¥5是上一片交接事实，不是本片付费许可或最新供应商价格。E05实际模型前必须同时具备本片调用授权、有效公开核价和原账本可用额度；任何一项不满足停线，不自行续价/续额/充值。可先做无费用工作，但不得Mock销AX04。

临床量表/真实访视模板及新甲方专业确认P03/P11仍是正式WP06/真实采集的前置，不用旧配置或合成模板替代。用户可在本片实施中评阅一份明确合成配置，不阻塞纯契约/页面开发；不得为了等专业模板跑到临床库。

10/30–11/04仅作为后续最小EDC切片的候选窗口，需另写规格/权限评审；11/04和11/06检查A0、完整联网/其余AI入口/领域内容及正式治理剩余量，11/09–13留回归/专业/获准目标环境。不是承诺两天补完全部AI，也不擅自把已确认一期能力推到二期。全项目2026年11月中旬目标保持，高风险按真实剩余量复估。

规格/八步计划及本轮累计5元核价/验证已由用户批准，使用说明和本机装配已同步。角色/云/远端配置/发布及超预算仍另停线确认；不重复索要同一批准或恢复旧底座待办。专业AX09、正式模板及后续业务切片另行讨论。
