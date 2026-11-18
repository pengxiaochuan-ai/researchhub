# P2 账号操作回执：接口与数据库契约

## 2026-11-13最终：P2服务复用与本机技术验收完成

下述回执契约保持不变；其外层P2／G03已完成39相关测试、581前端、真实PG／HTTP／SMTP及Chrome验证。短协调窗口已解除，原两体验账号和旧服务保持。用户体验签收与生产发布尚未执行，详见[最终逐项记录](../testing/governance-p2-g03-2026-11-13.md)。后文前置阶段状态保留为历史。

## 2026-11-13后续：已由窄P2服务复用（当时整体验收未完）

本函数与内部封套本身仍不直接对外开放；新增`governance-users/service.mjs`在其外层补当前管理员／本人／最后管理员／有效负责人／在途检查，绑定旧AccountsService，原子更新authVersion后由原审计捕获结果，再由窄Controller提供账号状态／回执接口。成员动作沿原Study审计补防重，不新增表／RLS／函数授权。具体接口、实际本机配置、真实主链及待验范围见[当前实施台账](../planning/governance-module-2026-11-12/p2-g03-implementation.md)与[本轮证据](../testing/governance-p2-g03-2026-11-13.md)。以下“完整资格尚未实现”为前置回执阶段快照，不能用于否定已实施代码，也不能反过来宣称P2全部验收。

日期：2026-11-13。范围：已批准的单一受控回执函数、同事务原提交恢复；**不是完整账号管理接口，不向 HTTP／G03 开放**。

## 1. 为什么不直接读取旧审计

旧账号启停写入租户级 `audit_log`，其 `researchProjectId=NULL`。原 RLS 允许写入但不允许应用连接查询这类行。不能虚挂 Study、拓宽原 RLS，或借用仅供来源审核的回执函数。用户已单独批准只增下列函数及精确 EXECUTE，不增加业务权限。

```sql
public.researchhub_read_account_receipt(text,text,integer,text) RETURNS jsonb
```

本次安装限定 `wp01_test_full_baseline` 和当前合成租户；不是可直接部署到其他环境的通用迁移。以后部署须另行核准目标与租户。

## 2. 数据库边界

- 所有者为既有 `aisci_owner`；`SECURITY DEFINER`，固定 `search_path=pg_catalog`，业务表全限定名，无动态 SQL。
- 撤销 PUBLIC 执行，只向 `aisci_app` 授予上述精确签名 EXECUTE；不改表 ACL、RLS、旧来源回执或角色属性。
- 输入必须匹配服务端设置的 `app.tenant_id/account_id/auth_version`。按既有 `official → tenant` 授权锁顺序等待，再查询当前数据库中的有效租户、有效管理员及 authVersion；不按邮箱或客户端角色判断。
- 仅查询本人、本租户、空 Study／组上下文、`update_account`、`researchhub.account-status.receipt.v1` 标记和原 requestKey。目标仍须属于本租户。
- 仅投影 requestKey、requestHash、完成时间以及结果中的 id/status/version/authVersion/refundedTokens。无记录返回 null；异常、重复、无效身份拒绝，不返回完整 meta、邮箱、密码或其他操作者记录。
- 完成时间输出规范 UTC ISO 字符串；旧表 `timestamp` 按现有 UTC 存储约定解释。版本和退额格式再由内部 JS 接口严格检查，失败不猜测结果。

安装器仅显式 `check|apply` 使用，不在运行服务启动时执行。重复应用核对函数体、签名、返回类型、owner、固定配置、VOLATILE／非 STRICT／PARALLEL UNSAFE、无默认参数、标记和执行 ACL；漂移直接拒绝，不自动覆盖或删除。

## 3. 内部提交契约

`readAccountReceipt({db,principal,requestKey})` 返回上述固定回执；身份错误403、回执不可核对503，不能把数据库故障当作“没有提交”。

`submitWithAccountReceipt({db,principal,input}, submit)` 只接受目标账号、目标状态 active/disabled、原 updatedAt 版本、requestKey。摘要由服务端按固定字段生成。

1. 在同一事务内取得当前授权及原回执：同键同内容返回原结果，不再次执行旧服务；不同内容409。
2. 无回执才检查目标真实租户及原版本，过期409；不从目标当前状态猜原提交。
3. 受信任的内部 submit 回调复用绑定同一 tx 的旧 `AccountsService.update`，不允许另开事务或外部 I/O。
4. 拦截旧服务唯一 `auditLog.createMany`，在原审计中补服务端标记、键、摘要、目标和实际结果；不新建审计库或退款算法。必须实际写入1条。
5. 同事务回读固定结果。状态、退额和回执失败一起回滚；外层必须传播错误并回滚，不能吞错后提交。

这层只提供回执与防重封套。**完整业务资格由调用方负责**：禁止本人停用、最后管理员／有效负责人保护、在途任务检查、完整状态动作与 authVersion 推进均尚未实现／接入，不能直接包装成开放端点。恢复后的旧凭证失效也尚未由本层完成。

## 4. 验证与交付边界

真实应用连接已验证重复提交不重复退额、同键冲突、版本冲突、后续恢复不覆盖原停用回执，以及审计失败时状态／退额／回执一起回滚。仅一个函数持久安装，其余合成业务夹具整体回滚；未执行 M01–M03 持久开户／Study／席位调整。

详细命令、红绿测试、安装与只读核对见[验证报告](../testing/governance-p2-account-receipt-2026-11-13.md)。未接 HTTP／G03，尚无该功能的真实浏览器或用户业务验收；不以 PG 通过替代四层交付。
