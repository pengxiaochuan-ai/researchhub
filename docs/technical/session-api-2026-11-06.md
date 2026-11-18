# ResearchHub统一会话接口与装配

## 2026-11-06 · 实际Chrome登录来源403修补

已复现实际Chrome去端口Origin被误拒，非管理员权限不足；仅本机19501在loopback/Host/完整Referer/独立Fetch Metadata/会话专用头等全部证明满足时兼容，正式Origin/CORS和12h/撤销/权限不放宽，旧系统/数据库/布局不改。来源403与业务403区分，用户不再为此被告知账号无权；实际Chrome合成凭据已进入原账号校验，原两个合成账号去端口完整HTTP流程通过。管理员刷新登录页后用admin@example.org及原密码重试，不添加末尾标点。[验证与交接](../testing/session-origin-fix-2026-11-06.md)。

产品依据：[统一规则](../product/session-policy-2026-11-06.md)。本机专用合成环境技术实现，正式部署尚未发布，不修改旧系统。

## 后端

`server/auth/session.mjs`定义43200秒JWT与Cookie共同截止时间，JWT固定HS256、ResearchHub部署标识和随机hubSessionId。控制器通过`createHubAuth({require,load,jwt,prisma,scope,cookieName,origin,secureCookie})`统一提供Controller/guard；scope必须researchhub，origin为显式同源源站（正式HTTPS，本机loopback HTTP例外）。正式HTTPS下强制Secure，Cookie仍HttpOnly/SameSite=Lax/path=/api，只在登录和显式续期时设置Expires。接口与guard使用no-store，不把token返回JSON。

| 接口 | 写入/响应 | 安全行为 |
| --- | --- | --- |
| POST /api/auth/login | 原tenantSlug/username/password；201 {user,expiresAt}及Cookie | 复用旧AuthService校验/登录审计，再在授权锁内复核当前身份并签新sid |
| GET /api/auth/me | 原用户资料200 | 每次检查JWT、当前账号/租户/authVersion及sid撤销；不续期、不写Cookie |
| POST /api/auth/renew | 空JSON {}；200 {ok:true,expiresAt}及新Cookie | 原凭证尚有效且未撤销；授权锁后重查身份及过期时间，保持sid、重新给12h窗口 |
| POST /api/auth/logout | 空JSON {}；200 {ok:true}及清Cookie | 仅记本sid退出，不提高账号authVersion，不影响旧系统/其他登录 |

三个写接口要求显式配置同源Origin和application/json，跨站拒绝；不能通过GET刷新。受保护请求无效/过期401，业务无权403；数据库不可用503，不伪装退出。旧2h无hubSessionId或其他部署签名不能自动升级，须重新登录。

## 现有数据库复用

沿用Account.authVersion、Account.status、Tenant.status及原授权锁；不改表/权限。每次退出在既有audit_log新增`action=researchhub.session.logout,target=hubSessionId`，显式tenantId/accountId，meta仅deploymentId和过期时间，不保存JWT/密码。读取撤销记录按tenant/account/sid查询，使用现有租户/账号索引；历史不清理。退出与续期共用原租户授权事务锁，退出后即便迟到Cookie到达，也无法重新认证。跨实例/重启沿用PG撤销事实，不用内存黑名单。新增登录只生成新sid；其他设备和旧系统会话不受影响。

## 前端

`src/session-lifecycle.js`明确受保护页：p01、p006、q01/q02、k01、ai01、a01/a02、s01–s11、g02–g05。目录/论文/临床注册/团队研究者等公开页面及登录/注册/找回不强制登录。`route-context.js`复用文章AI严格恢复校验并接入私有页参数白名单；危险/重复参数、外域/嵌套回跳回p01，Hash不携带进登录URL。服务端仍独立判业务权限，回跳不重放业务POST。

`platform-user.js`绑定可见前台document的可信pointerdown/keydown/input/change/submit；不监听mousemove、focus、timer、message作为活动。知识资料同源iframe在onLoad绑定原contentDocument可信事件，不把postMessage转为用户活动，不修改iframe布局。成功续期后60秒内合并后续操作，无定时保活；失败无自动重试，下一次真实操作可再尝试。非阻断待优化：快速失败时的连续真实输入尚无失败侧节流。

`auth-session.js`使用浏览器Web Locks将同源标签页login/renew/logout串行化；无Web Locks时仍以服务端持久撤销保证退出sid不再认证，不冒称所有浏览器的迟到Cookie顺序等价。`platform-auth.js`确认401/null才触发受保护页replace到原登录；网络/超时/5xx/403保留已核验身份及身份epoch，只标sessionHealth/原身份栏连接提示，避免旧页面把连接变化误当身份切换而清掉草稿。重新在线核验，不自动重发业务。

## 装配与发布边界

当前`scripts/local-knowledge.mjs`已用12h JwtService和HubAuth Controller/guard替换本机原AuthController/JwtAuthGuard；旧AuthService/角色/Study guard仍复用，旧源代码不改。独立正式后端须显式采用同一createHubAuth及部署专用Cookie/Origin配置；本轮没有访问远端配置、修改旧启动入口、云资源或发布。正式部署装配和真实HTTPS验收仍是发布前门禁，不能因本机通过便宣称hub.pengxc.com已更新。
