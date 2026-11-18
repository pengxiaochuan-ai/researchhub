# T01 Hub 启动只读预检独立审查

日期：2026-11-12。范围仅 `assertHubSchema`、其 catalog/固定种子事实校验和 `local-knowledge` 启动调用，不扩展全库 schema 审计。未执行 DDL、apply、seed、运行时重载或业务写入。

结论：当前窄范围无剩余 P1/P2。`scripts/hub-schema.mjs` SHA256 `f9b350cf91f6245702e40ee4b5840a1be08c4a6736d8629a06c29431b03e3c52`；`scripts/local-knowledge.mjs` SHA256 `2938d0ebef565787deae188e7b5fee5cb54f3b0156c5b39c33865a5dd53e080e`。

## 独立发现与关闭

1. `tgtype=23` 和启用状态不能证明 guard 覆盖全部 INSERT/UPDATE：`UPDATE OF` 或 `WHEN` 可缩窄保护范围。独立负例先 RED；作者补 catalog 的 `tgattr`、`tgqual` 并要求空字符串/null（缺失也拒绝），复验 GREEN。当前完整库实际值为空/null。
2. 只检查 ENABLE/FORCE RLS 不能证明存在正确策略。缺失策略会拒绝正常访问，额外/放宽策略可能扩大访问。独立负例先 RED；作者按现有三表 canonical tenant policy 严格验证 table/name/command/permissive/PUBLIC role/USING/WITH CHECK，拒绝缺失和额外策略，复验 GREEN。未借此修改其他表策略。

## 执行与证据

独立测试 7 项及作者原测试 2 项合跑 9/9。包含完整合法快照、列限制、WHEN、缺策略、放宽策略、额外策略和 follow WITH CHECK/role/command/permissive 漂移。

另以 fixture guard 对保护库 `wp01_test_full_baseline` 开启实际 PostgreSQL READ ONLY 事务：确认 `transaction_read_only=on`，读取真实 pg_trigger/pg_proc/pg_policy，并调用当前 `inspectHubSchema`；完整现库通过。事务内只有 SELECT 和 transaction-local `set_config`，无 DDL/seed。证据目录：`docs/testing/evidence/research-t01-2026-11-12/readonly-independent-review/`，含保留的 RED、最终 unit/PG、实际 catalog 及 source freeze。

## 启动行为边界

`local-knowledge.mjs` 导入并调用 `assertHubSchema`，不调用 `applyHubSchema`。Hub 结构或固定初始种子缺失时启动失败，不自动建表/补策略/种数据；首次初始化须显式另行执行已批准初始化流程。现有完整库无需结构修改即可通过。模块中的旧显式 `--apply` 路径仍独立存在，不能将其与当前启动只读预检混淆。

本结论仅指 Hub 预检只读；整个历史 local-knowledge 启动仍包含已有的基础 fixture 准备等行为，未声称整个启动流程只读。此处不重复评估其他初始化模块或真实产品部署。
