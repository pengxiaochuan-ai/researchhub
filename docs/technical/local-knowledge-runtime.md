# 本机知识资料常驻环境

## 2026-11-16 · PDF解析最小修补已在本机采用

仅共用`app/kb-doc-parser/serve.py`与测试修补：缺Unicode映射/异常文字层检测、本地OCR、题名区域裁剪/低置信回退；Tesseract使用真实临时路径与显式UTF-8。正常PDF维持原路径；非空失败不静默跳页。两次owned装配后交接PID10048，七服务ready；共享启动入口未改、旧服务未切换、历史文档未覆写。两份全新合成PDF真实上传、双视图/预览/刷新与既有私有隔离通过。不是生产配置或全文准确率签收。[完整证据和待办](../testing/knowledge-pdf-encoding-2026-11-16.md)。

## 2026-11-12 · 智能搜索本机启用

原19501–19507独立七服务ready，AI01原位智能搜索默认OFF；ON后新hub-smart-search装配原OpenCode1.18.27原生Exa与受控公开网页MCP，同一真实Agent循环运行。旧PubMed请求同样需要本条联网许可；网页只保存当前本人快照不自动入库。没有新账号/模型额度/开发费用守门、数据库表或旧服务改动。每次模型实际usage聚合进入原预留/结算，未知沿原待对账。

真实两账号5成功/2失败任务已逐笔核对原账本，581免费/29Chrome＋最终4专项/build及独立代码复核有据；部分科研措辞仍需专业用户验收。配置/工具真实执行不等于科研结果全正确，正式域名未发布。[技术](qiyan-smart-search-2026-11-12.md) · [证据与未测](../testing/qiyan-smart-search-2026-11-12.md)。

## 2026-11-06 · 单篇AI三档处理（现行）

按用户批准改为确定性修复、内容局部标注、控制面必须停止。新任务固定rh-article-response.v3，术语/年份/研究计数核对应原文；未核实测量或计算不作为结论交付，不再因一个数字令整篇失败。无有效段/不可解析协议仍明确未交付。任务字段绑定策略，提交/刷新重建回执，越权/来源撤回/版本不匹配/篡改仍阻断；旧v1/v2结果、失败、预留和账本不回写。原四段阅读区/16px字号、角色及业务Token链不改，无新计算服务。见[简短矩阵](../product/article-response-matrix-2026-11-06.md)与[技术交接及专业边界](../testing/article-response-matrix-2026-11-06.md)。本节覆盖下方历史整篇数字拒绝规则，不表示通用语义核验或生产发布。

## 2026-11-05 · 单篇数值来源receipt

Hub单篇适配器改用parseArticleModelResponse保存实际数值原文receipt；最终assert与articleAi.validate/projectMessages重验，原Sessions/Queue/Billing源码和业务Token逻辑不改。单篇context/state只把白名单错误投影为具体errorCode，未知异常不外泄。旧失败任务、2911Tokens待对账和人民币账本保持。[规格](../product/article-numeric-evidence-2026-11-05.md)与[验证](../testing/article-numeric-evidence-2026-11-05.md)。 首个有限随访语法仅支持完整肯定限制句并保守拒绝整段明确别文/否定语境，不是通用数值语义判断。最新本机304纯测/21真实PG/build及同次独立复核通过，新任务cmw3r2i130004lu1m730c225r真实交付2项原文依据、5224 Tokens按原业务结算；两次新失败与全部旧预留保留，专业验收仍由用户确认。

## 2026-11-05 · 统一原Billing业务链（现行）

本机local-knowledge-ai装配不再import四个开发预算/目的守门模块，Provider轨迹改独立随机ID。business-ai-quota只读取原myTokenQuota/assertTokenQuota；实际原子预留、UsageRecord和结算仍由原Sessions负责。Provider错误原型透传；旧Orchestrator吞异常后的外层重新抛出；已知usage在返回前被业务拒绝时用原UsageAccumulator回报partialProviderUsage，避免错误释放或双记。截断也在取得usage后拒收。原收费/配额/队列源码及旧人民币账本保持，旧审计不回写。七服务仅在合成在途0时自有重启；[现行规格](../product/business-ai-quota-2026-11-05.md)与[本机验证](../testing/business-ai-quota-2026-11-05.md)。

## 2026-10-30 Hub 来源目录当前运行检查点

仅本机专用合成库和 19501/19502 前后端常驻服务接入新来源路由：管理批次/来源/行预览与追加审核、公开列表/详情、需原科研 Agent 权限的只读检索。`rh_source.review_decision` 增 `audience`（旧决定默认租户范围）和可选失效时间；公开投影只采当前有效的公开展示决定，AI 仅采当前有效 AI 决定。两份真实第三方工作簿仍是 2 批、15,697 暂存原始行、0 审核、0 公开、0 AI；合成回滚夹具的批准/撤回不留在库中。用户浏览器当前只应看到真实空态，不应看到静态示例。旧公共表和历史任务不变；本轮未接临床库、旧服务、云资源或模型 Provider。详见[接口](hub-source-api.md)和[实测](../testing/hub-source-first-slice-2026-10-30.md)。

独立评审后的 `rh_source` 专用升级只在经目标指纹守门的合成库执行：审核决定历史取最近版本；单行撤回可覆盖批次批准；受控 SECURITY DEFINER 函数只在事务内锁 grant 事件表，并不扩大应用角色对 grant 表的写权限；账号/租户行同事务锁定；公开列表 SQL 分页与聚合计数。自有本机服务已重启，19501–19507 ready，未触碰 10 月 20 日遗留 queued/processing 历史夹具。24/24 来源目录测试、10/10 准入/导入测试、构建与最新 Chrome 验证通过；独立原结论仍是完整切片 Blocked，缺旧 Agent 实际接线及真实获准来源。

## 2026-10-30 Hub 来源目录 Task 3 隔离导入

专用合成库中两份批准工作簿已按固定路径及 SHA-256 校验、复制到本机 0600 私有快照后逐批原子导入；重跑返回原批次，不重复插行。`zh-acupuncture-affective` 10,537 行、错误/候选行 98；`en-acupuncture-affective` 5,160 行、错误行 0。合计 2 批、15,697 原始行、12 个来源记录、15,693 个独立规范候选；缺题名等坏行仍保留，重复 DOI 不静默合并。字段非空数：题名 15,696、作者 15,652、期刊 15,693、年份 15,603、DOI 11,029、URL 11,481、摘要 14,823；重复 DOI 候选 94。`display_allowed` 与 `ai_allowed` 均为 0，审核决定 0，**没有公开展示或 AI 检索内容**。

首次英文批次因旧 fixture helper 的 20 秒总事务上限回滚，中文批次已提交；专用库回读确认无英文半批。随后只在 ResearchHub 导入器内复用同连接目标身份校验，并将整本工作簿事务总时限改为 120 秒（单语句仍 10 秒），未修改旧 guard；英文重跑及双批幂等测试通过。应用角色以正确租户读取 15,697 行，切到另一租户读取 0 行；旧 `public` 115 表、知识问答 97 条、知识导入任务 29 条不变。测试与统计见[暂存验证记录](../testing/hub-source-staging-2026-10-30.md)。

## 2026-10-30 Hub 来源目录 Task 2 增量持久化与预检

仅在经过 fixture guard 的 `wp01_test_full_baseline` 合成库迁移：保留既有 `rh_source.review_grant_event`，新增 `source_registry`、`import_batch`、`source_record`、`canonical_publication`、`canonical_source`、`review_decision` 六张 ResearchHub 自有表。七张表均启用并强制租户 RLS、各有一条租户策略；迁移重复执行返回 `created=false`，不覆盖 grant。迁移前后旧 `public` 115 表、`wp01_meta` 1 表、知识问答任务 97 条、知识导入任务 29 条保持不变。尚未写入任何来源记录、批次、原始行或审核决定。

使用本机已有的文档 Python 运行时（默认 `python3` 无 `openpyxl`，未安装依赖）只读预检明确主 sheet：中文 `针灸情志病_合并` 10,537 行，SHA-256 `ccde9859c505b7d5c8441c641492a28b887ec66e05c3b215807dfb62f7b8b661`；英文 `英文针灸情志病去重后` 5,160 行，SHA-256 `5480fc35627b2bd253e60279d9a8ee8d07c8b349b069376fe02f99077feca055`。中文主表发现缺题名 1、无效 DOI 3、同表重复 DOI 候选 94；英文主表本轮规则 0 错误。错误类别可重叠，不相加为错误行数；来源备份 sheet 未重复计数。预检仅在内存返回原值和行 hash，未把工作簿正文输出到日志或前端。预检与 schema 契约测试 3/3。此时 Task 2 技术落点完成，**可展示/可 AI 检索均仍为 0**；Task 3 导入未执行。

## 2026-10-30 ResearchHub 来源首切片准入核对（停于授权边界）

后续授权更新：用户已明确批准仅为当前合成租户、灵枢心域 Hub、`admin@example.org` 增加一项可撤销、留审计的 `source.review` 授权，旧角色和私有 Study 权限不变。下述“未通过”是获批前只读快照；实际建表、grant 与复核结果在执行后另记，不能以审批文字代替数据库事实。

实际执行回读：只新增 `rh_source.review_grant_event` 1 表、1 条具名 `grant` 审计事件（版本 1），作用域为本机合成租户、`lingshu-xinyu`、`admin@example.org`、`source.review`；无其他账号 grant。表启用并强制 RLS，应用角色仅有 schema 使用与该表 SELECT；重复执行同一批准依据没有追加第二条事件。拒绝临床/未知库、错租户/Hub/账号与无授权的门禁测试及真实合成库 grant 测试合计 6/6。执行前后旧 `public` 115 表、`wp01_meta` 1 表、旧知识问答任务 97 条、知识导入任务 29 条不变；`rh_source` 从 0 增到 1 表。此时仅 Task 1 准入通过，**没有任何来源内容审核或公开/AI 许可**，15,697 行尚未导入。下面的旧停止说明保留为审批前快照。

本轮仅对专用合成环境做只读核对，未执行 `rh_source` 迁移、工作簿导入、审核、页面切换或模型请求。现有 fixture guard 在同一只读事务确认目标库 `wp01_test_full_baseline`、`wp01-shared-boundary`/`syntheticOnly=true` 标记及 run ID 匹配；未读取临床库。合成租户 `rh-kb-local-b0e2af9d-tenant` 为 active；原 owner/admin/uninvited 三账号均 active 且属该租户。`admin@example.org` 是 `tenant_admin`，`isTenantAdmin=false`，无 `AccountCapability` 记录；当前 Prisma 模型及专用库均无 Hub 或 Hub 范围来源审核授权关系。租户控制身份不等于具体 Hub 的内容治理授权，不能据此替管理员签发 `source.review`。

准入时旧库有 `public` 115 张表、`wp01_meta` 1 张表，`rh_source` 尚不存在；旧 `KnowledgeChatJob` 97 条、`KnowledgeImportTask` 29 条。本机七项既有服务在原端口 ready，未重启。E01/E02/G02 仍列于真实模式 `PENDING`，E01/E02 保留静态样例，科研 Agent 当前检索入口绑定旧 Study 知识库，未接 Hub 来源目录。以上是实施前快照，不把历史任务数视为本切片数据。

`node --test scripts/hub-source-admission.test.mjs` 已验证合成目标/租户/Hub/具名审核人门禁及 `tenant_admin` 无 Hub 授权时拒绝（4/4）。**整体 Task 1 准入未通过**：需用户确认最小 Hub 范围 `source.review` 授权的承载及本机具名授予对象后，才能执行 Task 2 迁移和后续审核；不能通过隐式复用租户管理员权限绕过。推荐仅在 ResearchHub 自有 schema 为当前合成租户、灵枢心域 Hub、`admin@example.org` 建一条可撤销、带审计的授权；不改变旧账号角色、Study 权限或旧系统公共表。该建议尚未获批、未写入数据库。新授权之外仍须管理员本人对具体来源/字段/用途录入权利证据并显式审核。

## 2026-10-28 P01个人聚合只读接口

本机七服务保持原端口，19502新增`GET /api/my-research/overview`，19501的P01通过同源代理读取；无须迁移或新增环境变量。旧Auth Guard核验登录，服务端授权锁内重读当前租户/账号/研究组/项目/角色，逐个核对关联对象tenantId，然后只聚合有效成员项目、本人未删除草稿、本人被分配且非验收夹具的未关闭任务；Q01/Q02入口与本机实际后端作用域保持一致。匿名401、无私有Study返回空列表，不读取临床库/旧服务，不新增权限/模型调用。仅本机合成适配，生产ResearchHub部署尚未启用；操作/证据见[使用说明](../product/使用说明书.md)与[本轮实测](../testing/my-research-2026-10-28.md)。

## K08当前技术交接（2026-10-26，AC10待用户）

K06界面、K07联调及K08唯一独立代码总评审的技术工作已完成；专业AC10尚未签署，不称完整WP09/AI-15、一期或生产验收。独立原结论为With fixes（0 Critical、4 Important、无新增Minor），原文保留；主实施逐项RED→GREEN修补，不冒称独立二次复签。修补涉及明确倍数/分数表述的输入/资料/输出边界、空访视映射未声明、依据选择跨轮询保留及同基准自检提示；回归另修复在途轮询误取消历史目标读取。只改本用途，不改旧内核/权限/共享底座。

最新证据：browser-5ce391ba两账号26项（含真实在途轮询）；browser-auth-0d9780ee两账号12项；browser-visual-c05c9683两账号原生Chrome200%/键盘/字体；browser-review-97b2ea20两账号11项（本人新记录两次显式意见保存，不增AI）；前序本轮flow-dc2290c7的22项真实PG/CAS/幂等/意见链仍保留，不盲重跑。review-readback-92bc6049读取32记录126版本，0摘要受影响、0历史改写，三份原始真实模型输出通过新严格契约免费回放。free-gates-dba74990：404纯测试、1054旧内核测试、构建/保全/空白全部通过；691旧源码、115表41128前序行、三旧scope和八旧进程不变。PNG/WebM、失败与原评审均留痕。

本轮0新Provider/费用；累计仍10job/9实际HTTP/88笔known/¥1.899558，paid=false、任务额度已满，不因余额自动续跑。只用专用合成库，七个本机服务就绪，不接临床库、不动旧服务、不发布。用户可先阅读已有结果并体验意见闭环；正式AC10的新合成AI任务须另确认。后续仍保留11/04、11/06全一期复估和11月中旬交付目标，不借本片销掉其余业务/AI/正式治理。

完整证据与AC10验收卡见本片实测文档，原评审与作者复验见planning同日目录code-review.md；61项最终源码摘要见implementation-k08-checkpoint.json。Notion同步状态以最终回读收据为准。下方K06/K07“待总评审”和更早停止点均为历史，不恢复旧任务。


## K06/K07本机界面与全链技术验证（2026-10-26，K08待总评审）

用户已明确继续K06及既定后续。A02新资产核对族接通：本人源候选/目标固定版本→六组逐子项声明规则→已有真实AI定性解释及typed来源→免费规则或明确AI依据的人工意见→分批提交/固定历史。原资产/目标只读，不套用或新建研究；本轮派生参考目标不冒称新PICO确认。原Q01不支持固定历史URL，故目标通过既有versions接口在本页只读核对，源候选保留原固定历史回链。

真实Chrome：browser-d72086b8两账号26组（五视口、已有真实AI/来源/固定历史及错路由拒绝）；browser-flows-dc2290c7两账号22组（新建、真实PG保存/CAS/响应丢失原键重试、读完整性/网络故障恢复、真实U02/U03撤销、AI依据显式切换/同消息分批意见）；browser-auth-03bf0b6a两账号12组（非首项/固定历史精确探针、在途撤销/迟到200、实际Cookie换账号和退出）；browser-visual-b6fa3363两账号原生Chrome200%/键盘，Reading16/28、输入及重要限制14/22。相关PNG/WebM和初始失败永久保留。已观察并修正：无AI历史误禁目标读取、通用演示提示、错误A01新族继承旧动作、成功HTTP探针未传播U02/U03撤销。移动截图先等既有侧栏动画结束；测试自身字段集disabled判定及异步选项等待问题不记产品修补。

本轮0新Provider/费用，仍10job/9实际HTTP/88笔known/累计¥1.899558；paid=false且10job已满，不借余下HTTP次数启动新任务。六笔已批Token对账已收尾；不续额/充值、不改角色/旧源码/旧scope/前序行/旧服务。完整免费门禁free-gates-99436190为399纯测试＋1054旧内核、构建/保全/空白通过（其后仅本片路由窄修，最终门禁待收口）。仅本机合成技术证据；K08唯一独立代码总评审与用户专业AC10未完成，不称WP09整片/完整AI-15/一期或生产验收。下方旧K05停止点/无UI等为历史，不再作为当前指令。

## K05技术验证与对账收尾完成（2026-10-26）

2026-10-26：K05技术验证及本轮对账收尾已完成。原owner/admin各成功一轮、未预运行通用新例成功；最后具名任务在真实Provider在途撤U03后以APPLICABILITY_SCOPE_RESTRICTED终止且0assistant。仅新purpose采用模型明确选sourceIds→后端严格校验/确定性引用渲染，回模后先重验当前授权、最终原子提交仍再验；旧内核/角色/科学数值规则不改。累计10job（3成功/7失败，含1笔Provider前Token额度拒绝）、9次真实HTTP，88笔费用全部known，累计¥1.899558/¥5；上限10job/12HTTP，原79笔和全部失败保留，不充值/续额/自动重试，paid=false且0在途。本轮6笔已知Token预留均按分别批准的范围，经既有合成平台管理员与旧BillingService完成真实用量对账，0新额度/权限/历史预留修改；最后2601 Token已结算，不再有本轮待对账项。最终394纯测试/1054旧内核、构建/保全/空白通过，SDD Task5已登记complete。仅K05技术范围通过，不等于WP09整片交接或专业验收：K06新UI/K07全链/K08唯一独立评审及专业AC10未完成，当前请求止于K05，不自动开始K06。现有两账号身份页Chrome回归不是新工作台浏览器验收；以下早期停止点/待批/旧上限均为历史。

## K05续验当前停止点与待评审契约

2026-10-26 K05续验：用户已批准最多10个任务（含已失败任务），实际Provider HTTP累计仍最多8、原累计费用¥5且不充值/续额/自动重试。当前4个付费任务／4次HTTP均known但未交付AI回答，83笔费用记录累计¥1.715166，held/unknown为0；scope已恢复paidAiApproved=false。前三次缺行内引用/引用超限/问句不合格；第四次原始输出仍缺行内引用并含未定义pico分组，本次配对输入压缩又引入整数索引不被旧数值守门识别的兼容缺陷，不能归因于旧系统单方。原691源码、115表41128前序行、三旧scope/角色及旧服务保全；不改旧内核/权限/科学数值规则、不重置79笔原前缀或失败计数。连续修补失败后暂停付费，等待评审仅限新分支的输出契约调整：模型明确选择来源标识，后端严格验证后确定性渲染引用；这是待批准建议，不是已实施/模型成功。K05未通过，K06–K08、真实Chrome及专业AC10均未开始/未验。以下较早4/6任务待批、81笔及2失败等状态仅为历史。

## WP09 F01当前：真实调用被拒绝，费用已停（2026-10-26）

仅本机自有19501–19507、专用wp01_test_full_baseline，旧服务/前序行/角色/三旧scope不动。新purpose的knowledge-state/source现已接完整双端授权投影，不再一律403；通用knowledge-messages仍403，不落回普通KB路径。U03失效时消息/来源拒绝，免费规则仍可读；历史/当前来源重新核验，错父对象不可交付。

新增本片私有fee-approval及逐HTTP attempt回执，仍使用原ai-budget-20261022账本reserve/settle，不另开额度；默认4job/8HTTP/累计¥5、8192字节/1536输出上限，known以外、过期或超限即停。原79笔完整前缀/元数据保全，verify-approved仅允许登记新费用追加。两次真实Agent/kb_search/DeepSeek均因结果引用校验被拒绝，0assistant；合计81笔known/¥1.624860，费用开关已恢复false，提示源码免费修订不等于新真实成功。

仅自有具名重载器可重载七服务，拒绝新在途job/run；保全基线内摘要不变的历史run不恢复/不改状态，不据此启动生产停线协议。job总上限4→6为待批建议，实际仍4/8；本片UI/Chrome/K08/AC10未完成。详见[最新台账](../planning/asset-applicability-2026-10-26/implementation-progress.md)，下方旧PID/F01未批/state一律403/零调用均为历史。


## 2026-10-26当前 · WP09免费API启用；付费与新UI未启用

自有PID39767，19501–19507均ready，仅专用wp01_test_full_baseline。新增`/api/asset-applicability-drafts`创建/列表/当前/固定历史/意见，以及jobs的F01未批403守门；原同源Cookie/Study header、原权限、32KiB精确parser。新purpose 0600/0700、7日期限、U01–U04和精确pairs，一次审计、禁止自动恢复grant。旧kb:会话分支不改，新rh-asset-applicability:会话的generic send/state/source仍明确403，真实消息投影未接通，不回落普通KB路径。

原Queue内部回调/执行绑定仅在无Worker、无Provider、全回滚的隔离探针验证，paidAdmission stub不代表F01；实际scope费用false，没有新增模型/费用。两条本轮注入器故障产生的新免费任务已仅按精确ID标“测试未派发”失败，消息/版本保留，历史任务不动。后续实际AI须先配置经用户批准的F01凭据、完成模型/消息投影装配与本轮真实验证；详见[阶段报告](../testing/asset-applicability-2026-10-26.md)。下方PID/交接状态为历史。

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

自有本机PID61344、19501–19507常驻；仅wp01_test_full_baseline，不动旧8进程/临床/远端配置。第五AI意图复用原Queue/知识工具/科研Agent，原job绑定真实选择/请求/版本，终态run全字段只读；新方法报告复用原Artifact/Version/Sources/Audit和共同授权锁→精确run锁→重验。仅新WP07 scope启用R01–R03，原scope/角色不改；四次请求额度已用完，live remaining=0，AI按钮禁用但已生成解释、方法/报告仍按当前授权可读。79笔known/¥1.518966/¥5、held0；原报价不续期，不再调用模型。D08已完成免费核验；node scripts/local-knowledge.mjs status/start/stop只识别自有runtime，不扫描旧任务或停旧服务。




D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 2026-10-25当前 · 存储修正已验证，模型输出未通过（未发布）

本机原七服务PID99632/19501–19507常驻；只重载自有服务，不动旧8进程。新增最小job绑定/精确run行锁、同键竞态后验，不写终态run或扫描恢复历史。scope仅WP07 paidAiApproved=false/implementationHold=model-output-citation-review；原WP06、原角色/Schema/旧服务不变。实际工具/Provider已执行但输出不合格，失败不自动重试。

本轮新增1笔known费用¥0.012051；累计76笔/¥1.476468/原¥5，余¥3.523532、预留0。原75笔与报价保持，原3次已用1次、余2次；要保持原三项目标至少仍需3次，额外1次计划待确认，不自动重试/续额/续价。详见[当前实测](../testing/synthetic-crf-methods-2026-10-25.md)；下方此前“0模型/待存储确认”均为历史记录。


## 2026-10-25 · WP07有效AI入队被终态不可变保护阻断

第五kind/原Queue入口及消息/来源投影为部分在建代码，不是启用能力。原terminal snapshot trigger禁止needs_review后改artifactRefs，真实POST500及原队列/PG回滚反例确认，0 Provider请求。新WP07 scope仅paidAiApproved=false/implementationHold=terminal-run-binding-review，原R01/旧scope/旧grant不变；API有效AI请求403、页面解释暂停，原七个本机服务仍常驻。

原账本仅获准刷新价格有效期，75笔/5元上限保持；started标记保留为blocked_before_provider，不自动恢复、重放或续期。替代关联存储见[待确认提案](../planning/synthetic-crf-methods-2026-10-25/d05-terminal-binding-adjustment.md)，不改旧触发器/Schema。下方装配说明不等于D05真实交付。

## 2026-10-25 · WP07免费方法链独立装配（F01未启用）

local-knowledge-ai装配新local-crf-methods Controller，仅本机19501/19502→原19505 Worker，独立新scope核对approvedAt/原两账号/当前Study/本人新包；paidAiApproved=false。GET preview/list/detail/compare及POST method-runs复用原账号/Study/Skill/Agent授权与原共同锁，包级advisory锁保证同包冻结/幂等/CAS，run/input/审计原子。不初始化旧grant，不改Schema/原Worker，不扫描或恢复旧任务。

实际fetch检验完整body/hash与requestId，私有trace不含请求授权头；原算子数值政策后再窄投影，原全Study结果不直接公开。独立启动instanceId/token/CAS，在途失效禁止提交；重启后旧在途只读interrupted，不认领。列表逐行校验真实冻结Version，restricted根列表不交付任何private items。

仅本次自有7服务重载且常驻，旧8进程/691旧源/角色/Schema及保护历史保全；[阶段实测](../testing/synthetic-crf-methods-2026-10-25.md)。没有AI核价或调用、新权限、云、远端运行配置或发布。

## 2026-10-23 · 执行准备装配与本轮核价

已装配GET/保存/预览/历史及POST jobs、decisions、rebindings，原withDraft/共同租户授权锁/ResearchArtifactsService事务不变。jobs/意见/重绑各32KiB；新任务同原Queue/Agent/KB/Provider，不新增Worker/表/grant。三生产者在初查、最终入队及全部根写互斥；入队版本/job/usermessage/审计同事务，最终assistant/job沿原Sessions原子提交并重验当前来源/head/绑定。

preparation的JSON1536输出、真实引用及数字叙述守门独立于原assertAnswer且不放宽旧门槛；配置数值遮蔽、预览答案不进模型，纯展示规则编号不进模型规则投影。固定来源/人工意见/resultMessageId与原execution版本可追溯；详情GET不增版。实际在途撤审的Provider200不能绕过PREPARATION_SOURCE_CHANGED，assistant未发布。

E08补齐中文单字科学量的输入遮蔽/输出拒绝，共享识别日/小时/剂量/长度/小数/比例而保留普通中文及真实ID。本轮仅重启自有宿主四次（63813→72644→81370→86371→92797），当前PID92797、19501–19507 ready；旧8进程未动。原预算63笔known/1246815微元，原52笔保持，报价有效至2026-10-24 18:03:30北京时间，不自动续价/续额。免费综合复核用`node scripts/research-execution-preparation-final-gates.mjs --mode local-synthetic`；旧E04命令是原全账本SHA不变阶段检查，不适用于新增授权调用后的当前账本。见[报告](../testing/research-execution-preparation-2026-10-23.md)。

## 历史：执行准备E04检查点

增加GET `/research-plan-drafts/{id}/execution-preparation`、POST `.../versions`、GET `.../versions/{version}`及POST `.../previews`，沿原withDraft/共同授权锁/ResearchArtifactsService版本事务。保存128KiB，预览32KiB，实际Controller大小写/尾斜杠同限；预览业务错误HTTP200＋errors，结构非法400，不保存答案。列表新增状态/修订号/发现数的可选摘要，不交付配置值。

自有七端口宿主重启两次以装配本片，当前PID63813，19501–19507均ready；只用原专用合成库，无DDL/新授权/旧服务操作。AI核对jobs/decisions/rebindings尚未接通，不能以接口规划当能力已生效。原账本SHA保持，本片0调用。完整证据/免费复核命令和E05门槛见[阶段报告](../testing/research-execution-preparation-2026-10-23.md)。

## 最新交接：WP05首切片本机技术验证与评审修补完成

T01–T09真实实施验证及T10唯一一次独立代码总评审已完成；3项Important、2项Minor均由主实现核对修补复测，无第二次独立签认。最终190/190相关测试、1054/1054既有编译内核、构建及25项综合门禁通过（gates-6d67fff7），含两角色新材料全链各9项、实际在途来源撤审、五视口/原生200%、慢轮询及复制晚到反例。完整证据与用户专业体验A09见[最终实测报告](../testing/research-design-workbench-2026-10-23.md)。

交接仅指本机合成技术能力，不是用户专业验收、完整WP05/一期或生产交付。累计52笔均known，保守¥0.984879/¥5，原33笔与旧源/旧服务/历史对象保持；无新权限、Schema、充值、自动续额或云/远端配置/发布。报价至2026-10-24 14:12:50北京时间，过期/费用未明停新调用。本次收尾不再调用模型。下一检查点为用户体验核对，不自动扩大业务范围；2026年11月中旬总体目标仍须逐片复估。

以下按阶段保留原记录；旧段落的“评审中/待批准/186项/22门禁”均为当时历史，当前结论以上段及最终报告为准。

### T10保护规则

新收费任务在原认证/事务锁内还须排除本草稿已用的免费操作标识；原已完成job的相同输入幂等读取保持，旧本机PICO/方案生成入口也沿此规则。大小限制匹配实际Controller的大小写及尾斜杠别名，不能绕过32/128/192KiB上限。中文裸数、中文小数和样本/阈值表述拒绝；仅服务器已验证的精确证据rowId按技术标识处理，不能借ID豁免额外科学值。

## 2026-10-23最新：WP05设计链（本机技术验证，评审前记录）

原七端口/专用合成库/原两个账号与Study不变；增加薄design模块复用原Queue/Orchestrator KB工具/Provider/ArtifactVersion/共同授权锁，不重建旧Client/dist、不做DDL/角色变更、旧任务恢复或旧服务操作。S07真实路径designWorkspace=1承接本人设计，Q01保留原合成下游。独立总评审中，专业和生产验收未完成。

本机新增GET `/research-plan-drafts/:id/design`、POST `.../design/jobs`（evidence/refine，32KiB）、`.../design/evidence-decisions`与`.../design/decisions`（128KiB）；原POST `.../versions`独立192KiB，GET `.../versions/:version`为本人只读历史（正整数最多六位）。这些是本机适配接口，不代表生产公共API已发布；均原始字节限制，内容仍24000 UTF16字符、来源6/证据12/建议7/操作64上限。

绑定草稿阶段统一沿固定创建主题query重验完整来源；工具轨迹query/taskRequest分开。设计Provider实际JSON模式、maxTokens仍1536，普通问答问题/模型不改。生成绑定pending v+1并在最终assistant写入同事务重验授权/来源/版本；人工处置和采纳用当前CAS，head只允许同结果连续决策。手工正文/PICO/处置改变使旧建议失效，来源撤审清空历史/正文，不自动更换来源。

原5元账本保留（52笔984879微元/5元，含失败）；公开核价到2026-10-24 14:12:50北京时间，未明/在途/过期均停止新模型请求，无自动续价/续额。已保全原691源、23表14647旧行、8旧进程和冻结证据。仅负例撤审一份本人本轮首批合成资料；两份完整体验夹具健康，不影响旧系统/其他历史对象。每次自有宿主重启会轮换私有收件箱入口，未消费用户bootstrap。

验证入口：`node scripts/research-design-gates.mjs --mode local-synthetic`仅免费门禁，不重放付费任务；完整UI脚本会调用模型并写本人新夹具，不应当成日常只读健康检查。详见[报告](../testing/research-design-workbench-2026-10-23.md)和[操作说明](../product/使用说明书.md)。下方为历史阶段。

## 2026-10-23当前：WP05 T01/T02与原七端口

沿WP02已有19501–19507/同一专用合成库、原两账号/原授权。仅自有宿主重启一次加载本人列表摘要；七端口ready，不改旧8进程、不恢复历史任务、不更改角色/Schema/旧Prisma Client，不连接真实SMTP或远端配置。

原本人列表GET兼容新增displayTitle、coverage和nextAction，仅当前来源/本人授权可得摘要，scope与cursor仍重验。真实Q02/S07采用designWorkspace=1及studyGroupId/researchProjectId；scope不授权，混合demo ID拒绝。Q02列表与原Q01往返已实测，S07设计编辑尚未实现。K01入口/操作见[使用说明](../product/使用说明书.md)，新纯契约不是实际AI任务装配。

[T01/T02报告](../testing/research-design-workbench-2026-10-23.md)记录120项套件、1054项内核、6组API、24项Chrome及构建。33笔保守¥0.566010/¥5账本字节未变，报价2026-10-23T05:23:53.834Z已过期；新调用0，不自动续价/续额。T03真实AI和T10最终代码总评审未执行，本机技术能力不等于专业或生产验收。下方五端口等为历史切片。

## 当前：六阶段连续联调后的常驻体验

仍同一19501–19505/专用合成库/原账号与授权；仅自有宿主安全重启一次加载候选契约，无新Worker/端口/grant/云/真实发布。五端口均ready，旧源/真实.env/八旧进程和既有记录/1053冻结条目保持；只处理新具名材料/草稿与显式运行，无历史恢复扫描。

K01新六阶段资料库→继续本人Q01方案→合成v2→报告→本人候选与派生，详见使用说明。两阶段实际模型本轮新增6笔含首个内容问题样例，累计33笔保守¥0.566010/¥5，全部known；前27笔不改、不充值/续额/续报价。确定性下游与现有样例读取不新调用模型；原报价仍至北京时间2026-10-23 13:23，过期停止新调用。

真实Chrome权限/失败恢复/CAS/200%与局部搜索遮挡修补通过；无共享/审批/锁库/发布/导出，也不是专业签认或开机自启。四层结论及证据：`../testing/research-flow-e2e-2026-10-22.md`，下方为各前序切片历史。

## 当前追加：报告 → 私有资产候选

沿用19501–19505、同一专用合成库/原两账号/5元累计账本，无新Worker/端口/模型调用。Q01当前报告进入A02封装本人候选；A01“我的资产候选”进入真实列表。原产物/版本/Source/审计保存固定报告、软件配方和派生血缘，说明单独追加，不创建新Study/正式Asset。

范围授权仅一次审计，不改角色/其他Skill或feature；仅两账号/当前研究/本人本轮，未开放共享/审批/锁库/发布/导出。自有宿主重启7项验证撤销Skill不复授、两账号根与派生说明/版本/hash/血缘恢复、只读及未邀请仍拒绝；不触碰旧服务或扫描历史任务。保持常驻，非开机自启或生产排空。新增0元，27次保守¥0.468522/¥5不变，不延长报价。操作和完整限制：`../product/使用说明书.md`、`../testing/synthetic-asset-2026-10-22.md`；专业验收待用户。

## 当前追加：质控结果 → 可追溯报告草稿

沿用19501–19505、同一专用合成库与原两账号；不新增端口/Worker/模型调用。Q01本人最新真实质控结果可创建报告，旧产物版本/来源/审计保存；正文事实只读、人工说明单独追加版本。权限仅两原账号/当前研究/本人本轮草稿，不新增角色菜单/按钮/其他Skill或feature；授权范围审计只写一次，启动不重新授予既有被撤销权限。

本片自有宿主停启后，报告版本/说明/事实指纹、原账号与原运行恢复，撤销Skill仍403，viewer/uninvited仍拒绝；不操作旧服务或恢复历史任务。五端口保持常驻，非开机自启。原账本27次/保守¥0.468522/¥5不变，模型报价有效期不续。入口和限制见 `../product/使用说明书.md`、`../testing/synthetic-report-2026-10-22.md`；专业验收仍待用户确认，无生产发布。

## 最新追加：合成数据试运行与质控

相同专用合成库、账号、材料、5元账本，新增自有回环19505运行原research-methods-worker/serve.py，只接受内部DQ安全manifest；随机Token仅存本机quality-worker.json，不写文档/Notion。启动器共管理19501–19505五端口，端口冲突停启动，不按端口杀进程；停止/重启仅按自有PID/启动时间/命令身份，不影响旧服务。

feature/两账号Skill授权仅首次有审计标记时写入，重启不恢复撤销项。原ResearchMethodRun保存本人派生快照/结果，不注册恢复扫描；失败/中断须显式新版本重跑。重启前核对本片真实请求已结束，不排空或恢复历史任务。服务脱离终端运行，非开机自启。

从Q01已保存方案进入“合成试运行与质控”，见 `../product/使用说明书.md`。本片离线确定性、新增模型0元；账本仍27次/保守¥0.468522/¥5。原模型报价有效至北京时间2026-10-23 13:23，不能因免费质控而续报价/额度。完整旧AppModule/ResearchMethodsService及生产Worker未因此接入。

## 最新追加：PICO确认与方案草稿

相同19501–19504/专用合成库/原5元账本，不新建环境或模型。owner/admin仅追加当前研究、本人本片protocol_draft的artifacts菜单和read/create/edit；授权初始化有审计标记，重启不恢复被撤销权限。原ResearchArtifact版本及知识会话/队列复用，不开放通用产物、删除、审批、发布、导出，不改旧服务与源码。

K01建立/继续本人草稿→Q01生成PICO→人工确认→生成/编辑/保存候选，操作见使用说明；重启前也须确认本轮方案任务无排队/执行中。不注册队列恢复生命周期，重启不自动重放未完成任务；同一费用账本、账号、材料、PICO和草稿版本保留。旧问答与新阶段总调用费用以 `docs/testing/research-plan-ai-2026-10-22.md` 最新记录为准，下方¥0.129888仅是首问答切片历史。报价有效期不延长，不清零/续额。专业/生产验收仍未完成。

2026-10-22 用户批准启动；仅复用上一轮通过的真实 Auth/Knowledge 控制器、guards、业务服务、解析与 512 维向量模型，不运行完整旧 AppModule。

## 固定边界

- 仅回环地址：前端 19501、API 19502、独立解析 19503、独立向量 19504；端口冲突直接失败，不停止占用者。
- 仅 `wp01_test_full_baseline`，每笔事务复验库名、角色及合成标记。新建具名租户、账号、研究成员及本地 MinIO 独立 bucket，不修改历史夹具/任务。
- 不调用导入/问答队列恢复扫描，不启动其他 Worker。只处理本环境显式新入队任务；重启前确认本环境导入和问答已结束，异常退出的未完成任务不会自动重放。
- 不加载整份旧环境变量，不接临床库；解析/向量离线且禁止出网。AI追加授权后，Node fetch仅准本环境解析/向量端点，以及内部执行上下文+先记费用预留的官方DeepSeek请求；不允许任意联网。
- 会话使用独有 HttpOnly Cookie，沿用原权限与审核。账号密码、会话密钥保存在根目录 `.tmp/researchhub-knowledge-local/` 私有文件，不进入 Git、证据或 Notion。
- 常驻为脱离终端的进程；不安装系统服务/登录启动项。电脑关机、进程故障或依赖停止后需手动重启，不承诺开机自启。

## 启动与状态

在 `/Users/mac/aisciencesys` 执行：

```sh
node researchhub/scripts/local-knowledge.mjs start
node researchhub/scripts/local-knowledge.mjs status
```

仅停止本脚本具名、身份匹配的进程：

```sh
node researchhub/scripts/local-knowledge.mjs stop
```

不按端口杀进程。停止不会删库、bucket、资料、会话、账号或费用账本。先在页面确认导入和问答结束再停止；意外中断不自动扫描重放，未知模型结果必须先核对。

登录地址：`http://127.0.0.1:19501/pages/p003/`；成功后打开 `http://127.0.0.1:19501/pages/k01/`。凭据及操作步骤查看 `.tmp/researchhub-knowledge-local/体验账号.txt`。只上传合成材料。

## 验证要求

启动保护单元测试、真实服务健康检查、Chrome 登录→新建库→上传→预览→审核→向量检索→编辑→版本→回收站恢复；管理员与只读/未邀请用户验证。保存截图、录屏、脱敏网络及进程保全证据。测试结束保留服务运行，并再次探测。

本机依赖沿用专用合成 PostgreSQL 回环 5434 与已有本地测试 MinIO 19402（仅新 bucket）；不操作这些依赖的生命周期。本工具不是独立生产后端、云部署或专业科研效果验收。

## 本轮结果

AI追加切片：本机owner/admin仅增加原会话必要workbench/chat.use与指定Agent访问，其他账号/资料权限不变。实际原Sessions/Queue/Billing/Orchestrator KB分支及知识检索调用已验证，非完整OpenCode。服务端只读取旧配置中的已批准模型key，不输出或传到前端；无新云/充值。原token技术配额不是充值，真实请求始终受私有 `ai-budget-20261022.json` 5元累计上限控制；已验证6次请求保守上界¥0.129888，重启保留记录。报价有效24小时，当前至北京时间2026-10-23 13:23；过期停止新增调用，重新核价不等于续额/清零。详见 `docs/testing/knowledge-ai-2026-10-22.md`，下方为先行常驻切片结果。

保护测试 4/4、全部前端与保护测试合计 68/68，真实 Chrome 主链 8 项与重启后 4 项、真实生命周期 4 项通过；构建通过（既有编辑器/地图 chunk 警告保留）。重启后确认原账号、已修订且审核的文档、原件读取及向量检索仍可用，测试浏览器退出后服务继续运行。

启动器曾因 Vite 6 的 SIGTERM handler 提前 process.exit 留下本轮子进程，已改由宿主唯一接管退出并等待子进程实际退出；超时只终止自有仍存活的子进程。不修改 Vite 依赖或旧进程。异常时不要按端口强杀，先检查私有日志和身份。

更多结果与未测边界见 `docs/testing/local-knowledge-runtime-2026-10-22.md`；本次使用浏览器与安全规则保证真实链路和隔离边界，没有修改页面风格/权限或扩展生产范围。
