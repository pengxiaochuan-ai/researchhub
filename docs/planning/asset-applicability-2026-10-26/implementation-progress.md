# WP09首切片实施台账

## 2026-10-28 本机AI验收续篇（AC10待用户）

仅本机专用合成环境：原10任务、9请求、88笔账本全保留。新增私有验收凭据绑定原审批/两次扩展、已用9请求及88笔费用前缀；WP09新报价不修改原账本的过期时间，普通预算调用仍`QA_PRICE_EXPIRED`。新门禁20任务、12实际请求、累计¥5；每次8192字节/1536输出Token，未知/在途/到期停。先观察2项新增测试RED，修补后补第20/21任务边界；最终23项费用/预算专项及408项项目纯测试、1054项旧内核通过。聚合门禁中的pnpm自检失败，直接调用现有Vite构建成功；保全691旧源、115表41128前序行、旧进程/旧scope和79笔原前缀通过。

新管理员U04夹具任务`acceptance-admin-fixture`真实完成，原Agent实际调用`kb_search`→原KnowledgeService/pgvector，严格来源与人工意见/历史接口通过；Chrome两账号5项，新结果和引用可读，另一账号不可读，桌面1440/移动390无横向溢出、正文16/28。现11任务、10请求、89笔known、¥1.931292、0held/unknown/在途；本次1请求¥0.031734，付费开关false。独立只读审查无阻断性代码问题，两项重要建议已补测试和改文档，见[续验审查](acceptance-fee-review-2026-10-28.md)。技术四层前三层有证据，第四层专业AC10待用户。证据位于`/Users/mac/aisciencesys/docs/test/evidence/2026-10-28-researchhub-wp09-acceptance/`；下方旧检查点不重写。

## K08当前技术交接（2026-10-26，AC10待用户）

K06界面、K07联调及K08唯一独立代码总评审的技术工作已完成；专业AC10尚未签署，不称完整WP09/AI-15、一期或生产验收。独立原结论为With fixes（0 Critical、4 Important、无新增Minor），原文保留；主实施逐项RED→GREEN修补，不冒称独立二次复签。修补涉及明确倍数/分数表述的输入/资料/输出边界、空访视映射未声明、依据选择跨轮询保留及同基准自检提示；回归另修复在途轮询误取消历史目标读取。只改本用途，不改旧内核/权限/共享底座。

最新证据：browser-5ce391ba两账号26项（含真实在途轮询）；browser-auth-0d9780ee两账号12项；browser-visual-c05c9683两账号原生Chrome200%/键盘/字体；browser-review-97b2ea20两账号11项（本人新记录两次显式意见保存，不增AI）；前序本轮flow-dc2290c7的22项真实PG/CAS/幂等/意见链仍保留，不盲重跑。review-readback-92bc6049读取32记录126版本，0摘要受影响、0历史改写，三份原始真实模型输出通过新严格契约免费回放。free-gates-dba74990：404纯测试、1054旧内核测试、构建/保全/空白全部通过；691旧源码、115表41128前序行、三旧scope和八旧进程不变。PNG/WebM、失败与原评审均留痕。

本轮0新Provider/费用；累计仍10job/9实际HTTP/88笔known/¥1.899558，paid=false、任务额度已满，不因余额自动续跑。只用专用合成库，七个本机服务就绪，不接临床库、不动旧服务、不发布。用户可先阅读已有结果并体验意见闭环；正式AC10的新合成AI任务须另确认。后续仍保留11/04、11/06全一期复估和11月中旬交付目标，不借本片销掉其余业务/AI/正式治理。

完整证据与AC10验收卡见本片实测文档，原评审与作者复验见planning同日目录code-review.md；61项最终源码摘要见implementation-k08-checkpoint.json。Notion同步状态以最终回读收据为准。下方K06/K07“待总评审”和更早停止点均为历史，不恢复旧任务。


## K06/K07本机界面与全链技术验证（2026-10-26，K08待总评审）

用户已明确继续K06及既定后续。A02新资产核对族接通：本人源候选/目标固定版本→六组逐子项声明规则→已有真实AI定性解释及typed来源→免费规则或明确AI依据的人工意见→分批提交/固定历史。原资产/目标只读，不套用或新建研究；本轮派生参考目标不冒称新PICO确认。原Q01不支持固定历史URL，故目标通过既有versions接口在本页只读核对，源候选保留原固定历史回链。

真实Chrome：browser-d72086b8两账号26组（五视口、已有真实AI/来源/固定历史及错路由拒绝）；browser-flows-dc2290c7两账号22组（新建、真实PG保存/CAS/响应丢失原键重试、读完整性/网络故障恢复、真实U02/U03撤销、AI依据显式切换/同消息分批意见）；browser-auth-03bf0b6a两账号12组（非首项/固定历史精确探针、在途撤销/迟到200、实际Cookie换账号和退出）；browser-visual-b6fa3363两账号原生Chrome200%/键盘，Reading16/28、输入及重要限制14/22。相关PNG/WebM和初始失败永久保留。已观察并修正：无AI历史误禁目标读取、通用演示提示、错误A01新族继承旧动作、成功HTTP探针未传播U02/U03撤销。移动截图先等既有侧栏动画结束；测试自身字段集disabled判定及异步选项等待问题不记产品修补。

本轮0新Provider/费用，仍10job/9实际HTTP/88笔known/累计¥1.899558；paid=false且10job已满，不借余下HTTP次数启动新任务。六笔已批Token对账已收尾；不续额/充值、不改角色/旧源码/旧scope/前序行/旧服务。完整免费门禁free-gates-99436190为399纯测试＋1054旧内核、构建/保全/空白通过（其后仅本片路由窄修，最终门禁待收口）。仅本机合成技术证据；K08唯一独立代码总评审与用户专业AC10未完成，不称WP09整片/完整AI-15/一期或生产验收。下方旧K05停止点/无UI等为历史，不再作为当前指令。

## K06继续实施（2026-10-26）

用户明确继续新UI及既定后续验证/唯一独立评审。本轮只用原两账号、当前Study/本人新对象；前序只读、paid=false、10job已满。新界面复用已有三份真实成功AI结果，0新增付费任务；专业AC10保留用户确认。先补严格路由与同源transport测试，再接A02工作台/来源/意见/历史；不改共享底座、原权限或旧服务。

## K05技术验证与对账收尾完成（2026-10-26）

当前机器恢复点：`implementation-k05-continuation-checkpoint.json`（本轮新增、已收尾）；原`implementation-f01-checkpoint.json`保留上一轮历史，不据此恢复或重置额度。本轮Task5四类真实验证与6笔已批对账已完成，最终`free-gates-e59cd139`394/1054等通过，task-done已登记Task5 complete；K06/K07/K08及专业AC10仍待后续，当前不自动继续。

真实证据：`ai-live-owner-selected-reconciled-7371b2eb`、`ai-live-admin-selected-d3c23ef5`、`ai-live-general-8510b5fb`分别已交付6组定性解释，原工具kb_search/pgvector/DeepSeek、当前typed来源回读、跨账号拒绝、规则→AI意见显式确认、历史及幂等均通过。`ai-live-revoke-final-c4c9553d`在实际Provider请求途中撤U03，最终明确APPLICABILITY_SCOPE_RESTRICTED且0assistant、known¥0.038313；先前`ai-live-revoke-13ce5061`来源17/15超12，失败未算通过。不能仅凭“0回答”证明撤销。

免费证据：`messages-preflight-5df66e31`5组真实PG回滚，包含当前授权先于无效输出；`free-gates-d56b2e22`393纯/1054原内核、构建/保全/空白通过；`runtime-preflight-e9169fa9`两账号4组实际HTTP、0新job/message/version；`shell-browser-612d8b77`两账号现有P003身份页桌面/移动Chrome PNG/WebM、0模型/费用不变，不代表K06。只重载自有七口，当前PID747；旧8服务不动。最新收尾门禁/源hash另以checkpoint登记。

对账证据：`reconcile-originals-preflight-8ff97b7a`原Billing真实写后回滚，`reconcile-originals-apply-e85320a2`4笔真实用量12540/多余36612释放；`reconcile-revoke-apply-aea2f1a1`按已批准第5笔settle，未冒称负例通过；`reconcile-revoke-apply-d655ca47`过窄错误码门禁先拒绝、0写，随后限定同一revoke任务与ready证据才处理。原5笔审批未改写；用户另批精确第6笔，final-extension仅绑定revoke-final真实任务/预留，`reconcile-revoke-final-apply-7e3209c7`按2601真实Token结算，0新Provider/费用/额度/角色。Provider费用known与业务Token待对账是不同账本，不把后者写成未知外部费用，也不凭known费用擅自释放原预留。

2026-10-26：K05技术验证及本轮对账收尾已完成。原owner/admin各成功一轮、未预运行通用新例成功；最后具名任务在真实Provider在途撤U03后以APPLICABILITY_SCOPE_RESTRICTED终止且0assistant。仅新purpose采用模型明确选sourceIds→后端严格校验/确定性引用渲染，回模后先重验当前授权、最终原子提交仍再验；旧内核/角色/科学数值规则不改。累计10job（3成功/7失败，含1笔Provider前Token额度拒绝）、9次真实HTTP，88笔费用全部known，累计¥1.899558/¥5；上限10job/12HTTP，原79笔和全部失败保留，不充值/续额/自动重试，paid=false且0在途。本轮6笔已知Token预留均按分别批准的范围，经既有合成平台管理员与旧BillingService完成真实用量对账，0新额度/权限/历史预留修改；最后2601 Token已结算，不再有本轮待对账项。最终394纯测试/1054旧内核、构建/保全/空白通过，SDD Task5已登记complete。仅K05技术范围通过，不等于WP09整片交接或专业验收：K06新UI/K07全链/K08唯一独立评审及专业AC10未完成，当前请求止于K05，不自动开始K06。现有两账号身份页Chrome回归不是新工作台浏览器验收；以下早期停止点/待批/旧上限均为历史。

## 当前：最小契约调整已批准，继续K05（2026-10-26）

用户明确批准新分支模型仅输出解释/问题/来源标识，由后端严格验证并统一渲染引用。已补规格和task5四小步，不改原typed Message/state/source/意见协议、旧内核或科学数值守门；sourceIds仅A/T/K真实标识，空/重复/未知/错组/无声明/正文假引用仍拒绝。17项契约已观察RED→GREEN；`messages-preflight-21a6d016`四组实际PG/Message回滚，`provider-preflight-436f5eb0`原Provider拦截7454字节并通过原科学守门离线对照。均0模型，不称AI成功。原4次失败/¥1.715166保留；仅余4实际HTTP用于两账号成功/新例/真实在途撤销，10job/8HTTP/原¥5不变。下方等待契约批准为本次回复前历史。

## K05续验当前停止点（4次均拒绝，非交付）

2026-10-26：用户批准最多10job，HTTP仍8、原累计¥5、无充值/续额/自动重试。本轮追加owner-confirmed和owner-paired各一次HTTP，均known但0assistant；当前83笔／¥1.715166、0held/unknown，实际任务/请求累计4/4。scope已恢复paid=false，不继续消费剩余4次HTTP。K05未通过，仅等待本片新输出契约评审，不恢复K06–K08或其他WP。

- `ai-live-owner-confirmed-d3fd31c1`：新增¥0.041265；命令式问题/缺行内引用/技术字段，拒绝。
- `ai-live-owner-paired-b3ccc6d2`：job `cmvp4e4d9000wluh6ufd6h6i4`，新增¥0.049041；实际原始JSON仍缺行内引用并含未定义pico分组。配对输入压缩引入兼容回归：整数来源索引只以A/T标识出现，旧数值守门不识别其整数证据，从而替换索引、破坏JSON。属于本次新接线问题，不放宽原科学数值守门。
- `output-replay-52696376`：0DB写/0模型/账本不变；四次真实失败仍拒绝。独立回放证明第四次原始JSON本身不合格；手写合格JSON虽通过本片parser，现输入却被旧守门替换索引。只在离线对照提供可信整数locator证据后旧守门保持JSON，且本片parser仍拒绝相同数字用于样本量。对照没有修正真实输出或写入assistant。
- `provider-preflight-16bede05`：原Provider本机拦截组装7374字节／输出1536；0远程调用，不是模型成功。`free-gates-8fdbc37d`：383纯／1054编译内核、构建/保全/空白通过。最新收尾门禁另追加，不用测试全绿替代K05业务结果。

**待评审最小调整（未实施）**：仅WP09新purpose中由模型输出定性解释与明确选择的来源标识；后端验证真实归属/当前版本/同组/引用上限后统一渲染行内引用及现有typed来源。缺失、越权、不存在来源仍拒绝，不自动猜引用、不修JSON、不静默丢组、不改旧内核/权限/数值守门。消除模型同时维护正文编号和来源清单的双份契约。采用前须用户确认和先补规格/RED测试；费用门槛与四项真实验收不变。

## 当前继续授权（2026-10-26，K05验证中）

续验第3个任务`owner-confirmed`也被严格拒绝，证据`ai-live-owner-confirmed-d3fd31c1`：问题是命令句、缺行内引用，并复述技术字段；0个assistant交付。累计3job／3次实际请求，82笔known／¥1.666125，scope已恢复paid=false。只在原新purpose边界改进定性输入呈现：将分离表改为同组逐项配对的资产/目标声明、程序状态与可逐字引用编号，明确非空问题必须是真问句；后端typed引用、12引用上限、数值拒绝、授权和结果解析标准不变。先通过免费逐项无损投影/原Provider组装/保全门禁，再以新具名任务手工单次验证，不重放前三次，不消耗名额凑满。

用户要求继续完成K05，并明确批准“最多10个任务，其他限制不变”。总job上限10包含已失败2个；实际Provider HTTP仍累计最多8、原费用累计¥5、无充值/续额/自动重试，原两合成账号/当前Study/本人本轮新对象及禁止项不变。保留原fee-approval/79笔基线及所有失败记录，用绑定原审批hash的新增具名任务上限凭据承接，不改写原授权/账本。先免费回放/门禁测试，通过后仅跑验收所需新任务；不是把10个名额全部跑满。下文4→6待批为已被本次10任务批准替代的历史。

## 当前停止点：真实AI输出拒绝，待确认验证任务额度（2026-10-26）

F01按批准执行2个具名job／2次实际Provider HTTP请求，均known；新增保守费用¥0.105894，累计81笔／¥1.624860／¥5，无unknown/held。原79笔完整前缀/报价元数据保持，审批前两免费失败probe未计入付费任务。费用开关已恢复false，**不再派发**，不充值/续额/自动重试；原4job/8请求上限未擅改。

原Queue/Orchestrator/KbTools的kb_search、KnowledgeService pgvector及DeepSeek真实执行，但**0个AI回答交付**：

- owner：`cmvp1pemz000ylursyaiulbwj`，`ai-live-owner-838df54c`，¥0.051876；sourceRefs列出资产/目标但正文缺A/T行内引用，并复述技术标识，严格parser拒绝。
- admin：`cmvp1u8g0000wluxl0vcbgm8s`，`ai-live-admin-c0aa68c8`，¥0.054018；部分组20/16引用超过每项12上限，且照抄空泛模板，拒绝。即使格式通过，空泛文字也不证明科研价值。

没有放宽引用/数值/上限、补引用、截断、修理JSON或回填assistant；原意见仍为规则依据。已免费修订提示，移除可照抄的结论示例，明确具体解释/少量直接引用/12上限；源码改进不是新真实成功证据。两个失败任务保留，不重放/重置以借额度。

K05已补消息/state/source完整双端校验、不可变结果父对象/执行版、typed来源及AI意见依据接线。`messages-preflight-5d0193a6`四组为原PG回滚构造Message＋admission stub，不冒充AI成功；`runtime-preflight-2119de44`两账号四组真实HTTP通过：F01 false拒绝入队、通用聊天拒绝、撤U03后消息/来源拒绝而免费规则可读。`provider-preflight-a8485718`原Provider最终组装8050字节/JSON/1536输出/原KB快速路径，HTTP本机拦截，不是真模型；实际收费执行只由上述真实轨迹证明。

仅重载自有七服务。旧重载脚本因前序未运行test run无trace提前退出，未停进程；新具名重载器仅将保全基线中逐行摘要不变的历史run视为历史，不恢复或改状态，任何新在途任务仍拒绝重载，不做生产排空协议。

**建议待批**：保留“两账号各成功＋未预运行通用例＋真实在途撤销不交付”四项独立验证，在已失败2job外再有最多4job，总上限4→6；HTTP仍累计最多8、原¥5不变、不自动重试。新增2job尚未批准，私有审批和门禁仍4。K05不记complete，K06–K08未启动，本片Chrome与AC10未验。


## 最新：F01有条件核价与调用批准（2026-10-26）

用户本轮“批准”对应上一轮明确的F01-A/B联合请求：先核对官方价格，满足原累计¥5且无unknown/held时，最多4个本片具名AI job／8次实际Provider HTTP请求（含工具回合、失败及未交付），不充值、续额或自动重试。此授权不扩大U01–U04、账号、Study或原有禁止项。下文“F01未批”为审批前历史，不再是当前许可状态。

官方[人民币报价](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)本次核对为deepseek-v4-pro／DeepSeek-V4-Pro-0813，高峰缓存未命中输入¥9／百万token、输出¥27／百万token，保守忽略缓存/空闲优惠。原79笔known合计¥1.518966，held/unknown为0；原账本SHA256为`6ac30ad181c061d4a5821ca9bdda834adfa3284e7da1d17a5eb6a62bdd44d3fc`。

私有`fee-approval.json`冻结原完整账本文本/hash及两条审批前免费失败探针ID，不删除/重置；真实请求另存具名attempt回执，仍由原预算reserve/settle计费。每次HTTP额外限8192字节、输出1536token，沿原inputTokensUpper=4×bytes+8192，八次最坏预留¥3.280896，小于原余额¥3.481034。超过请求尺寸/4job/8请求、报价或原账本价格有效期任一过期、出现unknown/held均停。不能按残余预算自动缩减负例或追加任务。

费用guard六项已观察RED→GREEN（真实临时原预算文件，无Provider），尚不是实际模型执行。真实runtime/消息投影和K05后半仍在实施；真实scope继续false，接线及免费反例验证前不派发；K06–K08/AC10仍未完成。

2026-10-26：用户批准规格、八步、U01–U04；当前目录串行＋K08唯一独立代码总评审。F01-A核价/F01-B付费未批准；零新调用，余额不自动作为许可。仅专用合成环境/原两账号/当前Study/本人本轮新对象，前序全行只读。

| 步骤 | 当前状态 | 证据 |
| --- | --- | --- |
| K01 | 已通过免费准入 | readiness-e8e70124五组实际PG/原服务；free-gates-dc72bf24：333/1054、构建/保全/空白通过；[一期覆盖](ai-coverage.md)，专业待验不销项 |
| K02 | 免费门禁通过 | scope六项RED→GREEN；basis-session-d1f94061双账号原事务/独立会话全回滚；activate-40d9b134仅新purpose审计，F01=false；free-gates-e7f16402：339/1054等通过。有效record目的会话正例K03，消息实际装配K05 |
| K03 | 免费终门禁通过 | create-read-0adaaf7a双账号；http-0fb9742b真实同源；source-head-50921d78新子/目标换回不复活、双连接幂等及旧原写等待；atomic-e8af1729七项命中/全回滚；free-gates-31af53fb：350/1054等通过 |
| K04 | 免费终门禁通过 | opinions-39da8f7b两账号分批/修订/历史/CAS/跨动作与精确U撤销；capacity-903003e9真实分页、30记录及30版；http-d2fc5f03实际意见接口/历史/32KiB/重试；atomic-opinions-ff561ee9五项实际写后回滚；free-gates-30841252：359/1054等通过 |
| K05 | 技术验证与本轮对账已完成 | owner/admin/general真实来源结果、revoke-final真实在途U03撤销不交付；本轮6笔原服务对账；free-gates-e59cd139：394/1054/构建/保全/空白通过，Task5 complete。K06新UI及专业AC10不在此结论内 |
| K06 | 未开始 | UI/真实浏览器待实际服务 |
| K07 | 未开始 | 全链/保全 |
| K08 | 未开始 | 唯一代码评审/交接；AC10仍须用户 |

恢复点只用本片`.superpowers/sdd/implementation-plan-asset-applicability-2026-10-26/`，不恢复其他历史专项。原编制评审With fixes与主编补充不改写为代码已通过。

## 实施/失败留痕

- 本片未改原691源码/Schema/角色和前序行；U04目前每账号1新源子候选＋1引用派生目标，登记在新scope，未创建新KB、Worker或AI。独立会话只写新记录上下文。
- readiness初缺inAsset及basis-session初缺factory为预期RED；随后harness误调用未导出的plans.read，改用原withDraft后通过。规则容量反例第一次全为不同key，实际未超32，修为两端相同12字段后正确拒绝，不改容量实现。
- http-84aa08e5为未加载Controller的404；http-9125f082为新purpose被原kb解析返回400而非明确403。仅新增context专门拒绝分支后http-0fb9742b通过；未开放新purpose通用聊天或AI消息，K05仍需完整投影。
- 自有七端口无模型/队列在途后重载至PID36570；旧8进程保全通过。Node localstorage及既有chunk告警保留。未做新WP09页面/真实浏览器/付费调用，不把HTTP当浏览器体验。
- `asset-applicability-{create-read,http,atomic,source-head}.mjs --mode local-synthetic`为本片独立状态型命令；source-head仅修改已登记U04新对象，消耗版本/容量，不盲重跑。free-gates只跑纯/既有编译/构建/只读保全。
- K04意见并发初次两个提交均因正文顺序完整性被回滚：JSONB键顺序与Object.entries渲染不同（opinions-d2ee3556/5b82c026），不是CAS放行。补固定ruleId展示顺序后，两角色真实并发仅一提交；全部17个当时已存新版本只读比对可读，无重写历史。
- capacity-2716f207/ce48c416的一次事务30版循环到23版触发原20秒P2028，全部回滚；未扩大超时。capacity-903003e9按正常逐次事务保存1份本轮新记录至30版并保留（非用户专业意见），31版拒绝、容量后原key仍可查；21份有效分页和30条账户容量元数据探针均在强制回滚事务内，不称元数据占位为可用核对。
- K05输入闭合/逐组typed引用、原路径唯一、空binding拒绝等11项通过；第一次修改数值样例却沿用旧rules被正确拒绝，修测试按新声明重算。压缩path导致重复定位和undefined空binding同值比较反例均已RED→GREEN，未放宽禁入数值/同组来源。
- 原队列探针第一次把raw tx而非同一wrapped tx交给回调，version故障注入未命中，两个本轮新任务实际提交（queue-preflight-e446c170/56d37df7）。未派Worker、未调用模型或发assistant，原账本逐字节保持；修正注入器后queue-preflight-b79a31e9五点实写/回滚通过。仅这两个具名新行经原账号/真实record/session/payload/未认领重验后标failed/WP09_FREE_PROBE_NOT_DISPATCHED（resolve-free-probes-687e14de），不删除任何消息/版本，不触碰前序任务。
- 队列正例使用临时scope副本及明确paidAdmission stub、Worker kinds=[]，真实wp09-scope付费开关始终false，原角色/旧scope不改；不能将该PG原子性证据当作真实费用批准、真实Worker认领/Provider或专业效果。
- 当前自有七服务PID39767，实际已加载免费API及F01拒绝门禁，后续新增队列函数仅在隔离探针装配，真实Provider/消息投影仍待完成；不扫描/自动恢复任务。F01前不再核价或发付费请求。K08唯一独立代码评审尚未派发。

## F01待确认点

建议用户一次有条件批准“重新核对公开DeepSeek价格；报价及保守预留满足原累计5元、无unknown/held才派发，最多4具名AI job/8实际Provider请求（含工具回合/失败），不充值/续额/自动重试”。若只批准核价，则仍需另批调用。批准后先完成真实费用准入/模型及消息投影装配与免费反例，再真实调用及K06–K08；这不是当前K05已完成的承诺。

原79笔known/¥1.518966保持。本轮两条无模型免费失败探针保留为审批前基线，未来F01凭据须列明其ID；不得删除/重放来重置计数，实际付费任务/Provider次数单独从批准后登记，预算仍累计原79笔，不另开账本。K05真实模型、K06–K08、完整WP09/AI-15与AC10不销项。
