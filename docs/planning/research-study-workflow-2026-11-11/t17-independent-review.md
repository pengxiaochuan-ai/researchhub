# T17 独立源码及受保护环境审查

2026-11-12。审查范围为正式报告三文件、旧通用产物封口和本机 Study/controller 装配；不更改实现、DDL 或运行进程。当前没有发现其他已证实的 P1/P2 阻断；这不是完整上线或业务验收。

已核：报告来源必须是当前 Study 真实 T15 basis、completed/confirmed 方法运行、最新明确方法复核，数值输出与同路径 numericEvidence 和摘要逐项一致；正文与固定版本/来源重新构造并比对。读/审/发布/导出各有当前 Study 与权限检查；下载读私有对象后比长度/SHA 并在交付前再次重验。导出在提交后 claim、核原 actor/authVersion，运行与存储在事务外，终态依 claim CAS 并重验；恢复有界且过期不重排。通用旧产物读取、导出与 worker 对服务端正式 ID 段拒绝，旧普通路径保留；Study binding 的 execution_project_id 唯一约束限定了项目作用域。src-only 本机装配只允许 DOCX/Markdown，PDF 明确 503；GET 状态不触发处理，POST 提交后处理，恢复是显式 POST。

**已关闭 Important：** create/review/release 回执原先只检查 artifact.read，动作权限撤销后仍可 GET 原回执或同键回放；真实 PG RED `.tmp/t17-receipt-permission-red.tap`。修复后的 `validateReceipt` 按 action 精确重验 create/review/release/export 权限；`.tmp/t17-receipt-permission-minio-green.tap` 用实际 synthetic researcher 先创建、审核、发布，再撤权保留 read，三个回执和同键重放均拒绝、详情可读。实际 MinIO put/回读 SHA 与 DOCX 下载成功；PG 事务回滚，唯一新私有测试对象精确删除。run 是显式 completed 测试种子，不冒称真实方法计算。

其他独立复验：`.tmp/t17-independent-review-unit.tap` 16/16，`.tmp/t17-independent-review-pg.tap` 1/1（储存为测试替身）。真实 MinIO 复验 1/1（日志 SHA `546c25a8382aaccf7527d723b6b3d40830a7910733244ffd0a7e8d6bcd5e40fc`）；测试源码 SHA `9fcfa1054b9ed3cbdce0c75a99cce284dd10deb14ab65697dcbc287522911c4a`。

复验时源码 SHA：`t17-reports.mjs` `3e38213744c20f2f122ca6d08818e31403c52b15640eb120dae9384c4f765452`；`t17-report-content.mjs` `1b3bc56ae9a3c72acaa19668580988f3280725f092680fe22e25ae4eba2c24d9`；`t17-report-exports.mjs` `4116a5d4b3e8f7d85a641bb7629f42de43d60e873904ba0ac3b0e451141b47b7`；`local-research-analysis.mjs` `4527e339920858482f3b2c290df647b212c83fd455612041e4fcba2e952cfb12`；`research-studies/controller.mjs` `65962eaa8947e1c98915adc6057d2758508fe05d45d0d0084f5790b72b66961f`。本机 worker transport 日志小增量属于并行 T16 装配，不作为本报告单独审查结论。

目标进程尚未加载 T17 这版，真实 T16 Worker→Methods 人工确认→正式报告的 HTTP 和 S10/资产/治理页面仍待主循环验收。真临床、生产、专业用户验收均未发生。
