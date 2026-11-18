# D08 唯一独立代码总评审原结论与关闭记录

评审代理wp07_d08_code_review_20261026，2026-10-26；fresh只读、未派下级代理、未改工作树/数据库/分支、未调用模型。51文件hash匹配，独立本片7份纯测试33/33通过。以下保留原结论，不因后续主实现修补而改称独立复签。

## 独立原结论：With fixes

0 Critical、3 Important、1 Minor；重要项修复后才可本机技术交接，AC10不能代签，非发布授权。

Strengths：真实冻结包/input/manifest/result/父对象逐层复验；锁/CAS/token/instanceId守门；旧Worker阈值和占位值隔离；第五意图独立且终态run只读；job/Message/Artifact/Version/Sources/Audit复用；幂等/说明CAS/历史过期/故障未命中强制abort；免费与收费隔离且四次上限独立于余额。

### Important 1 · 英文数量与Unicode分数漏过科学数值边界

scripts/synthetic-crf-methods-ai-contract.mjs原21/24/35行。Thirty synthetic participants原样进入researchIntent；The missing rate is one third. The value is ⅓.作为available知识；合法[M1]结构下英文分数和⅓解释会被accept。普通科研材料可越过模型数值禁入/禁出，影响不可变解释/报告；不意味着本轮两个实际解释已发生此问题。建议仅第五意图统一加强双向数量检查，保留可信技术ID/引用例外，不改旧四族、不新增收费。

### Important 2 · 慢读期间失权遗留busy/reading

CrfMethodsReport.jsx原9/15/16行：choose设busy=true→轮询reportStatus restricted→clear递增sequence但不复位busy→旧GET finally序列不匹配跳过释放→恢复R03仍卡busy，报告/父动作禁用。CrfMethodsInterpretation.jsx原7/10行：来源GET期间R02撤销隐藏解释，effect递增seq但未复位reading，迟到finally跳过，恢复后来源按钮仍禁用。实际JSX内存hooks状态复现，两者恢复后true；不是Chrome实测。建议失效动作同步清状态/refs，继续阻止迟到正文，补慢读＋失权＋旧200＋恢复交叉用例。

### Important 3 · 比较遗漏人工范围数值与输入修订

synthetic-crf-methods-contract.mjs原76行只返回左右id/sourceStatus；CrfMethodsResults.jsx原13行只渲染缺失指标。对同配置n=3/nMissing=0/rate=0，上界10、越界15→12的两run，比较区完全不显示15/12/10。用户无法看到仅数值更正的核心变化，不满足spec §7。建议返回已有包version/dataRevision并列，UI显示两侧rangeObservations/未配置/全缺失未检查，不新增推断算法。

### Minor 1 · 过时能力提示

src/platform-frontend.js原73行仍称“AI解读及方法报告待接入”，与已实现面板矛盾。按本轮执行技能，Minor只登记延后，不混入重要项一次修补。

## 五轴与Review Focus原判断

正确性需以上三项；职责分离清楚但压缩长行增加维护成本；窄适配/schema维持原服务职责无需扩底座；授权/父链/参数化锁较扎实但数量边界待修；查询/分页有界，逐条复验N+1暂无实测性能问题。Focus1值/分母通过已读范围；Focus2Worker隔离通过但AI数值边界另修；Focus3服务端途中守门无新重要问题但未重跑PG/Provider；Focus4迟到正文fence有效但busy遗漏；Focus5免费/付费与故障abort符合已读实现，未重跑外部harness。

## Declined to judge（原列表保留）

- AC10专业价值及科研适用性：用户未预运行材料验收，评审无权代签。
- 最新目标环境执行/费用：未读秘密或重跑PG/Chrome/Provider；299/1054、79笔/¥1.518966为包内记录，非独立复验。
- 新正文[1]实际验收：实际仅[M1]/[M2]，KB工具已执行不等于新文献正文交付，纯测试不能补足。
- 浏览器视觉/缩放及新组合反例：仅读harness/记录，内存状态复现不是Chrome证据。
- 有限N+1是否有可感知延迟：有界且无性能测量，不据猜测定级。
- 无关旧底座/其他脏改动/生产准备度：精确范围之外，不扩扫或恢复旧任务。

## 主实现复核与关闭（已实测；不是独立复签）

三个Important按实际影响维持重要级别，纳入原缓冲一次最小修补；先RED再GREEN及整体免费/真实Chrome复验。独立原With fixes保留，关闭由主实现，不派二次评审。Minor 1延后。未用完的模型余额不授权新增请求。

Important 1：新增双向数量反例先RED（Thirty入模），仅第五kind在原mask后增加英文词边界/Unicode Number类别检查；不计算或补造数量、不改原四族，可信技术ID/引用例外维持。输入PICO/访视/字段/KB和输出10种数量表示/正常定性/技术ID实测GREEN；原Provider两入口/原Orchestrator契约回归绿。未新增真实Provider请求，不能称供应商独立再验该补丁。

Important 2：真实Chrome d08-browser-f25e5c53在R03/R02各复现慢读→真实新scope撤权→原已认证200迟到→恢复后按钮持续禁用（RED，精确恢复scope）。clear同步busy/ref，解释目标effect同步reading清理；d08-browser-05446bae两个组合GREEN，失权时迟到正文未复活、恢复后实际读取成功，无pageerror/console信息，无模型/DB业务写。

Important 3：新contract与实际JSX SSR先RED（inputRevision缺失、15未呈现），补左右既有包版/dataRevision/inputHash与两侧范围观察/未配置/全缺失状态，19/19组合GREEN；SSR明确缺失完全相同但15→12/上界10可见。真实Chrome d08-browser-05446bae读取原本轮更正包的实际两run/API比较（真实范围本身均11/上界10，缺失由2→1；不冒称该样例是范围变化），五视口/键盘横向读取通过；范围-only变化由SSR反例证明。PNG1440和320已人工查看。

最终free-gates-548a0d88：302/302全部组合＋1054/1054原内核、构建/保全/空白五门通过；reading-97fd6674两账号最新报告h3/h4与16/28通过。原691源/32表17836保护历史行/角色Schema/旧8进程及原75＋失败76前缀保持，79known/¥1.518966/¥5、held0。d08-final-source-manifest.json53源含9个本次变化，原51源评审清单不覆盖；均未提交/推送。自有PID61344七端口ready；非发布。

仍待AC10；新正文[1]未有本轮实际交付样例；新数量补丁只免费契约/现有真实消息读取验证，四次额度已耗尽不得补调用。原生200%报告证据取D07实际Chrome，D08比较新增五视口但未额外录原生200%，不混称同一证据。Minor旧提示延后，无重要项未关闭。
