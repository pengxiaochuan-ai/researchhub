# T18 主 S10 报告执行器独立执行前审查

2026-11-12。范围仅主报告验收执行器、离线 DOCX 验收器及其测试；未执行或导入主/更正执行器，未发 HTTP、未连接数据库、未启动浏览器、未改产品实现或主三例。此结论不是主报告业务验收。

## 当前冻结与结论

| 文件 | SHA256 |
| --- | --- |
| `scripts/research-t18-main-report.mjs` | `0abcc8d087a8014bbb3ceb308f67a62c924982125aceea8cc0d65f5ec77b72c9` |
| `scripts/research-t18-report-docx-verify.py` | `f7f790f2f8b36bd5e5433b0fdfaba536869288c4054d50799fe607b9ccd9c2e2` |
| `scripts/research-t18-report-docx-verify.test.py` | `23ed613f4dda8c6d882b3dbcb9370a6f9f73436baaf435804734383798f53df1` |
| `scripts/research-t18-corrected-report.mjs`（仅比较共用验收器增量） | `fb057541129860670ef0afc876a6d3d7994cbe8cd2381a4bad6021eb933bb464` |

当前窄审无未关闭的执行前代码阻断。主执行器保留 `T18_MAIN_REPORT_FAIL_CLOSED_PENDING_ROOT_REVIEW_AND_S10_FREEZE`；仍须根完成 S10 冻结/文档与显式放行。更正执行器的实际输入尚未形成，本次不签署其全链执行许可。

## 已复核的守门边界

- 固定输入绑定 benchmark/capture/basis/method 与 generic-v2 oracle 摘要，保留原三人、原 ref1、锁定/审核状态、完成日期、H5 原历史字段及 CSV 导入回执；不重发或更正答案。
- 每个业务 POST 在放行前保存原 key、action、target、body、当前真实 admin account/authVersion，并两次核 runtime；四动作分别确认原 GET 回执。unknown 仅原 actor 原 GET 回执后停线，部分成功 journal 也停根审，不生成新 key 重放。
- 当前计划、完整 snapshot/basis、Run 状态/确认、持久输出与原 Worker trace 精确复核。Study 内其他 Run 报告按当前详情或精确只读归属允许；同主 Run、不可解析来源或列表触上限均停线，不要求整个 Study 报告目录为空。
- 仅真实 DOCX 下载完成后核 MIME、文件名、长度、SHA 和 Word 表格；预期数字直接使用实际持久 Run 字符串，无重新计算、四舍五入或 LLM 填值。Study 从真实 DTO 父链核，不臆造模板中不存在的 Study 文本。
- 技术证据固定 `passed:false / technicalPassed:true / rootDocxReviewPending:true`，不写成功 pointer。根必须对最终文件逐页专业可读性审阅后另行批准。

## 两项 P2 验收器缺口与闭合

原 main SHA `35b8a765b923ecbecc4623534b081f0e20b6e219886e966dd420093b9512bd19`、原 verifier SHA `804d841917e7170264b7913baae2a09f86b10763e452426c315db99e4485bd1e` 有两处 harness 漏检：

1. 名称/单位只在全文任意段落出现即可，交换两变量的表前标题仍可通过；表格数字正确也会被错误归属。
2. 未核 rowCount 及其路径、字段/type/form/schemaHash、Run/executor/snapshot/manifest 完整来源，缺失或变更仍可通过。

这些是离线验收器缺陷，未据此认定产品 DOCX 已出现错配。保留原验收器快照，独立构造双变量 OOXML 反例：交换主标题/附录映射，篡改 rowCount、field/type/form/schema、Run/executor/snapshot，以及删除 rowCount 路径或 manifest。原版 12 个负例全部错误放行（RED）；当前版同一测试全部拒绝，合法双变量仍通过（GREEN）。作者另有正例及交换标题/改数/改路径/删 basis 摘要测试独立重跑通过。

修订后每个主表与紧邻标题/单位绑定，每个附录表与对应 key 的完整展示映射和逐指标路径绑定，并核受试者数与页尾真实来源。主/更正执行器共同生成可信预期，不改产品模板或报告数值。

## 证据与限度

独有目录：[main-report-independent-review-35b8a765](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/)。

- [原验收器](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/verify.original.py)、[原主脚本快照](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/main-report.original.txt)。
- [独立离线测试](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/verifier-independent.test.py)：3 个 unittest，含 1 正例与 12 个负例。
- [RED](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/verifier-independent-red.log)：12 failures；[GREEN](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/verifier-independent-green.log)：3 tests OK。
- [作者测试独立复跑](../../testing/evidence/research-t18-2026-11-12/main-report-independent-review-35b8a765/verifier-author-independent-final.log)：1 test，正例与 4 个负例均符合预期。

这些最小 OOXML fixture 仅证明本地校验守门，不能证明真实服务、MinIO 或主报告已交付，也不能替代最终中文排版图像审阅。main 中 Node、浏览器、网络、PG、DOCX 真实链均由根随后按授权窗口执行。未改 living/baseline/manual/Notion，根统一同步。
