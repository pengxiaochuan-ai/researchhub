# T15 计划元数据与 S05 capabilities 独立审查

2026-11-12。仅审本次 list/readPlan 元数据、capabilities 和游标分页增量，以及其当前 core 权威身份返回；不重审全部统计/运行时功能。**指定范围无 P1/P2，可继续 S05 真实接口/页面集成验收。** 未改产品实现、运行时、DDL、主三人合成基准或已有角色。独立 PG 仅创建新的完整回滚 fixture 和新 fixture 角色。

## 当前冻结

- service `9b5923d52361ff92d7b57fe96f1c8fd4ba78ca3e1acf0b38ea140d71fd3790a9`
- core `03bd99a228d16b9a0b116d5d872ea3450e2d3ec5b820bced6ae91cd405cf1b3f`
- projection `4dd454e1039945077d72f9ee954fb3de9c3d7c29ff6350f24f67d2bd85f5451c`

`service:14,43` 的三个 capability 和实际 mutate(admin=true) 使用同一当前数据库 tenant_admin/isTenantAdmin 权威，`core:21–27` 先当前账户/session、Study scope/read 权限，再确认实际身份或普通 data.analyze。principal 自报角色、Study owner 或 project_manager 不能代替管理员写权限。列表和详情都使用 core 返回的 current 角色，不用客户端 claim 投影。

capabilities 表示操作权限，**不是当前来源完整/当前已批准/质量已经通过的许可**。list/readPlan 输出审核历史的计划/快照 metadata；没有调用投影读答案，也不冒称这些历史快照当前可用。withdrawn 或 revoked 后保留历史与撤销动作是治理要求，实际 preview/release/readSnapshot 仍分别核当前来源、同意和最新计划审批。S05 需继续根据真实预检展示当前是否可放行，不把 capability=true 当已放行。

`service:15,53–62` HMAC cursor 绑定 tenant/actor/authVersion/Study/kind；快照子页另绑定 planId。真实 Study wrapper 先重新判定当前账户和可访问 scope，SQL 固定 tenant/group/project/Study/plan，按 id 有序且 limit 1–100，取 limit+1 生成精确续页。元数据列不包括 snapshot manifest/rows/answers；计划 definition 本身由严格 submitPlan 合同生成，只有固定映射、选定被试、目的/版本等计划字段。metadata 不能代替 fixed AnalysisBasis、当前用途判定或值的投影。

## 实际保护库验证

新增 `server/research-analysis/t15-metadata-review-pg.test.mjs`，通过真正 `createResearchStudiesService`、真实 core、`aisci_app` 和 RLS，两个全新 fixture 均在唯一受保护 `wp01_test_full_baseline` 外层整体回滚。未向已有角色授/撤权限，也未调用运行时接口。

`docs/testing/evidence/research-t15-2026-11-12/metadata-review/` 保存：

- `independent-metadata-pg.tap`：2/2。三计划和两个实际 release 快照分页完整、有序、无漏无重；跨另一个真实 Study、plan、kind、合法另一个 actor 及签名篡改游标拒绝；非法分页限制拒绝。详情绑定正确 plan 与最新审批，递归无 answers/rows/cells/manifest/value。
- 同 PG 中，真实管理员三项能力为 true 并实际成功 submit/review/release；真实 data.analyze 研究者（project_manager 成员）能力全 false、三种实际写命令均 ANALYSIS_ADMIN_REQUIRED。该研究者即使自报 admin 仍 false/拒绝；实际管理员即使 claim 普通身份仍读取正确管理能力。将新 fixture 的第二管理员实际降为具备 data.analyze 的研究者后，旧 principal 的 fresh capability 变 false，写入拒绝；新 fixture 读角色撤销 data.analyze 后列表/详情均拒绝，旧 authVersion 也拒绝。
- 同 PG 中，写入真实现场修订并审核锁定后实际放行；追加当前 data_use_consent withdrawn 事实后，metadata 仍为历史只读且不含答案，preview/release/readSnapshot 全部拒绝。管理员仍能真实追加 revoked，并在 readPlan 得到最新 revoked 审核历史。
- `existing-basis-pg-rerun.tap`：既有真实完整 Basis 服务链 1/1 重跑通过，包含源更正/解锁、质量、最新 review、同意及回执守门。没有用元数据单测替代来源或数据库验收。
- `unit-rerun.tap`：当前 core/projection 定向单元 12/12；只证明契约，不替代上述真实 PG。

全部冻结及执行边界在 `review-freeze.json`。本轮没有 19501 HTTP/S05 浏览器验证、真实 Worker 或业务交付，不据此宣布 T15 整体四层验收完成。

建议下一项：root 用当前三项 capability 和真实预检结果完成 S05 两角色完整链及失权/未知恢复浏览器验收。
