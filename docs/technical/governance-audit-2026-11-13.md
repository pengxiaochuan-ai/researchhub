## 2026-11-13 · 获批G04移动适配已实测

仅G04加入page-linking的source-real标记、platform-frontend既有Hub移动导航和hub-source-responsive白名单；真实G04不再创建旧workflow开关，其他页面分支不变。桌面几何保持220px侧栏，390/320默认收起／页签横滚／原顺序纵排，菜单沿旧遮罩、inert、Tab焦点圈定及Esc归焦。原生200%实测DPR2/visualViewport.scale1，采用完整CDP截图校核，不把Playwright原生缩放裁剪图误作完整视口。无后端／数据库／权限／重载变化。

# P5只读审计API与证据投影

日期：2026-11-13。本机专用合成目标；当前代码／READ ONLY PG／真实GET已执行，完整浏览器交接见[验证记录](../testing/governance-p5-2026-11-13.md)。不宣称生产部署。

## 边界与复用

复用旧`sensitive-audit-policy.normalizeAuditEvidence`，按旧AuditService相同的固定租户受控elevated最小读取模式接Hub日志。旧list已将未知meta裁为legacy且使用偏移分页，故不直接代理；新service只读原AuditLog、Account及指定原业务记录／回执。没有新表／函数／GRANT、没有修改旧RLS／源码，应用写路径不变，历史审计不改写。

当前持久Account必须active、role=tenant_admin且isTenantAdmin=true，authVersion与当前令牌一致，Tenant active；查询前后均复验。role不能按邮箱／cookie里的旧称号兜底。普通研究者和platform_admin不获得本租户审计正文；固定tenantId不接客户端覆盖。

本地装配在`server/governance-audit/controller.mjs`使用fixture guard direct READ ONLY（与旧AuditService受控elevated模式相同的权限含义），每次验证专用库marker。临床库／旧服务／生产不接；没有为方便读取放宽app AuditLog RLS。

## API

- `GET /api/governance-audit`：take默认20、1–100；skip表示页位置0–100000，首屏为0；action为真实操作代码，target限安全对象ID；下一页须带服务端签名cursor。非零skip无合法cursor拒绝，参数覆盖tenant／未知字段／签名不符／换身份／换筛选均拒绝。
- 排序`createdAt DESC,id DESC`；沿共享capture cursorCodec签名绑定tenant/account/authVersion/take/action/target和末行时间／ID／下一位置，实际查询seek而非SQL offset。并发新增较新记录不使第二页重复旧第一行；total是当前匹配数，不称跨请求MVCC快照，刷新重新取最新。前端history保存筛选与分页栈，回原页可还原，旧签名失效应重置查询。
- 返回items(id/createdAt/actionCode/actionLabel/actorLabel/objectId/result)、total/take/skip/nextCursor/actionOptions。列表SQL不select meta。未知操作使用“其他操作”，操作代码可在详情按需看；不从action推断成功，原记录无结果字段显示“未记录结果”。
- `GET /api/governance-audit/:id`：固定tenant原记录、白名单evidence和经过证据／当前父对象重核的navigation。证据不成立无业务回链，原记录可留最小审计信息。
- 401认证失效，403无本租户审计权，404无可读记录，400参数／游标无效，503读取不可用。失败不返回伪空集、不自动注销。全部`private,no-store`。没有POST/PATCH/DELETE/export端点，不调用旧exportBundle。

## 已接证据与限制

| 类型 | 核验与展示 |
| --- | --- |
| researchhub.protocol.* | 原rh_research.operation匹配audit_id／actor／action／target，白名单方案版本及该次提交后状态；回链前确认当前protocol／group／project／binding真实父链，不把当前状态覆盖历史决定 |
| directory_decision_* | 同租户原decision的assertion、reviewer和request_hash对应，仅决定与版本 |
| directory_team_* | 原team_draft.operations匹配actor／hash／operation，取该次草稿版本；归档或非当前Hub团队无维护回链 |
| update_account | 匹配原账号状态回执schema与targetAccountId/result.id、实际同租户账号；仅历史状态，不输出username target或口令 |
| pi_project_member_change | 原项目父链及原hubResult账号匹配，只显示该次成员状态／既有角色，不输出原理由全文 |
| researchhub.source_review.receipt | 原回执schema、输入目标与审核回执存在性；只称“回执已保留”，不推断当前公开／AI授权。可进入原审核列表，未声称固定标题定位或已验证全部旧来源决定 |
| hub.token.reconciled | 同租户reservation的settled／UsageRecord引用／account／actualTokens与原回执／UsageRecord.totalTokens一致，只显示该次已结算Token；不取任务正文／密钥／余额、不改账 |
| sensitive-audit.v1 | 旧normalizer验证通过后还核row的scope／actor一致，再仅显示安全记录类型，不透传临床before/after |
| 其他／缺证 | unrecognized=该类尚未投影；missing=原meta缺依据；unavailable=依据不能核验；不一律说原数据丢失，不补造历史 |

纯字典使用Object.hasOwn，constructor／__proto__／toString等不会命中继承值。自由reason、reply、附件／邀请URL、任意meta、患者答案、执行输入和提示词不进入返回正文。目标链接仅站内固定路由，点击后原业务页再次校验；不能从审计读权获得额外业务操作权。

## 前端与恢复

G04原工作区Shell／列表容器保持，行内只读展开，简短操作／对象筛选和原位分页；没有新分栏或删除／导出按钮。role／identity事件、焦点／可见重核、查询切换共同递增epoch并清旧列表和详情；详情另有请求序号，迟到响应不能回填。网络／5xx和业务403不同于登录失效；初始me失效按统一安全returnTo回登录。

新增链只在真实G04分支，显式演示仍明确演示；真实路由不读取browserDemoStore.events。操作14/22，长标识自然换行，错误保留筛选，重新读取不重放业务写。P4延期不移除已有审阅锁定／放行规则，审计只呈现原发生事实。
