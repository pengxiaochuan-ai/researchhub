# T00 · 首批课题创建与研究身份契约

日期2026-11-11。依据用户“添加调用方式后开始代码执行”授权，实施T00–T03创建闭环；其他任务按依赖继续，正式临床模板/采集启用仍需方案材料。本文件先于代码固定本批可验证行为，不改Frozen Shell。

## 1. 本批业务

Q01创建/编辑本人课题意图，Q02可查、刷新/重登可继续；按当前合法创建范围建立一个默认Study并进入S01真实概览。题名/问题/PICO沿原Q01字段，不自动填临床示例；Study建立不等于方案已批准或研究已启动。既有researchPlanId方案草稿和合成EDC入口兼容。

## 2. 身份、模型与事务

- `rh_research.project_intent`保存title/question/pico、owner、可选hub_key、version、创建/更新时间及draft/study_created状态；可先无执行Study保存。
- `rh_research.study_binding`保存产品studyId、project_intent_id、旧execution_project_id及tenant/group/hub父链；默认Study唯一，但结构支持后续非默认Study。旧公共表及历史外键不迁移。
- `rh_research.operation`保存actor/requestKey/requestHash、动作、结果回执和审计关联，用于幂等；不存凭证。支持同key同输入重查、异输入409。
- Hub负责人以明确、当前有效的`rh_research.hub_role`（tenant/hub/account/study_group/status/role）关系判定，不能从关注/显示名推断。该关系的配置仅限有效租户管理员；本批不重设计G02，提供受控服务入口和权限测试，未配置时不假装拥有角色。
- 有效科研账号可创建本人意图；建Study必须当前有合法可写组：有效租户管理员的本租户活跃组，或具有workbench/study.configure的活跃组成员，或明确Hub负责人绑定的活跃组。仅一个范围默认带入；无可用范围保留草稿并给下一步。创建者仅获新执行项目的project_manager成员，不授他人研究权限。
- 研究成员读取按当前执行成员/组授权；意图owner、有效对应Hub负责人、当前有效租户管理员可按本批职责管理。平台管理员不读取业务内容。每次锁当前授权，校验账号/租户状态及authVersion。
- Study建立时锁意图版本，以同一事务写旧ResearchProject、成员、Hub绑定、intent.version/status、幂等回执和审计。旧StudyGroupsService提取最小createResearchProjectInTransaction核心，原入口/行为保持；Hub调用前独立完成当前授权，不伪装tenant_admin。
- 新schema开启强制RLS；业务SQL参数化，设置tenant/group/project/account上下文。跨租户/错父链在应用和数据库均拒绝；elevated仅用于既有必要授权与写入核心，不作为免授权入口。

## 3. API契约（首批已实现，技术验收见本轮测试记录）

均在Hub自己的`/api`下，由现有Hub Auth认证，不把请求体actor/scope当可信身份。

| 方法/路径 | 输入 | 输出 |
| --- | --- | --- |
| GET /research-projects/context | 无 | capabilities、当前可见Hub和合法creationGroups |
| GET /research-projects | limit/cursor | items、nextCursor，按当前可见范围列真实意图 |
| POST /research-projects | title、question?、pico?、researchType?、hubKey?、requestKey | item、receipt；title必填，草稿允许问题/PICO未齐 |
| GET /research-projects/:id | 无 | item、capabilities、creationGroups |
| PATCH /research-projects/:id | expectedVersion、requestKey及上述可编辑字段 | 当前item、receipt；CAS冲突409 |
| POST /research-projects/:id/studies | expectedVersion、requestKey、studyGroupId? | item含默认study、receipt；不创建正式Protocol |
| GET /research-studies/:studyId | 无 | item含project/Study/执行容器、真实计数、capabilities、preparation状态 |
| PUT /research-hub-roles/:hubKey/:accountId | expectedVersion?、requestKey、studyGroupId、role=owner、status | 当前有效关系/回执；只租户管理员，父链真实 |

响应item基础字段：`id,title,question,pico,researchType,hubKey,version,status,createdAt,updatedAt,study`。study为null或`{id,executionProjectId,studyGroupId}`。列表不泄露不可读对象；未知或失权返回清楚受限状态，不能回退演示。

客户端路由采用`researchProjects=1`列表、`researchCreation=1`创建/编辑（可带projectIntentId）、`researchStudy=1&studyId=...`概览。已有researchPlanId路由优先兼容，新marker不因历史demo标记回退演示。所有写请求JSON、同源校验、256KiB总尺寸限制、当前权限和CAS/幂等。

## 4. 运行与验证

新增独立Hub研究运行入口，选择装配Auth、Prisma和上述模块，不导入旧AppModule或fixture启动器；没有生产配置不启动，不自动迁移或恢复旧后台任务。正式代码没有具名账号/测试库白名单。

软件验证仅在已有专用合成PG中建立本轮新租户/账号/组/记录，测试脚本先验证库指纹、再用明确合成范围；不查临床库、变更旧租户业务或重启其他任务使用的19501/19502服务。使用独立测试端口和真实PG/API/Playwright记录。临床研究启用、模型、渠道发信和生产发布不属于本批已执行结果。

验收含：新建/列表/编辑/刷新/重登/建Study/概览；管理员与Hub负责人、普通成员及未授权账号；重复请求/CAS/中途失败回滚、跨租户/错组/撤权、长文本与空态/错误恢复。标题/布局/字号与原母版同视口比较，失败不丢仍合法保留的输入，不增加开发说明。
