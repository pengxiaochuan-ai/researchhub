# ResearchHub 科研课题流程：逐模块复用清单

版本：V0.2 · 2026-11-11。状态：**调用方式已补齐，首批创建代码与本机技术验证已落实；生产与用户专业验收未完成，其余模块仍按计划实施。**

需求来源：用户要求在[全流程设计](research-study-workflow-design-2026-11-11.md)基础上，明确旧系统服务入口、直接调用项、适配项和新增项，再编排开发任务。配套：[任务计划](../planning/research-study-workflow-2026-11-11/implementation-plan.md)、[核对与评审记录](../planning/research-study-workflow-2026-11-11/reuse-review.md)。

## 1. 复用原则与证据范围

继续复用旧 NestJS 业务核心、公共表、确定性算子和审计契约；由 ResearchHub 的独立装配、对象映射与页面承接。**可复用源码、已经装配、真实执行、业务验收是四种不同状态。** 原清单阶段仅只读核对；用户后续已授权代码实施。首批创建的代码、合成PG/API/Chrome真实执行与限制见[实施规格](research-study-creation-2026-11-11.md)和[证据](../testing/research-study-creation-2026-11-11.md)，不把本批状态推广到其他模块。

- **直接调用**：契约相同的纯函数；或在已授权、同一事务和相同输入范围内的既有核心。直接调用不意味着免配置、免授权或免测试。
- **适配后调用**：保留旧算法和业务规则，处理 Hub 对象、当前角色、租户/中心、版本、事务、输出及页面差异。Controller 上的 Guard 不会因裸调 Service 自动执行。
- **新增/补强**：旧代码没有对应业务契约，或现有实现不能覆盖本次要求。只补缺口，不为复用另建平行账户、患者、任务、Agent 或 EDC 内核。

下文旧 HTTP 入口均带 `/api`（`app/server/src/main.ts:34`）；是旧服务现有入口，**不代表 ResearchHub 同路径已经开放**。Service 方法列的是源码入口，不是可绕过 Controller 的公共授权 API。

### 调用方式总表

| 模块 | 调用方式 | ResearchHub中的调用链 |
| --- | --- | --- |
| M00认证/作用域 | 源码复用 | Hub自己的Auth/API→现有认证服务、会话与事务原语 |
| M01课题/执行项目 | 源码复用＋Hub适配 | Hub课题API→意图/Study绑定→旧项目事务核心 |
| M02方案/启用 | 源码复用＋Hub适配 | Hub研究API→旧版本、发布检查和启用服务 |
| M03被试/入组 | 源码复用＋缺口补强 | Hub采集API→既有Subject/Enrollment核心＋筛选/同意守门 |
| M04访视/证据 | 源码复用＋Hub适配 | Hub访视API→旧窗口/要求项/完成核心＋明确来源绑定 |
| M05任务 | 源码复用（已有局部调用） | Hub任务API→executeHubTaskCommandInTransaction |
| M06表单/答卷 | 源码复用＋修订补强 | Hub采集API→旧字段校验/表单服务＋正式修订治理 |
| M07H5/触达 | 源码复用；外部渠道按实际API接入 | Hub邀请/会话API→旧会话逻辑；真实短信等另用获准渠道API，非旧沙箱API |
| M08量表/结局 | 源码复用 | Hub量表API→旧版本治理/确定性计分 |
| M09导入/文件 | 源码复用；独立处理服务沿既有API | Hub上传API→旧导入/存储；已独立部署的解析/处理服务按受控接口调用 |
| M10质控/放行 | 源码复用 | Hub质量API→旧质量规则/放行事务，按正式快照适配 |
| M11分析/Worker | 源码复用＋服务API | Hub分析API→旧Methods/WorkerClient源码→Worker的/v1/execute |
| M12产物/导出 | 源码复用 | Hub产物API→旧版本/审核/导出服务及受控存储 |

主方案不通过HTTP转发整套旧系统业务API。旧系统和Hub各自提供产品入口，共用可维护的业务核心和现有公共模型；本表不表示上述所有模块已经接通。

## 2. 逐模块清单

### M00 · 认证、当前身份、作用域与事务

**现有入口**：`AuthService.login/me`；旧 `/api/auth/login|logout|me`。Hub `createHubAuth({require,load,jwt,prisma,scope,cookieName,origin,secureCookie})` 已复用 AuthService，提供 login/logout/renew/me；`PrismaService.forTenant(tenantId,groupId?,executionProjectId?)`、`withTenantTransaction(..., callback)`；`lockAuthorizationMutation/withAuthorizationMutation`。

- **直接调用**：身份校验服务和既有授权锁/作用域事务原语，前提是调用者传入服务端核实的范围。
- **适配**：沿 Hub 12 小时活动会话政策，装配当前账号/租户、Hub 负责人、租户管理员、Study/中心和盲态授权；不能回退旧 Cookie/JWT 策略。
- **新增/补强**：统一产品 Study 到执行作用域的解析与提交前重验；正式模块装配及 capability 投影。不得按邮箱、前端角色标签或具名测试账号授权。
- **依赖/副作用**：`forTenant` 每次操作单独包事务；需要原子写入时用 `withTenantTransaction` 同一 tx，回调内不再嵌套 `forTenant`。elevated 客户端不会自动带来业务授权。
- **落点/任务**：所有研究/管理页面的支撑；T00、T01。

### M01 · 课题意图、执行项目创建与成员

**现有入口**：`GET/POST /api/study-groups/:id/research-projects`、`PATCH /:projectId`、成员 GET/POST/DELETE，旧 Controller 限 `tenant_admin`；`StudyGroupsService.researchProjects/createResearchProject/updateResearchProject`。管理员入驻另走 `/api/project-onboardings` 的 create/configureMembers/copyTemplate/publishTemplate/complete 等。

- **直接调用**：既有项目字段/唯一性规则、成员和审计契约可沿用；管理员现有调用路径保持。
- **适配**：Hub 普通研究者新建须独立检查创建权限和可写课题组；不能伪装管理员调用 elevated Service。Q01/Q02/S01 的新建、列表、详情、编辑和继续必须指向同一对象。
- **新增/补强**：课题意图记录、产品 Study 与旧 ResearchProject 执行容器的显式绑定；创建幂等、失败原子性、来源及版本。旧系统已有正式执行项目 CRUD，缺的是 Hub 产品对象及自助入口。
- **依赖/副作用**：`createResearchProject` 自建事务，连写 ResearchProject、创建者 project_manager 成员和 audit；不能在外层另建意图后假定两次事务原子。若要组合，提取最小内部 tx 核心并保留旧入口。ProjectOnboarding 的 acceptance-fixture 会建合成方案/被试/访视/表单，onboarding complete 不等于正式研究启用。
- **落点/任务**：Q01/Q02/S01、管理员研究列表/成员；T00、T02、T03。

### M02 · 方案版本、访视/采集配置与启用

**现有入口**：`/api/study-operations/protocol-versions` 的 GET/POST、`:id/transition`、`:id/release-checks`、`:id/activation-preview`、`:id/activate`、`:id/visit-plans`。`StudyOperationsService.createProtocolVersion/transitionProtocol/runProtocolReleaseCheck/previewActivate/activateProtocol/addVisitPlan`。

- **直接调用**：`canTransitionStudyProtocolStatus`、`assertProtocolVersionMutable`、`buildProtocolReleaseFindings/evaluateProtocolReleaseGate`、`buildStudyStartupChecklist`；合适范围内的版本/启用事务核心。
- **适配**：把 Hub 已确认草稿显式转为正式配置；区分草稿、批准、启用，带入发布表单/量表版本。新旧版本迁移先预览，不静默改历史。
- **新增/补强**：可回读核对的采集配置编辑契约。当前 `addVisitPlan` 接收的 requirements 没有在该方法保存，不能直接套追加路由并声称必采项已配置；Controller 与 Service 的研究人群/统计摘要字段也需一致。
- **依赖/副作用**：初建版本同时写 VisitPlan、Requirement、TaskTemplate；启用可能 supersede 旧版和迁移入组。必须保留 Remediation 等发布检查依赖，不能因手工装配省略而弱化治理。
- **落点/任务**：S02/S07/S11、负责人审批与管理视图；T04、T05。

### M03 · Subject 建档、筛选、同意与入组

**现有入口**：`/api/subjects` 的列表/搜索 options/创建/详情/更新/软删除；`SubjectsService.list/options/create/detail/update/softDelete`。`GET/POST /api/study-operations/enrollments`，`enroll(user,{subjectId,armCode?})` 及内部 `enrollInTransaction`；`:id/anchors`。

- **直接调用**：正式 Subject 数据契约、分组规则、搜索及审计；已授权范围内建档服务；`instantiateEnrollmentVisits/computeVisitWindow/resolveVisitAnchor` 等确定性函数。
- **适配**：S03/S04 显示真实生命周期和授权中心；编号、Study、组别带入，入组与建档分开。
- **新增/补强**：筛选/纳排结论、有效同意/豁免版本、筛选失败/退出/完成的业务命令，并把前置条件加到正式入组提交守门。旧 `enroll` 主要检查执行方案、Subject 和重复入组，然后直接写 enrolled；传 armCode 不等于随机化。
- **依赖/副作用**：入组同时写锚点、访视、要求满足记录、任务及审计。`Subject.consentScope` 文本不能替代研究/数据使用同意的版本与状态；M07的ParticipantConsent按purpose/channel管理触达，也不能直接当完整入组知情同意或数据使用协议。枚举有 withdrawn/screen_failed 不等于已有对应业务入口。
- **落点/任务**：S03/S04、管理者纳排/同意/退出监督；T06。

### M04 · 访视、要求项与证据归属

**现有入口**：`GET /api/study-operations/visits`、`PATCH /visits/:id`、要求项 attest/verify、requirements/refresh、complete。`listVisits/updateVisit/attestVisitRequirement/verifyVisitRequirement/refreshVisitRequirements/completeVisit`。

- **直接调用**：窗口/锚点、状态转换、`evaluateVisitRequirements`、完成条件和 CAS 规则；复用独立完成接口，不通过 PATCH completed 绕过复核。
- **适配**：S09 正式待办/详情、缺项和补录入口；按确定版本核对再完成；关联 S04/S08，保留实际时间/超窗原因。
- **新增/补强**：表单修订、量表结果、文件/检查与具体访视的显式记录/版本绑定、去重与允许复用规则；研究需要时补额外访视业务入口。
- **依赖/副作用**：旧 scale/file 证据部分按 Subject＋时间窗查找，档案看当前值；时间吻合只能作为候选。完成会推进入组/后续锚点并写审计，必须与最新证据同事务核验。
- **落点/任务**：S09/S04、管理者访视复核；T07、T08、T09。

### M05 · 工作任务、验收、提醒和关联

**现有入口**：旧 `/api/study-operations/tasks`、assignment/review/reminders；核心 `executeHubTaskCommandInTransaction(db,principal,scope,command)`。Hub `/api/study-tasks` 已有 create/edit/assignments/transitions/reviews/reminders/context、分页/回执入口。

- **直接调用**：上述事务核心、状态/依赖/完成验收规则；继续使用已有任务执行器。
- **适配**：复用 Hub 幂等、分页、context、收件人和审计层，装配正式当前角色/范围，接真实 SubjectVisit/答卷版本的关联摘要与回链。
- **新增/补强**：正式关联解析和端到端验收；仅在实际需要时增加新关联类型。任务完成不能自动作为访视/数据放行事实。
- **依赖/副作用**：当前 Hub Controller 限本机/具名合成库，`allowFormal:false`，formal_visit 候选不可用。不能只翻开关；旧 remindTask 的 sent 记录不证明外部投递，Hub recorded 更诚实。任务核心需调用方拥有当前授权、同一事务和幂等回执。
- **落点/任务**：沿用 S08 已有整页能力及管理员职责；T10。

### M06 · eCRF、通用表单与正式答卷

**现有入口**：`GET /api/study-forms/templates`、模板 clone、versions PATCH/publish、assignments GET/POST、`:id/draft` PATCH、`:id/submit` POST；`StudyFormsService.listTemplates/cloneTemplate/updateVersion/publishVersion/assign/saveDraft/submit`。

- **直接调用**：`normalizeFormSchema`、`normalizeAndValidateAnswers`；经核对适用的 `scoreFormResponse`（numeric-sum-v1）。
- **适配**：已发布锁定版本的分配/暂存/提交，研究者操作身份、访视、字段状态和当前角色；沿用已有表单骨架，不新建通用 EDC 设计器。
- **新增/补强**：正式响应修订、当前指针、原因/前后值、CAS、退回/授权更正、审阅/锁定/解锁与失效传播。合成包的 ArtifactVersion 更正可参考，但不能作为正式 FormResponse 的存储替代。
- **依赖/副作用**：当前已提交响应禁止修改；每 assignment 一个 FormResponse。`listTemplates` 可能初始化内置模板，不能当成零副作用探测；`assign`/submit 会写响应/访视满足事实，不能在试填预览调用。
- **落点/任务**：S11/S09/S05、管理者模板/审阅；T04、T07、T08、T09。

### M07 · Participant、H5 问卷与触达

**现有入口**：`/api/study-outreach` 与 `/api/questionnaire-sessions`；`StudyOutreachService.createParticipant/addContact/grantConsent/withdrawConsent/createInvitation/startH5/getH5Session/saveH5Session`。

- **直接调用**：邀请/会话纯校验、令牌及同意状态策略、相同表单校验；符合新修订契约后复用受限 H5 流程。
- **适配**：Participant 与研究账号分离，绑定 Study/受试者/访视/发布表单；自填/他评权限、邀请有效期、撤回和提交后更正与 M06 一致。渠道/用途同意与M03研究入组/数据使用同意分别校验，不能一项granted自动替代另一项。
- **新增/补强**：实际获准渠道与投递回执、发送/打开/答卷状态分离、幂等重试/去重限频、撤回后的排队/在途/导出限制。链接发放本身也是可选交付方式，但不得称短信已送达。
- **依赖/副作用**：当前 createInvitation 调用 `sendSandboxMessage`，渠道为 sandbox；H5 提交同样拒改已提交响应。不能复用 sandbox 成功回执宣称真实触达，不能让通用后台认证放宽公共会话接口。
- **落点/任务**：S09 分配/回收、受限 H5、管理者同意与渠道；T11、T12。

### M08 · 专业量表版本、结局与计分

**现有入口**：`GET /api/scales`、`POST /api/scales/registry`、`GET /api/scales/:code`、`POST /api/subjects/:subjectId/versioned-scale-results`；`ScalesService` 的版本发布/适用性、结局定义和 `createVersionedResult`。

版本治理实际入口还包括`/api/scale-governance`的GET versions、POST definitions/:definitionId/versions、POST versions/:versionId/publish、GET versions/:versionId/impact-preview、POST versions/:versionId/apply-to-project、GET/POST outcomes及POST outcomes/:outcomeId/publish。对应`createScaleVersion/publishScaleVersion/previewScaleVersionApplicability/applyScaleVersionToProject/createOutcomeDefinition/publishOutcomeDefinition`；写操作保持`scale.manage`，适用性功能保持`study_operations`条件，不能只复用ScalesService而遗漏Controller守门。

- **直接调用**：`scoreVersionedItems`、`validateManualTotal`、适用的授权/缺项/版本纯策略；只用于对应声明的算法和输入。
- **适配**：将已确认量表版本及结局定义绑定本研究/访视，保留原始项目、执行规则、来源与填写方式。
- **新增/补强**：明确访视/答卷修订引用、结果更正后的失效关系，以及首个实际量表缺少的确定性规则；未具备规则时真实标记未计分。
- **依赖/副作用**：旧 ScaleResult 没有直接 subjectVisitId；通用 numeric-sum-v1 不是所有量表的执行器；不能由 LLM 填缺项、造阈值或分数。
- **落点/任务**：S11/S09/S05；T04、T07、T08、T15。

### M09 · 文件、批量导入、原始/标准数据

**现有入口**：`POST /api/ingest/raw`、raw-uploads/chunks/complete、preprocessed，GET tasks，confirm-eye-import/confirm-profile-import；`IngestService` 对应处理与确认方法；`GET /api/data/raw-items|features` 及受控原件 content；StorageService。

- **直接调用**：已支持格式的解析/预检、文件校验、分片与受控存储、单位/值域契约及已有确定性处理器；不增加未经审核的模态处理。
- **适配**：Hub 身份、当前被试/访视、数据字典、导入映射与预览、问题定位和受控下载；确认入库要可查回执。
- **新增/补强**：本研究通用 CRF 批量导入的映射/行键/冲突策略；导入行到正式响应修订及访视；检查文件、处理任务与 Feature 的完整来源链和重复处理防护。
- **依赖/副作用**：上传完成/确认导入可能启动处理并写数据，不是纯文件保存。Feature 虽有 sourceModalityFileId，既有预处理写入路径未必填入；不能概括为所有特征已有源文件/访视归属。音视频只按当前支持边界归档，不恢复退役检测。
- **落点/任务**：S09/S04/S05、管理员字典/任务检查；T13、T14。

### M10 · 数据疑问、偏离、质控与放行

**现有入口**：`StudyOperationsService.createQuery/listQueries` 及回复/关闭、`createDeviation/listDeviations` 及处置；`DataQualityReleaseService.recordEvaluation/current/release/createWaiver/revokeWaiver/assertCurrentReleasedWithTx`；`/api/data-quality/release-gates/current` 及 gate release/waivers 等入口。

- **直接调用**：数据疑问/偏离状态规则，`canonicalManifestHash/createGateEvaluation/releaseGate/assertQualityReleased` 等纯契约。
- **适配**：质量输入明确本研究、访视、正式答卷修订/文件和变量范围；按当前权限复核关闭、签署与放行。
- **新增/补强**：正式答卷审阅/锁定层、修订和同意范围变化使质量门/快照/结果失效的连接。已提交表单数不等于其答案通过质量检查。
- **依赖/副作用**：release/waiver 是有业务后果的写操作，current/assert也可能将旧门标为stale；不能归为纯读。旧全研究统计及固定阈值不能直接当新 CRF 放行标准，豁免要明确范围/原因而非隐藏问题。
- **落点/任务**：S05、负责人/数据管理审核；T08、T09、T15。

### M11 · 数据取数、分析运行与确定性 Worker

**现有入口**：`POST /api/data/group-stats|report`；`DataService.groupStats/report/executeDataAnalysisQueryWithTx`；`/api/research-method-runs` 的 create/workbench/list/detail/cancel/reviews；`ResearchMethodsService.create/createFromWorkbench/review`，`ResearchMethodWorkerClient.execute(executorKey,input,requestId)`。

- **直接调用**：适用输入的确定性汇总、方法状态/数值策略、WorkerClient 协议和既有白名单执行器；不重建队列/Worker 内核。
- **适配**：当前授权、已放行的数据范围、明确研究臂/访视/变量；接实际算子及服务配置，保存真实工具与运行证据。
- **新增/补强**：正式响应/量表/检查→分析变量投影，固定 snapshot/manifest，明确 SAP 和第一项约定统计方法；纵向/多组/缺失处理按各自契约实现。新增方法要同步MethodsService技能注册/执行分派/结果映射、适用入口和目标环境Agent/Skill授权，不能只扩Worker白名单。
- **依赖/副作用**：旧 groupStats 读 Feature 且固定 case/control 桶；通用问卷不会自动进入该数据源。确定性汇总按Feature行算n/mean/sd/min/max，不能把重复访视行当独立受试者。现Worker实现白名单为`handshake`、`research-data-quality`、`statistical-power`，样本量/效能设计不等于实际疗效分析；回归/混合模型等若研究需要属于新增算子。Hub 合成方法只覆盖有限 CRF 缺失/人工范围，不能当正式计分/疗效/重复测量。Worker 未配置会失败，不能用其他成功步骤掩盖未执行。
- **落点/任务**：S06、负责人分析计划/结果核对；T15、T16。

### M12 · 报告、产物版本、审阅与导出

**现有入口**：`/api/research-artifacts`、`/api/research-artifact-exports/:jobId`、`/api/research-artifact-files/:fileId/content`；`ResearchArtifactsService.create/createVersion/submitReview/review/createExport`、Agent/任务结果交付入口。

- **直接调用**：不可变版本、来源/哈希/完整性、既有产物与导出状态规则；适用范围内的创建/审阅/导出服务。
- **适配**：正式分析快照/Run/表图到报告来源契约，旧基准与当前状态、Study/中心/盲态和公开范围；研究者/管理员在同一版本审核。
- **新增/补强**：本次正式统计运行的来源类型/材料包映射；源更正、撤权、同意限制后的访问与导出重验。
- **依赖/副作用**：createExport 产生文件与任务，非只读；部署须实际启用research-artifact-export，否则WORKER_DISABLED。模板与正文版本、审核、发布、导出成功需分别证明。AI 只解释已存在结果，沿用现有 Sessions/Orchestrator/业务 Token 与来源核验，不另建 Agent 或检索专项。
- **落点/任务**：S10/A01/A02/G01、管理者导出与共享；T17。

## 3. 必须显式补齐的缺口

| 缺口 | 最小结果 | 对应任务 |
| --- | --- | --- |
| N01 对象与运行入口 | Project意图/Study/执行ResearchProject身份不同且可追溯，正式装配不依赖具名合成夹具 | T00–T03 |
| N02 可执行配置交接 | 草稿→发布表单/量表→Protocol要求→审批启用，保存后回读不丢要求项 | T04–T05 |
| N03 筛选、同意和退出 | 业务事实进入入组/采集守门，撤回效力覆盖后续处理 | T06、T11、T15 |
| N04 正式修订与审阅锁定 | 原值/新值/原因/actor/时间、签署绑定版、解锁和重审 | T07–T09 |
| N05 访视与数据血缘 | 答卷/量表/文件/特征引用具体记录和版本，避免时间窗误归属 | T07、T10、T14–T15 |
| N06 真实问卷触达 | 可受控发放、填写、回收、撤销、到期与渠道回执，沙箱成功不混报 | T11–T12 |
| N07 批量入口 | 通用CRF行映射、校验预览、幂等提交、更正和拒绝行回执 | T13 |
| N08 正式分析链 | 变量投影→放行快照→约定确定性方法→报告与受控导出 | T15–T17 |

以上是能力缺口，不意味着每项都新建独立表或服务。先复用现有模型/事务；新增实体和最小旧代码补强在 T00 的兼容与授权契约中定稿。

## 4. 复用装配约束

1. 不整套启动旧 AppModule。它包含多个后台/运行模块；须逐项检查生命周期、副作用和扫描范围，Hub 只装配本批必要 Controller/Service/Provider。
2. 不直接将 local-knowledge/local-* 体验脚本作为正式启动器；fixture-guard、合成账号/库指纹和 localhost 围栏保留在测试入口，正式入口使用目标环境配置、租户/角色/对象守门。缺配置明确失败，不通过删除围栏伪装上线。
3. 所有正式请求把产品 Study 解析到服务端真实 tenant/group/executionProject，保留 Hub 负责人及租户管理员既定业务权限，同时执行当前身份、中心/盲态、同意、版本、状态和审计。
4. 新旧公共结构仅通过一个受控迁移链变更；Hub特有兼容扩展不复制公共账户/患者表。不迁移旧历史研究数据、不重构旧业务、不从新入口扫描其他租户旧数据。
5. 单个创建/修订/提交/放行命令的业务写入、关系、幂等回执与审计必须在同一授权事务；旧方法自建事务时先评估可组合核心，不套两层事务伪称原子。

## 5. 核对证据与现有验证入口

| 模块 | 代表源码位置（本轮快照） | 现有测试入口（本轮未执行） |
| --- | --- | --- |
| M00 | `researchhub/server/auth/controller.mjs:3`；`app/server/src/prisma/prisma.service.ts:71`；`app/server/src/common/worker-publication.ts:40` | Hub auth/session.test.mjs、session-pg.test.mjs；旧worker-publication.spec.ts |
| M01 | `app/server/src/study-groups/study-groups.controller.ts:169`；`study-groups.service.ts:481`；`project-onboarding/project-onboarding.service.ts:826` | 旧project-onboarding-boundary.spec.ts；test:project-onboarding |
| M02 | `app/server/src/study-operations/study-operations.service.ts:743`、`:849`、`:1167` | study-operations.service.spec.ts、protocol-release-policy.spec.ts |
| M03 | `app/server/src/subjects/subjects.service.ts:43`；`app/server/src/study-operations/study-operations.service.ts:1363` | test:subjects、study-operations.service.spec.ts |
| M04 | `app/server/src/study-operations/study-operations.service.ts:1832`、`:3015` | study-operations.service.spec.ts、study-operations-controller.spec.ts |
| M05 | `app/server/src/study-operations/study-operations.service.ts:2100`；`researchhub/server/study-tasks/controller.mjs:29`；`commands.mjs:64` | study-task-transaction.spec.ts；Hub server/study-tasks/*.test.mjs |
| M06 | `app/server/src/study-operations/study-forms-policy.ts:44`、`:86`、`:115`；`study-forms.service.ts:452` | study-forms-policy.spec.ts、study-forms-boundary.spec.ts |
| M07 | `app/server/src/study-operations/study-outreach.service.ts:205`、`:260`、`:409` | study-outreach-policy.spec.ts、study-operations.service.spec.ts |
| M08 | `app/server/src/scales/scale-version-policy.ts:54`；`scales.service.ts:697` | scale-version-policy.spec.ts、scale-delivery-boundary.spec.ts |
| M09 | `app/server/src/ingest/ingest.controller.ts:110`；`ingest.service.ts:1424` | test:multimodal、preprocessed-file-policy.spec.ts |
| M10 | `app/server/src/research-methods/data-quality-release-policy.ts:25`；`data-quality-release.service.ts:370` | data-quality-release-policy.spec.ts、data-quality-release-boundary.spec.ts |
| M11 | `app/server/src/data/data.service.ts:1077`；`app/server/src/research-methods/research-method-worker.client.ts:44` | test:research-methods；旧research-methods.service.spec.ts |
| M12 | `app/server/src/research-artifacts/research-artifacts.service.ts:2451`、`:2676`、`:3066` | research-artifact-integrity.spec.ts、research-artifact-export-scope.spec.ts |

同一行中省略目录的文件均属前一个明确模块；完整文件/符号核对与文档检查结果见配套记录。测试入口存在不等于已通过；单元/Mock不能代替真实PG、目标环境、实际渠道/算子、Playwright与专业业务结果验收。

## 6. 与开发任务的交接

先落实对象/事务和正式装配，再完成创建闭环；随后按方案配置、正式采集与审阅、问卷/导入、分析交付推进。详见[开发任务与依赖](../planning/research-study-workflow-2026-11-11/implementation-plan.md)。当前清单不授权执行迁移、部署、真实患者采集、渠道发信或模型调用；这些动作在对应任务获批范围内实施并分别验收。
