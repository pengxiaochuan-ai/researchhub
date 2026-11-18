# T06 建档、筛选、同意与入组实施契约

## 2026-11-17 · WF04原生CAS、严格证明与集中意图增量

本节为同一T06接口的WF04最小增量；不新增复合API/DDL/权限，不改旧TS核心。下方2026-11-12阶段记录保留，当前同页恢复行为以本节与[WF04报告](../../testing/study-workflow-wf04-2026-11-17.md)为准；本机核心链已实测，390新鲜页/三点命中/侧栏right=0只读补证已过且保留原过渡遮挡失败图，产品/Shell未改；已完成（本机合成；文档同步记录见最终清单），不称临床/生产通过。

- 原events/enroll成功仍200，可选body expectedLastEventId:null|id参与原canonical hash；新集中记录/确认入组必传，旧无字段保持兼容。在原授权和project→protocol→subject→enrollment锁内，saved原key优先返回；未成功新写才将固定基准与当前Protocol/Policy最后事件比较，不同409 PARTICIPATION_CHANGED。fresh GET不能自动把他人新事实绑定为本意图。
- 新receipt含proofVersion1、DB当前actorId/authVersion（0合法）、Study/Subject/Protocol、policyVersionId/hash、action/target/key/requestHash；record另核实际eventId/sequence/kind及recordedBy，enroll核原snapshot的Subject/Protocol/status和有效enrollment ID。GET原participation receipt可带action=record|enroll及requestHash；缺失404仍未知，hash冲突409，旧弱证明不升级。历史读取不要求当前仍有executing方案；严格原proof与当前canonical事实分开。
- 具名集中意图只持久化明确提交的必要待发内容，sessionStorage原createdAt起15分钟，账号/version/Study/Subject/URL隔离；临时网络availability不是identity变化。到期scrub所有待发正文并保原opaque key/hash/action/目标/政策，不重构原body、不以新key补写。原已提交scoped内容不会因quiet恢复或子步骤成功续期；未提交普通draft只内存。
- 每一POST前先保原key/hash；await SHA后、紧邻request再核固定TTL、原pending对象与body/key/hash/内容和当前scope。过期只保opaque不可POST；timer已转tombstone不能再次expire旧p或forget未知标记。两类真实200丢响应已用原GET核回，继续剩余项和最终enroll均明确办理；同页旧“核对上次操作结果”也是GET。
- 共同日期/签署主体填一次，三个决定/依据各自确认，不默认同意；本机正常三项保存+明确入组主动作4→2，不包含填写/建档/恢复点击。已有记录回看，单项更正、撤回、退出及其站内确认保留。筛选机制仅精确manual或原批准不适用，不能解释自由文本。

实际本机UI 3建档/7事件/2入组，12raw proofs/24本项业务审计；原生生成2anchor/4planned访视/16missing fulfillment/2open fallback任务，零分配/启动/答案。v1 SCREENING_METHOD_UNSUPPORTED真实409失败与V1两P2三RED不覆盖，六项v2真实PG回滚外0残留；旧13Subject及历史/源/固定policy/权限/科学/Word/休眠集合保护。[完整证据与保留项](../../testing/study-workflow-wf04-2026-11-17.md)。

## 2026-11-12 当前验收状态

T06本机通用合成软件四层通过：真实PG、HTTP、S03/S04及真实回执200/404恢复均有据。临床、生产和后续采集/处理/分析/导出撤回全链仍未验收；下方阶段性未接线表述为历史。详见 [证据台账](../../testing/research-t05-t06-2026-11-12.md)。

详情中的访视标题与顺序从本研究精确 scope 的 VisitPlan 读取，并逐行核对原访视的 protocolVersionId；保留原版及取消访视，不从 ID 推测名称，也不读取其他研究标题。计划缺失或版本父链不匹配时明确拒绝交付该详情并提示核对关联。

Hub `GET /auth/me` 增加经过当前会话数据库校验的 `authVersion` 整数，供待发命令与认证版本绑定；它是非秘密元数据，不是授权凭证，也不改旧 AuthService、登录期限或权限校验。T06 单 tab 待发恢复仅暂存必要原请求，15分钟上限，绑定 actor/authVersion/Study/Subject；成功、失权或身份变化清除，不写 localStorage、令牌、人口学及原始数据。普通未提交草稿仅内存；过期与原结果未知不被冒称为失败，成功回执后必须 GET 当前事实。

被试入口为 `GET /research-studies/:id/subjects?query=&limit=&cursor=`、`POST /research-studies/:id/subjects`（仅 `{requestKey,subjectId}`）、`GET /research-studies/:id/subjects/:subjectId`。列表按假名编号检索并返回对象 ID；概况路径使用该 ID，与参与事实入口一致，页面展示假名编号。列表与概况只返回当前研究正式、未删除的假名编号及安全状态，分页最多 100；建档不填人口学、组别或入组事实。研究者访问需有效课题组角色的 subjects 菜单和当前项目成员资格，建档还需 subject.create；租户管理员按 ADR-0006 获取本租户业务权限，Hub owner 不自动获得按钮权限。研究父链、启用状态及当前权限在同一授权事务重验；建档、审计和 actor 绑定回执同事务提交，同键跨研究或不同内容冲突。编号规则沿用旧入口和当前数据库唯一约束；旧入口改为调用相同事务核心。

状态：实施中；本文件不代表目标环境启用或业务验收。T05历史转版已有真实HTTP证据，浏览器闭环仍待验。

## 边界与事实

沿用 Subject、StudyEnrollment、StudyEnrollmentAnchor、SubjectVisit 和 StudyTask；建档本身不入组。增加公共 canonical `StudyParticipationEvent`，按被试、方案和批准政策版本记录不可变筛选、研究同意、数据用途同意、撤回和退出事实；事件存有效日期、录入账号、签署/授权主体描述、依据及原因，绝不把录入账号称作签署人。Subject.consentScope 与 ParticipantConsent 均不能替代这些事实；旧事实缺证据为未知，禁止批量推断。

首期筛选仅接受人工合格/不合格决定并要求依据、责任人与日期；研究及数据用途同意须人工记录有效文本版本/范围、签署主体和证据。仅在相应已批准政策明确 `not_applicable` 且有理由、来源及决定责任时可记录不适用；不可由客户端宣称豁免或从自由文本推断临床规则。政策要求未知机器机制时阻断，真实规则和材料由研究团队提供。撤回/退出保留历史且理由必填；退出不等于撤回特定用途。

## 授权、原子性及版本

同一 scoped 授权事务中重新核验 account、authVersion、租户、活跃组/项目、study_operations、workbench + study.execute（租户管理员按 ADR-0006），核对真实 subject 父链。Hub owner 配置权本身不授执行权限。当前仅支持 study_wide；任何 site 指定均拒绝，不声称多中心、随机化或盲态机制已实现。遵循授权、项目、方案、subject 的固定锁顺序，检查当前 executing protocol 与固定 approved policy/hash 和当前事实；提交、状态、入组、锚点、访视、要求、初始任务、审计与回执同事务提交。唯一入组及锁防重复；外部事件变更与入组串行。缺锚点访视 pending_anchor；既有历史不改。

事实必须固定协议版本与 policyVersionId/hash，且不可用旧版事实自动满足新版。事件记录和入组前重新核验当前权限和版本；有效事实的最新事件按服务端顺序读取，撤回/退出不可被较早的同意覆盖。不得用客户端 metadata、角色、scope 或假造的同意值绕过。失败完整回滚，重试需要稳定 request key 和现有 receipt 机制。任何历史转版须另经预览和明确执行。

## 验证与未完成事项

单元覆盖缺项、筛选失败、同意缺失/撤回、重复及跨 scope/site；受保护合成库用全新 fixture 验证成功生成、缺锚点、竞争和回滚。不得执行 migration deploy/db push；生成的 migration 交主线程预审。S03/S04、真实 HTTP、真实浏览器及专业用户业务验收待主线程完成；不得因单元/PG 通过将 T06 标记完成。后续答卷、触达、处理、分析和导出必须消费当前用途状态；在各链路未验证前不得宣称撤回全链已生效。

## 当前实施状态（2026-11-12）

独立事务事实服务和筛选/同意门禁已编写，入组核心与 Hub 路由尚未接线；经审查的最终单份SQL已在受控合成库执行，参与事件PG九项通过；这不等于入组接线或全链验收。当前已入组后的撤回和退出命令明确拒绝，直到入组状态投影及相应采集/处理守门能够同事务落实；因此尚不能宣称撤回生效。筛选政策仅支持 `decisionMethod: "manual"` 这一精确结构值，其他自由文本不会被解释为可执行规则。上述状态不代表 T06 已完成。

2026-11-12 恢复执行：首份 SQL 在指定合成库事务断言发现 owner 默认 ACL 自动授予应用 UPDATE/DELETE 后完整回滚，旧 hash `afaa99a…` 未应用。补显式 REVOKE 后独立预审批准 canonical SQL SHA-256 `5bbaf33225b366f690eb3e9ba484f3074ca6b999376964150342fd4b11643e47`，仅允许以 fixture guard 在 `wp01_test_full_baseline` 执行该单份 SQL；不使用 deploy/db push、不改 Prisma 历史、不修改既有业务行。执行脚本须验证 RLS、最小 SELECT/INSERT 授权、旧表前后指纹并留凭据。尚未接入入组前不得称 T06 已启用。T05 转版需把相关参与事实计入已有证据阻断，不能复制旧版同意或默认满足新版。

## 事实命令与并发（续）

事实读取与写入均在当前授权事务取得 project → protocol → subject → enrollment 行锁；锁后重新读取 subject、enrollment、方案及固定政策，并确认版本和状态。它们与 T05 转版共享 subject/enrollment 锁，转版会扫描这些事实并阻断已存在参与证据的候选；不能仅依赖预览时的快照。事实命令绑定 requestKey 和请求内容，重复相同请求返回原回执，不同内容复用 key 返回冲突；权限须在回放时重新校验。

研究同意撤回和退出是独立事实，按已确认撤回政策及实际状态更新参与投影；数据用途撤回不得伪装为退出或自动删除历史。所有受影响的新采集、邀请、在途处理和发布必须在同一共同锁后检查现行限制；在这些必要守门未实际接通并验证之前，不能只写事实后向用户宣称撤回已生效。缺历史事实时保持未知；不得为了给旧入组放行而虚构已同意。

单元测试覆盖正式访视开始和人工采集事实的锁后检查，合成 PG 覆盖正式访视开始和表单写入的竞争。实际在途访视开始与表单保存等待用途撤回提交后均被拒绝且无新写入；历史审核与普通任务不由此一概禁止。H5 撤销样例使用测试 feature 替身与预建令牌，不代表真实渠道已发送或业务验收。

Hub 参与状态读取返回方案标题与版本、已批准政策的必要 sections，以及服务端按当前权限、入组状态、政策机制与已有事实派生的动作能力和禁用原因。未入组且筛选方法为明确 `manual` 或已批准不适用时允许记录筛选；入组后不能改筛选。研究/数据用途同意仅在相应政策可支持且参与未结束时可记录；仅对当前已授予的同意展示撤回动作；退出仅对活动入组开放。动作仍在命令事务复核，能力不是授权令牌。回执重放后读取最新状态，不能用旧回执覆盖之后的撤回。

两条现有量表录入服务均要求活动入组及对应政策的有效筛选/同意事实；建档、原始资料归档未因此附加入组条件。合成数据库已直接调用两条量表服务验证有效事实可录入、无入组和数据用途撤回均不创建结果；证据 `docs/testing/evidence/research-t06-2026-11-12/scales-pg.json`。这不代表量表临床验证、浏览器验收或其他数据处理入口已受同一门禁保护。
# 结果未知的到期恢复补充（2026-11-12）

本地待发正文最多保存15分钟；到期只删除正文，不把时间经过解释为服务端失败。保留绑定当前账号/认证版本、Study/Subject、动作和原请求键的最小未知标记，持续禁止新写，刷新亦不解除。新增只读 `GET /research-studies/:id/subjects/receipts/:requestKey` 与 `GET /research-studies/:id/subjects/:subjectId/participation/receipts/:requestKey`，先按当前身份、Study和相应建档/执行权限重验，再仅查本人原作用域动作回执；无记录404仍保持未知，不自动以新键重发。已确认结果后读回当前业务状态，再允许下一项操作；身份变化或失权清除旧资料。

历史回执读取只要求当前身份/功能/动作权限及准确Subject父链，不要求当下仍存在可执行方案或政策；方案归档不应阻断本人对已提交历史结果的只读确认。参与事实的新写及重放仍执行原当前政策与状态守门。

