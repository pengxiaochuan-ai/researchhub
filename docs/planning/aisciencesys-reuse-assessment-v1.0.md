# aisciencesys → 灵枢心域功能复用评估 V1.0

日期：2026-10-14。对照：灵枢心域PRD V2.0专业材料修订R1。性质：代码复用分析，不是迁移实施或生产验收。

## 1. 结论

**可以用，而且最值得用的是研究执行/采集、知识库、确定性研究方法与科研产物服务。** 保留灵枢心域已确认的门户、公共Shell与页面，提取或适配旧项目业务模块；不整体替换前端，不把旧数据库对象直接重命名成Hub/Study。

优先完成“方案版本→受试者入组→访视窗口→表单/量表→质量核查→专业复核→成果”链路，能显著减少首期自建EDC从零开发的范围。但现有表单并不等于完整EDC，跨机构、盲态、签署/更正/锁库等仍需验证和补齐。

## 2. 检查依据与证据边界

仓库：`git@github.com:pengxiaochuan-ai/aisciencesys.git`。

检查提交：`eadac113761485d3812dbb2e03a5f0385d9e6423`，2026-09-17，`chore: exclude local prototype agent memory`。

已读取系统总纲、技术方案、应用说明、核心Prisma模型、前端页面、控制器、业务服务、策略与相关测试。源码分析副本位于本次任务的`work/aisciencesys-source`，按文本文件稀疏检出；不是完整素材/历史数据迁移。

实际执行：`app/research-methods-worker`中 `python3 -m unittest test_statistical_power test_data_quality`，**12项测试通过**。这些证明样本量与质量算子的本地契约；未启动数据库、模型、Web工作台或生产服务，未执行全部NestJS/前端/端到端测试，不能据此声称整个项目可直接上线。

目录和当前代码优先于历史文档：部分技术文档仍有“缺少app/.dockerignore”等过时条目，但本提交树已经包含该文件。部署缺口必须重新验证，不复制旧问题清单作当前结论。

## 3. 技术架构与兼容性

| 模块 | 旧项目实际技术 | 对灵枢心域的影响 |
| --- | --- | --- |
| 前端 | React18、TypeScript、Vite、React Router、Zustand；Tiptap编辑器 | 与现有React/Vite兼容，业务组件可适配；单页路由/旧权限与Shell不能整套搬入 |
| 后端 | NestJS10、Prisma6 | 可作为新后端候选基础，业务Service与策略优先复用 |
| 数据 | PostgreSQL、pgvector、RLS；租户/课题组/项目作用域 | 与既有Hub字典的MySQL建议存在差异，需要数据库ADR，不应默默混用 |
| 文件/知识 | MinIO接口、文档解析、知识版本、索引/引用 | 可用于文件与知识治理；实际生产存储适配另验 |
| 研究算子 | Python样本量/数据质量Worker，确定性输入输出 | 适合样本量、质控、方法执行；不代表所有统计分析或多模态算子已接通 |
| AI | DeepSeek/OpenCode、技能编排、研究证据与产物 | 可复用上下文、证据和任务结构；模型/联网/运行时配置需独立验收 |

建议优先评估继续采用NestJS + PostgreSQL来复用后端，而不是为贴合历史MySQL建议重写全部RLS/Prisma。最终选型需结合实际部署、既有其他服务和数据团队确认；前端不因此迁移技术栈。

## 4. 功能复用矩阵

分级：A＝优先复用规则/算子；B＝已有完整代码路径，需上下文与接口改造；C＝部分基础可用，关键缺口仍需开发；D＝本期不直接搬入。A也需要目标研究参数与接入验收。

| 功能 | 源码证据 | 判定 | 灵枢心域页面与改造 |
| --- | --- | --- | --- |
| 方案版本、审批/启用、发布检查 | `study-operations.controller.ts:499`起，Service，`StudyProtocolVersion` | B，高优先 | S02/S07/G01；接独立Study、伦理/机构政策，保留原版本 |
| 入组、锚点、访视计划/窗口 | 同控制器577–663，VisitPlan/StudyEnrollment/SubjectVisit | B，高优先 | S03/S04/S09；按真实方案配置时点、中心与要求 |
| 访视要求、补录证据与独立复核 | requirements attest/refresh/verify与visit complete接口 | B，高优先 | S09/S05；提交与专业复核分开，不以任务完成代替访视完成 |
| 执行任务、分配、协作、提醒 | 控制器674–725，StudyTask等模型 | B，高优先 | S08/P01；成员与Study角色映射，提醒不当完成事实 |
| 偏离与数据疑问 | 控制器732–767，ProtocolDeviation/DataQuery | B，高优先 | S05/G01；核对疑问回复/关闭授权及中心范围 |
| eCRF表单模板/版本/分配/草稿/提交 | `study-forms.controller.ts:139`，Service，FormTemplate/Version/Assignment/Response | C，高优先 | S11/S09；基础可用，日期/附件/条件规则与更正/签署/锁定需补 |
| 参与者触达身份、同意、H5问卷 | StudyOutreach与QuestionnaireH5控制器、`QuestionnaireH5Page.tsx` | B，按研究需要 | 移动采集补充；这是受试者问卷邀请，不能冒充科研成员邀请 |
| 量表定义/版本/适用范围/结局 | `scale-governance.controller.ts:109`，ScaleDefinition/Version/Applicability | B，高优先 | S11/S09/S06；配置团队许可与实际版本，不默认拥有所有量表 |
| 中医术语与映射版本 | `terminology/`，TerminologyEntry/MappingVersion | B，高优先 | H03/E01/Q01；疾病/症状/证型/干预分层，中英文范围由教授确认 |
| 样本量确定性计算 | `statistical_power.py`，研究方法Service/Worker | A，较高优先 | S02设计辅助；已测均值/比例/相关等限定算子，不能覆盖任意试验设计 |
| 数据质量规则、问题与放行门槛 | `data_quality.py`、`data-quality-release-policy.ts` | A/B，高优先 | S05/S06；原始发现、人工处置、豁免与放行分别保留 |
| 原始/预处理文件、字段字典、来源 | `ingest/`、`dictionary/`、`data/`、`storage/` | B，高优先 | S09/A01/A02；文件绑定Study/中心/访视，受控元数据与行数据分开 |
| 知识库文档解析、原文件、版本/审核 | `knowledge-import.service.ts`、KnowledgeDoc/SourceFile/Version | B，高优先 | E01/E02/H06/A01；承接已授权论文、方案、讲座PPT与资料 |
| 文献元数据、候选去重与人工决定 | `knowledge-literature-metadata.ts`、`knowledge-deduplication.ts`、controller276–305 | A/B，高优先 | 复用DOI/hash/题名作者年份规则；需新增两份Excel的批量行级导入 |
| RAG与指定文档引用问答 | `knowledge/retrieval.service.ts`、`sessions/`及知识问答UI | B，首期AI | E03/AI01；按资源权限过滤、引用版本，运行时实测 |
| 外部证据检索、筛选/综合、研究信号 | `research-evidence/`、`research-intelligence/` | B，后续接入 | O01/O02/H01；与真实来源/领域归属结合，外部工具是否执行必须有证据 |
| 正式科研产物、版本、来源、审核、发布/导出 | `research-artifacts.controller.ts:199–257`、ResearchArtifact相关模型 | B，高优先 | S10/A01/A02/G01；改造为受治理Asset及跨Hub共享/复用 |
| 身份认证、Cookie、账号停用/会话撤销 | `auth/`、`accounts/`、authVersion | C，基础可用 | P003–P006；旧账号租户绑定，注册/找回/L1–L3需重建流程 |
| 权限、上下文Guard、RLS、审计 | `StudyGroupGuard`、`prisma.service.ts`、`rls.sql`、`audit/` | B/C，底座优先 | G03/G04/所有业务API；适配跨机构身份与Study/中心/资源Scope |
| 工作台驾驶舱、待办、启动检查 | `StudyOperationsPage.tsx`、`ResearchHome.tsx`、cockpit/next-actions/startup-checklist | B，复用业务视图 | P01/S01；只提取业务卡与服务，保持当前Shell与学术风格 |
| 文本品牌配置、功能开关 | `tenant-theme-policy.ts`、`tenant-features/` | C，参考 | 当前实现为租户文本品牌，不能直接当完整Hub Logo/导航/范围配置 |
| 诊断Agent、专用眼动/抑郁多模态检测 | 旧业务与政策、专用数据处理模块 | D | 不纳入灵枢心域首期临床诊断；仅复用通用处理接口及治理机制 |
| Token计费、平台运营、整体后台/官网 | `billing/`、平台控制面、`official-site/` | D/后续 | 避免首期转为通用AI SaaS运营项目；按后续需求选择 |

## 5. 三个不能直接等同的产品对象

### 账号不是跨机构统一身份

旧 `Account` 明确含必填tenantId，用户名唯一约束为`tenantId + username`。登录需要tenantSlug。适合租户内科研成员，却不满足一个研究者跨机构、跨Hub通用账号。

需要统一User/Profile和机构认证/成员关系，决定旧租户账号如何关联统一身份；不得仅把登录页面改成邮箱输入而保留原假设。未在本轮检查的Auth接口中发现公开自助注册、用户找回密码或L1–L3验证闭环。

### StudyGroup不是Hub

旧课题组是私有成员与业务隔离上下文，不能代表跨机构公共领域空间。ResearchProject又同时绑定受试者、Protocol、访视、任务和产物，承担大量执行研究职责，与V2“Project内问题→独立Study”不同。

需要关系映射与迁移契约：Tenant运营边界、Organization机构、Hub领域、Project意图、Study执行。先以服务适配层验证语义，不将`studyGroupId`直接替换为`hubId`，不让领域关联继承患者数据权限。

### 表单锁定不是数据库锁库

旧表单版本有draft/published/locked，响应主要有draft/submitted。Service已阻止修改已提交响应，且提交与审计同事务；这是可用基础。

但表单字段目前仅number/integer/text/select/boolean。不能由此认定已实现日期/附件/条件逻辑、项目级锁库、受权更正后签署失效、完整签署语义、中心隔离和盲态/紧急揭盲。DataQualityReleaseGate是分析放行治理，不是EDC数据库锁库，须分别设计。

## 6. 文献表接入：可以借规则，不能原样上传

旧知识库文件门禁明确拒绝独立CSV/XLS/XLSX，要求进入数据模块。因此王教授两份文献Excel不能直接用知识库“上传文献文件”入口导入成规范论文记录；数据模块能读表格也不等于已有文献Canonical化。

需新增文献批次适配器：

1. 识别合并表与来源分表，记录file/sheet/row/hash。
2. 映射18列题名/作者/单位/关键词/摘要/日期/来源/DOI等元数据。
3. 复用normalizeDoi、内容hash、题名作者年份等候选去重逻辑。
4. 保留源记录，人工确认候选重复与领域分类；缺DOI/摘要/URL允许有状态导入。
5. 生成规范Publication与来源/版本关系，再组织进知识库及灵枢心域。

原合并记录15,696条不能自动当成唯一论文或临床研究数；跨语言去重与中医/现代术语映射由审核支撑，不只用AI译名合并。

## 7. 仍需新增或重点补齐

- 灵枢心域公共Hub、范围配置、关注/Brief、共建机构关系、学术活动目录及公共学术网络。
- Source/Canonical/Hub实体归属与临床注册来源、跨源去重、地图/趋势指标复算。
- 统一个人身份、科研L2/机构L3、多机构关系、科研成员邀请；H5患者问卷邀请另保留。
- 独立Study与中心/角色/资源权限、盲态限制；完整CRF字段/时点/验证规则。
- 数据更正版本、审阅签署、锁定/解锁、签署失效与分析快照；随机化/紧急揭盲按首个方案确认。
- 资产跨Study/跨Hub授权共享、权属与派生限制；旧产物发布不等于新Hub共享许可。

## 8. 建议接入顺序

1. **范围与模型映射**：确认首个Study/Protocol/CRF、账号/机构/Hub/Study模型及数据库选择，保留原项目独立运行。
2. **身份与作用域适配**：统一身份、Study/机构成员、服务授权、RLS与审计；不能先接采集后补权限。
3. **采集/执行纵向样例**：旧方案/入组/访视/表单/量表Service → 灵枢心域S02/S07/S03/S04/S09/S11；验证一个Study两个中心的真实链路。
4. **质量与产物**：旧疑问/偏离/确定性质量/产物治理 → S05/S06/S10/A01/A02/G01；补EDC生命周期缺口。
5. **文献与AI**：Excel批次适配＋知识库去重/版本/引用，再接E01/E02/AI01/O01/O02。
6. **领域闭环**：补真实Hub数据、活动、公开网络和经授权资产复用；之后再扩展其他Hub运营。

优先采用“保持现有前端＋后端模块提取/适配”的方式。若短期使用旧后端验证，创建新的受控配置与合成测试租户，不共用原教授账号、业务数据、凭证、模型密钥或部署。模块之间有Prisma/权限/服务依赖，不能按一个Service文件复制后就宣称复用完成。

## 9. 接入验收

至少验证：不同中心/Study拒绝越权；统一账号跨机构认证；方案旧版不被覆盖；表单必填/缺失语义/并发/正式提交；更正/签署/锁定；H5邀请有效期与同意；质量放行理由与数值来源；文献导入幂等与来源；AI输入授权/引用版本；产物共享/导出限制；当前公共Shell和50页路由回归。

本轮仅完成静态功能分析与12项纯算子测试。未迁入代码、接入后端、复制真实研究数据或改动原仓库；不将本报告作为生产功能已验收的证明。

## 10. 源码定位

以下均为检查提交的具体源码，可供后续实现核对：

- [表单策略与当前字段类型](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/src/study-operations/study-forms-policy.ts#L1)
- [研究执行API](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/src/study-operations/study-operations.controller.ts#L499)
- [知识文件格式门禁](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/src/knowledge/knowledge-file-policy.ts#L13)
- [文献候选去重](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/src/knowledge/knowledge-deduplication.ts)
- [Prisma模型：Account](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/prisma/schema.prisma#L171)
- [Prisma模型：ResearchProject](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/prisma/schema.prisma#L333)
- [科研产物审核与发布](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/server/src/research-artifacts/research-artifacts.controller.ts#L199)
- [确定性样本量算子](https://github.com/pengxiaochuan-ai/aisciencesys/blob/eadac113761485d3812dbb2e03a5f0385d9e6423/app/research-methods-worker/statistical_power.py)
