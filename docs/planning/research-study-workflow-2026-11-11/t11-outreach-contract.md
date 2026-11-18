# T11–T12 · 正式 H5 外联和真实邮件契约

沿用正式 FormAssignment、FormResponseRevision、Participant、加密 ParticipantContact、ParticipantConsent、QuestionnaireInvitation/Session、MessageDelivery 与 actor-bound Study operation receipt，不新增平行答卷。调用者的研究事务按当前 Study、账号、授权、项目、功能和父链重新验证；H5 受限令牌只绑定一个 assignment，不取得研究账号或后台权限。自填须由已发布表单的结构化配置明确允许 patient_h5；他评或未明确授权方式 fail closed，不能从表单标题或自由文本推断。固定访视/方案/表单/入组和当前研究参与同意须有效，pending_anchor、已完成/已提交、撤回、失权或错父链拒绝。邮件目的 `questionnaire_h5` 另需 email 渠道当前同意；此同意不替代研究同意。

接口拟由 Hub 装配 `createOutreachService({studies,core,receipts,mailer})`，Study resolver 提供已授权事务及真实 scope；核心 `prepareInTransaction(tx,user,scope,{visitId,formVersionId,participantId,requestKey})` 加锁后读取并写正式 patient_h5 assignment、邀请及 queued delivery；联系方式仅用已有 AES-GCM envelope，加密值及查找哈希存表，原地址和 token 不进入 receipt、审计、日志或结果列表。对应渠道同意和联系方式必须由明确的录入命令在授权事务中记录，绝不自动猜测用户意愿。

邮件发送不能与数据库提交构成单一原子操作：先以稳定请求键和哈希记录意图，先提交发送尝试的不可重复 claim，再按一致锁序重验身份、作用域、访视、受限邀请、研究与渠道同意后调用 SMTP；一旦 claim 已提交即禁止同 key 自动重发。无论调用中断、进程崩溃或响应超时，无法证明发送结果时保留 `queued` 且非敏感标记 `attempt_unknown`，提供只读状态核对和人工明确后续选择，不伪造失败/成功；明确 SMTP 拒绝才可记 failed，服务器接受使用 sent 并标注 provider accepted，不宣称送达。网络操作与数据库持锁的具体边界必须保证撤回不会在最后检查后与发送竞争；提交失败不回滚既已接受的外部发送，更不能由重试重发。随机邀请原 token 只在同一次实际发送的私有消息内使用，不持久化原文或放到 operation result。接收者、链接与 SMTP 认证不得出现在 audit、异常、日志或测试报告中。仅从 env.prod 读取批准的 SMTP_HOST/PORT/FROM/USER/PASS 五键，重用 smtp-config，通信采用 TLS，不能完整载入输出私有配置。

单次兑换令牌后建立有限生命周期会话，重新校验同意、失效、邀请及父链；提交与现场共同 revision 核心，同键请求在当前同意仍有效时重放；撤销/过期/失权立即拒绝读取和写入。状态展示区分已准备、发送结果未知、服务商已接受、明确失败、问卷已提交，SMTP accepted 不等于 delivered。提醒不自动触发，已撤回、过期、已完成均不得触达。

数据库现状：`participant_contact_channel_check` 仅允许 sms_sandbox/wecom_sandbox；若要使用真实 email，必须追加 `email` 的 canonical 迁移并独立审核。`message_delivery` 状态仅 queued/sent/failed，尝试未知用 queued + `attempt_unknown`；delivery `failureReason` 不得存 provider 原始错误或个人信息。既有唯一键及约束不能单独证明请求去重，需 actor-bound operation + 事务锁；不回填既有数据。候选迁移未经审查不得执行。

验收分层：单元测试验证内容/限频/幂等/授权和错误状态；保护库合成样例验证实际父链、同意、事务、并发 claim 和故障回滚；目标环境真实 SMTP 仅由主线程对已授权测试收件人执行一次并留非敏感状态证据；真实 H5 回收及界面另验，不以 mock 成功或 provider accepted 充当送达/完成。

实施增量：固定 `VisitRequirement.config.allowedCaptureModes` 是完整允许集合，缺省仅 researcher，显式只含 patient_h5 时现场新分配与新 draft/submit 均禁止；已提交答卷的更正继续独立授权。Hub H5 新分配必须是固定访视且显式 patient_h5。`createOutreachService` 的 `send(user,studyId,visitId,{requestKey,formVersionId,address,emailConsentConfirmed:true})` 同一事务记录人工确认的渠道许可、加密联系方式、绑定分配与不可重试尝试并写 actor-bound receipt；`receipt(user,studyId,visitId,requestKey)` 恢复当前非敏感状态，不恢复 token 或重发。当前地址变更/多联系方式明确拒绝待人工核对，不自动覆盖。

发送事务重验后，以自带 AbortSignal 的 `createStudyMailer` 关闭超时连接；准备发送距发起第二事务最多六秒，网络最多五秒，超时保守 unknown。受保护合成 PG 已验证自填/现场模式、参与及渠道同意、一次兑换与正式提交、撤回前后竞态、同键双事务仅一次模拟 provider 调用及非敏感回执；该模拟不构成真实 SMTP 接受或实际送达，真实渠道与页面验收由主线程后续执行。

发送能力仅存在于首次准备事务产生的进程内不可序列化对象；它在任何异步等待前同步消费，原 token 仅由核心直接交给本次安全发送回调，不交给 Hub、持久回执或状态接口。同一 capability 并发重入、unknown 或事务回滚后重入均拒绝；进程重启不能从数据库重建它。准备意图一旦提交，即使进程中断也只显示结果未知，不自动重发。

Hub 本期 H5 新分配及邮件邀请要求绑定已配置自填的固定访视。旧 API 的无访视 H5 及其已有会话保持兼容，但仍须真实入组父链、当前研究及渠道同意、会话时效和共同修订门禁；已绑定访视的 H5 每次重验自填配置与锚点。旧无访视研究者现场填写保持兼容。非敏感发送回执可在渠道撤回后读取，但必须核对未删除主体以及同 scope 的入组、访视和 VisitPlan 的协议父链。生产配置流式读取并仅保留五个 SMTP 白名单行，忽略其他变量多行值中的伪键；SMTP 变量跨行明确拒绝，密码值不记录或返回。

渠道许可沿用既有当前状态不变量：同 scope、participant、purpose、channel 的 granted 由 `participant_consent_current_key` 限制唯一；撤回修改该 granted 为 withdrawn，后续重新许可才创建新的 granted。不得用时间排序或历史 withdrawn 推断替代当前 granted；正式写入口在授权锁下重验。

匿名 H5 接口装配契约（由主线程挂载，Public 仅跳过后台账号 guard，不创建研究账号）：`POST /api/questionnaire-h5/session` 的 JSON `{token}` 一次兑换；服务端设置仅限 `/api/questionnaire-h5`、HttpOnly、SameSite=Strict 的短时 session cookie，响应不含令牌。`GET /session` 读取当前受限会话，`POST /session/draft|submit` 传 `{requestKey,expectedVersion,answers}`，`GET /session/receipts/:requestKey?operation=draft|submit` 只查该 session 自己的命令回执；所有写请求校验同源及 JSON，所有结果 no-store，地址/token 不进 URL 查询、审计或日志。服务端错误只返回安全状态，非预期异常不泄漏输入。Cookie 随会话过期，不依赖 localStorage，撤回与过期均先于回执查询检查。

本机演示适配器只由 fixture guard 开启，使用独立脚本构造真实 StudyOutreachService；在 elevated 事务中对 invitation/session 的初始 token lookup 加 tenant 白名单 fence，并在首次返回前拒绝 runtime.ids.tenant 之外的记录；feature 查询同样严格限制该 tenant。此 fence 是本机演示隔离，正式运行时应使用实际授权的受控 Prisma/部署 scope，不导入 fixture 配置。

同浏览器刷新及跨邀请切换：首次进入任何带邀请 token 的页面均 POST `/session`，不得先用现有 cookie GET 后直接展示。若 cookie 对应会话的邀请 token 哈希严格相同，`resumeH5` 在锁后复验当前会话、研究与渠道同意、功能和完整父链并返回该会话原状态，不重新兑换；不同 token 在读取旧答案前返回 `H5_INVITATION_MISMATCH`，控制器仅对该码、cookie 格式无效或会话不存在回退新 token 的一次兑换。相同邀请的会话撤销、过期、同意撤回、功能失效或父链错误直接拒绝，不以重新兑换掩盖；另一浏览器没有对应 cookie 仍不能重复兑换。

公共 H5 draft、submit、receipt 在原响应顶层追加 `{receipt:{requestKey,action:'h5.draft'|'h5.submit',targetId}}`，targetId 仅取服务端真实结果 assignmentId（或固定 ref 同一 assignmentId），不可使用客户端目标；旧服务的返回形状不变。前端以原键、动作、受限 assignment 验证回执，未知结果不得自动以新键重发。

本机挂载增量：19501 同源公开 H5 接入真实受限会话，后台邮件命令位于 `POST /research-studies/:id/visits/:visitId/email-invitations`；状态读为 `GET /research-studies/:id/email-invitations/:invitationId`，原键核对为 `GET /research-studies/:id/visits/:visitId/email-invitation-receipts/:requestKey`。发送结果及原键核对追加严格 receipt（requestKey、outreach.email、visitId、studyId）。SMTP 未配置时，新命令必须在登记联系方式、分配、邀请或发送意图之前明确 503；既有原键状态仍可读取，不重发。本机联系方式密钥由持久运行 secret 按专用用途 HMAC 派生，不读取其他生产凭证。仅对本机合成租户显式启用 participant_h5 并留配置证据，禁止全租户开启。邮件中的 loopback 地址须明确为本机合成测试，不能当成公网可用链接。

多标签页目标绑定：H5 Cookie 同浏览器共享，故公开 GET session 和 GET receipt 均须 expectedAssignmentId 查询参数；draft/submit 须同名 JSON 字段。核心在会话/授权/父链锁内先核验目标，错配409 H5_ASSIGNMENT_MISMATCH，既不返回其他问卷答案也不写入或查其回执。旧service调用的可选参数保持兼容；新公开controller强制指定。前端遇错配清空答案并从原邀请重新进入，不能仅在前端resume后假定Cookie不再变化。
