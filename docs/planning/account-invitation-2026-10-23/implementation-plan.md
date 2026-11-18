# WP02 账号与邀请闭环实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans task-by-task. 用户已选择当前目录串行实施＋独立只读总评审，不切换工作树或并行写代码。

**Goal:** 在原本机专用合成环境交付邮箱注册、找回密码、最小Study邀请与真实身份展示，以真实SMTP捕获/浏览器请求验证，不外发邮件。

**Architecture:** ResearchHub增加聚焦的WP02模块，复用原AuthService/JwtAuthGuard、Account/成员公共表、共同授权锁、席位锁和审计。共享Schema仅走原唯一Prisma迁移目录；新增表由参数化SQL repository访问，不重新生成/替换旧系统正在使用的Prisma Client。先完成无外联邮件捕获，再接自助账户、邀请与共享身份。

**Tech Stack:** 当前React18/Vite6、NestJS/Prisma事务、PostgreSQL16、bcryptjs；邮件复用官网nodemailer 9.0.5版本与安全选项，捕获器用Node net/http，不引入云服务或通用队列。

**Spec:** [已批准WP02规格](../../product/account-invitation-spec-2026-10-23.md)。2026-10-23用户已批准功能、本机SMTP、新具名Study最小授权及本八步计划；当前目录串行实施＋独立总评审。实现及验证结果逐Task记录，不以批准代替完成。

**执行结果：** Task1–8本机技术闭环及文档交接完成，原任务清单作为验收要求保留；逐项结果/失败/限制见测试报告、progress及review。仅一次独立评审，3项Important由主实现RED→GREEN修补，不冒充二次评审签认；专业用户体验/外部邮件/生产仍未验收。

## Global Constraints

- 仅`wp01_test_full_baseline`，每个事务复用`withFixtureTransaction`核验原guard marker；配置引用原`.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json`。不得接临床库、重置数据库、跑native all/历史恢复扫描或改旧服务。
- 注册租户来自服务端既有合成租户映射；固定researcher/isTenantAdmin=false，零Study/课题组/KB/Agent/Skill/计费grant。模拟灵枢心域归属，不更名原租户、不写生产租户ID。
- 只在一个新具名验证组/Study给原admin新增独立`group_admin`/`member.manage`和`project_manager`；原owner不提权，原角色/原研究/账号口令不改。受邀新注册账号只得该新Study最小只读访问，无共享/审批/锁库/发布/导出/AI。
- 原19501–19505常驻服务及六阶段资产保留；完成新代码后仅检查身份并重启自有local-knowledge运行时。SMTP19506/私有收件箱19507只绑定127.0.0.1，占用就停，不杀占用进程。
- `.env.smtp.local`为服务端专用0600文件，禁止VITE_密钥/日志/提交/Notion；默认`WP02_MAIL_MODE=capture`。真实SMTP参数即使填好也不得连接/verify/外发，远端配置/费用/云/真实发布另批。
- 新密码12–64字符且UTF-8不超过72字节，不trim密码；沿bcrypt cost10，不改变旧登录兼容性。256位随机token只持久摘要，register/reset15分钟、invite72小时，显式POST消费，GET不消费。
- 持久限流：同用途邮箱3/小时、来源IP10/15分钟、租户100/小时、重发60秒；无效兑换IP5/15分钟；邀请同签发人/Study10/小时。列表20、最大50，请求16KiB；IP仅加盐摘要。短事务，不在授权锁内等SMTP/哈希。
- 门户输入/按钮16/24，工作区操作14/22、长文16/28、元信息12/18；不改Frozen Shell/Token/五个导航。真实模式不回退演示身份或演示成功。
- 测试与证据放新目录`docs/test/evidence/2026-10-23-researchhub-wp02/`；不重跑会覆写2026-10-22冻结证据的旧脚本。四层验收分别报告，外部送达和专业用户体验仍待另验。
- 当前目录有大量已存未提交改动；只按本计划文件限定改动，不自动提交/推送、stash、重置或清理。每步保存RED/GREEN及失败记录。

## Review Focus

1. 用户填好真实SMTP参数后，默认捕获仍必须零外联，包括启动verify；Task1用拒绝出站的transport探针固定。
2. 扫描器打开、浏览器刷新/后退、误用另一目的链接不应消费token；Task3/5以GET无写入及用途交换反例固定。
3. 邀请签发后管理员失权、目标角色停用或旧成员已被停用，接受时不得补回权限；Task5在提交锁内重验并做实际PG竞争。
4. 同时注册/兑换/重发与SMTP结果未知不能产生半账号、双成员、双消费或可用旧token；Task2/3/5以实际并发和故障注入验证。
5. 用户切账号、退出或me响应迟到，不得残留王教授/另一账号/错误PI身份；Task6对共享消费者及200%视口回归。

## 文件边界与接口

共享结构仅修改`app/server/prisma/schema.prisma`，新增`app/server/prisma/migrations/20261023000000_wp02_account_invitation/migration.sql`；不改旧Auth/Accounts/PI方法与官网。新增SQL对象为`account_action_challenge`、`research_member_invitation`、`wp02_request_window`，并只增Account可空emailNormalized/emailVerifiedAt与tenant+email唯一约束。旧行null，不猜邮箱或回填。

实现单元均在ResearchHub：`server/wp02/{config,mailer,capture,policy,repository,account-service,invitation-service,controllers}.mjs`；每个文件同名`.test.mjs`。`scripts/local-accounts.mjs`装配并返回Controllers/生命周期；`scripts/wp02-{schema,fixture,preservation,pg,browser,gates}.mjs`负责受控测试，不在服务启动时迁移/提权。`src/account-session.js`及`src/platform-auth.js`负责同源客户端和共享身份；`pages/shared/{AccountAccess,AccountProfile,MemberInvitations}.jsx`及作用域CSS负责真实页面。原模块只在必要挂载点修改。

接口统一`{code,message}`错误，敏感资源不存在/不可见统一处理；禁止返回tokenHash/passwordHash/SMTP信息。错误400字段、401会话、403授权、404不可见、409版本/状态冲突、429限流、503邮件不可确认。公开邮箱请求无论账号存在与否同为202 `{accepted:true,message}`，响应不包含账号存在性。

| 路由 | 严格输入 | 成功输出/条件 |
| --- | --- | --- |
| POST /api/account-access/registrations | email,requestKey | 202受理；不携带密码、不创建账号 |
| POST /api/account-access/registration-confirmations | token,displayName,password,requestKey | 201 `{created:true}`；同键同结果但不新建会话 |
| POST /api/account-access/password-resets | email,requestKey | 202统一受理 |
| POST /api/account-access/password-reset-confirmations | token,password,requestKey | 200 `{reset:true}`；原authVersion失效 |
| GET/PATCH /api/account-access/profile | GET无body；PATCH displayName,baseVersion,requestKey | 本人displayName/已验证邮箱/版本；邮箱只读，不加机构/资质字段 |
| GET /api/member-invitations/context | 原group/project headers | 当前受权Study、本人角色、canInvite及最小目标角色说明 |
| GET/POST /api/member-invitations | GET cursor?,limit?；POST email,requestKey | 作用域列表 `{items,nextCursor}`；新邀请 `{id,version,deliveryStatus,expiresAt}` |
| POST /api/member-invitations/:id/revocations 或 /resends | baseVersion,requestKey | 同作用域状态/CAS；重发撤销旧token，不更新目标邮箱/角色 |
| POST /api/member-invitation-previews | token | 已登录且验证邮箱匹配才返回Study/最小角色；不消费 |
| POST /api/member-invitation-acceptances | token,requestKey | `{accepted:true,studyGroupId,researchProjectId}`；零额外能力 |

`requestKey`为8–128字符base64url/连字符标识；输入同键不同摘要409。注册/重置终态重放只在同键且已保存结果匹配时返回原结果，其他重放拒绝；不能用消费后token更改密码/名称。服务端固定部署租户，不接受任意tenant/role/scope等字段。HTTP写操作校验可信Origin及JSON类型/16KiB，拒绝异常Host/转发头，不新增宽松CORS。

## Task 1：独立配置与真实本机SMTP捕获

**Files:** 创建`server/wp02/config.mjs`、`config.test.mjs`、`capture.mjs`、`capture.test.mjs`、`mailer.mjs`、`mailer.test.mjs`；修改package.json/pnpm-lock.yaml仅加入官网同版本nodemailer；配置已先生成`.env.smtp.local`/`.env.example`。

**Interfaces:** `readWp02Config({file,approvedMode:'capture'}) -> CaptureConfig`；`startCapture(config,{dir}) -> {sendPort,inboxPort,close}`；`createAccountMailer(config) -> {send({purpose,to,tokenUrl,expiresAt}):Promise<{status:'captured'|'failed'|'unknown',messageId?}>}`。不暴露外部SMTP启用入口。

- [ ] 写RED：capture忽略已填SMTP_HOST/USER/PASS，缺模式/非capture/非loopback/非固定baseURL拒绝；恶意换行配置与符号链接文件拒绝，权限不是0600拒绝；SMTP transport探针外联调用数必须0。
- [ ] `node --test researchhub/server/wp02/config.test.mjs researchhub/server/wp02/capture.test.mjs researchhub/server/wp02/mailer.test.mjs`先红；确认失败因待实现而非环境。
- [ ] 实现只读解析该专用文件，绝不source shell；不自动加载项目根.env。nodemailer复用TLS/timeout/disableFileAccess/disableUrlAccess/debug=false；capture仅显式回环无认证测试传输。
- [ ] 实现最小SMTP EHLO/MAIL/RCPT/DATA/QUIT，限制消息64KiB、地址域example.test/example.org、单连接10秒、单条单收件人、拒绝relay；真实字节持久在700目录/600文件，令牌有效期后正文不可通过收件箱读取，过期证据仅留摘要，不自动清业务行。
- [ ] 私有HTTP收件箱独立19507：随机会话Cookie和启动凭证保存在私有配置，启动凭证首次POST交换后废止；精确Host/Origin、no-store、CSP、no-referrer、nosniff、无CORS；未认证/跨站/路径遍历拒绝，不代理至19501、不公开搜索全部邮件。token链接只在获准本机操作者查看正文时可见，禁止控制台打印。
- [ ] 同一命令GREEN；真实回环SMTP收信、MIME文本、拒绝故障/未知结果单测留证。此项不叫外部邮件送达通过。

## Task 2：兼容共享Schema、持久限流与合成夹具

**Files:** 上述唯一migration/schema；创建`server/wp02/repository.mjs`/`.test.mjs`、`policy.mjs`/`.test.mjs`、`scripts/wp02-schema.mjs`、`wp02-fixture.mjs`、`wp02-preservation.mjs`、`wp02-pg.mjs`。

**Interfaces:** `withWp02Transaction(scope,fn)`复用原guard+共同tenant锁、设置可信RLS上下文；`consumeRate(tx,{tenantId,purpose,keyHash,limit,windowMs,now}) -> void`超限429；`applyWp02Schema({env,expectedDigest})`只执行明确只增SQL；`ensureInvitationFixture({env,ids,runKey}) -> {groupId,projectId,managerRoleId,readerRoleId}`仅一次初始化。

- [ ] 写RED：新邮箱列/表存在性、无tenant上下文0行、同tenant可见、跨tenant拒绝；唯一邮箱并发/非法状态/CHECK约束、三类限流并发最后一格只允许一个。全部只用专用合成PG。
- [ ] `node --test researchhub/server/wp02/policy.test.mjs researchhub/server/wp02/repository.test.mjs`及`node researchhub/scripts/wp02-pg.mjs schema-red`记录RED，不执行旧全库fixture脚本。
- [ ] 迁移新表包含tenant外键、目的/投递/终态CHECK、tokenHash唯一、版本/请求键/请求摘要、必要时间戳和tenant分页/过期索引；challenge保存目的/email/account/authVersion快照，不保存密码；invite保存真实group/project/签发人/目标groupRoleId/目标projectRoleKey和接受者。requestWindow只保存有界键摘要/窗口/计数。
- [ ] 新表启用并强制RLS，沿原app角色授予新表最小SELECT/INSERT/UPDATE，不给新BYPASSRLS或全schema权限；租户之外的组/项目/角色匹配由服务事务重验。按当前库真实catalog先核对拥有者/DDL权限，缺权限即停，不新建owner或自行GRANT提升连接角色。
- [ ] `node researchhub/scripts/wp02-preservation.mjs baseline`写新证据，捕获旧源/进程、1250冻结条目、AI账本和原行摘要；Account用迁移前固定列清单投影，避免加null列导致row_to_json假阳性。新旧表分别记账；不覆盖旧manifest。
- [ ] 审核SQL摘要后`node researchhub/scripts/wp02-schema.mjs apply`只在本机guard库运行一次显式迁移，事务回滚失败，不跑migrate deploy/db push或旧seed；不替换旧Client/node_modules。schema.prisma保持同源但新增字段读取用repository参数化SQL。
- [ ] 创建新`wp02-invite-<随机key>`组/Study，原admin仅新组新角色/项目manager；reader角色最小只读菜单仅目标context，button空，不授予知识/Agent。已有manifest时仅核对、不修复被撤销行；重启不执行初始化。原旧对象不存在/冲突即停，不擅自修复。
- [ ] `node researchhub/scripts/wp02-pg.mjs schema-green`及单元GREEN；旧Auth登录/Accounts原读接口继续成功。原行/角色/旧客户端摘要保全，DDL仅合成，不代表生产已迁移。

## Task 3：注册与找回服务端闭环

**Files:** 创建`server/wp02/account-service.mjs`/`.test.mjs`、`controllers.mjs`/`.test.mjs`、`scripts/local-accounts.mjs`；修改`local-knowledge.mjs`只装配Controllers/16KiB中间件/捕获生命周期。

**Interfaces:** `createAccountAccess({config,db,mailer,auth,locks,now}) -> {requestRegistration,confirmRegistration,requestReset,confirmReset,readProfile,updateProfile}`；`createLocalAccounts({...}) -> {Controllers,close}`。methods接受可信ctx（tenant、会话、IP摘要、Origin）及上表严格DTO。

- [ ] 写RED：伪tenant/role/未知字段、大小写/旧用户名占用、超长UTF8密码；15分钟到期/用途交换/GET不兑换/错误尝试限流；并发确认只建一个账号、零成员/能力/配额grant；账户停用或authVersion改变后旧reset无效。
- [ ] `node --test researchhub/server/wp02/account-service.test.mjs researchhub/server/wp02/controllers.test.mjs`与`node researchhub/scripts/wp02-pg.mjs accounts-red`记录失败。
- [ ] 申请注册仅生成绑定email的challenge及邮件；密码/名称在明确兑换POST提交，避免暂存密码。requestKey去重，60秒显式重发撤销旧challenge；存在账号统一202、不返回是否发信。新账号username=emailNormalized，已验证邮箱绑定，席位锁键完全沿原AccountsService，禁止调用其自动加组create。
- [ ] 先短事务持久pending tokenHash，再锁外SMTP，短事务条件更新投递结果；captured状态须匹配真实capture消息摘要/ID。失败/未知不消费，状态提交失败亦不可用；不自动重发、不把SMTP接受等同送达。未解决投递可显式申请新凭证。
- [ ] 注册兑换在原授权锁→席位锁（原键`aisci-account-create:${tenantId}`）→challenge行锁顺序原子检查/新建Account/消费/审计；bcrypt在锁外，提交时再次验凭证。找回原子更新passwordHash/authVersion++、消费并撤销该账号其余reset、审计；旧Cookie失效使用原JwtAuthGuard验证。旧账号无verified email不得自动开通找回。无效兑换计数先提交再返回错误，不能因抛异常回滚计数而无限重试。
- [ ] 本人profile只允许displayName（1–40字符），CAS版本取服务端updatedAt，沿原共同授权锁更新/审计；原合成owner/admin只在新建测试账号之外保持不修改。
- [ ] `accounts-green`及单元GREEN；增加真实SMTP失败、DB最终状态失败、并发兑换回滚与统一存在性响应验证；不以Mock证明真实投递。

## Task 4：注册/找回/本人资料门户

**Files:** 创建`src/account-session.js`/`tests/account-session.test.mjs`、`pages/shared/AccountAccess.jsx`/`AccountProfile.jsx`和`account-access.css`；修改PublicPages.jsx/LoginSession.jsx仅真实分支与入口文案，保留明确demo入口。

**Interfaces:** `createAccountAccessClient({fetchImpl})`按接口表发同源Cookie请求；组件`AccountAccess({page})`、`AccountProfile()`；P004页内`#verify=<token>`，P005`#reset=<token>`，P006为真实本人资料，未登录不读demo冒充本人。

- [ ] 写RED：客户端严格DTO/响应、不保存密码/token、失败不回退demo、统一存在性反馈、链接解析并立即replaceState清hash；返回仅白名单站内路径且剥除凭证。
- [ ] `node --test researchhub/tests/account-session.test.mjs`记录RED；写最小React验证夹具覆盖初始无错误、首错焦点、防重复、失败保留邮箱/名称而清密码、重发倒计时及结果未知提示。
- [ ] 保持P003–P006原左右构图/公共品牌；P004先请求邮件、打开验证页再明确填写名称/密码确认。P005先申请、邮件页再设置；成功都回登录，不自动创建会话/加入Study。本机捕获状态明确说明不外发。
- [ ] token仅组件内存；刷新前被移除后显示重新打开邮件路径，不把token写session/localStorage。跳登录接受邀请时只保留非秘密邀请ID提示，登录后要求重开原邮件，不偷偷持久token。
- [ ] GREEN及`pnpm --dir researchhub run build`。真实浏览器联合验收在Task7，不将组件测试当交付。

## Task 5：Study成员邀请服务与S11/接受页

**Files:** 创建`server/wp02/invitation-service.mjs`/`.test.mjs`、`pages/shared/MemberInvitations.jsx`及作用域CSS；扩展controllers/account-session；修改missing-main.jsx、platform-pages.json/vite.config.js、创建`pages/p010/index.html`，S11真实分支只在已配置环境且有明确真实scope时挂载，不先经过demo store。

**Interfaces:** `createMemberInvitations({db,mailer,locks,config}) -> {context,list,issue,revoke,resend,preview,accept}`。`MemberInvitations({mode:'manage'|'accept'})`；管理`/pages/s11/?members=1&studyGroupId=...&researchProjectId=...`，接受`/pages/p010/#invite=<token>`。URL只是选择，不能授权；P010门户复用PublicLayout，不新增平台一级导航。

- [ ] 写RED：原owner/admin对旧Study签发仍403；新Study原admin成功，新注册未邀0成员；错邮箱/错账号/跨scope/撤销/到期/版本冲突/重放/停用旧成员拒绝。preview必须先同租户登录且verified email匹配，其他响应不含Study名称。
- [ ] `node --test researchhub/server/wp02/invitation-service.test.mjs`与`node researchhub/scripts/wp02-pg.mjs invitations-red`记录失败。
- [ ] 重用原group_admin/member.manage/project_manager判定和共同授权锁＋项目锁；签发及接受皆重验租户/账号authVersion/成员/role/Study有效。accepted原子写最小组成员＋项目成员＋消费＋审计；已有不同或disabled成员不覆盖/恢复，已成功同键可返回原结果。无任意角色编辑入口，不修改最后经理策略。
- [ ] 管理页能列表/邀请/明确撤销/显式重发，并区分captured/failed/unknown/revoked/accepted/expired，不显示裸token；只读用户只看自己获准的context，无全租户账号搜索。S11上下文名称来自服务，移除该真实分支的固定demo页头，不改其演示分支。
- [ ] 接受页先清hash，核对正确账号、明确目标Study/只读权限，点击确认才加入；未登录需登录后重开邮件，错误/过期可解释并联系邀请人，不自动注册或代接受。
- [ ] invitations-green覆盖签发人失权在途竞争、接受/撤销同时、SMTP未知/重发旧链接拒绝；故障回滚零半成员。受邀账号对旧K01/原资产/Agent/审批/导出依旧拒绝，原admin/owner旧作用域不变。

## Task 6：全共享身份接真实me

**Files:** 创建`src/platform-auth.js`/`tests/platform-auth.test.mjs`；修改platform-user.js、platform-header.js（仅展示字段/触发，不复制布局）、platform-frontend.js（真实用户菜单/退出/能力说明）、auth-session.js（保留受控角色信息）、LoginSession.jsx及K01桥接消费点。

**Interfaces:** `createPlatformAuth({client,setUser,readScope}) -> {refresh,logout,dispose}`；状态checking/authenticated/anonymous/unavailable；账户/作用域变化使旧请求序号失效。getPlatformUser/setPlatformUser保留兼容签名，真实模式不读取__QIYAN_USER__/本机profile。

- [ ] 写RED：配置存在时初始不出现王教授，me迟到不覆盖新账号/退出，401/403清身份，网络错误不是demo/未登录假成功；无Study不能显示PI，租户管理员不冒充Study经理。明确demo模式不调用真实认证并显式标demo。
- [ ] `node --test researchhub/tests/platform-auth.test.mjs researchhub/tests/auth-session.test.mjs`RED；仅拓展profile允许字段为服务端已返回的组/项目角色，保持旧客户端契约，不读localStorage来决定授权。
- [ ] 全部公共Header消费者同一适配入口；真实菜单展示账户/本人资料/真实logout，失败不谎报已退出；Cookie退出不声称撤销所有设备。K01 iframe桥仅显示当前服务器身份，不转发凭证，保留origin/source校验。
- [ ] GREEN；从platform-pages.json读取本轮全部页面对受影响Header消费者检查1个Shell/实际身份/无PI误标；P003–P006/P010门户不误挂侧栏。公共能力提示按真实/演示职责更新，不把登录成功说成所有业务服务已接通。

## Task 7：真实PG＋SMTP＋浏览器收口、独立总评审

**Files:** 新`wp02-browser.mjs`/`wp02-gates.mjs`与新证据目录；修改local-knowledge.mjs仅自有生命周期，更新体验账号私有说明，不输出密码。

**Interfaces:** `node researchhub/scripts/wp02-gates.mjs`只编排本轮检查，先验证fixture身份/依赖/旧服务；`wp02-browser.mjs`使用真实React/API/PG/私有SMTP收件箱，日志只存脱敏断言/摘要；不读付费AI入口或重启旧服务。

- [ ] 全单元逐组运行并留原始exit码；`node researchhub/scripts/wp02-pg.mjs all`只执行本轮新具名夹具。旧编译内核分组及前端全部tests回归，不执行旧native all/已有证据写入器。
- [ ] 原同租户仅剩席位有限：成功验证复用本轮少量新账号，其余并发/故障在回滚事务内测；不增quota、不改旧账号、失败保留具名记录。确认所有允许schema/newrows/grants精确差异；发现额度不足停下确认，不删除旧账号腾席。
- [ ] 真实浏览器主链：P004请求→本机邮箱→显式验证→P003真实登录零成员→P006本人名称；申请找回→本机邮箱→新密码→旧会话401→重登；新Study admin S11邀请→正确账号预览确认→仅新Study只读。注册邮箱认证与邀请均实际SMTP，不用SQL造成功状态或直接读DB token替代收信。
- [ ] 反例：错误账号、未邀/旧Study、撤销/过期/签发人失权、重放/并发、SMTP拒绝/未知、503恢复、键盘/返回/刷新/旧响应、真实退出。撤权测试只动本轮新Study行，恢复需用户明确允许的原测试授权；不触碰历史任务或原角色。
- [ ] 录屏/截图在密码输入/链接token已清后开始；私有邮箱正文与有效凭证不入trace/HAR/截图/录像，采用受控私有上下文提取导航链接，公开证据只存消息ID摘要/时间/目的/结果。验证无token日志/Referer/localStorage，负向错误如实留痕，不声称零consoleerror。
- [ ] 1440/1366/1920、390/320及实际Chrome200%记录viewport/DPR/字号16/24与14/22/Reading；与修改前同视口截图比较，无缩字/裁切/身份遮挡，实际键盘完成注册/邀请确认。
- [ ] 按PID/启动时间/命令只重启自有local-knowledge，保留原随机Cookie/账户/数据，失败后不自动重赋grant；19501–19507实际health和新流程刷新恢复。旧进程/源/固定列原行/1250冻结证据/AI账本原样。
- [ ] 主实现完成后按既定方法派一次独立只读总评审（代码、安全、规格、失败模式、证据），主实现逐条核实再RED→GREEN修补本范围问题；新权限/费用/远端等先停。不把历史评审或Mock轨迹算本轮真实验收。

## Task 8：文档、证据与体验交接

**Files:** product-baseline.md/product-changes.md、`docs/product/使用说明书.md`、`docs/technical/wp02-account-mail-runtime.md`、`docs/testing/wp02-account-invitation-2026-10-23.md`、docs/README.md和本目录tracking；共享Schema说明在新技术文档，不改旧系统功能事实为已发布。

- [ ] 为每条需求标代码/本机配置/真实执行/用户效果四层状态，列请求、邮件捕获、DB授权、截图录屏/实际缩放证据；真实外发未配置/未执行/未验收，绝不标绿。
- [ ] 写清`.env.smtp.local`填写步骤、SMTP授权码非登录密码、不得加VITE_、TLS465或STARTTLS587；只允许将来外部审批后启用。服务当前只读capture配置；未启用前填写不会自动发信。
- [ ] 新证据manifest冻结，git diff --check、脱敏审查通过；原证据不动。同步Notion对应既有章节并回读，绝不上传.env/私有邮箱/凭证/有效token。
- [ ] 交接本机登录/注册/找回/邀请与私有收件箱入口、私有凭证文件位置、未测项和剩余确认门槛，专业体验由用户验收。整体预计3–4个工作日（含安全/真实浏览器/评审修补），首片配置邮件约0.5天，账户1天，邀请0.5–1天，身份与收口1–1.5天；这是排期估算，不以期限省掉隔离或真实验收。

## 计划自检与停止条件

规格1–4节对应Task2/3/6，5节对应Task2–4，6节对应Task2/5，7节对应Task1/3，8–9节对应Task4–7，10–11节对应Task7/8；接口名称前后一致，五项Review Focus均有实际反例任务。未计划SSO、邮箱更改、邀请任意角色、真实外部发送、云/正式装配发布或旧系统重构。

用户已批准并执行Task1→8，保持串行＋一次独立评审，不再询问执行方式。Task1–7本机技术验证及评审反例修补已完成；Task8收口以progress/测试报告为准，四层验收仍区分用户效果及生产。合成迁移权限不足、旧服务/历史原行变化、捕获端口占用、授权需扩大、真实SMTP/费用/远端配置/云/发布任一发生即停。配置文件可填写但仅capture生效，绝不自动外发；过程失败与计划偏离见review.md，不据旧准备状态误停或复活其他任务。
