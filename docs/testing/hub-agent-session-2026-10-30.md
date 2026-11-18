# Hub 来源接入旧科研 Agent · 本机验证（2026-10-30）

## 四层状态

1. **代码链：** 独立 `hub:lingshu-xinyu` 会话复用旧 Sessions/KnowledgeChatQueue/Orchestrator、模型费用门禁与原子提交。旧内核只读 `kb_search` 工具槽在 ResearchHub 适配层执行实际 `hub_source_search`；持久化 `hubSources` 和 `sourceType=hub-reviewed-publication`，不作为私有 Study KB 文档。来源审核/片段、账号及租户在工具、模型前后、提交及历史/来源读重验。
2. **本机配置：** 专用合成 PG 和 19501–19507 自有服务已启用，原 owner/admin AgentAccess 保持；不改旧服务/角色/共享底座。两份第三方工作簿 15,697 行仍 0 权利审核、0 公开、0 AI。预算/报价门禁当前阻断新付费任务。
3. **实际请求：** Chrome 以两个合成账号各执行登录、AI01 读取当前 Agent/预算、`POST /api/sessions/hub-source` 201 和会话状态 200；匿名手机不显示 Hub 会话。原 Orchestrator 的检索→模型调用顺序用免费 Provider 替身测试；合成 PG 回滚事务验证审核→Hub 检索→撤回/重批旧证据拒绝。没有真实 Provider HTTP 请求，本轮新增费用 0。
4. **业务结果：未通过。** 真实非演示来源尚未由管理员具名审核，故没有可展示或 AI 可检索的真实文献；也未取得真实模型输出和研究者专业验收。不能称完整来源问答或首切片交付。

## 运行证据与限制

- 合并相关单测/集成/UI 契约：`node --test --test-concurrency=1 scripts/hub-agent-contract.test.mjs scripts/hub-agent-orchestrator.test.mjs scripts/hub-source-e2e.test.mjs tests/knowledge-ai-session.test.mjs tests/hub-source-evidence-ui.test.mjs tests/hub-source-admin-ui.test.mjs server/hub-sources/agent-retrieval.test.mjs server/hub-sources/visible-repository.test.mjs server/hub-sources/read-controller.test.mjs server/hub-sources/review-service.test.mjs server/hub-sources/review-controller.test.mjs`：26/26 通过；合成 PG 审核/撤回/到期测试均在事务中回滚，不持久化合成许可。
- `pnpm run build`：通过；保留既有大 chunk 警告。
- 真实 Chrome：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-agent/browser-850b4513/result.json`，同目录 PNG/WebM。owner/admin 建会话及费用阻断、匿名 390px、桌面 1440px、20px 标题/14px 说明、无横向溢出、0 页面错误。截图中不含模拟 AI 答案。
- 独立总评审指出四项缺口并已小步修补：最终提交事务补租户上下文并在来源行持共享锁直到提交，避免撤审竞态；自然问题从用户原文确定性抽取主题短语再检索；Hub 历史 60 条回答改为单次只读事务顺序重验，避免并发打开数百连接。合成 PG 验证自然提问命中、提交重验、共享锁与并发撤审互斥；免费替身验证旧 Orchestrator；没有真实收费回答。
- 修补后重启自有本机服务并再测 Chrome：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-agent/browser-efd4581c/result.json`，owner/admin 各 201 会话、200 状态，匿名 390px、0 页面错误；PNG/WebM 同目录。此证据取代前述浏览器检查点，但不证明真实 Provider 执行。
- 独立复核又发现事务内授权到期曾按 `now()` 的事务开始时间判断；合成事务跨到期 RED 后改为 `clock_timestamp()`，GREEN 验证过期即拒绝。复核后未发现新的权限/证据泄漏阻断。最终完整浏览器证据：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-30-hub-agent/browser-b3172be6/result.json`，两账号各有 201 Hub 会话与 200 历史状态，匿名手机无入口，0 页面错误。历史最多 60×6 来源仍可能在 20 秒事务内出现性能超时；本轮解决了连接风暴，后续需批量重验压测，不将其称为已证明的大容量性能。
- 用户与管理员的来源审核入口 G02、获准展示 E01/E02 仍按[首切片测试](hub-source-first-slice-2026-10-30.md)执行；本轮未代管理员审批第三方内容，也未发起云/远端配置/发布。

## 下一验收门槛

Hub 管理员本人先核准至少一条真实来源的书目/摘要展示及 AI 检索权利；再单独核价、核预算和实际请求次数并取得付费调用确认。随后在本机用全新通用研究问题验证真实旧 Agent 工具轨迹、Provider 用量、[n] 引用、撤回在途阻断与历史隐藏，最后由研究者评阅答案与来源。任何一项缺失均保留未验收状态。
