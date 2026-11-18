# T16 S06 页面独立审查

结论：在本机通用合成软件范围内，最终冻结源码未发现未关闭的 P1/P2；临床与生产验收不在此结论内。

独立核对 `ui-freeze/manifest.json` SHA256 `cc80b4f6e798ae7d012289f6fda68bb2e8b968c6f23129642b947982af97804a`，18 个源码、84 项证据及 2 份构建/单测日志的摘要均匹配。独立重跑 `tests/formal-methods-session.test.mjs` 7/7，日志 `researchhub/.tmp/t16-ui-independent-final.tap`。源码核查固定 Study/快照、同名同值数值证据与整数 Skill 版本、0/false/null 和不可估计、固定表单字段展示名、权限与状态分开、旧来源仅 metadata/cancel、原键回执与未知取消、身份/来源改变及迟到响应防护。

独审提出的原回执 200 后 capabilities/list GET 503 未清旧统计问题先由作者在 `methods-recovery-b27c00f7` 实证 RED，最终 `methods-recovery-659e55ad/failure.json` 前九项包含此两分支 GREEN；该包最后撤回分支因运行环境停机未执行，随后仅该步骤在 `methods-withdraw-recovery-4a2cbc5c/result.json` 通过，不能将前一失败文件标作整体通过。POST 已保存但回执不可读的意见限时证据为 `methods-ttl-4001dbd1` RED → `methods-ttl-45b69028` GREEN。主真实 Worker/页面证据 `methods-ui-a31ee85c`，三视口记录 `methods-visual-d293c802`。这些实测由作者完成，本次独立工作是复核源码、哈希与证据并重跑独立单测，不冒称自行复做全浏览器链。

Post-review：独立核对 `ui-freeze/post-review/manifest.json` SHA256 `9a0ca2bba26eeb8ce3a8870e41a8b3868dd27e9df309a8713eebe95c4f899627`，18 源文件和 21 项视觉证据匹配。新增产品差异仅本页表格单元格不自动拆行，数字不舍入且保留横向滚动；`methods-visual-9d4adbfa` 为既有 Run 的三视口只读复验，零业务 POST。此增量未见新的 P1/P2；上面的主链和环境限制仍适用。
