# ADR-0014：科研分析的持久执行与恢复

状态：已实施并完成本机合成四层核定，2026-11-18。唯一consumer在19501/56634真实启用；普通/整课题真实中断恢复、39适用/15不适用、停止晚到0发布及授权/来源撤销、双身份五宽/原生200%控件有据。7Job/86Native、81发布结果独立数值复核及原591/科学Word保护通过。实际失败与修复均保留；不是临床或生产验收。

## 目的与已核事实

用户确认一次分析后，可离页；服务器继续计算，返回只读进度和原结果，服务重启可接续未完成部分。仍保留计划批准、人工数据放行、当前权限/来源、逐项审计和结果独立审核。不能启动或恢复无关旧队列。

WF07已本机合成封板，清单SHA `eea544ec8018a118849dd745cceec1640681055d277277a5f104d7b41057f6ab`。当前普通create直接执行，full create执行首片、后续由页面process推进。现有原键重放仅返回已登记Run，queued/running不会续算；full未finished claim也可阻塞后续。原Python Worker只有POST执行，无持久结果查询，requestId不能提供物理调用恰一次保证。

现有数据库没有通用Job：KnowledgeChatJob要求Session/text/userMessage，原启动恢复按租户/Session扫旧任务；ResearchArtifactExportJob必须绑定报告。将分析塞进这两类会混入无关语义或触及旧591/155。common worker-claim具备DB时钟、token/owner、租约、heartbeat及发布围栏，但旧恢复只标失败；通用chat授权不能替代原Methods的管理员与原authVersion规则。

## 选择与替代方案

采用ResearchHub专属窄表 `rh_analysis.execution_job` 与专属consumer。借鉴现有租约/围栏算法，复用原生Methods的授权、固定来源、算子、CAS与审计；不启动知识队列、不伪造聊天或报告记录。另一方案扩展KnowledgeChatJob需同时修改扫描、消息、授权及展示合同，范围更大，弃用。

保留原同步API的合同；新受理/查回/停止接口及可信内部恢复适配仅属于本功能。普通与full首片/批次均需可信内部续算入口，不能只包一个Job后重调原create。Job围栏必须进入原生dispatch、publish及失败清理的同一事务；外层先查租约再调用不能防止旧代晚到发布。

## 持久边界与执行保证

- Job原子绑定tenant/group/project/Study、原actor/authVersion（0合法）、接纳requestKey/bodyHash、固定plan/review/snapshot/manifest、原算子参考及原生子键/checkpoint。只存必要元数据，不另存答案、原值、完整表单或放行理由；理由沿原snapshot gate/audit合同保存。
- 原数据放行仍由人明确完成；放行成功后持久接纳Job。接纳失败或未知时保留已放行事实，原key GET找回；404不等于未执行，不自动换键/POST。Job受理成功才提示后台处理中，后台不可用明确阻断，不静默回退页面循环。
- 专属consumer只查询本表中当前部署归属及获准租户的Job；服务端接纳时自动绑定稳定部署归属，重启仍使用同一归属。不得默认空允许集而使已受理Job静默不执行，不从旧Methods/Study/聊天队列反推恢复候选。旧591/155及V3 partial35无Job绑定，永不消费。
- 租约120秒、heartbeat20秒，均为工程初版参数而非研究规则。leaseGeneration与computeAttempt分别记录：heartbeat及正常下一批不增计算次数；首次执行与失租接管最多3个计算attempt。取消失效/结算可以换generation且不受此额度阻断，耗尽后仍可合法停止，终态不能被第四次计算复活。旧代不能heartbeat/改checkpoint/发布/写失败覆盖新代；来源、权限、算子不适用或原生已失败不自动重试。
- 已原子发布的子项只读找回，不重算、不覆盖。仅本Job固定绑定的queued/running未发布子项，可在接管后以同一原键/inputHash/固定算子新建受围栏attempt；允许确定性CPU重算，保证同一原生结果只发布一次。没有Worker持久回执，不宣称物理调用恰一次。
- full恢复须逐个核原group、slice、snapshot、原batch/首片claim与请求体；已终态但缺finished由consumer精确补齐，GET不补写。不能换latest CAS、创建第二group或消费历史partial来绕过pending。
- 每次派发和发布重验原actor版本、账号/租户状态、当前Study/执行权限、用途/同意/质量/固定来源及原CAS。只用当前数据库重建身份，不默升旧authVersion。退出浏览器/登录会话结束不撤回已接纳业务意图；账号版本或权限变化仍停止后续执行和发布。

## 取消与竞争

有权者在站内明确请求停止。Job原子记录取消请求并失效旧发布代，返回“取消中”；不冒称已杀死Python进程。新consumer只作本Job精确绑定的结算/取消，不再派发统计。dispatch/publish与取消按同一锁序及DB围栏裁决：取消接纳前已提交结果保留，接纳后旧代不可再发布。

queued/running目标按原生有权取消规则终结，full未结束claim按本Job绑定补齐终态审计并记录整体停止；不把已发布子项撤销或覆盖，不另建group逃避pending。若当前权限已失效，保持已停止/受阻事实，不以后台身份绕权办理取消或伪称完成。停止的终态条件须在实施合同/测试中逐项核定。

Job关联的执行/取消必须经过本生命周期，原页面旧process/取消不能绕开围栏；原结果回看与独立审核保持原权限。所有内部恢复入口不暴露为客户端可传的force/resume任意Run能力。

## 内部边界与锁序

接纳时只读核原生执行权限并冻结agent/skill/operator参考，不调用会创建Session的prepareWorkbench。首个有效计算attempt再创建/复用工作台及queued Run，并原子记录本Job与原生子项的精确绑定；拒绝接纳不能遗留准备用Session。

保持原official→tenant授权锁顺序，随后统一Job→group/claim→native行顺序；不可先拿Studies默认tenant/Job/Run锁再倒拿official，也不在持有原生Run锁后才倒拿Job。原事务中的可信before-lock/fence适配必须覆盖dispatch、publish、两个markBasisBlocked清理以及full attempt_failed/finished；失租与取消代错误不是科学来源错误，旧代所有失败/finished清理必须零写。

候选发现仅读取本新表的有限metadata，必须有稳定deployment和非空allowedTenant范围。现有RLS精确到tenant/group/project，不能用空group/project或row_security off扫描；可用专属受限候选函数/控制面，仅返回Job及scope/原actor标识，真正claim/执行/发布均切原aisci_app精确scope并重验当前数据库身份。候选发现不赋予native数据读写或管理员绕权。

普通Run、full root/group/slice/首片/批次以及旧Methods取消统一识别可信Job绑定，禁止旧入口绕过生命周期；已知成功幂等重读、回看与原独审不被拦。原full.cancel不直接承担Job停办：它既会拒绝unfinished claim，又会取消已发布needs_review。新内部结算只处理本Job未发布queued/running，保已发布，未决claim逐个具备精确一次取消/终结证据才将Job标cancelled；取消不以executionConfirmed成功语义伪补finished。失权则记录已停止/受阻，不冒称全部native取消完成。

## 用户界面与验收

沿原计划/结果区域显示等待、处理进度、接续中、停止中、已停止、受阻或结果待审核；只在有权时提供停止。返回/刷新/重新登录只GET原Job和原结果，不重放写。纯进度查看不制造未保存保护、轮询不续登录期限。既有结果无活动意图时不显示虚假的“正在核对当前分析数据”新开始控件。

必须验ordinary/full真实离页、接纳/queued/running/已发布未收尾切点恢复、旧代晚回、取消竞争、当前权限/来源撤销、重复poll与丢响应；已发布子项不重算，四层与旧事实保护并举。撤销反例仅用本轮新建合成对象及新授权关系，不改旧账号属性/旧授权/旧来源/配额。目标仍19501，未通过前不声称已生效；临床、生产及WF09–WF12不在本项验收。

源依据：`app/server/src/research-methods/formal-descriptive-runs.ts:113–141`、`research-methods.service.ts:141–142`、`common/worker-claim.ts:49–133`、`sessions/knowledge-chat-queue.service.ts:398–415`、`app/research-methods-worker/serve.py:80–90,227–253`；ResearchHub `full-study-runs.mjs:67–115`、`full-study-batch-runs.mjs:17–80`、`scripts/full-study-methods-batch.mjs:107–161`、`scripts/local-knowledge-ai.mjs:421`。实施以当前源与测试为准。
