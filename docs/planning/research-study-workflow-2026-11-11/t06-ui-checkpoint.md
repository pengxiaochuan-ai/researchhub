# T06 页面接线检查点

2026-11-12。研究者/管理员合成案例的页面代码与本轮定向验证记录；后续完整本机通用合成软件验收已通过，真实临床规则及生产未批准。

## 本轮前端改动

- `pages/shared/ResearchSubjects.jsx` 与 `pages/shared/research-subjects.css`：在 S03/S04 现有页面区域承接假名编号列表、建档、参与事实、正式入组及访视；按服务端能力和政策显示动作、阻断及历史；站内确认、身份/撤权清理、超时与明确核对。受限尺寸下保持页面可读，未改全局 Shell。
- `src/research-subjects-session.js` 与 `scripts/t06-ui-session.test.mjs`：严格正式 scope 路由、待发原请求的 actor/认证版本/Study/Subject/15 分钟边界、到期不含正文未知标记、只读回执作用域与用户语言缺项映射。
- `pages/shared/missing-main.jsx`、`src/real-mode-route.js`、`src/research-design-session.js`、`src/session-lifecycle.js`、`src/platform-shell.js`：正式分支进入、真实身份模式、受保护返回与既有 header；原合成采集路由保留。`pages/shared/ResearchStudyOverview.jsx` 在既有受试者指标处提供本 Study 入口。
- `src/auth-session.js`、`src/platform-auth.js`：仅在返回值为合法非负整数时传递当前认证版本；缺失时 T06 拒绝恢复/写入，不能以账号 ID 代替版本。后端 auth/me 变更由主循环负责。
- `t06-ui-assessment.md` 更新页面契约及过期未知状态；完整产品文档、版本记录和 Notion 同步由主循环收口。

## 已有证据

- 新合成账号管理员建档、筛选、两类同意、入组和访视回读：`t06-ui-8bf6bd36`；真实研究者同一流程四项完成：`t06-ui-86165d8e`，该脚本最后错误地预期 release GET 403 而标记失败，保留原轨迹；后续 `t06-role-b26a41f6` 确认该 GET 可读、审批能力为 false 且审核 POST 403，跨 Study 和 Hub-only owner 拒绝访问。
- 实际已提交用途撤回的响应被模拟丢失后，同一 tab 刷新保护、同键同正文重试及当前状态回读：`t06-unknown-9ad500c5`。原先状态码断言和重复文本定位造成的失败仍保留。
- 模拟 503 保留未提交输入、政策基准变化阻止保存、真实 Cookie 切换清除旧输入：`t06-fault-40a8cc29`；真实身份切换清除待发记录并阻止旧身份恢复：`t06-fault-203fad60`。仅对受控新合成账号的本 Study project membership 真实禁用再恢复，两次留审计：`t06-revoke-93bbada7`。
- 15 分钟过期原命令替换为无正文范围绑定标记、刷新后仍禁写以及注入 404 仍未知：`t06-expired-c716afad`。这里的 404 为浏览器注入，不能作为新回执接口真实联调证据。
- S03/S04 390px 和 Chrome 原生 200%（outer 1440、inner 720、DPR 2、visual scale 1）无横溢，正文/按钮 14px/22px：`t06-visual-306f5273`、`t06-visual-d4287db1`。后者 `native-cdp.png` 是折叠已有导航、滚动至操作区后，以完整窗口范围截取的参与事实及动作；先前截图裁切/测试失败保留。

证据位于 `docs/testing/evidence/research-t06-2026-11-12/`，仅含合成数据的截图、录屏与结果，不含 cookie 或存储文件。

## 尚待主循环完成

真实只读回执 HTTP 和浏览器恢复已通过：200后重读当前退出状态，404刷新仍未知且不自动重发。证据 `t06-receipts-eb9dd2b3/result.json`、`t06-receipts-browser-17f19604/result.json`；本机通用合成软件四层通过，临床/生产及后续处理撤回全链未验收。先前注入和失败轨迹保留。

最终定向测试 72 项通过：`/tmp/t06-final-tests.log`；独立 Vite 构建通过：`/tmp/t06-final-build.log`，仅有既有大 chunk 提示；输出 `/tmp/researchhub-t06-final-build`，未覆盖共享 dist。
