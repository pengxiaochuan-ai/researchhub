# T18 主例更正与旧依据失效验收契约

2026-11-12，准备阶段；本文件未执行采集、更正、计算或交付。需求承接已授权 T18：先完成原三渠道的真实 Methods 与报告交付，再仅更正主 ONSITE 的观察值 0→1，验证旧依据当前新用被阻断并形成新依据。S06/S10 按主循环最终冻结的页面和证据接入，本文件不预设其未冻结文案、组件或成功指针文件名。

## 执行前门槛与固定输入

- 从工作区 `.tmp/researchhub-workflow/benchmark-current.json`、`t18-main-capture-current.json`、`t18-main-basis-current.json` 读取已通过证据；三者 Study、主三人、固定表单、BASELINE 和原 ref1 必须精确对应。已核本地 capture 为 `main-capture-ca263fff`、basis 为 `main-basis-41f5ebd1`；这只是文件事实，真正更正前仍须 GET 当前事实。
- 当前原计划 `t15-plan-53ec8735-4648-49fb-9f39-43cb3d5386dc`，旧快照 `t15-snapshot-abbde046-27b9-4113-b7ce-9a1ece74ca90`。执行器从已通过指针取值，不能由本文件硬编码绕过当前核对。
- 冻结 `generic-v2/oracle.json` SHA256 `f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b`，H5 原始证据摘要按其 `h5EvidenceSha256` 核对。更正后统计只对照 `correction.expected`；由已有 `scripts/research-study-actual-oracle.py` 的独立 Python 基准核数，LLM不重算或补数。
- **原基线 Methods 与报告必须先真正交付通过**：同旧快照的实际 Worker Run 已 confirmed/completed，报告已人工审批、发布，DOCX 已实际 MinIO 写入/读回并受控下载、可打开，且逐项符合原 `expected`。未拿到这些成功证据，不解锁 ONSITE。
- 更正前冻结三人的 assignmentId/responseId/ref1、answers、response.version/locked/review，三访视的 version/actualCompletedAt，以及旧 manifestHash/planReviewId、Run、报告/版本/正文摘要、导出 job/file/hash。H5 的原 ref、source=patient_h5、actorKind=h5_session、答案与原证据完全一致；CSV 原通道由已确认 import receipt 的行/ref/SHA 证明，不能用 oracle 的 `source=import` 要求 revision.source 也等于 import。

未来脚本唯一业务写范围：主 ONSITE 的 unlock/correct/review/lock 与该访视 reverify，同一已批准计划的新快照，以及后续显式新 Run/新报告。禁止重发邀请、写 H5/CSV 答案、改三人的同意/入组、撤回计划、重建主被试或用另三名测试对象替代。当前任务只写本契约，不创建该执行脚本或运行任何业务请求。

## S09 已有操作和可执行断言

入口为 `/pages/s09/?formalCapture=1&studyId=…&visitId=…&assignmentId=…` 的**当前** ONSITE 修订；不得从 ref1 历史视图执行更正。每步读取 fresh version/ref/capabilities，采用实际共享弹窗，先持久记录原 requestKey，再发页面操作；响应不明只查原 GET，不重新 POST。

| 阶段 | 现有 UI / 请求 | 必须观察的结果 |
| --- | --- | --- |
| 解锁 | “更正与审阅”→“审阅或解锁原因”→“解锁表单”→共享“确认”；`POST assignments/:id/unlock {requestKey,expectedVersion,expectedRef:ref1,reason}` | 原 ref1/答案不变，locked=false，响应版本推进；旧完成记录仍为 completed，完成日期不变，当前依据 requires_review。 |
| 更正 | “更正记录”，只将“观察值（必填）”填1；填写“更正原因”→“核对并保存更正” | 弹窗 diff 仅一行观察值0→1；选填0与false保持。`correct` 带 fresh expectedVersion/ref1 和完整原答案，仅 value 改1；成功仍同 assignmentId/responseId，产生 ref2、revisionNo=2、新contentHash，旧 ref1 可精确读取且原答案/摘要不变。 |
| 新修订审阅 | “审核通过”→“确认”；`POST …/review {requestKey,expectedVersion,expectedRef:ref2,decision:'approved',…}` | 针对 ref2 的真实 review_approved；不能把 ref1 历史批准当本次批准。 |
| 锁定 | “锁定表单”→“确认”；`POST …/lock {requestKey,expectedVersion,expectedRef:ref2}` | 当前 ref2、locked=true、review_approved；访视完成日期和 completed 历史保持，完成依据仍待重新核对。 |
| 重新核对 | “重新核对原因”→“重新核对完成依据”→“确认”；`POST visits/:id/reverify {requestKey,expectedVersion,reason}` | completionIntegrity=current，actualCompletedAt 与更正前完全相等；追加当前完成依据而非重新 complete。原完成证据/审核历史保留。 |

原操作回执：`GET assignments/:id/receipts/:requestKey?operation=unlock|correct|review|lock`；访视为 `GET visits/:id/receipts/:requestKey?operation=reverify`。恢复须核 Study、原动作、目标及 requestKey，404/409/无法读取均不得借新键重发。已经是当前 ref2 且答案、原因/历史对应已确认本次操作时，按 journal 只读继续；第三次修订、不同更正或未知写入停线交主循环。

H5 与 CSV 在每个写入阶段前后都只读比对原 ref1/答案/source/锁定审阅；H5 原始 `h5Original` 全部不可变字段逐项相等。不能对其解锁、补审或更正来让验收通过。

## 旧依据当前新用的阻断矩阵

更正链至少在解锁/更正后和 ref2 已审阅锁定且访视重新核对后各检查一次；最终检查保证新源就绪也不会使旧快照复活。主账号/权限/服务配置保持有效，拒绝必须来自来源变化，不能拿401、403或503冒充科学依据失效。

设 `A=/research-studies/:studyId/analysis`；以下路径均为当前已装配代码事实，未来运行保存实际响应，不提前宣称通过。

| 当前请求 | 预期及响应边界 |
| --- | --- |
| `GET A/snapshots/:oldSnapshotId` | 409，无旧 manifest/行值。解锁中可为 ANALYSIS_VISIT_CHANGED、ANALYSIS_SOURCE_NOT_REVIEWED 等精确来源拒绝；ref2 完成 reverify 后应由旧manifest不匹配进入 ANALYSIS_BASIS_STALE。不能仅断言任意409。 |
| `GET A/runs/:oldRunId`；`GET A/run-receipts/:oldCreateKey` | 当前 basis 重验拒绝旧结果；不返回旧 outputs/numericEvidence。旧 Run 的 completed/confirmed 历史可以保留，不要求把原记录改 failed。 |
| `GET A/runs` | 旧运行 metadata 的 analysisState=blocked、basis-invalid；不能显示旧数值。现 present() 可补空 outputs={}，不能错误要求 outputs 字段必须完全缺失。 |
| `GET A/runs/:oldRunId/capabilities` | 可返回当前 status/reviewStatus 与权限位；不含输出或sourceHash。权限位true不代表旧来源恢复。不能对已完成旧Run自动cancel或重算。 |
| `GET A/reports/:oldArtifactId` | 当前 `currentRun→analysis.assertCurrent` 拒绝旧正文；可能透传 T15 分阶段来源错误，不固定要求 REPORT_CHANGED。 |
| `GET A/reports` | 旧artifactId/versionNo/status历史metadata仍可见，analysisState=blocked；无旧正文或数值。 |
| `POST A/reports/:oldArtifactId/exports {requestKey:newNegativeKey,versionNo:1,format:'docx'}` | 明确来源失效409，不创建新export job/file/operation。这是有记录的一次拒绝验证，不是成功重导出或自动重试；若响应不明保留原键待核对。 |
| `GET A/report-exports/:oldJobId`；`GET A/report-exports/:oldJobId/file` | 两者通过 `checked→current` 重验，拒绝当前交付；旧job曾ready不豁免。下载响应不得为DOCX二进制/附件，不能用旧下载链接直接回放。 |
| `GET A/report-receipts/:oldKey?action=analysis.report.create|review|release|export&targetId=…` | 原回执也重验相应权限和当前报告来源，因此可409；不能将“当前不可读取原结果”当成“历史操作未发生”后重做。create 的targetId是旧runId，其余为旧artifactId。 |

旧数据保留与当前交付分开验：用已冻结原 ref1 的历史读取、旧 snapshot metadata、旧 Run/report metadata，以及主循环批准的只读 PG/审计核对原版本/来源/审核/文件记录未被覆盖或删除。HTTP拒绝正文不等于删除历史；已下载的本地旧文件保留原摘要，不能声称系统能收回下载副本。`SubjectVisit.evidenceRefs` 追加历史不由当前访视 DTO 直接返回，不能只凭界面“已完成”证明；需同源审计或受保护只读查询补证。新失败导出“零新增job/file”亦需只读持久计数，当前无导出任务列表接口可替代。

Methods/报告列表当前各限50条；超出返回范围的缺项不能作为删除证据，也不能猜测不存在的续页接口。主例精确ID、基线证据和只读持久核对为准。

## S05 新依据与后续新结果

1. 保持原 planId、definition、contentHash 和 approved reviewId/sequence；不撤回、不重新批准、不重选另一组人。“核对当前分析数据”读取 fresh preview：三人/三字段/BASELINE/SAP/map保持，ONSITE 仅value=1且所有其字段来源ref2，H5/CSV仍全部ref1；0/false/CSV缺失逐格保真。所有行都必须completed/current。
2. 新 preview 的 manifestHash 不同于旧值，evaluation.status=review_required、blockingCount=0；带真实理由“核对并放行快照”→“确认放行快照”，POST同plan的 snapshots，使用 fresh previewHash。新snapshotId/qualityGateId不同，GET新快照200并逐格/来源核对；旧快照仍409。
3. 原快照列表的旧 metadata仍保留，新增一项新snapshot；不调用旧的 `research-t18-main-basis.mjs`，它刻意要求原ref1。更正阶段使用独立journal和独立成功指针，不能覆盖原capture/basis成功证据。
4. 待 S06/S10 最终冻结后，显式用新snapshot创建**新**Run并经真实Worker、人工确认，再建**新**固定报告并审核/发布/导出。当前T17固定报告都是新artifact/versionNo=1，不提供把旧artifact追加v2的接口。对照 `generic-v2.correction.expected`，不得修改oracle、旧Run、旧报告正文或原H5值来拟合结果。

## 交接给主循环的数据形状与待冻结项

未来脚本除capture/basis成功输入外，还必须收到原基线实际 Methods/Report 交付证明（具体指针名随最终S06/S10确认）：

- Methods：`studyId,runId,snapshotId,createRequestKey,reviewRequestKey,status:'completed',reviewStatus:'confirmed'`，实际 input/basis、Worker版本与原oracle逐项核对证据；缺少不能启动更正。
- Report：`artifactId,versionNo:1,runId,snapshotId,contentHash`、创建/审阅/发布/导出原键与各targetId，`jobId,status:'ready',file:{id,sha256,sizeBytes,mimeType,filename}`，真实受控下载路径、本地文件摘要和可打开验证。`readExport` 当前返回裸job DTO而非带studyId外壳；POST export返回原queued结果，controller已调用processExport也不会把该回执改成ready，须GET任务核当前状态。
- 输出：分阶段journal、GET/POST时间/URL/状态/错误码、每次原回执与新ref、PNG/WebM、旧新manifest及Run/report/file摘要对照、Python基准比对结果。成功指针只在全阶段实际通过后写入；失败保留，不覆盖原基线证据。S06/S10具体页面labels与导航、其成功输入字段尚未冻结者明确待交接，不在准备脚本中猜测。

源码依据：`pages/shared/CaptureAssignment.jsx`、`CaptureVisit.jsx`、`FormalAnalysisWorkspace.jsx`；`server/research-analysis/t15-analysis-service.mjs`、`t15-formal-projection.mjs`、`t16-runs.mjs`、`t17-reports.mjs`、`t17-report-exports.mjs`；以及正式response writer/review、visit reverify共享核心。此准备不增加临床规则、生产启用或新组件，也不把代码推断当成本次真实失效验收。


## 已验共享源码证明

主报告已逐页QA后，后续更正/新运行沿同一个根批准的S10及共享依赖源码快照继续。新增纯freeze guard在每次业务POST前/原键持久后和阶段结束核精确manifest及源字节，不自动采纳并行会话的新SHA；漂移停止新写并保journal交根按原GET核对。该证明限manifest内文件，不扩称S09/S06其他源码均被冻结。runtime PID/ids、当前权限/来源及业务CAS仍各自核验，不由源码证明代替。
