# 账号授权首切片：真实会话接入

当前状态：代码、本机受控配置及两角色真实HTTP/浏览器验证通过，尚无生产配置/发布或用户业务签认。前端54项（会话19）、浏览器14检查、10PNG/2WebM，0pageerror；预期401/503控制台记录保留。完整main装配、200%真实缩放、全部50页及注册/找回/邀请/AI未由本片验收。证据位于根docs/test/evidence/2026-10-22-researchhub-development-admission。

来源：2026-10-22用户批准开发准入通过后自动进入账号授权。范围为既有P003登录接线及当前身份/退出；不新建认证架构、接口、角色、表或外部发送服务。注册、找回和Study邀请仍为一期后续，不随本切片销项。

## 既有API与数据契约

- POST /api/auth/login：JSON {tenantSlug, username, password}；返回 {user}，服务端写独立HttpOnly Cookie，前端不读取或保存JWT。
- GET /api/auth/me：返回当前user；401表示无有效会话，不把旧缓存/演示身份当当前用户。
- POST /api/auth/logout：成功返回 {ok:true}并清Cookie。失败仍显示退出未确认，不伪造成功。
- user最小字段accountId/tenantId/username/displayName及studyGroups数组，组内researchProjects为既有受权投影。前端只显示，不据其授予服务端权限。
- public配置VITE_AUTH_TENANT_SLUG只提供本部署租户slug，不是secret或权限凭证；不从query/localStorage/表单读取tenantSlug覆盖它。后端DeploymentScope仍是信任边界。未配置时不发送登录请求并显式说明，不默认连接旧3001或生产。
- 所有请求固定同源/api/auth/*、credentials=same-origin、cache=no-store，不收任意baseURL，不自动重试POST；15秒有界等待。网络/401/403/5xx/无效响应分别解释，不回显服务器内部错误、密码或token。

## 页面与交互

- 保留P003公共门户左右构图、品牌/字号/样式；不改Frozen Shell和全局user/header。注册/找回/演示入口继续明确各自实际状态。
- P003提交真实账号和密码；请求期间有可见忙碌/aria-busy、原生disabled及同步防重锁。失败保留允许保留的表单输入，不在local/sessionStorage/日志写密码。
- 登录后留在当前会话卡，显示真实用户及受权研究摘要；无成员明确等待Study邀请，不跳进本机演示研究列表充当正式工作区。研究工作区未接线的限制常驻显示。
- 刷新页面通过me重建身份；“刷新会话”重验，401清除当前展示。退出仅在服务端响应ok后清展示；失败可重试，无自动重放。
- 演示须独立显式入口；不以正式请求失败自动进入演示。正式会话不会自动转为王教授/PI或写入演示用户资料。

## UI/UE验收

页面：P003门户；连带P004/P005表单及P008/P009账号帮助说明。科研人员/租户管理员均走原会话接口；后台/旧工作台不改权限或页面，当前不交付管理成员功能。

复用ls-auth-grid/story/card、ls-primary/secondary/feedback/mode-note既有公共门户样式。门户输入/按钮16/24、错误/重要限制至少14/22；不放大全站操作正文。必要状态样式仅限本组件；不引入图标/字体/设计系统。

测试：真实HTTP客户端单元（配置缺失无请求、固定租户、同源Cookie、401/网络/超时/坏响应/退出未确认）；合成PG真实AuthController/AuthService/JwtAuthGuard→真实React页面的登录/刷新/退出/无成员/管理员/错误/重复提交浏览器链，截图录屏及computed字号。测试壳不等于完整main生产装配。

必须区分代码/本机配置/真实请求/用户效果；无全新真实注册、邮件发送、邀请或AI执行，不得称这些能力完成。生产未配置/未发布；默认前端构建如缺公开slug，明确显示未配置。
