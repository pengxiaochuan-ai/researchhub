# T07–T09 正式答卷修订实施契约（候选，未部署）

以 T00 第6–7节、实施计划 T07–T09 和 M06 为准；继续使用公共 FormAssignment/FormResponse、现有访视要求和 DataQuery，不建立第二套 EDC。现场与 H5 的现存提交各自直接更新 FormResponse，按模板 key 的 fulfillment 回填也重复；当前已提交禁止修改，草稿仅以 status 做条件更新，两个窗口可互相覆盖。现 `numeric-sum-v1` 对没有任何可评分字段的问卷返回 total 0，不能当作有效分数。本候选不改变运行代码或已有数据。

## 状态、版本和固定来源

- 每 assignment 唯一 response，draft 有整型 `version`；每次保存按 expectedVersion CAS，旧 API 若未携带基准不得静默覆写正式草稿。首次正式提交创建 revision 1；更正必须显式命令、非空原因、预期 current ref、当前未锁、策略允许，创建后续不可变 revision，旧 submitted 普通写入仍拒绝。回执先验当前权限，再重放同 key 同内容；不同目标/内容冲突，任何失败全部回滚。
- `FormalResponseRef={responseId,assignmentId,revisionNo,contentHash}`。revision 锁定研究scope、assignment、发布formVersion、subject/enrollment/visit、规范化值、可空score及准确算法版本、来源、真实actor、前版、reason、差异和服务器时间；hash 对版本化 canonical JSON（明确数字/键序/Unicode及 null 规则）计算且复核；不得用 JSON 文本任意序列化充当跨运行时规范。零与 false 均为真实值；未填与未知、不适用、未测只能以明确且在发布字段契约支持的结构表示，不通过 null/空字符串臆测。以发布 `FormVersion.scoring.algorithm` 为规则真相；仅明确为 `numeric-sum-v1` 且字段适用时计算，scoring 缺失、未知算法或无评分字段明确未计分，不构造零分。当前两个调用只传 schema 而忽略 scoring，必须共同修正；旧 clone 对缺省 scoring 的默认 numeric-sum 属另一个可见兼容风险，不能将该默认推断成团队确认的临床规则。
- 旧 response.answers/score/status 是同事务当前投影，任何旧写入口都经共同核心，不能独立更新；旧已提交无 revision 标记 legacy_unversioned，不自动造历史。需纳入正式链的旧对象必须受控固化当时可核验值为 legacy_baseline，保留真实源提交时间与当前登记人/时间，不能补造原签署或同意。
- response 当前指针只能指向自己的 revision；数据库唯一响应修订号和不可变 revision 防止重复及篡改。应用重验每条父链、hash 和旧指针；fixture/nonformal 路径需明确隔离，不自动将不完整 parent 视为正式修订。

## 共同事务与锁

已授权事务：重验账号、权限、feature、当前方案和政策/同意；先取得 project → protocol 共享行锁，再按既有 `lockFormAssignment` 的 subject → enrollment → visit 次序及 T06 guard 取得锁，锁后重读绑定和状态，再锁 assignment → response；该顺序避免与 T05 project → protocol → subject 转版因外键取得锁而死锁，核对预期 version/ref 和锁状态。`writeFormalResponseInTransaction(tx, context, command)` 是复用旧服务内部共同核心的拟议签名，不接受客户端父链/actor。H5 使用当前受限 session，锁后重新检查 session/邀请、scope、当前同意及填写方式，不伪造研究账号；session 占用、修订、投影、要求与审计同事务。CSV 调同一核心且另满足导入权限，不单建事实源。

首次提交与更正均绑定固定版本 `FormalResponseRef` 到匹配访视要求；必须验证 assignment→subject/enrollment/visit→protocol→requirement 的真实父链和已发布 FormVersion，禁止仅凭 template key 满足可能不兼容的版本。更正更新当前要求引用、旧审阅不再适用；保留历史及关闭状态，不静默关闭 DataQuery。失效传播到质量基准/分析需与后续 T15/T16 集成，在未实现时不能宣称已传播。完成访视时重验当前 refs、要求、审阅政策和日程；更正已完成访视应标明依据待复核而不删除已完成历史。

## 审阅和锁定

Review 是固定 revision 的 append-only 审阅事件，记录 decision、实际 reviewer、政策版本、reason 和时间；当前有效审阅只来自仍指向当前 revision 的事件。锁/解锁是 append-only 事件且维护 response 级锁投影和 version CAS；解锁需 study.review + project_manager（租户管理员按 ADR-0006）、政策许可、原因及影响预览。自审和独立性由固定政策裁决，缺规则不得推断批准。后续访视/数据集锁应有独立明确对象，不能将此 response 锁冒充整个 Study。

## 数据库候选与验收

`schema-candidate.sql` 仅供审查，非迁移、不应用。先独立审核：数据库 owner 默认 ACL、真实 RLS 上下文、父链及触发器并发、Prisma 映射、回滚/旧应用兼容与版本部署时序；经批准后才进入唯一 Prisma 迁移链。不能对真实旧答卷回填、清除、部署或使用 db push。禁止自动用 fixture 开关绕正式授权。

验收需旧现场/H5、CSV 后续路径共同核心；多事务 CAS、过期权限/同意撤回、锁等待后版本改变、同键重试、故障回滚、错误父链/要求、双渠道竞争、修订更正与历史可见、审阅失效/锁/解锁、旧记录兼容；保存真实 PG 与 HTTP/浏览器证据。当前只建立候选与红测，不表示功能上线或业务通过。

最终独立预审发现回滚检查可能被 FORCE RLS 隐去记录，且检查与 DDL 之间可写入历史。回滚工件须在单一事务中设置 `row_security=off`（无 BYPASSRLS 的角色报错并拒绝，而非关闭表 RLS），先按固定顺序对 response、revision、review、receipt 取得 ACCESS EXCLUSIVE 锁，再全局核对所有新增表为空、响应基准为初值，才允许删除扩展结构。任何错误回滚整个事务；不自动执行回滚，不因此授权生产降级。


候选修订 hash 的 `formal-response-v1` envelope 使用下列固定键：`hashVersion`、scope（tenantId、studyGroupId、researchProjectId）、responseId、assignmentId、formVersionId、subjectId、enrollmentId、subjectVisitId（可空）、protocolVersionId、policyVersionId、policyHash、revisionNo、previousRevisionId（可空）、answers、score（可空）、scoreAlgorithm（可空）、source、actorKind、actorId（H5 使用服务端解析出的 session 数据库 ID，不存 token）、reason（可空）、changes、sourceSubmittedAt（可空）、createdAt（UTC ISO 字符串）。值必须为 JSON（数值有限、数组不允许稀疏或 undefined），对象 key 按 ECMAScript UTF-16 排序，UTF-8 输出且不做 Unicode 归一化；保存前计算 SHA-256。具体计分仅从已发布 FormVersion.scoring 读取。

account 与 H5 session 共享最小命令回执表，真实 actor 由服务端推导；存 scope、requestKey、requestHash、action、assignmentId、结果，不存原始 token。先重验当前账号或受限 session、同意及范围再读回执；已提交的相同 session 请求可以重放，但撤销或过期会话拒绝。历史未绑定 draft 只有在锁后确认同一受试者的现行正式入组才能显式绑定，已提交旧记录保持 legacy_unversioned。

审阅策略只消费现已结构化、可验证的 `reviewIndependence`，禁止解释 locking/unlocking/correction 自由文本为可执行规则；执行版本化通用审阅、理由、锁定与有权解锁不变量，真实额外临床规则仍须团队明确配置。已发布 numeric-sum-v1 无明确缺失规则时，任何计分数值字段缺失均不生成完整总分，0 和 false 仍是实际值。

## Hub 事务适配入口（实现中，尚未运行时启用）

Hub沿统一Study解析的同一事务，将服务端scope/当前principal交给旧核心 `writeAnswersInTransaction` 与 `reviewFormalResponseInTransaction`，不在适配器复制权限、评分或修订规则，不调用另一个forTenant事务。`POST /research-studies/:id/assignments/:assignmentId/draft|submit|correct` 输入requestKey、expectedVersion（允许初值0）、answers，更正另需expectedRef及reason；`.../review` 输入同一基准、expectedRef及decision=approved/returned，退回需原因；`.../lock|unlock` 绑定同一fixed ref，解锁需原因。客户端不得传tenant/group/project/actor或内部revision ID。响应包装Study与原核心结果及原请求键，成功仍回读当前projection，旧回执不冒称当前状态。

正式列表、详情、访视分配及当前授权后的原键只读确认将在对应旧核心安全封装稳定后接入；全部保持不含凭证、父链固定、失权清空和未知结果不自动新键重发。此接口段是交接契约，不是已启用结论。

### 正式答卷的浏览器保留边界

本轮决定：答卷正文与未发送草稿仅在页面内存中，主动暂存进入既有服务端草稿；不将答卷写入sessionStorage/localStorage。发送前仅在单标签sessionStorage写入不含答案/凭证的actor、认证版本、Study、Visit/Assignment、操作与原请求键未知标记。相同页面内存可在15分钟内经当前身份核验后显式同键同正文重试；正文到期或页面刷新后只按原键GET核对，404仍保留未知禁写。不得声称刷新后还能重放未保留的正文；未保存输入离开/刷新继续防丢失提示。这样满足已授权暂存、刷新继续已保存草稿和结果未知恢复，同时减少浏览器持久答卷数据。

访视读取为 `GET /research-studies/:id/visits?subjectId=&limit=&cursor=` 和 `GET .../visits/:visitId`，复用同事务旧核心的当前read权限及父链/完成完整性投影。游标绑定当前账号、认证版本、租户、Study和Subject筛选；不返回答卷正文。保留历史metadata可读与当前采集/完成能力分离，前端只消费实际返回的能力，不从单个状态或管理员标签推断。

访视执行只开放 `POST .../visits/:visitId/start|complete|reverify`，不以通用PATCH任意状态绕过完成条件。开始复用study.execute与当前参与/锚点守门，完成及重新核对复用study.review管理权限、固定来源/当前审阅与锁；输入均带requestKey与expectedVersion，重新核对必须原因。Hub在同一事务保存命令回执/审计，`GET .../visits/:visitId/receipts/:requestKey?operation=`仅在当前相应角色与准确父链验证后确认原结果。回执不取代最新GET，也不伪造已完成历史的时间或旧引用。

T05 兼容：启用新方案不迁移旧入组时，仍绑定已正式执行过且现为 `superseded` 的旧方案的入组可继续按旧固定 approved policy/hash、当前同意与真实父链采集；`executing` 及 `superseded` 外的 draft 等状态不可写。真实合成 PG 已覆盖新方案执行而旧入组保留、两渠道写入，以及指向 draft 时拒绝。

已完成访视更正不抹去完成时间或原 `evidenceRefs`。完成适用性由固定历史 refs 与当前修订比较：变更为 `requires_review`；授权复核验证当前要求、固定 ref、审阅与锁后追加当前 refs、写原因和审计，原refs与完成时间保留，状态恢复 `current`。旧无法证明版本的完成依据标 `legacy_unversioned`，不伪造历史。审阅事件按当前 response version 编码的序列化 event ID 排序，避免同毫秒时间相同导致先后顺序不确定；每个事件和 CAS 自增同事务。

H5 读取答案与保存、提交和回执重放使用同一当前授权检查：先序列化租户授权变更，再按 project → protocol → subject → enrollment → visit → invitation → session 加锁并重读；当前问卷渠道同意与固定研究政策所需参与同意均须有效。已提交会话允许同键恢复，但渠道或研究同意撤回后不得继续读取答案或回执。完成访视的历史元数据仍按独立只读权限展示。真实合成 PostgreSQL 双事务覆盖渠道撤回与保存两种先后顺序，以及两个并发正式写入请求的等待、旧版本拒绝和同键重放；证据位于 `docs/testing/evidence/research-t07-2026-11-12/`。这些是代码与数据库验证，目标运行环境 HTTP/界面验收另行记录。

T08 旧疑问接口兼容边界：原自由 JSON 创建和直接关闭不具备固定修订、版本 CAS 与审阅日志；识别到正式答卷 rule、修订引用或正式疑问日志时拒绝并要求使用正式疑问命令。普通旧疑问继续原路径。受保护合成 PostgreSQL 验证正式疑问旧创建/裸关闭均拒绝、状态保持，以及普通旧疑问创建和关闭；正式命令的权限、固定历史引用、CAS 和回执继续由共同核心验证。此证据不代替真实 HTTP 与页面验收。

访视完成依据仅从必需要求收集；可选表单的修订仍保留在其 fulfillment 和历史中，不因完成而被提升为必需审阅或锁定。完成完整性仅比较实际必需表单的固定版本，其他传入或历史可选表单引用不影响该状态；无法证明的必需旧依据仍标记 `legacy_unversioned`。合成 PostgreSQL 覆盖可选表单提交及完成后更正、可选新旧引用、必需旧引用与 archived/draft 访视操作拒绝；superseded 旧入组按固定政策继续执行。
