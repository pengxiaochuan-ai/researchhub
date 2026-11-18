# 岐研AI验收修补实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。当前目录串行实施＋一次独立总评审；用户已确认范围并要求无需确认自动继续，不重复提交同一审批。

**Goal:** 闭环四项验收反馈，输入不中断、等待可管理、成功后自动继续。

**Architecture:** Hub独立命令适配复用已有KnowledgeChatJob/Message、授权锁、Worker及计费；不改旧内核/共享表。AI01两种会话共用等待队列组件，保留各自固定来源和权限。

实施核对：真实PG的knowledge_chat_job_status_check不支持新增等待状态，所以仅Message.meta保存编辑前队列，派发后才创建原queued任务；约束失败在工具输出留痕，未改任何共享约束。免费测试consumer与产品交互consumer独立，防止演练队列被产品调度。

## 执行台账

- T1完成：原话RED/GREEN、明确仅Hub不联网、总命中/实际读取说明，正文固定说明和常驻状态按钮已移除。
- T2完成：Message元数据持久队列与窄接口，派发时当前授权/Skill/固定证据/额度检查，原Worker机制真实执行；新对象具名隔离，不扫描旧任务。后台游标轮转跨过暂停项，真实PG验证200条阻塞后第三会话仍可访问。
- T3完成免费验证：执行时输入、版本编辑/软删除、状态冲突核对、刷新/断网/迟到/撤权与清草稿；双账号Hub＋owner文章真实界面通过。当前Token不足，真实模型连续回答验收未完成。
- T4技术验证完成：397单元/契约/PG/原Worker、12浏览器、构建通过；一次独立评审3项Important均先RED再GREEN修复，无二次评审。初始全量一项旧SSR固定说明断言按获准新交互更新，最终零失败。小问题为文章默认问题未异步预填，暂缓；窄屏历史需滚动沿用已确认布局，不扩改。
- 授权边界：不充值、补额度、扩大权限、改旧系统或发布。产品体验最终签收独立。等待指令留痕、派发后正常业务预留/结算，不引入开发费用门禁。

**Tech Stack:** React/Vite/Node MJS/PostgreSQL，已有Playwright，不加依赖。

**Spec:** docs/product/ai-conversation-acceptance-2026-11-10.md

## Global Constraints

专用合成环境，原两账号及当前Study；不改布局、权限、额度、旧服务或云配置，不发布。不为自动测试触发真实付费调用，不提交/清理其他已有更改。

## Review Focus

双标签竞争派发/编辑、确认发送期间输入被覆盖、等待“上述论文”误绑定旧父结果、刷新恢复误扫历史、上一任务失败却连续调用。每项对应下列T2/T3负例。

### T1：原话和输出修补

Files: server/ai-agent/literature-query.mjs/.test.mjs，literature-output.mjs/.test.mjs，pages/shared/HubAgentPanel.jsx。

- [ ] 原话应ready/hub-only；不明排除条件仍clarify，RED后补普通表达。
- [ ] 篇数说明明确总命中和实际读取，保持原证据值；删正文固定说明，移除常驻状态按钮。
- [ ] 跑规划/输出测试，预期全绿。

### T2：持久命令接口

Files: server/ai-agent/conversation-commands.mjs/.test.mjs，session-skill-routing.mjs，scripts/local-article-ai.mjs，scripts/local-knowledge-ai.mjs。

Interfaces: createConversationCommands({transaction,authorize,stage,schedule})提供submit/list/edit/cancel/resume/tick；POST sessions/:id/commands，PATCH sessions/:id/commands/:commandId，POST .../:commandId/cancellation，POST .../commands/resumption，GET .../commands。修改携带version，返回409不得覆盖。

- [ ] 先测试waiting→queued→completed→next、失败暂停、编辑/CAS、软取消及幂等；RED后实现。
- [ ] 实际原授权和会话锁事务、当前Skill/文章证据派发、worker唤醒及具名标记扫描接入。测试不修改原任务，不扣预留。
- [ ] 真实PG并发/归属/刷新回读验证，预期隔离与版本竞争正确。

### T3：两模式输入及队列

Files: pages/shared/AgentCommandQueue.jsx，useAgentCommands.js，HubAgentPanel.jsx，ArticleAgentPanel.jsx，src/knowledge-session.js，real-ai-workspace.css。

Interfaces: Hook scoped session manages commands and polls callback state；不自动重放未确认POST，编辑/取消/继续显式操作。

- [ ] 受控浏览器RED：任务处理中输入可用；继续录入不被提交完成清空；等待编辑删除；刷新恢复；切身份清除/迟到响应隔离。
- [ ] 实现输入区上方队列及轮询；加入队列不禁输入，提交按钮只在提交确认期间禁用，错误重获状态不放松来源。
- [ ] 双账号真实后端/PG界面验证、桌面和390px截图录屏；不调用真实模型。

### T4：集成及交接

- [ ] 单元/契约、后端/PG、完整浏览器/构建通过；独立总评审并一次RED/GREEN修补。
- [ ] 同步产品基线、变更、版本、使用说明、测试证据及Notion；明确未覆盖的真实模型验收。不commit、不重排目录。
