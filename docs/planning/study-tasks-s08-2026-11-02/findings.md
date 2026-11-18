# S08完整范围设计核对证据

日期：2026-11-02；性质：代码/现有截图核对＋专用合成库READ ONLY身份核对，**不是S08功能验收**。本轮没有创建角色/Study/任务/表，没有改admin标记、业务代码或页面，也没有新浏览器实测。

## 1. 母版与真实差距

- `pages/shared/WorkflowPages.jsx:47` 的TaskBoard：两个Panel，前三列题名/负责人自由文本/截止日，保存演示任务，原列表状态select，第二Panel演示访视按钮。当前需要完整替换真实状态，不把演示localStorage当数据库。
- 原版截图：[R1-01核对记录](../../testing/own-tasks-method-reports-preflight-2026-11-02.md)，证据目录`docs/testing/evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/`下1440/390母版。该历史证据不是本轮改版后的截图。
- 任务闭环需题名/分派/执行/验收/真实提醒/关联/恢复。原版缺必需交互，因此规格明确UI01–06差异申请，不能伪称“接线无交互变化”。

## 2. 旧后端复用与限制

以下路径均相对`/Users/mac/aisciencesys/app/server/`，本轮只读：

| 源码位置 | 实际事实与设计影响 |
| --- | --- |
| `src/study-operations/study-operations.controller.ts:435`及674–725 | 原Controller同时含更多业务；任务创建configure、执行execute、验收review，依赖study_operations。不能直接挂载全Controller当Hub最小实现 |
| `src/study-operations/study-operations.service.ts:2026` | listTasks无分页、包含本人创建未分派任务并回传较宽对象；新页必须按矩阵裁剪DTO/列表 |
| 同文件2086–2225 | 手工任务关联真实父对象，requiresReview=true；复用创建规则，但需当前授权/原子回执 |
| 同文件2227–2389 | 执行仅原assignee/collaborator、version CAS、完成/验收分离，且同步RemediationCase；不能伪装管理员为assignee或删掉联动 |
| 同文件2390–2473、3064–3090 | 分派/依赖规则及活跃Study成员校验；正式管理员无需入组，需明确受控内部兼容点 |
| 同文件2475–2502 | remindTask只插入StudyNotification并标sent，无收件人/实际送达链。必须另有可读真实收件人事件，不把原sent当业务交付 |
| `src/study-operations/study-operations-policy.ts:191`、212 | 完成提交pending_review，接受/退回另处理；页面不能“已完成=已验收” |
| `src/common/guards/study-group.guard.ts:49` | 当前租户管理员未自动免Study成员/细权限；全局放行会越出S08边界，不采用 |
| `prisma/schema.prisma:1636`、2142 | StudyTask已有version/正式关联/协作/依赖；StudyNotification无收件人/请求幂等键。规格申请两个Hub扩展，不复制临床数据/原Task |

## 3. 当前授权快照

2026-11-02T11:25:26.943Z，既有`loadFixtureInput`→`assertFixtureTarget`→`withFixtureTransaction(...,{readOnly:true})`核对专用合成库`wp01_test_full_baseline`。owner/admin两账号active、isTenantAdmin均false；同原角色；项目角色researcher；workbench可见，study.configure/execute/review均无；study_operations条目不存在。只输出必要身份事实，未输出配置凭证。

由此分开记录：用户正式产品原则已确认；当前数据库和代码尚未启用此能力；具体本机启用须按[授权清单](authorization-scope.md)批准后执行，不能按邮箱硬编码“管理员”。

## 4. 结论及四层状态

推荐Hub有界S08适配层＋旧任务规则/服务最小兼容，不用旧全Controller、不全局短路Guard、不新增后台服务。完整规格和最小授权待用户批准；独立设计可实施性评审见[review.md](review.md)。

| 层 | 本轮状态 |
| --- | --- |
| 代码 | 尚未实施S08真实任务闭环 |
| 目标环境 | 只读核实缺少admin真标记、业务权限及feature；未启用 |
| 真实请求 | 无新S08写入/浏览器执行，仅只读核对 |
| 业务效果 | 设计待评审，不称已完成或可验收 |
