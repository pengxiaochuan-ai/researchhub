# WF05 今日待访视测试报告

日期：2026-11-17。**WF05已完成（本机合成）。代码、目标准入联动、真实业务、当前全前端、末次保护及后续读取切片来源补证均已根验；Notion同步记录见finalmanifest，由根完成最终映射。** 管理员和原科研身份的22条实际安排均与原生全范围逐ID/顺序一致；首5条加一次查看更多展开剩余17条，S01已展示项可一步进入原S09。含本例一次展开是2个动作，不能宣传总点击仅1次。

V3相关及独评99/99、独立实际JSX3/3、构建5.61s；五宽/原生200%、错误恢复/纯GET重载及最终旧保护已有根与独评证据。当前全前端post-admission attempt02为1176总数、1175 passed、0 failed、1既有skipped，90.806s；正确fixture配置后的定向14/14。原V3 attempt的1084 passed/4 failed/1 skipped、V2的1087通过/1跳过，以及两份中止配置attempt均保留为历史，不替代当前结果。临床与生产未验，WF06未开始。

## 当前状态与保留项

| 项目 | 已观察结果 | 当前边界 |
| --- | --- | --- |
| 管理员/原科研身份 | phase2两者均22条与原生逐ID/顺序一致，各1次more；旧路径3步与已展示新路径1步均到相同Subject/visitId/固定方案 | 本机目标50810本模块链及74871最新共享准入联动均由根实测通过 |
| 日期与错误恢复 | 服务端北京时间；首5/more20，完整窗口/单日期，500反例清旧表、明确GET重读、clean reload无beforeunload | 日期P2、V1/V2和V2实际4more证据保留 |
| 五宽/原生200% | collapsed5/expanded22，14/22与三点hit；放大末项由原WebM的2.600s正确帧补证 | PW720×456裁片失败保留，3.4s恢复zoom帧排除 |
| 旧事实与队列 | 末次全前端窗口audit passed、0业务写；完整591job、全部旧行/角色/科学/Word及准入两表完整rowhash另保护 | 仅RAM续用本次after作新窗口before，旧文件未改；保源切片连续性pending，不称原窗口全球0增量 |
| 当前全仓门禁 | post-admission attempt02为1176总/1175pass/1skip/0fail，含两个真实rollback PG；定向fixture14/14，构建4.71s | 原失败与中止attempt保留；F01目标/磁盘差异已精确证明限于独立list，读取切片一致；不背书其独立新能力 |
| 收口 | 本地12文档本模块事实同步 | WF05本机合成完成，读取切片来源补证通过；Notion同步记录见finalmanifest；WF06代码未开始 |

## 范围与合同

仅对应 [WF05 brief](../planning/study-workflow-simplification-2026-11-17/briefs/wf05.md) 和 [只读API合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf05-api-contract.md)。原S01“最近数据更新”空卡替换为“今日待访视”，原列、前3行、Shell、导航及其他入口保留；原最后行随列表内容增长，本卡解除旧mini-list固定段落高度。首批5条，只有真实nextCursor才显示“查看更多待访视”；每行“进入本次访视”指向原S09 canonical Study/visitId。

原生 `GET /api/research-studies/:id/due-visits?limit=&cursor=` 复用Study事务与授权锁及 `authorizeFormalResponse(...,'read')`，不误要求study.review、form.fill或执行按钮权。每次核DB当前actor/authVersion（0合法）及精确tenant/group/project，先筛范围/安排/有效入组再按ID分页，含limit+1 sentinel的Subject/Enrollment/Plan/Protocol父链显式相等核验；VisitPlan没有acceptanceFixture字段，不添加不存在的过滤条件。固定方案允许合法executing/superseded历史版本，不拿S01当前版标题替代旧访视。

“今日”按服务端Asia/Shanghai日历日 `[start,end)`：windowStart<dayEnd可列入今天晚些时候的安排，标签不能称已开始；windowStart为空才回退targetDate；明天及以后不列入，实际in_progress保留。显示日期固定北京时间，不能按浏览器时区或未来targetDate覆盖已有windowStart。cursor严格绑定DB actor/authVersion、tenant、Study、day/timeZone及afterId；跨日409 `DUE_VISIT_DAY_CHANGED` 后只读今天第一页，不保旧页为当前结果。

服务只取最小假名/日期/固定访视投影，不调用原昂贵完整访视/表单/评分/文件完成投影。查看、翻页和导航均不新增业务状态、receipt/audit/worker，不建档/入组/分配/启动/填答案；安排列表不代表当前采集用途或启动许可，原S09继续完整验权及门禁。无Schema、角色、权限、旧TS核心或共享启动器改动。

## 真实22条安排后的分页精简（V3本模块已复验）

根已核V2[管理员实际分页](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T07-38-24-582Z-2415d/pagination.json)和[原科研身份实际分页](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-reviewer-2026-11-17T07-39-14-457Z-1d352/pagination.json)均与API完整22条一致、流程passed、0业务写，但每次5条需要4次“查看更多”。这些真实4次点击证据保留为V2，不改写为V3一次展开，也不将功能可执行当作用户操作负担已最小。

根据本项减少重复操作目标裁定：首屏仍5条；明确查看更多时每次请求20条，本例剩余17条一次展开。后台原1..100范围、cursor、授权/父链/日期合同、组件/CSS均不变，不无限扫描、不自动取尽所有页；还有nextCursor仍等待下一次明确查看更多。客户端按当次5或20上限核返回长度，更多响应21条拒绝；跨日409必须丢旧cursor、重读limit5的今天第一页，若回6条也拒绝并清旧页。scope/互斥/迟到/GET无写与无storage、dirty、beforeunload守门保持。

[正式22条RED](evidence/study-workflow-simplification-2026-11-17/wf05/more20-red-v3.log) 为10 passed / 4 failed；[V3客户端与实际JSX GREEN](evidence/study-workflow-simplification-2026-11-17/wf05/more20-green-v3-attempt02.log) 15/15，验证首5+一次more得到22且恰2GET、20上限/21拒绝、跨日重置5及fallback6拒绝、不自动后续扫描。[相关回归](evidence/study-workflow-simplification-2026-11-17/wf05/related-green-v3-attempt02.log) 99/99，[隔离构建](evidence/study-workflow-simplification-2026-11-17/wf05/build-v3-attempt01.log) exit0、5.61s。[V3冻结清单](evidence/study-workflow-simplification-2026-11-17/wf05/implementation-freeze-v3.json) 与 [V2→V3三文件补丁](evidence/study-workflow-simplification-2026-11-17/wf05/more20-relative-v2-v3.patch) 保存当前变更；V1/V2冻结、日期P2、原4次点击及所有attempt不覆盖。

V3已由phase2两身份实际证明首5+一次more17及相同22条范围，并完成导航、视觉、纯GET与最终保护；V2原4次点击及所有失败分列保留。本模块已验不等于总封板：原V3全仓4项失败历史保留，最新共享准入联动已由根复验；当前全前端及末次保护已由新attempt通过；读取切片来源待项已由后续精确补证关闭，WF05本机合成完成；Notion同步记录见finalmanifest，不借旧日志替代。

## V2代码与离线回归

| 项目 | 证据 | 已观察结果与边界 |
| --- | --- | --- |
| 原生服务/路由 | [native-freeze-v1.json](evidence/study-workflow-simplification-2026-11-17/wf05/native-freeze-v1.json)、[native-review.md](evidence/study-workflow-simplification-2026-11-17/wf05/native-review.md) | 四源冻结，新增6组行为；独评新旧回归12/12，原controller仅4行新增、无旧行删改。 |
| V2实现及补丁 | [implementation-freeze-v2.json](evidence/study-workflow-simplification-2026-11-17/wf05/implementation-freeze-v2.json)、[implementation-relative-before-v2.patch](evidence/study-workflow-simplification-2026-11-17/wf05/implementation-relative-before-v2.patch) | 十源冻结；16组新增行为，native四源保持不变；含完整可执行相关测试命令。 |
| 实现与根相关回归 | [related-green-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf05/related-green-v2-attempt01.log)、[root-related-v2.log](evidence/study-workflow-simplification-2026-11-17/wf05/root-related-v2.log) | 均94 passed、0 failed、0 skipped。 |
| 根全量前端 | [full-frontend-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf05/full-frontend-v2-attempt01.log) | 1087 passed、0 failed、1既有opt-in skipped；不写为1088全通过。 |
| 独立复核 | [reviewer-related-v2.log](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-related-v2.log)、[旧S09 capture回归](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-old-capture-v2.log)、[独立JSX反例](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-independent-cases-v2.log) | 94/94、27/27、3/3；原日期case及不跑effect前的version/URL隐藏均通过。离线JSX不是Chrome。 |
| 隔离构建 | [build-v2-attempt01.log](evidence/study-workflow-simplification-2026-11-17/wf05/build-v2-attempt01.log) | exit0、4.81s，输出 `/tmp/researchhub-wf05-v2-build-20261117T072955Z`；原有>500kB chunk告警保留。 |

### 日期P2的原始RED与最小修复

独评在真实JSX中复现：windowStart为北京时间11月17日、windowEnd=null、targetDate为11月20日，V1误按targetDate显示未来“安排日期：2026-11-20”。[独立RED](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-date-display-red.log) 与 [正式RED](evidence/study-workflow-simplification-2026-11-17/wf05/date-display-red-v2.log) 保留；正式RED为4 passed / 1 failed。

V2仅该显示分支改为windowStart优先、为空才targetDate，并加入正式实际JSX测试；完整窗口显示、native筛选/授权/日期合同均未变。[正式GREEN](evidence/study-workflow-simplification-2026-11-17/wf05/date-display-green-v2.log) 5/5，[V1→V2两文件补丁](evidence/study-workflow-simplification-2026-11-17/wf05/date-display-relative-v1-v2.patch) 留档。V1冻结、原full-frontend-v1的1086通过/1跳过及所有attempt不覆盖，不用V1绿日志代修复后最终验证。

## QA保护器失败、修复与重新接纳

[首次admit](evidence/study-workflow-simplification-2026-11-17/wf05/root/admit-2026-11-17T07-27-51-513Z-d2b6b/root-result.json) 实际失败 `591 !== 155`。QA V1将queued/unclaimed的155条误作完整job表总数；根核定该次0业务写，断言即停，未落新的before baseline。原失败与QA V1归档不能覆盖为成功，也不能为验收缩小保护集合。

[QA保护器V2冻结](evidence/study-workflow-simplification-2026-11-17/wf05/preserve-count-v2-freeze.json) 改按已验完整集合逐ID/hash/count保护；该时点完整591行，155仅queued子集，总数不硬编码为155或591。[V2 guards](evidence/study-workflow-simplification-2026-11-17/wf05/preserve-count-v2-green.log) 7/7，[独评复核](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-preserve-count-v2-checks.json) 冻结hash匹配/exit0，不降低旧保护标准、不恢复或清写任务，产品源未因该QA修正改变。

[重新admit](evidence/study-workflow-simplification-2026-11-17/wf05/root/admit-2026-11-17T07-33-43-551Z-2fb13/root-result.json) passed、0业务写，原WF04 12个operation及24业务audit与原facts保留，并独立建立新baseline。此为原阶段接纳时点；后续独立阶段交接与最终保护见下文，不以新baseline覆盖这份原before。

## 已有目标执行证据

### 真实PG只读预测

[PG批次](evidence/study-workflow-simplification-2026-11-17/wf05/root/pg-2026-11-17T07-34-16-152Z-99e89/root-result.json) passed；[原生读取结果](evidence/study-workflow-simplification-2026-11-17/wf05/root/pg-2026-11-17T07-34-16-152Z-99e89/real-pg-read.json) 为一个真实 `aisci_app` 物理只读事务、12项检查、0业务写、HTTPExecuted=false、ChromeExecuted=false。

管理员和原科研身份各核首/次页、limit非法400、错scope cursor400、旧auth401、跨北京时间日界409。真实Prisma/RLS与原固定父链使用当前数据读取；不能用纯where替身代此证据，也不能把这12项PG检查称为12次HTTP或页面验收。

### 受控目标装配

[before](evidence/study-workflow-simplification-2026-11-17/wf05/root/before-2026-11-17T07-35-03-003Z-43249/root-result.json) 为owned PID30580，[after](evidence/study-workflow-simplification-2026-11-17/wf05/root/after-2026-11-17T07-36-04-445Z-32720/root-result.json) 为50810，均passed、0业务写；[装配后inspection](evidence/study-workflow-simplification-2026-11-17/wf05/root/after-2026-11-17T07-36-04-445Z-32720/inspection.json) queuedUnclaimed=155、otherActiveQueues=0、noQueueRecovery=true。完整591旧行保护不变，不把queued数当total，不恢复旧队列。

### 六项真实HTTP GET

[HTTP批次](evidence/study-workflow-simplification-2026-11-17/wf05/root/http-2026-11-17T07-36-25-483Z-1f49e/root-result.json) passed、actualGetChecks=6、0业务写；[native-http.json](evidence/study-workflow-simplification-2026-11-17/wf05/root/http-2026-11-17T07-36-25-483Z-1f49e/native-http.json) 逐项为管理员首/次页200、原科研authVersion0读取200、跨actor cursor400、非法limit400、无session401；modelOrWorkerExecuted=false。它们证明当时目标读路由与真实身份守门实际执行；完整V3 UI/响应式证据另列在下文，最新共享准入联动已在74871由根另行复验，见下文。

## 首次Chrome流程失败（原样保留）

[首次flow-admin结果](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T07-37-20-382Z-6208b/root-result.json) 为passed=false，`assert(legacy)` 失败；[当前失败图](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T07-37-20-382Z-6208b/failure-current-0.png) 与 [页面状态](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T07-37-20-382Z-6208b/failure-current-ui-0.json) 保留。

根核定该次在S04身份仍checking时过早枚举旧入口，0业务POST；不能据此称产品旧入口丢失，也不能删掉失败后直接标UI通过。根随后补等待真实Subject heading/身份ready，V2及V3新证据证明旧入口仍可达；原脚本过早断言失败不倒写为成功。V3最终phase2结果如下。

## V3 phase1严格失败与精确外部事件交接

[phase1管理员结果](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T07-54-46-575Z-2f263/root-result.json) 保留passed=false：当时22条/一次more与旧3步、新1步入口功能通过，但最终保护检测到一条新增knowledge_session_create，按 `NEW_NON_ALLOWLIST_AUDIT_FORBIDDEN` 拒绝。不能改写为全阶段通过或全球0增量。

根用[只读精确handoff](evidence/study-workflow-simplification-2026-11-17/wf05/external-ai01-session-handoff-readonly.json)将该audit联接到用户另报修AI01的既有Session；时间07:42Z、base project不属于本Study，bodyOrMessagesRead=false，未读取messages/Excel内容。该事实未归因于F01，也不表示AI01修复代理自行新增了Session。

[独立external-read-phase](evidence/study-workflow-simplification-2026-11-17/wf05/root/external-read-phase-2026-11-17T08-08-24-335Z-b1bac/root-result.json) passed、0业务写；[transition记录](evidence/study-workflow-simplification-2026-11-17/wf05/root/external-read-phase-2026-11-17T08-08-24-335Z-b1bac/known-external-read-phase-transition.json)严格证明该行不在原old set，只在校验副本排除这一个“新”的精确ID/hash/actor/action，然后原strict compare检查全部旧ID/fullhash/count、完整591job、角色和科学/Word。实际独立v2 before原样包含这条新事件并继续保护；原before不覆盖、0旧行排除，不能放宽成任意外部audit白名单。

新阶段入口必须先执行validator，省略或拒绝时不得capture/save新before；新阶段不能误走原admit。[独评记录](evidence/study-workflow-simplification-2026-11-17/wf05/qa-external-read-phase-review.md)保留首次入口缺口与关闭后的5/5纯内存guards，未降级旧保护标准。

## V3 phase2实际UI与业务结果

| 真实链 | 证据 | 已观察结果 |
| --- | --- | --- |
| 管理员 | [phase2 flow](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T08-09-13-588Z-646a0/root-result.json) · [pagination](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T08-09-13-588Z-646a0/pagination.json) · [navigation](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T08-09-13-588Z-646a0/navigation.json) | passed、0业务写；22个UI href与native完整范围逐ID/顺序一致，首5+17恰1more；原3步与已展示新1步到相同原S09。 |
| 原科研身份 | [phase2 flow](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-reviewer-2026-11-17T08-10-27-604Z-73a2d/root-result.json) · [pagination](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-reviewer-2026-11-17T08-10-27-604Z-73a2d/pagination.json) · [navigation](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-reviewer-2026-11-17T08-10-27-604Z-73a2d/navigation.json) | 同样22条/1more/同一固定访视，无额外采集来源选择，collectionStarted=false。 |
| 受控500与重载 | [管理员中断](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-admin-2026-11-17T08-09-13-588Z-646a0/read-interruption.json) · [原科研重载](evidence/study-workflow-simplification-2026-11-17/wf05/root/flow-reviewer-2026-11-17T08-10-27-604Z-73a2d/pure-get-reload.json) | 受控传输500清旧表、明确重试仍GET；纯GET clean reload没有beforeunload；两角色均无业务写。 |

“已展示项直达”只算从S01该行到原S09的1个导航动作。本例还需1次more展开，因此含展开为2个动作；不把填写、其他导航或总操作宣传为1次点击。仅查看安排/进入访视，零分配、零启动、零填答案，原S09仍完整核当前用途与采集权限。

[最终独立复核](evidence/study-workflow-simplification-2026-11-17/wf05/final-review.md)已核第二阶段双角色、原/新before纯比较、5/5入口守门、320/390及正确原生200视频帧，确认本模块证据成立；其当时结论保留原全仓4项失败与共享联动停点；后者已由根下述新批次实测通过，后续当前全前端与末次保护已由根通过；读取切片版本待项后由根精确补证关闭；Notion同步记录见finalmanifest，不背书F01独立能力。

## 五宽、原生200%及原裁片失败

[phase2视觉批次](evidence/study-workflow-simplification-2026-11-17/wf05/root/visual-admin-2026-11-17T08-11-03-296Z-4ede3/root-result.json)为6组测量、0业务写：[metrics](evidence/study-workflow-simplification-2026-11-17/wf05/root/visual-admin-2026-11-17T08-11-03-296Z-4ede3/measurements.json)覆盖1440/1920/1366/390/320和真实native200的collapsed5/expanded22、14/22、左右/中心三点hit。原生200实际CSS宽720、DPR2；根已目视正常尺寸和末项入口。

原 `native200-expanded-last.png` 的Playwright截图只有720×456裁片，不能证明物理视口全尾部，原失败PNG保留。[独评离线证据](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-target-v3-stage2-evidence.json)从同轮原WebM **PTS2.600000s** 提取[正确原生200帧](evidence/study-workflow-simplification-2026-11-17/wf05/reviewer-native200-video-26s.png)，1440×1000（913内容+87录制padding），末link与refresh完整；原WebM SHA为`95f7f402c1a1ec13a2962c55e061bbb69ec0447aa9225638c02c1b8ad3b9684b`，帧SHA为`42837a39c0d7530b08cec64561672a1fb843e06463b0fcf121f17f097738e253`。准确命令数组/原媒体路径/PTS/尺寸/hash在该JSON中；`-ss 2.6 -frames:v 1 -update 1`仅表示离线取帧，不是新target执行。3.4s已恢复zoom=1，明确排除，不充原生200证据。

## 最终保护与最新共享门禁

[最终只读audit](evidence/study-workflow-simplification-2026-11-17/wf05/root/audit-2026-11-17T08-13-50-450Z-dc686/root-result.json) passed、0本模块业务写：完整591job/155queued、全部旧行/角色/源/科学文件/Word保护，已知新AI01事件也属于新before中的受保护旧行。认证audit可按原精确规则追加；原窗口那1条独立外部业务增量已如实交接，不声称全球0增量。

**WF05本机合成已完成：最新准入联动、当前全前端、末次保护和读取切片来源补证均已根验。Notion同步记录见finalmanifest。** [V3全量前端实际日志](evidence/study-workflow-simplification-2026-11-17/wf05/full-frontend-v3-attempt01.log)为1089总数/1084pass/4fail/1skip。根核07:46另F01会话更新共享commands/assertApproved及Hub/video准入hook，运行该轮测试时schema尚未装配；owner称已修两mock、定向23pass，仅记owner声明。本项不碰、不绕过F01守门，也不将4fail归到已经独立精确联接的AI01事件。

根最新共享源码[隔离构建](evidence/study-workflow-simplification-2026-11-17/wf05/post-admission-build.log)exit0、4.71s，输出`/tmp/researchhub-wf05-post-admission-build-20261117`。F01另报两表/20个原active账号准入迁移check通过、两个真实PG通过（owner日志`.tmp/f01-shared-pg-regression.log`）、目标50810→74871，仍持窗进行最终异常回归；这些是owner回报，不代根实际S01/GET联动或全仓门禁复验。这是根最新准入联动前的owner回报时点，不冒充下述根实际复验。

根已明确向F01释放全部目标I/O；AI01仅另获授权的AI组件修补，当前报告不替其背书原Excel成功。WF05产品十源保持V3冻结；最新共享准入装配后的S01/GET联动、当前全前端和末次保护已由根完成，读取切片来源补证也已根验；Notion同步记录见finalmanifest，最终映射由根办理。

## 最新共享准入装配后的根实际复验

[post-admission批次](evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/root-result.json) passed、0业务写；[运行时核定](evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/current-runtime.json)记录当前PID74871、共享F01四源hash、`rh_admission.application/event`两表及两个QA身份approved metadata。此为根实际核定，不再仅引用owner声明。

[九项定向GET](evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/native-http.json)为6正向/3拒绝；[双身份真实Chrome](evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/browser.json)均首5→一次more得22，href与native全scope逐项一致，PNG/WebM与0pageerror留档，根已目视两角色1440截图。未选采集来源或启动采集，0业务写。新增post-admission driver/test仅QA守门（81行/5项guards通过），不改产品十源。

[fresh before→after保护](evidence/study-workflow-simplification-2026-11-17/wf05/root/post-admission-2026-11-17T08-30-32-235Z-8dda581d/fresh-protection.json)以原strict helper核全部旧行/fullhash、完整591job、科学/Word及精确auth allowlist通过；新准入两表本窗口metadata前后一致另行保护，不能声称旧helper历史已覆盖这两表。旧stage2→fresh的跨期audit新增42条（含合法auth），所有原audit全hash保留、其他原表exact；42不是F01业务数，也不是本次业务写，不声称原窗口全球0增量。原旧baseline未改。

最新共享源码构建4.71s已通过；该时点首份post-admission全前端尚在运行，后因fixture配置问题中止，不填写完整计数。当前完成的attempt02与末次保护见下文；原1084pass/4fail/1skip只属原attempt。

## 当前全前端与末次保护结果

[最终post-admission全前端attempt02](evidence/study-workflow-simplification-2026-11-17/wf05/full-frontend-post-admission-attempt02.log)完整结束：1176总、1175通过、1既有跳过、0失败，90.806s，包含两个真实rollback PG。[正确fixture配置后的定向回归](evidence/study-workflow-simplification-2026-11-17/wf05/fixture-config-green-attempt02.log)14/14。原post-admission attempt01及fixture-auth-recheck attempt01因遗漏合成slug/默认共享optimizer cache配置而中止，没有完整计数；[attempt配置记录](evidence/study-workflow-simplification-2026-11-17/wf05/fixture-config-attempts.json)和[真实504 Outdated Optimize Dep probe](evidence/study-workflow-simplification-2026-11-17/wf05/fixture-probe.json)保留。产品没有为这两项fixture配置问题改动。

[末次全前端窗口audit](evidence/study-workflow-simplification-2026-11-17/wf05/root/full-frontend-final-audit-2026-11-17T08-41-21-265Z.json) passed、0业务写：只将本次post-admission的after.json在RAM中作为下一窗口before，原文件全部未改；全部旧行/fullhash、591job、科学/Word/角色保持，`rh_admission`两表完整rowhash另比前后exact。Chrome/Auth已关闭、两个fixtures（PID84443）已关闭；主74871未动，根已释放全部目标I/O给F01。

该audit明确`sourceGateSliceContinuityPending=true`，只证明本次保护，不能抹成全部源无变化。矩阵记录`server/admission/service.mjs`目标加载SHA `2a90fad4bf7a26b09b4585763c8965405bc89be952f32f0a81b76cf760ee99fb`，磁盘SHA `93ddc1301f142004717be4a4befa885b2e3d145e69b4e76c02a5e15bb0347258`；另三shared源同hash。该字段保留的是末审当时的待项，已由下述后续补证关闭，不改原审计，不提前为F01独立新能力背书。

## 后续读取切片来源补证关闭

[根独立连续性核定](evidence/study-workflow-simplification-2026-11-17/wf05/admission-read-slice-continuity.json)passed、targetIO=false。Owner明确差异为list-only；根在RAM还原原count-over SQL/return两行，第一candidate整文件SHA即命中此前目标捕获的2a90…，保存[目标版本还原快照](evidence/study-workflow-simplification-2026-11-17/wf05/admission-runtime-source-reconstructed.mjs)、[当前磁盘93dd快照](evidence/study-workflow-simplification-2026-11-17/wf05/admission-disk-source-93dd.mjs)和[独立list差异](evidence/study-workflow-simplification-2026-11-17/wf05/admission-independent-list-delta.patch)。两份快照仅`createAdmissionService.list` body不同，其外全部bytes、imports及`bindAdmissionContext/assertApproved`读取切片同hash。

policy旧快照不存在：只记录owner逐字不动的明确声明与current hash，不称独立历史policy hash比对。WF05未调用F01独立list，不为其真实验收背书，不需为此补证新增目标I/O或重载。末次audit原`sourceGateSliceContinuityPending=true`不改，由此独立补证关闭。**WF05已完成（本机合成）；Notion同步记录见finalmanifest，根继续最终映射收口。**

最终独评已关闭读取版本待项并独立重放旧strict保护0业务写/591job/科学Word；末次准入两表真实compare已通过，但after数组未单独归档，不声称可从该文件独立重放这两表。独评结论仅为WF05本机合成范围，不背书F01独立list，也不启动WF06。

## 四层验收状态

| 层次 | 本模块已验证事实 | 验收边界 |
| --- | --- | --- |
| 代码已实现 | V3十源/native四源与组件/CSS/S01冻结；相关/独评99、独立JSX3、build5.61s；最新构建4.71s，当前全前端1175pass/1skip/0fail及fixture14/14 | 精确还原快照及diff已证明读取切片连续性；不以测试绿替代来源证据 |
| 目标环境已配置启用 | 原owned30580→50810；74871实际共享源hash、准入两表和两个QA身份approved metadata由根核定；主目标未因fixture配置重载 | F01 service目标2a90…与磁盘93dd…不同，另外三共享源同hash；读取切片来源后续补证已闭合；临床/生产另行验收 |
| 真实请求实际执行 | 原PG12/六GET与phase2保留；74871九GET、双角色真实Chrome首5→1more22/native全范围一致，0pageerror/采集/业务写；当前全前端含两个真实rollback PG通过 | 本次末审后Chrome/Auth清理、fixtures关闭并向F01释放目标；不扩大为F01独立能力背书 |
| 业务结果达到标准 | 本机V3模块、最新共享准入联动、当前全前端及末次全旧行/591/科学/Word/角色和准入两表fullrowhash保护均根验 | WF05本机合成已完成；Notion同步记录见finalmanifest，不代表临床或生产通过 |

真实临床、患者、生产部署、邮件/模型/云、Schema/角色/权限或配额变更均不在WF05本项。本模块本地文档收口，F01/AI01各自事实与原失败保留；共享最新准入入口联动、当前全前端与末次保护已根验；后续读取切片来源补证已关闭，WF05已完成（本机合成）；Notion同步记录见finalmanifest。WF06仅可另作设计预备，代码未开始。
