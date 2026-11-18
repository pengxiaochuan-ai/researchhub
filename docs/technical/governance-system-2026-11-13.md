# P6 系统配置：现有对账与只读服务状态

## 边界

用户要求推进已批准SY01–04。继续复用TokenReconciliation／HubBilling／旧BillingService及追加审计；不建新账本、配置库、角色、授权或探活扫描器，不修改旧app，不读.env正文／远端控制面，不发模型请求。

真实G05通过`systemConfigTarget`安全转到`/pages/g02/?view=token-reconciliation`，仅携带唯一且合法的record。显式演示及未配置环境维持旧分支。原对账列表／弹窗和Frozen Shell保留，末尾增加只读服务状态表；原刷新同时更新两部分，状态失败可单独重试。

## 接口与权限

`GET /api/governance-system/status`，无查询参数，响应`Cache-Control: private, no-store`。

固定合成租户的READ ONLY事务，读取前后均核对当前账号active、租户active、tenant_admin、isTenantAdmin、authVersion及实际账号ID；不得根据邮箱、前端菜单或旧JWT孤立角色放行。科研人员、跨租户、旧版本／伪造角色拒绝，query覆盖拒绝。仅复用现有账号SELECT，无DDL／GRANT。

响应白名单：schema、observedAt、services。固定五项account/email/parser/vector/ai，每项仅key、固定label、configuration、check.status／checkedAt；不传任何配置正文、密钥、端点、文件路径、内部错误或供应商余额。

configuration为configured／missing／unknown。check为passed／failed／unknown：有配置且结果类型与过去时间有效时才呈现原检查；否则未知。原检查时间不因刷新而变成当前时间，observedAt仅表示状态读取时间，不表示重新探测。

## 已有状态来源

| 服务 | 本机来源 | 当前检查含义 |
| --- | --- | --- |
| 账号登录 | 已装配HubAuth | 已配置；没有独立健康探测，检查未知 |
| 账号邮件 | 已加载且启动的WP02本机捕获与mailer | 已配置；没有新发信，检查未知；不代表公网邮件投递 |
| 文档解析 | 原启动循环已经执行的parser/health | 原成功时间；不是刷新时的新探测或全文解析验收 |
| 向量检索 | 原启动循环已经执行的embed/health | 原成功时间；不是刷新时的新检索质量验收 |
| 科研AI | 原装配已验证hasKey的科研执行适配器 | 已配置；未新增付费探测，检查未知，不代表供应商在线或额度足够 |

没有第二套检查定时器。原依赖退出时仍遵守原host停机行为；页面不可读取时不显示伪造健康。生产装配尚未启用，本机状态源不能冒称生产可用性。

## 前端与恢复

GovernanceServiceStatus复用共享Button与DirectoryIdentity，状态请求独立于账本读取。身份checking/unavailable、账号版本变化和卸载立即隐藏／失效旧数据，generation与sequence丢弃迟到响应。网络／5xx只显示可恢复错误；401／403先按HTTP状态处理，不依赖错误正文JSON，不回传原诊断。2xx须五种唯一服务与枚举／时间满足契约，畸形响应拒绝。

原对账页加载新列表时，核对按钮及open入口暂时阻断，避免筛选已切换但仍操作旧行。结算权限、未知用量保留、在途保护、原键防重／回执规则不改，本轮没有调用resolve。

## 验证与限制

[验证报告](../testing/governance-p6-2026-11-13.md)记录10项新增契约、24项相关、652项当次前端测试、6.35秒隔离构建、真实PG只读与Chrome九组路径。新增数值为测试数量／构建耗时，不是模型生成的科研数值。独评1Important已修补后作者回归，无第二轮独评。本机重载的协调判断错误有留痕，不把其他会话快照当作安全排空证据。
