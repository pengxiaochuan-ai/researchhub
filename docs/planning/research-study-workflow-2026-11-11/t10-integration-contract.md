# T10 正式访视、答卷与 S08 任务集成契约

状态：只读准备，未实施、未接线、未验收。范围对应本轮 `implementation-plan.md` 的 T10，依赖 T09 的真实 FormalResponseRef 与审核事实；按页收口前不修改 S08 页面或运行环境。任务仍是现有 StudyTask，关联和证据不能创建第二个 EDC、答卷或任务事实。

## 现有入口与限制

| 现有入口 | 当前可复用内容 | 当前不能直接用于正式研究的原因 |
| --- | --- | --- |
| `server/study-tasks/controller.mjs` `/api/study-tasks/{studies,context,participants,link-options,operations/:requestKey,:id}`；`POST /api/study-tasks`、`PATCH /:id`、`POST /:id/{assignments,transitions,reviews,reminders}`、`PUT /:id/context` | 查询、任务动作、原回执形状、版本 CAS 和同事务调用结构 | `createStudyTaskController` 强制 wp01 合成库、固定 manifest、固定两个账号及本机 origin；scope 使用请求头且只能命中两个人工夹具项目；非本轮创建任务只读。不能把这些围栏直接当产品授权，也不能只删除围栏。 |
| `authorization.mjs` 的 `createTaskAuthorization`，旧 `assertStudyTaskAuthority` | 后者同事务重核账号/authVersion、tenant/group/project/feature、workbench、当前成员和任务可见/操作权限，管理员按 ADR-0006 | 前者只允许固定 owner/admin、两项目，是测试围栏。真实 Hub owner 配置权本身不等于任务执行或源数据读取；任务可读也不自动授予来源读取。 |
| `commands.mjs` 的 `createTaskCommands`，`executeHubTaskCommandInTransaction` | 已有任务创建、改动、分派、状态、审阅、提醒、link 的同事务 CAS、审计和幂等；任务完成/接受独立于访视 | 命令内部额外强制两个账号、最多 8 个、只可写本轮创建任务，并切换两个夹具 project 的 RLS 配置；产品适配需替换为同一真实 Study 的服务器解析和当前授权，而非把 `boundary` 改成宽泛通配。 |
| `repository.mjs` 的列表/详情/回执、签名游标 | 当前任务可见性过滤、排序、分页、来源重新读取、权限撤销失效及操作者绑定 receipt | 游标绑定当前 actor/scope/筛选；产品适配需在每次请求重验当前身份和授权，并覆盖跨 Study/身份重放；`writableTaskIds` 和 `syntheticOnly` 是夹具限制，必须有正式的可写判定。 |
| `links.mjs` `verifyTaskContext`、`readTaskContext`、`readTaskLinkOptions` | 统一版本/哈希核对，受限来源不交付旧摘要；`kind:none` 允许原任务权限下解除关联 | `deriveFormal` 由 `allowFormal:false` 封禁；选项对 formal_visit 硬返回空和 `local_synthetic_only`。既有分支只核部分 visit/enrollment/subject 父链和 visit 版本，未核 Hub Study 绑定、来源的独立读权、visitPlan/protocol 一致性、正式答卷/固定 revision 或安全回链。单纯设 `allowFormal=true` 不满足 T10。 |
| `evidence.mjs` `verifyTaskEvidence`、`presentTaskEvidence`、`readTaskEvidenceOptions` | 固定 artifact 版本、哈希、当前读权和最小受限展示 | 当前仅 `artifact_version`，且自身/创建者/草稿围栏也是本轮合成约束；不是 FormalResponseRef。不得把 artifact 权限视为正式答卷权限或改成任意 URL。 |
| `pages/shared/StudyTaskContext.jsx`、`StudyTaskForm.jsx`、`src/study-tasks-session.js` | 当前任务关联/解除、冲突及同 key 回执恢复框架 | UI 只查询 `synthetic_crf_record`，选项验证也只接受该种类，写有合成限制；尚无正式访视或答卷选择、实际可用的固定版本回链。此次只记录待做，不修改布局。 |

## 正式 Study、父链与读取授权

产品入口按 authenticated Hub session 和服务端 `withResearchStudyTransaction` 将 `studyId` 解析为实际 tenant/group/executionProjectId，锁授权并在该 scoped tx 内调用现有任务 authority；请求的 group/project、client capability、tenant 或任意 URL 均不能覆盖服务器绑定。任务本人/协作者可见性、创建/配置/分派/取消/link 的 configure、执行者 transition、PI/reviewer 审阅、管理员同租户权限继续复用 `assertStudyTaskAuthority`。目标详情、关联和证据必须同时满足来源自己当前读权；必要时借用 `authorizeFormalResponse(...,'read')` 与 T09 共同读取核心，不能借任务权限扩权。每次列表选择、命令、详情、回链和回执重放重验当前身份及真实 scope。

正式访视至少核实：task 与 Hub Study 指向同一 tenant/group/project；Subject 为正式且未软删；Enrollment 属该 Subject 和该 Study；Visit 属该 Enrollment 和 Subject，`visit.protocolVersionId === enrollment.protocolVersionId`，VisitPlan 属同一 protocol，policy/方案及中心限制按当前可用机制校验，不能由 client 提供父链替代。捕获 visit `version` 与服务器计算的包含父链、计划、状态的 hash；project → protocol → subject → enrollment → visit 锁后重读，防止转版/撤回或并发改动后关联旧对象。若历史方案转版使父链不再可用，返回受限/已变化，不伪装成当前。

正式答卷至少核实 Assignment、FormResponse、FormVersion、Subject、Enrollment、Visit 和研究方案均属于同 scope 且父链一致，表单版本是该访视 requirement 固定版本；被试/入组/访视/方案和当前可读性均以事务内数据库事实为准。`FormalResponseRef = {responseId, assignmentId, revisionNo, contentHash}` 由服务端按真实 `FormResponseRevision` 查询、校验 revision 对应的 response/assignment、内容 hash、记录来源及固定方案/政策；不得用客户端所称的 revision 或 `FormResponse.answers` 投影代替。无 revision 的旧提交为 `legacy_unversioned`，不伪造 baseline。不可展示答案作为普通任务摘要；只提供最低必要名称、状态、固定 ref 和受控导航。

## 最小实施增量（待 T09 语义冻结）

1. 在现有 S08 产品装配层新增真实 Study resolver 和事务适配：复用现有任务命令/查询核心，但把夹具身份、8 条限制、固定账号、两项目和独立 fixture DB 替换为当前 Hub Study 绑定及相应真实 scope。保留本机夹具入口作为独立测试入口，不能以去掉测试限制冒充产品权限。旧任务链接及收据读取保持兼容；任务完成或接受不触发 visit/response 完成或审核。
2. `links.mjs` 新增真实 formal visit options 和 `deriveFormal` 真实父链/来源权限核对；候选分页在数据库限量，并按 actor、真实 Study、kind、查询绑定签名游标；每项读取时仍复核授权。`formal_visit` 保持现有上下文协议，`kind:none` 保持解除；解除也需任务当前 link 权限及版本 CAS，源当前不可读时仍不泄漏旧摘要。
3. 按 T09 最终 schema 为 assignment 和固定 revision 增加明确可区分的受控引用类型。建议 `formal_assignment` 由服务器派生 assignment/visit/subject 及当前 response version/hash；`formal_response_ref` 保存精确四字段，另从父链解析 study/subject/visit，不将 hash 伪称 visit 版本。当前 `parseTaskContext` 和 `rh_study_tasks.context` CHECK 仅接受 `none/formal_visit/synthetic_crf_record` 且字段固定，故需要显式、可回滚的 schema/API 迁移评审；不要复用字段偷偷改变既有语义、覆盖旧关联，亦不要另造答卷表。若最终 T09 提供足够的只读 resolver，优先复用；否则补独立同 tx 的精确 revision 验证/历史读取 helper。当前 `readFormalResponseInTransaction` 读取的是 current ref，不能据此宣称它支持任意历史 revision。
4. `evidence.mjs` 若支持完成证据，扩展受控类型为精确 `FormalResponseRef`，保留原 artifact 类型；核真实父链与独立读权、精确 revision/hash、审阅锁定/当前性由 T09 政策判定，不从标题、自由文本或任务完成状态猜测。更正后旧固定 revision 仍是历史事实，但当前性/审核可能失效：清楚展示已变化并要求核对，不能静默替换为新 ref、泄露已失权摘要或自动改任务状态。若无法验证旧 revision 的当前读取权限，限制展示而非降级到 current answers。
5. 真实 S08 页内添加正式来源选择、摘要、解除和回链，保留原任务列表、分页、请求回执、冲突与角色能力；T09/S09 的正式 route 和目标存在性经当前实现核验后再生成服务器允许的本地相对路径。现有 `formalUrl()` 只覆盖 S02/S07/S11，现有 S09 示例入口仍属演示；在固定版正式路由未可用时明确不可跳转，绝不跳到演示记录冒充回链。

## 验收与风险

- 单元及受保护全新合成 PG：同 scope 正例与跨租户/跨 Study/跨组、删被试、错 enrollment/visit/plan/protocol、错误 formVersion/assignment、伪 hash/旧版本/无 revision、撤权及同意限制；并发更正、转版、撤回与关联按共同锁序等待后重验；失败时任务、关联、审计与回执均无半写。
- 任务分页与游标不可跨身份/Study/筛选重放；重试同 key 同输入同 receipt，不同输入冲突，回执读取须当前权限；取消链接不删除来源或历史，历史来源不可读时只显示受限。保留原列表、分派、提交/验收、提醒及管理员/普通执行者/无权账号回归。
- 真实产品 scope 的 HTTP 和 S08 浏览器分别验证：可关联、解除、回链、撤权与版本变化；仅本机合成数据，保存截图/录屏与请求证据。正式任务提交/接受不得自动完成访视或答卷，固定 revision 更新不悄悄继承旧审核。T09 自身尚在实施，实际 route、source read 权限及 schema 以其最终实现和同事务测试为准；无真实终端/专业用户验收前，不标 T10 完成。

## 2026-11-12 · 最小后端与候选 DDL

新增独立 `formal-tasks.mjs` 产品事务适配，既有夹具 controller/commands 保留。Study 服务端 resolve 与 Task authority、原 `executeHubTaskCommandInTransaction`、操作回执和关联同一事务；本入口不继承夹具固定账号、数量上限或两项目，权限依当前账号/成员/Study 判定。列表和详情复用 task repository 的可见性；命令保留 CAS、本人同键同内容原回执、当前授权先于回执、审计及原任务核心。formal 证据只允许固定 `FormalResponseRef`，需独立来源读取权与当前同意/父链、hash 和当前修订验证；历史修订仍保留但作为完成证据必须明确重新核对。source 独立不可读时任务本身可读，关联和证据只返回受限提示。解绑 `none` 保留任务授权及 CAS。S09 当前路由参数 `formalCapture=1&studyId=...&visitId=...&assignmentId=...`，仅服务器校验 ID 后构造同源相对地址，不接受 URL 输入；当前 UI 尚在实施，HTTP/UI 尚未验。

现 `rh_study_tasks.context` 已有 `context_kind_check`，只扩入 `formal_response_ref`：原 source_id=responseId、parent_id=assignmentId、root_id=visitId、source_version=revisionNo、source_hash=contentHash 精确承载四字段及访视，不新增答卷/任务事实。原 `context_check` 非 none 的非空和 hash 约束不变，应用层强制 revisionNo>0；`StudyTask.evidenceRefs` 为现有 JSON，不新增列。仅生成候选 forward/rollback、不自动执行；forward 两条 ALTER 同事务；rollback `row_security=off`、独占锁并全局检查无该类引用，否则拒绝，不删历史。保持原 FORCE RLS/ACL/guard；父链与读取/撤权校验不能交给该 CHECK。

锁次序：授权→project→所有涉及 protocol→按 subject 顺序→enrollment/visit→task→关联/receipt；为避免旧任务绑定不同被试与新来源交叉锁，本期 attach/完成证据只允许最多一个正式来源，且已有任务的正式父链须与来源同被试，否则明确拒绝；非正式原任务仍可关联。在 receipt 重放前再次验证当前任务权限与来源可读，不用旧 receipt 授权。正式来源只可来自已发布表单与固定访视要求；`readFormalResponseRevisionInTransaction` 复算 hash，`readFormalResponseInTransaction` 验证同意及当前 ref。真实 PG 测试须证明对应锁等待及失败无半写。

### 旧任务入口防绕过

旧公开 `updateTask` 不接受 `formal_response_ref`、formal response type 或伪装成正式引用的字段组合，继续兼容普通 artifact；无客户端信任标记。共用事务核心在拿任务锁之前独立解析正式引用，调用实际当前答卷及不可变历史验证与固定要求，限制来源与原任务被试一致，完成和接受审阅均重新验证；adapter 先验不构成核心信任依据。此限定不把其他普通历史 evidence 自动升级。

### 当前实现与验证边界

候选 kind SQL 已由主循环仅在守门合成库事务应用；证据 `docs/testing/evidence/research-t10-2026-11-12/context-kind-migration.json`。独立适配 `server/study-tasks/formal-tasks.mjs` 和来源 `formal-task-source.mjs` 复用 Study resolver、既有 Task authority/事务核心；候选列表限定已选 subject，以维持来源锁顺序。独立事务核心 `formal-task-evidence.ts` 在旧 Task 同事务核心中重验，旧公开入口对正式引用/伪装拒绝。详情/回执重验来源，修订变化显示 changed、不能接受旧证据；读取受限时不交付旧摘要。

受保护合成PG回滚覆盖实际关联/解除、来源列表、固定证据、任务状态、提醒限流、真实回执/撤权/撤回、修订变化、旧入口伪装拒绝以及核心直调正反例，`researchhub/.tmp/t10-formal-tasks-tests.tap`；真实受限应用角色双连接竞争的阻塞PID、双方顺序及无半写见 `docs/testing/evidence/research-t10-2026-11-12/formal-tasks-concurrency-pg.json`。Study resolver 在上述 PG fixture 是替身；还需真实 Hub HTTP 和逐页浏览器。旧 `study-task-transaction.spec` 父对象不合法断言已按共享锁更早返回的 PROTOCOL_BINDING_CHANGED 定点更新；该组及新证据解析共13项通过，保留先前失败。无临床、生产、全链宣称。

### S08 来源可读投影与回执恢复增量

正式任务来源、选项和详情在当前授权事务中由真实被试、访视计划及固定表单版本所属模板投影 `subjectCode`、`visitName`，答卷来源另含 `formTitle` 与 `revisionNo`；不输出答案或联系方式。原固定引用及版本继续用于验证和回链。来源不可读时仍只返回 restricted。

正式命令和已授权的回执读取在响应层保留 `operationId`、`taskId`、`version` 并追加 `receipt: {requestKey, action: "task." + action, targetId: taskId, studyId}`；重放与首次响应一致。数据库 operation.receipt 仍仅保存原三个字段，旧夹具接口和约束不变。回执不替代当前权限和来源校验，客户端恢复后应读取当前详情。
