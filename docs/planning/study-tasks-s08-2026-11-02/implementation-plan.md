# S08执行任务整页 Implementation Plan

## 2026-11-03 · 执行结果覆盖本计划历史状态

本计划已批准，01–11技术实施/验证/唯一独立评审及作者修补已收口，见[实际台账](implementation-progress.md)和[交接](../../testing/study-tasks-s08-2026-11-03.md)。下文保留原执行清单作为设计历史，不再将旧“待确认/未实施/未勾选”作为新的待办或授权阻断；固定历史版回链按原允许的摘要限制实测。AC10专业体验仍未代签，S10暂停。已批准B02纯词表/QueryPlan继续，不重复要求S08开发确认。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已选当前目录由主代理串行实施＋一次独立代码总评审，不切worktree、不并行写代码、不自动commit。

**Goal:** 在原S08母版完成真实任务的创建、分派、执行、验收、站内提醒和关联上下文闭环，完成整页再进入下一页。

**Architecture:** Hub有界适配层复用旧StudyTask及业务政策；旧Task内部核心接收调用方事务，保留旧公开入口/默认权限与质控修复联动。两张Hub扩展仅承载关联与幂等回执/提醒，不复制用户/任务/临床数据。真实租户管理员从当前数据库判定，不需逐Study加入。

**Tech Stack:** 现有NestJS/Prisma/PostgreSQL、MJS本机装配、React/Vite；不增依赖、服务或Worker。

**Spec:** [已批准完整规格](../../product/study-tasks-s08-complete-spec-2026-11-02.md)；[已批准S01–S07授权](authorization-scope.md)；[ADR-0006](../../decisions/0006-tenant-admin-default-business-authority.md)。用户本轮“批准”覆盖这些范围和UI01–06；本小步计划待确认，当前未实施。

## Global Constraints

- 仅本机`wp01_test_full_baseline`，先fixture-guard核对；tenant/group/主Study及原两账号按授权清单精确匹配。最多1个新具名辅助Study、2个克隆角色、8个新具名任务；旧D01两任务和前序资料只读。
- 租户管理员长期默认本租户全部Study业务权限；本片只实现S08。不跨租户、不跳状态/版本/审计；不全局短路Guard、不伪造Study成员或actor。
- S01管理员flag、S02新角色/必要projectRole、S03 feature必须先完成影响检查，再原子启用、authVersion递增/重新登录；普通owner在片外Study增加写权限即停。
- F01–F12及UI01–06是唯一页面范围；S08未完成不切S10。保留Frozen Shell、两个Panel顺序、原两列网格中的三个主字段与主要按钮位置，不开发正式采集/审批/锁库/共享/发布/导出。原“三列”按实际截图/CSS纠正，布局不变。
- 操作/说明14/22、元数据≥12/18、显式长文16/28；1440/1280/390/320、原生200%、键盘及失败恢复实测，截图＋录屏对照母版。
- 截止日Asia/Shanghai真实日期当日23:59:59.999转UTC；题名1～120，原因/完成说明≤2000，验收备注≤1000，证据≤10；新manual/custom任务requiresReview=true。
- requestKey为8～128字母数字_-；非创建动作expectedVersion必填。列表默认20、limit 1～20；签名cursor绑定actor/tenant/Study/过滤。
- 无付费AI/真实邮件/新权限扩展/云资源/远端配置/旧服务停线/真实发布。不充值续额。不运行旧AI、采集、seed或R1写夹具驱动。
- 每任务先RED再最小实现再GREEN；单元、合成PG/API、真实浏览器分别留证。业务结果与测试结论分开，用户专业验收不代签。

## Review Focus

1. 组级角色变动会使owner在其他活跃Study获得新写权限：启用前检测并停止，不先改角色后解释（01）。
2. 同一请求超时/并发重复与中途故障：业务、关系、回执、通知、审计/质控副作用全成或全不成；重试不重复（02/05/09/11）。
3. 旧自动任务/待验收/已取消/已锁对象：保留原联动与合法状态，不能把任务提交当访视完成/验收通过（02/07/08）。
4. 用户未加入Study、账号刚被降权或正切账号：真admin可访问、降权即时失效、迟到正文不回填（04/11）。
5. 前置任务或关联来源当前不可读/已换版，提醒收件人已变：不泄露题名/答案，不以关联或旧sent冒充证据/送达（06/09/10）。

## 文件与接口落点

下列为待创建/修改清单，不代表已经实现。ResearchHub相对路径；旧代码仅明确列出的Task模块落点。

| 文件 | 单一责任 |
| --- | --- |
| `server/study-tasks/contract.mjs` | parseTaskCommand/parseTaskQuery、日期与白名单输入，投影稳定DTO |
| `server/study-tasks/authorization.mjs` | 当前账号/tenant/Study与任务能力解析、锁顺序；复用旧权限目录与授权锁，不采邮箱兜底 |
| `server/study-tasks/repository.mjs` | 受控分页/详情/参与人、两表SQL、回执/提醒读取 |
| `server/study-tasks/commands.mjs` | 写入事务编排、幂等、旧Task核心调用、通知/最小审计 |
| `server/study-tasks/links.mjs` | 正式访视/合成CRF真实父链与固定版摘要，来源只读 |
| `server/study-tasks/controller.mjs` | createStudyTaskController装配14条已批准API，调用统一服务；固定路由优先 |
| `server/study-tasks/schema.sql`、`scripts/study-tasks-schema.mjs` | 两表受控迁移和校验，不由页面请求或服务重启自动迁移 |
| `scripts/study-tasks-preflight.mjs`、`scripts/study-tasks-fixture.mjs` | 只读影响核对/保全；获准角色/Study/任务具名manifest初始化与重跑幂等 |
| `../app/server/src/study-operations/study-task-authority.ts` | 旧Task模块内共享当前任务授权断言，读写复用，接受TransactionClient |
| `../app/server/src/study-operations/study-operations.service.ts` | 原公开方法委托同事务内部核心；新增Hub内部入口，不扩大到其他模块 |
| `src/study-tasks-session.js` | 同源API白名单、scope/签名cursor透传、requestKey、终止旧请求与私有状态清理 |
| `pages/shared/StudyTasks.jsx`、`StudyTaskForm.jsx`、`StudyTaskRow.jsx`、`StudyTaskContext.jsx`、`study-tasks.css` | 按原两Panel分解呈现；表单/行内详情/关联，不自造Shell |
| `pages/shared/workflow-main.jsx`、`src/real-mode-route.js`、`src/study-overview-route.js` | 仅S08真实分支及原S01任务入口接线；保持其他页面分支/导航/布局 |
| `scripts/local-knowledge.mjs` | 注册本页controller和有界请求体，不挂载旧完整Controller，不改旧全局Guard或Worker |

测试按下列任务创建；复用`server/wp02/test-support.mjs`的旧TS加载方式与既有fixture guard。核心接口固定为：

```ts
type Scope = {tenantId:string; studyGroupId:string; researchProjectId:string};
type Receipt = {operationId:string; taskId:string; version:number};
// 旧Task模块导出assertStudyTaskAuthority(tx, principal, scope, action, task?) -> Authority。
// action为create/read/edit/assign/transition/review/remind/link；Authority仅服务端产生。
// StudyOperationsService.executeHubTaskCommandInTransaction(tx, principal, scope, command)
// 在同一tx内重新断言当前权限并调用原任务核心；不接受客户端Authority/admin标记。
// Hub parseTaskCommand(action, body) -> 白名单command；readTaskPage(db, authority, query) -> {items,nextCursor}。
// Hub executeTaskCommand(principal, scope, command) -> Receipt；当前授权与幂等同一事务。
// createStudyTaskController({env,ids,require,load,prisma,studyOperations,scope}) -> Nest Controller。
```

表实际落名`rh_study_tasks.context`和`rh_study_tasks.operation`，对应规格两种模型；Task/Account等仍为旧public表。两表ENABLE＋FORCE RLS，tenant policy含USING/WITH CHECK；只给现有app角色所需schema/table许可，业务账号角色不增加DB权限。跨表父链校验用受控事务/约束，关联原Task真实tenant/group/project，原件不复制。迁移先核对不存在/完整已有版本、DDL指纹及两表唯一性，部分版本拒绝；不执行通用migrate deploy/重置/回填。

## 01 · 启用前边界与保全核对（2h）

**Files:** Create `scripts/study-tasks-preflight.mjs`、`scripts/study-tasks-preflight.test.mjs`；Update `implementation-progress.md`。
**Interfaces:** 消费既有fixture-guard/当前runtime，仅允许读取；产出`preflight.json`（当前身份/全部活跃Study影响/feature/具名对象清单/保全hash，不含口令）。

- [ ] 写测试`preflight_refuses_other_project_write_gain`、`preflight_rejects_wrong_database`，断言片外新增写许可或非合成目标必须拒绝、无写函数调用；运行`node --test scripts/study-tasks-preflight.test.mjs`确认RED。
- [ ] 实现`inspectStudyTaskAdmission(env, ids)`，先验证目标，再只读核对admin flag、两账号全部活跃项目/组角色、feature及已挂载接口；保存原角色/成员/前序来源与8任务预算manifest基线。
- [ ] 同命令GREEN后运行`node scripts/study-tasks-preflight.mjs --mode local-synthetic`；结果要求明确PASS或精确阻断。未知影响不得当PASS，未通过不执行03。

## 02 · 旧任务同事务核心复用证明（2h；与01合计首半天）

**Files:** Modify旧`study-operations.service.ts`；Create旧`study-task-authority.ts`、`study-task-transaction.spec.ts`；Create `scripts/study-tasks-core-pg.mjs`。
**Interfaces:** 消费01范围；产出上文`assertStudyTaskAuthority`及`executeHubTaskCommandInTransaction`，原公开入口签名/默认权限不变。

- [ ] 写`task_core_rollback_preserves_remediation`、`legacy_entry_keeps_assignee_check`：故障注入后Task/关系/Audit/RemediationCase均不提交；旧入口仍拒绝非负责人执行。`pnpm --dir ../app/server build`后`node --test ../app/server/dist/study-operations/study-task-transaction.spec.js`确认RED。
- [ ] 只抽取创建/状态/分派/验收所需私有同事务核心；当前授权锁复用`common/worker-publication.ts`的`lockAuthorizationMutation`，按动作保留原校验和质控修复同步，严禁嵌套独立事务/伪装actor。
- [ ] 上述构建/测试GREEN，再运行`node scripts/study-tasks-core-pg.mjs --mode local-synthetic`，具名新对象回滚验证同一tx和失权拒绝，不持久化业务任务；保留旧Task相关回归。若需改非任务模块或无法原子复用，半天止损报告，不扩底座。

## 03 · 精确启用及两表门禁（3h）

**Files:** Create `server/study-tasks/schema.sql`、`scripts/study-tasks-schema.mjs`、`scripts/study-tasks-fixture.mjs`、`scripts/study-tasks-schema.test.mjs`、`scripts/study-tasks-fixture.test.mjs`。
**Interfaces:** 消费01/02的通过结果；产出两表、两克隆角色/admin真标记/feature、1无成员辅助Study和同run manifest；此步不代替真实API授权。

- [ ] 写`schema_refuses_partial_version`、`fixture_rerun_does_not_expand_scope`，断言第三表/片外对象/第9任务拒绝、原共享角色不变、每次authVersion变更可核对。`node --test scripts/study-tasks-schema.test.mjs scripts/study-tasks-fixture.test.mjs`确认RED。
- [ ] 实现唯一迁移及精确CAS初始化，调用旧表不复制；只按S01–S07申请内容变化。先运行`node scripts/study-tasks-schema.mjs --mode local-synthetic --approved-s08`，再运行`node scripts/study-tasks-fixture.mjs --mode local-synthetic --approved-s08`；保留前后快照，不能自动运行旧seed。
- [ ] 重跑上述命令应不增表/角色/Study/任务；用app事务真实PG验证跨tenant/父链RLS拒绝和完整迁移识别，测试GREEN。重登录原两个账号；运行保全比较，计划内身份变化逐项列出，非范围变化即停。

## 04 · 真实身份、Study选择和任务读取纵向闭环（3h）

**Files:** Create `server/study-tasks/authorization.mjs`、`repository.mjs`、`controller.mjs`、`authorization.test.mjs`、`repository.test.mjs`、`controller.test.mjs`、`src/study-tasks-session.js`、`tests/study-tasks-session.test.mjs`；Modify `scripts/local-knowledge.mjs`。按授权/读取/装配三个可单独回归子步实施，不一次改全部文件。
**Interfaces:** 复用02当前权限断言，产生context/capabilities、Study列表、任务分页/详情/参与人和本人回执读取；API消费者以后仅用本client。

- [ ] 写`admin_without_project_membership_can_read`、`revoked_admin_and_cursor_scope_are_rejected`，断言辅助Study的admin200/普通owner403、limit=2可翻页/游标篡改拒绝/不可读依赖不泄露；单元RED：`node --test server/study-tasks/*.test.mjs tests/study-tasks-session.test.mjs`。
- [ ] 实现只读DTO和固定路由优先，同源会话/Origin策略不放宽；本页不设置强制Study成员decorator后再全局绕过，而在有界授权层完整重验scope。装配仅本机owned runtime，按原进程归属校验重启，不触旧服务/恢复扫描。
- [ ] 单元GREEN；运行`node scripts/study-tasks-api.mjs --mode local-synthetic --step read`，保存两账号真实GET、已撤销旧会话401/403及数据库对应。用本页原位骨架验证真实读取，不将此步称整页完成。

## 05 · 新建和元数据编辑纵向闭环（3h）

**Files:** Create `server/study-tasks/contract.mjs`、`commands.mjs`、`contract.test.mjs`、`commands.test.mjs`、`pages/shared/StudyTasks.jsx`、`StudyTaskForm.jsx`、`study-tasks.css`、`tests/study-tasks-ui.test.mjs`；Modify `pages/shared/workflow-main.jsx`、`src/real-mode-route.js`、`src/study-overview-route.js`、04 client/controller。按后端创建/编辑、表单、路由三子步分别RED→GREEN，不一次大改。
**Interfaces:** `parseTaskCommand`与`executeTaskCommand`；前端`loadTaskPage(scope,query,signal)`/`mutateTask(scope,action,input,signal)`从`study-tasks-session.js`导出，收据格式固定。

- [ ] 写`create_same_key_returns_one_task`、`due_date_rejects_impossible_day`、`edit_conflict_keeps_input`，断言中文120/121边界、上海日终UTC、同key异body409、失败不丢表单。新增测试先RED。
- [ ] 实现创建/编辑与同事务回执/审计；精确参与人下拉、UI01/02原三列及共享Button；S08真实模式不调用demo-store，原S01任务入口及当前Study安全回跳接本页，不改其他导航布局。
- [ ] 单元GREEN；`node scripts/study-tasks-api.mjs --mode local-synthetic --step create-edit`及`node scripts/study-tasks-browser.mjs --mode local-synthetic --step create-edit`，真实创建/编辑、故障回滚/丢回执恢复、数据库只新增具名预算内对象。

## 06 · 分派、协作与依赖（2h）

**Files:** Modify commands/repository/Form/client；Create `server/study-tasks/assignments.test.mjs`。
**Interfaces:** `assignments`动作接收expectedVersion及三个ID集合；复用旧同事务核心，不直接散写关系。

- [ ] 写`assignment_rejects_cycle_and_foreign_member`、`executor_cannot_assign`，断言自依赖/循环/跨Study均拒绝、关系原状、无权依赖不透题名；运行`node --test server/study-tasks/assignments.test.mjs`确认RED。
- [ ] 实现UI02展开域与精确集合提交；只允许当前Study活跃成员或本租户有效admin，依赖未满足不能开始，待验收/终态不可静默改派。
- [ ] 测试GREEN；API/browser `--step assignments`，真实分派两账号并测试协作者读/执行能力、片外owner拒绝；保留原D01与来源hash。

## 07 · 执行、受阻、提交完成与取消（3h）

**Files:** Create `StudyTaskRow.jsx`、`server/study-tasks/transitions.test.mjs`；Modify commands/Task页面/client。
**Interfaces:** `transitions`动作及合法actions来自服务端，原因/证据由contract校验；实际版本和状态由响应重新读取。

- [ ] 写`completion_requires_note_or_controlled_evidence`、`manager_cannot_impersonate_executor`、`cancellation_keeps_actor_and_reason`，断言提交为pending_review、admin代办必填原因、普通管理者只可取消非代填完成；单元RED。
- [ ] UI03原列表行内提供选择/明确确认和完成/受阻原因；实现合法状态图、幂等CAS和当前来源重验，受控取消/代办原因持久入Operation/Audit；不改访视/CRF/科学数值。
- [ ] 单元GREEN；API/browser `--step transitions`走开始→受阻→恢复→提交及另一任务取消，核对真实actor/版本、旧自动任务质控联动和终态拒绝。

## 08 · 验收、退回与任务历史（2h）

**Files:** Modify commands/repository/TaskRow；Create `server/study-tasks/reviews.test.mjs`。
**Interfaces:** reviews action=accept/return，F12历史只读白名单、actor/version/time/reason，不返回原Audit自由JSON。

- [ ] 写`return_requires_reason_and_reopens_execution`、`cannot_accept_unsubmitted_task`，断言退回→in_progress/returned、再次提交后accept→completed/accepted，普通执行者403；单元RED。
- [ ] UI03原位接受/退回原因、验收人时间、明确待验收/已验收区别；同人执行验收如实标注非独立复核，保留审计和原质控同步。
- [ ] 测试GREEN；API/browser `--step reviews`由真实管理者退回/接受、admin本人与代办历史，接受不触发审批/锁库/导出。

## 09 · 真实站内提醒收件闭环（2h）

**Files:** Modify commands/repository/TaskRow；Create `server/study-tasks/reminders.test.mjs`。
**Interfaces:** reminders动作由服务端解析收件人；Operation快照＋原Notification非送达状态，详情向当前仍有任务读取权的快照收件人交付。

- [ ] 写`reminder_freezes_recipients_and_deduplicates`、`no_recipient_is_not_success`，断言客户端收件人/sent字段拒绝、相同key仅1事件/通知/审计、收件人失权不可读；单元RED。
- [ ] 实现任务详情提醒记录、真实actor/time；不得调用原仅写sent捷径或任何邮件/短信/模型。提醒频率用现有有界限流惯例，恢复信息明确，不新增定时服务。
- [ ] 测试GREEN；API/browser `--step reminders`双账号切换，接收者能在S08看到真实提醒；断言无外发网络/模型请求，无虚假“已送达/已读”。

## 10 · 原第二Panel关联、摘要与回链（3h）

**Files:** Create `links.mjs`、`StudyTaskContext.jsx`、`server/study-tasks/links.test.mjs`；Modify repository/commands/Form。
**Interfaces:** link-options/PUT context及`readTaskContext(db,authority,context)`；none解除，formal_visit与synthetic_crf_record显式分型，来源固定版本/hash。

- [ ] 写`synthetic_id_never_enters_formal_visit_fk`、`stale_or_unreadable_link_hides_content`，断言真实父链/版本、无CRF正文复制、不以context充当完成证据；单元RED。
- [ ] UI05原Panel展示真实只读摘要/获准选择；UI06页头原动作行切Study。原两个账号当前资料权限不因任务关联扩大；可用目标固定版回链，否则原位说明目标限制，不跳演示S09。
- [ ] 测试GREEN；API/browser `--step links`实际关联→换绑→解除→授权回链返回、来源改变/撤回反例；既有计划/collection/CRF/报告数据hash不变。

## 11 · 全页恢复、整链与独立总评审（7h：测试5h＋总评审/收口2h）

**Files:** Create `scripts/study-tasks-api.mjs`、`study-tasks-browser.mjs`（前序任务逐步加入对应step）、`study-tasks-preservation.mjs`；补充client/UI回归；Update产品/使用说明/API/测试报告及本台账。
**Interfaces:** drivers统一`--mode local-synthetic --step <name|all>`，只允许本run两账号/两Study/最多8任务；证据目录`docs/testing/evidence/study-tasks-s08-2026-11-02/<runId>/`，Cookie/密码不入证据或录屏。

- [ ] 写`late_response_after_identity_change_never_restores_body`、`unknown_commit_reuses_request_key`、`pagination_survives_filter_return`及键盘/错误焦点/200%反例，先观察RED；筛选、分页、恢复UI04不得占用新Panel或缩字。
- [ ] 完成F11/本页状态清理与保全比较；运行`node --test tests/*.test.mjs src/*.test.mjs server/study-tasks/*.test.mjs scripts/study-tasks-*.test.mjs`、`pnpm build`、`pnpm --dir ../app/server test:study-operations`；保留真实失败与原告警，不把相关测试称全部旧系统测试。
- [ ] 运行API/browser `--step all`及`node scripts/study-tasks-preservation.mjs --mode local-synthetic`；双账号/三角色、admin未入Study、真实撤销在途、CAS并发、丢回执与全链正向。1440/1280/390/320及原生200%截图/录屏，和原R1母版逐区对比，仅UI01–06差异允许。故障注入使用本轮run有界测试机制，不新增公开管理端点。
- [ ] 唯一独立代码总评审（只读）；主代理按实际问题小步修补/复验，保留原结论和作者关闭记录，不额外派实现者。原Task/已装配主链回归与前序资料、共享角色、旧进程/费用保全，S01–S07计划内变化单列。
- [ ] AC01–10逐条列代码/启用/真实请求/用户效果四层。同步living spec、基线/变更/06、使用说明、API、测试证据及Notion；用户AC10未确认不称专业验收通过。S08整页约定未完成不切S10。

## 排期、检查点与止损

共32h实施/联调/技术交接＋8h同范围缓冲（4＋1有效工作日），01/02首4h；03–05合计9h；06–08合计7h；09/10合计5h；11为7h（含5h整页及2h唯一总评审/收口）。单个任务内按约1～2h子步留下可复验检查点，跨会话沿台账续，不按旧R1计划切页。

工时核算：01=2、02=2、03=3、04=3、05=3、06=2、07=3、08=2、09=2、10=3、11=7，合计32h。

各任务新增后端/前端测试统一RED/GREEN命令为`node --test server/study-tasks/*.test.mjs tests/study-tasks-*.test.mjs`；文件尚未创建时先运行该任务明确列出的单文件，不能把glob缺文件造成的错误当业务RED。05新增`contract.test.mjs/commands.test.mjs`，07新增`transitions.test.mjs`，08新增`reviews.test.mjs`，09新增`reminders.test.mjs`，10新增`links.test.mjs`；11新增`tests/study-tasks-recovery.test.mjs`。先断言具名行为失败，再实现；后续API/browser命令统一完整前缀`node scripts/study-tasks-api.mjs --mode local-synthetic --step <步骤名>`与`node scripts/study-tasks-browser.mjs --mode local-synthetic --step <步骤名>`。11主段测试RED→GREEN后另行独立总评审，不混成同一检查。

- 门禁A（01/02）：影响范围/同事务复用无法证明，停在实际启用前；不补第3表、不改全局Guard/其他模块，不用演示或mock顶替PG证据。
- 门禁B（05后）：创建/读取/编辑正向真实请求＋母版对比通过；否则先修本页，不开始下一页。
- 门禁C（08后）：角色/状态/验收及副作用原子提交通过；再接提醒/关联。
- 门禁D（11后）：获准角色F01–F12没有施工占位，证据与用户体验分列；不以测试全绿代替AC10。
- 11/04、11/06据实更新余量；4＋1是S08片估算，不保证全站11月中旬完成，不默认周末加班、不静默缩减一期。超过1天同范围缓冲或需要新范围，报精确剩余项/影响再讨论。
- 数据/权限回退只恢复本run明确变更的授权配置（CAS＋authVersion＋重登录）或停止本页装配，不删表/任务/历史；不执行旧服务停线/云/发布。任何故障或范围越界先保全证据、恢复本轮安全终态。

## 自检与交接

- [x] F01/02→04，F03/04→05，F05/06/08→07，F07→08，F09→09，F10→10，F11→05/11，F12→08/09；UI01/02→05/06、UI03→07/08/09、UI04→04/11、UI05/06→10；AC01–10归11收口，S01–S07归01–05。
- [x] 五项Review Focus均有具名反例；核心/DTO/client名称一致，预期失败与通过命令明确；禁止新增框架/表/服务/跨页范围。
- [x] 用户已确认本小步计划并开始实施；实际通过/失败/未测、受控建表/授权/owned runtime重启及浏览器证据另记实施台账，不由计划勾选冒充全部完成。
