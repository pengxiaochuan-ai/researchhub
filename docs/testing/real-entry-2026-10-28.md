# 真实入口与演示数据边界 · 本机合成阶段实测（2026-10-28）

## 环境与范围

仅原专用合成PostgreSQL、本机19501前端/19502 API、原owner/admin体验账号及本轮新注册合成账号。新测试不触碰临床库、旧服务、云、远端配置或历史测试任务；不发起模型请求、不新增费用、不发布。用户另批准在新具名合成Study内建立最小邀请管理/只读授权；这是本轮唯一新增权限，不改变旧Study或全局角色。登录、入口和诚实未接通状态是本轮实施范围，不等于所有业务API接线。

## 52路由真实模式台账

| 状态 | 路由 | 含义 |
| --- | --- | --- |
| 公共静态（6） | P00、P001、P002、P007、P008、P009 | 公共信息可静态显示，不要求个人数据库 |
| 账号/身份（5） | P003、P004、P005、P006、P010 | 账号、注册、找回、身份与其他账号流程按既有服务端会话处理 |
| 已接通默认页（3） | P01、K01、S11 | 沿用既有服务端会话/API，具体功能由原权限校验 |
| 本轮真实入口（3） | Q02、A01、AI01 | 当前会话授权Study/能力选择，不渲染固定结果 |
| 具名作用域（7） | Q01、S03、S04、S05、S06、S07、A02 | 仅在已有真实marker和有效参数下进入原已实现流程；无marker显示未接通 |
| 未接通（28） | C01、C03、T01、T02、R01、R02、H01、E01、E02、E03、S01、S02、G01、G02、O01、O02、H02、H03、H04、H05、S08、S09、S10、H06、H07、G03、G04、G05 | 真实模式隐藏演示内容，显示未接通；没有因此新增API |

以上共52条，路由判定唯一来源为 `src/real-mode-route.js`。显式前端演示不受真实模式守门影响。具名作用域只改变页面入口可见性，不代替服务端授权；Q01的真实研究方案与其他marker均以原业务端核验为准。

## 四层证据（阶段）

| 层 | 当前结果 |
| --- | --- |
| 代码 | 前端纯测试118/118、脚本契约测试282/282、WP02后端/本机PG测试27/27，共427项通过；Vite构建通过（保留既有大包告警）。回跳白名单、52路由分类、Study入口投影、多Study邀请路由及“提交成功/UI回执丢失时不自动二次签发”均覆盖。 |
| 本机启用 | 既有具名本机合成运行时19501可访问；没有生产部署或新配置。 |
| 真实请求 | Chrome中owner/admin从P003输入账号，登录后均实际到P01；owner Q02/A01/AI01显示服务端身份与本机合成Study；管理员手机Q02显示本人身份。52路由逐页巡检，35条无作用域或未接通页显示守门，0页面脚本错误。顶栏搜索/通知不读演示数据；K01在残留demo标记下仍显示真实会话。新具名合成邮箱经本机SMTP捕获完成注册→P01无私有Study→找回→旧会话401→新密码登录；管理员在本轮新Study签发邀请，本机SMTP捕获一封，错误账号预览拒绝，正确账号预览不入组，明确接受后新Study只读可见；浏览器脚本记录0模型POST。 |
| 业务结果 | 当前本机操作与视觉初验通过。先前独立只读总评审发现的演示搜索/通知、演示页头及K01身份错配已修补，复核无阻断。手机Q02首轮截图发现侧栏挤压文字，修补后复拍且卡片宽度≥300px、可滚动到末条Study。本轮邀请初测发现本机邀请服务仅绑定旧夹具，新增多目标路由后复验；旧WP02夹具200、原合成Study403、本轮新Study200。新用户只入本轮Study，PG和审计回读通过，手机S11无横向溢出且末条可滚动。邀请独立只读总评审无待修Critical/Important，证据Minor如实保留，见[评审记录](../planning/phase1-review-2026-10-19/invitation-independent-review-2026-10-28.md)。用户专业验收未完成；未接通路由不能计入已实现。 |

原始记录：[浏览器结果](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/result.json)、[52页巡检](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/route-sweep.json)、[owner P01截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner-p01.png)、[owner Q02截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner-q02.png)、[owner A01截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner-a01.png)、[owner AI01截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner-ai01.png)、[未接通G02截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner-g02-gated.png)、[管理员手机截图](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/admin-q02-mobile.png)、[管理员手机末条Study](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/admin-q02-mobile-bottom.png)、[owner录屏](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/owner.webm)、[管理员录屏](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/admin-mobile.webm)。重跑：`node scripts/real-entry-browser.mjs`、`node scripts/real-route-sweep-browser.mjs`。图中姓名/Study均为原合成账号现有记录，不是固定前端数组。

## 本机新账号与邀请连续体验

新具名 `real-entry-…@example.test` 账号只存在专用合成库；私有凭证仅在 `.tmp/researchhub-real-entry/account.json`，文档/浏览器截图/录屏不含密码或邮件链接。首次Chrome流程4项通过，本机私有收件箱捕获注册与重置各1封，确认后新用户的`/api/auth/me`归属当前合成租户且`studyGroups=[]`；重置前Cookie访问`/api/auth/me`为401。首次结果包含2份邮件ID/摘要，随后恢复性重跑覆盖了`account-result.json`，最新文件仅记录已持久化里程碑与新密码登录/零私有Study重验，不能把重跑当成再次发邮件。可参看[当前账号重验](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/account-result.json)、[新账号P01空态](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/new-account-zero-study.png)、[重置后P01空态](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/reset-account-zero-study.png)。测试脚本：`scripts/real-account-browser.mjs`；不会自动重复已完成的注册/重置请求。

邀请前只读核对：`admin@example.org`在原合成Study调用`GET /api/member-invitations/context`返回403（`scripts/real-invite-scope-check.mjs`），不能把租户管理员身份当成该Study的`member.manage`。用户批准后，`scripts/real-invitation-fixture.mjs check→initialize→verify`仅在专用合成库新建`real-invite-b55d67c7`组/Study与独立最小角色，原新注册账号此前零私有Study；原WP02历史夹具/任务不写。首次浏览器执行在管理员新Study上下文也得403，定位到ResearchHub本机装配只绑定旧WP02夹具；保留[失败记录](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitation-failure.json)，增加服务端精确Study/token摘要路由及4项RED→GREEN契约测试后，仅重启自有本机运行时复验。

首次真实Chrome完成7项邀请检查：管理员在新Study发信、本机SMTP捕获一封、错误账号无Study名称且不可接受、正确账号预览不自动入组、显式接受后仅新Study只读、P01回链、旧Study403。随后为补手机底部截图复跑，仅执行已有邀请的当前状态核对，覆盖了`invitation-result.json`的检查列表；[当前浏览器结果](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitation-result.json)为5项重验，**不能冒充首次再次签发/接受**。独立评审指出原脚本在服务端成功而UI回执丢失的窗口可能二次签发；修补后每次先只读读取本轮Study邀请，唯一且已捕获才复用，结果不明/重复/过旧即停，不自动重发；3项新增测试先红后绿，后续每次写[唯一结果快照](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitation-result-1c36d73d.json)防覆盖。独立[只读PG回读](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitation-readback.json)确认恰好1份本轮邀请、1个目标Study成员、1个目标项目成员、2项签发/接受审计，投递消息ID/摘要匹配本机捕获；未读取或保存token。[管理员新Study](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invite-manager-new-study.png)、[受邀预览](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invite-correct-account-preview.png)、[受邀只读](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitee-new-study-readonly.png)、[受邀P01](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitee-p01-new-study.png)、[手机首屏](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitee-new-study-mobile.png)、[手机末条](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitee-new-study-mobile-bottom.png)、[安全录屏](../../../docs/test/evidence/2026-10-28-researchhub-real-entry/invitee-mobile.webm)均不含密码/邀请token。历史WP02夹具接口仍200，原合成Study仍403；没有调用模型、外发邮件或修改旧系统。

## 待完成

WP02注册/找回/邀请在**本机合成环境**的连续技术体验已复验；外部真实邮箱送达、目标环境配置/执行、专业用户验收未完成。AI01只是可核验的能力入口，Study成员关系本身不是单项AI/资产权限；18项AI、正式EDC、审批/共享/发布/导出仍待另行实施/确认。当前全部52页尚未逐页接入后端API，未接通页继续诚实守门。
