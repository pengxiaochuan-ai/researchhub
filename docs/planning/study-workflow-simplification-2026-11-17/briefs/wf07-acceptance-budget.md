# WF07 本机合成验收预算

用户已授权完整功能开发与代理验收，不新增功能审批。仅在本项代码独立终核通过、共享19501窗口可用后执行；当前记录预算，不代表已经执行。主服务不因本项前端功能重载。

## V4最终复验增补（恢复挂载缺陷后）

V3前三条通过；第四原键恢复成功但弹窗因异步plan到达被重挂而丢失，原driver超时并清理了tab。独立parent JSX已确认普通、full同型，不能把原失败改绿或注入sessionStorage冒充自然恢复。

V4修复及独评后，明确允许以`STUDY_WORKFLOW_WF07_QA_CAMPAIGN=implementation-v4`执行下表同四条路径的**四个全新合成意图**。源码冻结必须精确V4；每条另建`<case>-implementation-v4.json`独立wx claim、全新原生key/ID，原claim/result/journal完全保留。四条新增上限分别仍是下表逐项预算；不重播V3任何原请求，成功checkpoint不重做。最终同源验收只采这四条V4结果，V3三成功/一失败分列为历史。

原V3 partial仅通过GET/精确ID查询核定已完成部分与全部授权新增，单独存partial reconciliation及保护投影；其剩余35个未派发逻辑分片不自动继续、不取消、不新建后台作业。原partial collector只能纯读取，不能借partial选项放宽最终四条的全适用项终态/remaining=0要求。最终fresh before完整包含V3三成功及partial旧行并继续逐ID/fullhash保护；只读视觉补证必须指向V4 campaign四passed，不混用V3加载态图或计数。真实临床/生产边界不变，目标仍19501。

## 固定资源

- 管理员使用现有本机合成账号，当前authVersion=5；既有科研体验账号authVersion=0作实际无权隔离反例，不改账号、角色、席位或用途政策。
- ordinary正常来源：Study `rh-study-72203d59-4db8-4e74-9444-edff3b088b6d`，plan `t15-plan-53ec8735-4648-49fb-9f39-43cb3d5386dc`，根已核当前approved与零阻断预览。旧plan b9ca7935的参与阻断保留作负例，不更正旧来源。
- full来源：Study `rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25`，plan `full-plan-358e13d2-78f7-40b0-80ef-543cfc65745f`，根已核当前approved与零阻断预览。实际ready slices按本轮预览/放行回执确定，不固定套旧39计数。

## 四个新意图

| 用例 | 真实行为 | 新增上限与故障边界 |
| --- | --- | --- |
| ordinary正常 | 一次确认完成放行与原生运行；直达该运行回看，再从正常列表/概览进入新计划 | 1 release、1 native create、1 snapshot、1 methodRun |
| ordinary创建中断 | 创建请求在浏览器端转发前中断；只读核原键404并保留未知，刷新后人明确以同键/同snapshot续办 | 1 release、至多2次客户端create尝试，但至多1次到达服务端并创建1 run；不得换键或假称404证明未执行 |
| full正常 | 一次确认放行root/slices、创建group并按原生批次完成全部适用计算 | 1 release、1 group；每个ready slice至多1 methodRun，含create内部首片；后续process按原capabilities及CAS，批次支持保持 |
| full已计算丢响应 | 首个后续process实际200后丢浏览器响应；刷新、只读核定、回看原partial运行并返回/继续 | 1 release、1 group；首个已完成batch只GET找回，不重发；明确继续只派发剩余项，每ready slice仍至多1 run |

每个full用例至多新增1个root及实际ready slice数量的child snapshots。Methods每个用例至多新建1个本actor/project工作台Session，均须由本轮run引用；若native prepare先提交而后续失败产生孤立Session，立即停线单独核定，不能自动排除或冒称全链零写。完整保存create内部full-first及后续process原键、请求digest、回执、claim/finished与逐run三类执行audit。

不新建或审核计划，不更改源表单、同意、参与、访视、数据用途、映射、既有运行或文件；不结果审核、报告、Word、邮件、模型、云或收费调用。不消费155条历史queued知识任务；全部591条完整job及所有原ID/hash仍保护。

## 纯读取界面与恢复证据

四条业务路径仍只由`scripts/study-workflow-wf07-qa.mjs`执行。五宽、权限反例和目标源码核定采用证据目录内一次性`wf07/root/readonly-qa.mjs`补证，不另建项目QA框架；须传入独评通过的V3或后续真实冻结路径/hash，并显式设置本项只读执行环境变量。该补证拦截全部业务写，只允许本次原生认证；fresh before/after重放完整原保护及七表严格保护，不排新增业务行。原driver两源不变，补证另存源码hash/纯guards与真实结果。

正常/阻断/无权页面、五宽1440/1920/1366/390/320与Chrome原生200%、14/22、Tab/Esc/焦点、确认期间busy/连续反馈、正常已知结果自动关框以及原来源/结果入口留PNG/WebM。视觉阶段只允许GET及本次认证，不允许除上述四个意图外的任何业务POST。真实200后丢响应与转发前中断分列，不把故障模拟当成服务端失败。

原始before/rawAfter与补充七表快照保存；仅将原键/actor/父链核定的精确新增ID传入本项投影，再重放原strict。实际业务新增/执行数与保护投影0写分别报告。任何未知新行、旧hash变化、额外POST、角色变化、旧知识任务或原科学/Word改变均停线，不删除记录、不重放已成功步骤。源/权限已改变时不为通过验收修旧数据，回到新鲜核准与明确记录。
