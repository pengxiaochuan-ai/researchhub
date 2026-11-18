# 数据库复用审计、全量模型索引与字典增补

日期：2026-10-19。任务：为 aisciencesys → researchhub 最大复用及 2026 年 11 月中旬交付评估提供数据库事实。本文是静态审计与适配建议，不是迁移实施、运行库验证或生产验收。

后续用户确认已更新：共享实例/库/现有公共表、不同租户，旧系统继续运行，首期不迁历史研究数据；旧配置在PG，限定读取ID/版本即可开展适配。本文的结构/字典/历史代码事实保留，涉及迁移原课题/患者的建议不再是一期任务。现行设计与新增四类后台风险见[一期评审包](../phase1-review-2026-10-19/README.md)。

## 1. 结论与证据层级

旧系统已经有 [数据库表结构字典 V1.2](../../../../docs/tech/05-数据库表结构字典.md)（文档日期 2026-09-13，1,573 行），不能再表述为“本地不存在数据库字典”。业务表 `DataDictionary` / `data_dictionary` 只是 featureKey、单位、取值范围、受控词表的配置，和这份数据库结构文档是两种对象。

可最大复用的是完整的旧后端数据域：身份/作用域、方案与访视、被试/文件/特征、表单/量表、质量、Agent/知识、产物与审计。新产品的 Organization、Hub、意图 Project、独立 Study 和三角色属于语义适配，不宜通过全表改名或复制几张表实现。保留旧模型 FK 和成熟服务，新增目标对象及显式映射，通常比重建全套研究执行库更稳妥；实施时以新受控环境验证和迁移预演为前提，本轮未建立双写或迁移。

| 证据 | 本轮得到的事实 | 没有证明的事项 |
| --- | --- | --- |
| 当前工作区静态 Prisma | 111 个 model、11 个 enum；1,671 个标量/枚举字段、612 个关系导航字段；171 条 `@@index` 和 73 条 `@@unique` 声明 | 实际库表/列/索引是否已经部署，字段数据是否合格 |
| 迁移源文件 | 78 个迁移目录，78 个 `migration.sql` + 36 个 `rollback.sql`，共 114 SQL 文件 | 已应用迁移数、回滚可用性、生产版本 |
| 表/列名静态对照 | 111 个 schema 映射表均有 CREATE TABLE；按目录顺序筛查 CREATE TABLE 和 ALTER ADD/DROP/RENAME COLUMN，全部 111 表的列名集合与 Prisma 标量/枚举字段集合一致 | SQL 能否完整重放、类型/默认值/约束语义是否全一致；不是 `prisma migrate diff` 或实际库比对 |
| 原有字典覆盖 | 90 个模型有独立或合并章节、13 个仅有摘要表行、2 个仅被正文提及、6 个全文未出现表名 | 有章节或出现表名不代表所有字段/索引/FK/RLS 都完整 |
| RLS 与服务静态代码 | 有 tenant/group/project 上下文、子表继承、官方只读资源和审计追加权限；同时存在常驻 elevated 连接 | 当前连接真实角色、BYPASSRLS、在线策略和所有请求是否正确生效 |
| 运行库/数据/外部服务 | 未连接；未读取数据库行、患者文件、备份内容或 .env；未执行 seed、迁移或导出 | 实际课题、记录数、存储完整性、线上能力和业务验收均待后续授权验证 |

计数由本地只读脚本从源码确定性计算。关系导航字段不是数据库列，`@@unique` 数不含全部单列 `@unique` / 主键或 SQL 手写索引。源码基线：根仓库 HEAD `9b2bf43d2830f2ed60a94bc18f5a5dcf4bd851c3`；schema 最近提交 `a42342f`（2026-09-13）；当前 schema SHA-256：`99688b31f090e7f241f61614d47630073635e5345518c33e2352cf28cc221df2`。工作区现状优先于旧报告中的其他副本路径/提交，不把其历史测试结论继承为本轮结果。

## 2. 原字典应如何复用与纠正

- 继续以原字典解释业务含义，以当前 Prisma 和迁移 SQL 核对精确契约；不另起一套重复的大型字段 JSON。
- 完全遗漏的 6 表为 `knowledge_deduplication_plan`、`knowledge_source_file`、`knowledge_import_task`、`research_signal_subscription`、`research_signal_item`、`research_signal_review`，下文给出全部标量字段及关系/索引。
- `tenant_theme` 只有 [IA-04 正文提及](../../../../docs/tech/05-数据库表结构字典.md#L1484)；`project_onboarding` 只有 [文首增量说明](../../../../docs/tech/05-数据库表结构字典.md#L15)，也补全字段索引。
- 原字典有章节的模型仍有摘要化省略。例如 [StudyProtocolVersion](../../../../docs/tech/05-数据库表结构字典.md#L535) 没有列出 `methodsSummary/populationSummary/statisticsSummary/acceptanceFixture`；[FormResponse](../../../../docs/tech/05-数据库表结构字典.md#L714) 未逐列列出 scope 和时间戳。本文的“90 个章节”只是覆盖分类，不能改写成“90 表字段完整”。
- 原字典文首“所有业务表带 tenantId”“RLS 全强制”的表述过宽：`ScaleItem` 没有 tenantId；官方/租户可空 scope、elevated 连接也需要单独描述。应以第 5 节边界替代笼统结论。
- 原字典中的“69/69 迁移已应用”是其历史环境证据，不是当前 78 个迁移目录都已部署的证据。原有 `aisciencesys-reuse-assessment-v1.0.md` 的“表单更正/锁定仍需补齐”结论仍成立；不得把 FormVersion 的 locked 或 DQ release gate 解释为答卷 revision 或整库锁定。
- 2026-10-14 的旧库核查没有列到这份本地字典，但其“未确认实际数据库备份/课题配置”的限制仍成立。本轮未重新扫描或读取 dump，不能把“有结构字典”推断为“真实数据已可迁移”。

## 3. 关键业务域与目标模型映射

目标依据：[当前产品基线](../../product/product-baseline.md)及[三角色/更正/原课题迁移确认](../../product/lingshu-data-policy-and-database-check-2026-10-14.md)。以下是适配建议，不在本轮新增表或修改服务。

| 旧结构与关键契约 | 可保留内容 | researchhub 适配与边界 |
| --- | --- | --- |
| [Tenant](../../../../app/server/prisma/schema.prisma#L89)：slug 全局唯一，席位/课题组配额；[TenantTheme](../../../../app/server/prisma/schema.prisma#L155) 1:1 文本主题 | 旧隔离容器、配额与主题配置能力 | Tenant 是技术/服务隔离边界，不直接等于 Organization 或 Hub；跨机构共建需显式 Organization–Hub 关系 |
| [Account](../../../../app/server/prisma/schema.prisma#L171)：tenantId 必填，`(tenantId,username)` 唯一，authVersion、role、isTenantAdmin | 认证、撤销会话、账号状态 | 增加统一个人身份与旧账号映射、机构任职/认证；不能按用户名/显示名自动合并跨租户账号，不迁出密码哈希作身份分析 |
| [StudyGroup](../../../../app/server/prisma/schema.prisma#L231)、PermissionRole、StudyGroupMembership；`(tenantId,slug)`、`(group,account)` 唯一 | 私有课题组、动作授权与成员规则 | 不直接重命名 Hub；Hub 公共学术关系、关注/共建不能继承患者数据权限 |
| [ResearchProject](../../../../app/server/prisma/schema.prisma#L333)、[ResearchProjectMembership](../../../../app/server/prisma/schema.prisma#L396)：归 group，`(group,code)` 唯一，挂接 subject/protocol/visit/form/data/artifact | 旧执行聚合与所有既有 FK；项目成员范围 | 语义最接近执行 Study。保留旧表和 FK，加独立意图 Project（Question/PICO）与 Study 身份/映射；目标 Study 映射 legacyResearchProjectId，并关联 Hub/意图 Project。首期可显式 1:1，后续意图 Project 可有多个 Study，不能直接改名后声称已支持独立授权 |
| [Subject](../../../../app/server/prisma/schema.prisma#L2066)：scope 三元组 + subjectId 唯一，软删除、夹具标记；SubjectProfile/Manifest 1:1 | 假名被试身份、来源/同意、数据归属 | 保留源 ID 和 scope 映射，不按相同 subjectId 跨研究合并人；sex/age 等研究字段是模型定义，读取权限仍按 Study/中心配置 |
| [StudyProtocolVersion](../../../../app/server/prisma/schema.prisma#L1274)、VisitPlan/Requirement、StudyEnrollment/SubjectVisit | 方案版本、入组、访视窗口、锚点、要求履约和任务 | 版本 FK 要原样保留；独立 Study、中心、实际 Protocol/CRF 配置需接入。方案 lockedAt 是方案生命周期，不是研究数据锁定 |
| [FormTemplate/FormVersion](../../../../app/server/prisma/schema.prisma#L1794)、[FormAssignment/FormResponse](../../../../app/server/prisma/schema.prisma#L1843) | 模板/schema 版本、绑定分配、确定性计分、draft/submitted | 目前一 assignment 一 response，answers 原地更新且提交后拒改；新增不可覆盖响应 revision、字段前后值/原因、审阅绑定 revision、锁/解锁事件、expectedRevision，并同事务审计 |
| [ScaleDefinition/ScaleVersion](../../../../app/server/prisma/schema.prisma#L2220)、ScoringRule、OutcomeDefinition、Applicability、ProtocolReleaseCheck | 量表原文/版本/计分规则/适用与发布检查 | 沿用确定性数值链路和历史版本；授权版本、实际结局/访视对应关系须由首个研究配置确认，不从文献或 AI 生成正式 CRF |
| [ModalityFile](../../../../app/server/prisma/schema.prisma#L2757)、ProcessingTask、[Feature](../../../../app/server/prisma/schema.prisma#L2819)、ProcessingStatus | 文件分层/对象引用、任务幂等、特征长表、算法/来源血缘与缺失状态 | 数据库引用和对象存储是两份迁移清单；文件 bytes/hash/权限需单独对账。通用数据底座可用，不因此恢复已退役检测算子 |
| [DataDictionary](../../../../app/server/prisma/schema.prisma#L2856)、NormRange、术语版本 | 租户变量词典、单位/取值/常模、审核语义映射 | 这是科研变量配置，不是完整 schema 字典；数值来源仍来自审核规则/统计，不交由 LLM 编造 |
| [Agent](../../../../app/server/prisma/schema.prisma#L417)/Config/Access、Skill/Assignment、Session、ResearchAgentRun/Stage | 版本配置、授权、会话、后台阶段/重试/证据方法运行 | 将授权映射到 Study/Hub 资源；保留 DeepSeek/OpenCode 与确定性算子契约。表存在不证明工具/模型已经在目标环境执行 |
| [KnowledgeBase](../../../../app/server/prisma/schema.prisma#L3029) 与 Doc/Version/Chunk/SourceFile/ImportTask/DedupPlan | 原件、解析队列、文档审核/版本、RAG 与候选去重元数据 | 旧 KB 依执行项目隔离；Hub 公共资料、独立规范文献实体、行级导入批次与共享授权要适配。来源文件引用不等于拥有论文全文权利 |
| [ResearchArtifact](../../../../app/server/prisma/schema.prisma#L829) 与 Version/Source/Review/File/ExportJob | 精确版本、来源快照/哈希、审核、文件导出 | 可作为资产底座；跨 Study/Hub 复用需增加权属/共享许可/派生约束，旧 released 状态不自动等于 Hub 可访问 |
| DataQuery/ProtocolDeviation/Remediation、DQ gate/waiver、[AuditLog](../../../../app/server/prisma/schema.prisma#L2913) | 疑问、偏离、修复、分析放行、不可变事件与项目审计 | DQ 放行与 PI 数据锁定分开。审计 meta 可扩展，不能以通用 meta 代替答卷 revision、审核版本和锁状态的结构契约 |

三角色不能直接映射成三个旧技术角色：Hub 负责人是本 Hub 业务治理与数据能力，PI 是具体 Study 的审阅/锁解锁能力，采集人员是已授权 Study/中心的采集/更正能力；同一人可兼任。旧 `tenant_admin/isTenantAdmin` 的范围是整个技术租户，`platform_admin` 是控制面身份；二者都不能自动成为 Hub owner。若多个 Hub 共用 Tenant，必须按 hubId 派生其所辖 Study 范围；不能因为 tenant_admin 能跨项目查询而授予其其他 Hub 数据。首期一 Hub 也应保留这一显式边界。

## 4. 版本、更正、锁定与审计的确定性缺口

[FormResponse schema](../../../../app/server/prisma/schema.prisma#L1875) 仅有当前 answers/score、status、submittedAt/By 和时间戳；assignmentId 唯一，没有 revisionNo、previousRevisionId、expectedRevision、reviewedRevisionId 或锁/解锁记录。代码 [study-forms.service.ts:452](../../../../app/server/src/study-operations/study-forms.service.ts#L452) 明确拒绝已 submitted 的响应，469 行仅按 draft 条件 updateMany。该行为与已确认“提交后可更正、保留所有版本，锁定后由 PI 解锁”不同。

可复用的是事务、计分、分配、方案/表单版本与审计入口；待实施的是响应版本和状态机，不能简单去掉 submitted 检查就算更正完成。新 revision 必须重新审阅，旧结论保留；旧版数据分析/产物保留其数据快照和引用版本。技术验收应覆盖并发冲突拒绝、跨 Study/中心拒绝、锁后拒改、PI 解锁事件、旧审阅不继承以及失败时事务不留半条历史。本文未实现或运行这些测试。

## 5. RLS 的实际静态边界

| 范围 | 源码证据 | 复用时必须保持/复验 |
| --- | --- | --- |
| 请求上下文 | [PrismaService:43](../../../../app/server/src/prisma/prisma.service.ts#L43) 每操作事务设置 tenant/group/project；[71 行](../../../../app/server/src/prisma/prisma.service.ts#L71) 支持完整命令事务 | 上下文由服务端授权决定；RLS 不自行验证“当前账号是否成员”。业务 Guard、scope 验证与数据库策略是组合边界 |
| 基础策略 | [rls.sql:38](../../../../app/server/prisma/rls.sql#L38) 按 tenantId 列生成；[205 行](../../../../app/server/prisma/rls.sql#L205) 必填项目三元组；[233 行](../../../../app/server/prisma/rls.sql#L233) subject 子表；259 行 session 子表；285 行 result→subject | 不能只复制表结构而遗漏 rls.sql、受限角色、授权和请求事务 |
| 项目元数据 | [126 行](../../../../app/server/prisma/rls.sql#L126) research_project/membership 按 tenant+group | 项目选择前元数据不等于执行数据授权；目标 Study 成员资格仍由服务校验 |
| 知识资源 | [140 行](../../../../app/server/prisma/rls.sql#L140) KB 按项目；[155 行](../../../../app/server/prisma/rls.sql#L155) 子表沿 kbId；版本沿 doc→KB | 目标 Hub 知识共享必须显式建模；nullable tenantId 不代表可公开访问 |
| 官方只读资源 | [82 行](../../../../app/server/prisma/rls.sql#L82) 白名单、[326 行](../../../../app/server/prisma/rls.sql#L326) tenantId=null SELECT | 仅 Skill/ScaleDefinition/KB/Doc/DocVersion/Chunk/ArtifactTemplate 显式允许；不能把全部 nullable 表统一放行 |
| 审计与追加事实 | [102 行](../../../../app/server/prisma/rls.sql#L102) 审计 SELECT 按 project，INSERT 按上下文；[346 行](../../../../app/server/prisma/rls.sql#L346) 撤销 UPDATE/DELETE；355 行后重收紧多类表 | 审计应用角色追加式不等于所有 privileged 连接不可篡改；保留权限和迁移触发器，并核对控制面最小查询 |
| 提权连接 | [PrismaService:23](../../../../app/server/src/prisma/prisma.service.ts#L23) elevated 客户端并在启动时连接；[系统总纲:25](../../../../docs/00-系统总纲.md#L25) 说明跨作用域高信任路径 | 不能宣称“所有请求都由 RLS 强制”。需对目标连接权限与每条 elevated 业务路径单独验收，本轮未读取连接串或尝试连库 |
| ScaleItem 例外 | [schema:2445](../../../../app/server/prisma/schema.prisma#L2445) 无 tenantId，仅 scaleId FK；rls.sql 通用循环只处理含 tenantId 表 | 当前迁移静态检索未发现 scale_item 专属 ENABLE/FORCE RLS 或 policy；此表不能列为已具备逐租户数据库隔离。目标环境检查实际 grants/策略及父定义读取路径，决定增加父关系策略或受控服务访问；未证明在线可利用情况 |

## 6. 迁移中必须一起保留的非 Prisma 结构

全部 111 张当前表都能映射到迁移 CREATE TABLE，静态没有发现“只在迁移里存在、完全不在 Prisma 的额外业务表”。这只比较当前文件内表/列身份；手写 SQL 的索引、CHECK、触发器、RLS、GRANT/REVOKE 不在这一结论中，也不能靠 `schema.prisma` 单独恢复。

| SQL 专项 | 例子与定位 | 迁移含义 |
| --- | --- | --- |
| pgvector 扩展和向量索引 | [K1 migration:1](../../../../app/server/prisma/migrations/20260709065433_k1_knowledge_base/migration.sql#L1)，[121 行](../../../../app/server/prisma/migrations/20260709065433_k1_knowledge_base/migration.sql#L121) HNSW/cosine | 仅复制 Prisma Unsupported vector 列会丢检索索引，目标环境要验证扩展与查询计划 |
| 部分唯一索引 | [remediation migration:114](../../../../app/server/prisma/migrations/20260911180000_remediation_loop/migration.sql#L114) 未关闭来源身份 | 普通 `@@index` 不能替代业务幂等约束 |
| JSON 表达式与审计幂等索引 | [audit migration:33](../../../../app/server/prisma/migrations/20260912200000_audit_dispute_hardening/migration.sql#L33) 至 42 行 | schema 的三个普通 audit 索引没有完整表达 JSON serverRequestId/clientTraceId 条件约束 |
| 不可变/状态守卫 | [remediation event:174](../../../../app/server/prisma/migrations/20260911180000_remediation_loop/migration.sql#L174)、[query replay hardening:1](../../../../app/server/prisma/migrations/20260912213000_data_query_replay_hardening/migration.sql#L1)、[ROI:51](../../../../app/server/prisma/migrations/20260913040000_operational_roi_snapshot/migration.sql#L51) | 保留追加事件、请求身份、确定性产物和快照冻结，不能只搬 Service |
| 术语发布与引用守卫 | [terminology release:1](../../../../app/server/prisma/migrations/20260913050000_terminology_release_governance/migration.sql#L1)、[hardening:1](../../../../app/server/prisma/migrations/20260913053000_terminology_release_hardening/migration.sql#L1) | 约束已发布内容、来源、引用关系和可用状态 |
| 量表适用/方案检查追加约束 | [scale applicability:1](../../../../app/server/prisma/migrations/20260913060000_scale_applicability_protocol_release/migration.sql#L1) | 历史审核和发布检查不能被任意更新/删除 |
| CHECK、FK、scope、RLS | [knowledge import:14](../../../../app/server/prisma/migrations/20260810113000_knowledge_literature_import/migration.sql#L14)、[research intelligence:39](../../../../app/server/prisma/migrations/20260910190000_research_intelligence/migration.sql#L39) | 状态枚举/取值范围/一致性与隔离须随迁移保留，不能依赖 TypeScript 类型 |
| 合成夹具来源守卫 | [fixture hardening:1](../../../../app/server/prisma/migrations/20260913020000_project_onboarding_fixture_hardening/migration.sql#L1) | 区分验收夹具与正式事实；迁移必须保留 provenance 并过滤非业务数据 |

没有重放 SQL，未验证扩展/函数/触发器的目标权限与执行顺序；“列名集合一致”不能提升为“数据库没有漂移”。目标环境应在合成数据环境完成迁移重放后，再以 catalog/schema-only 导出核对列类型、默认值、FK、CHECK、全部索引、触发器、policy 和 grants。

## 7. 111 个模型的全量索引

“字段数”为标量/枚举字段数 / Prisma 关系导航字段数。字段原文、关系、删除动作与默认值从源码链接查看；原字典负责业务解释。“章节/摘要行/提及”不代表字段完整性。此表按当前 schema 源码顺序生成，无业务行数据。

| Prisma model | 物理表名（@@map） | schema 行 | 字段数 | 原字典覆盖 |
| --- | --- | --- | --- | --- |
| Tenant | `tenant` | [89](../../../../app/server/prisma/schema.prisma#L89) | 8 / 51 | [章节:126](../../../../docs/tech/05-数据库表结构字典.md#L126) |
| TenantTheme | `tenant_theme` | [155](../../../../app/server/prisma/schema.prisma#L155) | 8 / 1 | [仅提及:1484](../../../../docs/tech/05-数据库表结构字典.md#L1484) |
| Account | `account` | [171](../../../../app/server/prisma/schema.prisma#L171) | 11 / 25 | [章节:139](../../../../docs/tech/05-数据库表结构字典.md#L139) |
| AccountCapability | `account_capability` | [216](../../../../app/server/prisma/schema.prisma#L216) | 6 / 1 | [章节:155](../../../../docs/tech/05-数据库表结构字典.md#L155) |
| StudyGroup | `study_group` | [231](../../../../app/server/prisma/schema.prisma#L231) | 8 / 42 | [章节:170](../../../../docs/tech/05-数据库表结构字典.md#L170) |
| PermissionRole | `permission_role` | [289](../../../../app/server/prisma/schema.prisma#L289) | 11 / 2 | [章节:183](../../../../docs/tech/05-数据库表结构字典.md#L183) |
| StudyGroupMembership | `study_group_membership` | [310](../../../../app/server/prisma/schema.prisma#L310) | 9 / 3 | [章节:199](../../../../docs/tech/05-数据库表结构字典.md#L199) |
| ResearchProject | `research_project` | [333](../../../../app/server/prisma/schema.prisma#L333) | 11 / 44 | [章节:213](../../../../docs/tech/05-数据库表结构字典.md#L213) |
| ResearchProjectMembership | `research_project_membership` | [396](../../../../app/server/prisma/schema.prisma#L396) | 10 / 2 | [章节:231](../../../../docs/tech/05-数据库表结构字典.md#L231) |
| Agent | `agent` | [417](../../../../app/server/prisma/schema.prisma#L417) | 10 / 8 | [章节:250](../../../../docs/tech/05-数据库表结构字典.md#L250) |
| AgentAccess | `agent_access` | [444](../../../../app/server/prisma/schema.prisma#L444) | 8 / 2 | [章节:265](../../../../docs/tech/05-数据库表结构字典.md#L265) |
| AgentConfig | `agent_config` | [463](../../../../app/server/prisma/schema.prisma#L463) | 14 / 1 | [章节:280](../../../../docs/tech/05-数据库表结构字典.md#L280) |
| ModelProfile | `model_profile` | [489](../../../../app/server/prisma/schema.prisma#L489) | 13 / 1 | [章节:301](../../../../docs/tech/05-数据库表结构字典.md#L301) |
| Session | `session` | [511](../../../../app/server/prisma/schema.prisma#L511) | 16 / 12 | [章节:356](../../../../docs/tech/05-数据库表结构字典.md#L356) |
| SessionProject | `session_project` | [548](../../../../app/server/prisma/schema.prisma#L548) | 8 / 3 | [章节:377](../../../../docs/tech/05-数据库表结构字典.md#L377) |
| Message | `message` | [566](../../../../app/server/prisma/schema.prisma#L566) | 7 / 4 | [章节:392](../../../../docs/tech/05-数据库表结构字典.md#L392) |
| KnowledgeChatJob | `knowledge_chat_job` | [586](../../../../app/server/prisma/schema.prisma#L586) | 21 / 5 | [章节:404](../../../../docs/tech/05-数据库表结构字典.md#L404) |
| ResearchAgentRun | `research_agent_run` | [623](../../../../app/server/prisma/schema.prisma#L623) | 29 / 6 | [摘要行:497](../../../../docs/tech/05-数据库表结构字典.md#L497) |
| ResearchAgentStageSnapshot | `research_agent_stage_snapshot` | [670](../../../../app/server/prisma/schema.prisma#L670) | 18 / 1 | [摘要行:498](../../../../docs/tech/05-数据库表结构字典.md#L498) |
| ResearchAgentStageAttempt | `research_agent_stage_attempt` | [698](../../../../app/server/prisma/schema.prisma#L698) | 18 / 1 | [摘要行:499](../../../../docs/tech/05-数据库表结构字典.md#L499) |
| StructuredInteraction | `structured_interaction` | [727](../../../../app/server/prisma/schema.prisma#L727) | 23 / 6 | [章节:429](../../../../docs/tech/05-数据库表结构字典.md#L429) |
| Skill | `skill` | [767](../../../../app/server/prisma/schema.prisma#L767) | 15 / 2 | [章节:319](../../../../docs/tech/05-数据库表结构字典.md#L319) |
| SkillAssignment | `skill_assignment` | [793](../../../../app/server/prisma/schema.prisma#L793) | 8 / 3 | [章节:339](../../../../docs/tech/05-数据库表结构字典.md#L339) |
| Artifact | `artifact` | [812](../../../../app/server/prisma/schema.prisma#L812) | 8 / 1 | [章节:459](../../../../docs/tech/05-数据库表结构字典.md#L459) |
| ResearchArtifact | `research_artifact` | [829](../../../../app/server/prisma/schema.prisma#L829) | 18 / 10 | [摘要行:1438](../../../../docs/tech/05-数据库表结构字典.md#L1438) |
| ResearchArtifactVersion | `research_artifact_version` | [867](../../../../app/server/prisma/schema.prisma#L867) | 13 / 8 | [摘要行:1439](../../../../docs/tech/05-数据库表结构字典.md#L1439) |
| ResearchArtifactSource | `research_artifact_source` | [896](../../../../app/server/prisma/schema.prisma#L896) | 11 / 4 | [摘要行:1440](../../../../docs/tech/05-数据库表结构字典.md#L1440) |
| ResearchArtifactReview | `research_artifact_review` | [919](../../../../app/server/prisma/schema.prisma#L919) | 11 / 6 | [摘要行:1441](../../../../docs/tech/05-数据库表结构字典.md#L1441) |
| ResearchArtifactFile | `research_artifact_file` | [944](../../../../app/server/prisma/schema.prisma#L944) | 13 / 6 | [摘要行:1442](../../../../docs/tech/05-数据库表结构字典.md#L1442) |
| ResearchArtifactExportJob | `research_artifact_export_job` | [971](../../../../app/server/prisma/schema.prisma#L971) | 14 / 7 | [摘要行:1443](../../../../docs/tech/05-数据库表结构字典.md#L1443) |
| ArtifactTemplate | `artifact_template` | [1001](../../../../app/server/prisma/schema.prisma#L1001) | 12 / 1 | [摘要行:1444](../../../../docs/tech/05-数据库表结构字典.md#L1444) |
| ResearchEvidenceRun | `research_evidence_run` | [1024](../../../../app/server/prisma/schema.prisma#L1024) | 24 / 1 | [章节:472](../../../../docs/tech/05-数据库表结构字典.md#L472) |
| ResearchEvidenceItem | `research_evidence_item` | [1059](../../../../app/server/prisma/schema.prisma#L1059) | 31 / 1 | [章节:835](../../../../docs/tech/05-数据库表结构字典.md#L835) |
| ResearchMethodRun | `research_method_run` | [1102](../../../../app/server/prisma/schema.prisma#L1102) | 37 / 8 | [章节:503](../../../../docs/tech/05-数据库表结构字典.md#L503) |
| ResearchMethodReview | `research_method_review` | [1157](../../../../app/server/prisma/schema.prisma#L1157) | 11 / 5 | [章节:525](../../../../docs/tech/05-数据库表结构字典.md#L525) |
| TerminologyEntry | `terminology_entry` | [1181](../../../../app/server/prisma/schema.prisma#L1181) | 10 / 5 | [章节:1151](../../../../docs/tech/05-数据库表结构字典.md#L1151) |
| TerminologyMappingVersion | `terminology_mapping_version` | [1204](../../../../app/server/prisma/schema.prisma#L1204) | 26 / 6 | [章节:1163](../../../../docs/tech/05-数据库表结构字典.md#L1163) |
| TerminologyProjectReference | `terminology_project_reference` | [1247](../../../../app/server/prisma/schema.prisma#L1247) | 12 / 5 | [章节:1181](../../../../docs/tech/05-数据库表结构字典.md#L1181) |
| StudyProtocolVersion | `study_protocol_version` | [1274](../../../../app/server/prisma/schema.prisma#L1274) | 22 / 12 | [章节:535](../../../../docs/tech/05-数据库表结构字典.md#L535) |
| EnrollmentTarget | `enrollment_target` | [1317](../../../../app/server/prisma/schema.prisma#L1317) | 13 / 4 | [章节:550](../../../../docs/tech/05-数据库表结构字典.md#L550) |
| VisitPlan | `visit_plan` | [1342](../../../../app/server/prisma/schema.prisma#L1342) | 17 / 7 | [章节:561](../../../../docs/tech/05-数据库表结构字典.md#L561) |
| VisitRequirement | `visit_requirement` | [1374](../../../../app/server/prisma/schema.prisma#L1374) | 11 / 5 | [章节:572](../../../../docs/tech/05-数据库表结构字典.md#L572) |
| StudyEnrollment | `study_enrollment` | [1398](../../../../app/server/prisma/schema.prisma#L1398) | 15 / 12 | [章节:580](../../../../docs/tech/05-数据库表结构字典.md#L580) |
| SubjectVisit | `subject_visit` | [1434](../../../../app/server/prisma/schema.prisma#L1434) | 29 / 18 | [章节:591](../../../../docs/tech/05-数据库表结构字典.md#L591) |
| StudyTaskTemplate | `study_task_template` | [1490](../../../../app/server/prisma/schema.prisma#L1490) | 14 / 6 | [章节:606](../../../../docs/tech/05-数据库表结构字典.md#L606) |
| StudyTask | `study_task` | [1518](../../../../app/server/prisma/schema.prisma#L1518) | 29 / 16 | [章节:615](../../../../docs/tech/05-数据库表结构字典.md#L615) |
| StudyEnrollmentAnchor | `study_enrollment_anchor` | [1573](../../../../app/server/prisma/schema.prisma#L1573) | 12 / 5 | [章节:629](../../../../docs/tech/05-数据库表结构字典.md#L629) |
| VisitRequirementFulfillment | `visit_requirement_fulfillment` | [1598](../../../../app/server/prisma/schema.prisma#L1598) | 17 / 5 | [章节:638](../../../../docs/tech/05-数据库表结构字典.md#L638) |
| StudyTaskCollaborator | `study_task_collaborator` | [1628](../../../../app/server/prisma/schema.prisma#L1628) | 8 / 5 | [章节:649](../../../../docs/tech/05-数据库表结构字典.md#L649) |
| StudyTaskDependency | `study_task_dependency` | [1649](../../../../app/server/prisma/schema.prisma#L1649) | 8 / 5 | [章节:649](../../../../docs/tech/05-数据库表结构字典.md#L649) |
| ProtocolDeviation | `protocol_deviation` | [1671](../../../../app/server/prisma/schema.prisma#L1671) | 22 / 6 | [章节:658](../../../../docs/tech/05-数据库表结构字典.md#L658) |
| DataQuery | `data_query` | [1707](../../../../app/server/prisma/schema.prisma#L1707) | 17 / 7 | [章节:670](../../../../docs/tech/05-数据库表结构字典.md#L670) |
| DataAnalysisQuery | `data_analysis_query` | [1741](../../../../app/server/prisma/schema.prisma#L1741) | 31 / 11 | [章节:1462](../../../../docs/tech/05-数据库表结构字典.md#L1462) |
| FormTemplate | `form_template` | [1794](../../../../app/server/prisma/schema.prisma#L1794) | 14 / 2 | [章节:681](../../../../docs/tech/05-数据库表结构字典.md#L681) |
| FormVersion | `form_version` | [1818](../../../../app/server/prisma/schema.prisma#L1818) | 13 / 4 | [章节:693](../../../../docs/tech/05-数据库表结构字典.md#L693) |
| FormAssignment | `form_assignment` | [1843](../../../../app/server/prisma/schema.prisma#L1843) | 15 / 9 | [章节:704](../../../../docs/tech/05-数据库表结构字典.md#L704) |
| FormResponse | `form_response` | [1875](../../../../app/server/prisma/schema.prisma#L1875) | 12 / 1 | [章节:714](../../../../docs/tech/05-数据库表结构字典.md#L714) |
| Participant | `participant` | [1895](../../../../app/server/prisma/schema.prisma#L1895) | 10 / 5 | [章节:724](../../../../docs/tech/05-数据库表结构字典.md#L724) |
| ParticipantContact | `participant_contact` | [1918](../../../../app/server/prisma/schema.prisma#L1918) | 10 / 1 | [章节:734](../../../../docs/tech/05-数据库表结构字典.md#L734) |
| ParticipantConsent | `participant_consent` | [1936](../../../../app/server/prisma/schema.prisma#L1936) | 13 / 1 | [章节:744](../../../../docs/tech/05-数据库表结构字典.md#L744) |
| QuestionnaireInvitation | `questionnaire_invitation` | [1957](../../../../app/server/prisma/schema.prisma#L1957) | 13 / 4 | [章节:754](../../../../docs/tech/05-数据库表结构字典.md#L754) |
| QuestionnaireSession | `questionnaire_session` | [1981](../../../../app/server/prisma/schema.prisma#L1981) | 14 / 2 | [章节:765](../../../../docs/tech/05-数据库表结构字典.md#L765) |
| MessageDelivery | `message_delivery` | [2005](../../../../app/server/prisma/schema.prisma#L2005) | 11 / 1 | [章节:783](../../../../docs/tech/05-数据库表结构字典.md#L783) |
| StudyNotification | `study_notification` | [2024](../../../../app/server/prisma/schema.prisma#L2024) | 11 / 2 | [章节:793](../../../../docs/tech/05-数据库表结构字典.md#L793) |
| StudyOperationsBrief | `study_operations_brief` | [2045](../../../../app/server/prisma/schema.prisma#L2045) | 14 / 0 | [章节:806](../../../../docs/tech/05-数据库表结构字典.md#L806) |
| Subject | `subject` | [2066](../../../../app/server/prisma/schema.prisma#L2066) | 16 / 19 | [章节:858](../../../../docs/tech/05-数据库表结构字典.md#L858) |
| ProjectOnboarding | `project_onboarding` | [2111](../../../../app/server/prisma/schema.prisma#L2111) | 23 / 13 | [仅提及:15](../../../../docs/tech/05-数据库表结构字典.md#L15) |
| SubjectGroupDefinition | `subject_group_definition` | [2158](../../../../app/server/prisma/schema.prisma#L2158) | 12 / 3 | [章节:875](../../../../docs/tech/05-数据库表结构字典.md#L875) |
| SubjectProfile | `subject_profile` | [2182](../../../../app/server/prisma/schema.prisma#L2182) | 25 / 1 | [章节:894](../../../../docs/tech/05-数据库表结构字典.md#L894) |
| ScaleDefinition | `scale_definition` | [2220](../../../../app/server/prisma/schema.prisma#L2220) | 17 / 4 | [章节:1039](../../../../docs/tech/05-数据库表结构字典.md#L1039) |
| ScaleVersion | `scale_version` | [2249](../../../../app/server/prisma/schema.prisma#L2249) | 18 / 6 | [章节:1105](../../../../docs/tech/05-数据库表结构字典.md#L1105) |
| ScaleVersionApplicability | `scale_version_applicability` | [2282](../../../../app/server/prisma/schema.prisma#L2282) | 13 / 6 | [章节:1129](../../../../docs/tech/05-数据库表结构字典.md#L1129) |
| ScaleVersionItem | `scale_version_item` | [2309](../../../../app/server/prisma/schema.prisma#L2309) | 13 / 2 | [章节:1105](../../../../docs/tech/05-数据库表结构字典.md#L1105) |
| ScoringRule | `scoring_rule` | [2332](../../../../app/server/prisma/schema.prisma#L2332) | 17 / 2 | [章节:1111](../../../../docs/tech/05-数据库表结构字典.md#L1111) |
| OutcomeDefinition | `outcome_definition` | [2359](../../../../app/server/prisma/schema.prisma#L2359) | 21 / 0 | [章节:1121](../../../../docs/tech/05-数据库表结构字典.md#L1121) |
| ProtocolReleaseCheck | `protocol_release_check` | [2388](../../../../app/server/prisma/schema.prisma#L2388) | 13 / 5 | [章节:1135](../../../../docs/tech/05-数据库表结构字典.md#L1135) |
| ProtocolReleaseCheckFinding | `protocol_release_check_finding` | [2414](../../../../app/server/prisma/schema.prisma#L2414) | 18 / 4 | [章节:1135](../../../../docs/tech/05-数据库表结构字典.md#L1135) |
| ScaleItem | `scale_item` | [2445](../../../../app/server/prisma/schema.prisma#L2445) | 9 / 1 | [章节:1061](../../../../docs/tech/05-数据库表结构字典.md#L1061) |
| ScaleResult | `scale_result` | [2462](../../../../app/server/prisma/schema.prisma#L2462) | 17 / 5 | [章节:1075](../../../../docs/tech/05-数据库表结构字典.md#L1075) |
| ScaleItemScore | `scale_item_score` | [2492](../../../../app/server/prisma/schema.prisma#L2492) | 9 / 2 | [章节:1091](../../../../docs/tech/05-数据库表结构字典.md#L1091) |
| DataQualityReleaseGate | `data_quality_release_gate` | [2511](../../../../app/server/prisma/schema.prisma#L2511) | 17 / 5 | [章节:1143](../../../../docs/tech/05-数据库表结构字典.md#L1143) |
| RemediationCase | `remediation_case` | [2542](../../../../app/server/prisma/schema.prisma#L2542) | 28 / 10 | [摘要行:1456](../../../../docs/tech/05-数据库表结构字典.md#L1456) |
| RemediationAttempt | `remediation_attempt` | [2591](../../../../app/server/prisma/schema.prisma#L2591) | 21 / 7 | [摘要行:1457](../../../../docs/tech/05-数据库表结构字典.md#L1457) |
| RemediationEvent | `remediation_event` | [2630](../../../../app/server/prisma/schema.prisma#L2630) | 14 / 5 | [摘要行:1458](../../../../docs/tech/05-数据库表结构字典.md#L1458) |
| OperationalRoiSnapshot | `operational_roi_snapshot` | [2660](../../../../app/server/prisma/schema.prisma#L2660) | 17 / 4 | [章节:1488](../../../../docs/tech/05-数据库表结构字典.md#L1488) |
| DataQualityWaiver | `data_quality_waiver` | [2690](../../../../app/server/prisma/schema.prisma#L2690) | 18 / 1 | [章节:1143](../../../../docs/tech/05-数据库表结构字典.md#L1143) |
| SubjectPhoto | `subject_photo` | [2718](../../../../app/server/prisma/schema.prisma#L2718) | 15 / 1 | [章节:956](../../../../docs/tech/05-数据库表结构字典.md#L956) |
| Manifest | `manifest` | [2742](../../../../app/server/prisma/schema.prisma#L2742) | 6 / 1 | [章节:924](../../../../docs/tech/05-数据库表结构字典.md#L924) |
| ModalityFile | `modality_file` | [2757](../../../../app/server/prisma/schema.prisma#L2757) | 18 / 4 | [章节:935](../../../../docs/tech/05-数据库表结构字典.md#L935) |
| ProcessingTask | `processing_task` | [2789](../../../../app/server/prisma/schema.prisma#L2789) | 17 / 4 | [章节:997](../../../../docs/tech/05-数据库表结构字典.md#L997) |
| Feature | `feature` | [2819](../../../../app/server/prisma/schema.prisma#L2819) | 21 / 3 | [章节:969](../../../../docs/tech/05-数据库表结构字典.md#L969) |
| DataDictionary | `data_dictionary` | [2856](../../../../app/server/prisma/schema.prisma#L2856) | 11 / 1 | [章节:1200](../../../../docs/tech/05-数据库表结构字典.md#L1200) |
| NormRange | `norm_range` | [2877](../../../../app/server/prisma/schema.prisma#L2877) | 13 / 0 | [章节:1216](../../../../docs/tech/05-数据库表结构字典.md#L1216) |
| ProcessingStatus | `processing_status` | [2896](../../../../app/server/prisma/schema.prisma#L2896) | 9 / 1 | [章节:1021](../../../../docs/tech/05-数据库表结构字典.md#L1021) |
| AuditLog | `audit_log` | [2913](../../../../app/server/prisma/schema.prisma#L2913) | 9 / 0 | [章节:1240](../../../../docs/tech/05-数据库表结构字典.md#L1240) |
| UsageRecord | `usage_record` | [2933](../../../../app/server/prisma/schema.prisma#L2933) | 18 / 2 | [章节:1266](../../../../docs/tech/05-数据库表结构字典.md#L1266) |
| TokenQuotaGrant | `token_quota_grant` | [2965](../../../../app/server/prisma/schema.prisma#L2965) | 9 / 2 | [章节:1293](../../../../docs/tech/05-数据库表结构字典.md#L1293) |
| TokenQuotaReservation | `token_quota_reservation` | [2987](../../../../app/server/prisma/schema.prisma#L2987) | 12 / 3 | [章节:1307](../../../../docs/tech/05-数据库表结构字典.md#L1307) |
| Recharge | `recharge` | [3012](../../../../app/server/prisma/schema.prisma#L3012) | 8 / 0 | [章节:1328](../../../../docs/tech/05-数据库表结构字典.md#L1328) |
| KnowledgeBase | `knowledge_base` | [3029](../../../../app/server/prisma/schema.prisma#L3029) | 13 / 6 | [章节:1347](../../../../docs/tech/05-数据库表结构字典.md#L1347) |
| KnowledgeDoc | `knowledge_doc` | [3056](../../../../app/server/prisma/schema.prisma#L3056) | 34 / 8 | [章节:1367](../../../../docs/tech/05-数据库表结构字典.md#L1367) |
| KnowledgeDeduplicationPlan | `knowledge_deduplication_plan` | [3111](../../../../app/server/prisma/schema.prisma#L3111) | 17 / 1 | 缺失，见下文增补 |
| KnowledgeSourceFile | `knowledge_source_file` | [3140](../../../../app/server/prisma/schema.prisma#L3140) | 13 / 3 | 缺失，见下文增补 |
| KnowledgeImportTask | `knowledge_import_task` | [3166](../../../../app/server/prisma/schema.prisma#L3166) | 19 / 4 | 缺失，见下文增补 |
| KnowledgeDocVersion | `knowledge_doc_version` | [3197](../../../../app/server/prisma/schema.prisma#L3197) | 9 / 1 | [章节:1387](../../../../docs/tech/05-数据库表结构字典.md#L1387) |
| KnowledgeChunk | `knowledge_chunk` | [3215](../../../../app/server/prisma/schema.prisma#L3215) | 14 / 1 | [章节:1401](../../../../docs/tech/05-数据库表结构字典.md#L1401) |
| KnowledgeAssignment | `knowledge_assignment` | [3239](../../../../app/server/prisma/schema.prisma#L3239) | 8 / 1 | [章节:1417](../../../../docs/tech/05-数据库表结构字典.md#L1417) |
| TenantFeatureEntitlement | `tenant_feature_entitlement` | [3257](../../../../app/server/prisma/schema.prisma#L3257) | 10 / 0 | [章节:822](../../../../docs/tech/05-数据库表结构字典.md#L822) |
| ResearchSignalSubscription | `research_signal_subscription` | [3275](../../../../app/server/prisma/schema.prisma#L3275) | 21 / 1 | 缺失，见下文增补 |
| ResearchSignalItem | `research_signal_item` | [3304](../../../../app/server/prisma/schema.prisma#L3304) | 26 / 2 | 缺失，见下文增补 |
| ResearchSignalReview | `research_signal_review` | [3340](../../../../app/server/prisma/schema.prisma#L3340) | 9 / 1 | 缺失，见下文增补 |

11 个数据库 enum：`TenantStatus`、`AccountStatus`、`StudyGroupStatus`、`MembershipStatus`、`Role`、`AgentType`、`SkillKind`、`SkillStatus`、`ModalityKind`、`ProcStatus`、`MessageRole`。其余多类 status/roleKey/typeKey 是 String + 迁移 CHECK/服务校验，不能从 enum 数量推断状态机覆盖。

## 8. 原字典缺失/仅提及的八个模型：字段增补

下表保留 Prisma 精确类型、可空标记 `?`、主键/单列唯一/默认值/数据库类型注解。FK 与删除行为列在各模型“关系”；复合索引列在其后。Prisma 的 `@updatedAt` 是 ORM 行为，不应当作 PostgreSQL 自有触发器；`@default(cuid())` 也不能假定为数据库原生默认函数。状态/跨列 CHECK 另以迁移为准。

### TenantTheme → `tenant_theme`

租户展示名称配置，不能当作 Hub 品牌或机构实体。tenantId 唯一，关联 Tenant 并级联删除；updatedBy 是可空字符串，并非 Account 外键。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [156](../../../../app/server/prisma/schema.prisma#L156) |
| `tenantId` | `String` | `@unique` | [157](../../../../app/server/prisma/schema.prisma#L157) |
| `displayName` | `String?` | — | [158](../../../../app/server/prisma/schema.prisma#L158) |
| `shortName` | `String?` | — | [159](../../../../app/server/prisma/schema.prisma#L159) |
| `enabled` | `Boolean` | `@default(true)` | [160](../../../../app/server/prisma/schema.prisma#L160) |
| `updatedBy` | `String?` | — | [161](../../../../app/server/prisma/schema.prisma#L161) |
| `createdAt` | `DateTime` | `@default(now())` | [162](../../../../app/server/prisma/schema.prisma#L162) |
| `updatedAt` | `DateTime` | `@updatedAt` | [163](../../../../app/server/prisma/schema.prisma#L163) |

关系（Prisma 导航字段，不另计物理列）：`tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)`。

复合索引/唯一约束：`@@index([tenantId])`。

### ProjectOnboarding → `project_onboarding`

旧项目启动/验收聚合根。把启动检查、合成夹具与正式研究事实分开；关联事实表的 acceptanceFixture 标记及本表 fixture* 来源外键不能解释为真实受试者/访视。原字典仅在开头提及，缺少字段章节。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [2112](../../../../app/server/prisma/schema.prisma#L2112) |
| `tenantId` | `String` | — | [2113](../../../../app/server/prisma/schema.prisma#L2113) |
| `studyGroupId` | `String` | — | [2114](../../../../app/server/prisma/schema.prisma#L2114) |
| `researchProjectId` | `String` | `@unique(map: "project_onboarding_research_project_key")` | [2115](../../../../app/server/prisma/schema.prisma#L2115) |
| `requestKey` | `String` | — | [2116](../../../../app/server/prisma/schema.prisma#L2116) |
| `requestFingerprint` | `String` | — | [2117](../../../../app/server/prisma/schema.prisma#L2117) |
| `status` | `String` | `@default("in_progress")` | [2118](../../../../app/server/prisma/schema.prisma#L2118) |
| `selectedPiAccountId` | `String?` | — | [2119](../../../../app/server/prisma/schema.prisma#L2119) |
| `memberPlan` | `Json` | `@default("[]")` | [2120](../../../../app/server/prisma/schema.prisma#L2120) |
| `templateSourceKind` | `String?` | — | [2121](../../../../app/server/prisma/schema.prisma#L2121) |
| `templateSourceVersionId` | `String?` | — | [2122](../../../../app/server/prisma/schema.prisma#L2122) |
| `copiedTemplateId` | `String?` | — | [2123](../../../../app/server/prisma/schema.prisma#L2123) |
| `copiedFormVersionId` | `String?` | — | [2124](../../../../app/server/prisma/schema.prisma#L2124) |
| `fixtureProtocolVersionId` | `String?` | — | [2125](../../../../app/server/prisma/schema.prisma#L2125) |
| `fixtureSubjectId` | `String?` | — | [2126](../../../../app/server/prisma/schema.prisma#L2126) |
| `fixtureEnrollmentId` | `String?` | — | [2127](../../../../app/server/prisma/schema.prisma#L2127) |
| `fixtureVisitId` | `String?` | — | [2128](../../../../app/server/prisma/schema.prisma#L2128) |
| `fixtureFormAssignmentId` | `String?` | — | [2129](../../../../app/server/prisma/schema.prisma#L2129) |
| `completedAt` | `DateTime?` | — | [2130](../../../../app/server/prisma/schema.prisma#L2130) |
| `createdBy` | `String` | — | [2131](../../../../app/server/prisma/schema.prisma#L2131) |
| `version` | `Int` | `@default(0)` | [2132](../../../../app/server/prisma/schema.prisma#L2132) |
| `createdAt` | `DateTime` | `@default(now())` | [2133](../../../../app/server/prisma/schema.prisma#L2133) |
| `updatedAt` | `DateTime` | `@updatedAt` | [2134](../../../../app/server/prisma/schema.prisma#L2134) |

关系（Prisma 导航字段，不另计物理列）：`tenant                Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)`；`studyGroup            StudyGroup            @relation(fields: [studyGroupId], references: [id], onDelete: Cascade)`；`researchProject       ResearchProject       @relation(fields: [researchProjectId], references: [id], onDelete: Cascade)`；`creator               Account               @relation("ProjectOnboardingCreator", fields: [createdBy], references: [id], onDelete: Restrict)`；`selectedPi            Account?              @relation("ProjectOnboardingPi", fields: [selectedPiAccountId], references: [id], onDelete: SetNull)`；`templateSourceVersion FormVersion?          @relation("ProjectOnboardingSourceVersion", fields: [templateSourceVersionId], references: [id], onDelete: Restrict)`；`copiedTemplate        FormTemplate?         @relation("ProjectOnboardingCopiedTemplate", fields: [copiedTemplateId], references: [id], onDelete: SetNull)`；`copiedFormVersion     FormVersion?          @relation("ProjectOnboardingCopiedVersion", fields: [copiedFormVersionId], references: [id], onDelete: SetNull)`；`fixtureProtocol       StudyProtocolVersion? @relation("ProjectOnboardingFixtureProtocol", fields: [fixtureProtocolVersionId], references: [id], onDelete: SetNull)`；`fixtureSubject        Subject?              @relation("ProjectOnboardingFixtureSubject", fields: [fixtureSubjectId], references: [id], onDelete: SetNull)`；`fixtureEnrollment     StudyEnrollment?      @relation("ProjectOnboardingFixtureEnrollment", fields: [fixtureEnrollmentId], references: [id], onDelete: SetNull)`；`fixtureVisit          SubjectVisit?         @relation("ProjectOnboardingFixtureVisit", fields: [fixtureVisitId], references: [id], onDelete: SetNull)`；`fixtureFormAssignment FormAssignment?       @relation("ProjectOnboardingFixtureAssignment", fields: [fixtureFormAssignmentId], references: [id], onDelete: SetNull)`。

复合索引/唯一约束：`@@unique([tenantId, createdBy, requestKey], map: "project_onboarding_tenant_creator_request_key")`；`@@index([tenantId, studyGroupId, researchProjectId, status], map: "project_onboarding_scope_status_idx")`；`@@index([tenantId, updatedAt(sort: Desc), id(sort: Desc)], map: "project_onboarding_tenant_updated_id_idx")`。

### KnowledgeDeduplicationPlan → `knowledge_deduplication_plan`

持久化候选去重与人工决定快照。requestKey/decisionKey 按账号唯一；snapshot/result 是决策元数据，不是规范 Publication 或实际论文全文的完整数据库。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3112](../../../../app/server/prisma/schema.prisma#L3112) |
| `tenantId` | `String?` | — | [3113](../../../../app/server/prisma/schema.prisma#L3113) |
| `studyGroupId` | `String?` | — | [3114](../../../../app/server/prisma/schema.prisma#L3114) |
| `researchProjectId` | `String?` | — | [3115](../../../../app/server/prisma/schema.prisma#L3115) |
| `kbId` | `String` | — | [3116](../../../../app/server/prisma/schema.prisma#L3116) |
| `accountId` | `String` | — | [3117](../../../../app/server/prisma/schema.prisma#L3117) |
| `sessionId` | `String?` | — | [3118](../../../../app/server/prisma/schema.prisma#L3118) |
| `requestKey` | `String` | — | [3119](../../../../app/server/prisma/schema.prisma#L3119) |
| `decisionKey` | `String?` | — | [3120](../../../../app/server/prisma/schema.prisma#L3120) |
| `status` | `String` | `@default("pending")` | [3121](../../../../app/server/prisma/schema.prisma#L3121) |
| `version` | `Int` | `@default(1)` | [3122](../../../../app/server/prisma/schema.prisma#L3122) |
| `snapshot` | `Json` | — | [3123](../../../../app/server/prisma/schema.prisma#L3123) |
| `result` | `Json?` | — | [3124](../../../../app/server/prisma/schema.prisma#L3124) |
| `expiresAt` | `DateTime` | — | [3125](../../../../app/server/prisma/schema.prisma#L3125) |
| `decidedAt` | `DateTime?` | — | [3126](../../../../app/server/prisma/schema.prisma#L3126) |
| `createdAt` | `DateTime` | `@default(now())` | [3127](../../../../app/server/prisma/schema.prisma#L3127) |
| `updatedAt` | `DateTime` | `@updatedAt` | [3128](../../../../app/server/prisma/schema.prisma#L3128) |

关系（Prisma 导航字段，不另计物理列）：`kb KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)`。

复合索引/唯一约束：`@@unique([accountId, requestKey])`；`@@unique([accountId, decisionKey])`；`@@index([tenantId, studyGroupId, researchProjectId, kbId, status, expiresAt])`；`@@index([accountId, status, expiresAt])`。

### KnowledgeSourceFile → `knowledge_source_file`

私有对象存储文件引用与完整性元数据。storageKey 唯一；size 为 BigInt；文件实体并不保存在 PostgreSQL 中。tenantId/studyGroupId 可空不等于客户端可公开读取。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3141](../../../../app/server/prisma/schema.prisma#L3141) |
| `tenantId` | `String?` | — | [3142](../../../../app/server/prisma/schema.prisma#L3142) |
| `studyGroupId` | `String?` | — | [3143](../../../../app/server/prisma/schema.prisma#L3143) |
| `kbId` | `String` | — | [3144](../../../../app/server/prisma/schema.prisma#L3144) |
| `docId` | `String?` | — | [3145](../../../../app/server/prisma/schema.prisma#L3145) |
| `storageKey` | `String` | `@unique` | [3146](../../../../app/server/prisma/schema.prisma#L3146) |
| `filename` | `String` | — | [3147](../../../../app/server/prisma/schema.prisma#L3147) |
| `extension` | `String` | — | [3148](../../../../app/server/prisma/schema.prisma#L3148) |
| `contentType` | `String` | — | [3149](../../../../app/server/prisma/schema.prisma#L3149) |
| `size` | `BigInt` | — | [3150](../../../../app/server/prisma/schema.prisma#L3150) |
| `sha256` | `String` | — | [3151](../../../../app/server/prisma/schema.prisma#L3151) |
| `createdBy` | `String?` | — | [3152](../../../../app/server/prisma/schema.prisma#L3152) |
| `createdAt` | `DateTime` | `@default(now())` | [3153](../../../../app/server/prisma/schema.prisma#L3153) |

关系（Prisma 导航字段，不另计物理列）：`kb         KnowledgeBase        @relation(fields: [kbId], references: [id], onDelete: Cascade)`；`doc        KnowledgeDoc?        @relation(fields: [docId], references: [id], onDelete: SetNull)`；`importTask KnowledgeImportTask?`。

复合索引/唯一约束：`@@index([tenantId, studyGroupId, kbId])`；`@@index([docId])`。

### KnowledgeImportTask → `knowledge_import_task`

文献异步导入状态机与源文件绑定。sourceFileId 唯一；parentId/docId 分别指向父文档和导入结果文档。progress 的 0–100 约束和状态集合见迁移 SQL，不能只看 Prisma。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3167](../../../../app/server/prisma/schema.prisma#L3167) |
| `tenantId` | `String?` | — | [3168](../../../../app/server/prisma/schema.prisma#L3168) |
| `studyGroupId` | `String?` | — | [3169](../../../../app/server/prisma/schema.prisma#L3169) |
| `kbId` | `String` | — | [3170](../../../../app/server/prisma/schema.prisma#L3170) |
| `parentId` | `String?` | — | [3171](../../../../app/server/prisma/schema.prisma#L3171) |
| `sourceFileId` | `String` | `@unique` | [3172](../../../../app/server/prisma/schema.prisma#L3172) |
| `docId` | `String?` | — | [3173](../../../../app/server/prisma/schema.prisma#L3173) |
| `status` | `String` | `@default("queued")` | [3174](../../../../app/server/prisma/schema.prisma#L3174) |
| `stage` | `String` | `@default("uploaded")` | [3175](../../../../app/server/prisma/schema.prisma#L3175) |
| `progress` | `Int` | `@default(10)` | [3176](../../../../app/server/prisma/schema.prisma#L3176) |
| `safetyLevel` | `String?` | — | [3177](../../../../app/server/prisma/schema.prisma#L3177) |
| `warnings` | `Json?` | — | [3178](../../../../app/server/prisma/schema.prisma#L3178) |
| `errorCode` | `String?` | — | [3179](../../../../app/server/prisma/schema.prisma#L3179) |
| `errorMessage` | `String?` | — | [3180](../../../../app/server/prisma/schema.prisma#L3180) |
| `createdBy` | `String?` | — | [3181](../../../../app/server/prisma/schema.prisma#L3181) |
| `startedAt` | `DateTime?` | — | [3182](../../../../app/server/prisma/schema.prisma#L3182) |
| `finishedAt` | `DateTime?` | — | [3183](../../../../app/server/prisma/schema.prisma#L3183) |
| `createdAt` | `DateTime` | `@default(now())` | [3184](../../../../app/server/prisma/schema.prisma#L3184) |
| `updatedAt` | `DateTime` | `@updatedAt` | [3185](../../../../app/server/prisma/schema.prisma#L3185) |

关系（Prisma 导航字段，不另计物理列）：`kb         KnowledgeBase       @relation(fields: [kbId], references: [id], onDelete: Cascade)`；`parent     KnowledgeDoc?       @relation("KnowledgeImportParent", fields: [parentId], references: [id], onDelete: SetNull)`；`doc        KnowledgeDoc?       @relation("KnowledgeImportResult", fields: [docId], references: [id], onDelete: SetNull)`；`sourceFile KnowledgeSourceFile @relation(fields: [sourceFileId], references: [id], onDelete: Cascade)`。

复合索引/唯一约束：`@@index([tenantId, studyGroupId, kbId, status])`；`@@index([docId])`。

### ResearchSignalSubscription → `research_signal_subscription`

旧项目范围的文献/注册研究监测订阅。业务 scope 仍是 tenant/group/researchProject；不能直接充当公开 Hub 的跨研究领域订阅。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3276](../../../../app/server/prisma/schema.prisma#L3276) |
| `tenantId` | `String` | — | [3277](../../../../app/server/prisma/schema.prisma#L3277) |
| `studyGroupId` | `String` | — | [3278](../../../../app/server/prisma/schema.prisma#L3278) |
| `researchProjectId` | `String` | — | [3279](../../../../app/server/prisma/schema.prisma#L3279) |
| `name` | `String` | — | [3280](../../../../app/server/prisma/schema.prisma#L3280) |
| `keywords` | `String` | — | [3281](../../../../app/server/prisma/schema.prisma#L3281) |
| `synonyms` | `Json?` | — | [3282](../../../../app/server/prisma/schema.prisma#L3282) |
| `excludeTerms` | `Json?` | — | [3283](../../../../app/server/prisma/schema.prisma#L3283) |
| `sources` | `Json` | — | [3284](../../../../app/server/prisma/schema.prisma#L3284) |
| `frequency` | `String` | `@default("daily")` | [3285](../../../../app/server/prisma/schema.prisma#L3285) |
| `kind` | `String` | `@default("project")` | [3286](../../../../app/server/prisma/schema.prisma#L3286) |
| `ownerAccountId` | `String?` | — | [3287](../../../../app/server/prisma/schema.prisma#L3287) |
| `status` | `String` | `@default("active")` | [3288](../../../../app/server/prisma/schema.prisma#L3288) |
| `version` | `Int` | `@default(1)` | [3289](../../../../app/server/prisma/schema.prisma#L3289) |
| `cursor` | `Json?` | — | [3290](../../../../app/server/prisma/schema.prisma#L3290) |
| `lastRunAt` | `DateTime?` | — | [3291](../../../../app/server/prisma/schema.prisma#L3291) |
| `lastErrorCode` | `String?` | — | [3292](../../../../app/server/prisma/schema.prisma#L3292) |
| `lastErrorMessage` | `String?` | `@db.Text` | [3293](../../../../app/server/prisma/schema.prisma#L3293) |
| `createdBy` | `String?` | — | [3294](../../../../app/server/prisma/schema.prisma#L3294) |
| `createdAt` | `DateTime` | `@default(now())` | [3295](../../../../app/server/prisma/schema.prisma#L3295) |
| `updatedAt` | `DateTime` | `@updatedAt` | [3296](../../../../app/server/prisma/schema.prisma#L3296) |

关系（Prisma 导航字段，不另计物理列）：`signals ResearchSignalItem[]`。

复合索引/唯一约束：`@@index([tenantId, studyGroupId, researchProjectId, status], map: "research_signal_subscription_scope_status_idx")`。

### ResearchSignalItem → `research_signal_item`

检索命中、来源标识、候选去重、审查与提升结果。deduplicationKey 只有普通索引，并非唯一约束；不能据此声称检索已去重，或 promotedToId 自动具备外键/共享权限。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3305](../../../../app/server/prisma/schema.prisma#L3305) |
| `tenantId` | `String` | — | [3306](../../../../app/server/prisma/schema.prisma#L3306) |
| `studyGroupId` | `String` | — | [3307](../../../../app/server/prisma/schema.prisma#L3307) |
| `researchProjectId` | `String` | — | [3308](../../../../app/server/prisma/schema.prisma#L3308) |
| `subscriptionId` | `String` | — | [3309](../../../../app/server/prisma/schema.prisma#L3309) |
| `source` | `String` | — | [3310](../../../../app/server/prisma/schema.prisma#L3310) |
| `externalId` | `String` | — | [3311](../../../../app/server/prisma/schema.prisma#L3311) |
| `pmid` | `String?` | — | [3312](../../../../app/server/prisma/schema.prisma#L3312) |
| `doi` | `String?` | — | [3313](../../../../app/server/prisma/schema.prisma#L3313) |
| `nctId` | `String?` | — | [3314](../../../../app/server/prisma/schema.prisma#L3314) |
| `title` | `String` | — | [3315](../../../../app/server/prisma/schema.prisma#L3315) |
| `authors` | `Json` | — | [3316](../../../../app/server/prisma/schema.prisma#L3316) |
| `publishedAt` | `DateTime?` | — | [3317](../../../../app/server/prisma/schema.prisma#L3317) |
| `sourceUrl` | `String?` | — | [3318](../../../../app/server/prisma/schema.prisma#L3318) |
| `snippet` | `String?` | `@db.Text` | [3319](../../../../app/server/prisma/schema.prisma#L3319) |
| `deduplicationKey` | `String` | — | [3320](../../../../app/server/prisma/schema.prisma#L3320) |
| `status` | `String` | `@default("needs_review")` | [3321](../../../../app/server/prisma/schema.prisma#L3321) |
| `hitReason` | `String?` | — | [3322](../../../../app/server/prisma/schema.prisma#L3322) |
| `duplicateOfId` | `String?` | — | [3323](../../../../app/server/prisma/schema.prisma#L3323) |
| `assignedToAccountId` | `String?` | — | [3324](../../../../app/server/prisma/schema.prisma#L3324) |
| `dueAt` | `DateTime?` | — | [3325](../../../../app/server/prisma/schema.prisma#L3325) |
| `note` | `String?` | `@db.Text` | [3326](../../../../app/server/prisma/schema.prisma#L3326) |
| `promotedToType` | `String?` | — | [3327](../../../../app/server/prisma/schema.prisma#L3327) |
| `promotedToId` | `String?` | — | [3328](../../../../app/server/prisma/schema.prisma#L3328) |
| `createdAt` | `DateTime` | `@default(now())` | [3329](../../../../app/server/prisma/schema.prisma#L3329) |
| `updatedAt` | `DateTime` | `@updatedAt` | [3330](../../../../app/server/prisma/schema.prisma#L3330) |

关系（Prisma 导航字段，不另计物理列）：`subscription ResearchSignalSubscription @relation(fields: [subscriptionId], references: [id], onDelete: Cascade)`；`reviews      ResearchSignalReview[]`。

复合索引/唯一约束：`@@index([tenantId, studyGroupId, researchProjectId, status], map: "research_signal_item_scope_status_idx")`；`@@index([tenantId, studyGroupId, researchProjectId, deduplicationKey], map: "research_signal_item_scope_dedupe_idx")`。

### ResearchSignalReview → `research_signal_review`

对命中条目的审查事实。signalId 有 FK；createdBy 仅为字符串。保留原条目/决定/理由，后续目标 Hub/资源权限仍需适配。

| 字段 | Prisma 类型 | 声明约束/默认值 | 源码行 |
| --- | --- | --- | --- |
| `id` | `String` | `@id @default(cuid())` | [3341](../../../../app/server/prisma/schema.prisma#L3341) |
| `tenantId` | `String` | — | [3342](../../../../app/server/prisma/schema.prisma#L3342) |
| `studyGroupId` | `String` | — | [3343](../../../../app/server/prisma/schema.prisma#L3343) |
| `researchProjectId` | `String` | — | [3344](../../../../app/server/prisma/schema.prisma#L3344) |
| `signalId` | `String` | — | [3345](../../../../app/server/prisma/schema.prisma#L3345) |
| `decision` | `String` | — | [3346](../../../../app/server/prisma/schema.prisma#L3346) |
| `rationale` | `String?` | `@db.Text` | [3347](../../../../app/server/prisma/schema.prisma#L3347) |
| `createdBy` | `String` | — | [3348](../../../../app/server/prisma/schema.prisma#L3348) |
| `createdAt` | `DateTime` | `@default(now())` | [3349](../../../../app/server/prisma/schema.prisma#L3349) |

关系（Prisma 导航字段，不另计物理列）：`signal ResearchSignalItem @relation(fields: [signalId], references: [id], onDelete: Cascade)`。

复合索引/唯一约束：`@@index([tenantId, studyGroupId, researchProjectId, signalId], map: "research_signal_review_scope_signal_idx")`。

## 9. 进入实施前需要的输入与验收

1. 指定旧系统实际课题的配置导出/备份位置、源 tenant/studyGroup/researchProject ID 和要迁入的研究；首轮只需方案/访视/CRF/量表/术语/角色配置及 schema 元数据，不需患者行数据、密码哈希或真实密钥。
2. 明确源 Tenant 与目标技术隔离边界、Organization、灵枢心域 Hub 的对应；给出首期 Hub owner、PI、采集人员名单/账号映射和中心范围，不能按显示名合并身份。
3. 提供正式 Protocol、访视表、CRF 样表与获准量表版本，确认答卷更正原因/审阅/锁定粒度以及已有历史提交的 revision 初始规则。
4. 指定文件存储迁移范围、对象清单/完整性与允许共享的资产；DB 引用和文件对象独立对账。
5. 在新受控环境验证：迁移+RLS+触发器/索引一致性、合成双 Study/双中心授权、采集→提交→更正→重审→锁/解锁→分析快照→产物/共享、审计及旧 ID 映射。只有后续取得运行配置、真实请求轨迹和专业业务结果，才可上升到四层能力验收。

文档本地自检：111 个 schema 模型全部进入索引、无重复或遗漏；407 个本地链接均存在且源码行号未超出文件；缺失/仅提及的 8 模型字段均由当前 schema 提取。文档检查不替代应用单元/集成/界面测试或目标环境数据库验收。

本轮只形成静态资产清单与适配依据；没有修改业务代码、原数据库字典、旧计划、数据库或外部服务，也未执行 Notion 同步。未生成患者/临床数值或调用任何模型/外部工具处理研究数据。

