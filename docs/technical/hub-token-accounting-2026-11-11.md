# Hub Token API与持久回执

仅ResearchHub独立装配，复用原BillingService/UsageRecord/token_quota_reservation/AuditLog；不修改旧源码或权限，无DDL。当前本机装配在`local-knowledge-ai.mjs`及`local-knowledge.mjs`，不是生产部署指令。

## API

| 方法/路径（`/api`前缀） | 当前身份与返回 |
|---|---|
| GET `/hub-billing/me` | 当前有效本人，原业务额度投影；读取不预留 |
| GET `/hub-billing/reconciliations?page=1&status=pending` | 当前有效租户管理员；pending/settled、固定每页20、无操作次数上限 |
| GET `/hub-billing/reconciliations/:id` | 同租户详情，任务、逐次调用概要、已知部分/完整用量、处理人/时间；不暴露密钥或内部claim |
| POST `/hub-billing/reconciliations/:id/resolve` | JSON同源；仅requestKey/fingerprint/action，完整一致服务端凭据才settle，不接受任意手填用量或目标身份 |

所有响应no-store；401会话失效、403非管理员/来源拒绝、404跨租户或不存在、409快照/幂等冲突、422证据不足、503不可用且隐藏数据库细节。未知记录无人工release依据，返回422；新执行明确未发出仍沿原catch释放。无充值、Grant或钱包接口。

## 持久性与并发

共同授权`wp01:tenant:<id>`→原`aisci-token-quota:<id>`→原平台兼容reservation advisory锁→预留行锁。实际发HTTP前在事务内重验当前执行/权限/资料，登记attempt.started并仅对这笔新active预留设置9999到期，防崩溃/15分钟到期漏占。

结束/未知/外层封口及不一致均追加现有AuditLog，schema=`rh-token-attempt.v1`。一条缺失或不一致即不可结清；各attempt严格绑定tenant/account/reservation/session/job/claim/model。保护回调明确失败与COMMIT确认丢失分别处理。

正常成功在原Message/UsageRecord/预留事务内封口并逐模型比较，沿原CAS，只写原一笔用量；异常catch封口后完整消费由Hub原子写一笔UsageRecord＋CAS预留＋审计。拒交付/撤权不免除已发生消费，不添加助手成功消息。原始成本估算不重算，新增失败用量不伪造人民币成本。

人工处理需当前active账号/租户/authVersion、role=tenant_admin且isTenantAdmin=true，部署允许租户；锁内重读真实归属和原claim，live拒绝；两个请求键最多一笔消费，同键同内容回读原结果。已结算/未知/更换claim不能再扣。

## 文件与运行边界

- `server/billing/`：持久保护、回执/完整性、原子服务、实例代理和Nest控制器。
- `pages/shared/TokenReconciliation.jsx`＋`src/hub-billing-session.js`：G02已批准叶子、站内弹窗、当前身份及迟到请求隔离、按身份会话恢复请求。
- 独立合成租户夹具只验证记账协议，没有模型调用，不能计为体验账号真实消费。原15笔和未知第12笔单独保全。
- [验收证据与限制](../testing/hub-token-accounting-2026-11-11.md)。
