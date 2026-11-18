# P1来源审核原提交恢复 · 实施契约

2026-11-12，属于已批准P1的DG04失败恢复。**用户已批准的单函数EXECUTE已配置到专用合成库，来源页原提交恢复已完成本机技术验证**。复用现有AuditLog，不新增表/列、不改旧RLS/旧系统或审核范围。下方停线/候选描述保留为批准前历史，不再代表当前。[当前实证与失败修补](../../testing/governance-p1-recovery-2026-11-12.md)。

当前差异：GET已注册；PMC/app与object/direct原写角色不变。受控函数只返回kind/input/review，原请求hash从已存参数重算比对。AuditLog采用参数化INSERT无RETURNING，避免ORM自动回读被原RLS拒绝，Hub事务明确project为空，绝不挂靠任意Study。404仅允许用户经原工具栏“重试上次保存”显式重发原键/原内容，刷新和后台核对均不POST；待核对提示跨对象保留并注明原题名。

初次表权限核对只证明`wp01_test_full_baseline / aisci_app`的audit_log SELECT/INSERT允许，不能证明行级访问。真实PG进一步证明：`audit_project_select`只读当前Study记录，Hub级`researchProjectId=null`的回执被RLS隐藏，GET变404，故初版“不需新增GRANT”的结论撤销，候选不可交付。

已撤回本轮未启用的Controller接入；候选服务/测试保留用于评审，所有真实PG夹具和决定均在事务中回滚。未放宽原RLS、未新增GRANT、未改用高权限GET绕过。

## 已复现与取舍

真实外部/工作簿来源页面focus后未保存选择丢失，已RED→GREEN；没有业务写入，原62项来源hash不变。提交未知恢复另一个缺口：PMC按篇没有原请求键；外部/工作簿有operationId但前端每次再生成，队列不是提交回执。

采用来源独立小适配，不建通用任务底座：

1. 新UI的所有统一审核POST均携带UUIDv4 `operationId`。PMC旧调用未带键时继续原契约，不追溯伪造历史回执。
2. 服务端在同一已有事务中，当前具名审核人/租户/账号版本/source.review核验→原请求锁→原回执核对→原审核服务全部现有授权/父对象/指纹/原子提交→AuditLog追加结果。任何失败整体回滚。
3. 回执ID以tenant/Hub/当前账号/operationId确定性派生，主键点查；相同键/相同规范化参数原结果重放，不重复审核；同键不同参数409。记录actor、原对象、原请求/结果，不重写历史，不以当前队列“看起来相同”判成功。
4. 新只读`GET /api/hub-sources/review-receipts/:operationId`，仍是当前具名审核授权、同租户/同账号。返回原kind/input/review，均是版本/标识/范围，不含正文或凭证；未找到404，UI仍视为未知。
5. 前端在发送前保存仅本账号/授权版本的原请求元数据到sessionStorage，不存登录凭证或来源正文；结果未知不发新请求。刷新只恢复待核对标记，绝不自动POST。原键核对成功后回读当前来源再继续；明确404后如支持手动重试只能原键原内容，不是重新审核。
6. 同身份刷新保留选择仅限同一内容/审核范围指纹；切账号、authVersion变化、工作簿单行/批次或指纹变化清选择，当前授权仍由服务器检查。

## 验证门

先回执服务RED→GREEN＋真实PG事务回滚证明审核与回执原子/同键唯一/冲突/当前失权；随后UI真实页面网络丢响应和刷新恢复。真实持久写入仅本轮具名新合成对象；原五份、PMC和历史批次只读。若发现既有audit权限或原服务不能承载则停，不临时提升数据库权限。Backend装配启用前先核对本机在途任务/其他工作，不能用重启中断既有模型任务。

## 待确认的最小读取授权（推荐）

- 新增一个只读受控函数`rh_source.read_review_receipt`，仅授予应用角色该函数的EXECUTE，不授予普通角色更广的audit_log SELECT，不改任何旧RLS策略。
- 函数固定只读`researchhub.source_review.receipt`及`hub-source-review-receipt.v1`这一类；输入绑定当前tenant、Hub、账号、authVersion和原operationId/确定性回执ID。
- 函数内部核对账号/租户有效、当前source.review及当前具名审核范围；只允许读取同账号、同租户、同Hub的精确一笔。白名单返回原kind/input/review；不返回其他审计、正文、凭证或整表列表，不支持任意action/meta检索。
- SECURITY DEFINER仅为上述最小读取，固定安全search_path、表名全限定、参数化查询；无动态SQL或写操作，撤销PUBLIC执行。部署脚本按本机专用合成库严格守门；旧服务不改、不停线。
- tenant参数必须与当前事务`app.tenant_id`一致，任一缺失/不一致拒绝。账号和authVersion仅由服务端认证principal装配，不接受GET输入或客户端自报。函数owner不可由应用角色修改；核查schema CREATE权限防替换，只对精确函数签名授予EXECUTE，禁止同名重载绕过。批准后验证跨tenant伪参、跨账号及并发失权。
- 原审核写入继续原Controller的事务角色（外部/工作簿为既有direct，PMC为既有app），不借回执把PMC写入整体提升；原可见范围/内容锁/来源/当前权限检查全部保留。
- 审核与回执同事务；原键重放调用同一个受控读取，找不到不推定成功或未提交，不自动发起新审核。旧决定不补造回执。

实施前须用户批准该单点读取授权。若批准，在本机合成库验证相邻回执/跨账号/跨租户/失权/畸形ID/RLS原有Study读取不变；再完成UI原请求恢复与新具名合成材料端到端。本项未通过，不切团队页或P2，不称P1完成。
