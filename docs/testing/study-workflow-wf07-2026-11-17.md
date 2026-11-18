# WF07 确认数据并开始分析 · 验收记录

本机合成正向链的代码、装配、实际执行与核心业务结果已有证据；独评发现的三个Gate瞬态负例图已由新独立只读窗口补齐稳定UI，旧图保留。本机合成四层、20源末核及三个稳定负例UI的独评均已通过；Notion同步记录及最终完成状态见本项final-manifest。本项将原批准计划的数据预览、人工放行与确定性计算收敛为一次确认；结果审核仍须明确办理。范围和原生请求预算见[实施合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf07.md)及[验收预算](../planning/study-workflow-simplification-2026-11-17/briefs/wf07-acceptance-budget.md)。

**本机合成四层、20源末核及稳定负例UI独评均已通过；Notion同步记录及最终完成状态见本项final-manifest。** V4四条新意图原生链已通过，合计82snapshot、80run、34operation、302业务audit，0新Session/0审核，旧事实与原科学Word保护通过。四例写入和计算发生在60890；取消增量装配后的17319只做读回，不能称新runtime重算了80项。无注入原序列诊断、最终完整只读及正常recent已通过，根已核关键正向图像；两项auth0原生404和旧计划409真实通过，另在独立窗口补齐3页稳定UI，原“正在核验身份”瞬态图保留、不当最终态。最终独评与20源末核通过；Notion同步记录及最终完成状态见本项final-manifest。V3第四恢复挂载失败、原partial及QA等待/传输格式/序列中断原件均保留，不重播旧成功或续算旧partial。

## 当前证据

| 层次 | 已观察事实 | 核定与完成记录 |
| --- | --- | --- |
| 代码 | V4相关141、原生合同60、独评组合65通过；完整前端1257总/1256通过/1既有跳过/0失败、94.370秒，构建4.87秒。取消增量相关28、原生60、根24及独立19+5通过，构建5.03秒 | 原13源与增量7源保持冻结，独评及20源末核通过 |
| 目标环境 | 原60890完成四例；根核20源后owned重载至17319，最终完整只读与正常recent通过，0业务写/保护通过 | 根最终20源核定通过；最终完成状态见本项final-manifest |
| 实际执行 | V4普通正常/转发前中断、full正常/成功丢响应后找回续办四例passed；full各39实际、15不适用未执行，0remaining；原键/CAS/审计及旧事实保护独立重放通过 | 原生链与当前只读补证的最终独评通过，不重播成功 |
| 业务结果 | 17319四例原结果numericReady与原field ledger/来源、五宽/native200、安全HTTP/timings通过，正向关键图根核；正常recent31项顺序/metadata/MD5一致；3页原生拒绝与稳定UI另核，0业务写及全旧保护通过 | 最终独评通过；Notion同步记录及最终完成状态见本项final-manifest |

证据根：`docs/testing/evidence/study-workflow-simplification-2026-11-17/wf07/`。V1/V2冻结、独评失败、红绿日志和预检均保留，不用后续通过覆盖。

## 历史发现与当前修复

V2独立复核真实Methods hook发现：旧权限版本的未知创建记录首次隔离后，后续来源GET403可删除它；原运行审核也会覆盖同一存储键。V3采用最小保存修复，原运行回看和审核继续可用，未知创建仍阻止新意图。必须同时核两条入口及审核未知后的刷新/原回执恢复，不能只验证预置存储标记。

V4仅修两Workspace的稳定Control挂载及普通表单绑定，useAnalysisStart只暴露既有scope/currentness守门。plan缺失→到达→暂缺、revision和busy期间保modal；新plan/revision首render隐藏旧理由、subject标签和旧确认，旧回调不提交。核心编排和原生hooks保持V3字节。代码冻结为`evidence/study-workflow-simplification-2026-11-17/wf07/implementation-freeze-v4.json`，SHA256 `2a84305422bf18deb1281fb73c0f364179a72197b2ae5221efc13f8c311bfa0e`；代码层通过不代替目标或业务验收。

## V3实际原生历史与partial补证

下表来自`root/case-claims/`指向的原root-result/native-proof，均属于V3，不能充作V4验收。业务审计为具名原生链核定数，不是全库认证审计差值；各例新Session与新review均为0。

| 原case | 原执行事实 | 新snapshot / methodRun / operation / 业务audit | 原结论 |
| --- | --- | --- | --- |
| ordinary-normal | 放行1、create转发1；普通没有process | 1 / 1 / 1 / 4 | passed |
| ordinary-loss-before-create-forward | 放行1、create客户端尝试2但实际转发1；原键GET后明确接续 | 1 / 1 / 1 / 4 | passed，未重复创建 |
| full-normal | 放行1、create1含隐含首片1；后续process13，39项确定性计算 | 40 / 39 / 16 / 147 | passed，结果待原审核 |
| full-loss-after-first-process200 | create首片及首个后续process已执行，刷新GET恢复后modal重挂；后续未派发 | 40 / 4 / 4 / 18 | 原case failed，不改判；35 logical项待派发 |

原partial补证：[`partial-reconciliation.json`](evidence/study-workflow-simplification-2026-11-17/wf07/root/partial-reconciliation-2026-11-17T13-03-05-123Z-66e548f1/partial-reconciliation.json)为原V3窗口的只读forensic；`originalCasePassed:false`、`computed:4`、`remaining:35`、`completed:false`，本次新增业务写0、未继续、未取消、未注入marker。原失败文件不改写，旧strict及七表完整保护已核；该0写只属于补证窗口。

当前核准资源为原管理员authVersion5正向；原科研authVersion0访问这两个Study均404，是原权限隔离反例，未改角色或来源。V4新四例原生链、17319完整只读与正常recent已核；最终独评与20源末核通过；Notion同步记录及最终完成状态见本项final-manifest。

独评发现的证据缺口已独立补齐：原readonly的reviewer-denial普通页与old-plan-blocked图显示“正在核验身份”，旧图不覆盖、不当最终态；新[`stable-denials-readonly-2026-11-17T14-47-33-914Z-03bcc3eb/root-result.json`](evidence/study-workflow-simplification-2026-11-17/wf07/root/stable-denials-readonly-2026-11-17T14-47-33-914Z-03bcc3eb/root-result.json)在17319验证3页passed、0business/protectionPassed。两科研页实际actor/authVersion0与原GET404一致，旧计划实际admin/auth5与preview409 PARTICIPATION_CAPTURE_BLOCKED一致；均busy:false、checkingIdentity:false、连续2次稳定采样及paint后重核，无原值表、无启用主动作。20源未改，原root-result/history/瞬态图与新稳定PNG各自保留，最终独评与20源末核均已通过，记录见本项final-manifest。

## V4四例原生链与运行时边界

四例均在主60890执行，原批准计划和来源未改；以下是`root/*-implementation-v4-*/root-result.json`的实际成功记录，不合并V3历史。

| case | 实际转发放行 / create / 后续process（隐含首片） | 新snapshot / methodRun / operation / 业务audit | 新Session / review |
| --- | --- | --- | --- |
| ordinary-normal | 1 / 1 / 0（0） | 1 / 1 / 1 / 4 | 0 / 0 |
| ordinary-loss-before-create-forward | 1 / 1 / 0（0）；客户端create尝试2，转发仅1 | 1 / 1 / 1 / 4 | 0 / 0 |
| full-normal | 1 / 1 / 13（1） | 40 / 39 / 16 / 147 | 0 / 0 |
| full-loss-after-first-process200 | 1 / 1 / 13（1）；原成功丢响应后GET找回再明确续办 | 40 / 39 / 16 / 147 | 0 / 0 |
| 合计 | 原生各步骤独立记账 | 82 / 80 / 34 / 302 | 0 / 0 |

两个full各39实际执行，另15项不适用没有执行，最终remaining0、结果仍待原审核。新增授权投影与原旧事实保护独立核定，不把本表窗口称零业务写。原V3第四的4完成/35未派发保持，不纳入V4成功数。

## 近期列表取消增量与只读序列

原exact run数字ready后独立读取recent，旧列表在客户端离页后仍可能逐项核源。根受控A/B与源码证明促成精确取消链：仅近期list GET从Vite pre-header res.close传播到Nest，再由t16在下一项边界终止；当前Methods项完整结算、原权限/来源/锁/审计保持，不返部分200、不降上限、不改缓存或超时。原前端/核心13源完全不变，增量4产品源+3测试另冻，见[`list-disconnect-freeze-v1.json`](evidence/study-workflow-simplification-2026-11-17/wf07/list-disconnect-freeze-v1.json)，SHA256 `1fb9fe42d42a17abd9247d08f113dbfd14c43e47629b347a2d85aed750b59365`。

真实随机127端口HTTP/Viteproxy→实际controller/t16集成：保存before正常链200通过，但完整入站GET且上游尚无headers时断client不能到API，1pass/1fail；当前两例2pass。定向相关28/28、原生60/60、根24/24、独立19/19+旧相关5/5及隔离构建5.03秒通过。只证明代码/隔离链，根另owned重载60890→17319并核当前20源；没有重新执行原四例分析。

| 观察边界 | 时间/结果 | 解释限制 |
| --- | --- | --- |
| 旧A：两个ordinary前缀后full GET | 30003ms abort | 原序列失败保留，不填成功时长 |
| 受控B：转发前只拦两个recent GET | full GET200，5976ms；精确2fault/2prefix、严格0写 | 用于隔离重叠读取影响，故障注入不能充正常通过 |
| fresh单独full GET | 约5.6秒返回 | 独立请求，不能替代原顺序回看 |
| 17319取消链装配后的无注入A | full GET200，5902ms；0fault、2prefix ready、browser ready、严格0业务写 | [原序列诊断](evidence/study-workflow-simplification-2026-11-17/wf07/root/readonly-sequence-network-diagnostic-2026-11-17T14-27-41-566Z-dad4a33e/root-result.json)，仍不代完整业务验收 |
| dispatch审计→publish审计 | 见下表原审计墙钟跨度 | 含Worker、来源重验与等待；全链跨度还含分批间隔，恢复例有显式接续停顿，不是纯CPU或单次HTTP |

上述时间属于不同窗口，不计算统一加速比。原A/受控B/失败/后续通过按各自原件并存。

## 最终完整只读门禁与性能口径

[`readonly-2026-11-17T14-28-44-530Z-3cd88975/root-result.json`](evidence/study-workflow-simplification-2026-11-17/wf07/root/readonly-2026-11-17T14-28-44-530Z-3cd88975/root-result.json)在17319通过，0business/protectionPassed。四个原结果均HTTP200且待原审核，普通两例各核3条显示行，full两例各核39条实际计算行，15不适用项不伪造数值；逐源字段ledger共4case。

两分支各1440/1920/1366/390/320及Chrome原生200%，共12组测量，控件14/22、命中/Esc/焦点与理由保留、原值来源首末PNG/WebM及权限反例已形成门禁证据，根已目视关键数值/窄屏/200%对话。独立终评已通过；同步记录及最终完成状态见本项final-manifest。该只读回看未重放放行、create/process或结果审核。

下列毫秒数逐项来自同目录`native-and-ui-chain-timings.json`；四例native audit发生在60890，17319只读取其原记录。HTTP响应耗时及确认到numericReady UI的精确耗时字段为null，不能用以下区间补填。

| case | 首dispatch→末publish审计墙钟(ms) | 确认→末publish(ms) | 确认→结果导航步骤(ms) | 确认→case核定(ms) | 包含恢复停顿 |
| --- | ---: | ---: | ---: | ---: | --- |
| ordinary-normal | 765 | 6164 | 9488 | 12977 | 否 |
| ordinary-loss-before-create-forward | 781 | 11964 | 15277 | 19006 | 是 |
| full-normal | 106147 | 117041 | 118411 | 154545 | 否 |
| full-loss-after-first-process200 | 135722 | 147604 | 148961 | 184714 | 是 |

审计createdAt不是最终commit/HTTP完成时刻；“确认→导航/核定”含截图、GET、验证及恢复等QA步骤，不是用户界面ready指标，full首派发到末发布还跨分批调度间隔。不宣称纯CPU性能或据此计算统一提升比。

正常recent补证：[`normal-recent-readonly-2026-11-17T14-34-16-330Z-958ff618/root-result.json`](evidence/study-workflow-simplification-2026-11-17/wf07/root/normal-recent-readonly-2026-11-17T14-34-16-330Z-958ff618/root-result.json)在17319以原admin/auth5真实GET返回31项，HTTP200/20811ms；与原DB最新最多50项的实际集合、顺序、metadata和MD5完全相同，严格0业务写/保护通过。31是当前实际条数，不宣称已实测50满额；20.811秒仅HTTP请求耗时，不写“小于10秒”或浏览器全列表ready。客户端不离页时完整列表与原来源核验保留；此次修复针对离页后拖慢后续full，原30秒中止与新5.902秒为本轮观测，不是普遍性能保证。三个稳定负例UI已在独立窗口补齐并通过独评，20源末核通过；Notion同步记录及最终完成状态见本项final-manifest。

## 边界

当前范围仅WF07，WF08–WF12尚未开始；持久后台计算属于其中待实施的WF08，本项不承诺关闭页面后持续执行。真实临床与生产未验。普通原生create已执行算子、整课题create已执行首片，均不得因丢响应换键重建。404不证明未执行；恢复只读核对，明确继续才允许相同原键、原快照和原请求体的原生幂等续办。

本项新增数和完整旧事实保护投影分开报告；不把移除授权新增后的零差量称为整个窗口零写入。完整591知识任务、固定旧科学来源与原Word继续保护，不消费旧队列。

技术边界见[专项说明](../technical/study-workflow-analysis-start-2026-11-17.md)，用户步骤见[统一手册第12节](../product/用户验证与操作手册.md#12-wf07确认数据并开始分析)。代理核定进度与用户本人反馈分别记录，不用工程通过代签用户通过，也不要求重复签收。
