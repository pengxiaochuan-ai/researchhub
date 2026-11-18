# T17 固定报告可读性增量独立审查

结论：在约定的源码与受控合成验证范围内，未发现未关闭的 P1/P2。此结论不覆盖本人实现的 capability 权限分支；该分支由主流程独审。

审查了冻结的 content `f5fcbaa8…`、presentation `9b1cb435…`、reports `d6c449c7…`、formal DOCX `f25e58b1…` 和 export `5c8d06d4…`，五项 SHA256 与作者冻结值一致。现行来源先经 `assertCurrent`，再按 scope 对固定表单行加共享锁，重导标准字段及 schema/scoring 哈希；新封套以该可信结果重建并比较正文、来源与摘要。未知或不匹配封套拒绝；无封套历史版本仍沿旧三参数模板。数值复制确定性运行结果，附录保留固定路径，未见重算或更改旧模板。仅正式标记启用新 DOCX 表格和 A4 配置。

独立复跑 content/presentation/DOCX 单测 12/12，日志 `researchhub/.tmp/t17-presentation-independent-unit.tap`；目检作者受控 MinIO 产物 `docs/testing/evidence/research-t17-2026-11-12/presentation/final-015d9c95/page-1.png`，变量名称、未声明单位及原数值可见。作者的隔离 PG/MinIO 和其他渲染页证据作为已有证据，非本次独立执行。目标 HTTP、浏览器、主三例与真实专业验收尚未由本审查完成，临床及生产验收均不成立。
