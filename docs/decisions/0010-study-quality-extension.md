> 当前状态（2026-11-13）：用户确认P4新增工作台延期，本Proposed ADR保留设计，不获准迁移／授权，恢复日期未定。

# ADR-0010：Study质量事实和任务关联最小扩展

状态：**Proposed，待用户批准P4规格；未创建schema／表／权限，不是Accepted。**

日期：2026-11-13。

## 背景

[P4准入](../planning/governance-module-2026-11-12/p4-admission-2026-11-13.md)已证实：旧DataQuery没有任务责任人，ReviewEvent没有SDV原件定位合同；运行、任务、报告已有事实和执行核心。直接扩旧公共表会联动旧消费者，另建一整套质量／任务／报告则重复建设。

## 拟议决定

复用ResearchMethodRun／DataQuery／StudyTask／Artifact等已有表及原事务核心。仅在Hub所有的`rh_quality`内增加追加式`sdv_event`、不可覆写`query_task_link`、命令幂等`operation`三表及1个check_parent_scope()的SECURITY INVOKER父链／追加约束触发器函数和对应触发器，具体字段、父链、唯一约束及授权见[P4规格§8](../product/governance-p4-quality-spec-2026-11-13.md)。强制RLS／FORCE RLS，应用仅USAGE／SELECT／INSERT，无删除／更新／SECURITY DEFINER；不改public、旧Prisma迁移历史或旧RLS。

SDV事件存固定原件内容hash／定位和CRF修订，不复制答案；更正追加事件，旧事件失效不删除。任务责任人和状态只来自原StudyTask；新关联不成为第二套分派。ResearchMethodRun储存质量manifest／结果版本，新报告使用原Artifact类型区分及导出治理。

旧核查Worker不支持的CRF规则在Hub复用表单确定性校验核心，不假造旧Worker输入或默认医学阈值；旧共享Worker消费者／扫描器隔离须先验证，不能为P4扩做通用队列协议。

## 取舍与后果

- 不把SDV结构塞进ReviewEvent.reason，不给DataQuery增另一份负责人，不新增run／report／文件表。
- 只有三张新表的精确SQL／ACL满足规格才可在后续获批合成环境应用；三表配套单一trigger函数撤销PUBLIC执行，不新增应用显式EXECUTE；额外函数／权限、旧表改动或旧代码修改需再次确认。
- 新原件读取适配按ADR-0006处理管理员；不为兼容旧rawContent硬成员条件而伪造成员或绕过当前来源校验。
- 本ADR不批准实际迁移、业务夹具、AI费用或生产操作；对应[授权清单](../planning/governance-module-2026-11-12/p4-authorization-2026-11-13.md)待批。
