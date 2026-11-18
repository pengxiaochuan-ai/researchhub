# T18 更正后新运行验收合同

2026-11-12。仅承接用户已授权的19任务中的同例更正闭环，不增加新方法、临床规则或页面。当前是准备：主 S10 尚未交付，原 ONSITE 还未更正。本阶段不发请求，脚本保留 fail-closed sentinel。

## 输入与执行门槛

主报告已实际审核、发布、下载并逐页核对后，`research-t18-correction.mjs` 才能进行唯一更正 ONSITE.value 0→1 并放行新快照。本脚本读取独立的 `t18-main-correction-current.json`，要求通过、syntheticOnly、phase=correction-and-new-basis-only，输入 capture/basis/method/report 文件摘要完全对应；新旧快照不同。原基线 Methods、采集和快照成功指针保持。

从更正证明取得新 snapshotId，GET 当前快照与更正时真实 preview.manifest 精确相等；原批准计划的 definition/contentHash/reviewId/sequence 不变。三行三字段、BASELINE、原始实际 H5 1.5/2/true、原 CSV 4/缺失/true 保持；ONSITE 仅观察值1，其余0/false，ref2 同原responseId。锁定、审核通过、访视完成依据 current；H5/CSV 原 response.version/ref/答案/source/actorKind 与访视version/完成日期不变。具体不可变断言复用现有 correction guards。

Python 基准固定 `generic-v2/oracle.json` SHA256 `f0dafb552f6ffc43340a61c11c2fe7abc661cc15059a9b7a43b26d5fb8737f3b` 的 `correction.expected`。映射变量 fieldKey→manifest.key；已有工程容差1e-12仅用于数值跨持久层对比，不改 Run 数值、不用LLM重算、不做页面舍入。

## 实际操作和未知结果

沿现有 S05 新快照“运行描述统计”进入 S06，以已授权窄 Methods researcher 创建新 Run；必须与旧 Run 不同，服务端实际调用 descriptive-v1/t19-1 Worker 一次、无 LLM，输出符合固定新 oracle。管理员在同一 Run 填核对意见，使用共享确认保存，研究者回读 completed/confirmed。浏览器 PNG/WebM 和当前真实 HTTP/Worker 轨迹留痕。

每次写之前核运行时 ready/PID/tenant ids 及当前身份和当前来源；只允许本阶段一次 Run create 和一次 review（正常 auth/renew 除外）。请求键在发出前写独立 journal；未知只 GET 原请求键，仍未知即停止，不能换键重发。启动时发现 pending 仅查询原回执并停止交主循环；发现部分 history 同样交主循环，不从已有成功步骤自动续写。代码准备不调用脚本或导入有顶层网络行为的入口。

独立 state/current/evidence 命名 `t18-corrected-method-*` / `corrected-method-*`。成功输出包含原、新快照和 Run、create/review 原键、输入文件摘要、实际运行/审核状态、不可变源检查、Worker轨迹及原 journal。只有全链实际通过才写成功指针；失败不覆盖基线与更正证据。最终报告由后续明确执行阶段使用这个新 Run，不覆盖旧 artifact/version。

## 验收边界

本阶段仅证明新快照→确定性运行→人工确认；不等于新报告已交付或用户业务签收。旧快照/Run/报告/下载的新用阻断和历史保留由更正阶段及最终验收矩阵共同举证。临床和生产验收保持未验。根评审脚本与实际输入后移除 sentinel；本合同不宣称任何尚未执行的结果通过。


## 已验共享源码证明

主报告已逐页QA后，后续更正/新运行沿同一个根批准的S10及共享依赖源码快照继续。新增纯freeze guard在每次业务POST前/原键持久后和阶段结束核精确manifest及源字节，不自动采纳并行会话的新SHA；漂移停止新写并保journal交根按原GET核对。该证明限manifest内文件，不扩称S09/S06其他源码均被冻结。runtime PID/ids、当前权限/来源及业务CAS仍各自核验，不由源码证明代替。
