# 岐研AI数据Agent · 精确执行入口合成验证

日期：2026-11-17（Asia/Shanghai）。用户分别批准公开单任务执行入口及raw管理员原生授权一致性。只用于当前完整复用旧数据Agent主线，不恢复其他计划。

## 实现和复核

- `RawProcessingService.executeClaimed`是可信进程内入口，校验ref/启停/租户后复用`withWorkerPublication`，真实当前权限/来源/claim通过才触碰文件。只处理传入的已认领单一任务，不公开HTTP或LLM ref参数，不自动claim、扫描、恢复。
- `process`新失败传播选项仅入口传true；原tick默认false不变。错误原生登记后仍向调用者抛出，finally停止心跳、等待续租和清临时目录。真实needs_review保持，不冒称科学值已导入。
- raw管理员委托既有`authorizeIngestInTransaction`，保持当前账号/管理员标志/租户/active组及项目检查；其他Worker及科研人员保持原权限。未新建角色/成员或GRANT。
- 一次独立只读总评通过；其心跳、同事务、JSONL日志、既有身份行保护意见均已落实。损坏XLSX进一步记录了真实unzip退出码9，排除未安装工具造成的假解析证据。

## 验证证据

两组失败测试先证明入口缺失、raw管理员与上传授权不一致；随后修补。最新定向8文件共50项通过，包含生产者/手工导入原授权、raw scope/真实表格处理、Worker授权/claim/publication/consumer装配。`pnpm exec tsc --noEmit`通过，无旧dist覆盖或服务重载。

[真实结果](../planning/qiyan-ai-data-agent-complete-2026-11-17/exact-rollback-result.json)记录15项PG检查和两源码SHA、起止时间。执行脚本 `scripts/data-agent-exact-rollback.mjs --run-approved-rollback`，默认/--preflight仅READ ONLY。首次租户trylock被占用时在建夹具前退出，[新连接只读核对](../planning/qiyan-ai-data-agent-complete-2026-11-17/exact-rollback-window-busy.json)确认零新行；后续可用窗口运行约1秒。

- 原admin、原Study/执行项目，1个新假名被试、2文件、2任务；所有forTenant/withTenantTransaction/elevated.$transaction/心跳/失败发布绑定同一受限app事务。
- 原生RLS拒绝跨tenant/错误group/project；queued、错误token/owner、过期lease、终态拒绝；删除新来源/无效新任务actor拒绝，未改旧账号或成员。
- 下载错误、真实损坏XLSX解析拒绝均正确登记并传播；在途executionToken变化不发布结果。每一负例在savepoint回滚，不是产品自动重试。
- A真实claim→实际旧CSV parser→needs_review/100%；rawBytesSentToModel=false，valuesImported=false，Feature为0。B任务/文件完整行及其Feature、audio ProcessingStatus、目标Audit不变。
- 唯一sentinel强制整个PG事务回滚，随后另开只读连接核对Subject、两文件/任务及关联Feature/ProcessingStatus/Audit全0。隔离JSONL日志另存 `researchhub/.tmp/data-agent-exact-20261117/logs`；文件日志不是PG回滚的一部分。

## 边界和未完成项

本次既有current group/project可见processing_task为0，空集摘要不得用于声称全租户历史任务已经逐行保护实测。没有修改旧行的真实账号/成员撤销竞态，也没有执行行锁等待后过期的真实双连接竞态；本次是已过期DB租约及在途代次失效验证。未启用全租户轮询/恢复、未接真实对象存储或模型、未重启/切换旧服务；0模型费/云资源/新权限。

本次只交付精确执行入口与合成数据库边界。AI01普通新会话上传→被试/访视确认→档案/眼动实际导入→任务/结果解释尚未整体接线或真实浏览器验收，不销项完整旧数据Agent复用。页面/URL/用户操作未变，本次UI截图/录屏和使用说明新增步骤不适用；完整AI01链后续必须真实浏览器实测。
