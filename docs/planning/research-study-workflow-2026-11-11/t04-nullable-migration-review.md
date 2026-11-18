# T04 · VisitPlan nullable迁移独立预审

日期2026-11-11。范围：`VisitPlan.anchor`及`targetDayOffset/windowBeforeDays/windowAfterDays`允许NULL，移除后三项数据库默认0，保留全部旧行值；不执行DDL、数据库连接、服务启停或测试。读取的是并行开发中的工作区快照，以下不是最终代码放行。

**结论：支持该最小迁移方向，当前不得仅凭DDL简单而执行。** 需完成下述发布/执行保护及真实合成库迁移兼容证据。NULL表示“方案时间配置未知”，与“完整方案的锚点事件尚未发生”不同；后者仍保留既有pending_anchor及空日期，不把合法等待锚点变成配置错误。

## 1. 当前源码与canonical位置

- 现已见拟议文件`app/server/prisma/migrations/20261111220000_visit_plan_draft_nullable/migration.sql`和`rollback.sql`，`schema.prisma`已同步四个nullable字段。这是公共`public.visit_plan`，应只沿现有Prisma迁移链，不能追加到Hub `rh_research`启动建表逻辑。
- `migration.sql`只有一个ALTER TABLE，释放四列NOT NULL并移除三个数字默认，没有UPDATE/DELETE，不改变旧行值；不涉及Subject/Enrollment/SubjectVisit日期回填。
- `rollback.sql`先拒绝任一NULL，再恢复NOT NULL与历史默认0。方向正确，但回滚调用必须在同一事务中锁住表并以失败即停止方式执行检查和ALTER，避免检查与约束修改间新写NULL；不得为回滚成功批量填0或删除草稿。回滚前也须停止产生NULL的新版本写入。
- 仓库正式入口是`app/server/package.json`的`prisma:deploy = prisma migrate deploy`。实际执行前必须检查目标合成库指纹、待执行迁移集合和schema基线；禁止将未知历史pending迁移一并执行来凑本项。本文不授权生产迁移或更改现有发布治理。
- `study-operations-policy.ts`并行补丁已见：Blueprint允许null，computeVisitWindow/instantiateEnrollmentVisits缺值抛VISIT_SCHEDULE_INCOMPLETE，normalizeVisitAnchor拒绝缺anchor。这些是代码观察，不是已通过运行验证。

## 2. 必须覆盖的旧调用路径

| 路径 | 读取时事实/风险 | 迁移前最小要求 |
| --- | --- | --- |
| 草稿新建/追加 | 旧createProtocolVersion及addVisitPlan仍有`?? 0`；旧DTO anchor必填。新Hub缺字段不能经旧默认被造0 | 新草稿契约明确缺省/显式null持久为null；不得让新入口吞掉null。旧API若保留历史“省略即默认0”兼容，必须明示仅是旧API契约，不接收新Hub未知值后自动默认；显式null不能被当0 |
| 发布检查 | protocol-release-policy的timepoints只看plans.length；hash仅id/code/name，漏时间字段 | findings纳入每plan的合法anchor、custom_event对应eventKey及三个整数/非负窗口；时间字段进入hash，使更改必然stale。现有timepoints检查可扩展，不必新建发布引擎 |
| transitionProtocol | 仅to=approved且remediation存在时跑release检查；可直接transition到executing | 不依赖可选服务是否装配来跳过配置完整性。approved/executing任何通道必须同样拒绝NULL/非法值；缺治理依赖明确错误 |
| activateProtocol | 内部只看approved/executing，先替代旧版再写新执行版；migrate=false时不经过instantiate | 在同tx内、supersede/activate任何写入前重读并验证所有访视配置。不能用“入组会失败”替代启用守门；明确错误码与字段位置 |
| enrollInTransaction | 先创建enrollment/anchor，再instantiate；新纯函数抛错可使整个tx回滚 | 在任何写入前检查配置更清楚；仍验证事务回滚不遗留入组/锚点/访视/任务/审计；将错误映射为可恢复业务拒绝，非500 |
| copyProtocolToProject | 原样复制nullable字段 | 复制允许形成不完整草稿，不自动补0、不复制为approved；UI回读保持未知 |
| migrateEnrollmentVisits | Blueprint/内部类型已在补nullable；instantiate会拒绝缺值 | 先验证目标完整性再迁移；中途失败旧执行方案/入组/访视/任务不变。历史配置/现有日期不重写 |
| recordEnrollmentAnchor | 遍历pending_anchor调用normalizeVisitAnchor和computeVisitWindow | 正常未发生锚点合法等待；若出现不完整配置，拒绝且同tx回滚本次新anchor和任何部分日程。错误为配置不完整，不伪称“事件未发生” |
| completeVisit→schedulePreviousVisitDependents | 前访视完成会给后访视计算窗口 | 先核对依赖配置，错误回滚本次完成/依赖日期/入组推进；有完整previous_visit配置但事件未发生继续pending_anchor |
| 完成条件/逾期与任务到期 | SubjectVisit已有nullable日期；completeVisit/窗口显示和computeTaskDueAt依赖scheduleState | 不把NULL配置当零天、逾期、无须采集或可完成；正常pending_anchor不得凭空生成dueAt；现有已排期/已完成行保持原结果 |
| startupChecklist/概览 | visit_plan步骤仅count>0；release_lock仅执行方案/已发布表单数量 | 草稿存在只能标配置已保存，不能称完整/可启动；正式启用摘要消费真实完整性检查，不用计数替代 |
| 客户端/序列化 | 数字输入可能Number('')→0，显示`||0`会造值；old消费者可能假定number | 草稿输入空串归null，0保留；回读null显示待配置；不得改已有SubjectVisit日期为null；客户端/服务类型及Nest构建一起验证 |

代码索引（工作区根）：`app/server/src/study-operations/study-operations.service.ts`中的createProtocolVersion、addVisitPlan、transitionProtocol、activateProtocol、enrollInTransaction、recordEnrollmentAnchor、migrateEnrollmentVisits、schedulePreviousVisitDependents；`protocol-release-policy.ts`、`study-operations-policy.ts`、`study-startup-checklist-policy.ts`。行号随并行补丁变化，按符号定位。

## 3. 预执行与验收清单

1. 先通过Nest构建、策略/Service契约和旧项目入驻回归；测试至少包含：四列分别null、显式0、负offset合法/负window拒绝、非法anchor、custom_event缺eventKey；直接transition与activate两入口均拒绝不完整。
2. 发布检查hash包括全部时间值；改变任一值后旧check必须stale。批准/启用拒绝不得仅存在于Hub前端或新API，旧Service通道也受控。
3. 用新建专用合成记录验证未知草稿保存→读回仍null；补齐→按原方式计算；完整方案缺锚点仍pending_anchor；原完整历史记录的窗口、完成和复制行为不变。
4. 真PG迁移前后记录四列类型/nullable/default、选定旧记录摘要及row count；无旧行UPDATE。新草稿可null，旧显式0原样保留。临床数据不读、不截图、不加入Notion。
5. 迁移仅当前明确文件；若目标库缺其他前置历史迁移，停在具体差异，不能运行全部pending。迁移日志/状态记录沿原canonical链，不开第二自动迁移入口。
6. 回滚试验在独立合成库：有NULL时拒绝且数据不改；无NULL时同事务恢复约束/默认。生产或共享本机正在产生NULL的新代码，不允许自动回滚到旧schema。
7. 完成T04真实API/PG和原S11/S02/S07页面闭环后，再核对目标运行使用新Prisma客户端/新策略。单纯Prisma generate或数据库ALTER成功不是页面功能验收。

## 4. 裁决状态

已批准的是最小nullable方向与起草/实现范围；本预审没有执行权限，也未判定全部补丁已满足。上述发布/启用与运行链为阻断检查项；不需要再向用户询问“是否允许null”，应在已有授权内修齐并提交最终独立代码/证据评审。主循环在评审前继续保持DDL未执行。
