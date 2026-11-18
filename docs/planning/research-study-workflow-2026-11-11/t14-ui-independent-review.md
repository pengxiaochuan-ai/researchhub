# T14 冻结文件界面独立窄审

日期：2026-11-12。审查范围为 `t14-ui-checkpoint.md` 与 `ui-freeze/manifest.json` 中 14 个文件；逐一重算 SHA256 均与冻结记录一致。只读审查加独立纯契约测试，未改 UI/实现，未重启、执行 DDL、写业务库或重复整条浏览器链。主循环另行检查视觉截图并完成产品文档/Notion 收口。

结论：指定窄范围未发现剩余 P1/P2。关键源码：`useFormalCapture.js` `ff2b6ffd44cd65eccdc9481324ab840dac24ae3db72d4b89262f98108afe7d18`，`CaptureFiles.jsx` `205025230122ca1b85d80a20fe7f12d48f6591c0ddcd09941624e65b9f23e1bc`，`capture-file-session.js` `01bb9d8617b8f6d306687d3d84919e82a52792ef6fac626a5fc7f835c12239f5`，完整 14 文件冻结见独立证据。

## 读取、权限与敏感内容

`useFormalCapture.js:30–42` 首次及写后读取复用 files limit20 快照，quiet 仅用 limit1 复核当前用途/上传能力；quiet 不增加 revision，因此不会重置已展开来源分页或未发送文件。当前 auth/me 的 accountId/authVersion 与本地身份严格一致。敏感的当前参与/绑定/来源拒绝调用 clear，改变读取代次并中止旧请求、清 marker/正文/上次结果，最终卸载文件区；不能因为历史访视 GET 仍可读而继续保留文件用途。普通 files GET503 只设置 fileAccessError、禁文件动作，其他表单和待发文件仍保留。

`CaptureFiles.jsx:8–15` 换身份/Study/访视或写后 revision 清原文件及确认框；相同范围下一文件保留已选模态。上传动作须同时满足初始列表与最新 quiet 能力，服务端仍逐请求最终授权。数据内容仅在内存，sessionStorage 的 marker 严格固定九字段，不含文件名/base64/摘要或正文。十五分钟释放内存并重置文件选择；跨刷新只恢复最小 marker。

## 来源分页与失败恢复

`capture-file-session.js:15–32` 与 `CaptureFiles.jsx:9–13` 对 Study/visit/file/task、来源 kind/id/sha/hashVersion/hash、父 fileSourceRef/taskSourceRef、总数、游标及重复项验证。子分页父摘要或数量变化拒绝拼接，并清旧列表要求显式重读。正常 quiet 更新不覆盖已拼接内容。初始 20 与总数分别显示，允许合法501/1000范围而不宣称20是完整结果。

边界如实记录：根文件分页普通 GET503 保留现有列表和输入；子来源分页失败采取保守清列表并要求重读，待发文件仍保留。不能将其描述为所有分页故障都保留旧列表。未知来源不显示质量合格或数值，不将被试历史未归属特征绑定当前访视，也不把 processing task 当执行任务。

## 原回执与核验

`useFormalCapture.js:44–84` POST 响应严格核 original requestKey/action/Study/visit/file/task/sourceSha256；成功响应后仍 GET 原回执并核当前范围。存储 verified 且 recorded 才显示完整核验。unknown/mismatch 保留 marker，显式 verify 只调用原回执 `/verify {}`，再 GET；file domain 无重试 upload 路径。响应不明、刷新、15分钟、GET404 均不能自动导入新文件，404 不提供 verify。恢复固定事实校验不把动态 storage 状态纳入不变字段，允许真实原对象核验状态更新。

## 独立复验与作者浏览器证据边界

新增独立测试 `tests/capture-file-independent-review.test.mjs`，覆盖跨父范围/摘要/数量拒绝、实际 client 当前撤回使迟到读取失效、普通503不触发访问清理、明确未装配503与响应不明区分，以及 marker 不能保存敏感字段。与现有 file/formal-capture 单测合跑 **20/20**；证据 `docs/testing/evidence/research-t14-2026-11-12/ui-independent-review/contract-rerun.tap`。

阅读并核对作者四组真实浏览器结果与脚本：`files-ui-925ecd09`、`files-recovery-137ee3d6`、`files-pagination-8512f965`、`files-visual-f9a7d227`。它们记录实际管理员 CSV/JSON/MinIO 读回、0/null 与严格错误、研究者只读/owner拒绝/错误访视、原回执恢复/真实对象篡改/当前撤回/404，501条来源25次续页，桌面/390/原生200%及Esc焦点。故障注入的503、响应截断、15分钟时钟和父引用响应修改均明确标注。21条额外 queued task 是分页 fixture，未谎称运行科学算子。此处只是独立读证据，没有将作者浏览器运行冒充本审查者重跑；作者447单元/临时构建也只按冻结记录引用，不作第二次独立执行声明。

本结论不等于生产部署、真实临床规则或19项任务整体验收完成；这些仍由主循环按四层证据和产品文档闭环判断。
