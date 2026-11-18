# 旧系统能力复用证据复核（2026-10-19）

性质：只读源码与离线测试审计，不是迁移实施、目标环境启用或生产验收。用于补充主报告，不代替岐研产品基线或排期决策。

2026-10-19后续确认：新旧独立部署、共PG实例/库/表并租户隔离、租户管理共用、不迁历史研究数据；允许必要旧后台隔离修补。以下静态/离线事实保留，方案建议按[一期总体方案](../phase1-review-2026-10-19/overall-design.md)更新，不再推荐独立生产库。[本轮增补](../phase1-review-2026-10-19/source-evidence.md)补第四类科研运行恢复及全AI入口。

## 1. 审计边界与结论

- 源项目：`/Users/mac/aisciencesys/app`；根仓库 HEAD `9b2bf43d2830f2ed60a94bc18f5a5dcf4bd851c3`。
- 目标项目：`/Users/mac/aisciencesys/researchhub`；HEAD `190f509d127b833a9380dfdf52916f20038b6f9c`。本审计未改业务实现。
- 已读根 `AGENTS.md`、`researchhub/AGENTS.md` 及其开发前必读链、`app/README.md`、系统总纲相关部分。旧复用报告检查的是 `eadac113...`，不能直接当作当前实现清单。
- 未读取 `.env`、密钥、数据库备份、患者行或原始媒体；未连接 DB、生产、模型或外部来源；未重启服务、同步 Notion 或提交 Git。
- 除本文件外未改源/目标实现；经主审追加授权，只在 `/tmp/aisci-reuse-audit.jj8JST` 隔离编译，不覆盖 `app/server/dist`。该临时目录保留供复核。

**结论：以整套 NestJS 后端、Prisma 迁移/RLS、对象存储适配和三个已有 Worker 作为迁移候选底座，比逐个复制 Service 更符合最大复用和单人交付约束。知识库应同时迁移其完整业务 UI。** 需要开发的是新身份/Hub/Study 的边界适配、已确认的 CRF 更正与锁解锁、文献表规范化等差额，不是重建 Agent、RAG、解析器或产物中心。

以下分级不表示生产可用：A＝纯规则/确定性算子可以直接沿用；B＝已有成套代码，应整域迁移并适配作用域/授权；C＝只有部分基础或名义入口；D＝目标需求在所查路径缺失。

## 2. 能力与源码证据

| 能力域 | 判定、已存在的实现 | 核心源码定位（相对根仓库） | 迁移依赖与实际缺口 |
| --- | --- | --- | --- |
| Agent 内核与工具编排 | B；意图路由、OpenCode 优先/DeepSeek 降级、稳定任务 ID、运行日志、主/子 persona、Skill 结果、数值边界，不是只有三个提示词 | `app/server/src/orchestrator/orchestrator.service.ts:133,152,184,208,567,662`；`orchestrator.module.ts:13`；`opencode/opencode-workspace.ts:23,50,110,138` | 依赖 Data、Knowledge、ResearchEvidence、ExecutionLog、模型配置与授权上下文；保留编排框架，替换项目品牌/领域人设，不以旧诊断 persona 定义岐研首期业务 |
| 会话与后台运行 | B；会话持久化、附件、知识会话 FIFO 队列、科研运行/阶段快照与取消路径 | `app/server/src/sessions/sessions.module.ts:22`；`knowledge-chat-queue.service.ts:220,242,333,387,417,445`；`prisma/schema.prisma:586,623,670,698` | Sessions 同时依赖 Billing、Knowledge、Ingest；即使首期不做计费 UI，也不能直接删额度/计量服务导致会话依赖断裂 |
| OpenCode 池与隔离 | B；每租户工作区、XDG 状态/配置目录、进程池、每实例并发限额、空闲回收、就绪等待、执行日志 | `app/server/src/orchestrator/opencode/opencode-pool.ts:65,107,130,150,211,307`；`opencode-workspace.ts:40,138,183` | Nest 同机拉进程，远端执行网关并未因此存在；同 UID 目录隔离不等于 OS 沙箱。满池只有存在空闲 victim 才回收，不能把配置的 maxInstances 宣称为硬容量上限 |
| DeepSeek BYOK 与模型策略 | B；仅 DeepSeek provider、阻断 Claude/Anthropic 标记、模型白名单、官方/loopback endpoint 策略、非生产明确 Mock、生产无可用路由关闭 | `app/server/src/common/model-profile-policy.ts:89`；`orchestrator/deepseek.provider.ts:143,161,174,273,335,439` | 运行环境密钥与 OpenCode 物化配置仍是环境级能力；不可把 ModelProfile 的 API 校验泛化成所有出站路径已有同等强制隔离 |
| 科研证据与联网 | B；检索规划、PubMed/注册库客户端、来源政策、受控 WebSearch/WebFetch、原页可读性/字段溯源/主题/中文来源/子题覆盖、Reviewer/报告路径 | `app/server/src/research-evidence/controlled-web-research.ts:101,137,192,578,673`；`source-whitelist-policy.ts:250,335,415`；`orchestrator/orchestrator.service.ts:2066,2088,2633,2973,4187` | 必须搬政策 Markdown 资源及工具轨迹契约；联网是核心证据链必经阶段，缺运行时/真实轨迹只能阻断或降级，不能因 PubMed 成功验收完整调研 |
| 知识库组织/管理/权限 | B；个人、课题组/项目共享、官方、指派库；库与树管理、账号分配、审核计数、回收站、安全删除 | `app/server/src/knowledge/knowledge.service.ts:101,135,156,242,304,390,494,693,796,1258,1340` | 绑定 tenant/group/project 与旧角色；新 Hub 公共资料、Study 私有资料及权利授权需映射，不能把 visibility=tenant 直接解释为 Hub 全部成员可读 |
| 文献导入闭环 | B；文件签名/容器/MIME 门禁、100MB/20 文件限制、私有原件/hash、持久任务、进度、直接标识显式决定、草稿入库、恢复路径、索引 | `knowledge-file-policy.ts:9,12,37`；`knowledge-import.service.ts:74,91,108,178,237,241,261,380,420`；`knowledge-import-record.ts` | 不要只搬 extract()；须保留上传、Storage、任务表、确认卡、审核、来源与索引链。任务 active 集合是进程内去重，resumePending 每次 take100，尚不能当分布式高吞吐导入队列 |
| 知识版本/审核/回滚 | B；正文旧版快照、version、baseVersion 冲突、改正文回 draft/未审、审核发布、历史元信息、回滚触发新版本 | `knowledge.service.ts:966,975,998,1013,1406,1417,1430`；`prisma/schema.prisma:3056,3197` | 版本并非实时多人协作；baseVersion 可省略，更新前检查与写入也并非 CAS 事务。历史列表不返回正文，不要承诺已有完整版本差异预览 |
| 文献元数据与去重 | A/B；题名/作者/DOI/年份与来源置信度、稳定指纹；精确 SHA/DOI/完整题名作者年份候选，预检计划、快照校验、逐组人工决定、可恢复删除 | `knowledge-literature-metadata.ts`；`knowledge-deduplication.ts`；`knowledge.service.ts:559,675,1034,1070,1130,1258,1340` | 规则与两阶段治理直接复用；尚不等于“王教授两份 Excel→规范 Publication/Source/Hub”的批次导入。相似题名不能自动合并为同一文献 |
| RAG 与指定文档问答 | B；授权库集合、选中文档复验、已审核且发布才检索、pgvector 余弦、关键词降级、页码/章节/表格定位、接地块与结构化引文 | `retrieval.service.ts:43,85,95,123,154,193`；`ingestion.service.ts:20,54`；`grounding.service.ts:9,32,43` | 向量 SQL 经 elevated，安全依赖先算授权集合；需迁移整个权限链。引文现含 docId/标题/页码/section/snippet，**没有文档版本或 chunk hash**，不可称为完全不可变的历史引用 |
| 知识 Agent | B；专用工具循环、工具能力筛选、搜索/阅读/创建/更新/附件导入、去重预检、最终基于工具证据综合、数值边界 | `orchestrator.service.ts:169,744,755,765,805,865,931`；`knowledge/kb-tools.service.ts` | 沿用 KbTools + Sessions + KnowledgeChatQueue；删除动作由服务端人工确认，不能通过提示词绕过。当前适合知识库协作，但业务效果仍需真实授权材料/真实模型验收 |
| 文档解析/OCR | B；Node 本地 TXT/MD、PDF 文本/DOCX 兜底，独立 parser 处理扫描 PDF、DOC、DOCX 和 PPTX/HTML/EPUB/MSG/IPYNB；本地 OCR、版序/表格/图像定位、元数据、安全内容清理与压缩包限额 | `doc-extract.service.ts:19,25,77,138,157`；`app/kb-doc-parser/serve.py:65,419,462,555,608,718,775,803,808,849` | Parser 是可沿用服务，非“待选型”。需要固定镜像与 OCR 模型/LibreOffice/字体/资源；扩展格式缺 parser 明确报错，无同等功能本地降级。真实扫描/复杂版式正确率本轮未测 |
| Embedding | B；自托管 BGE 中文512维、查询指令、FastEmbed/ONNX、Nest 客户端与可选兼容 endpoint、关键词回落 | `app/skills/kb_embed/serve.py:13,21,34,39`；`app/kb-embed/Dockerfile:14`；`embedding.service.ts:16,24,42,54,68` | 向量服务已存在；512维/模型/索引必须一致。兼容 endpoint 无实际域名/provider allowlist；health 只回配置/进程，未加载模型，不证明能 embed。模型初次加载可下载，镜像构建预热不是运行期禁止出网的证明 |
| 原始/预处理科研数据 | B；被试/访视绑定、字典、文件hash、幂等、Storage 引用、ProcessingTask、质量状态、分块上传、标准特征与查询回放 | `ingest/ingest.service.ts:178,339,382,448,974,1240,1438`；`raw-processing.service.ts:41,92,135,162`；`data/data.module.ts:11`；`data/data.service.ts:133,337,390,763,1011` | 目标仍用原始→处理→标准的来源链；只支持已有规范/映射契约，任意医院 schema 自动标准化未实现。PG 持久任务无需为了首期复用先重建 Redis 队列 |
| 眼动确定性导入 | A/B；字段映射、事件/注视点聚合、派生指标、质量告警、报表与处理任务关联 | `ingest/eye-tracking-import.ts:152,235,248,409`；`raw-processing.service.ts:595`；`data/eye-analysis.ts` | 可按首个 Study 需求选用，不能把眼动既有算法泛化为全模态检测；不恢复退役 VA/抑郁检测 |
| fNIRS/谐波化及通用 ML | C；fNIRS 归档登记/清单核验有实现，真实 MNE-NIRS 预处理和全模态 ML 不是现有在线后端 | `raw-processing.service.ts:357,389,397,425`；`orchestrator/skill-invoker.ts:271,280,488`；`docs/00-系统总纲.md:77` | fnirs-preprocess 路径返回 project-file-inventory/nextBackend，不是信号处理。若首期需要，作为明确新增算子与专业验收；不以 Skill 名称 complete 证明预处理完成 |
| 方案/入组/访视/执行任务 | B；方案版本/检查/批准/启用/复制、访视窗口与锚点、入组、任务/协作/提醒、访视要求举证/独立复核、疑问/偏离、驾驶舱/待办 | `study-operations.controller.ts:499,530,546,566,588,600,633,652,663,674,714,732`；`study-operations.service.ts:166,223,335,603,710,726` | 保留 StudyOperations + Remediation + Tenants/entitlements；改新 Study/角色/中心边界。受试者问卷邀请不是科研成员邀请；提醒成功不是研究完成 |
| CRF/表单 | B/C；模板、不可变已发布版本、研究者/H5分配、草稿/提交、必填/类型验证、确定性计分、事务内审计及访视要求联动 | `study-forms-policy.ts:1,7,10,38`；`study-forms.service.ts:51,132,164,187,358,370,452,469,480,497`；`prisma/schema.prisma:1794,1818,1843,1875` | **提交后禁止修改**，与用户已确认“采集可更正、保留前后/历史、PI审阅锁定解锁、新版本再审”有差额。只有 number/integer/text/select/boolean，不是完整 EDC 字段/条件引擎 |
| 量表/中医术语治理 | B；量表定义/版本/适用范围/计分规则，中医术语与映射版本、方法运行时的术语 manifest | `app/server/src/scales/`；`terminology/`；`research-methods/research-methods.service.ts:1066,1117`；`research-method-executors.ts:149,300` | 复用治理/版本和算子接口，量表使用权、实际版本/适用条件由团队配置；不能把简单 numeric-sum 当作所有临床量表已验证评分 |
| 确定性研究方法 | A/B；power 与 DQ 有真实 Python 算子，Nest 鉴权/entitlement、输入hash、执行manifest、运行状态、审核与质量放行 | `app/research-methods-worker/schema/v1.json:4`；`statistical_power.py:10,123,156,189`；`data_quality.py`；`research-method-worker.client.ts:30,43`；`research-methods.service.ts:92,518,604,620,645` | power 仅双均值/双比例/相关/簇设计效应等明确近似，不支持 repeated_measures；worker 仅声明 handshake/power/DQ 三项。注册6个专业 Skill 不等于6种统计计算；治理类执行器只生成待审结果 |
| 质量核查/放行 | B；安全汇总 manifest、确定性缺失/越界/重复/时间/来源等核查、不自动填补，问题处置/豁免与质量放行分开 | `research-methods.service.ts:622,630,695`；`data-quality-execution.ts`；`data-quality-release.service.ts`；`data-quality-remediation.service.ts`；`remediation/` | DataService 的组间分析先校验 current released gate（`data.service.ts:1011`）；不能复制统计函数后略过该门禁。分析放行不是 EDC 锁库 |
| 正式科研产物 | B；与会话 Artifact 分开，正式实体/不可变正文版本/来源快照/哈希、独立审核/发布、导出任务、私有文件下载、PDF Worker | `research-artifacts.service.ts:1474,1521,1575,1811,1869,2406,2532,2631,2818,3021,3240,3391`；`prisma/schema.prisma:829,867,896,919,944,971` | 应整域沿用；正式产物发布还不等于权利人已允许跨 Study/Hub 分享和衍生复用。需要在现有来源/版本之上增加共享许可边界，而非重建版本/导出 |

## 3. 知识库 UI 应整包复用的依赖边界

科研与管理已复用同一个知识业务页，不需要各重写一套：`app/web/src/pages/admin/KnowledgeManagePage.tsx:3,33` 和 `pages/workbench/Workbench.tsx:141,3399` 均挂载 `KnowledgeBasePage`。科研页提供树/搜索、原件/提取内容、编辑/审核/版本、右侧 Agent，以及窄屏面板和可调宽度。

| 可沿用部分 | 代码证据 | 对岐研前端的最小适配 |
| --- | --- | --- |
| 知识业务页与子组件 | `pages/knowledge/KnowledgeBasePage.tsx:13,139`；`KnowledgeBaseDialog`、标题/删除/未保存弹窗、回收站、去重计划卡、OriginalDocumentView、VersionDrawer | 保留业务组件目录作为受控功能岛，挂到现有公共 Shell；`initialKbId/initialDocId/onRouteChange` 已暴露，页本身没有 React Router import，先使用路由适配即可，不必导入整个旧 App |
| 编辑器 | `WikiEditor.tsx:1,107,124`；`EditorBoundary.tsx`；`components/Markdown.tsx:1` | Tiptap 3.31.3 的 StarterKit/Link/Image/Table/Placeholder、tiptap-markdown 0.9、react-markdown/remark-gfm 需一起沿用并锁定兼容组合；保留单实例编辑器及错误边界，避免重新引入切模式白屏 |
| API/上传/会话 | `api/client.ts:1,27,34,73`；`KbAgentPanel.tsx:1,157,444`；`api/session-attachment-browser-transport.ts` | `/api` 同源 Cookie、课题组/项目 header、ApiError/remediation envelope、上传进度/会话队列契约一起适配；仅改 URL 不会建立新身份授权 |
| 登录/权限与上下文 | `store/auth.ts:1,59,69,149`；`KnowledgeBasePage.tsx:153`；`App.tsx:405,438,439` | 当前 Zustand 登录为 tenantSlug+username，维护当前 group/project；新身份与 Hub/Study 应提供兼容 selector/上下文适配。前端角色只控制体验，后端必须重新验权 |
| 弹窗 Provider | `main.tsx:5,10`；`WikiEditor.tsx:13`；`VersionDrawer.tsx:3` | 可以在知识功能岛提供 `SystemDialogProvider`，不要求搬旧 BrowserRouter 或整站 Shell |
| 样式/构建 | `index.css:1,20`；`tailwind.config.js:3,8,11`；`web/package.json:58` | 组件使用旧 ink/brand Tailwind token 和 tiptap-prose；要做局部 token 映射/CSS作用域与构建 content 扫描，不能把旧全局 preflight/品牌/Shell 全注入岐研。现有视觉母版和冻结 Shell 继续优先 |

需要补齐/不要夸大的 UI：`VersionDrawer.tsx:7` 明确旧版本正文不返回，目前“查看”是元信息而非全文 diff；`OriginalDocumentView.tsx:26,73` 通过授权下载成 Blob，PDF iframe 可看原件，不能替换成公网 storage URL；本轮前端测试是逻辑/源码断言，未在浏览器挂载验证 Tiptap、响应式或真实导入。

## 4. 整套后端+Workers 与复制 Service 的成本风险

| 选择 | 可以保留的工程资产 | 需要承担的工作/风险 | 本审计判断 |
| --- | --- | --- | --- |
| 整套 Nest 后端与 Worker 源码受控复用至新独立部署 | 模块注入图、DTO/Controller/Guard、Prisma/迁移/RLS、审计、存储、持久任务、工具/引用契约、后端测试、知识UI配套API；parser/embed/method worker 已有 Docker/协议 | 冻结源版本；按用户确认共享实例/库/表、不同租户，独立部署配置/文件命名空间；先验证并修补四类后台归属，新增业务授权/对象映射，共享迁移单一入口；不复用旧教授身份或在文档暴露凭证 | 推荐待评审。减少依赖重建；共库是已确认目标，隔离与新旧兼容尚未验证 |
| 按 Service 逐文件复制 | 表面上少复制文件，适合少量纯策略函数 | Services 广泛依赖 Prisma 租户事务、Storage、Remediation、feature entitlement、模块 exports 和 runtime context；容易丢来源/审计/质量门、遗漏迁移与 Controller 验权、产生第二套 API，旧测试也需重接 | 不适合作为主方案。只对 A 类纯函数/算子使用，不以文件数估算复用成本 |
| 新前端直接共用旧业务运行后端 | 快速验证接口/页面，不更改旧前端 | 新对象/权限不等价，整套后端共享运行会耦合发布/任务；这与“独立业务后端、共享持久表”的推荐方案不同 | 仅作受控合成接口探针，不据此否决用户共库共表要求；本轮未创建环境 |

依赖链证据：`orchestrator.module.ts:13` 导入 Data/Knowledge/ResearchEvidence；`sessions.module.ts:22` 导入 Billing/Knowledge/Ingest；`knowledge.module.ts:18` 同时提供 Service/Import/Extract/Index/Embedding/Retrieval/Grounding/KbTools/Storage；`research-methods.module.ts:14` 引 Tenants/Data/Remediation；`study-operations.module.ts:23` 引 Tenants/Remediation；`research-artifacts.module.ts:14` 引 Remediation/Tenants/Storage。PrismaModule 与 OrchestratorModule 还是 Global providers。

应一起版本化的运行资产：`server/prisma/schema.prisma`、迁移与 `rls.sql`、`server/nest-cli.json:7` 的来源政策 Markdown 复制、后端 runtime/应用 Dockerfile、三个 Worker 的镜像/协议/依赖、字体与 PDF Worker、对象存储 adapter 和上传契约。不能只移 Service 后另起一套表。

## 5. 运行开关、服务与四层验收边界

本节只核对**源码声明**，未读取真实环境值；现存开关不代表建议将核心能力做成可选旁路。

| 能力 | 代码层事实 | 目标环境验收必须新增的证据 |
| --- | --- | --- |
| OpenCode | `opencode.env.ts:57` 探CLI版本，1.18及以上允许Web工具；`:89` 还要求二进制和DeepSeek凭证。`server/Dockerfile.runtime:4,13` 安装固定OpenCode，`:17` 声明路径，应用镜像使用该runtime（`server/Dockerfile:2,16`） | 镜像digest/CLI版本、可读写隔离目录、真实session和子阶段日志、失败与恢复；源码可用不能代替目标容器具备 |
| WebSearch/WebFetch | `controlled-web-research.ts:101` 无显式provider flags时按支持可启用；显式总开关禁用、两个provider都关闭或runtime不支持会拒绝。`docker-compose.ecs.yml:121` 声明证据/受控联网开启，provider为Parallel开启/EXA关闭的默认组合；`orchestrator.service.ts:2088` 区分配置失败并输出降级 | 全新公开主题的真实 query、site限制、获准URL、WebSearch与对应WebFetch、时间、状态、可读原页、中文/子题覆盖及业务报告；必须保持核心链必验 |
| PubMed/注册库 | `pubmed.client.ts:205` 与 `clinical-trials.client.ts:160` 独立配置；受控联网成功不自动证明这两种独立客户端也执行，反之亦然 | 分来源请求/返回与来源落库记录；注册库只作进展信号，全文/疗效综合按已有治理契约 |
| Parser | `docker-compose.ecs.yml:29` 声明独立服务；Nest无parser时仅基本PDF/DOCX/TXT/MD路径，DOC与扩展格式直接拒绝；配置了parser后服务失败也报错而非悄悄用低质量转换 | OCR/LibreOffice/依赖在目标镜像可用；合成扫描PDF、DOC/DOCX表格/图片、PPTX图片、HTML/EPUB等样例的正文/版序/页码/警告/来源核对；`serve.py:803`健康仅ok，不验证OCR |
| Embedding/RAG | `docker-compose.ecs.yml:2` 声明服务；真实服务入口在 `skills/kb_embed/serve.py`，不是 `kb-embed/serve.py`。客户端失败/维度错返回null，检索关键词兜底。`embedding.service.ts:68` 兼容端点healthy甚至只检查key存在 | 真正 `/embed` 512维输出、模型版本/预热、pgvector写入与授权检索命中、长文覆盖/中英文查询质量；关键词工作不能验收“向量RAG已启用” |
| 方法Worker | `docker-compose.ecs.yml:66` 独立worker；`research-method-worker.client.ts:30,39` 要URL+token；`research-methods.service.ts:620` 要租户功能授权；未配置明确fail-closed | 目标API→鉴权→真实worker→数值证据→数据库run→专业审核/放行的端到端记录，不能只拿本轮纯算子或fetch stub替代 |
| 持久任务 | `raw-processing.service.ts:92` 可被显式禁用；`:108` 恢复陈旧running；`:162` 条件claim；KB import和知识chat也有数据库状态与进程调度 | 重启/重复任务/并发/失败恢复；迁新环境时明确启用任务，不让成功上传掩盖未执行处理 |
| 业务授权/审计 | `PrismaService.forTenant:43` 事务设置tenant/group/project；`rls.sql:156,180` 对KB经父资源过滤；Retrieval/Index/队列等仍使用elevated并依赖代码作用域 | 独立账号跨Hub/Study/中心的允许与拒绝矩阵、真实RLS角色/策略、审计原子性、下载权限；源码或Mock越权测试不能证明部署角色正确 |

需要保留的质量边界/疑点：

1. `ingestion.service.ts:43` 单文档最多200块，截到上限没有返回覆盖警告；长书/指南“全文入库”和“全文可检索”应分别验收，不能只看解析成功。
2. `ingestion.service.ts:73` 先删旧索引再重建，失败/并发/重试需要环境测试；KB import active集合也不是跨进程锁，不应无验收就扩成多实例。
3. 普通未审草稿允许先向量化，只有带直接标识的未审草稿被挡在Embedding前（`ingestion.service.ts:79`）；“未审核不可检索”与“未审核不会外发任何embedding endpoint”是不同保证。兼容Embedding endpoint缺域名硬约束，应在迁移时闭合，不以提示词替代。
4. `KbCitation`（`grounding.service.ts:9`）没有文档version/hash；历史引用原件与正文变更后的对齐需补验/补契约。正式ResearchArtifact来源快照已有独立版本哈希，不能用后者推定聊天引用同样不可变。
5. `HealthController.ready:29` 现有DB/migration与能力布尔元数据，但没有真正执行OSS、Parser OCR、Embed、模型或Web请求；deliveryReady不是业务验收。

## 6. 本轮实际验证

所有测试均先检查导入与脚本：未运行启动/acceptance脚本、未启动Nest应用或真实Prisma实例，HTTP客户端用注入stub。Python只读仓库内合成golden fixture，设置 `PYTHONDONTWRITEBYTECODE=1`；TS测试用现有 `ts-node/register` 源码运行，无安装/外连。

| 执行组 | 实际结果 | 证明范围 |
| --- | --- | --- |
| `app/research-methods-worker`：`python3 -m unittest test_statistical_power test_data_quality` | 12/12，exit0 | 闭式样本量、golden DQ、非法输入/不支持设计关闭；无DB/HTTP服务器/模型 |
| 后端组1：metadata/lifecycle/content/file-policy、forms-policy、worker.client、retrieval.service | 39/39，exit0 | 元数据/文件门禁/生命周期/表单计分；worker响应契约、检索元数据批查；后两者用stub，不证明真实检索/计算服务 |
| 后端组2：knowledge-deduplication/import-decision/doc-extract/ingestion/base-governance | 37/37，exit0 | 去重预检/冲突、导入决定、解析路由/缺服务报错、索引定位、管理员治理；Parser/Embedding/Prisma替身，不证明真实OCR/向量索引/DB权限 |
| 前端知识库9个测试文件 | 41/41，exit0 | base-management/chat-state/deduplication-ui/document-view/document-title/import-decision/navigation-ux/pane-layout/trash-ui；纯逻辑与源码断言，不是React浏览器/E2E |
| 产物/CRF/专业执行器7个文件，直接raw-TS执行 | 48/49；1失败，exit1 | PDF测试无法resolve编译后的 `.worker.js`；保留首次失败，未当产品回归下结论 |
| 隔离完整TS编译 | `tsc --project tsconfig.json --outDir /tmp/aisci-reuse-audit.jj8JST --incremental false`，exit0 | 当前没有 `tsconfig.build.json`，用项目实际tsconfig；未覆盖dist/未运行任何服务，不证明镜像构建/环境就绪 |
| 正确编译后的 `research-artifact-export.spec.js` | 4/4，exit0；真实DOCX/PDF二进制测试约6秒 | NODE_PATH仅指已有server依赖；DOCX ZIP/PDF签名、MIME、异步Worker不阻塞入口与文件名/方法来源契约。输出为内存Buffer；未做页面渲染或目视排版验收 |

首次PDF失败根因证据：`research-artifact-export.ts:222`显式`require.resolve('./research-artifact-pdf.worker.js')`，Worker源码存在 `research-artifact-pdf.worker.ts`；项目正式`test:artifacts`（`server/package.json:25`）先build再跑JS。隔离编译后同一测试通过，支持“raw-TS启动方式不满足打包契约”的结论。没有修改导出器以迁就审计脚本，也没有混写成“全部生产测试通过”。

后端组1、组2、产物组命令形式：`TS_NODE_TRANSPILE_ONLY=1 node --require ts-node/register --test --test-reporter=spec <相应src/*.spec.ts>`；前端：`node --import tsx/esm --test --test-reporter=spec <tests/knowledge-*.test.mjs中上述9个文件>`；编译后：`NODE_PATH=/Users/mac/aisciencesys/app/server/node_modules node --test --test-reporter=spec /tmp/aisci-reuse-audit.jj8JST/research-artifacts/research-artifact-export.spec.js`。本轮不运行带临时文件写入的subject-profile导入测试，也未运行Parser服务测试或真实BGE加载。

**尚未验证的层次：**目标ResearchHub后端部署/功能开通、真实模型和联网工具、真实OCR/Embedding、DB RLS/对象存储、浏览器挂载录屏/截图、真实研究参数与专业结果验收。以上不能因本轮离线通过而销项。

## 7. 旧分析与技术资料需修订的具体说法

| 旧资料说法/遗漏 | 当前证据与修订建议 |
| --- | --- |
| 旧复用报告基于 `eadac113...` 的稀疏副本，强调“业务Service优先提取” | 当前根HEAD为 `9b2bf43...`，需以整域模块/迁移/RLS/worker/UI依赖作为估算单位；纯函数才逐文件提取。保留“不整体替换岐研前端”结论 |
| 技术清单 `docs/tech/04-当前项目技术方案与组件清单.md:140,212,251` 称生产镜像缺OpenCode/Embedding | 当前 `server/Dockerfile:2,16`、`Dockerfile.runtime:4,13`、`kb-embed/Dockerfile:14`、`docker-compose.ecs.yml:2,29,66` 已有镜像/服务声明。改为“代码已补齐构建声明，实际发布/镜像digest与目标环境启用待验证”，不能继续估成从零接入 |
| 技术清单 `:214` 称app无 `.dockerignore` | 当前 `app/.dockerignore:1` 已存在；仍要审查过滤是否覆盖所有敏感/运行目录，不能继续列“缺文件”，也不能仅因存在就宣称构建上下文完全安全 |
| 技术清单 `:218,259` 只说健康检查验证DB | 当前 `health.controller.ts:29,70,95` 已增加迁移与能力元信息/配置就绪判断；但仍不实际测OSS/Parser/Embed/模型/Web执行，修正描述而保留真实依赖验收缺口 |
| README笼统说Python算子“待接通”，或因research-method-executors的unavailable函数认定样本量/DQ未接 | Python worker有实现；`research-methods.service.ts:620,645` 对这两类Skill显式走Worker再验证。缺口是目标环境配置/entitlement/真实HTTP执行，不是重写样本量/DQ。其他MNE-NIRS/Rmonize/ComBat不能因此被算作已接 |
| 将知识库概括成“RAG + 文档上传”，或只计划复用metadata/dedup函数 | 应加入完整编辑/原件/目录/审核/版本/回滚/去重人工决定/回收站/持久Agent队列、管理端共用组件和已有测试。王教授Excel适配器是新增差额，不能因入口不收XLSX而重建知识库 |
| “引用版本”容易被理解为所有RAG引文已经不可变 | 目前聊天Citation没有version/hash，版本列表无正文；保留目标要求并单列差额。正式产物快照已有哈希是可复用基础 |
| 把“诊断/专用多模态D级”扩展为整个Agent内核不迁 | 可以不启用旧专用业务persona，但应沿用会话/编排/工具/审计/证据/模型边界。数据Agent、科研Agent、知识Agent分别保留已有能力 |
| 把“表单已锁定/已提交”算作用户已确认的EDC流程完成 | `study-forms.service.ts:452`仍拒绝提交后修改；更正版本、PI审阅/锁定/解锁、新版重审及签署/分析快照链是首期真实开发差额。表单版本锁、DQ放行与研究数据锁定分别处理 |

## 8. 首期应补的差额与不该重写的清单

不该重写：OpenCode/DeepSeek适配与编排、会话/附件/背景运行、知识库整套后端与业务UI、文档解析与OCR服务、Embedding/RAG/引用展示、文件对象/hash/幂等任务、方案/入组/访视/任务/疑问/偏离、确定性power/DQ及质量放行、正式产物版本/来源/审核/发布/导出。

与用户当前新平台目标直接相关的差额：

1. 新身份/Hub/Study与旧tenant/group/researchProject的映射及权限闭合；首期三角色应落到真实动作/资源，而非只换名称。不得直接将StudyGroup改名Hub。
2. 文献Excel批次适配：Source/file/sheet/row/hash→候选去重/分类→人工确认→规范文献/Hub归属；已有文档导入与去重规则继续复用。
3. 用户已确认的CRF更正版本、前后值/审计、PI审阅锁定解锁、新版本再审及历史分析/结论不覆盖；真实字段/访视/规则来自首个完整Protocol/CRF样表。
4. Hub公开目录/领域聚合、已授权资产共享与派生边界；旧私有项目发布不能默认变成Hub公共许可。
5. 新前端的API/身份/上下文/CSS适配，尤其完整知识业务岛；保留现有Shell与业务母版，不重新造编辑器。
6. 目标环境真实服务链验收：核心Agent联网、Parser/OCR、Embedding、方法Worker、持久任务、RLS/存储/审计；实际四层验收证据及专业用户产物。不要把以上能力关闭后作为“首期完成”的办法。

跨中心、盲态、随机化/揭盲、全模态预处理、更多统计分析等只按首个Study明确要求纳入；本审计不把旧资料的“下一步”扩展为本轮实施指令。具体承诺/排期由主报告结合真实Study输入另定，不依据源码量虚构人日或上线状态。
