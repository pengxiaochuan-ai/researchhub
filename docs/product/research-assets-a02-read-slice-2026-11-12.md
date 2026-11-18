# 科研资产首个实施切片：A02固定版本只读依赖

2026-11-12｜依据用户本轮“可以，你来进行串行实施”。产品实施基线为[60项清单](research-assets-feature-inventory-2026-11-12.md)与[完整PRD](research-assets-prd-2026-11-12.md)。串行开发及A02最小只读依赖顺序已批准。契约、只读服务、页面与隔离回归继续实施；实际新增持久夹具前核对具名范围，不把旧用途审计误作新的RBAC前置。

## 1. P1实际核对结果与边界

- 通过既有fixture guard逐连接/事务核对专用库`wp01_test_full_baseline`、合成标记和runId；直接与应用连接都使用READ ONLY。本轮数据库业务写入0、模型调用0，未改旧源码/配置/服务。
- 原owner为active researcher，原admin为active tenant_admin且isTenantAdmin=true。两人当前成员角色不同，但都已有`artifact.read/create/edit`，没有`artifact.review/release/export/manage`。这不否定租户管理员长期业务权限规则：正式资产治理需要Hub显式适配，不能修改角色使科研人员一并获得管理权限。
- 原用途审计约束原适配器，不是每个新Hub模块都必须新增RBAC的依据。已有读权限可用于本轮只读实现；不为此改角色或重新授权。新增具名持久夹具仍需在实际写入前核对范围，共享/审批/发布/导出仍不执行。
- 应用角色对research_artifact、research_artifact_version、knowledge_doc_version都有SELECT；**本次读取不缺数据库GRANT**。knowledge_doc_version实际保存contentMd，但原listVersions仅元信息；受控固定正文读取仍需Hub适配，不修改旧接口。
- 原Artifact类型枚举不含“数据集资产/量表资产”等Hub分类；优先复用既有research_report容器及contentBlocks记录Hub五类，不能改旧枚举/伪装为新方法运行。是否沿此映射满足后续治理与扫描隔离，在首个切片负向测试里明确，不先扩数据库。
- 旧ResearchArtifactsService.getVersion可读取固定正文/来源，但普通get还读取其他版本/审核/导出关系；Hub只读投影只返回当前请求所需固定版本，不把原Service整包JSON直传前端。正式分析报告ID还受独立路由边界保护，不绕过读取。
- 浏览器原A01仍是正式目录未接、本人候选入口；owner读取20项本人候选，打开既有候选`cmvowduq40002lucm7h79cypj`，当前v4及历史v1真实回读，历史textarea禁用。本轮只是验证旧窄切片可复用，不是新A02已交付。
- 已有纯契约回归16/16通过，无失败/跳过；[日志](../planning/research-assets-product-2026-11-12/evidence/p1-admission/reuse-contract-tests.log)、[当前截图](../planning/research-assets-product-2026-11-12/evidence/p1-admission/existing-a02-v4.png)、[历史截图](../planning/research-assets-product-2026-11-12/evidence/p1-admission/existing-a02-v1.png)。首次选择历史版时页面仍在途v4，等待实际v1返回后才保存最终历史证据，未把选择动作当读取完成。

P1状态为“数据库/旧读取复用核对通过，首个新对象真实切片验证待具名范围确认”。未声称完整P1/新A02/全部60项或新AI验收完成，也未运行旧初始化/激活/导入脚本。

## 2. 首切片最小范围

五类共用：方案、数据集、量表/工具、分析结果、论文/报告的**本人草稿固定版只读**。本切片不是选择首种跨Study实际应用，不依赖Study B、不调用AI、不启用审核/发布/下载或导出；后续治理与所有A01功能仍保留。

沿用A02原页头、概览/版本/引用复用/相关研究/评论/附件/变更七Tab位置及侧栏。只读依赖先实现真实对象元数据、正文、固定版本来源、历史选择及合法返回；其他区域保持真实受限/未提供状态，不填假内容、不把A02整页销项。普通页面不出现开发编号/授权回合等说明；合成内容和草稿状态必须真实可见。

## 3. 最小数据与接口约定（Hub内实现）

| 对象 | 映射/规则 |
| --- | --- |
| 稳定资产身份 | 原ResearchArtifact稳定ID；新族使用稳定命名空间`rh-research-asset:`及服务端写入的`rh-research-asset-candidate.v1`标记；本轮夹具子空间`rh-research-asset:local-20261112:`，不把历史两候选族批量转换 |
| 五类与元数据 | contentBlocks中明确assetKind、题名/摘要、用途/限制、作者声明、owner/真实Study、来源声明及完整性摘要；assetKind不等于旧typeKey |
| 正文与版本 | 原ResearchArtifactVersion追加式存储；请求固定versionNo，返回当前头版号与是否历史；元数据也随固定版，不从当前对象拼历史标题 |
| 来源 | 本轮用新人工合成内容与“作者整理/合成演练”声明，不假称经过研究/统计/外部审核；后续知识/报告来源适配分别核权，不复制患者记录或旧正文来冒充新夹具 |
| 当前权限 | 服务端核真实tenant/account/authVersion/Study父链和当前read权限；首轮仅批准账号/研究/本人新对象的具名验证范围，客户端参数不作为授权 |
| 完整性 | marker、对象/版本/owner/Study绑定与存储摘要不一致拒绝；未知ID、混族、错父对象/版本不回旧候选或演示 |
| 目录隔离 | 新族不得混进方案/旧候选/正式方法报告等既有列表；若现有Hub聚合无明确族隔离，则先最小修正对应Hub投影并回归，不改旧系统或扩大数据范围 |

拟定真实路由：`/pages/a02/?researchAssetId=...&assetVersion=...&studyGroupId=...&researchProjectId=...`，避免与已用于浏览器演示的assetId混用；未知/重复/混族参数拒绝。后端只读`GET /api/research-assets/:id`、`GET /api/research-assets/:id/versions/:versionNo`，同源会话与原artifacts菜单/read门禁；不将旧通用Controller全量开放。

返回契约`rh-research-asset-detail.v1`：固定id/kind/title/status/owner/Study、version/currentVersion/isHistorical、contentMd、元数据、来源声明及版本列表；不含凭证、存储key或原导出/其他私有版本正文。首次仅draft，不借status字符串显示“已审核”。身份失效清内容；无权/未知不交付；网络异常与无权分开，迟到结果不得复活已失权内容。

## 4. 已批准的最小用途与夹具清单

用户已通过本轮问题回复确认“此最小夹具范围并继续”：A-R01～03获批，原两账号/当前Study、最多10份×2版、仅本机只读路由。复用已有权限，不改角色/历史记录、不调用模型或开放共享/审批/发布/导出；新增范围仍需确认。

| 编号 | 范围 | 明确不包含 |
| --- | --- | --- |
| A-R01 | 仅原合成租户、原研究组/当前Study、owner@example.org和admin@example.org；创建/读取本人本轮新资产草稿及固定历史版；说明修订仅用于生成第二版测试夹具，不在只读切片增加编辑接口 | 不新增账号/Study；不借此读取他人/历史受限草稿；不改角色、菜单、按钮、AccountCapability或旧授权记录 |
| A-R02 | 最多10份新具名合成资产（每账号五类各一），每份最多2个固定版；前缀`rh-research-asset:local-20261112:`；保留所有成功/失败/冲突证据，不删除旧记录 | 不是AI任务额度；不填充值/改Token/模型调用；不覆盖/迁移前序数据、报告或来源 |
| A-R03 | 通过现有原子创建/追加版本方法生成夹具，记录本轮用途审计；验证新族读取、历史、错ID/混族/跨账号拒绝、故障恢复和浏览器 | 不新增表/旧字段/旧枚举/数据库GRANT；若实际需要上述增量先停。无共享、审批、锁库、发布、附件下载或导出 |

这是验证范围，不替代正式产品中租户管理员既定权限；管理员全部治理/跨Study共享等后续沿PRD显式适配和单独验证。本轮正常注册权限数据不会在启动时自动补回，已撤销授权不会被fixture初始化恢复。

## 5. 已批准普通实施与实际写入停点

独立准入复核后修正：R1、R2只读代码、R3页面与无业务写入测试无需等待A-R清单确认。实际写入具名持久夹具、运行时装配启用前核对A-R范围；新增实际权限、费用、云、远端配置及发布仍先停。P01计数/分页/动态须在写夹具前排除新族，保留既有正式报告排除，不改页面。

| 顺序 | 实施/测试落点 | 退出标准 |
| --- | --- | --- |
| R1共性契约 | 新scripts/research-assets-read-contract.mjs及同名test；先写五类/完整性/混族/版本/来源声明失败用例，再最小实现 | RED→GREEN；不把只提供契约当功能可用 |
| R2受控只读服务 | 新scripts/local-research-assets-read.mjs；接现有本机Controller装配；集成用已批准具名夹具 | 原Service真实PG创建/版本追加，当前授权/正文hash/旧聚合隔离/历史读取/拒绝与在途撤权均验证 |
| R3 A02依赖 | 新src/research-assets-session.js及A02只读组件；路由/Shell仅增加已同意的真实分支 | 原母版同视口，五类详情/历史/返回、网络恢复/身份清除真实浏览器；不切A01开发或改旧候选页 |
| R4总评与准入 | 原测试/构建、截图/录屏、独立代码总评及文档/Notion | 各层证据明确；最小依赖通过才集中A01。发现新增权限/费用/云/远端配置/发布先停 |

R1～R4属于原P1/P2/P3的最小依赖工作，不在96～132h外重复追加工时。本轮首种跨Study实际应用仍未选择，且不阻断此五类共性切片；不以前置补齐KB全工具或修改旧系统作为解决办法。

### 5.1 当前代码步进

1. `scripts/research-assets-read-contract.test.mjs`先RED；实现同名契约模块：固定版元数据、五类声明、规范JSON摘要、正文/owner/Study/版本绑定、混族拒绝。
2. `scripts/local-research-assets-read.test.mjs`先RED；实现无初始化副作用的reader，通过注入现有`plans.withScope`在当前授权事务中读取、校验及最小投影。不调用旧get/getVersion整包输出，不提供任何写方法。
3. `scripts/my-research-overview.test.mjs`补新族排除RED；同一数据库where用于计数/分页/动态，保留旧草稿行为及正式报告隔离。
4. 每步GREEN后推进；R3与真实PG/浏览器证据另记，未执行的层级不标通过。

### 5.2 当前实际状态

R1/R2及R3原结构只读分支已实现并在本机启用；获批10份/20版持久夹具、两角色五类head/v1、跨owner/错Study/注销、P01隔离真实PG/HTTP/浏览器通过。491前端/35相关、隔离构建及独评修补通过。原母版同1910视口三网格/七Tab/七卡片槽一致，Reading16/28；1440/1366、原生200%、手机、真实503注入与连续录屏未测，专业体验待用户评审。仅最小阅读依赖，不是完整A02或全部60项，未进入A01。[分层证据与发现修正](../testing/research-assets-read-code-2026-11-12.md)。
