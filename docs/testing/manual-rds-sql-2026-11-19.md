# 手动RDS建库与结构SQL：本机验证

2026-11-19；对应[执行说明](../technical/manual-rds-setup-2026-11-19.md)。用户本轮要求写SQL并指导手动创建库/账号，本轮无远端RDS写入，无TLS/容量/实例变更，无页面修改、模型调用、邮件或发布。

## 实际环境与交付

- 来源：此前冻结的单Hub租户专用合成快照，182表、98,565行；源数据库写入0。完整数据/私有结构不进公开Git或Notion。
- 最终SQL：本机.tmp/manual-rds-researchhub-20261119/package-final；8份SQL及README/role-map/manifest/SHA清单。
- 新测试容器rh-manual-sql-20261119-d，network=none，无宿主端口；PG16.14/vector0.8.2，与aisci-pg旧服务分离。
- 03仅测试中将目标版本0.8.1.2替换为0.8.2，用本机postgres模拟供应商扩展安装权限。迁移/数据导入操作者aisci_control为本轮新建的本机角色，非超级用户，有CREATEDB/CREATEROLE/BYPASSRLS及本轮角色管理关系。01创建BYPASS角色本身仍由本机超级用户执行，不能据此证明RDS允许。

## 已执行结果

| 检查 | 实际结果 |
| --- | --- |
| 00/01/02/03 | 新角色NOLOGIN、新researchhub创建、vector探针及marker通过；02由非超级用户执行 |
| 04 | 全部182表及配套类型/函数/序列安装成功，非超级用户SET到新owner |
| 错库保护 | 在同一新隔离集群临时aisci哨兵库执行04被MANUAL_WRONG_DATABASE拒绝；仅该新哨兵，未接真实aisci |
| 04重跑 | marker阶段不符被拒绝；不DROP/覆盖 |
| 05过早执行 | 无行数据时MANUAL_DATA_COUNT_MISMATCH拒绝 |
| 全量选定数据导入 | 182份源文件SHA逐份核对、98,565行恢复；保留identity显式值，精确映射collector策略身份 |
| 05/06 | 完整索引/FK/触发器/RLS/ACL通过；182表、179强制RLS表、209策略、invalid indexes=0 |
| 7个identity序列 | 按导入最大值setval；7份回读分别断言last_value及is_called，空表首次值1 |
| 源未验证CHECK | 原样保留3个NOT VALID CHECK，不擅VALIDATE；名称与原因见执行说明 |
| 07占位口令 | 正常拒绝，未启用账号 |
| 07错source SHA / 错数据库owner | 分别被来源/owner守门拒绝；模拟更改位于失败事务并回滚 |
| 07正向 | 内存生成2份新口令，真实ALTER ROLE成功后全ROLLBACK；最终4角色仍NOLOGIN |
| 临时授权 | 最终owner→analysis_reader成员关系为0；不授app旧角色关系 |

另对182表逐份按源列读取目标行，按JSON规范化排序计算SHA256；除明确的collector角色映射外，全部源/目标内容摘要一致（182/182），不仅是行数相同。

最终阶段16组实际SQL/导入案例通过，另有7个序列回读断言；纯规则7项＋原快照规则4项，共11项通过。它们不是11个模型任务，无新增AI费用。脚本无浏览器功能变更，本轮未执行也不宣称页面/专业验收。

## 失败与修正记录

1. 首次本机测试操作者忘记LOGIN；只修本轮测试夹具，不影响SQL或旧角色。
2. 用postgres模拟03导致CONNECT授给postgres；为非超级用户验证者补本轮新库CONNECT，明确同一操作者限制，未改真实RDS。
3. 05计数先于SET ROLE导致NOINHERIT操作者无public权限；将数据核验放到明确的新owner上下文，RESET后再做临时授权；新实例完整复验通过。
4. 首次数据恢复遗漏identity的OVERRIDING SYSTEM VALUE，事务失败回滚；导入器修正后完整恢复成功。
5. 独立评审P2：07缺owner/source SHA绑定；补齐生成守门及未展开模板强制拒绝，错SHA/错owner与正向回滚均通过。
6. 数据导入后发现7个identity序列需要恢复进度，补精确库存和setval；最终包在全新容器重做全量恢复及约束/角色验证。

私有证据：local-final-receipt.json、verify.stdout、final-state.stdout、seq-*.stdout、content-verify.json以及各阶段stderr保存在.tmp/manual-rds-researchhub-20261119。失败数据错误日志仅本机，不在公开文档摘录行值。

## 仍未完成的环境验收

RDS PG18.3/vector0.8.1.2、RDS的BYPASS/SET ROLE能力、DMS同会话事务、容量与网络未在本轮实际执行。先由用户00→04成功并反馈，之后再做目标演示数据/对象文件恢复、内容核验、05→07及目标运行时准确配置；不得直接启动历史消费者。未部署后端、切入口或验收客户页面。

独立只读复审已关闭07问题；手册和本证据文件交付前再核链接。不能用本机通过替代客户环境和专业结果验收。
