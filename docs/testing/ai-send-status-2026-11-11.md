# 岐研AI发送状态轻量化 · 验证与交接

对应[已批准规则](../product/ai-send-status-2026-11-11.md)。只改变正常发送/实际等待/异常的呈现位置，不改后台队列、权限、计费、来源及模型逻辑。

## 四层证据

1. **实现**：agentCommandView在无实际运行/排队任务、全局暂停、未知结果或失权时，将FIFO首个waiting作为普通对话问题；余项和澄清/真实暂停保留队列操作。正在编辑的首项留在原区。共享Composer原单一轮询不变，用稳定父状态回调呈现线程内“我的问题＋正在处理…”，已存在同Message.id不重复。切身份/会话或失权时不交付旧展示。
2. **本机生效**：既有本机Vite加载实际改动，收尾查询PID66711、19501–19507七服务ready；本任务未重启后台，不触碰旧服务或临床库，也不是生产发布。
3. **真实请求**：复用ai-first-entry-live验证脚本，RH_AI_EVIDENCE_DIR指向本轮目录，保留前序证据。owner/admin各从空入口直接发明确科学歧义“解读报告”，各1次创建＋1次commands、刷新恢复。本人/合成租户/消息DB核对正确，0模型job/UsageRecord/新费用；owner按原Token不足暂停，admin按原科学澄清，仍有具体操作，只软取消本轮这两条未执行指令。
4. **使用路径**：正常首问轻量处理、真实忙时追加编辑/删除、准入→执行→完成按同id不重复，单篇正常及澄清无“尚未发送”矛盾，身份/来源拒绝和显式未知重试均有Chrome证据。双账号真实首发/刷新、普通/单篇/证据展开及1440/1024/768/390/320既有视口回归；已目视检查本轮普通桌面/单篇澄清截图，旧消息/来源仍保留。不以免费受控执行阶段冒称新一轮模型质量验收。

## 测试与评审

- 纯分流/SSR先RED后GREEN4/4：FIFO、真实running/queued/processing、paused/uncertain/restricted、非阻断澄清、编辑留位、真实id去重及正文转义。
- Chrome RED：首问原只在准备卡片；修补后进入线程。追加RED：执行时进度原2行、单篇原同时“尚未发送”，以及澄清后idle标签复现，均已最小修补。单篇统一不展示无价值idle标签，非idle/失败/权限仍保留。
- 最终当前工作树完整回归：`node --test --test-concurrency=1 tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`433/433，106.0秒，无跳过。
- 最终Chrome：`node --test --test-concurrency=1 scripts/ai-command-ui.test.mjs scripts/ai-conversation-ui.test.mjs scripts/ai-first-entry-ui.test.mjs scripts/ai-context-rail-ui.test.mjs`24/24，93.3秒。
- `npm run build`4.80秒通过，既有大包提示保留，无依赖/DDL/后端改动。
- 一次独立只读总评审：4项分流/SSR重跑、代码及普通/单篇/澄清截图核对；指出idle矛盾并经RED/GREEN补齐，最终无Critical/Important。未写库/文件或调用模型。

首次含新文章用例的整轮业务断言通过，但测试结束后route.fetch尚未结束，产生context disposed异步失败，整轮未算通过。已改为开头一次只读预取真实上下文，后续仅回放快照，并等待路由清理；不吞业务断言。对应诊断请求头已脱敏，保留失败日志；最终全套重新通过。没有为修测试改后端或放宽来源。

## 可复核记录与限制

`.tmp/ai-send-status-2026-11-11/`：unit-red/green、ui-red/green、transition-red、article-red、article-paused-red、browser-final（历史失败）及browser-verified、suite-verified、build-verified、real日志/real-results.json；normal-pending-desktop/390、article-pending、article-clarification、双账号first-entry/refreshed/390 PNG和video/WebM。原交互测试视频沿用其原目录。

本轮新会话owner `cmwbu8p2q0007luh38n1rl23p`、admin `cmwbu905o000kluh3uu2bmwsc`；前序消息/账本不改。正常处理不是“模型已开始思考”的承诺，而是已接收、正在处理（含原准入）；遇到异常仍转具体状态，不伪造进度或自动重试。用户最终操作感受待体验；无云、远端配置、扩额/权限或真实发布。
