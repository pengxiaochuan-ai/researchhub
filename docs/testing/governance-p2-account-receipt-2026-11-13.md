# P2 受控账号回执与原提交恢复：验证记录

日期：2026-11-13。**结论：获批回执层完成本机后端验证；P2整体、完整启停守门、HTTP／G03、用户业务及生产验收未完成。**

## 1. 执行范围

用户批准 P2-M01～M04 后，又单独批准单一账号回执函数与精确 EXECUTE。本轮只持久安装此函数，业务验证均在受限应用角色中执行并整体回滚。没有扩席位、创建持久账号／Study、变更原两账号、启用新业务权限、接临床库、收费调用、重启服务或真实发布。

内部契约见[技术规格](../technical/governance-account-receipt-2026-11-13.md)。前序 RLS 阻断报告与失败证据保留，不覆盖历史。

## 2. 真实执行结果

| 项目 | 当前证据 |
| --- | --- |
| 受控读取／固定投影 | 应用角色仍无法 SELECT 空项目旧审计；受控函数仅返回当前管理员本人具标记回执，无私有 meta |
| 当前授权 | 跨租户、错操作者、缺上下文、错误／已陈旧当前 authVersion、当前普通角色均拒绝 |
| 异常数据 | 无标记旧日志、其他操作者／动作／组不返回；错误结果、错误目标、重复键拒绝 |
| 安装安全 | 明确目标、owner、search_path、撤销 PUBLIC 和精确 EXECUTE；重复安装不变；仅改 STABLE 属性亦拒绝漂移 |
| 原服务同事务提交 | 实际 `aisci_app` 连接复用旧 AccountsService；停用退回25个临时 Token，同键恢复不再次执行或退额 |
| 版本与原结果 | 同键变内容409、新键过期版本409；真实恢复 active 后仍读出原 disabled 提交结果 |
| 失败原子性 | 追加7个临时 Token 后注入原审计写失败，savepoint 回滚后账号 active、余额7、失败键无回执；最终外层全部回滚 |

当前管理员／租户实际停用、并发会话、并发双提交未进行实测。没有为覆盖这些场景修改受保护原账号或创建第二管理员；不能声称这些产品路径已验收。

## 3. 命令与证据

```sh
node --test --test-concurrency=1 server/governance-users/account-receipt-pg.test.mjs server/governance-users/account-receipt-submit-pg.test.mjs
node --test server/auth/session.test.mjs server/wp02/invitation-router.test.mjs
npm run build -- --outDir .tmp/p2-account-receipt-build
node scripts/governance-p2-account-receipt.mjs apply
```

- 真实 PG：**5/5**；会话／邀请相关纯回归：**11/11**；隔离输出构建 **4.77秒**，保留既有大包告警。详见 [PG日志](evidence/governance-p2-account-receipt-2026-11-13/commands/p2-account-receipt-final-pg.log)、[纯回归](evidence/governance-p2-account-receipt-2026-11-13/commands/p2-account-related-unit.log)、[构建](evidence/governance-p2-account-receipt-2026-11-13/commands/p2-account-receipt-build.log)。没有为告警改页面或扩范围。
- 首次应用：[apply-722a6eec](evidence/governance-p2-account-receipt-2026-11-13/apply-722a6eec/result.json)，`applied:true`；补齐安全属性核验后的重入：[apply-8385d852](evidence/governance-p2-account-receipt-2026-11-13/apply-8385d852/result.json)，`applied:false`。均明确数据库、实际连接角色和 UTC 时间。
- 安装前后旧表 ACL／RLS、旧来源函数及角色属性摘要相同：`6d15009f750319b3a03ce1022207e7e9632f2754ae401f953307bbce918cd7fe`。此摘要只证明安装事务前后不变，不是其他会话的全库永久基线。
- [最终受限只读核对](evidence/governance-p2-account-receipt-2026-11-13/final-readonly.json)：原 admin／owner 均 active、原角色及 authVersion=5，仍12账号／10席位，具名M01账号0，四类本轮临时账号残留0。保留历史账本，未做清理。

所有首次失败留存于同目录 `commands/`：缺函数42883；UTC完成时间缺Z；安装预检 aclitem 数组无法被 Prisma 解码（DDL之前，改为显式 text）；缺提交模块；安装器漏核 STABLE 属性。均先失败、再最小修补并重新通过；不删失败样本或自动付费重试。

## 4. 一次独立总评

`/root/p2_receipt_final_review` 只读审查六个实现／测试文件、计划、安装证据和最终日志，独立完成五个 MJS 语法检查及当前 SQL 标记一致性核对。Critical 0、Important 0、Minor 0；未另跑 PG、改权限、写夹具或重启服务。

评审明确只认可内部回执层，不认可完整账号启停已启用。前序复用探测的两项 Minor 证据增强仍在原报告留账，没有重写旧 JSON 假装完成。

## 5. 四层状态与下一落点

1. 代码：受控读取、同事务封套和测试已实现。
2. 本机配置：仅已批准函数／精确 EXECUTE 已安装；内部封套未接运行控制器。
3. 真实执行：应用连接的实际旧服务提交／回滚／原键恢复已验证，不是 HTTP 证据。
4. 用户结果：账号启停、成员维护和 G03 浏览器验收尚未完成，不销 P2 整体。

本阶段无界面／交互／运行装配变更，不创建假按钮或用旧页面截图冒充新能力验收；后续真正接通 G03 时仍须按原布局进行真实浏览器、失败恢复和角色验收。使用说明书没有新增用户操作，因此本阶段不改。

下一落点：继续已批准的账号状态最小安全适配，补完整当前授权、本人／最后管理员／有效负责人、在途任务、authVersion 推进及原回执恢复的统一提交守门，再准备已批夹具。G03具体局部布局仍需先锁定，不因本阶段完成而改页或进入 P3。
