# Hub Token最小闭环 · 设计评审记录

日期：2026-11-11。对应[设计稿](../../superpowers/specs/2026-11-11-hub-token-reconciliation-design.md)。仅规格评审，不是代码总评审/功能验收。

## 独立审查与修订

独立只读审查者：`/root/hub_token_design_review`。核对旧Billing/Sessions/Schema、Hub会话及模型装配；没有修改代码、数据库或调用模型。

初轮5项重要缺口：旧正常路径并无共同reservation advisory锁；到期与恢复临界区未明确；持久attempt及外层封口协议不足；租户跨项目审计RLS与当前管理员校验未明确；真实未知记录在本片可处理性表述过宽。主实现补充第4–6节：区分旧CAS、新兼容锁、失败结算时机、AuditLog回执协议、原已有受控elevated事务及未知只展示待核实。

限定复核确认原5项已解决，另指出：仅reservation行锁不足以阻止并发reserve在旧到期后读到MVCC旧值并再预留容量。审查结论为“补齐旧同名quota锁及顺序后，没有其他重要阻断；B01仍需实证，第7节UI待确认”。主实现随后补齐`aisci-token-quota:<tenantId>`共同锁、数据库当前时间检查、统一顺序及真实PG竞争反例；已只读核对旧`BillingService.lockTenantQuota`的精确锁名。

这是独立评审的条件结论与作者补齐，不冒称又做过一次独立代码复签。B01若证伪无旧源码/DDL适配的假设，必须停线提出最小差异。

## 本轮验证与未做项

- 现有`node --test scripts/business-ai-provider.test.mjs scripts/business-ai-quota.test.mjs`：10/10通过；只证明现行基线，不证明新增结算/权限已实现。
- 新设计/Living spec本地引用检查3项通过；本轮产品文档定向`git diff --check`通过。
- 本机19501–19507原有服务只读status均ready；未重启、未改运行配置。
- 本轮只有设计文档与确认记录；无业务代码/页面/数据库写入，无新增额度或付费模型调用，历史15笔和未知第12笔未处理。
- 本轮不做构建、Playwright或业务API写验收：没有业务实现或页面变化，不能重跑旧截图/旧PG当新功能证据。后续B01–B06及独立代码总评审、真实管理员浏览器验收仍全部待实施。
- 新第7节G02局部交互待用户确认；既有租户内对账权限不重复申请。开发临时金额/次数门槛已取消这一事实按11月5日现行规格纠正，本片不恢复。

规格与本记录随项目文档同步Notion；同步不改变功能启用状态。
