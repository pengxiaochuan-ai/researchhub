# D05最小规格修正提案：终态run只读，AI关联留在原队列

## 2026-10-26当前 · WP07首切片技术收口，AC10专业验收待用户（未发布）

本提案已批准并实施；原Queue/实际PG原子/幂等/行锁验证后，D05两账号真实合格解释＋在途失效不交付已完成，D06新报告与D07整链技术检查完成。终态run任何字段都未回写，原job保存绑定/选择/请求hash/版本，原Message/Audit关联；不改旧触发器/Schema/源码/角色。此前引用失败保留，用户另批准总4次后真实完成，79笔known/¥1.518966/¥5，本片额度用完。当前D08独立原评审及重要项作者复验完成、AC10待用户；下方阻断为历史，不是未解决存储问题。



2026-10-25，**用户已批准；核心存储门槛已在原Queue/实际合成PG验证通过，D05整体未完成**。终态run不写任何字段；本轮不改旧源码/触发器/Schema/角色/权限。后续当前阻断是模型输出引用，不再是终态存储。


D08唯一独立原结论With fixes（0严重/3重要/1轻微）；三重要项已由主实现一次RED→GREEN修补：第五意图英文/Unicode数量禁入禁出，慢读失权同步释放busy/reading，比较补真实输入修订与双方范围观察。新Chrome交叉失权恢复/迟到200/五视口通过；最终302组合＋1054原内核及构建/保全通过，原Node/chunk告警保留。未追加模型请求，原With fixes与作者关闭分开记录；一处旧“待接入”提示Minor延后。代码/本机启用/真实请求与用户专业AC10四层分列，技术交接不等于完整WP07、一期、生产或专业验收。后续新样例如需新增AI请求，先另确认次数/有效价格，不自动动用余额。下方旧阻断/旧PID/待批均为历史。

## 当前实施结果

先改§6/计划与契约，补有序选择/完整请求摘要/原键/真实版本校验。实际入队沿原session锁后取共同授权锁→精确owner/run行锁→重读当前父/数据/DQ/方法，原job/user message/审计同事务保存。查询限定tenant/group/project/account/session/第五kind/plan/collection/run，latest/pending均take 1；原队列同键竞态返回后也验完整输入。prepare/最终提交/原消息/source均以job选择重建，不回写终态run。

真实原Queue/PG先23514 RED，改映射表名错误42P01后核心反例GREEN；没有绕过保护。crf-queue-88ebfff4六项验证：job/message/audit全回滚、两连接同键只建一个、同键异输入409、异键在途409、job持久选择/版本、整行终态run不变。免费harness仅用隔离scope副本、队列Worker禁用；自己新建的具名测试job精确收为CONTROLLED_FREE_QUEUE_TEST/attempts0，无历史扫描、模型或旧scope改动。

storage-resume-de322ad0只读核对三新run的原job元数据，原75笔/报价回执/started原key时间保留，恢复未消费轮次，不删除失败、不重置3次。之后wp07-ai-8d59d410首个实际Chrome POST成功持久入队，原KnowledgeService/KbTools与科研Agent/Provider实际执行，HTTP200/known usage；但正文无行内引用，CRF_AI_OUTPUT_INVALID，原assistant未提交。新增¥0.012051，累计76笔known/¥1.476468/¥5，原3次已用1次、余2次。

ai-output-check-91e5534c免费核对：实际原工具轨迹/Provider/拒绝原因；同键失败结果仍幂等且不再收费；两账号新请求403、原R01结果current可读、真实Chrome三视口14/22及无根横溢。诊断时仅在内存补行内编号可通过解析，证明此次原因；**没有修补或发布该回答**。保留所有失败/收费，292组合＋1054原内核/构建/保全/空白通过不等于AI业务验收。

仅本片paidAiApproved=false、implementationHold=model-output-citation-review。若保留两账号成功＋在途拒交付验收目标，至少还需3次请求，比原剩余2次多1次；拟总次数3→4但仍原累计5元，待用户确认，原私有maxNewRequests仍3。不自动续价/续额/重试，不提前D06或D08评审。以下保留修正前冲突与原提案，不能作为恢复指令。

## 已证实的冲突

首次真实Chrome有效提交返回500，实际队列事务整体回滚；账本仍75笔known、¥1.464417/¥5，没有Provider请求或新增费用。随后用真实原Queue＋专用合成PG、事务必回滚的免费反例独立复现：`researchMethodRun.updateMany`更新终态run的artifactRefs触发PostgreSQL SQLSTATE 23514：`terminal research method snapshot is immutable`。

旧源码依据：`app/server/prisma/migrations/20260913053000_terminology_release_hardening/migration.sql:165`。`needs_review/completed/failed`后，artifactRefs、inputSummary、inputHash、numericEvidence、dataSources、environment等快照字段均受保护。没有删除/禁用触发器、改旧源码、Schema、角色或正式表，也未把已有方法改回running来绕过保护。

证据：`/Users/mac/aisciencesys/docs/test/evidence/2026-10-25-researchhub-wp07-crf-methods/wp07-ai-2a52d49d/failure.json`及`crf-queue-9c63fcf4/failure.json`。前者为真实浏览器入口，后者为实际PG/原队列反例；不是Mock、模型失败或Provider额度不足。此前纯测试/免费非法输入测试不能证明有效入队可提交，D05不销项。

## 推荐的最小调整

1. 终态ResearchMethodRun完全只读，不在artifactRefs/environment等任何受保护字段追加AI pending、选择或报告关联，不改旧触发器。input/result/hash/真实runVersion保持原值。
2. 只用原KnowledgeChatJob.payload保存第五意图的run/input/result绑定、选定evidenceIds及选择摘要、请求摘要；原Message provenance保存真实输出及相同绑定，AuditLog追加审计。没有新表、迁移、角色、Worker、Skill、运行服务或通用调度平台。
3. 原队列事务内取得当前授权与本人真实run的行锁，重新验证父对象/当前数据/DQ/来源/结果、同键/不同键在途请求，再原子创建原job/user message/审计。查询必须tenant/Study/account/session/第五kind/真实run有界限定，不扫描或恢复历史任务；不能因run只读放弃并发防重。
4. 用实际原队列记录投影AI pending/历史，不伪造run.updatedAt变化。原始runVersion仍核对真实方法版本；选择/请求摘要另绑定实际job，最终assistant及原knowledge-state/source/报告重验同一上下文。方法[M]与文献[n]引用、去数值边界和费用门槛保持。
5. 报告仍为原批准的独立ResearchArtifact/Version/Source/Audit新草稿；来源记录真实run，不回写终态run、不改旧报告。D06设计需同步删掉任何暗含run metadata可写的假设。

这是对批准稿§6“job/user message＋run.artifactRefs.pending同事务”的明确替换。实际job检索/锁顺序、选择持久化契约及回滚/竞态/原会话反例先改规格和测试，再串行实施；批准不等于实现或独立评审结论。

## 已停住的范围和恢复门槛

仅本片WP07 scope的paidAiApproved暂置false，并标记implementationHold；R01方法执行/读取保留，原WP06 scope/授权不动。F01批准与私有原账本回执保留，不自动续期/充值或重置3次计划；首轮started标记保留为“入队前阻断、0模型”，不删除或伪装已试跑。恢复须用户明确批准本存储修正，之后仅在原有效报价/原累计5元/未使用3次以内继续；报价到期再按约定确认，不默续。

建议额外有效工作预算2～4小时，从原8小时缓冲中列支；先用≤1小时验证原事务/行锁/队列的无损表达，仍不成立或超原24＋8小时总预算则再停线，不扩大共享底座。D05–D08及AC07–10仍未完成，唯一独立代码总评审未派；11月中旬目标不因该提案自动延期或宣称已保证。
