# P05 · 一次确认到被试／访视入库

2026-11-13。用户已批准M01–M05，沿当前目录串行实施＋一次独立总评审。I01–I08已完成本机技术交接，独评修补与产品/使用/API/版本文档、Notion同步已完成。4被试/独立4入组访视/4CRF实际落库，P06与专业验收未完成。[完整验证](../../testing/ai-data-import-p05-2026-11-13.md) · [技术契约](../../technical/ai-research-data-import-2026-11-13.md)。下方目标/边界保持。

## 已核实的目标与假设

继续仅专用合成库wp01_test_full_baseline、原owner/admin及本人本轮新对象。旧服务、前序被试/答卷/报告只读；本轮无模型/付费调用、外部连接、云或发布。P04原4文件/4计划不改、不隐式导入。

推荐复用现有Study，无需新建课题、研究或执行项目：

| 对象 | 真实值 |
| --- | --- |
| Study | rh-study-b3fa8c8d-b861-454e-8733-5ccbcce8f090 |
| 页面名称 | 科研流程合成贯通 · T05 rh-t05-http-f75b3165 |
| 课题意图 | rh-project-6a3d3cab-9ca1-4f45-8e2c-232591bd2df8 |
| 执行项目 | cmwcc7ft60002lua6zkvh0mxj |
| 课题组 | rh-kb-local-b0e2af9d-group |
| 在执行方案 | cmwcc7kgi000ylua60qjdm1lg，v2/executing |
| 基线访视 | cmwcc7kgi0010lua6lnh2kppe，BASELINE |
| 访视固定表单 | cmwcc7fux0002lux0dxq7ukdx，published；value为必填number，completed为必填boolean |
| 审批绑定政策 | policy-2b64cf0e-d8d7-48bf-8850-49ae74b97f9c，hash 77b6248da9f9b8e9536403004beffca89813e801f59905548e936977550177eb |

同Study另有v1/superseded与v3/draft，不能按“最大版本号”替代实际执行v2。确认和提交都重验当前状态，不把本快照当永久许可。

AI01上传来源执行项目仍为rh-kb-local-b0e2af9d-project，尚无Study绑定。**来源会话与导入目的地是两条父链**，可以不同；不能把来源项目变成Study或迁移原资料。服务端统一Study解析确定目标；原read/configure resolver的canCollect=false不改成万能启用，导入单独经过原生研究/同意/访视/表单守门。

实际权限：owner为active researcher/authVersion5，目标project_manager，现有study.execute/configure/review，但无subjects/data菜单、subject.create、data.upload、form.fill。admin为真实active tenant_admin/isTenantAdmin=true/authVersion5，未伪造目标成员；实际调用旧authorizeIngestInTransaction和authorizeFormalResponse，owner均403，admin均通过。不是从显示名或旧文档推断。

## 最小业务切片

1. 被试档案批次：自动识别/确认假名编号列，创建本人新Subject；只可幂等匹配本轮同一导入许可下已有建档回执证明的本人新记录，前序本人记录也排除。其他未映射列保留原件并明确未写入。不猜组别、诊断或身份，不自动入组。首片正式写入只包含编号及已确认的原生字段，不做通用科学指标推断。
2. 访视表单批次：只向已经合法入组且存在相应访视的本人记录写入已发布CRF字段；用旧表单规范核类型、必填、范围、版本/计划关系、同意和可填写状态。value=0、completed=false与空值严格区分。不自动创造访视，不自动标访视完成，不覆盖已提交答卷，出现冲突走原更正流程。

这两类由系统识别并汇总；常规流程只确认一次。**新被试没有入组，不能直接生成合法访视**：正常业务沿既有入组流程；本轮技术验证单独具名准备4个新合成被试的筛选/同意/入组/基线访视，必须与文件导入分开记录。不得把测试准备冒称“上传后自动入组”，不触前序被试。

原P04文件的V1/month1不是目标BASELINE的自动同义词，原score/flag/未知单位不自动当value/completed；需准确映射，无法匹配的行不写。正式验证使用本轮新的具名CSV/XLSX，不为走通而修改原文件或虚构科学数据。

## 复用与最小适配

| 能力 | 复用落点与限制 |
| --- | --- |
| 当前身份/Study父链/事务 | research-studies/commands.mjs的withResearchStudyTransaction；目标解析后在同一事务核来源，切换GUC时明确恢复目标/来源，不嵌套新事务 |
| 文件和原件 | P04本人session/source refs及既有StorageService；只读核原SHA/字节，不再上传一份、不落知识库 |
| 建档 | 旧SubjectsService.createInTransaction、真实scope/唯一键、审计；调用方承担当前导入授权 |
| CRF解析与批量策略 | research-capture/import-csv.mjs及imports.mjs的预检、整批原子写/原回执策略；XLSX转规范行时保留sheet/原行号和typed原值，不靠CSV字符串往返把false/0变成空值 |
| 访视/同意/表单提交 | 原lockCaptureBinding、assignVisitFormInTransaction、writeAnswersInTransaction及writer/版本/审计/评分；不绕过政策、同意、锁定、更正和数值契约 |
| 受控授权差异 | 原生assign/write当前只接受组角色form.fill；拟将两处授权调用提为默认仍用原鉴权的服务端依赖，P05才注入精确Study导入许可检查。检查必须接收真实visitId或assignmentId，回查真实Subject/enrollment/visit父链及Subject.createdBy=self，而非只查Study后放行整库。不是请求参数，不伪造管理员，不改原HTTP默认权限 |
| 数据读取回链 | 沿S03/S09既有对象路由；原权限不足时只投影本次receipt明确列出的本人新对象，不能因此读全Study或扩大普通建档/录入权限 |

原imports.mjs预检会读取原canAssign/canSubmit，它们含原form.fill判断，不能只替换两处写鉴权就声称owner可用。P05须提供**当前资源专用的预检投影**：通过当前限定许可，再复用原生父链/同意/排期/模式/表单/答卷业务校验计算导入资格；不把旧capabilities全局改成true，也不复制另一套放宽业务规则。旧行级导入核验可在Hub侧提取共用核心，普通入口行为不变；若实施发现还必须改动上述两处以外的旧app/server文件，按M04先列新差异。

授权依赖签名须携带真实资源/操作：assign传visitId＋formVersionId；write传assignmentId＋command.kind，P05只允许submit，不能获得draft/correct/review/lock等动作。检查重新读取当前账号/authVersion、租户功能study_operations、活跃group/project/Study成员、许可版本/期限；回查真实Subject.createdBy、Enrollment、Visit与本轮允许集合，返回真实当前actor而非布尔许可。每行的Enrollment/Visit必须属于所确认executing v2、固定BASELINE计划及所需Form；原生允许superseded的历史读写规则不能代替本片固定版本核验。

不授组级data.upload/form.fill/subject.create，不改账号角色或原科研Agent工具，不启用旧Worker/通用数据Agent工具。原数据Agent其他有效能力留P06逐项复用，不在此片扩大模态或算子。

## 两张Hub增量表（已批准，实施中）

为保留P04不可变定义/目录凭据，采用新增表，**不放宽P04 target必须NULL、不可改源/结果的约束**。

- rh_ai.research_data_import_access：单Study、单账号、可撤销/CAS的导入许可；记录tenant、Study及真实group/project父链、账号、profile.create/visit.import/result.read子集、self＋本轮scopeKey/来源会话范围、授予人/审计引用、状态/version/有效期。首批owner一条，批准后7天有效、不自动续授；临时撤权演练后仅真实管理员可显式恢复同一未到期许可，身份/对象能力边界和原到期时间不变，CAS及审计递增；实际可写对象为“本轮建档/独立合成准备登记集合 ∩ self ∩ 当前Study”。对象ID由本轮真实receipt产生并固定，不以相同createdBy覆盖全部历史记录。admin沿原生业务权限，本轮验收写集合仍由具名清单限定。许可不向其他Study、知识库、通用工具或普通角色扩散。
- rh_ai.research_data_imports：本人session、来源预检ID/version/hash及固定upload refs、目标Study/group/project/有效Protocol/政策/Form版本、映射/范围快照与hash、当前许可引用、request key、计划/已提交/失效/取消状态、CAS、真实Subject/Visit/Response版本回执。目标/来源/映射不得覆盖；变更新计划。提交后的回执不可改写，未知结果仅查原key。

两表FORCE RLS/当前父链检查/精确版本；应用角色仅必要SELECT/INSERT/UPDATE，无DELETE/TRUNCATE/CREATE，许可表仅当前真实管理员可写。普通账号只读自己的许可/来源和结果，管理员不因此读别人私有会话/原件。详细约束和本机数量在授权清单；不复制Subject/Visit/CRF或另建通用IAM。

## 服务端契约

候选接口均在本人`/sessions/:sessionId`下，尚未装配：GET research-data-import-targets；POST/GET research-data-imports；GET research-data-imports/:id；POST research-data-imports/:id/confirmations；GET research-data-imports/receipts/:requestKey。客户端只传目标ID、来源ID/version、映射修改及确认计划ID/version/hash，不传角色/路径/SQL/许可事实。

准备：读取可信source与目标→原件全SHA重验→原生预检/当前权限→固定不可变计划。确认：同一租户授权事务内锁计划与幂等键→重验源/目标/许可/Protocol/同意/访视/表单/数据版本→整批写原生业务对象/审计/回执。中间失败全回滚；对象存储原件保留，不用数据库回滚假装删除存储。明确错误行先解决，不静默导入一个未确认的子集。首片提交上限与原生导入有界限制核齐，超限明确拒绝，不沿P04大容量预检直接无限落库。

固定manifest逐行包含source文件/sheet/行、Subject/Enrollment/Visit/VisitPlan/Protocol真值与状态/version、Assignment/Response版本/修订引用；目标manifest hash进入确认hash，不能只固定全局Study。准备与提交分别从真实当前记录重算并比较，来源相同而答卷/访视版本变化也拒绝。

许可授予/撤回、提交、结果/回执读取共用租户授权独占锁；统一顺序为tenant授权锁→source/许可→Study/Protocol/capture锁→按ID排序的Subject/Visit/Assignment/计划/幂等锁，禁止对同对象反向锁序。撤权先完成则后续确认拒绝；导入已先持锁则撤权等待其提交后生效，不宣称能中断已持锁事务。分别验证这两种顺序；撤权后的读取重新计算当前可交付范围，历史审计/结果记录不删。

确认快照编译器仅绑定source/target/映射与版本、生成确定性hash；它不是授权器、不设ready=true，不提供提交/数据库/模型能力。每次真正提交仍必须读取当前事实。

## UI/UE验收

保留原AI01消息区预检、紧凑文件清单、上传按钮、输入区与Shell。原“尚未导入”区原位显示可导入Study名称、原生执行方案版本、被试/访视/字段摘要、将写入/拒绝范围；唯一主动作“确认导入”，不再叠同义弹窗。只有多个合格目标时选一次Study，唯一/可信上下文可预填但始终展示。已匹配映射折叠，只突出异常；改Study/映射后生成新计划，旧确认失效。成功后依据真实回执显示已导入，不再错误提示“尚未导入”；本片未接数据AI分析时仍明确分析暂不可用，不把暂存原值送文献模型。S03/S09回链必须使用现有route helper，不能只拼studyId误进演示分支。

正在提交防重复；成功基于真实receipt，直达本次被试/访视。未知保原key，“核对状态”先GET，查无结果才由用户明确重试同原key；不自动再次提交。切账号/失权清受限原值，迟到结果不串会话。14/22操作、16/28长文；共享Button及既有响应式。管理员沿同一入口操作本人材料，业务数据按原规则管理，不增加G02总览模块或重组治理页面。

## 小步计划与验收门

| 步骤 | 交付及验证 | 当前 |
| --- | --- | --- |
| I01 | 只读核实际Study/原生权限/执行v2/固定表单，生成可审授权；不改业务 | 已真实app READ ONLY核验 |
| I02 | 来源与目的地分离的确定性确认快照，错租户/改源/改映射/草稿v3及逐行manifest变化反例 | 已装配，纯/PG/真实HTTP验证 |
| I03 | 批准后两表/限定DML、owner单Study许可与回执；真实app隔离/撤权/旧表定义零变化 | 已启用；并发两序/恢复同期限通过 |
| I04 | 原生授权依赖最小适配，默认旧403保持，P05只在当前许可/父链内通过 | 两处适配、native typecheck/拒绝验证通过 |
| I05 | 建档批次原子提交/回执，重复并发唯一，S03本次对象回链 | 双账号4Subject，丢响应恢复/S03通过 |
| I06 | 具名合成准备后，固定CRF/访视导入、原版本/同意重验及整批回滚 | 独立4入组/访视、4CRF；0/false/hash一致 |
| I07 | 原AI01一次确认及刷新/取消/未知/切Study/身份迟到；S03/S09同对象，双账号真实Chrome/截图WebM | 5受控场景、真实双账号/28HTTP/13视图通过 |
| I08 | 一次独立总评审，作者集中RED→GREEN；四层证据/产品/使用/版本/Notion同步 | 独审2Important均修补、最终实测及文档/Notion同步完成；专业签收独立保留 |

授权后预计2～3个工作日，含真实浏览器与独评修补；若原生事务点发现额外改动，先列差异，不能以验收日期为由绕权限或假入库。不启动共享底座、正式采集、审批、锁库、发布、导出、云或真实数据迁移。
