# WF08 D目标资源预算（执行中，含一次受控补验）

2026-11-18。仅同一WF08真实后台/页面验收。C代码、独评及PG门禁后才启用；此文不是执行证据。目标本机19501/19502、部署rh-kb-local-b0e2af9d、专用合成库wp01_test_full_baseline。当前17319持有四个监听口；19505 ready版本research-methods-worker.v1/t19-1已只读核。旧591/155、V3 partial及全部旧表行/科学Word保持，不扫描或接管。

## 只读核实的身份和来源

管理员仍原admin/authVersion5。科研身份使用原`rh-visit-qa-d3646f9f-reviewer`/authVersion0；真实账号active、加入审核approved，未更改账号属性。root/d-resource-readonly-preflight-v1/v2证明其在下列两group/project没有旧membership，也没有descriptive AgentAccess/SkillAssignment（含scopeKey *）可复用，故只新增本轮关系，绝不修改旧角色或权限。

| Study | group | 执行project |
| --- | --- | --- |
| rh-study-72203d59-4db8-4e74-9444-edff3b088b6d（普通） | rh-kb-local-b0e2af9d-group | cmwczp5hk0003lud9lsla5b75 |
| rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25（整课题） | rh-full-study-b230c34b-group | cmweunjpe001iluicrmxl5ii5 |

只读既有合成方案/已批准统计计划/四访视与锁定表单；数值仍实际确定性Python算子。新增Role1、group membership2、project membership2、原descriptive Agent/Skill的账号范围access/assignment各1；仅授计算/回看所需菜单及button，不授计划放行/审批或默认独审角色。失权反例只撤销本轮新ordinary关系，可在完成反例后恢复该新关系；原Job仍blocked，不自动重算。所有新ID/原键在实际执行manifest独占生成，旧身份/凭证/权限不变。

## 五个新Job

1. 普通合并放行→202接纳丢响应→原键GET找回；离页/刷新/重新登录及真实未完成切点重启，同一Job/Run完成，不重POST。
2. 整课题一次接纳，真实首项/三项批次，在部分已发布且未完成切点重启；120秒原DB租约后只接续未发布，最终39适用目标、15不适用不计算。
3. 整课题有已发布结果后请求停止，实际旧Worker迟到200不得发布；保已发布、仅结算未发布与原pending claim。预期首项1+在途批3最多4绑定；若故障致更多执行，明确本例失败及实际增量，不补称成功或篡改旧预算。
4. 科研auth0在已放行普通snapshot直接确认计算；仅本轮新授权关系执行中撤销，结果不得发布；当前权限/角色拒绝如实可见。证明compute-only不再要求放行。
5. 仅新建普通统计计划/批准/放行snapshot，执行中撤销该新计划批准；不改旧计划/旧来源，记录Job受阻与零晚到发布。

常规合并入口可新增普通snapshot1、full root及39child共40；新计划反例新增snapshot1/plan1/review2。总预算5Job、2新full group、42snapshot、plan1/review2、新Session至多1（科研普通，管理员复用原Session），无Subject/Visit/答案/临床政策改动。原生Run预期46，硬上界81（两个full各不超过其固定39目标、三个ordinary各1）；上界仅便于故障保护核定，不是放宽“停止后零发布”等业务标准。每例按实际绑定ID逐项核，不用总数相等遮盖多算。

显式DDL仅已验21块migration及新的fixture marker；启动不DDL。其余业务operation/audit均由实际原生入口创建，汇总限定本轮manifest，任何旧行减少或变更立即停后续写。必要临时HTTP阻断/受控暂停只针对本轮新Job；Worker SIGSTOP须独立watchdog在4秒内CONT，保8秒实际HTTP超时。主SIGKILL先记录pid/birth/owned children，后只清理其确证孤儿进程并重启；不把优雅drain、时间篡改或单连接代际模拟充实际重启。

## 结果与用户标准

两身份、五宽/native200、确认/Esc/焦点/真实刷新与PNG/WebM；接纳成功后无未保存拦截，写未知/真实未存输入仍保护。原Job链接/计数/状态与Native和逐项审计相符，轮询无写/续会话。已发布数值逐行对源与确定性输出，非仅绿色状态。最终保护、独评、产品/手册/Notion和四层记录后才WF08封板；不增加用户重复签收，不提前WF09–12。

## 2026-11-18补验裁定：六个新Job，原五例不改写

Job1实际接纳后3.48秒内完成，根在confirm之后才启动观察器，实际20:18:30开始时已错过20:18:17.350的发布，诚实记录CUT_NOT_OBSERVED、0SIGKILL；工具侧continue断点超时也保留。原Job1可核202丢响应后的原键/当前已完成结果，但不能充重启或原tab恢复已通过。根承担这次观察器未预先arm的执行错误，不为其修改产品或虚报恢复。

为完成已经授权的普通分支真实未完成重启正例，增加一个Job6：管理员复用Job1已放行原snapshot，在确认前预先arm只读观察器，于queued或已有同claim派发且零发布的running切点中断。只读守卫、旧代围栏、真实120秒租约和原结果独审不变。新增仅1Job/至多1NativeRun；不再放行新快照、不建计划/审核/Session/临床数据/新权限。六Job逻辑Run预期47；全局故障保护硬界6Job/82Run，原snapshot42、2full group、plan1/review2、Session≤1、7新关系不变。原五Job和初始预算记录保持，所有新增ID独占登记。

这是一项同一已授权本机合成验收的工程补验，非业务范围扩张或临床规则调整；不增加用户重复签收。原5/81的冻结QA脚本/保护证据保留，新增V2明确6/82，不能悄然扩大原白名单。

## 2026-11-18停止确认框缺陷与单次有界复验

Job3实际打开停止确认框并观察到首项已发布/三项HTTP在途，但产品的接纳完成effect会随父回调/轮询再次执行，误关停止确认框。真实取消POST为0；Worker在3.58秒恢复，后续39项正常完成，均保持待独立审核。该例停止验收失败，原执行、截图、HTTP、保护和39项结果保留，不改写成通过。

先以实际React组件浏览器回归复现并修正一次接纳完成后反复关闭确认框，再复验同一停止目标。仅补1个Job7，复用原Job2固定root/39child，不放行数据、不新增计划/同意/临床规则或权限，管理员复用Session；停止前仅允许首项1+在途3绑定。补验总上界7Job、3个full group、86个NativeRun（原Job3实际39，Job7至多4），原42snapshot/plan1/review2/Session≤1/7新关系不变。Job7若异常未发送取消，应按同一Job原键核定后进行已授权的保守停止清理，明确区分清理与UI成功，绝不自动新Job补跑。保留原6/82及全部已冻结记录，新manifest/driver明确7/3/86，其他测试不借此增加数量。

此次为已授权WF08中的真实产品缺陷修复与必要一次复验，不是未知弹窗的重复重测，不需要业务新增确认；已完成Job1/6/2/3的新结果全行锚保持。停止、失权、来源撤销及双角色矩阵通过并同步文档后才可封板。
