# T05 治理待审队列增量

2026-11-11，属于当前已授权 T05；由主循环实施，与发布核心分开验证。复用当前科研目录和 Study 授权事务，不新增全局可写权限或导航。

- `GET /api/research-studies/protocol-reviews?status=pending_review&limit=20&cursor=…`；仅支持待审核，limit 为 1–100。返回 `items` 和 `nextCursor`，不返回推测总数。
- 目录只提供当前可见的 Study 候选；每项再用当前 Study 事务重验账号、租户、组、项目管理成员、workbench、study.configure 与 study_operations。Hub owner 单独配置权不构成审查权限。
- 同一 Study 内按方案 ID 稳定分页；外层复用科研目录原有游标。游标绑定租户、账号和认证版本，所有对象仍重验授权；每次最多扫描 25 个候选，空页但有后续游标时允许继续读取，不伪报没有待审项目。
- 队列仅包含正式 pending_review 版本，链接到现有 S07 的该 Study/Protocol。打开和提交审查动作时再次核对，不以队列快照授予审批权。
- 单测验证分页、撤权、仅 owner 不获审核、跨账号游标和暂不可用行为；PG/真实 API 与治理页面验收随 T05 整体完成。此文不是已启用声明。
