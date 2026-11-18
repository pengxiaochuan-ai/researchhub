# 岐研AI智能搜索 · 2026-11-12

## 2026-11-12 · 完整原题智能搜索复验（整体部分通过）

177字WHO＋Harvard、103字NCCIH两道原题均经真实页面完整发送，URL和尾部要求进入模型，PG/API及浏览器刷新一致。4次Provider调用共6350Token按原业务正常结算，无重试、充值、手工对账、重启或产品规则改动。WHO已交付事实有据，但Harvard实际HTTP202未读，核心双源比较未完成；列表短引的Markdown格式机械误拦另有据内容。NCCIH三段事实来源一致，设计建议明确为AI推论；实际四段超出“最多三段”，局限总结覆盖不足。仅本机专用合成环境与原两账号，不作完整专业或生产验收通过。[逐项证据](../testing/smart-search-full-question-2026-11-12.md)。

## 完整研究问题输入（本机已启用）

`src/agent-question.js`定义trim后2–4000码点，普通/单篇/commands/routeExecutionInput/规划/单篇模型消息共同使用；不slice问题或URL。输入框无maxlength，超限保留全文并阻止提交；直发与Worker也验证。Agent专用prepareAgentHubQuery允许4000，默认prepareHubQuery/E01仍100；检索映射/安全出站/证据/Token预算不变。历史GENERAL单非BMP只在已完成read+输入hash/路由绑定通过时兼容。无旧源码/表/权限变化，本机真实HTTP/PG/Chrome有证、0真实模型调用。[规格](../product/ai-question-length-2026-11-12.md) · [验收与操作事故](../testing/ai-question-length-2026-11-12.md)。

最新单笔收口：固定具名Job/预留，在专用合成库复用recoverExpiredClaim→sealExecution→现有Hub管理员对账服务，同事务失败收口和2273Token结算，释放10015预留；0新模型/额度/角色/旧系统修改。两角色Chrome/刷新通过。既有队列扫描器随后只归一目标用户指令的status/version，原末次快照差异及只读重建证据保留，不将硬编码日志当结论。目录完整读取和专业总体验收仍未完成。[单笔证据](../testing/smart-search-interrupted-close-2026-11-12.md)；下文中断待处理为历史。

## 后续事实/推论修补（当前）

当前新任务policyHash由v2分段指令生成，旧edea9f7e…仅允许历史及父快照读取；新处理中任务不能降回v1。smart-search-grounding接受claims[{kind,text,sourceIds,quotes[{sourceId,text}]}]＋limitations，后者只接收不直接渲染，实际阅读范围由系统生成。原句规范化后≥12/原长度≤600、每来源均有短引；receipt保留包括拒收项在内的原提议以确定性回放，正文只显示有效段。webOutput schema=hub-smart-answer.v2附grounding/groundingHash；投影重验策略同一性/原句/来源/原文本hash。

无新REST、表、角色或样式，当前免费596/Chrome29/build与旧历史、新任务回读通过。目录完整读取与最后中断任务未完成，不将免费重放当交付；[完整状态](../testing/smart-search-grounding-2026-11-12.md)。下方首次联网技术交接为前阶段事实。

状态：本机技术交接完成，专业用户签收待确认，非生产。范围以[获批规格](../superpowers/specs/2026-11-11-qiyan-smart-search-design.md)为准。

## 接口与存储

既有POST /sessions/:id/commands、Hub knowledge-messages接受可选networkIntent，严格`{schema:'hub-network-intent.v1',enabled:boolean}`，缺省false。Message.meta.hubCommand保存单一真实快照；修订保留，stage复制到Job.payload。相同requestKey换联网位409。控制器白名单、队列与真实出站均守门，不能用模型提议代替用户选择。无DDL/新表/新角色。

新路由v2绑定快照hash，旧v1与GENERAL_POLICY_HASH保持；普通Hub搜索OFF用当前获准资料，显式外检OFF免费澄清。ON普通网页走hub-smart-search，明确PubMed走原链；原PubMed MCP连接/请求/交付前assertNetwork。固定文章不装备新工具。固定网页续问的previousJobId绑定同账号/Study/会话完成父对象。

Job.payload新增hubWebContext、hubWebEvidence，分别绑定问题/路由及实际来源/工具/OpenCode轨迹hash；provenance.webOutput绑定输出与来源hash/策略。当前身份/父链、processing状态/claim/租约在模型、工具、证据CAS保存、原最终提交时重验；刷新只读固定快照，不宣称监测外站当前撤回状态。

## 执行及边界

smart-search-runtime复用旧Client与隔离workspace，原固定synthesis不放宽。新子进程仅继承最小环境，临时64位capability指向loopback Provider桥；真实DeepSeek key/数据库凭据/账号信息不进入OpenCode或搜索。原生Exa websearch固定provider；hub_public_webfetch为同循环实际MCP工具，标准库stdio桥只访问本轮loopback能力。

模型每轮只收到服务端canonical系统/问题/真实工具结果，不转发harness环境说明/历史AI输出。搜索词严格限公开短主题；读取只接受本轮发现或用户给出的HTTPS链接。公开IP全部验证并DNS绑定连接；逐跳授权/重定向、15秒/2MiB/文本响应、移除脚本/表单/隐藏内容，拒绝私网/凭据URL/ChiCTR暂停域。无Cookie/登录/浏览器绕过。

资源界限为每任务最多5模型步骤、2次搜索、4次读取、120秒执行超时、网页最多4500字符；传给模型的重复摘要最多200字符、网页按预留择3000/2000/1000/512字符并明确截断。存储原实际读取证据不改，逐轮modelInputs hash及真实Provider trace可核对实际范围。累计已知Token＋保守下一轮输入/输出上界不得超过原预留，无补额/充值；已知失败用量仍按原账本结算，未知用量原流程待对账。没有开发金额/任务次数守门或外部收费provider自动回退。

## 最终综合、部分失败与来源链接

实际成功读取一批后，下一轮仅问题和固定来源、无工具地综合，不重复发送累积harness历史；已知usage在输出验证前按真实Provider回报一次。认证/claim/租约/取消/SSRF失效仍停止；普通外站读取失败可保留另一成功网页并列出未读URL。只有搜索摘要时不得输出正文科研综合，固定快照续问亦保持该阅读范围，不能因新任务没发read调用就绕过。OFF混合“检索并解读/比较”只用Hub，明确外检免费澄清。

最终答案sourceIds必须是真实来源，来源链接由后端统一渲染。Markdown新增可选trustedLinks，默认仍拒模型链接/图片；AgentMessages仅在assistant且sourceStatus=snapshot时传入当前后端核验的实际来源/失败URL。精确HTTPS无凭据/非默认端口匹配才可点击，受限投影同URL也禁用，不扩大其他Markdown消费者权限。同身份焦点校验不重置composer选择，身份/Study/会话变化或刷新仍OFF。

## 证据

见[验收台账](../testing/qiyan-smart-search-2026-11-12.md)：581免费、29Chrome及最终4专项、构建、真实PG/API；5成功/2失败真实任务及全部7笔正常结算保留。真实工具探针与真实BYOK分别记录。独立代码总评无未决Critical/Important，但实际回答的两处推论/来源归属问题仍待专业验收；正式部署装配/运营外站政策另行确认。
