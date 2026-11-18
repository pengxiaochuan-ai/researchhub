# WP08首切片：真实方法报告→本人科研资产候选与复用准备

版本V0.2实施状态，2026-10-26，**规格、八步计划及A01–A04已批准实施，V01–V08本机技术交接；唯一原代码评审后的三Important作者一次修补已复验，18份文档/章节Notion已回读，AC10待用户**。324纯测试/1054原内核、实际PG及Chrome整链28组、读失败14组、细分授权10组通过，原With fixes保留、M-1轻微提示延后；见[实测](../testing/crf-method-assets-2026-10-26.md)。仅本机原两账号/当前Study/本人新候选及本轮具名新夹具，前序数据和报告只读；0新增付费调用。下文“待批准/本轮仅文档”描述原编制阶段，不再作为当前停点；具体启用/验证以实施台账为准。本片不是完整WP08、主验收A0全部完成或生产交付。

关联：[授权](../planning/crf-method-assets-2026-10-26/authorization-scope.md)、[计划](../planning/crf-method-assets-2026-10-26/implementation-plan.md)、[复用核对](../planning/crf-method-assets-2026-10-26/findings.md)、[前序WP07](synthetic-crf-methods-spec-2026-10-25.md)、[旧资产候选](synthetic-asset-slice-2026-10-22.md)、[一期范围/倒排](../planning/phase1-review-2026-10-19/reverse-schedule.md)。WP07技术交接与用户专业AC10待验状态保留。

## 1. 目标、选择与不做

用户能将本人已保存、当前有效的真实CRF方法报告固定成资产候选，分清“原运行的历史证据”“可参考的软件配方”“仍需专业确认的条件”，修订本人说明、查看历史、派生本人新候选。**复用准备不是已应用到新研究；派生资产也不是新Study、方案或执行结果。** 管理员同样只处理本人对象。

已选推荐A：新增窄来源适配与独立marker，复用原Artifact/Version/Source/Audit及A01/A02母版。未选B：让旧seed资产服务同时解释两套不兼容报告，会扩大旧路径回归；未选C：直接建设正式资产审批/共享/跨Study应用，超出当前最小范围和授权。没有新增重大技术选型/新ADR。

本片只做：S06报告版本封装→A01本人列表→A02只读来源/复用条件→说明修订/历史→本人派生→返回固定报告版本。默认0模型调用、0新Worker执行（业务封装本身）；A04测试夹具可明确调用既有本机确定性Worker，不新增算法。

不做：正式Asset/ArtifactTemplate、研究/方案自动创建或预填、跨Study/跨账号应用、共享/审批/锁库/发布/删除/导出、DOCX/PDF、新联网/模型工具/推荐打分/自动方法学认可。上述一期范围不自动移二期；完整治理/导出/第二研究复用和其余AI仍在11/04与11/06全量复估中。

## 2. 环境、主体与复用门槛

仅wp01_test_full_baseline、本机19501–19507、原owner/admin两合成账号及当前合成tenant/group/project。既有WP07包/run/report作为来源只读；新候选及新反例夹具归本轮。不得接临床库、历史患者资料、旧服务、云或远端运行配置；不恢复WP01 T03–T24。

复用现有React18/Vite/公共Shell及NestJS/Prisma/PostgreSQL、原ResearchArtifactsService内部同事务创建与createVersion、原授权/知识来源锁与方法父链。**不修改app/旧源码、Schema/Client/RLS/Role/Feature/Skill/Assignment/Agent/Worker，不装配新的后台任务或资产目录平台。** 仅本机既有装配的窄hook/controller/白名单可改，当前目录串行；不自动建分支/worktree、提交推送或清理别的任务。

实施V01前三小时核对实际原授权、报告schema/原生Sources/hash与来源仍current；最多占首4小时门槛。不能用普通GET跨事务拼写入，不能调用旧资产工厂来“补授权”。若无法不改旧源码而提供同事务读取、原Source类型不兼容或需新增权限/算法/表，停止写入并给最小差异，不自动扩底座。

## 3. 复用路径与必要窄改动

| 层 | 现有能力 | 本片落点 |
| --- | --- | --- |
| 方法报告 | local-crf-methods-reports的read/create/save/live及私有loadReport；新rh-synthetic-crf-method-report.v1，无旧seed/dataset | 只增加inReport同事务读取出口，复用完整当前授权/父链/facts/nativeSource验证；原四方法语义不改 |
| 事务作用域 | plans.withScope及methods.inRun/withRun/authorized | 同一tx内验本人和当前R01/R03，报告含实际AI再验R02；不从URL/缓存继承授权 |
| 产物持久化 | ResearchArtifact/Version/Source/Audit、createWithSourcesInTx/createVersion、canonicalArtifactJson | 新research_report/draft＋新marker/prefix；直接使用同tx实例；原报告/run/父方案完全不写 |
| 旧资产 | synthetic-asset-contract/local-synthetic-assets有说明/历史/血缘概念，但依赖facts.run与simulation.dataset | 可借用无schema耦合的纯notes/lineage约束，不直接套buildAssetSnapshot；旧marker/接口/初始化不改 |
| UI | 原A01/A02候选母版、Card/Button/Markdown、single-flight/identity fence | 同页面新显式分支和局部组件，不另画Shell；新来源回S06，不指向Q01旧synthetic-trials |

新增候选adapter/contract/session与局部UI；必要共享改动限定装配、精确路由、32KiB守门、S06报告入口/回链及真实身份/集中页头。不得以本片为由统一所有旧资产schema或重构已有大组件。

## 4. 候选快照与复用配方

固定marker/schema `rh-crf-method-asset.v1`、幂等命名空间`rh-crf-method-asset-20261026:`、原产物typeKey `research_report`/status `draft`。新contentBlock唯一一个，含type/ownerAccountId/planId/collectionId/runId/reportId、snapshot/snapshotHash、lineage、notes、成功operations、seal。全部服务端派生，不接受客户端facts/owner/status/source。

snapshot分两区：

1. `report`：id、versionNo、versionId、contentHash、factsHash、contentMd；`historicalFacts`：原报告facts完整只读，明确只证明原运行。保留实际CRF版、答案修订元数据、原PICO/配置/资料、DQ、method/input/manifest/result、coverage和原实际AI选择状态。**不复制原答卷值/更正原因；报告历史汇总数值不得作为新研究结果。** 原报告本就不含原答卷；发现不符即拒绝，不做静默脱敏后假称同一报告。
2. `reuseRecipe`：固定来源版本/资料定位，原CRF与访视配置、显式人工范围（仅供重新核对）、executor/worker/adapter及coverage、确定性执行步骤、`mustReconfirm`清单。字段白名单排除records、answers、recordVersions、syntheticSubjectKey、result/数值结果、旧simulation.dataset/seed；不得把历史记录包伪装可执行模板。

`mustReconfirm`至少含：目标问题/PICO与材料授权、人群/入排标准、访视时点与单位/缺失语义、人工范围及方法适用性、目标数据与新DQ、正式治理。用“待重新确认/未检查”，不输出兼容分/已可正式复用/疗效判断。本人notes最多6000字符，提示填写用途、适用条件、待核对参数；它不是机器事实、AI新输出或专业签认。

### 4.1 reuseRecipe闭合白名单（V01契约依据）

服务端从已验证facts显式逐字段投影，不能spread整个facts/config/result后删几个禁用键；投影完成后对每层额外字段拒绝。以下以外的字段只可留在原历史证据，不能进入recipe。原报告完整性仍按原服务校验，不因历史facts合法含result/recordVersions而拒绝整份报告。

| 路径 | 允许值/类型及来源 |
| --- | --- |
| schema | 固定字符串`rh-crf-method-reuse-recipe.v1` |
| source | 仅reportId、versionNo、versionId、factsHash、materials；前四来自根报告真实版，ID/string、正整数1–30、ID/string、64位hex |
| source.materials[] | 仅docId/kbId/chunkId/docTitle/contentHash/chunkHash（字符串，hash为64位hex）、version（原正整数）；逐项来自原facts.sources，顺序/上限继承WP07；不复制任意附加字段 |
| config | 仅label、outcomes、visits、form、mappings、missingStates，来自已normalizePreparationConfig验证的原facts.config；不含config.notes |
| config.outcomes[] | 仅key/label/definition/unit（原字符串及原长度规则） |
| config.visits[] | 仅key/name（字符串）、order（原1–4整数）、targetDayOffset/windowBeforeDays/windowAfterDays（原范围整数或显式null）；null保留“未定义”，不改为0 |
| config.form | 仅key/name及schema；schema仅schemaVersion=`form-schema.v1`、fields数组；field仅key/label/type与原可选required/min/max/options，选项仅原字符串或value/label对象；沿原类型/数量/范围规则，不含default/answer/测得值 |
| config.mappings[] / missingStates | mappings仅outcomeKey/fieldKey/visitKeys/unit；missingStates固定原三项，均沿原normalize规则/顺序，不增加答案或记录定位 |
| method | 仅executor/workerVersion/adapterVersion字符串，取原facts.method，不含runId/inputHash/resultHash/manifest或数值输出 |
| coverage | 仅scope/included/notExamined/rangeRule，取已验证原coverage；字符串/字符串数组，原固定值与顺序；标为“原方法覆盖范围”，不自动声称新研究覆盖 |
| steps | 固定顺序字符串数组：reconfirm_context、prepare_new_data、run_new_quality、execute_new_method、review_new_report；仅待执行说明，不能触发任务 |
| mustReconfirm | 固定顺序字符串数组：question_and_material_rights、population_and_eligibility、visits_units_and_missingness、manual_ranges_and_method、new_data_and_quality、formal_governance；界面对应上述六组待确认项 |

未声明可选的键均必填；仅原field.required/min/max/options可按原规则缺省，访视三个时间字段允许显式null。任何其他undefined/null/NaN/空必填ID/hash拒绝；文本允许空的情况仅继承原definition/unit等已声明规则。V01建立一个完整golden JSON及每层unknown-key/嵌套答案注入反例，不能以仅查找`answers/result`字符串证明白名单安全。

Sources沿用原报告的原生来源，再加根报告真实Version的data_snapshot；派生加精确父候选Version的data_snapshot，保留每级id/version/contentHash。按原canonical helper生成descriptor/snapshot并重验原sourceSnapshotHash及逐源hash，不修改旧hash策略。snapshotHash独立于notes；说明只追加本候选Version，不改snapshot、来源、父候选、报告或run。历史读取必须验证同一快照/渲染正文/实际Source及当前权限，不能凭自带seal证明来源当前有效。

容量：每账号本轮最多100份（含派生），每份最多30版，派生最多8层（根深度0，深度8不可再派生），列表每页1–20。snapshot≤768KiB、完整contentBlock≤1MiB、渲染Markdown≤512KiB；按UTF-8实际字节拒绝超限，不静默截断来源。POST原始body≤32KiB。来源/组/配置继续继承WP07上限，不扩大原报告能力。

## 5. 当前授权、状态与原子提交

新增本片目的scope须用户另批，原R01–R03、旧资产授权或管理员身份不自动覆盖；A01–A04见清单。既有角色还须满足原artifact.read/create/edit、Study/菜单/会话/Agent/Skill/资料授权，缺失即停，不能初始化补齐。

新候选写链：plans.withScope原共同授权/知识事务→核对本片scope/精确来源归属→精确本人父方案行FOR SHARE→记录包行FOR SHARE→根run行FOR UPDATE→根报告行FOR SHARE→methods.inRun＋reports.inReport锁后重读→必要本人父候选行FOR UPDATE/祖先校验→键/CAS/容量→原Artifact/Version/Sources/Audit＋请求回执同tx提交→交付前再核对。只加锁不改源行；同tx报告读取不能代替方案/记录包当前head的写入互斥。锁顺序统一；每条祖先必须同owner/tenant/group/project/根报告/plan/collection/run/snapshotHash，不允许跨根拼接。

跨根100份容量和跨动作requestKey互斥依赖**原有**plans.withScope→withCurrentKnowledgeRead→withAuthorizationMutation→lockAuthorizationMutation：先official、后tenant的事务级排他pg_advisory_xact_lock，持有至同tx提交/回滚。同tenant不同来源写入也因此串行；不得把withScope替换成普通事务、放到锁外统计容量/查回执，或另建新锁平台。V03必须用同账号不同根的独立连接证明容量和同键异动作拒绝；若目标原链未持锁即停线，不修改旧实现补底座。

两个独立连接验证：源更正/换版先提交时候选必须重读拒绝409；候选先锁定来源时源写入等待候选提交，随后变更使其下一读取stale，不宣称永远current。Source/权限沿原知识授权锁，提交尾再核scope/当前绑定；不增加跨实例平台协议或改旧写服务。

`reports.inReport(tx,user,planId,collectionId,runId,reportId,versionNo?)`拟返回`{report,reportVersionId,nativeSources,run}`。内部沿methods.inRun及原loadReport；report为原公开view，不跳过R03、真实绑定、冻结事实、AI和原生Sources校验。只能消费外层已授权同一tx，不调用read/另开tx，不信任客户端或未校验contentBlocks；原父restricted时不得返回内容。GET列表/详情/历史也在原授权tx内逐对象重验，current始终对当前head。

| sourceStatus | 判定 | 交付/动作 |
| --- | --- | --- |
| current | 根报告固定版本仍是head且当前，方法/数据/DQ/资料/所选AI有效；每个祖先head仍等于固定父版 | 可读；当前候选head可修订/派生 |
| stale | 来源仍有权但报告换版（即使只改说明）、数据/DQ/方案/原AI变化或任一祖先换版 | 固定历史只读，可定位原版本；不可新建/修订/派生，不自动重绑或因改回内容复活 |
| restricted | 本片或原读授权、KB审核/访问、真实父/来源不再可交付 | 清正文/数值/快照/配方/notes/来源；API403或最小restricted投影；无错误兜底回旧资产/示例 |

候选历史版始终readOnly；是否stale按当前根/祖先head判，不用历史自证current。R02只影响实际附AI报告，未选AI的根报告不因此被误禁。无AI保持not_requested/pending/failed/not_selected/stale/unavailable原状态，不能标“已AI完善”。工具未重跑、数值未重算，页面明确说明。

## 6. 幂等、说明与派生

创建：每account/根reportId/报告version只有一个初始候选，两个连接不同requestKey也不重复。请求回执沿AuditLog新action命名空间，绑定actor/路径/全部精确body摘要，跨操作或异输入同键409。根候选幂等键固定reportId/version，creationRequestHash不含可变requestKey。原创建审计、回执、Artifact/Version/Sources同tx；失败/测试注入未命中也强制abort。

说明：baseVersionNo/CAS，notes和成功operation在新Version持久化；无变化422，不写成功回执/版本。派生：固定本人候选当前版，子候选新id/version1、notes空，父说明以明确历史保留，根snapshot不变；不新建研究或执行方法。跨根、循环、重复祖先、超8层或已过期拒绝。

同键重试仍验当前读权限/来源完整性；已成功且同输入只返回实际持久化operation（带原versionNo）与当前安全view，不追加Version/审计/派发。来源后来stale时可返回只读旧成功结果但不新写；restricted仍拒绝。同键不同base/notes/父对象409。容量满时已成功的合法重试不因“新建容量”误拒；新的创建/派生429。同一父不同新键可生成多个子候选，受100份总容量约束。

## 7. 接口与路由（已按批准仅本机启用，非生产发布）

原同源Cookie、Study scope、guards、`{code,message,fieldKey?}`错误形状不变。仅开放以下精确白名单：

| 方法/路径（省略/api） | 精确输入 | 输出 |
| --- | --- | --- |
| POST `/research-plan-drafts/:p/synthetic-collections/:c/method-runs/:r/report-drafts/:reportId/asset-drafts` | baseReportVersionNo（1–30）,requestKey | `{asset,operation:{id,assetId,versionNo}}` |
| GET `/crf-method-asset-drafts?limit=1..20[&before=id]` | limit默认20，before须本人本片游标 | `{items,nextCursor}`，摘要逐条验源，非全量正文 |
| GET `/crf-method-asset-drafts/:id` | 无业务query | 本人当前候选view |
| GET `/crf-method-asset-drafts/:id/versions/:no` | no=1–30，无query | 固定历史view/当前sourceStatus/readOnly |
| POST `/crf-method-asset-drafts/:id/notes` | baseVersionNo（1–30）,notes,requestKey | `{asset,operation}` |
| POST `/crf-method-asset-drafts/:id/derivations` | baseVersionNo（1–30）,requestKey | `{asset:child,operation}` |

ID为1–160字符`[A-Za-z0-9_-]`，requestKey为8–128同字符集；严格未知键/重复query/非整数/原始32KiB超限400，未登录401，无权/伪造父403，本人下不存在版本404，版本/来源/同键冲突409，无变化422，容量429，服务不可用503。完整性损坏显式冲突/受限，不用空列表或500泄露栈。GET未知资源不枚举他人存在性。

view至少含id/title/status=draft/typeKey/version/currentVersion/readOnly/sourceStatus/canEdit/canDerive、rootReference、contentMd/notes/snapshotHash、reuseRecipe、lineage、sourceRows、versions（至多30）；restricted仅最小状态/说明。list排序createdAt/id倒序、limit+1查询，before先核归属，不混旧候选族。

A01/A02新显式`crfMethodAssets=1`，带studyGroupId/researchProjectId；A02另含crfMethodAssetId、可选crfMethodAssetVersion。任一新族标识出现均交新解析，缺/错flag不回demo；与旧assetDrafts/assetDraftId/assetId/projectId混用拒绝。旧默认族不改。

S06回链保留原crfMethods/Study/plan/collection/run，新增成对methodReportId/methodReportVersion（1–30）精确选择固定报告；需要runId，不和compareRunId混用。未知报告/版本显示错误，不能选最新代替。report组件仅首次显式选择一次；轮询不自动切报告，dirty离开/切历史须确认。页头/真实身份由集中适配，不复制Shell或套演示身份。

## 8. UI/UE实施与验收

母版：原S06报告Card与现行A01/A02候选工作台；公共Shell/Card/Button/Markdown及项目UI/UE V1.1，1440×900主视口。不改变Frozen尺寸、导航/Token，不设计新主题或远程字体。科研人员/管理员均本人权限；本片无新治理后台，相关后台验证为原鉴权/审计/API，不因管理员角色扩大可见性。

- S06在已读取报告区提供“形成我的方法资产候选”，标明报告vN、私有草稿；报告历史/过期/dirty/busy/失权禁用且旁边解释。响应丢失保留同键，不自动重发；不能用未保存notes封装。
- A01标明“本人方法资产候选”，空态可返回当前S06；分页只手动刷新，不被详情轮询重置。新列表与旧族互相可返回但不混查/错投影；合法Study上下文不丢。
- A02依次呈现来源状态→复用配方/待确认条件→原历史报告→说明/历史/派生。默认业务摘要可读，长hash放可展开核对区域；重要限制和主数值不隐藏。机器事实只读，本人说明单独编辑；历史只读、派生后新说明空白，不能称“已应用到新研究”。
- 操作/输入/主要表格14/22，连续报告/说明阅读16/28、48rem，辅助13/20、低优先元信息12/18。单h1，Card/内嵌报告标题语义逐级，不让旧Markdown变h5；显示映射不改存储/hash。
- single-flight处理超过5秒读取；目标/身份/权限变化同时失效请求并释放loading/busy/reading/ref，迟到200不复活正文，恢复权限可显式重读。409保留notes和原CAS基准，只有确认放弃才重读；错误聚焦、成功不抢焦点；beforeunload/页内返回防丢工作。
- 不开放分享/审批/下载/导出/自动采纳按钮；不出现“AI重新生成配方”的假入口；已有AI解释准确标来源和原消息，不追加模型调用。关联S06旧“待接入”说明在实际新入口触及处同步准确，不全站清文案。
- 真实Chrome两账号完整链、键盘Tab/Enter/Space、长标题/失败恢复、1440/1366/1920/390/320及原生200%分别记录；宽表只表内横滚，不缩字/裁操作，PNG/WebM与computed字号必留。专业阅读舒适度由用户确认，不以构建或断言数代签。

## 9. 验收标准与证据

| 编号 | 必须满足 | 验证/计划 |
| --- | --- | --- |
| AC01 | 新schema真实报告来源，旧seed/dataset/错父/客户端facts不得混入 | golden与来源桥，V01–V02 |
| AC02 | 原两账号/当前Study/本人目的；R01/R03及选AI时R02当前重验 | 实际拒绝/新scope与原服务隔离夹具，V02/V07 |
| AC03 | 独立连接同report版只有一个根候选，幂等/异输入冲突，Artifact/Version/Sources/Audit/回执全原子 | 实际PG命中/未命中故障回滚，V03/V07 |
| AC04 | 配方无原答案/记录定位/历史结果；历史证据有真数值/coverage；无AI状态真实，不称新AI | 纯契约＋实际两账号原已生成报告读取，V01/V06/V07 |
| AC05 | notes CAS/无变化422/历史只读，根snapshot不变；派生固定父版、notes空、8层与100/30容量 | 纯函数＋PG并发/版本/原子，V04 |
| AC06 | 根报告/数据/DQ/来源/祖先变化正确stale/restricted；改回不复活，无旁路读取 | 仅A04新具名夹具/隔离scope反例，V02/V04/V07 |
| AC07 | S06→A01/A02→固定报告vN完整往返；未知/混合路由拒绝不回示例 | API/真实Chrome两账号，V05–V07 |
| AC08 | dirty/慢读失权恢复/迟到/分页/键盘/五视口/原生200%和字体真实通过 | 功能UI/PNG/WebM，V05–V07 |
| AC09 | 原旧源/角色/Schema/旧8进程/全部历史保护、账本不变；独立代码总评审和产品/专项/Notion同步完成 | V01基线、V07门禁、V08作者修补关闭证据 |
| AC10 | 用户用未预运行合成说明核对：能辨清可复用项、必须重确认项和历史结果，能说明为何不能直接用于新研究 | 用户专业验收，不由技术测试/文档评审代签 |

代码/本机启用/实际请求/用户效果四层及当前证据见专项实测；AC01–AC08技术验证、AC09原评审/作者修补及保全已具证，文档/Notion以交接收据为准，AC10未签。实际AI引用沿原已生成解释，不能以封装成功补称新[1]文献正文、联网或完整AI能力已验。不得重放付费旧harness。

V08校验补充：前端读验证health不是新的服务端sourceStatus；读失败暂禁写，完整性错误隐藏不可信报告/配方/来源，网络失败标上次读；dirty notes/CAS/key保留，成功重验只清对应读错误。独立探针须绑定实际候选ID和请求中的当前/历史版，不以A01列表代替A02或非首项根；目标/身份失效让迟到200不能复活。合法字符串/对象/混合select选项均显式呈现，不更改原配置契约。M-1空历史选择器提示延后，不放宽A02。

## 10. 工期、风险与确认入口

24小时实施/验证/文档＋8小时缓冲，3天＋1天，不追加能力。V01–V08小时分别3/3/4/3/3/3/3/2。第1天V01＋V02＋V03前2h；第2天V03余2h＋V04＋V05；第3天V06＋V07＋V08；第4天最多8h修补。当前文档编制已先做，不另叠一轮同样设计工时；实施V01仍需实际环境准入复核，等待授权/专业反馈单列。

首4h复用不成立或预计超32h即停下，说明差异/替代/日期影响，不擅砍验源/测试/专业验收或扩底座。若10/27获批且输入及时，建议10/27–29实施、10/30缓冲；这是建议窗口非承诺。11/04主链预演和全量缺口、11/06二次复估、11/09–13冻结/专业回归及获准交付准备不变；完整WP08共享/导出/目标研究、正式EDC/联网与其余AI不得自动销项或延后。

请用户一并确认：①本规格/八步计划；②A01创建读取、A02说明历史、A03本人派生、A04仅新合成反例夹具。原角色不改、不授跨Study/审批/导出。收费调用另批，本片默认0次；原累计5元和前轮4次已用完不构成本片续调用许可。仅“同意写文档”或文档审查通过不是上述实施批准。
