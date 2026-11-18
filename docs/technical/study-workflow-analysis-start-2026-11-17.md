# WF07 · 确认数据并开始分析

状态：本机合成四层、20源末核及三个稳定负例UI的独评均已通过；Notion同步记录及最终完成状态见本项`final-manifest.json`。V4四个新意图原生链、17319完整只读/关键图像与正常近期列表已有证据。四例实际计算在60890执行；后续17319只读回看，没有重新计算。本地和合成范围不外推正式环境或临床验收。

## 范围与原生链

在已批准计划中，以一次站内确认顺序完成原数据放行和本次确定性计算。普通描述统计与整课题分析分别保留原DTO、证明函数和服务权限，不增加API、数据库结构、临床规则、后台worker或模型调用。原“仅放行快照”路径保留，计划审批和结果审核不合并。WF08–WF12尚未开始。

以下均为既有接口，路径前缀为`/api/research-studies/:studyId/analysis`。

| 分支 | 放行后创建与执行 | 完成判断 |
| --- | --- | --- |
| 普通 | `POST /plans/:planId/snapshots` → `POST /runs`；create原生准备工作台并执行描述统计，没有后续process接口 | 核原运行、固定快照及结果状态，结果仍待原审核 |
| 整课题 | 同一放行/create路径，由计划分支进入原生服务；create登记group并执行首片，随后`POST /runs/:runGroupId/process`推进原分片 | 核group和实际active slices终态；remaining为0不能独自证明成功，running/blocked/failed不冒称完成 |

普通释放后的manifestHash沿原合同与预览一致；整课题释放会加入qualityEvaluation，root manifest hash可与previewHash不同。后续创建和分片必须绑定实际释放的root/child snapshot及原批准，不用previewHash替代rootHash。普通本地canCreate只说明字段适用，不构成服务授权；工作台准备可能产生原生Session副作用，不能从一次拒绝推断全链零写。

## 意图、恢复和旧入口互斥

`analysis-start-session`独立持有同一意图的actor/authVersion、Study、批准计划、previewHash、固定snapshot、原生子请求键及阶段。authVersion为0合法。写前可靠保存最小标记，存储失败停止发送；标记不保存临床原值、完整schema或放行理由。理由仅在有限内存保留15分钟，紧邻放行写前重验期限，不因GET延长。

刷新恢复不信任本地stage：先以原release/create/process键GET权威回执及原固定对象，recover本身不POST。404、失权或一次4xx不能证明旧写未执行，也不清除既有unknown。人明确“继续本次分析”才可在再次原键GET、权限及固定来源核定后，沿**相同原键、完全相同body/hash及CAS**续办；查到成功只消费结果，不重复执行。放行重试还必须能用未过期的原内存理由精确重建；刷新或超期后不伪填理由。放行已证实但下游失败时保留“数据已放行”事实，不把它降回未知或重新放行。

普通Methods创建也读取同actor/Study未归档的新意图，包括旧authVersion；新入口反向读取原Methods pending-create。原创建保留`rh-methods-pending:<actor>:<Study>`，审核/取消使用`rh-methods-action-pending:<actor>:<authVersion>:<Study>`。GET403/reset、审核成功或审核未知不删除/覆盖旧未知创建；核定只清对应原操作位置。原run回看与审核继续可用，旧授权版本不能作为当前重放资格。

正面证明完成后归档活动记录，保RAM结果与原历史，不依赖点击特定链接。已证明partial可回看自己的原run并保留活动标记；纯GET允许合法同Study回看路径，后续写仍受原URL/身份/来源约束。失败或无适用数据且确无在途计算时可明确结束本次记录，不称成功或原生取消；unknown不能借结束被清除。

## 界面生命周期与反馈

两Workspace在原Card内保留单一稳定Control槽，owner绑定分支/actor/authVersion/Study；计划尚未到达、暂缺或revision更新不卸载恢复弹窗。普通理由、subject标签及旧确认另按plan/revision绑定，首render即隐藏旧值，迟到setter和旧确认回调同步核当前绑定、身份、批准、来源与URL，不能靠effect清理间隙误提交。

确认在途保留站内弹窗、busy反馈及重复提交禁用；unknown保留核对入口，正面核定完成后自动关闭而保结果入口。稳定host提供焦点fallback，取消/Esc不清未决写。真实未保存理由及在途写保留beforeunload保护，纯预检GET不制造脏态。离页后持久执行属于尚未实施的WF08，本项没有后台持续运行承诺。

## 权限、数据、审计与性能

原服务继续重验租户与Study权限、计划批准、来源、用途/同意/盲态、质量阻断、执行权及CAS。前端不能以管理员文案、预览可读或可放行推导计算授权，不新增角色或修改旧源来造正例。当前两核准Study的管理员authVersion5为正向身份；原科研authVersion0收到404是隔离反例，不能充作可用研究者正例。

native两项404与旧计划409已真实核定；原readonly的部分负例PNG为身份Gate核验瞬态，不能作为最终拒绝状态，旧图仍保留。[新独立只读补证](../testing/evidence/study-workflow-simplification-2026-11-17/wf07/root/stable-denials-readonly-2026-11-17T14-47-33-914Z-03bcc3eb/root-result.json)在17319核3页通过：原科研auth0两Study真实404、原管理员旧计划preview409，实际身份/GET原因一致、busy与身份核验均结束、连续两次稳定且paint后重核、无原值表/启用主动作；0业务写/保护通过。未修改20源或旧权限，原瞬态图与新稳定图分开保存。

正常200复用原DTO及既有证明函数，逐批沿已证实stateHash推进，不为每个已知成功步骤额外重读完整来源快照；未知/restore才用原键GET补证。服务端逐批权限、来源、CAS及审计不减。CAS变化、失败或仍在途即停止后续派发。

近期运行列表仍保留原最多50项、完整来源与权限核验。离页取消增量只对精确GET `/api/research-studies/:id/analysis/runs`生效：Vite在proxyReq事件提前监听下游`res.close && !res.writableEnded`并销毁该原upstream request；Nest透传响应同样建立有界signal；ordinary循环在边界停止尚未开始的下一ListItem，当前Methods项完整结束。原错误不吞掉，不返回截断200，不中断数据库事务、不改当前项锁或审计。正常response close不取消，不用req.close判断连，成功/异常均清监听。原proxy target与`changeOrigin:true`保持，未添加Origin rewrite。full.list的原两参数实现保持，controller完成后统一核取消。

取消增量冻结`list-disconnect-freeze-v1.json`；定向相关28/28、原生60/60、构建5.03秒，根24与独立19+5通过。真实随机HTTP/Vite→实际controller→ordinary循环的before链正常200通过，但“GET入站complete、上游未返headers即断client”未传播到API，1项失败保留；当前两项通过。该隔离证据没有数据库或主服务，根另在17319完成无故障注入的原序列诊断：两个ordinary前缀ready、full GET200用时5902ms、严格0业务写。其后最终完整readonly通过：四例原结果逐值/来源、12组五宽/native200测量、权限及安全HTTP/field ledger、PNG/WebM和fresh保护齐备，0业务写，根已核关键数字/窄屏/200%对话图。正常recent另实际读回31项，原DB latest<=50顺序、metadata及MD5全一致，HTTP200/20811ms、严格0写；它不是50满额样例或浏览器列表性能证明。最终独评与20源末核通过；Notion同步记录及最终完成状态见本项final-manifest。

本项授权新增与旧事实保护分别核算。旧316run、48revision、39child snapshot、36科学文件与Word、完整591知识任务及额外七表旧ID/fullhash保持；只按权威原键、actor及父链核定本轮精确新增，原rawAfter和授权增量不被投影“零差量”替代。放行、创建、隐含首片、后续process、Session及业务audit分别计数，认证日志不充业务审计。原V3三成功与一partial保留，不重播、不续算其35个未派发项。

V4四例合计82snapshot、80run、34operation、302业务audit，新Session/新review均0；两个full各39实际执行、15不适用未执行。性能记录须标清边界：dispatch审计→publish审计包含等待、来源重验、Worker网络与事务，不是纯CPU或单次HTTP耗时。旧A的30003ms abort、受控B的5976ms及装配后无注入A的5902ms属于不同请求/时间窗口，不能直接写成统一吞吐或计算加速比例。

依据：[实施合同](../planning/study-workflow-simplification-2026-11-17/briefs/wf07.md)、[当前验收记录](../testing/study-workflow-wf07-2026-11-17.md)、[统一操作手册第12节](../product/用户验证与操作手册.md#12-wf07确认数据并开始分析)。V4代码冻结见`docs/testing/evidence/study-workflow-simplification-2026-11-17/wf07/implementation-freeze-v4.json`。
