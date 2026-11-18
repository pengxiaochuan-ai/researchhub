# WP07首切片：真实合成CRF数据的方法执行与AI结果解读

## 2026-11-05 · 取消开发费用限制，统一业务Token规则

用户明确不再使用开发5/10元、累计任务/请求数、临时报价过期及目的付费开关。当前本机运行入口只复用原租户/账号Token额度、并发原子预留、实际用量结算及失败待对账；不增加额度、清理历史预留或绕过业务授权。页面布局不变、历史可读，旧账本/收据保留为历史，不再参与运行准入。现行费用以[AI统一业务Token规则](business-ai-quota-2026-11-05.md)为准，下方旧费用/次数/核价描述仅为当时记录；[本机验证](../testing/business-ai-quota-2026-11-05.md)区分代码、环境、实际执行和用户专业验收。

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

D05–D07技术检查已完成，唯一D08只读总评审正在进行，AC10仍待用户专业验收。真实CRF→原Python确定性结果→原科研Agent解释→新方法报告草稿/本人说明/历史已接通；终态run整行只读，原job/Message/Audit关联，报告复用原Artifact/Version/Sources。AI正文实际仅[M1]/[M2]方法引用；KB工具实际执行但不宣称新文献正文引用已实测。四次含失败请求全部用完，累计79笔known/¥1.518966/原¥5，held0，不再调用模型。每run最多30新报告、每报告30版，超限明确429，无新全局平台。下方标为旧检查点/待批的文字只作历史，以本节和执行台账为当前状态。




D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 2026-10-26授权续行（不改变业务/引用契约）

用户已批准含已失败请求在内的总次数最多4次、后续最多3次，仍原累计5元，不充值/续额或自动失败重试。原F01回执/76笔/报价保留，另行绑定次数补充批准。§6正文引用须与结构sourceRefs精确对应的规则不放宽，不从模型结构引用自动补正文；本轮仅加强可信输出请求，先免费测试、再真实验证。D05未验收、后续D06–D08依赖不跳过，原两账号/当前Study/本人新对象保持。

## 2026-10-25当前：存储修正已批准并验证，D05真实输出未通过

用户已批准最小存储修正，§6已替换为终态run完全只读、原job保存请求/选择/版本、Message/Audit关联。真实Queue/PG的事务回滚、双连接同键唯一、异键在途排斥和整行不变已通过；没有改旧源码/触发器/Schema/角色。恢复保留原报价与原75笔/三次计划，不重置次数。

首个真实Chrome→原检索工具/Agent→Provider HTTP200、known usage已执行，新增¥0.012051；但正文没有[M1]/[M2]，虽然sourceRefs有编号，仍按原严格引用规则拒绝，未发布assistant，不自动补引用或付费重试。累计76笔known、保守¥1.476468/¥5。只暂停本片paid入口，原R01和旧scope不变；D05未验收，D06–D08和专业验收未开始。若保留两个账号成功＋在途失效三项目标，至少还需3次请求，超出原计划剩余2次，须另确认。见[已批准修正及结果](../planning/synthetic-crf-methods-2026-10-25/d05-terminal-binding-adjustment.md)、[实测](../testing/synthetic-crf-methods-2026-10-25.md)与[台账](../planning/synthetic-crf-methods-2026-10-25/implementation-progress.md)。下方原待批措辞均为历史。

版本V0.2，2026-10-25。**规格、八步计划、R01–R03、F01及最小存储修正均已批准；D01–D04阶段通过，D05实际输出被拒，D06–D08未完成，唯一独立代码总评审仍留D08。** 仅专用合成环境、原两账号/当前Study/本人新对象；不扩底座或开放正式采集、审批、锁库、共享、发布、导出。批准、代码、配置、实际请求、专业价值分别记录。

关联：[最小授权](../planning/synthetic-crf-methods-2026-10-25/authorization-scope.md)、[八步计划](../planning/synthetic-crf-methods-2026-10-25/implementation-plan.md)、[源码核对与取舍](../planning/synthetic-crf-methods-2026-10-25/findings.md)、[前序WP06实测](../testing/synthetic-edc-c06-c09-2026-10-25.md)。本片按24小时实施验证＋8小时缓冲，3＋1工作日；不代表完整WP07、统计分析平台、一期或生产交付。

## 1. 目标、前提与用户故事

把本人WP06**实际已保存**记录接成：预览输入→冻结来源版本→旧Python受支持质控执行→S06结果核对/前后比较→原科研Agent解释→新的可追溯方法报告草稿。科研人员能知道“计算究竟用了哪版数据、做了什么、没有做什么”，管理员也只处理本人记录，不新增跨成员可见性。

前序WP06的D01–D03仍是真实独立确定性检查；其`rh-synthetic-edc-report.v1`没有Python/ResearchMethodRun事实。旧8人固定seed试跑也不属于这批CRF。本片不能借用旧run、seed或旧报告伪造新计算。

假设：仍为原两个合成账号、原Study、本人本轮新建包；每包3–5个SIM编号、两个保存访视、一份1–12字段CRF，最多10张记录。WP06专业AC10未签认，若专业反馈改变配置/数据模型，先处理再复估本片，不把技术测试等同配置合理性确认。

## 2. 最小范围与明确不做

只做一个执行器`research-data-quality`，旧Python/manifest版本`t19-1`，本片投影覆盖**按访视/字段的缺失汇总、显式人工范围观察及本人包计数**。它是技术数据质量结果，不是疗效分析或分析集放行。

- 不新增算法、统计检验、临床阈值、量表计分、样本量、重复测量推断、Meta/ML，不让LLM计算或补值。
- 不建立正式Study/Protocol/Subject/Visit/FormResponse/ScaleResult，不写质量放行、审批、锁解锁、共享、发布、资产或导出；S11成员邀请保持。
- 不改变旧源码、Schema/RLS/Prisma Client/角色/既有Skill/Assignment/Feature；不初始化旧试跑工厂来补授权，不新增表、依赖、Worker或通用调度平台，不恢复WP01 T03–T24。
- 不扫描/恢复历史queued任务，不改旧包、旧run、旧报告及其审计；集成夹具仅本轮新具名对象，前序样例只读回归。
- 只用专用`wp01_test_full_baseline`及既有本机19501–19507环境；方法调用固定回环19505，不连接旧Worker、临床库、云或远端配置。必要自有API重启属于实施阶段，原旧服务始终不动。

## 3. 复用路径与不能直接搬用的部分

| 代码 | 采用方式／必要限制 |
| --- | --- |
| `scripts/local-synthetic-edc.mjs` | `withCollection/inCollection/currentState`及真实包/版本校验；读取冻结版，所有写/提交重新核对head；不为新run追加父方案或包版本 |
| `scripts/synthetic-edc-contract.mjs` | `edcDigest/syntheticDataBasis/syntheticQualityCurrent`；0/false、缺失分类及dataRevision语义保持 |
| 旧`research-method-worker.client.ts`、`research-method-worker-policy.ts`、Python `data_quality.py` | 复用真实HTTP协议、超时、来源版本/数值校验及原算法；本片只增加CRF专属manifest/结果投影，不修改旧算子 |
| 旧`research-method-quality-manifest.ts` | 复用类型/PHI键检查/稳定hash定义；**不直接调用assembleQualityManifest**把CRF伪装成旧人口学、入组、量表或全Study事实 |
| 旧`data-quality-execution.ts`、`research-method-quality-mapper.ts` | 作为原链参考；其mapper附加全项目验收矩阵、旧阻断/放行语义，故本片选择**WorkerClient＋原数值校验＋窄投影**，不调用旧质量放行评价，不改原执行链 |
| `scripts/local-synthetic-quality.mjs` | 参考原run模型、共同授权锁、CAS认领和精确ID调度；不调用带授权初始化的工厂，不调用generateSyntheticDataset/qualitySourceRows替换CRF |
| `scripts/local-knowledge-ai.mjs`与原Queue/Orchestrator/KbTools/Provider | 增加第五互斥任务意图，复用当前会话/Agent/KB授权、真实检索、费用与最终assistant事务；不更改原四族行为 |
| 原ResearchArtifact/Version/Source/Audit、WP06报告模式 | 追加独立新方法报告schema，机器事实/人工说明分离；不把新schema塞进旧报告，旧v1保持原读取与正文 |
| S05/S06/S10现有母版、共享Card/Button/Reading、同源Scope客户端 | S05增进入方法工作台叶子链接，S06显式真实分支呈现本片，报告在工作台内读写；不改全局导航或复制Shell，S10全量产出接入不在本片 |

首4小时D01是硬复用门槛：核对下述投影能真实执行且不污染语义、原授权足够、无DDL/旧源码改动。无法无损表达时记录阻断并停下，不更换研究字段凑旧模型，不在缓冲内另造分析平台。

## 4. 输入快照、manifest及结果口径

### 4.1 冻结与容量

不另建快照表。创建新ResearchMethodRun时，把`inputSummary.localCrfMethod`设为`rh-synthetic-crf-method.v1`：保存真实包`id/versionId/versionNo`、完整原13项binding、`syntheticDataBasis`、DQ的id/findingsHash、记录responseRevision列表、adapterVersion、coverage、紧凑manifest及manifestHash。`inputHash=edcDigest(inputSummary)`。原包不可变版本是答案真值，读取必须校验seal/归属；不在HTTP输入、Worker或LLM中接受客户端提供的答案/manifest。

快照创建前要求当前来源、准备和D01–D03质控有效；允许已保存draft/recorded记录混合、缺失和有限越界，不把“尚未完成合成录入”自动过滤掉。每个编号×访视恰一张CRF，未知/重复记录、错误类型或损坏seal直接拒绝。预览不是运行，不写DB，不以预览结果替代后续事务重验。

限定：请求32KiB，inputSummary至多128KiB，manifest至多60KiB，且含schemaVersion/executorKey/requestId/input的完整Worker请求至多65,536字节（沿用原协议，超时8秒），原始Worker响应至多128KiB，投影结果至多64KiB；超限失败，禁止截断后宣称全量。本片每包最多30个新run、列表每页1–20项，报告最多30版；原包3–5×2×1–12容量不扩大。

### 4.2 字段映射

- 固定按`visitKey + fieldKey`分组，最多24组，**不把同一被试两个访视当作独立样本混算**。变量内部名用服务端稳定hash，映射表仅在本人快照内；Worker无SIM编号、recordId、原始值数组、自由文本或更正原因。
- 每组`n`为该访视应有的SIM记录数（3–5），`nMissing`为state≠value数量；missing/not_measured/not_applicable分项保留在确定性快照摘要，not_applicable不自动豁免。0与false属于value，不能按truthy过滤。
- number/integer仅对有限value汇总min/max；expectedMin/Max仅来自对应配置明确提供的人工范围，未配置就省略，不套旧年龄0–120或其他默认阈值。
- text/select/boolean仅做缺失汇总，不把类别、文本或真假变成科学连续变量，不向Worker发送原文。字段可选但缺失仍可描述；这不等于D01必填问题或违反方案。
- scope中的nSubjects/nVisits仅表示**本人包的SIM编号与合成访视记录**。入组、量表、文件/照片、时间顺序、分组泄漏、重复时间戳、跨组平衡、全Study完成度均不属于本包可验证事实。
- 旧协议必需的未覆盖字段使用空列表/协议占位零，单独coverage标记`not_examined`；它们不是业务实测零。UI、AI和报告不得交付这些占位数值、全Study验收矩阵或“已检出0项所以通过”。不向既有正式事实表写模拟行来填协议。

### 4.3 旧算法原始输出与本片投影分开

旧Worker自带缺失率20%/50%技术告警、range finding的`n=1`表示一次边界触发，以及“阻断分析集锁定”等文案。**不修改旧算法，但不将上述阈值/文案/计数作为本CRF的审核标准、受试者异常人数或放行决定。** 原始响应仅保留为受控执行证据，不直接渲染/交给LLM/复制到报告。

`projectCrfMethodResult(snapshot, workerResponse)`在WorkerClient/原numeric policy验证后执行：

1. 校验executor、t19-1、`accepted/ok`、`llm=false/autoRepaired=false/simulation=false`、全部数值有限/有operator。纯投影只验证响应及冻结manifest可推导的事实，不要求旧响应回显不存在的requestId/inputHash。
2. 每个24组内的变量必须恰有一个`missing_rate:<variable>`，值与输入nMissing/n按原Worker六位精度一致；重复、遗漏、未知变量或错误operator拒绝，不静默过滤异常。
3. 有显式人工范围且真实min/max越界时，核对原range数值证据与冻结汇总；无范围/全缺失不捏造观察值。原始range finding.n不能当异常人数，定位链接由冻结的实际答案确定性计算，不让模型提供对象路径。
4. 只公开`missing-rate/range-check`及本人包有效计数。其他原协议输出明确未纳入，完整coverage随结果展示。结果由最多24个evidenceGroup组成，每组有稳定evidenceId、visit/field定位、原numericEvidence引用、输入分母/缺失分类及规则来源；数值由程序原样呈现。

投影后`resultHash=edcDigest(projectedResult)`，排除时间、轮询、AI与人工notes元数据。保存原始trace的私有路径/摘要，不返回Token、环境配置或不适用业务值。run始终`needs_review/pending_review`或真实失败，不写业务质量门，不显示“数据可分析/已锁定/全部通过”。

HTTP关联由执行适配器负责：注入原WorkerClient支持的fetchImpl，在实际发送前解析并核对完整序列化body的schemaVersion/executorKey/requestId、input摘要与冻结manifestHash，绑定runId/instanceId/executionToken及本次返回，保存body/response摘要、时间和成功/失败。不得保存认证头。此为本机可信调用关联证据，不是Worker回签输入hash；关联不一致不得提交结果。

## 5. 原子创建、认领与失效

新run前缀`rh-crf-method-20261025:`，另存本片marker、owner、planId、collectionId；所有查询同时限定tenant/group/project/account/Agent/Skill/前缀/marker和真实父对象，不信URL或管理员身份。

创建在原`withCollection`共同授权事务内：重验原权限＋R01＋现有Feature/Skill/Assignment/KB/会话及来源、校验包根CAS/当前DQ→冻结inputSummary→新queued run＋审计原子提交。无包/父方案写入。`requestKey`8–128位ASCII字母数字下划线连字符；先核对同键kind/body hash/owner/真实父链，再返回同一run，同key异输入409，重放不重新执行。

共同授权锁不被假定为包级排他锁。新run创建须在同一事务中另取`pg_advisory_xact_lock`：服务端规范化`rh-crf-method-create.v1/tenantId/accountId/collectionId`经SHA-256取前64位转有符号bigint作锁键，参数化调用、固定在共同授权锁之后取得。锁内重新读取head/DQ、同键、活动run与容量后创建；锁键碰撞仅保守串行，不放宽归属。不同key同包独立连接并发只能一个成功，另一请求409；同key只返回原run。不新增表/索引、不更新包根来冒充CAS锁。

一次提交成功后仅调度**该次新ID**。每包最多一个当前启动instanceId的queued/validating/running任务；活动查询有本片/owner/包过滤。不轮询全表、不恢复历史任务。状态复用`queued→validating→running→needs_review|failed`，原reviewStatus保持pending_review。

认领用实际状态/updatedAt/inputHash及随机executionToken CAS；每次服务启动生成随机instanceId，创建时写入environment，活动查询/认领/提交均核对当前instanceId，hostPid仅作诊断。worker前重验当前授权/父对象/数据/DQ及预算无关的R01，Worker回环配置来自已批准本机私有文件，不读旧.env/远端。成功提交在相同授权锁/真实包校验事务内重验上述条件及claim token/run状态/inputHash，结果＋来源摘要＋审计原子保存；不能无条件update。

失败/超时同样限定owner/marker/id/token/instanceId/状态/inputHash/CAS，不覆盖后来的状态；授权失效无法安全写回时只在本机内存记录interrupted，不绕权做elevated兜底。重启后instanceId不匹配的旧在途在授权读取时投影为interrupted（即使PID相同），不计为当前活动、不写旧行、不认领/补提交；用户核对后显式创建新run，失败原run留存，不自动重试。

freshness比较真实**当前head**的原binding、dataRevision/dataHash/configHash及DQ id/findingsHash，不拿冻结版自身当当前；改回答案也不复活。包/报告/AI元数据不应使未变数据过期。历史结果只读可核对，但过期不能生成新AI或新报告；来源受限或R01/原Skill撤销时所有私有快照/结果/比较/关联报告与原消息立即隐藏。

## 6. AI解释与原会话读取

新payload `researchCrfMethods:{kind:'result_interpretation',binding,evidenceIds,requestHash,baseRunVersion,requestKey}`与原researchPlan/researchDesign/researchExecutionPreparation/researchSyntheticEdc四族互斥；损坏marker/未知kind/缺失选择不回普通问答。binding除冻结来源/DQ外包含runId/inputHash/resultHash和选定evidenceIds hash；evidenceIds为原顺序1–6个唯一真实组，摘要必须匹配，requestKey保留客户端原键，requestHash必须等于重建完整原请求体的摘要，实际job命名空间键另按tenant/account/原键核对。baseRunVersion保留真实方法版本。

只对当前`needs_review`且结果通过校验的本人run，显式选1–6个evidenceGroup后发起；原Agent/KB/工具/模型/token上限不扩展，不启用WebSearch/WebFetch。终态run完全只读，包括artifactRefs与updatedAt，不改触发器、Schema或状态。新job（含上述不可变请求选择）/user message/审计同原队列事务提交。锁顺序为原共同租户授权锁→精确本人run行锁（SELECT FOR UPDATE，限定tenant/group/project/account/id）→重新读取真实父对象/当前数据/DQ/run并核对runVersion/resultHash→同键/不同键在途重验→原队列创建；不以只读取代并发防重。

同键按原tenant/requestKey唯一键读取，再逐项核对真实owner/session/父对象/run/请求hash；同键同输入返回原job，不派发第二笔，原队列并发命中existing返回后也重验请求hash。不同键只有同run没有queued/processing任务时可创建。最新/在途查询均限定tenant/group/project/account/session/第五kind/plan/collection/run，按createdAt/id倒序take 1，不扫描或恢复历史任务。原队列已有session advisory lock先于本片hook，保持不改；hook内部共同授权锁→run行锁→重读的顺序固定。后续原Message provenance及AuditLog关联真实job/run与选择；pending/历史从原job投影，不回写run。runVersion采用真实updatedAt的ISO字符串，不把job变化伪装为方法版本变化。读取/执行/最终提交重建选择摘要并核对job的完整请求hash及版本，缺失/损坏一律拒交付。

模型只接：去数值配置/已确认意图、选定组的技术类别/定性状态、方法能力与限制、最多6个固定审核片段。**不发送原答案、聚合数值、比例/阈值/科学数字、更正原因或未覆盖原Worker输出。** 数值表由程序渲染；AI只写解释/局限与待确认问题，不推断疗效、不调整参数。

严格JSON：`{items:[{evidenceIds,explanation,question,sourceRefs}]}`，1–6项。每项evidenceIds为所选真实ID非空子集；explanation非空、≤600字符，question可空，否则≤600且为问句。sourceRefs为`{kind:'method'|'knowledge',index}`；每项必须有真实方法引用，正文`[M1]`对应本次选定组，知识正文`[1]`仅对应实际固定KB片段，数组和实际正文引用集合精确一致。方法引用不能伪装成KB摘录；没有引用的文献事实拒绝。科学数值、虚构来源、自动修正patch/操作指令拒绝，不自动付费修复输出；技术ID/引用编号仅按精确可信集合豁免。

复用旧known-provider/非Mock/usage/工具轨迹检查；新分支允许实际方法引用，不为凑原问答的KB引用强迫模型引用无关论文，旧四族`assertAnswer`规则保持。原KbTools仍实际核验固定KB，工具未执行不认定本片AI真实通过。

第五kind装配契约（仅当前新分支，旧四族默认路径不变）：

| 接点 | 固定输入/输出与校验 |
| --- | --- |
| `prepare` | 返回可信turn DTO：kind、binding/run/resultHash、selectedGroups、methodRefs、sources、modelView、query、kbId；原始来源版本/hash与去数值modelView分开保存，客户端不能覆盖 |
| `prompt(turn)` | 仅第五kind返回JSON契约、方法引用规则和去数值方法背景；其他kind返回空。不拼接旧“必须KB编号”提示或grounding；方法引用可独立成立，涉及文献事实仍须真实KB引用 |
| `providerOptions(turn,opts)` | 第五kind在chat与chatWithTools实际Provider参数中均合并既有模型/token限制及受支持JSON配置；若工具轮不支持JSON模式则明确仅在最终综合轮配置、用严格accept校验，不声称工具轮已强制JSON。D01核对旧Provider实际签名，无需修改旧Provider |
| `toolEvidence(turn)` | 原KbTools真实执行一次后，仅输出可信methodRefs及最多6条KB去数值模型视图。含科学数值/阈值的摘录不能原样入模型；可纯提取非数值句，无可用句则标记无可交付文献文本，不捏造摘要。原KB原文/hash只在受控来源核验与用户来源页使用 |
| `accept(result,turn)` | 第五kind专用严格JSON/数值禁入/方法与知识引用验证替代通用assertAnswer及旧KB强制规则；实际toolExecuted/provider/usage守门仍执行，失败拒交付而非回普通问答 |

新turn的system、用户任务、工具消息、两种Provider请求、返回解析和最终provenance均纳入纯契约测试，不能只测试一个prompt字符串；引用编号/可信ID不作为科学数值处理。

第五意图的数量禁入/禁出同时覆盖英文数量词、分数词及Unicode数字/分数/上标等表示，输入各处统一屏蔽、知识数量句拒绝摘入，输出不自动修补而拒绝交付；只保留真实引用及精确可信技术ID例外，不修改原四族。失权/解释目标变化既清正文并失效读取序列，也同步释放busy/reading/ref；迟到200不能复活正文，恢复授权后可显式重新读取，不以永久禁用当权限保护。

beforeAssistant在原最终事务中用当前R01/R02/原会话/Agent/KB/Skill、run终态/resultHash、真实数据/DQ/来源及pending job再验一次；在途改值、重检、撤审或撤权不交付旧assistant。completed含义只是候选完成，专业待核。

解释保存在原不可变Message provenance `researchCrfMethodsResult`，绑定run/input/result及选定组。S06、关联报告、原knowledge-state与knowledge-sources均走同一新kind投影；损坏或受限隐藏正文/引用，过期标stale/historical，恢复scope不复活旧父版。方法引用回链本人run/冻结组，不调用KB source端点冒充文献；KB引用仍重验真实doc/chunk/version/hash。

## 7. 新方法报告与比较

报告为**独立新草稿**`data_quality_report/draft`、marker/schema `rh-synthetic-crf-method-report.v1`，通过原Artifact/Version/Source/Audit保存。不是对旧WP06 v1报告无声换schema；已有报告/说明/正文均不改。新方法报告自己的notes修订才追加版本。

新报告幂等键命名空间`rh-crf-method-report-20261025:`，同owner/真实run/请求体摘要先验；同键同输入返回已持久化结果，异输入409，不与旧EDC报告键混用。

本机首切片每个run最多30份新方法报告草稿，每份最多30版；run详情仅查询精确本人run命名空间并返回这些报告摘要，不另建全局产物列表。超过容量429，不静默截断。创建/notes沿共同授权锁后使用同一真实run行锁并重读上下文；run只读，不改updatedAt。Sources采用原canonical helper规范化后交给原Artifact服务，JSONB往返后可重验原生hash，不修改旧服务的legacy hash规则。

机器facts固定：真实包不可变版本/答案修订/配置与PICO来源、原D01–D03快照、runId/inputHash/manifestHash/resultHash、executor/worker/adapter版本、实际数值及coverage/不适用范围、选定真实AI消息与方法/文献引用或明确未请求/未选用/失败/过期。不能把新方法覆盖当全Study覆盖，不从旧seed报告拼字段。

创建时显式选择解释messageId或null；null不等于未运行，应根据真实job显示not_requested/pending/failed/not_selected/stale/unavailable。AI尚未真实验收不因报告能生成而销项。报告＋原生Sources＋审计原子写入，来源至少包括真实包Version与ResearchMethodRun；不制造不存在的方法ID。notes≤6000字符、CAS/幂等/30版、只读facts；无变化请求422且不返回未持久化成功键。原包/run数值不变。

比较只允许同owner/Study/collection、相同configHash/adapterVersion的两个真实run，按visit/field并列输入修订、缺失与数值；旧run明确stale，不计算P值或因果结论。不同包/配置/任一受限拒绝；不在找不到目标时回退最新run。

左右摘要各携带既有包versionNo、dataRevision与inputHash；表格各侧明确展示人工范围观察（值/边界）或未配置/全缺失未检查状态。缺失指标相同但范围值变化不能被渲染成看似无差异；展示不新增算法或自动判断更正正确。

## 8. 拟定接口与前后端约定

均在`/api/research-plan-drafts/:planId/synthetic-collections/:collectionId`下，原Cookie/Scope/guards继续生效。只开放以下精确路径，不开放通用methods/产物/worker代理接口。

| 方法/后缀 | 严格输入 | 输出 |
| --- | --- | --- |
| GET `/method-preview` | 无业务query | 当前version/dataBasis/DQ/字段映射/coverage；未运行 |
| POST `/method-runs` | baseVersionNo,qualityId,requestKey | `{run,operation:{id,runId}}`；原子冻结并建run，未完成不伪装成功结果 |
| GET `/method-runs` | limit默认20，1–20；cursor可选 | `{items,nextCursor}`；游标必须属于同owner/包，顺序createdAt/id倒序 |
| GET `/method-runs/:runId` | compareRunId可选，除此无query | `{run,comparison?}`；实际runVersion、sourceStatus、coverage、可执行动作 |
| POST `/method-runs/:runId/interpretation-jobs` | baseRunVersion,resultHash,evidenceIds,requestKey | `{run,operation:{id,jobId}}`；同键不再调用 |
| POST `/method-runs/:runId/report-drafts` | baseRunVersion,resultHash,interpretationMessageId（可null）,requestKey | `{run,report,operation:{id,reportId,versionNo}}` |
| GET `/method-runs/:runId/report-drafts/:reportId` | 无query | 本人报告/当前授权/源有效性 |
| GET `/method-runs/:runId/report-drafts/:reportId/versions/:version` | 1–30 | 历史只读，freshness仍相对当前head |
| POST `/method-runs/:runId/report-drafts/:reportId/notes` | baseVersionNo,notes,requestKey | `{run,report,operation:{id,reportId,versionNo}}` |

所有body精确键集，类型/未知键/越限400，401未登录，403无scope/非本人/真父不符，404本人对象下不存在版本，409 CAS/来源/状态/同键异输入冲突，422语义不支持/无变化，429费用或容量限制，503Worker/必需服务不可用。异步Worker失败在run显式failed/errorCode，不伪装HTTP已出数值。错误沿现有`{code,message,fieldKey?}`形状，不引入第二套错误封装。

内部契约（拟新增，不是已有函数）：

```js
// 直接消费服务端已验证包，不接受用户上传manifest。
buildCrfMethodInput(packet, quality, packetVersion) // => {snapshot, manifest, inputHash, manifestHash, coverage}
projectCrfMethodResult(snapshot, workerResponse)    // => {result, resultHash}
compareCrfMethodRuns(left, right)                  // => 按visit/field并列；不改值
parseCrfMethodInterpretation(text, trusted)         // => 可信IDs/实际引用/去数值JSON
createLocalCrfMethods(options)                     // => {Controller, inRun, withRun, read, setAi}
createCrfMethodsAi(options)                        // => setQueue/onJobCreate/prepare/prompt/providerOptions/toolEvidence/accept/validateTurn/projectMessage/readMessageSource
createCrfMethodReports(options)                    // => {create,read,save}
```

run视图的来源状态current/stale/restricted与执行status分开；action能力由服务端当前授权计算，不以按钮隐藏代替拒绝。

## 9. UI/UE验收

S05本人包加“查看方法执行与结果”链接；S06仅`crfMethods=1`且合法studyGroupId/researchProjectId/researchPlanId/collectionId时进入真实功能岛，runId/compareRunId可选。拒绝混合demo/projectId/外链/重复query；未知run不回示例。返回保留包和记录上下文；不新增一级导航/全局身份区，S10母版不假装已接全部真实报告。

S06顺序沿现有结果页职责：真实输入/覆盖→主操作“冻结当前已保存数据并执行”→实际状态和结果表→对比→AI解释→方法报告。科研与管理员同样受本人限制；管理员其他治理页无新权限。加载/空态/无权限/过期/服务失败各自反馈，不能把未运行或不适用显示0。

复用共享Card/Button、原数值表风格和安全Markdown；操作/输入/表格14/22，连续解释/报告16/28、最大48rem，说明13/20，元信息12/18。局部CSS、单h1、重要风险不缩字、不全局改Shell/Token。显式真实路由局部解除历史demo最小宽度，不能影响其他页。

列表仅手动刷新/分页，加载更多和刷新单飞；详情与报告自动读单飞，慢于轮询周期仍能应用，身份/目标/保存变化才淘汰旧响应。解释选择绑定resultHash，跨run/数据修订清选择；notes dirty保留原CAS，409/超时不丢输入，明确放弃才重读。401/403/restricted/logout立即清私有快照/解释/报告，不能为保dirty而保无权正文；实际迟到200/复制反馈不得复活或串目标。不支持取消后台时不显示假取消。

真实Chrome覆盖1440×900、1366×768、1920×1200、390×844、320×844及原生200%；两个原账号各自完整新材料链、键盘/首错焦点/慢读/幂等/失权/返回；截图、录屏、computed字号留证。复制/导出若无入口明确不适用，不加空按钮。复用C09慢分页、确认跨版、历史stale、注入未命中回滚等反例。

## 10. 验收、四层状态与工期

| 编号 | 可验证标准 | 计划 |
| --- | --- | --- |
| AC01 | 首4小时证实窄manifest/投影可表达且权限/旧源边界成立；不成立停下 | D01 |
| AC02 | 冻结真实CRF，0/false/四状态、分访视分母与手工范围正确，无raw值/更正原文出Worker | D01/D02 |
| AC03 | 实际Worker HTTP/版本/manifest及golden结果一致；无旧seed/全Study零值或默认阈值冒充 | D03 |
| AC04 | 两独立请求争用只认领一次、同键幂等、失败/重启不自动恢复；成功/失败/注入未命中都原子或安全终止 | D02/D03/D07 |
| AC05 | 当前head/数据/DQ/原Skill/新scope/来源重验；在途失效无交付，原会话/引用/报告不旁路 | D03/D05/D06/D07 |
| AC06 | S06真实列表/详情/比较/慢读取/解释选择/错误恢复，两账号各走通；风格/字号/缩放达标 | D02/D04/D05/D07 |
| AC07 | 原科研Agent真实新请求、实际工具/usage/方法引用与JSON边界通过；未批费用不销项 | D05/D07 |
| AC08 | 新报告真实run/input/result/coverage和AI状态，notes/CAS/历史/幂等/来源正确；原报告字节保持 | D06/D07 |
| AC09 | 单元/合成PG/API/真实Chrome及原链回归/保全、一次实施后独立代码总评审/修补、产品/使用/技术/测试和Notion同步 | D07/D08 |
| AC10 | 用户以未预运行新合成材料确认输入、定位、方法局限、解释和报告确实有科研价值，不误认为正式分析/放行 | D08后用户 |

代码实现→本机配置启用→真实请求执行→用户专业标准分别记状态。文档评审不替代代码/运行/专业验收；Mock仅证契约，health不证方法已执行。每次模型失败与已发生费用保留，不自动重试，不以其他成功步骤掩盖。

工期24＋8=32小时，3天实施＋1天缓冲；若10/26批准且必要授权/费用/输入就绪，10/28技术交接目标、10/29缺陷缓冲，非无条件承诺。第半天/第2天末/第3天末复估，超32小时或新增范围先确认，等待时间单列。不默认周末加班；11/04、11/06全量复估、11/09–13专业回归及11月中旬目标保持，正式EDC/完整联网/其余AI/发布不能据本片销项。

## 11. 拟实施位置、命令及边界

新增脚本集中`scripts/synthetic-crf-methods-*`、`scripts/local-crf-methods*.mjs`，纯夹具`tests/fixtures/synthetic-crf-methods.mjs`；页面`pages/shared/CrfMethods*.jsx`及局部CSS，路由`src/crf-methods-session.js`。必要窄修改仅WP06适配器暴露同事务读接口、原AI装配/第五任务、同源精确白名单、S05→S06链接及真实分支页头；不重构旧大文件/全站IA。

代码风格沿本机ESM/JS＋JSDoc、纯函数严格断言、服务边缘HttpException和已验证的同事务回调；参考`synthetic-edc-contract.mjs`，不引入新的TS构建/依赖。函数名、task marker、接口和测试落点以[小步计划](../planning/synthetic-crf-methods-2026-10-25/implementation-plan.md)为准。

以下为**批准后拟创建并执行**的命令，不表示本轮已经有脚本或已跑：

```sh
node --test scripts/synthetic-crf-methods-contract.test.mjs
node --test scripts/synthetic-crf-methods-projection.test.mjs
node scripts/synthetic-crf-methods-api.mjs --mode local-synthetic
node scripts/synthetic-crf-methods-worker.mjs --mode local-synthetic
node scripts/synthetic-crf-methods-browser.mjs --mode local-synthetic
node scripts/synthetic-crf-methods-ai-live.mjs --approved-one-round
node scripts/synthetic-crf-methods-free-gates.mjs --mode local-synthetic
pnpm run build
```

始终：先RED/最小实现/GREEN、全部适用层次证据、限定新具名夹具、保全旧源/历史/账本、文档同步。先问：R01–R03、付费核价/调用、旧源/Schema/算法/依赖变化、云/远端配置/发布、超32h。绝不：临床材料进开发会话、凭证泄露、LLM数值、自动放行、Mock假成功、历史任务扫描和用技术通过代签AC10。
