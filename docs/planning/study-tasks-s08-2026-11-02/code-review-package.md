# S08 唯一独立代码总评审包 · 2026-11-03

## 本包已完成评审

独立原结论Critical0/Important2，详见[原发现与作者裁定](final-review.md)。作者已完成一轮修补并实际Chrome验证，不作第二次独立签认。最终API `final-api-0cf5a0f7-5f7e-45d1-9a43-fe75c6a74b12.json`已通过，下文“重跑中”仅送审时快照；admin最终恢复true/authVersion5、owner5，保全通过。最新235/138/12测试、构建、原生200%与四屏真实证据见[交接](../../testing/study-tasks-s08-2026-11-03.md)。

## 范围和执行边界

用户已批准S08完整规格/11步计划/UI01–06/S01–S07，当前再次明确“完成S08”，不重复批准已有步骤。当前目录串行实施，不自动commit/worktree，原未提交内容保留；仅专用合成库，两原账号、两具名Study、最多8个本轮新任务；旧D01/科研资料只读，0模型/外发/云/真实发布。01–08为中断前实现，本轮接续09–11；本次审阅覆盖**整个S08**而不是仅09增量。

规格：`docs/product/study-tasks-s08-complete-spec-2026-11-02.md`；计划：本目录`implementation-plan.md`；授权：`authorization-scope.md`；阶段结果：`implementation-progress.md`；Ruling：`.superpowers/sdd/implementation-plan-study-tasks-s08-2026-11-02/progress.md`。规格是目标，不因未列输入而忽视真实用户会遇到的问题。

## 代码读取清单

- Hub整个`server/study-tasks/`、`src/study-tasks-session.js`、`src/study-task-list-state.js`、`pages/shared/StudyTask*.jsx`、`pages/shared/study-tasks.css`及对应`tests/study-tasks-*.test.mjs`。
- 同事务复用：`/Users/mac/aisciencesys/app/server/src/study-operations/study-task-authority.ts`、`study-task-transaction.spec.ts`及`study-operations.service.ts`的Hub入口、创建/编辑/执行/分派/验收核心；共享默认公开入口不可被新Hub策略替换。参考root Git diff，仅这些旧Task路径在本片范围。
- 本机装配：`scripts/local-knowledge.mjs`；`scripts/local-knowledge-ai.mjs`仅新增只读`edc.inCollection`依赖出口，不改变Agent/Queue/Provider行为；复用源为`local-synthetic-edc.mjs`及`local-research-plans.mjs`既有同事务入口。
- 迁移/准入/夹具与真实验证：`scripts/study-tasks-*.mjs`（先关注schema/fixture/role-probe/核心PG及api/browser/reminder/link/final/preservation）。不运行初始化、角色变更、API/browser写入或服务启停，不访问运行时凭证或其他研究数据。
- 相关路由只核对S08：`pages/shared/workflow-main.jsx`、`src/real-mode-route.js`、`src/study-overview-route.js`；其他页面/旧WP问题不是本轮扩容授权。

Hub HEAD=`190f509d127b833a9380dfdf52916f20038b6f9c`；新模块多为未跟踪，**不能只读git diff后判定无改动**。直接核对上述当前文件与旧Task根仓库diff。评审只读，不改文件/索引/HEAD/数据库/服务，不另派代理；返回Critical/Important/Minor、文件行号、用户影响、最小修补建议和Declined to judge清单。只做这一次总评审，作者随后一次TDD修补，不冒称独立二次签认。

## Review Focus（原计划原文）

1. 组级角色变动会使owner在其他活跃Study获得新写权限：启用前检测并停止，不先改角色后解释（01）。
2. 同一请求超时/并发重复与中途故障：业务、关系、回执、通知、审计/质控副作用全成或全不成；重试不重复（02/05/09/11）。
3. 旧自动任务/待验收/已取消/已锁对象：保留原联动与合法状态，不能把任务提交当访视完成/验收通过（02/07/08）。
4. 用户未加入Study、账号刚被降权或正切账号：真admin可访问、降权即时失效、迟到正文不回填（04/11）。
5. 前置任务或关联来源当前不可读/已换版，提醒收件人已变：不泄露题名/答案，不以关联或旧sent冒充证据/送达（06/09/10）。

## 已有真实证据与待收口

09：`rh-s08-1c6165b1/reminders-api-ba101c6e-3e12-47c7-9e4a-3936e64c0af5.json`及`browser-reminders-fac52cf1-*`。10：`links-api-f07413dc-*`及`browser-links-f365cde1-*`。11：`browser-final-514c56a2-*`实际完整状态链、`browser-final-6e6c8ed6-*`真实已提交提醒丢回执/GET恢复、实际Cookie换身份后迟到真实200隔离、四视口与原生Chrome200%。路径前缀均`docs/testing/evidence/study-tasks-s08-2026-11-02/`。

最新作者门禁56项相关、旧核心12项通过，最终完整套件正在收口。保全352产物/1083版本/2710来源、旧2任务及原共享角色/AI账本摘要一致。8任务已用满，不创建第9个；如需复验只能使用现有本轮对象/回滚。

首次最终API已经过CAS并发、真实HTTP在授权锁上等待后撤销、旧cookie失效和CAS恢复管理员；最后取消任务重开正确被拒绝但返回400而非规格409，整轮仍标失败。已新增RED→GREEN只在Hub映射`INVALID_TASK_TRANSITION`为409，旧公开行为不变；当前在重跑精确HTTP验证，勿把此前失败写成通过。失权探针admin恢复true/authVersion=3，owner管理角色/authVersion=5。

已知范围限制：目标采集页无固定历史版入口，按已批准规格S08仅版本摘要/说明，无假回链；现有公共Shell在320顶部品牌/搜索/身份拥挤，本片不擅自全站重构，S08内容/动作/200%另测。AC10用户专业体验不代签，代码与技术证据通过也不称生产发布。
