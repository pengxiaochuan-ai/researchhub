# T04 后端契约核对（2026-11-11）

范围：只读源码与规格评估；本文件不代表代码、数据库、目标环境或专业验收已完成。T04 为草稿和已发布材料的配置保存/回读，审批与启用属于 T05；正式临床材料尚待团队确认。以下 API 为建议，尚不存在。

## 已核实的边界

- `app/server/src/study-operations/study-operations.service.ts:727` 的 `listProtocolVersions` 回读 `visitPlans.requirements`；`:743` 的 `createProtocolVersion` 自开租户事务，私有 `createProtocolVersionInTransaction`（`:760`）嵌套创建访视及要求并写审计，另创建任务模板。`:849` 的 `addVisitPlan` 校验可变状态但只创建 VisitPlan，丢弃输入 `requirements`，也没有同事务审计；追加后的完整回读必须修复并测回滚。`study-operations.controller.ts:145` 的创建 DTO/转发缺少 Service 已支持的 `populationSummary`、`statisticsSummary`；在旧入口作兼容性补充。
- Hub 的 `server/research-studies/commands.mjs` 提供 `withResearchStudyTransaction(user, studyId, operation, callback)`，只接受 `read`/`configure`，在同一 `withTenantTransaction` 内锁定授权、重读账户及租户状态、设置 tenant/group/project 上下文并重新校验绑定和当前角色。租户管理员、当前领域负责人、具项目管理角色且具有效成员关系者可配置；普通读者不可配置。不能把 Hub 身份伪装为旧管理员或绕过旧操作应有的权限和功能开关。`repository.mjs:setContext` 设置事务局部 RLS 上下文；`app/server/prisma/rls.sql` 对含必需项目/组的表强制作用域，对 `ScaleVersion` 此类只有 tenantId 的表按租户限制，官方行只在明确登记的表放行。应用查询仍须验证版本及所属关系；具体运行角色、现行策略和授权需 PG 测试核验，源码不证明目标环境已配置。
- 旧公开 Service 往往自行开启事务或通过 scoped client，不能在 Hub 回调中嵌套调用以假装原子。提取接收现有 `tx` 的小型核心并保留旧入口原有事务与 Guard；功能开关、权限、状态、审计、Remediation 依赖须显式接入，不能只抽出写 SQL。`StudyFormsService.listTemplates`/`cloneTemplate`（`study-forms.service.ts:41,51,564`）会初始化已发布内置求和模板；只读选择应直接查询实际可见版本，不隐式初始化。`assign` 创建正式 assignment/response，`submit` 会写访视满足事实（`:187,362,480,497`）；试填不得调用它们，亦不得写正式 Subject、Enrollment、Visit、结果及审计中的正式采集事件。建议 T04 试填仅在客户端/纯函数内存执行既有 schema 校验，刷新即清除，明确不提交；需要持久试填时另设计隔离存储。
- `StudyProtocolVersion`、`VisitPlan`、`VisitRequirement`、`FormTemplate`/`FormVersion`、`ScaleVersion`、`ScaleVersionApplicability`、`OutcomeDefinition` 是现有模型（`app/server/prisma/schema.prisma:1396,1468,1496,1916,1940,2371,2404,2481`）。VisitRequirement 的 `config` 为 JSON 且无版本外键；`form_response` 的现有匹配允许 `formVersionId` **或** `formTemplateKey`（`study-forms.service.ts:523`），后者不能保证固定版本，T04 固定版本绑定只写 ID 并不得退化成 key 匹配。旧量表要求按 code 查项目最新 applicability，`protocol-release-policy.ts:108` 不检查某方案固定版本，亦不检查表单或结局引用。`OutcomeDefinition` 有项目字段但无 Protocol 外键；Protocol 的 primary/secondaryOutcomes 是 JSON。`ScaleVersionApplicability` 是仅追加、最新 sequence 作为当前项目适用版本的事件，不等同方案版本固定绑定。
- 旧发布检查主要阻断目的、主要结局、访视和必需量表当前适用版本；伦理、同意、角色、表单版本和结局完整性等不能据此宣称已覆盖。旧表单 `publishVersion`（`:164`）直接更新状态并审计，不能假定已验证专业材料。量表发布要求条目及规则；`numeric-sum-v1` 非通用量表计分器。未确认材料只能保存草稿，不能发布或启动；T05 的发布检查必须纳入本契约引用与团队实际政策，不能以旧 gate 替代。

## 最小数据契约与映射（建议）

所有写请求在单个已授权 Hub 事务中执行：锁住目标 Protocol 行，校验仍为 draft、绑定所属 project、当前角色和期望配置指纹，再校验所有引用后写入、审计和幂等回执；任一失败回滚。指纹由服务端对完整规范化配置计算，读响应返回，写请求附 `expectedRevision`；初建使用 `requestKey`，重试同键同内容返回原结果，不同内容 409。不能以 Protocol `updatedAt` 单独充当修订号：子项变更未必更新父行。数据库唯一约束处理并发创建版本/代码，冲突返回可恢复的 409。事务内再次校验引用；保存不触发审批、启用或历史迁移。

| 项目 | 现有持久化映射及限制 |
| --- | --- |
| 方案 | `StudyProtocolVersion` 的 title/purpose、outcomes JSON、methods/population/statistics；草稿允许未确认信息缺失，必填数据库字段用空字符串/空数组表达待完善，不能伪造内容。状态及版本由服务器生成。 |
| 访视 | `VisitPlan` 的 code/name/sequence/anchor/window/required/allowRepeat；code 在方案内唯一；保留显式 0、false，未提供与 0 区别由边界校验处理，实际研究时点须团队提供。 |
| 要求 | `VisitRequirement` 的 kind/code/name/required/config；表单用 `kind=form_response`、`config.formVersionId`，量表用 `kind=scale`、`code=量表代码`、`config.scaleVersionId`；服务器检查版本状态、租户及研究可见性并锁定引用。实现必须同时修正正式满足判定优先使用固定版本的语义及其回归，避免 key 兜底；量表现有按项目当前版本匹配路径须在正式使用前改为以方案固定版本判定，不能提前宣称完整。 |
| 结局 | `OutcomeDefinition` 存 key、版本、名称、role、sourceType、scaleVersionId/scoreKey 或 dataFieldKey、unit/direction/timepointCode。Protocol 的 outcomes JSON 建议只存 `{outcomeDefinitionId, versionNumber}` 的引用快照，并按同项目校验且完整回读；旧 `primaryOutcomes` 的字符串消费者及发布检查需适配，不把对象 `String()` 后非空误认为已确认。关联及版本不可静默切换。 |
| 表单/量表 | FormVersion 必须同研究且 published/locked；ScaleVersion 必须在实际 RLS 下可见且 published，引用可用性及许可、题项、规则按真实治理判定。发布、适用项目和版本变更仍各自走受控动作；不能由选择自动发布或变更 applicability。 |

仅对 T04 范围，现有 JSON 可表达引用，未发现必须立即新增表/DDL；但无数据库外键约束，所有引用必须由服务器事务验证、回读及发布检查复核，且需决定版本删除/停用后的阻断语义。新结构与旧消费者兼容性若不能通过回归证明，则需在实施前提出最小迁移设计；当前不能断言永不需要迁移。更新已发布表单/量表或已审批方案一律新版本，旧版引用不覆盖。

## 建议 API（以现有 Hub 控制器错误格式为准）

- `GET /api/research-studies/:studyId/configuration`：`read`；返回 `{protocols:[{id,versionNumber,status,revision,title,purpose,primaryOutcomes,secondaryOutcomes,methodsSummary,populationSummary,statisticsSummary,visitPlans:[{id,code,name,sequence,anchor,anchorEventKey,targetDayOffset,windowBeforeDays,windowAfterDays,required,allowRepeat,requirements:[{id,kind,code,name,required,config}]}]}], forms, scales, outcomes, capabilities}`。所有列表及版本严格受当前范围约束；S11、S02、S07 使用同一响应/同一 protocol ID，而非复制三份配置。空列表为空数组；未确认字段可为空，明确 draft。
- `POST /api/research-studies/:studyId/protocols`：`configure`；`{requestKey,title,purpose,primaryOutcomes,secondaryOutcomes,methodsSummary,populationSummary,statisticsSummary,visitPlans}`，返回所建完整草稿及 `revision`、回执。访视及要求一次原子写入；初建并发按项目版本唯一性安全处理。
- `PUT /api/research-studies/:studyId/protocols/:protocolId/configuration`：`configure`；`{requestKey,expectedRevision,title,purpose,primaryOutcomes,secondaryOutcomes,methodsSummary,populationSummary,statisticsSummary,visitPlans}`，为完整草稿配置替换，响应为保存后完整读回及新 revision/回执。对已有子项使用稳定 ID 校验归属，新增项缺 ID；删除、重排仅 draft，校验无被引用数据，不能级联删除历史记录。若已有受引用事实则返回冲突，改版由 T05 设计。可用增量命令替代全量替换，但不得丢失未提交项。
- 结果引用仅接受已发布版本；不完整草稿可暂不绑定。候选读取无副作用；对不完整临床材料的表单/量表发布应返回可修复的 `MATERIAL_UNCONFIRMED`，并在需要时经明确的受控发布动作处理，T04 不自动发布现有草稿。跨范围对象按现有策略 404/403，输入无效 400，版本/请求键冲突 409，返回稳定错误码、可读信息；失败保留客户端输入。实际路由命名须与现有 Hub API 前缀一致后落地。

## 必须覆盖的验证及待定

1. 旧接口初建与追加访视：多个 requirements、config、0/false、空数组重读；故意中途失败证明计划、要求、审计共同回滚；DTO 两个摘要字段往返。旧调用者行为回归。
2. 合成 PG 集成：跨租户/组/项目访问、授权撤销及停用后拒绝；事务局部 RLS、非 owner 角色、锁与同键重试、两窗口冲突；外域/草稿/停用引用拒绝或阻断；固定版本替换不改变历史；明确检查表单固定 ID 与 key 匹配的兼容回归。
3. 按真实业务路径验证 S11 保存刷新、S02/S07 同版本与权限受限状态，试填前后正式表/访视满足事实计数不变；Playwright 截图/录屏及日志留痕。不能以单元/Mock 推断目标环境或专业验收完成。
4. 团队需提供方案、访视、CRF、量表版本与使用/计分依据、结局映射及审批政策；无材料只能做通用合成契约测试。表单版本发布责任、量表许可与无适用计分规则时的处理、结局映射粒度和版本失效策略待确认。T05 须补充配置指纹、引用状态、伦理/同意等实际政策的发布门与 Remediation，不得把 T04 草稿保存当作启用许可。

2026-11-11 主循环裁决：编写 VisitPlan 四个时间字段可空的最小 Prisma migration 草案与拒绝丢失数据的 rollback，不在本阶段执行 DDL；发布、启用、转版、入组与日期计算必须拒绝未确认字段。旧 API 原有省略默认保持兼容，Hub 的显式 null 保留；已知旧行不修改。`rh_research.operation` 为现存回执表。生成 Prisma 客户端后的编译影响集中于启用/转版、入组、锚点更新及上次访视后计算，具体代码与测试仍待完成验证。
