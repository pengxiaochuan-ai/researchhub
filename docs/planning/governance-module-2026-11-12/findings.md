# 只读核对结论

## 用户确认

总览定稿；本轮排除伦理材料管理、多中心管理。其余先完整设计与分期，不进入代码。不改变已确认布局，不扩大共享底座。

## 历史与现行取舍

- `docs/product/lingshu-product-prd-v2.0.md`：身份、Hub、Study、数据范围独立；G03/G04不能以说明或本机记录冒充正式权限/审计。
- `docs/product/岐研_核心产品模型_科研飞轮_Hub_用户与数据治理.md`：发现不等于访问，Hub成员不等于Study成员，治理不等于批准所有研究。
- ADR-0006：当前有效租户管理员长期默认本租户Study业务权限，仍受状态、版本、同意与审计约束。旧文档相反概括是历史，不删除原记录。
- ADR-0007：12小时活动滚动会话，轮询不续期，网络故障/业务403不当作退出。

## 当前代码与证据

- `pages/shared/G02Page.jsx`：真实分支为总览、来源审核、团队审核、Token对账；演示分支另存。
- `src/platform-shell.js`：八Tab保留；部分标签复用同一路由；数据治理与系统配置在G02上下文重定向现有工作台。S11目前成员邀请，不是多中心。
- `server/research-studies/controller.mjs`：已有授权研究目录、Protocol待审、逐Study正式数据疑问、正式访视/答卷等；不应重造业务引擎。
- `server/research-capture/formal-data-query.mjs`：疑问固定答卷修订及字段，逐Study授权；更正不自动关闭。
- 11月12日T05/T07–T10文档记录本机通用合成软件证据；不等于临床专业或生产验收。本轮不重跑其测试，不代签。
- `server/wp02/invitation-router.mjs`：邀请目标是配置集合，缺通用授权目标发现；注册不默认获得私有Study权限。
- `pages/shared/MemberInvitations.jsx`：已有列表/邀请/重发/撤销/接受；仍有浏览器默认confirm，未来开发该页时局部替换。
- `server/billing/controller.mjs`：已有本租户待对账列表/详情/结算；复用旧BillingService，不另造账本。
- 旧系统`app/server/src/accounts`：已有账号与权限操作，但创建会自动加入默认组；不能直接作为Hub公开注册/任意授权API。
- 旧系统`app/server/src/audit`：租户限定服务端记录、规范化证据；平台管理员只有平台元数据，不应借Hub绕过。
- 现有Account含researchProfile/authVersion/isTenantAdmin；AuditLog已有tenant/group/project/actor/action/target/meta/时间。优先适配，不全建新表。

## 注意

源码存在只证明可复用路径；目标环境开通、真实执行与用户业务验收须未来逐页举证。本轮无DB读取/写入、外部模型或生产访问。
