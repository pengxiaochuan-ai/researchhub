# H0 五份外部来源逐项审核：本机验证记录

日期：2026-10-31；目标：仅 `wp01_test_full_baseline` 中原五份具名来源与原合成管理员。未接临床库、旧服务、云资源、远端配置或付费模型；未创建真实审核批准。

## 技术结果

- RED：新服务测试先因 `external-review.mjs` 不存在失败。实现后，合成 PG 服务测试验证具名管理员、当前 grant、当前版本 SHA、字段/用途 CAS、批准后撤回及事务回滚。测试中批准/撤回均在合成事务回滚，库内保留 0 条决定。
- Schema 门禁仅对 `external_review_decision` 增应用角色 INSERT 与序列 USAGE；原文件 payload 仍无 SELECT，原三表无写权限。迁移脚本二次应用返回 `created:false`，无旧表改动。
- 本地服务重启后，HTTP 验证匿名 401、科研人员 403、缺依据 400、旧 SHA 409，失败均未写决定；`Cache-Control:no-store`。独立总评审发现五份范围、导入并发、占位依据、常态回归与成功反馈缺口，均已做最小修补。`node --test server/hub-sources/*.test.mjs scripts/hub-initial-five.test.mjs`：31/31 通过（重启新服务后复跑）。`npm run build` 成功，原有大 chunk 告警保留。
- `node scripts/hub-initial-five-import.mjs --apply` 复跑：`inserted:0`，五份原件不变。`node scripts/hub-initial-five-verify.mjs --verify`：5 文档/5 版本/5 原件、当前 0 决定、应用角色跨租户可见 0、payload 不可读、审核事件可 INSERT。验证器现核对事件归属、版本、具名审核人及 HTTPS 依据；**不再要求决定数恒为 0**。本次库内实际仍是 0，不代表未来必须为 0。

## 真实浏览器

本机 ChatGPT in-app browser 的真实 G02 页面，已登录具名合成管理员。五份卡片、原始目标疾病、受控原件名、版本、SHA 与当前未批准状态真实显示；“全文→AI 检索”切换后确认文案同步变化。以无效依据 `invalid-evidence-reference` 及未登记 `evidence://unregistered/placeholder` 分别提交，后端均拒绝，最新界面显示“请提供可核验的 HTTPS 用途权利依据链接”；随后清空输入并取消勾选。截图：[管理员桌面](evidence/h0-external-review-2026-10-31/g02-admin-desktop.png)、[无效依据拒绝](evidence/h0-external-review-2026-10-31/g02-invalid-evidence.png)、[未登记引用拒绝](evidence/h0-external-review-2026-10-31/g02-unregistered-evidence-rejected.png)。本轮未取得 Playwright 录屏、真实 200% 浏览器缩放或手机视口证据，不能称完整 UI/UE 验收。由于没有真实权利依据，未通过浏览器执行持久化成功路径；成功提示由代码和事务回滚测试覆盖。

## 四层结论与待办

独立只读复核确认前述五份范围、具名预览、占位依据、导入/审核锁、非零历史校验与成功提示六项均已闭合，未见阻断**本机合成管理员审核入口**交付的新问题。应用角色 `aisci_app` 的 INSERT 是整角色数据库权限，具名人员限制在 HTTP 服务层；不能宣称生产级数据库人员隔离。将来若为同五份导入 v2，初始五份验证器须另按新版本切片适配，本轮只验证 v1。

代码已实现、目标本机合成库已配置启用、真实 PG/HTTP/浏览器请求已执行。业务效果“管理员完成权利核验、五份获准内容对用户展示或供 AI 检索”**未达到**：真实决定数为 0，且五份原件尚未接入公开/Agent 内容投影，摘要与全文尚未受控提取。管理员需要提供逐项可核验权利依据并作专业决定；另一个受控切片才可接入相应展示与检索。不得把 31 项测试通过等同于五份来源已发布或 AI 已使用。
