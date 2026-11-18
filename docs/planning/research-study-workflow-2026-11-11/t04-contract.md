# T04 后端草稿契约（实施中，2026-11-11）

本契约用于代码切片，审批、启用和业务验收仍属后续工作。现有表约束无法持久保存不完整访视时点：`VisitPlan.anchor`、`targetDayOffset`、`windowBeforeDays`、`windowAfterDays` 均非空，后三项有 0 默认值。允许方案其他字段不完整，但要求访视必须完整才能新增会损失用户提出的未确认字段存草稿能力。拟最小兼容迁移为四列可空、数字默认移除，原有已知值保持；旧访视生成、发布门和类型须显式处理 NULL、阻断启动，回归旧数据。此处是设计建议，未授权执行 schema/DDL；在决定前不得把缺失写为 0 或虚构 anchor，也不得宣称完整 T04 草稿已支持。

建议接口均以当前真实绑定的 `studyId` 寻址，经 `withResearchStudyTransaction` 按 `read`/`configure` 校验当前租户、账号、会话、课题组/项目绑定、权限和对应功能开关；不接受客户端提交租户或项目作为授权依据。所有写操作的鉴权、引用验证、锁、写入、审计和幂等回执须处于同一事务；不嵌套旧 Service 自开的事务。真实回执表为 `rh_research.operation`，复用现有 `getReceipt`/`saveReceipt`，requestKey 为账号/租户作用域；相同 key 与输入返回同一结果，其他输入/目标返回 409。

- `GET /research-studies/:studyId/configuration`：返回 `{study:{id,title},protocols,forms,scales,outcomes,capabilities}`；每个 protocol 有 `id,versionNumber,status,revision,title,purpose,primaryOutcomes,secondaryOutcomes,methodsSummary,populationSummary,statisticsSummary,visitPlans`，每个访视带 `id,code,name,sequence,anchor,anchorEventKey,targetDayOffset,windowBeforeDays,windowAfterDays,required,allowRepeat,requirements`。跨作用域不可见；候选只读不初始化模板；明确只返回实际可见已发布版本。S11/S02/S07 读取同一版本和引用。
- `POST /research-studies/:studyId/protocols`：`{requestKey,title,purpose,primaryOutcomes,secondaryOutcomes,methodsSummary,populationSummary,statisticsSummary,visitPlans}`；原子创建 draft 并返回完整读取和回执。文本与结局可不完整。数字显式 0 与缺失必须区分；当前不可空访视缺项须返回清晰的阻断错误，迁移后才可持久记录 NULL。
- `PUT /research-studies/:studyId/protocols/:protocolId/configuration`：同样完整内容加 `{requestKey,expectedRevision}`；锁定 protocol，重新读取完整配置并对规范化内容算 SHA-256 比对，拒绝陈旧写入；仅 draft 可写，复用已提供 ID 须校验归属，已被事实引用的子项不可删除；原子返回新 revision 和回执。不要仅以父 `updatedAt` 表示子项修订。
- `VisitRequirement` 的新表单绑定 `kind=form_response,config.formVersionId`；量表绑定 `kind=scale,code,config.scaleVersionId`。提交时验证版本已发布、同租户和适当项目范围；旧 `formTemplateKey` 仅兼容历史记录，不能用于新配置，固定 ID 应优先。结局引用同研究已有 `OutcomeDefinition` 版本，采用 `{outcomeDefinitionId,versionNumber}`，回读须验证完整；不能把对象的字符串转换当作已确认的结局。已发布版本更换须显式，不能覆盖历史。
- 普通结构错误返回 400、无权 403、不可见 404、并发或幂等冲突 409；错误保留用户输入。后端不自动发布表单/量表、审批、启用、转版、执行试填或触发正式采集。试填仅客户端/纯内存校验，不能调用会创建正式记录/访视满足事实的旧 assign/submit。

旧服务 `addVisitPlan` 追加要求与审计必须同事务保存；既有旧 DTO 透传 populationSummary/statisticsSummary。新增 Hub 逻辑须保留旧 feature gate、有效角色与审计，不能只绕过 Controller 调用 Service。T05 发布门须复核固定引用及团队确认材料，当前旧 gate 不足以认定完整。测试需覆盖缺失/0/false、跨租户、撤权、回滚、并发、重复请求及新旧版本绑定，真实 PG 只使用专用合成 scope。

## UI 母版核对（只读观察）

2026-11-11 使用已有私有合成会话，19501、Chrome、1440×900 只读进入原 S11 执行准备；公共 Shell 和页头之后依次为本人方案摘要、方案基准状态、执行准备配置，以及四张卡片“结局定义 → 访视安排 → CRF字段草稿 → 结局—字段—访视映射”。后续为配置检查、合成试填及历史。原路由为本人私有合成方案，不能作为正式记录。

正式研究分支拟保留同一 Shell、页面容器、四卡顺序和共享样式/14/22；原方案摘要和基准区域分别替换为当前研究与草稿状态，四卡内部以结局、访视及要求、已发布表单/量表版本、结局绑定的真实数据控件替换合成内容；一处保存草稿。目的是使正式配置写入同一研究与固定版本，影响仅为显式携带 studyId 的新分支，原成员/本人合成/试填不变。S01 研究准备现有卡片增加入口，S02/S07 增加同研究版本列表/详情分支；保持公共 Shell 和原页路由。候选列表及嵌套要求的确切结构须待后端契约，不能假设已有接口。母版与正式分支同视口实际比较须在代码与目标环境就绪后执行；如实现需要四卡外新增结构或重排，先提交具体差异并确认。

## 2026-11-11 实施裁决及接口示例

已授权编写最小 Prisma 可空迁移草案，保留旧值并移除数值默认；本阶段不执行 DDL，先由预检及专用合成库验证。旧 API 省略时间字段继续沿用旧默认，Hub 显式 null 一律保留，审批、启用、入组、转版及日期计算前必须拒绝未确认计划。回执复用既有 `rh_research.operation`。独立编译目录用于避免共享 dist 竞争。

`GET` 形状（具体空值均可为 null）：
```json
{"study":{"id":"study-1","title":"研究"},"protocols":[{"id":"p1","versionNumber":1,"status":"draft","revision":"sha256","title":"草稿","purpose":"","primaryOutcomes":[],"secondaryOutcomes":[],"methodsSummary":null,"populationSummary":null,"statisticsSummary":null,"visitPlans":[{"id":"v1","code":"V1","name":"访视","sequence":1,"anchor":null,"anchorEventKey":null,"targetDayOffset":null,"windowBeforeDays":0,"windowAfterDays":null,"required":true,"allowRepeat":false,"requirements":[{"id":"r1","kind":"form_response","code":"F1","name":"表单","required":true,"config":{"formVersionId":"f1"}}]}]}],"forms":[{"id":"f1","templateId":"t1","templateKey":"form","name":"表单","versionNumber":1,"status":"published","schema":{},"scoring":null}],"scales":[{"id":"s1","definitionId":"d1","code":"S","name":"量表","versionNumber":1,"versionLabel":"v1","status":"published"}],"outcomes":[{"id":"o1","key":"outcome","versionNumber":1,"name":"结局","role":"primary","sourceType":"scale","scaleVersionId":"s1","scoreKey":null,"dataFieldKey":null,"unit":null,"direction":null,"timepointCode":"V1","status":"published"}],"capabilities":{"canRead":true,"canConfigure":true}}
```
`primaryOutcomes` / `secondaryOutcomes` 为 `[{"outcomeDefinitionId":"o1","versionNumber":1}]`，未确认时为空数组。`POST` / `PUT` 返回 `{"protocol": <同 GET 项>, "receipt":{"id":"...","requestKey":"...","action":"...","targetId":"..."}}`。真实接口最终以验收代码为准，接口当前尚未完成。

授权映射：同事务实时验证 `study_operations` feature；租户管理员与精确绑定该 Hub 和课题组的领域负责人可配置，不需伪造组成员；普通项目管理员还需有效组角色的 `study.configure`。普通关注者不可配置；管理员功能开关关闭也不可操作。领域负责人仅取得配置权，不因此取得 PI、审批、采集、审阅或揭盲权。目标应覆盖精确域跨组/跨域拒绝、撤权与 feature 撤销测试；目前仅部分单测覆盖，PG/真实请求仍待验收。

要求类型边界沿用旧 `VISIT_REQUIREMENT_KINDS`：`scale`、`form_response`、`profile_field`、`modality_file`、`procedure`、`sample`、`confirmation`；未知类型返回 400 `RESEARCH_INPUT_INVALID`。Hub ESM 规范化器固定相同集合，变更时须与旧策略及数据库约束同步核对。
