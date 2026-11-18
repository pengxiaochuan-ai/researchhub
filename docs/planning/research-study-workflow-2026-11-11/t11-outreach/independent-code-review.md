# T11/T12 触达与 H5 独立源码窄审

状态：复核进行中，尚未形成最终冻结结论；不执行邮件发送、SMTP连接、DDL或运行时重载。检查 `formal-outreach.ts`/policy、`study-outreach.service.ts`、`research-capture/outreach.mjs`、`delivery.mjs`、`smtp-config.mjs`；文件仍由实现者修改，最终 hash 和真实PG复验待固定。

现有正向边界：Hub 以当前 Study 事务做请求键串行化、收件/同意断言、固定访视和允许的 H5 配置、准备邀请及最小回执；准备事务提交后才由持有瞬时凭证的请求发起一次 SMTP，重放只读状态。渠道同意单独记录，不冒充研究/数据用途同意；访问和发送调用当前正式授权/参与事实和锁。session 邀请兑换使用 token hash 与 CAS，回执和审计不返回邮箱/token；邮件错误统一 unknown，不自动重发。研究/渠道撤回与发送使用租户授权锁，实测是否完全覆盖以最终真实双事务证据为准。

待修／待验证：

1. `sendEmailInvitationInTransaction` 当前 queued/attempt_unknown 没有独立、不可重复消费的核心 claim，同一 transient token 内部重入且先前 unknown/事务失败时仍可再调发送；Hub普通同键路径只持有一次token并不足以证明内部入口不可重入。实现者确认采用不可序列化进程内一次性 capability，修复后需并发调用与 unknown/失败后重调真实PG证据。
2. `readStudyMailConfig` 当前 `readFileSync` 整个配置并 `parseEnv` 全文，违反本任务禁止全量加载 env.prod；已要求仅流式读取 SMTP 白名单、保留重复键验证且不输出秘密。本审查没有读取配置内容。
3. H5 兑换检查填写模式，但 session get/save 路径需确认锁后持续重验当前访视 H5 配置与时点；历史读取例外不能自动成为新采集授权。
4. 邀请元数据回读允许撤回后读取非敏感回执，但仍应核 Subject 未软删及 Enrollment/Visit/Protocol 的真实父链，不能借 Study 权限读取跨链对象。实现者正在核实。

本报告并非 SMTP 发送、H5 UI、真实临床/生产或四层验收。后续仅核对冻结源码、测试、目标环境和实际获授权请求的分层证据。

## 最终冻结窄审（2026-11-12）

本轮范围内未见未解决的阻断项；不等同于真实邮件送达或业务验收。修订核对：一次性 capability 仅进程内 WeakMap 持有原 token，首次调用在 await 前消费，重复/unknown/回滚后不可再调用；Hub 先提交准备及最小回执、再开启发送事务，错误与不确定状态不自动重发。该内部核心仍依赖组装调用方遵守“准备事务提交后才发送”的顺序，不声称任何误用都被数据库拦截。SMTP 配置改为流式选白名单，测试覆盖多行伪键和重复键；未读取真实凭据。渠道授权沿用原数据库同 scope/purpose/channel 唯一 granted，旧服务撤回修改有效行、显式重新授权才新建，不将历史时间猜成新规则。

按主循环确认的兼容边界，既有无访视 H5 保留；已绑定访视的兑换、session读取和提交持续核查固定模式/时点以及当前参与与渠道同意。Hub新邮箱流程仍强制固定访视和明确 patient_h5 模式。邀请回执只读元数据、允许渠道撤回后读取，但校验未删被试、入组/访视/VisitPlan/方案父链；真实发送/回收及浏览器/临床/生产验收另计。

最终源码 SHA256：formal-outreach `107967b5c16f1129071151f0c363753d7a4dfe7197c3a0e2846ec3973bdf8fe2`；formal-outreach-policy `a5cb4e9091b20e09e62577bdb512886cba9155eea91d31613ba5563fef3f77c8`；study-outreach.service `f3bb0e90b2e3c83a81980ae5078d69a5ddfd1476132a58ce5bb19d893f96ccff`；formal-response-writer `7a9c55e4864a4df269a873d7959518128a81754df2b499450a9b0f40a31967ea`；formal-response-query `9e5157a863fd2b95fd7983a79ce0104cf16a203d1dfd97841315a5b9a88dd306`；formal-response-assignment `05d5172ea10b83c1457028bf010bf407e62f224b87a03e1947a29a74aab4666f`；study-forms.service `bd86149e8bb53385bfc5419c6c30668c4e5bc807b41f7b9c831dcc0283b7e84c`；Hub outreach `ae03e5f014752269018d9353ff304ca6b80817586f8660a34ba4e73422d77f02`；delivery `42d031599503fda2f3e16bf7ab9ed35fdb283716bf51c2db128158c2a97521a5`；smtp-config `27f419a2932c89acd6fae56bf5c827534d7260f0710d1107147ccca0f1dd4897`。

独立重跑 `node --test server/research-capture/outreach-pg.test.mjs server/research-capture/outreach-race-pg.test.mjs server/research-capture/outreach.test.mjs server/research-capture/delivery.test.mjs server/research-capture/smtp-config.test.mjs` 12/12 通过，输出 `researchhub/.tmp/t11-t12-independent-review.tap`；其中真实PG使用新合成 fixture，mailer为测试替身，没有实际邮件或 SMTP 凭据。实现者最新隔离编译及16/16、32/32证据分别为 `outreach-core-pg-and-unit.tap`、`outreach-legacy-regression.tap`。先前问题和失败记录保留。

## T11 公共 H5 接口增量独审（2026-11-12）

冻结哈希：`h5-controller.mjs` SHA256 `4fa2b901ff42275a1670133111a1c88d40342a04a9001d09f4e459998bcee10a`；`local-h5-outreach.mjs` `c48d204ec3e4f18133a5a531b15a4007b100ec6f7c553014d606373e14a140b7`；`study-outreach.service.ts` `60a03040a1abad659b9000e343ce28cafa104417a83b38bf66dbe886201dee84`。公共路由通过 Nest `isPublic` 标记，不派发后台账号；写操作验证同源JSON，session cookie HttpOnly/Strict/限定路径，重复cookie拒绝；session、receipt 每次从服务端记录重验精确 scope、actor session、渠道与参与同意。现场无visit旧session保留既有兼容；新Hub准备路径仍严格固定visit/mode。本地代理将首次 invitation/session 唯一查询限制于指定租户；本机独立复跑 `researchhub/.tmp/t11-h5-independent-review.tap` 5/5，覆盖跨租户初查单元、公共cookie/同源及真实PG同意撤回竞争与receipt。未读取SMTP/发送/重载，未做目标HTTP/浏览器。

待处理配置风险：`createH5QuestionnaireController` 仅验证 origin 格式，目前可能接受非本地明文 HTTP origin，并发送非Secure session cookie；本机loopback部署不受该配置影响，但未来错误公开部署会暴露会话。应限制为 HTTPS 或明确 loopback HTTP，且补单测；已通知主循环协调实现。该风险处理前本增量不作无阻断结论。


## T11 H5 公共 controller / resume / receipt 最终增量复核（2026-11-12）

**本追加结论优先于上方公共接口“待处理配置风险”快照：本轮指定增量无剩余 Critical / Important 阻断。** 只读核查当前 controller、StudyOutreachService 的 start/resume/get/save/receipt 及 local-h5-outreach 首次查找限制；没有扩大到 T14，没有改产品实现、读取 SMTP 配置、发信、DDL、重载或部署。T13 的后续实际 HTTP 是主循环另行记录，不混入本轮 T11 验证。

- 原非本地明文 HTTP 配置风险已关闭：`h5-controller.mjs:8–9` 仅允许 HTTPS 或明确 localhost/127.0.0.1/[::1] HTTP origin，且要求完整 origin 精确一致；HTTPS 强制 Secure，cookie 为 HttpOnly / SameSite=Strict / `/api/questionnaire-h5` 路径。读写均 no-store / no-referrer；写操作校验同源 JSON；不签发后台账号，不在响应正文返回 session bearer。独立配置反例及cookie单测通过。
- `h5-controller.mjs:17` 先尝试当前cookie与传入token的恢复，只有格式无效/不存在/邀请不匹配才尝试兑换；撤销、过期、当前同意/模式/功能失败直接返回，不通过fallback掩盖。同cookie同token恢复A，输入B不返回A的答案，改走B合法兑换。controller单测实际断言此分支；真实PG核验同token恢复和不同token拒绝。
- `study-outreach.service.ts:466–481` 初查session限定邀请父链与tokenHash，再进入当前授权/参与/模式/渠道守门及统一父链锁，锁后再次检查 invitationId 和精确tokenHash，才返回当前响应。锁顺序沿授权→project/protocol→subject/enrollment/visit→invitation→session；未增加反向锁。锁后tokenHash再验为本轮源码结论，未另冒称真实双事务token轮换测试。
- `:484–493` 的H5回执仅取当前scope、assignment、actorKind=h5_session、数据库session ID、requestKey及draft/submit action；当前撤销/过期、模式、参与与渠道同意先于读取。controller校验key/action，回执target来自服务端assignment；不接受请求自带actor或assignment。历史回执保持原操作结果，不能当最新答卷。
- `scripts/local-h5-outreach.mjs` 对最初 invitation/session findUnique 结果先做精确tenant限制，不匹配返回null；后续父链以该本机tenant来源执行，feature适配器同样限制tenant。实际PG中的foreign本机适配器对真实已存在邀请/会话分别报 INVITATION_NOT_FOUND / QUESTIONNAIRE_SESSION_NOT_FOUND。该代理依赖传入的direct已经是fixture-guarded runner，只用于本机合成验证，不当作生产多租户授权层。

独立执行 `node --test --test-concurrency=1 server/research-capture/h5-controller.test.mjs scripts/local-h5-outreach.test.mjs server/research-capture/outreach-pg.test.mjs` **7/7 通过**。证据：[h5-public-preflight-final.tap](../../../testing/evidence/research-t12-2026-11-12/h5-public-preflight-final.tap)。6项是controller/adapter单元，1项为受保护合成库实际PG；PG使用唯一合成fixture，整体回滚，验证同cookie来源的core恢复、换token拒绝、跨tenant拒绝、模式撤回、限定session回执与渠道撤回。PG事务包装/feature调用存在测试替身，mailer为本地函数替身；没有实际SMTP或邮件送达，不能将调用替身计为真实发送。

当前未执行本次public controller的实际HTTP挂载、浏览器cookie/刷新/换邀请/未知提交恢复；也未独立新跑token轮换、相同邀请双兑换的真实双事务竞争。本轮复用的旧PG附带发送capability反例仅作为测试背景，不重新扩大到发送验收或宣布T11/T12完成。

最终源码SHA-256（与主循环提供冻结值一致）：

| 文件 | SHA-256 |
|---|---|
| server/research-capture/h5-controller.mjs | `a1f1607fd661558907cf0023cdd0872a5701ca21df7692f1619487a717405e34` |
| ../app/server/src/study-operations/study-outreach.service.ts | `50dcf602ec658a740b4897ad3403742aba5da0cb7d0426955da0422355fe4d50` |
| scripts/local-h5-outreach.mjs | `c48d204ec3e4f18133a5a531b15a4007b100ec6f7c553014d606373e14a140b7` |

建议下一项：主循环挂载后验证公共H5的同cookie恢复、换邀请不串答卷、撤回拒绝及未知提交回执恢复，再做真实浏览器；本审查不代签真实发送或业务验收。

## T11 跨标签目标绑定及发送不可用增量复核（2026-11-12）

本次增量未见剩余 Critical / Important 阻断。只审公共 controller、StudyOutreachService 的 expectedAssignmentId 增量、safe invitation 展示和 controller 装配、无 mailer 时的发送前拒绝；没有实现产品、DDL、重载、SMTP 或实际邮件。

公共 controller 的 GET session、GET receipt 均强制 query.expectedAssignmentId，draft/submit 强制 body.expectedAssignmentId；校验后原样传给真实 service。service 在统一当前 scope/feature/参与/渠道同意与父链锁后，比对实际 assignment；不匹配在读取 revision/receipt 或执行答案写入前报 H5_ASSIGNMENT_MISMATCH。同浏览器另一标签改为 B 的 cookie 后，持有 A 预期 assignment 的旧标签不能读取 B、写入 B 或取得 B 回执。start/resume 仍用邀请 token 建立当前目标，不借旧 cookie 直接读取其它邀请；旧服务内部调用的可选参数保持既有兼容，不放宽新公共接口。此处结论来自源码与下述真实 PG，尚未独立执行跨标签浏览器。

presentOutreachVisit 只接受已授权正式 visit DTO，按当前 scope 和该 DTO 的 patient_h5 assignments 查询；仅追加最新 email invitationId 定位符，不返回邮箱、token、sessionId 或 provider 内容。research-studies controller 的正式访视 list/detail 两个入口均装配，邀请读取和回执仍由真实 core 作当前授权及父链守门。这里的 list 是每页内逐 visit 查询，属于当前有界页范围；未增加无界全Study邀请导出。

新 send 在原回执核对之后、register/prepare/audit/receipt 任何新业务写入之前检查 mailer 函数；未配置时返回明确 OUTREACH_CHANNEL_UNAVAILABLE 503。同键历史回执/只读状态不受 mailer 不可用影响，不自动重发；已准备发送的不确定结果仍保留 unknown。

独立执行 `node --test --test-concurrency=1 server/research-capture/h5-controller.test.mjs server/research-capture/outreach-display.test.mjs server/research-capture/outreach.test.mjs scripts/local-h5-outreach.test.mjs server/research-capture/outreach-pg.test.mjs` **11/11 通过**。证据 `docs/testing/evidence/research-t12-2026-11-12/h5-target-independent-review.tap`。其中真实 PG 在受保护 wp01_test_full_baseline 内唯一合成 fixture 整体回滚，覆盖错误预期 assignment 的 get/save/receipt 拒绝且答案版本仍 0、旧无参数兼容、重复兑换、固定模式撤回、不同邀请和租户拒绝、提交回执及渠道撤回。public controller/DTO/无 mailer 零写测试使用替身；PG mailer 也为本地替身，不是 SMTP 或送达证明。

| 文件 | SHA-256 |
|---|---|
| server/research-capture/h5-controller.mjs | `ee74a8ff7e7d1a9a715b7866b559630cc88d3f44cb859481cdc9aa73105411d7` |
| ../app/server/src/study-operations/study-outreach.service.ts | `1559322068d448d9b6421b7d32d06b635a43afba1f80915a6b0c507723982acd` |
| server/research-capture/outreach-display.mjs | `94e3be989500c55bf60a2970fc2e7e3b6f38510afc9ce6cc06cd0adba2525af4` |
| server/research-capture/outreach.mjs | `245650596d74116e78273414a883b747520ab87aaf26530b4e503084db6696c4` |
| server/research-studies/controller.mjs | `2e67e927990a3478c748afffda3177b2c6dcc69ab53537f03148ba26ff6df833` |

建议下一项：目标挂载后实际验证 A/B 跨标签 cookie 切换的读/写/回执拒绝与原邀请恢复，再完成 H5 浏览器与邮件真实触达分层验收。

## H5 客户端来源证明补齐独审（2026-11-12）

本次客户端最小修复未见剩余 Critical / Important 阻断。用户报告同机 `127.0.0.1:19501` 页面显示“请从当前站点提交”，对应 `h5-controller.mjs` 将 AUTH_ORIGIN_REJECTED 映射为 H5_ORIGIN_REJECTED；该失败在 token/session/答案业务处理之前。原失败请求的 headers 尚未直接捕获，不能宣称原用户确实发送了 portless 或 null Origin。

已证实的代码缺口：既有 `server/auth/session.mjs:7–13` 只对 loopback、精确 Host、无 forwarded、POST、同源 Sec-Fetch 组合、固定 marker 和精确来源 Referer 接受本机 portless Origin。旧 H5 client 不带 mode/marker，且明确 no-referrer，无法满足该分支。历史 session-origin 文档仅是定位线索；本轮另用真实 raw HTTP 复现旧客户端证明不足时的同类 403，以及完整证明可到达后续资源校验。

`src/questionnaire-h5-session.js:10` 修后仅补 `mode:'same-origin'`、固定 `X-ResearchHub-Request:'session-v1'`、`referrer:'/'` 与 `referrerPolicy:'same-origin'`。固定根路径不会把含 token 的邀请路径传入 Referer；HTML meta 与响应 no-referrer 保留。服务器断言、cookie、参与/渠道同意、assignment 绑定和回执逻辑未因本修复放宽。新增 marker 也用于 GET，但不扩展服务端权限或资源范围。

独立 RED→GREEN：修前新契约实际因缺少 mode 失败；修后原 9 项和新增 `tests/questionnaire-h5-origin-proof.test.mjs` 合跑 **10/10**。实际 `19501→19502` raw HTTP 正反例 **20/20**：完整 Origin 和严格 portless 组合达到 INVITATION_NOT_FOUND；旧缺元数据的 portless、缺各必需项、null/empty/trailing-slash/wrong-host/wrong-port Origin、错误 Referer 端口、跨站、cors mode、forwarded 均拒绝。初次 Node fetch 工具覆盖 Sec-Fetch-Mode 导致的工具失败记录保留，之后用 raw node:http 重验，不掩盖失败。

两次全新原生 Google Chrome 实际导入修后 client，start/draft/submit 的 Origin 为 `http://127.0.0.1:19501`，Referer **仅** `http://127.0.0.1:19501/`，mode/marker 正确，HTML no-referrer 仍在。start 返回合成不存在邀请的 404，draft/submit 返回无 session 的 400，证明来源校验已通过；没有有效答卷写入。已保存安全空入口截图/录屏并查看，未访问原邀请或原会话。该 native Chrome 未重现 portless/null Origin，Safari/Firefox 未安装未验证；不能由本次合成请求替代用户原邀请的填写验收。

证据与可重复脚本：[h5-origin-independent/README.md](../../../testing/evidence/research-t12-2026-11-12/h5-origin-independent/README.md)。本轮未读取 SMTP 凭据、重发、DDL、reload 或修改实现；主循环已热载客户端，用户可刷新原邀请继续验证。

| 文件 | SHA-256 |
|---|---|
| src/questionnaire-h5-session.js | `096112e689a243a0d671d04864d591f5d005de6dcf619860689725e2e98dc08a` |
| server/auth/session.mjs | `645e8325453e8e792c2430863eeadac05fc2f8a6bb5d370009c050ffddd8b575` |
| server/research-capture/h5-controller.mjs | `ee74a8ff7e7d1a9a715b7866b559630cc88d3f44cb859481cdc9aa73105411d7` |
| pages/h5-questionnaire/index.html | `db3c3cc383429adbf643859753411d5a621b8c54290133f2bb7d21451d46fe7b` |
| tests/questionnaire-h5-origin-proof.test.mjs | `ccaf9f16c44892e63508bdaa5086c7b388cf11a5d11793215edc7fb54a0509b3` |

建议下一项：用户刷新原邮件邀请完成实际填写、暂存与提交反馈；若仍拒绝，仅收集去 token 的来源元数据继续定位，保持现有服务器同源边界。
