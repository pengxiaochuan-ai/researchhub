# T16 当前审核角色回执微补丁窄审

2026-11-12。独立代码窄审 `app/server/src/research-methods/formal-descriptive-runs.ts`，SHA `e2f863460b5a760b70cf54a74eb6aa8a771226088e0fa50aa78d692d7aae446a`。指定微补丁无新增 P1/P2。

`:158–162` 抽取 reviewRole，供 review 与 reviewReceipt 在同一当前授权事务使用。两处均先 `live`（当前账户/session/feature/agent/skill、固定 AnalysisBasis 与 run 行锁），取得真实数据库 `auth.user`，再查当前有效 group membership 的审核角色；仅 tenant_admin/pi/methodologist 可审核和回读审核回执。先检查当前审核权限再读旧 audit/幂等结果，避免已降权但仍可读分析结果者借原回执恢复审核动作。写端原允许角色集合未扩大，tenant_admin 仍按当前实际身份；没有以旧 JWT 或旧审核记录角色兜底。

辅助方法仅增加 membership SELECT，不取得新的父锁；既有 tenant authorization → session/来源/plan → run 锁顺序保持。当前 accountAuthority 已校验组、项目、成员和有效 role，且事务拥有共同授权锁，reviewRole 同事务再次读取该范围角色；未把独立迟到角色检查放到事务外。审核与审计原事务保持。MethodsService 仅对 descriptive-statistics 分派本类，旧 skill review 分支未改。

读取作者实际 RED/GREEN、46 单元及真实 Methods→鉴权 Worker→持久审核 PG 记录用于验证故事核对；本轮按 root 要求未重复整套 PG，不把这些记录冒称本审查者重新执行。对应 `.tmp/t16-review-receipt-independent-green.tap`、`.tmp/t16-review-role-unit-green.tap`。本轮没有代码修改、DDL、重启、Worker 请求或主案例写入。

建议下一项：S06 用当前仍可读但失去审核角色的账号核对界面回执恢复路径，与实际 403 保持一致。
