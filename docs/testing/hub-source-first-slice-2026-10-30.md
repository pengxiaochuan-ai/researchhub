# ResearchHub 来源目录首切片验证记录（2026-10-30）

## 结论与四层状态

1. **代码已实现：** 独立暂存、管理员来源/字段/用途审核与撤回、共用当前授权投影、G02 审核工作台、E01/E02 真实列表/详情及 `hub_source_search` 只读工具接口。旧 Orchestrator 的模型回答路径未证明已调用该新工具，不称 AI 问答完成。
2. **目标环境已配置：** 仅本机专用合成 PG、19501/19502 常驻服务及具名合成 Hub 审核权限。真实工作簿 2 批 15,697 原始行；`review_decision=0`、公开展示=0、AI 检索=0。合成夹具全部事务回滚，不作为第三方内容许可。
3. **真实请求实际执行：** 管理员批次/来源/行/历史 HTTP 200、科研人员管理 HTTP 403、真实 E01 公开列表 HTTP 200 空、未审 E02 HTTP 404、匿名 E01 HTTP 200 空；PG 合成回滚夹具验证批准→展示/检索→撤回阻断；AI 检索 HTTP 已执行但无真实已审材料。0 模型 Provider 调用、0 本轮新增费用。
4. **业务结果达到标准：未通过。** 尚无管理员对实际非演示来源录入可核验权利依据并审核，故不能展示任何真实文献或供 AI 检索，也未做旧科研 Agent 模型回答和研究者专业验收。此项不能用单测或合成夹具代签。

## 自动测试与浏览器证据

2026-10-30 后续本机补强：为 Hub AI 检索片段增加 SHA-256 与摘要展示/AI 审核版本的当前重验。先写“摘要撤回后再次批准旧证据仍应失效”测试，RED 为旧版本未拒绝，GREEN 后整组来源目录/页面契约 **24/24**、`pnpm run build` 通过。合成 PG `hub-source-e2e` 在单次事务内核验审核→检索→撤回→重新批准→旧片段拒绝、账号失权拒绝，最终回滚；不触碰 15,697 原始行或真实审核决定。自有本机服务在确认本日无新聊天任务后重启，19501–19507 恢复就绪；真实 Chrome 复测 `browser-7f40f17b/`，管理员 G02 表单、科研员 G02 403、E01 真空态/E02 404、手机无溢出、0 页面错误，PNG/WebM 和网络状态留存。此浏览器检查不证明真实获准内容或旧 Agent 模型调用；0 新付费请求。旧 Agent 完整接线和管理员真实来源权利审核仍为阻断项。

独立只读审查本小步指出两项 Important：保存的题名/DOI/来源/文件行号可能被篡改而通过重验，以及有来源合成链路只以直连角色验证。作者先写伪造引用字段的失败测试并修补为逐项当前记录比对；再在同一回滚事务中 `SET LOCAL ROLE aisci_app` 验证目标应用角色的获准检索及撤回拒绝。测试结束 `RESET ROLE` 并回滚，不持久批准第三方内容。审查原结论保留，未要求审查者复签；旧 Agent 模型链路仍是独立阻断项。

最终代码修补后再次完整运行 24/24 来源/页面契约与 `pnpm run build`，均退出 0；确认本日无新增合成聊天任务后重启自有服务，真实 Chrome 最终证据更新为 `/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-source-first-slice/browser-d432c24f/`（五项、0 页面错误，PNG/WebM/网络响应）。较早 `browser-7f40f17b/` 保留为审查前快照，不作为最终代码版本证据。

- 来源目录 PG/HTTP/前端契约及回滚 E2E：`node --test server/hub-sources/*.test.mjs scripts/hub-source-e2e.test.mjs tests/hub-source-admin-ui.test.mjs tests/hub-source-evidence-ui.test.mjs tests/real-mode-route.test.mjs`，最终 **24/24 通过**；准入/授权/schema/预检/双工作簿幂等测试 **10/10 通过**；`pnpm run build` 成功（既有大 chunk 提示保留）。旧表与历史任务未改动。
- 桌面/手机真实 Chrome 最新：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-source-first-slice/browser-6ac5394f/result.json`，同目录保留 PNG/WebM；G02 无预填权利依据，owner 403，E01 无演示回退，E02 未审 404，手机无横向溢出，0 页面错误。
- 原生 Chrome 200% 最新：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-source-first-slice/native-zoom-eb5bd00a/result.json`，admin G02、owner E01/E02 实测 innerWidth=720/scrollWidth=720，PNG/WebM 与键盘检查同目录。E02 404 态无可操作控件，键盘标记为 false，不等于控件失效。
- 初次浏览器运行暴露旧 G02 最小宽度及固定侧栏缩放溢出，已局部修复并保留早期失败证据；只以上述最终结果为通过证据。

## 独立总评审与作者修补（不冒充复签）

独立只读总评审原结论 **Blocked（完整首切片）**：Critical 为旧 Orchestrator/KbTools 尚未调用新 Hub 来源检索；Important 为批次批准后单行撤回失败、历史超过 200 条导致续审 409、在途失权缺少提交锁、公开列表无 SQL 限界；另建议澄清来源 `rights_status` 语义。作者在本片内按 RED→GREEN 修复四个 Important：单行覆盖撤回、最新 200 条历史、受控 grant 表事务锁与账号/租户行锁、SQL 有界列表与聚合计数；新增并发撤权、201 条历史、批量后单行撤回回归。首次应用角色 HTTP 500 暴露表锁权限不足，改为 ResearchHub 自有受控函数且未授予应用角色 UPDATE，重启自有服务后 24/24 通过。原独立评审未二次复签；Critical 与真实来源业务门禁仍未完成。

## 待完成的首切片验收步骤

Hub 管理员本人对至少一条真实非演示来源核验**具体来源版本、书目/摘要字段、公开展示和 AI 检索用途**的权利，录入可回查 HTTPS 或受控凭据引用，显式审核。随后在真实浏览器重跑 G02 审核→E01 列表→E02 详情→只读 AI 检索→撤回后 0 泄漏，并请研究者验收来源准确性与检索可用性。若需真实收费模型回答，先核价、核累计预算与次数并另行确认；本批准不授权新增费用。全文与规模化网络抓取另列 DP-01。
