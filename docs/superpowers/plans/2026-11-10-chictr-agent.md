# ChiCTR 按需联网 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在原岐研AI会话完成ChiCTR实时检索、选定公开详情读取和1–3项试验比较，来源可核对、续问及刷新可恢复，不批量入库。

**Architecture:** 复用Hub独立OpenCode、现有Skill/Job/Message、当前授权及原Sessions/Billing。ChiCTR使用独立来源类型和后端受控只读适配器，不冒充PubMed MCP或PMC证据包。先通过真实站点协议门槛，再写工具和会话接线；旧版本策略继续按原契约读取。

**Tech Stack:** 现有Node ESM/React，node:test与现有合成PG回滚工具；若核准为HTML正文，复用Python标准库HTMLParser模式，不增加爬虫框架、浏览器服务或外部付费检索商。

**Spec:** [已批准设计](../specs/2026-11-10-chictr-agent-design.md)。2026-11-10用户回复“批准”确认设计，随后“通过，继续后端实施”批准本计划；当前C01访问核准中，未通过前不进入后续业务代码。

## Global Constraints

- 当前目录串行实施＋一次独立代码总评审；保留全部已有修改，不自动commit/stage或创建worktree。
- 仅本机原两个合成账号、当前合成Study，数据库仅`wp01_test_full_baseline`；不改旧内核、共享底座、角色/额度、云资源、远端配置或真实发布。
- “不批量入库”：只保存本人会话的受限Job/Message来源快照，不写来源目录、知识库、资产候选或collector。
- 保留AI01已确认布局和输入/历史/来源区域，不增加开发说明；C01/C03和G02不变。需要布局、新权限或新服务时另行确认。
- 搜索默认6、最多10条；详情/比较1–3项。清单覆盖不代表穷尽；限制为单次产品范围，不恢复累计开发费用/次数门禁。
- 只发公开研究主题，业务投影排除电话/邮箱/详细联系地址；原文只作数据。计划样本量/结局不是实际结果；不新建计算能力。
- 正常Token额度、并发预留、实际结算和未知用量待对账保持；不充值、不补额度、不自动付费重试，不处理暂停的历史预留。
- 站点访问受限/验证码/无获准获取路径时停在明确阻断，不绕过、不用旧快照或搜索引擎缓存替代实时执行。

## Review Focus

1. “临床试验/研究设计”被旧router先当方案设计：注册任务必须先被识别，PubMed旧任务不变（C03）。
2. 切换PubMed/ChiCTR检索后“第一项/继续”误绑父清单：固定来源类型、父Job/hash和原用户问题（C03/C04）。
3. 原站返回200校验页或字段移动：不能当0条或把相邻字段补入，解析必须明确失败（C02）。
4. 一条详情失败却生成双试验比较：全部选定详情齐备才综合，计划指标不能说成已证实结果（C04）。
5. 中途撤权、取消、刷新或迟到响应导致泄漏/二次收费：工具/模型/提交/读取重验，刷新只读（C04/C06）。

## 文件职责

- `server/ai-agent/chictr-client.mjs`：固定站点、核准协议、串行限速、响应大小/超时/重定向/取消与只读轨迹。
- `server/ai-agent/chictr-parser.mjs`：原站响应到注册清单/详情白名单字段与位置证据，拒绝身份错配/不明结构。
- `scripts/parse-chictr-html.py`：仅当C01证实直接HTML路径可用时建立的标准库解析器；不修改既有MHTML入口。若C01证实唯一允许的是正式JSON接口，直接在parser使用固定JSON契约，不创建此文件，核准证据与任务文本同步说明。
- `server/ai-agent/registry-query.mjs`：中文注册意图、条件保留/澄清、按注册号或父清单选择与继续的确定性计划。
- `server/ai-agent/registry-session.mjs`：Job证据快照/父归属、准备、重验、OpenCode综合、接受输出及历史投影。
- `server/ai-agent/registry-output.mjs`：固定来源解释契约与计划/结果分离，未知引用拒绝，局部内容标注。
- 既有router/session-skill-routing、`scripts/local-knowledge-ai.mjs`：仅新增注册分支和本机装配，不重构其他执行器。
- 既有`src/literature-source-links.js`、`pages/shared/{LiteratureSources,AgentMessages,HubAgentPanel}.jsx`：原位置呈现新来源，不改CSS/结构。

## C01 · 站点访问与契约核准（半天止损，零模型）

**Files:** Create `docs/testing/chictr-access-2026-11-10.md`，`tests/fixtures/chictr-live/manifest.json`及最小去联系信息夹具；实施批准后可创建只读`scripts/qiyan-chictr-probe.mjs`。

**Interfaces:** 产出manifest记录实际host/path/method/参数名与编码、响应类型、解析器版本、当前规则依据/时间、查询和一条详情的真实ID/URL/指纹。它是观察结果，不由后续任务猜测补齐。

- [ ] 用正常浏览器实际搜索公开主题“针灸＋抑郁”，核对输入和结果；详情只沿搜索得到的有效URL，不能枚举proj或把ChiCTR号直接改成proj。
- [ ] 读当前公开规则，确认允许获取方式；核准病名/干预字段的组合和单次分页语义。对不支持的年份/设计/招募限定保留澄清，不声称已应用。
- [ ] 在原本机出站约束下执行同一核准只读请求，验证返回身份/字段和浏览器一致；只证明开发者浏览器能读不算门槛通过。响应上限8MiB、请求超时15秒、无自动重试；同源串行最小间隔由规则和观测取更保守值，写进manifest。
- [ ] 成功后保存安全夹具与原响应指纹/获取时间，不保存Cookie/密钥/个人联系方式；清楚标记真实观察与合成错误页。
- [ ] 核准不了、需要新登录/浏览器常驻/付费服务或与获取规则冲突则停止C02–C06，提交具体差异；不创建默认禁用的伪完成入口。

交付门槛：公开主题实际条件搜索＋一条有效详情＋产品后端可执行方式三者成立。首次网页结构尚未确定，因此C02的传输映射须来自本任务证据；若不能符合该单来源最小设计，先修订计划而不是边做边扩范围。

## C02 · 有界只读客户端与来源解析

**Files:** Create `server/ai-agent/chictr-{client,parser}.mjs`及同名`.test.mjs`；按C01结果决定是否建立`scripts/parse-chictr-html.py`。

**Interfaces:** `createChictrClient({transport,protocol,authorize,record,clock,signal})`返回`search(plan)`和`read({registrationNumber,sourceUrl})`；`parseChictrResponse({bytes,kind,expectedId,sourceUrl,protocol})`返回`{items,totalCount,coverage}`或详情`{registrationNumber,sourceUrl,retrievedAt,updatedAt,fields,hash}`。fields使用设计的`value/sourceQuote/fieldPath/status`，不返回原HTML。

- [ ] 先写红测：真实安全夹具身份/字段定位；空结果、200校验页、重复标签、缺失字段、编码错误、原始疾病/主题不混淆、联系信息不出投影。缺失为`not_reported`，读取异常为`unavailable`；不能字符串取相邻单元格兜底。
- [ ] 写出站红测：拒绝非HTTPS、userinfo/port、私网/异域/不明路径参数、越界重定向、超8MiB、403/405/429、15秒超时与取消。重定向最多3跳且每跳重验，遵守Retry-After；取消关闭尚未交付响应流。
- [ ] 运行`node --test server/ai-agent/chictr-client.test.mjs server/ai-agent/chictr-parser.test.mjs`，保存预期失败；实现最小代码，仅支持C01核准的一条传输路径，不预置未观察到的API。
- [ ] 重跑同命令全绿，再按C01 probe核对一次真实公开记录；无模型调用，不把离线夹具测试当作后端真实出站证明。

## C03 · 注册QueryPlan与Skill路由

**Files:** Create `server/ai-agent/registry-query.mjs`与`.test.mjs`；Modify `server/ai-agent/{skill-routing,session-skill-routing}.mjs`及原同名测试。

**Interfaces:** `planRegistryQuery(text,{today,retrieval,previous})`产出`{status:'ready',schema:'hub-registry-query.v1',action:'search'|'read'|'compare',source:'chictr',question,conditions,maxResults,selectedIds,parentJobId,parentEvidenceHash,hash}`或`{status:'clarify',question}`。搜索工具`chictr_search_trials`，详情工具`chictr_read_trial`；模式`hub-registry-search`/`hub-registry-read`/`hub-registry-compare`。复用原检索/解读Skill，不依赖PubMed专属Skill。

- [ ] 红测“在ChiCTR检索针灸治疗抑郁症的临床试验”不进入protocol或PubMed；明确仅Hub/不联网与实时要求冲突则澄清，敏感身份输入拒绝，未知限定不丢失。
- [ ] 红测默认6/最多10、比较1–3条、完整注册号解析、未知号/序号/多来源歧义；“继续”固定同来源父任务、hash和原问题。已有PubMed/PMC与历史route快照测试保持。
- [ ] 执行`node --test server/ai-agent/registry-query.test.mjs server/ai-agent/skill-routing.test.mjs server/ai-agent/session-skill-routing.test.mjs`记录红→绿；新分支只在真实装配可用时选中，禁用/缺依赖明确失败，不能静默走旧检索。
- [ ] 更新新任务路由契约及历史重放分支的测试，不能改旧Job、原Skill发布hash或原PubMed工具白名单。

## C04 · 固定来源、详情/比较与原业务提交链

**Files:** Create `server/ai-agent/registry-{session,output}.mjs`及同名`.test.mjs`、`registry-session-pg.test.mjs`；Modify `scripts/local-knowledge-ai.mjs`。

**Interfaces:** `createRegistrySession({root,tenantId,transaction,routing,client,runSynthesis})`暴露`prepare(turn)`、`validate(turn,evidence)`、`validateInTx(tx,turn,evidence)`、`synthesize(turn,providerCall)`、`accept(turn,result)`及`project(user,session,messages)`。`acceptRegistryOutput(text,evidence)`返回`{text,validation}`。Job字段`hubRegistryEvidence`，Message provenance字段`registryEvidence/registryOutput/registryRuntime`。证据schema为`hub-registry-evidence.v1`，含plan/parentJobId/parentEvidenceHash/selected/tools/hash；selected每条包含id/kind/registrationNumber/title/sourceUrl/fields/retrievedAt/hash，kind为`chictr-live`，不借用论文身份。

- [ ] 红测父Job/本人Study/会话错绑、第二条详情失败、证据hash或来源ID篡改、未登记字段、plan→result幻觉、引用伪造、来源文本提示词注入、取消/失权后迟到结果；比较缺任一详情不调模型。
- [ ] 实现准备/快照/投影，复用现有独立OpenCode综合，不把HTML或私有上下文发模型；表格中的计划值由系统原文投影，AI定性解释有来源。输出无有效解释时明确未交付，不把未知计算伪装事实。
- [ ] 在本机装配处逐点接`turn.registry`：入队/prepare、turnCurrent、模型前后取消、synthesize/usage、accept、provenance、成功/失败提交和历史GET投影。不得只接模型入口漏掉最终事务重验。
- [ ] 运行`node --test server/ai-agent/registry-session.test.mjs server/ai-agent/registry-output.test.mjs`完成红→绿；真实隔离OpenCode＋假Provider验证实际输入/工具轨迹/已知及未知用量，仅证明链路合同，不算真实模型验收。
- [ ] 使用既有fixture guard，运行`node --test --test-concurrency=1 server/ai-agent/registry-session-pg.test.mjs`；只在专用库创建具名新回滚对象，验证原子提交、重放、跨账号/租户和撤权。原Token预留及实际结算原样复用，旧未知预留不碰。

## C05 · 原位来源呈现与完整消费者

**Files:** Modify `src/literature-source-links.js`、`tests/literature-source-links.test.mjs`、`pages/shared/{LiteratureSources,AgentMessages,HubAgentPanel}.jsx`；新增`tests/registry-source-ui.test.mjs`。

**Interfaces:** `literatureSourceLinks(evidence)`兼容`chictr-live`，从已验证注册号与官方详情URL产生`{id,title,href,external:true,label}`；两处消费消息的组件读取`registryEvidence`但保持原布局。label清楚呈现“ChiCTR注册信息”与实际获取时间，不宣称Hub已审核或实时持续更新。

- [ ] 红测原PubMed/Hub链接不变、恶意或不匹配ChiCTR地址不渲染、长中英文题名/注册号可核对；不产生伪造E02详情URL。
- [ ] 新来源只进入原来源区域；兼顾AgentMessages历史与HubAgentPanel结果，不改全局CSS、字号、Shell、输入行为，不加选择器或开发提示。
- [ ] 执行`node --test tests/literature-source-links.test.mjs tests/registry-source-ui.test.mjs`全绿，受保护内容只在`sourceStatus=current`显示，切身份迟到内容不可回填。

## C06 · 真实整链、总评审与文档交接

**Files:** Create `docs/testing/qiyan-chictr-2026-11-10.md`及同名截图/录屏目录；复用既有本机调试/只读readback模式，必要时新增`scripts/qiyan-chictr-readback.mjs`。Modify对应living spec、基线、变更、使用说明书、06版本与本计划状态，同步Notion。

- [ ] 先运行`node --test server/ai-agent/chictr-client.test.mjs server/ai-agent/chictr-parser.test.mjs server/ai-agent/registry-query.test.mjs server/ai-agent/registry-session.test.mjs server/ai-agent/registry-output.test.mjs server/ai-agent/skill-routing.test.mjs server/ai-agent/session-skill-routing.test.mjs server/ai-agent/literature-query.test.mjs server/ai-agent/literature-retrieval.test.mjs server/ai-agent/literature-session.test.mjs server/ai-agent/interpretation-plan.test.mjs tests/literature-source-links.test.mjs tests/registry-source-ui.test.mjs`，另按C04串行跑真实PG；`pnpm build`与`git diff --check`通过。按失败类型如实记录，不用总测试数代替真实执行。
- [ ] 核对owned本机19501–19507与目标库，确认两个账号原授权/业务额度；只启用本次自有进程装配，不停旧服务，不补权限或额度。正常业务额度不足时如实停止对应账号付费步骤。
- [ ] 两账号分别提出新的公开主题；至少一条完整经历检索→详情→双试验比较→继续→刷新。保存实际站点条件/URL/注册号/时间/hash、工具状态、OpenCode与Provider回执、Usage/预留结算，刷新不新增调用。
- [ ] 真实浏览器核对原布局1440桌面及390窄屏、长文输入/来源回链/历史恢复，记录截图/录屏和控制台；另测真实无结果及受控断网/429/校验页、详情失败、切会话/身份迟到响应，注入与真实事件分列。
- [ ] 对照原站逐项检查疾病/干预相关性、计划样本量/结局/状态和比较局限；用户最终专业验收另列，不自动签收。
- [ ] 完成一次独立代码总评审，重要问题测试先红后绿修补；不对每小步重复派独立总评审。代码/环境/真实执行/业务结果分别交接，未满足不能标能力已生效。
- [ ] 同步本地产品/使用/版本/测试文档和Notion，保留所有失败与原账本。停止点为本机交接，不自动进入其他Skill、collector或生产发布。

## 工期与计划自检

C01最多半天核准/止损；通过后C02–C06预计2个工作日实施验证＋半天同范围缓冲。站点不通/取数方式不允许时该估计不成立，不无限延长共享底座改造。

自检：设计§1–3由C01/Global覆盖；§4由C03/C04；§5–6由C02/C04；§7由C05/C06；§8–9由C06及门槛覆盖。五类Review Focus分别进入C03/C04/C02/C04/C04+C06。接口、来源名和payload字段只定义一份；旧来源策略和账本不回写。计划没有未核准API参数或虚构通过的测试。原工作区大量既有未提交内容，故不自动stage/commit。

## 当前状态

用户最新选择“保持原白名单，先交接诊断结果”。CDN放行不执行，本轮不继续条件搜索/详情或C02–C06；C01仍未通过。以下“待确认”是过程记录，不再等待或重复请求相同批准。保留有窗口入口可读的诊断证据，不把它当成Agent能力验收。

最新对照覆盖此前“浏览器路径不可用”判断：用户要求继续定位后，相同隔离/白名单规则下无头等待load仍405，有窗口`headless=false`两次200且读到真实注册清单。只增加诊断参数，不改默认运行模式或装配产品。原站搜索无HTML form，依赖的两项精确CDN脚本被当前白名单拒绝；新增静态依赖放行已提出确认，未获确认不扩大出站。C01仍缺真实条件搜索/有效详情及协议核准，不启动C02–C06。[最新证据与精确范围](../../testing/chictr-access-2026-11-10.md)。专项6项/相关39项通过，项目套件295项中团队地图文案1项失败（未触碰），构建通过；不称全量绿或能力已接通。

设计、本计划及短生命周期本机隔离浏览器验证均已获批，不再重复确认。C01完成普通GET与隔离浏览器实际诊断：前者返回JS校验页，后者真实运行返回HTTP405“访问被阻断”，未取得条件搜索/详情或产品后端取数方式。C01仍未通过，C02–C06尚未开始；不尝试绕过限制，后续需核准官方API/获准访问渠道。[完整实测记录](../../testing/chictr-access-2026-11-10.md)。本轮浏览器诊断5项、相关38项和项目tests293项通过（重叠），构建exit0/3.84秒；测试不代表联网能力接通。未安装新依赖、未启用业务分支，无模型调用、业务写、权限/账本或旧服务修改。

Notion同结构计划页：`41456479ab5881b1b1c1ce741d1a2a89`。
