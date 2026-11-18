# T18 更正后新报告执行器独立执行前审查

2026-11-12。依据[t18-corrected-report-acceptance.md](t18-corrected-report-acceptance.md)，对当前更正报告候选及其与基线执行器的全部差异作只读审查，并逐项对照更正Methods生产者输出、原更正合同及已审Word验收器。**未发现当前源码执行前阻断；真实更正/新Methods proof尚未生成，实际输入SHA与shape仍须根最终对齐，本结论不构成执行放行。**

候选SHA为 `ad810df55daebcfc3ffb9b17c228a5b13ac755405b8c72f16b9019ab622a0f39`。line15的`T18_CORRECTED_REPORT_FAIL_CLOSED_PENDING_ROOT_REVIEW_AND_S10_FREEZE`仍保留；未执行/导入候选或基线脚本、未发API、未连接数据库/启动浏览器、未改产品或主三人。源码guard已由T05另独审，本次核调用位置及与本流程衔接，不冒称重复其执行验收。

## 输入与来源绑定

- lines18–37：原benchmark/capture/basis、原Method/根QA后原Report、correction及新Methods使用各自pointer；correction四项原输入SHA、新Methods的correctionSha/basisSha、oracle固定SHA均核验。新Run和snapshot必须异于原版，原Report为passed/released且绑定原Run，旧DOCX原bytes仍满足其服务SHA。
- 新snapshot对象从`correction.newSnapshotId`、`correction.preview.manifest`及新Methods持久`runFile.dataSources.analysisBasis`组成；lines57、128–130以真实GET完整basis/manifest复核，同approved定义/审核id/sequence与原计划一致，新gate不同于旧gate。不是将旧basis直接当新依据。
- `scripts/research-t18-corrected-method.mjs` SHA `04eb12eb73b2f646dd710ce5964a871ee11a1ad4851acf1205ce14e5811362e0`的实际输出定义包含`actors,oldSnapshotId,oldRunId,correctionSha,basisSha,runFile,workerHttp,createRequestKey,reviewRequestKey,status,reviewStatus`，与候选消费字段一致。候选进一步核当前Run整个basis、持久输出/numericEvidence、completed/confirmed、无LLM及唯一实际Worker dispatch证据。
- 新统计预期只取固定`oracle.correction.expected[fieldKey]`；报告每格期望直接取实际持久Run字符串，未在模板重算或舍入。

## 三例保留与旧依据拒绝

lines56–73的facts在各业务phase前后复核当前新snapshot；原三人/assignment/visit/enrollment精确匹配。ONSITE必须同原response、ref2、锁定批准，answers逐对象等于原答案仅`value=oracle.correction.newValue`；H5/CSV原response version/ref/answers/锁定审核使用`assertOriginalCapture`精确保留。三访视completed/current，原完成日期不变，H5/CSV访视version不变；ONSITE现response/visit版本与固定manifest逐格来源匹配。

原修订1历史按原ref逐字段核，H5全部h5Original字段保持，CSV通道继续由原import receipt/source/row证明，不误把researcher提交主体当通道。新manifest三个subject/visit、值/缺失原因、ref和当前responseVersion由`assertPreviewRows`及逐变量比较核验。

lines75–78、128、149对旧snapshot/Run/report/job/file均要求当前GET409；旧snapshot精确`ANALYSIS_BASIS_STALE`，其余使用已审有限source错误集合并递归禁止旧answers/rows/manifest/numericEvidence/contentMd/sourceHash泄露。此阶段不重复POST旧导出；旧版本不可新建导出任务由前阶段correction成功proof负责证明，实际输入最终需根核该证据，不由本审查虚构。

## 写入、恢复及交付门禁

- lines90–108：仅armed精确四动作路径/target/body放行；先持久原key/body/actor，前后核runtime及同一已验UI源码proof。当前admin身份为本验收约束，不是替代产品权限规则。
- lines120–127：pending仅同原actor GET原回执后停根审，部分已确认history也停，不换键重放；独立state/pointer/evidence不覆盖基线。Methods create/review回执仍由原researcher/admin账号及authVersion分别核，不能管理员代读其他actor回执。
- lines134–140：同Study其他Run报告允许，精确同新Run或来源不可判定即停；列表触50上限停。新artifact必须异于原Report、固定version1、精确新Run/newSnapshot，不复用旧报告伪装新版本。
- lines141–150：四次UI确认/原GET回执/当前详情，再真实ready任务与受控下载；核文件名/MIME/大小/服务SHA/实际bytes，fresh身份/同report/job/file后再验来源。Word通过已独审的`f7f790f2f8b36bd5e5433b0fdfaba536869288c4054d50799fe607b9ccd9c2e2`验收器核真实表格、中文标题/单位、逐值、全部固定路径和表单/Run/snapshot/manifest来源。
- lines154–155：技术结果固定`passed:false,technicalPassed:true,rootDocxReviewPending:true`，不写成功pointer；根对最终文件逐页QA后才能转passed。根QA不能由新统计正确或旧基线报告QA代替。

## 待实际输入后的最终对齐

根完成基线报告QA、原主更正及新Methods后，须以真实原文件再核：correction四项输入SHA及phase；新Methods的correctionSha/basisSha/actors/runFile/workerHttp；新snapshot的basis/gate/原approved review与manifest；新Run唯一dispatch；原报告/文件及旧export拒绝证据。缺字段或状态不符应停线按真实生产者契约处理，不伪造proof、不移除来源门禁。此前不去除sentinel、不执行候选。

独有证据：[corrected-report-independent-review-ad810df5](../../testing/evidence/research-t18-2026-11-12/corrected-report-independent-review-ad810df5/)，含候选原字节、完整基线差异和[SHA/scope记录](../../testing/evidence/research-t18-2026-11-12/corrected-report-independent-review-ad810df5/review-freeze.json)。本轮只做源码复核，无单测或真实业务执行主张；T17已闭合事实由根维护，不在本报告重签。主同案、更正后报告专业可用性及临床/生产验收仍待实际证据。

## 2026-11-13：最终真实输入短核

结论：候选 `9ddf6eb03a174342e795b0d3a2a505f23859ad0e0b7ee0c7150dd1d3b293567e` 与实际输入无阻断。删除唯一 S06“生成固定报告”链接的 `waitFor({timeout:90000})` 语句，可逐字还原上述已审 `ad810`；sentinel 在审阅时保留，语法检查通过。没有重审整套或执行候选/API/SQL/UI。

实际 Methods producer 为 `corrected-method-d9292461/result.json`，SHA `537ef2727b87526d40f736ab0897c3b99d3709114be815bf1cffaa00905e3735`，状态 completed/confirmed。Run `cmwdq0636001jlud6scho3s1q` 精确绑定新 snapshot `t15-snapshot-c7c8c9fe-cf98-4a2d-b395-2e0dff721f43`、manifest `ae599315…`、新 gate `t15-gate-acf532a0-ee82-40f4-87dd-7965c3b7a0f7` 及原 approved plan review。其 basisSha/correctionSha、correction 四项原输入 SHA 全部相符。

原 create key `4d702e3b-de76-49ea-9196-c495f39a6af5` 与 researcher/authVersion0、原 review key `d50ee4f9-0e69-41b9-9f60-cb916f45ed3d` 与 admin/authVersion5，均与 confirmed journal 两操作一致；pending=null。全局同 Run Worker 轨迹与 producer.workerHttp 逐项相同，恰一次 dispatch/一次正确版本200，d929 最终验证本身为零业务 POST，不把创建、实际审核、原键恢复和最终只读验证合称一次执行。

已核当前更正 manifest 的 H5/CSV 原 ref1/答案保持，ONSITE 仅 value 0→1/ref2；旧 revision1 与原 capture 相符。原报告 proof 仍为 `2dccc9a9…`，原 DOCX 为 SHA `96e4dde7396871bcba5d04e32a72ead4b4f3895fffeb9905d977e95567815799`、12552 bytes，没有覆盖旧文件。

[最终短核原件](../../testing/evidence/research-t18-2026-11-12/corrected-report-final-input-independent-9ddf6eb0/review.json) SHA `384df9ee8f4e6ed3173924ba1c6b06cbe68f2054b0f2bf26cd79da26b44861c0`，同目录保留审阅字节及语法检查。新报告四动作与最终新 DOCX 的根逐页 QA 仍须实际完成；此处没有提前宣称交付通过。
