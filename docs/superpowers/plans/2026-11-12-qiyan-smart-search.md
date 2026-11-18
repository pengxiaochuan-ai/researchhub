# 岐研AI智能搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 用户已选择当前目录串行实施＋独立总评，并于2026-11-12批准既定范围自动推进，不重复索要计划批准。保留原未提交改动，不自动提交/切worktree/删除证据；该用户约束优先于技能的默认commit/清理步骤。

**Goal:** AI01原工具按钮变为用户明确开启才外检的智能搜索，实际搜索/读网页/引用/续问与业务用量闭环。

**Architecture:** 新的Hub窄工具循环，独立OpenCode workspace与loopback能力，复用旧Client/Sessions/Billing/当前授权。旧单次综合不放宽；逐指令联网快照贯穿队列到实际出站，网页读取由Hub严格前置控制。

**Tech Stack:** 现有React/Vite、Node mjs、OpenCode 1.18.27、旧Nest/Prisma源码核心及专用合成PG；不新增付费服务或依赖。

**Spec:** [已批准设计](../specs/2026-11-11-qiyan-smart-search-design.md)。

## 2026-11-12执行结论（当前状态）

S01原生真实工具、S02快照队列、S03出站门、S04公开读取、S05真实工具循环与计费、S06原位UI均已实施并验证。S07本机工程交接完成：581免费、29真实Chrome及最终4专项、构建/真实PG/API，原两账号5成功/2失败真实任务与7笔结算保留；独立总评无未关闭Critical/Important。专业核对两处过强推论/授权归属待用户验收，生产未实施。全部证据见[最终台账](../../testing/qiyan-smart-search-2026-11-12.md)。

下方复选框保留原任务细目，不作为当前未执行队列；部分跨状态校验以免费/合成运行举证，没有额外付费在途撤权、真实外站403或正式发布。逐项证据与未测边界以台账为准，不把实现/工程测试自动折算为专业签收。

## Global Constraints

- 原按钮位置/布局、14/22操作、16/28长文不重排；默认OFF，切身份/会话/刷新OFF。ON不是授权私有资料外发。
- 仅本机专用合成环境、原两个账号/当前Study/本人具名新对象；旧历史/队列/账本不重跑、不改写；不改旧服务或云/远端配置/生产。
- 正常Token额度/预留/逐调用真实usage与未知保留，不恢复开发轮次限额；新增搜索服务费用/账户/权限先停。
- 先RED→GREEN、免费与真实调用分开，取得实际工具/URL/时间/状态/原文与结果后才称接通；代码、启用、执行、用户效果四层分别交接。

## Review Focus

- 排队后切换开关或未知响应重试不得改变已提交的联网位（S02/S06）。
- OFF下旧PubMed/knowledge-messages及内部队列不能绕出站门（S03）。
- “只用Hub/不联网”收窄ON，单篇固定证据不因共享输入框获得新工具（S03/S06）。
- DNS/重定向访问内网须在请求前拒绝，外站文本不得改变模型权限（S04/S05）。
- 第二次模型调用失败或取消，已知用量不能漏记、未知不能归零，旧policyHash历史不能失读（S05/S07）。

### S01 · 原生搜索与本机工具可实施性

**Files:** 新`scripts/smart-search-native-probe.mjs`及其免费契约测试；私有证据`.tmp/smart-search-2026-11-12/`；现有runtime仅供复用启动/停止本次child。

**Interfaces:** 消费prepareHubWorkspace/startHubPreflightRuntime，产生原生websearch真实结果/工具轨迹、版本和配置核验记录；不产生业务任务或真实模型账单。

- [ ] 写免费探针契约测试：无--live不外检、固定公开查询、隔离无真实凭据、固定provider、必须有completed工具与来源；先确认失败。
- [ ] 实现独立临时loopback模型替身，只命令一次websearch，不接真实模型；工具真实访问公开搜索服务，保留响应，不冒充模型能力验收。
- [ ] 验证当前runtime原生搜索与自定义只读工具接法、前置hook可用性；不可用/需新费用凭据时记录并停，不先改业务后端或引入备选服务。
- [ ] `node --test scripts/smart-search-native-probe.test.mjs`通过后运行一次显式live探针，记录0真实Provider/0DB写与成功/失败门槛。

### S02 · 逐指令联网快照与队列

**Files:** 新`server/ai-agent/network-intent.mjs/.test.mjs`；conversation-commands及测试；本机控制器参数白名单。

**Interfaces:** `normalizeNetworkIntent(value)`输出严格schema+boolean默认false；`effectiveNetworkIntent(intent,text)`只收窄。Message.meta.hubCommand规范快照→Job.payload同一快照，route只绑定hash。

- [ ] RED：缺省OFF/非法值、同requestKey换位409、编辑保留、重放相同、stage/dispatch/CAS保持；旧无快照历史读取不变。
- [ ] 最小补submit/item/edit revisions/prepare payload及API白名单，不改DDL、角色或旧Consumer历史。
- [ ] 运行network-intent、conversation-commands、原Worker测试；通过后记账本/旧历史保全。

### S03 · 路由与OFF全链外检门

**Files:** skill-routing/session-skill-routing、natural-literature-plan、literature-session/PubMed adapter及相关测试。

**Interfaces:** 新路由版本绑定networkIntent；ON通用外检进入`hub-smart-search`，明确PubMed保留专门分支；OFF及文字收窄将sourceCeiling约束到Hub；出站前必须current网络快照。

- [ ] RED：OFF实时外检请求免费澄清、ON仅Hub不外检、ON明确PubMed原能力、普通交流不强检、单篇及旧history/policyHash兼容。
- [ ] 添加新任务版本规则，不全局重算旧策略；请求/Worker与真实MCP调用前双重守门、旁路缺省OFF。
- [ ] 运行既有路由/自然规划/文献会话与新增测试，实际工具计数证明OFF为0，不能以伪造工具轨迹通过。

### S04 · 受控公开网页读取

**Files:** 新`server/ai-agent/public-web-fetch.mjs/.test.mjs`，OpenCode本机能力工具桥。

**Interfaces:** `fetchPublicPage(url,{authorize,signal,...})`返回实际URL/标题/文本/抓取时间/hash/截断；只由本次任务能力调用，不暴露通用HTTP代理。

- [ ] RED：私网IPv4/IPv6/映射地址、DNS多地址、重定向到内网、userinfo/端口、超大/非文本、取消/超时、提示词/脚本剥离。
- [ ] Node标准HTTPS绑定验证DNS结果、逐跳重验/流式限制/无环境Cookie认证；禁止ChiCTR暂停路径与任何登录/验证码绕过。
- [ ] 运行免费单元/本机集成保护，再按同一执行器实读一条公开通用网页；不能用Codex网页工具替代Hub真实工具。

### S05 · 新OpenCode工具循环与实际用量

**Files:** 新`server/ai-agent/smart-search-runtime.mjs/.test.mjs`、`smart-search-session.mjs/.test.mjs`及新证据/输出契约，runtime受控新增模式、本机装配。

**Interfaces:** `runSmartSearch(turn,{providerCall,authorize,...})`只允许websearch/受控read，返回text、真实工具、固定证据与逐调用usage；Session保存/提交/历史校验沿当前权限与claim；没有新表。

- [ ] RED：模型工具关联/无工具伪成功、未知来源引用拒绝、迟到撤权、原始环境不外发、有限步/页/时限、第二次模型失败/未知真实usage不丢失、不重复结算。
- [ ] 独立能力proxy、旧Client/OpenCode原生搜索、受控读取工具、服务器来源渲染；保持旧固定综合断言不变，不自动重试模型或搜索provider切换。
- [ ] 原UsageAccumulator聚合每次已知usage，unknown按原billing待核；旧history schema和普通policyHash注册不覆盖。
- [ ] 免费目标环境集成、PG/CAS/来源/授权/账本保全测试通过；新增服务费用或代理/依赖需求停下确认。

### S06 · 原位开关、排队与来源呈现

**Files:** HubAgentPanel/AgentCommandComposer/useAgentCommands、现有AgentMessages/来源组件及局部样式/测试。

**Interfaces:** Composer发送时复制networkIntent，未知重试使用原body；按每项实际快照呈现“智能搜索”短状态。切换会话/账号/Study/刷新OFF，不从历史反向开启。

- [ ] RED：按钮名称/aria-pressed、键盘、排队期间切换/编辑/删除、首次建会话保留本条位、断网原编号恢复、切身份/迟到拒绝、单篇固定能力隔离。
- [ ] 原位按钮与既有选中样式，不新增布局/配置窗口/开发说明；结果显示真实来源、阅读范围与部分失败，不缩字。
- [ ] 免费Chrome受控故障与实际API/PG新指令闭环，原会话/输入/历史专项回归及build。

### S07 · 真实链路、独立总评与交接

**Files:** 新本片免费/真实验收脚本、`docs/testing/qiyan-smart-search-2026-11-12.md`、当前产品Living文档与Notion。

- [ ] 原两个账号全新公开通用样例完成OFF阻断、ON搜索/实际读取/回答/来源/续问/刷新；明确PubMed一次，按正常账本记录真实用量，不补额/充值。
- [ ] 真实Chrome1440/1366/390、键盘/队列/失败/身份/迟到及Reading16/28，截图/WebM，原生200%另记实测，不借Mock或旧快照冒充。
- [ ] 运行`node --test --test-concurrency=1 tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`、本片PG/API/Chrome、`pnpm run build`；保存全部失败与修补RED→GREEN。
- [ ] 一次独立最终代码/结果总评，同范围修补后验证；同步产品基线/变更/版本/说明/Skill/技术/测试及Notion。明确专业用户验收与生产未做，不将代码/配置当四层完成。

## 执行账本与自检

当前目录用户授权优先：不另开worktree、不自动commit/清理，不恢复其他计划。记录在`.planning/2026-11-11-smart-search/`及`.tmp/smart-search-2026-11-12/`，每步带RED/GREEN/结果/偏差。

接口核对：S02网络快照被S03/S05/S06共同消费；S04的授权/取消与S05同一任务；S05每次usage进入同一业务聚合，不把最终一次覆盖前序；S06未知重试不得读取当前开关。实现计划与规格冲突以规格为准，同范围工程细节记Ruling继续，新增权限/费用/服务停线。
