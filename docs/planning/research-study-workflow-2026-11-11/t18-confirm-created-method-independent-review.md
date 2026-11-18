# T18 已创建新 Methods Run 的审核续阶段独立窄审

2026-11-13。结论：候选 SHA-256 `b7bc5722c36ed17d8de02b11a4b0712b9a715322279820c7a0efaa74c69b5227` 无阻断，语法检查通过，CLI 后的 sentinel 保留。仅审相对当前 corrected-method `37fe841893e6f3b43bfa338f7713bfcaaa9201a13808efc0410d4c858cb8090d` 的窄差异与有关控制流，读取已保存的合成 journal/failure/Worker 轨迹；未执行或导入候选，未发 API、SQL、浏览器请求，未修改产品或业务数据。

第 77–78 行要求唯一已创建 Run `cmwdq0636001jlud6scho3s1q`、原 create key `4d702e3b-de76-49ea-9196-c495f39a6af5`、原 researcher/authVersion0、pending=null、reviewed=false 且无 review key。实际部分 state 符合，operations 仅原 create；原失败在 admin-review，零 review POST。原文件已归档为 `confirm-created-method-root-approval/original-created-journal.json`，SHA `71b2c7fc2f7f6f5ea9bac30d0c5485998015e5ec7b16bf73c5193363e94823c6`，与本次首次读取的部分 state 原字节相同。

进入浏览器前重新 GET 原 creator 身份及其原 create 回执，核 Run、原键、当前新 snapshot。固定非空 `state.runId` 使第 153 行 create 分支不可达；只导航既有 Run。90 秒等待仅覆盖 researcher 表格和管理员审核框的首屏读取，不派新任务、不自动重试写入。原实际 Worker 轨迹按同 Run 过滤，独立读回恰一次 dispatch、一次正确 executor/Worker 版本的 HTTP 200。

第 167–175 行只进行一次管理员 review，仍经原权限/来源/runtime/UI source 守门与原键落盘；回执按原 actor GET 核对后才记 reviewed。任何 pending 恢复仍仅查原键并停线。保留同一当前新 basis、原 H5/CSV、唯一 ONSITE 更正、独立 correction oracle、旧依据失效、最终 completed+confirmed 与统计原值断言。成功 producer 仍为原 corrected-method pointer，供已审更正报告脚本消费。

前次空态不据静态代码归咎于身份初始化或 StrictMode；根已保存延长只读等待后列表及来源全部 200、最终审核框出现的实际网络证据。列表首屏延迟作为当前限制保留，本候选不扩大性能改造。

[独立证据](../../testing/evidence/research-t18-2026-11-12/confirm-created-method-independent-b7bc5722/review.json) SHA `d0e7c38fccaf0520509261d04310ca7987a19e960de314be0f8108d57e8e210b`；同目录保留审阅字节、完整差异与语法检查日志。本结论仅为执行前窄审，不代表该次审核或后续报告已真实完成。

建议下一项：由根仅审核这个已创建 Run，核对原键回执与 completed+confirmed 后，再对齐更正报告的实际输入。
