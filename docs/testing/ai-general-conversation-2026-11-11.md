# 岐研AI普通对话验证与交接

## 当前范围与四层证据

对应[已确认规格与小步计划](../product/ai-general-conversation-2026-11-11.md)。仅AI01普通Hub会话、其科研/管理员消费者及原执行装配。三栏、字体、来源规则、权限、额度和旧系统不变。输入/操作14/22，沿用既有组件；等待、需要补充、其他暂停分开计数，空闲发送为“正在准备”。不是全站改版、正式发布或完整专业签认。

### 代码与免费验证

- 路由RED：`介绍下你自己`原为clarify；能力咨询自然变体另一次RED，修复后一般问候、介绍、用法咨询正常进入普通对话；明确检索/未接通订阅/科学歧义不借普通分支绕过。
- 真实PG RED：普通执行缺失；新增同主体/会话/输入/策略快照、最近六组已完成普通上下文及提交前重验。普通→“继续”→未来科研任务导致旧路由变化再次RED，现固定自身普通快照；篡改历史、换账号仍拒绝。PG事务夹具回滚，不改历史业务数据。
- Chrome RED：澄清仍被计为待执行。GREEN后正在准备/等待执行、需要补充与已暂停分开，保持原区域；Enter/Shift+Enter/IME、编辑删除、断网/迟到/撤权与新建/历史切换继续回归。
- 词形RED：实际“两篇”检索在免费准入被拒，现确定性解析为2；近两年同用明确的两=2词形，不扩展医学概念或忽略限定。
- `node --test tests/*.test.mjs server/ai-agent/*.test.mjs scripts/ai-command-worker.integration.test.mjs`：最终409/409，80.9秒；随后只收紧跨账号异常断言，单项真实PG再次通过。
- `node --test --test-concurrency=1 scripts/ai-command-ui.test.mjs scripts/ai-conversation-ui.test.mjs`：14/14，40.4秒。
- `npm run build`：最终4.04秒通过；仍有既有>500kB分包提示。未为此扩展打包改造。
- 独立总评审发现并复核普通续问历史稳定性、自然能力问法两项，均RED/GREEN修复，无剩余Critical/Important；评审者重跑24项纯路由通过，不以其替代真实模型证据。

### 本机配置启用

非夹具在途任务0后，仅重载本机自有运行进程，最终PID50268，七服务ready。Sessions→原队列/Worker→Hub普通分支→原OpenCode私有运行环境→单次loopback→既有DeepSeek，原Token预留、真实用量及原子交付仍生效。普通模式是Agent内置能力，`hubSkillRoute.skill=null`，不伪造第十项Skill，不新增工具、资料权限或云资源；策略哈希、输入、主体和历史均固定。

普通回答不声明文献来源；科研任务继续走Hub/PubMed/固定证据分支。普通上下文只含同本人/同Study/同会话已完成普通轮次，不把科研回答当文献证据。原输入边界及输出数据/数值/链接策略沿用；无自动重试。历史读取采用封存普通上下文语义，无已交付消息编辑入口，本轮不新增历史更正治理。

### 真实请求与结果

管理员本轮新会话`cmwbh090c000hluv7tnernhai`：

1. “介绍下你自己，请简短回答”：真实普通回答，任务`cmwbh0boe000nluv7ojui6pry`，OpenCode providerCalls=1，无检索工具/来源。
2. “你刚才提到的能力，应该从哪里开始？”：承接普通上下文，任务`cmwbh0iyf0011luv7d7i5sy4h`，普通历史1组，无假检索。
3. “只用Hub已审核资料，不联网。检索针灸治疗抑郁的两篇研究，列出来源与局限。”：首次仅免费准入澄清，无job/模型；修复“两”词形后仅显式修订本轮该条未执行问题，不重复前两轮。任务`cmwbha0s5000cluscp8588az7`完成，模式hub-literature-search，选取两篇获准Hub资料，external=null。
4. “回到刚才的介绍，你能帮我完成哪些研究任务？”：回普通分支，任务`cmwbhcdmz0016luscjuvzzgdr`，普通历史2组，未混入科研证据。四轮刷新恢复，0 pageerror。

四个真实任务均completed、attempts=1、非Mock；真实用量396/503/2013/749，共3661 Token，四笔预留全部settled。原业务价表记录估算费用合计0.010846元，不等同Provider正式账单；没有充值、补额度、手动对账或新增待对账预留。原历史预留不动。

双账号免费真实接口/浏览器：owner现有Token不足正常暂停，未补额度；admin两条明确科研歧义分别显示“需要补充”，不当成排队，均可删除，0新模型任务。之前的免费脚本使用问候，普通能力接通后将触发模型，已改为明确科研歧义。该脚本首轮因旧“待补充问题”标签断言失败，修订断言后通过；不是以隐藏错误冒充成功。

## 实际业务判断与遗留

普通自我介绍、能力咨询、科研切换后普通续问及刷新恢复达到本轮技术使用路径；最终用户体验仍由用户验收。科研检索两篇为干燥综合征综述和慢性腰痛/抑郁共病材料，并非针灸治疗抑郁的直接试验证据；输出已说明适用性、非直接证据和局限，不称专业检索质量通过。相关性/排序改进只登记建议，不扩进本轮。

本轮未重新请求PubMed或ChiCTR，未重做文章固定证据真实Provider测试、原生200%或全站无障碍。390px沿用既有长历史先行与内层滚动，不据此宣称移动母版重排完成。旧澄清/失败消息不因代码更新自动重跑，用户可新发或显式修订。

## 可复核证据

`.tmp/ai-general-conversation-2026-11-11/`：route-red.log、execution-red/green.log、continuation-red/green.log、capability-red.log、count-red.log、boundaries-green.log、targeted-final.log、suite-final.log、browser.log、build-final.log；real.log、real-resume.log、real-after-research.log、real-failure.json（历史失败保留）、real-results.json、billing-readback.json；四轮/刷新/390px PNG及video/WebM。原本机私有ai-traces对应job运行轨迹仅留本机，不同步凭证/原始请求到Notion。

双账号免费结果与新PNG/WebM在`.tmp/ai-queue-followup-2026-11-11/`，最新`results.json`和本轮`free-accounts-final.log`通过；前轮历史由此前文档单列，不拿旧计数充本轮证明。没有临床库、旧服务、云、远端配置或真实发布操作。
