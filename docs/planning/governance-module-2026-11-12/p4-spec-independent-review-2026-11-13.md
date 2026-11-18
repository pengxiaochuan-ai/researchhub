# P4实施规格独立评审记录

日期：2026-11-13。范围：完整最小规格、M01–M07/F01、Q01–Q16计划及Proposed ADR-0010。本轮仅文档，未实施功能。一次独立只读评审，无二次循环。

结论：Critical 0、Important 2、Minor 2；作者已对照真实源码集中修正文档，具备提交用户评审的条件。此结论不代表用户批准、代码实现或业务验收。

| 发现 | 依据 | 集中处理 |
| --- | --- | --- |
| Important：owner报告菜单缺artifacts | server/research-analysis/t17-reports.mjs要求artifacts及artifact.*按钮 | M02精确加入新隔离组角色的artifacts菜单，仅read/create；不授review/release/export，不改旧角色 |
| Important：DataQuery不存在answered状态 | app/server/src/study-operations/formal-response-data-query.ts回复后仍open，仅close变closed | 统计／G02只用open/closed，回复情况由真实journal派生，不扩状态机 |
| Minor：角色不是group外键模型 | PermissionRole只有tenantId，无studyGroupId | 明确tenant内独立副本仅由新组owner成员关系引用，前后核对全部引用；isDefault=false |
| Minor：assign不能改截止日 | 原task合同只有edit支持dueDate | 已有未终结任务同事务edit→assign，传中间CAS版本；任一失败整批回滚，加入Q11反例 |

其他已核：QL01–14未删；三例T15不泛化；SDV字节hash／固定修订／追加事件、任务单一权威／同事务、质量报告聚合／原治理、Worker不适用显式说明、F01单列和工期均清楚。50–68h加缓冲并非11月中旬两天交付承诺。

作者额外收紧：仅三表及1个配套SECURITY INVOKER父链／追加约束trigger函数／对应触发器纳入待批边界，不授应用显式EXECUTE；额外函数仍停线。本项是规格细化，不称数据库已落地。所有SQL在后续Q03精确验证。

本次未访问数据库／HTTP／浏览器、未运行夹具／模型、未改权限／服务。前序准入的25测试和Chrome证据只作历史事实，本轮不冒称新执行。

[规格](../../product/governance-p4-quality-spec-2026-11-13.md) · [授权](p4-authorization-2026-11-13.md) · [计划](p4-implementation-plan-2026-11-13.md)。建议下一项：用户确认规格和M01–M07／局部交互，先执行Q01合法Study范围与最小权限验证；F01到调用前另确认。
