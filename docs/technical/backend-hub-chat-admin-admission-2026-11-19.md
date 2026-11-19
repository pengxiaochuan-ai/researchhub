# 独立后端：Hub聊天管理员兼容最小准入（已批准，本机技术验证通过）

用户于2026-11-19批准本清单及全回滚验证，不扩展持久身份、额度或模型调用。下方“待确认”表述保留为原阻断背景，以本段为准。

## 实际阻断与已有边界

本轮方法身份增量已执行：1 Agent、1原生发布Skill、1个人装备、1固定工作台会话；唯一免费描述统计、报告及资产登记已完成。没有AgentConfig、AgentAccess、ModelProfile、Token授额或模型调用。

2026-11-19独立新库真实HTTP：管理员`/knowledge/ai-status`返回200、enabled=false；`/agents`为空，不把方法Agent冒充聊天Agent。原admin不在StudyGroup成员中，提交`/sessions/hub-source`在原StudyGroupGuard先返回403。此前批准的Hub私有兼容只覆盖KnowledgeController和knowledge-import，不涵盖新Hub聊天Controller/消费者。若仅补聊天Agent/模型，仍不能穿过这两处原生成员要求；不能通过给管理员添加成员、借方法Agent、伪造角色来绕过。

新Hub代码已经接线原生Queue→专用Sessions→Orchestrator/KbTools→原生计费和同tx发布；入队在同tx锁后重验Hub准入、具名AgentAccess及真实session，原生Worker权限后验，失败回滚user/job。未适配消费者启动拒绝。免费依赖注入验证不是原生LLM执行验收。

## 请求的准确最小增量

1. **仅Hub私有构建副本**的`src/common/guards/study-group.guard.ts`、`src/common/worker-authorization.ts`及已有`src/common/hub-knowledge-admin.ts`兼容辅助函数。原工作区源码、旧服务、已封存旧副本均不修改；生成新版本manifest/patch，不覆盖已发布hash或SQL。
2. HTTP增加且仅增加`HubChatController`：当前DB有效租户管理员（role/adminFlag一致、当前authVersion、账号/租户/真实Group/Project有效）无需逐Study成员。绑定请求中已核实的真实scope。普通科研人员沿原Group/Project成员及workbench/chat.use规则，平台管理员不冒充业务管理员。
3. Worker增加且仅增加`knowledge-chat`的相同管理员规则：真实会话属于任务本人、当前租户/Group/Project一致、channel=knowledge、上下文为受支持Hub会话、Agent为本租户具名Hub科研Agent；仍核当前具名AgentAccess和F01。其余原生真实父对象、Agent工具权限、版本、租约、终态CAS、审计、预留与用量结算不变。其他Worker不借此获得权限。
4. **仍只使用现有具名独立合成库/Study/admin**。允许一个外层ROLLBACK原生校验用例，瞬时最多1个Hub聊天Agent、1个只读检索AgentConfig、1条admin个人AgentAccess、1会话、1用户消息、1 queued聊天任务；均不得提交，前后业务/权限/账本hash相同。可构造测试专用部署scope做原生授权函数验证，不启用运行中消费者、不认领任务。禁止创建ModelProfile、角色、成员、Token或费用，不调用模型。
5. 目标HTTP验证管理员由先前403进入明确503 `HUB_CHAT_NOT_CONFIGURED`，普通无chat.use账号仍403；状态仍disabled。校验缺失成员、错误scope/owner/authVersion/adminFlag、撤销准入/AgentAccess时拒绝；实际库不得新增聊天记录或预留。

## 本次不包含

不持久建立聊天Agent/Config/Access，不读旧服务密钥或远端配置，不开放付费AI，不创建云资源，不做生产DDL/GRANT、停线、发布或main提交。原main提交授权继续有效，但须待独立包演练与总评完成；不因本规格批准就自动部署。真实模型与其他AI上下文的验收仍单列，不能将503或免费原生授权函数通过称为AI回答生效。

## 通过条件

- 私有补丁源hash严格核验，原源码/旧服务未改变；新增两处条件只作用于明确Hub聊天类/Worker。
- 单元、独立PG正反例/全ROLLBACK、真实Chrome及API拒绝链证据齐备；0新增持久身份/业务行、0预留、0模型请求。
- 逐项关闭独立评审问题，更新本轮进度、产品基线/记录和用户操作手册；生产操作仍待另行确认。

## 实施核对补充

原生Worker的工具权限依赖成员角色，原Sessions也逐成员计算工具；管理员仅通过HTTP成员兼容仍不足。按本次已批准的只读检索边界，在同一Hub聊天管理员分支仅派生knowledge菜单与chat.use供原生工具交集计算，并在Sessions返回及Worker requirements两侧硬性限制knowledge.search，不写任何角色/权限表，不返回其他工具；实际active AgentConfig仍须允许knowledge.search。Hub自有Sessions subclass只对绑定的Hub任务调用原生withMessageExecution重验后取该交集，不修改旧Sessions源码、扩大私有核心文件或绕开原生发布/计费。

## 实际结果与限制（2026-11-19）

- v32私有镜像中实际调用原生Sessions.ensureKnowledgeSession、createKnowledgeQueueRecords和assertWorkerAuthorized，原admin无Group成员时只读检索授权通过。1 Agent/1 Config/1个人Access/1会话/1用户消息/1 queued任务均在单外层ROLLBACK内，17张相关身份/业务/准入/账本表hash相同，持久计数仍0聊天配置/Access/消息/任务/模型运行/Token新增。
- 14项原生正反例通过：撤销Access、错误会话owner/上下文/Agent、Group/Project失效、adminFlag丢失、在途authVersion变化、账号停用、工具配置撤销及多工具配置均有当前拒绝；多工具配置只许search，其余四类requirements拒绝。不认领任务、不运行模型、不增加费用。
- F01已批准是原生终态，不能合法改为撤销，故未强改或关闭触发器。真实既有未批准账号拒绝与纯测试“当前批准缺失”作为替代证据；不称完成approved→revoked真实业务操作，不扩展F01产品状态。
- Chrome真实管理员POST由403转为503 HUB_CHAT_NOT_CONFIGURED；科研只读账号仍403，错scope403，知识库读取200，登录仍有效。原AI01区域显示受限，未改布局；这不是已启用聊天或AI回答验收。
- 相关纯测试先红后绿，合并88项0失败/0跳过。独评发现工具派生可能带出file/artifact/skill权限，已按双侧search硬上限修补并以多工具配置原生反例复核关闭；目录别名/symlink/hardlink保护及规格路径也已修正复核。旧5份源码hash相同，不重启旧服务。

私有证据：chat-admin-native-rollback-result.json、browser-chat-admin/result.json及PNG/WebM、chat-admin-red.log、chat-admin-alias-red.log、chat-admin-green-v4.log、consolidated-free-regression-chat.log，均位于本轮忽略目录。初次浏览器脚本误加不支持的AI01参数，仅观察到入口无效，修正为原标准入口后才计入界面结果；初次校验脚本字符串错误未进入业务事务，修正后重验，失败日志保留。生产及真实模型未验收，原main交付仍按完整演练和最终index总评另记。
