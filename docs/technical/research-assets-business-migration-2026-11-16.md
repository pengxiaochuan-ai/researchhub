# C1 business族数据库变更核定稿

## AQ02追加迁移（已批准、本机专用合成库）

新增rh_asset.ai_use_consent_event，13精确SQL，SHA256 d792904471fc057d799ba72df622b1f98dd4a6f3d55ddfe76027994c7f9503c4。仅本表SELECT/INSERT，无旧表/函数替换或角色调整。旧business定义a5b359565bf30a54b949751d4ff9eda453dfe746eb7adbe7a4cd7d7226605834保持；新增后38b9756e0330b538cea6426a3b1910023e612159faa919945e4d5820093beb91通过明确新回执和全定义hash核验，不重设旧基线。公开/其他Study未启用。

先运行research-assets-report-ai-schema-run.mjs --rollback-only实际aisci_app全链回滚；预测通过才允许--apply。再次执行发现表已存在会停，不自动重放迁移。read-only核查原42、新1许可与审计、最小ACL、RLS与双连接锁；启动不迁移。原5ef候选因事务开始时间校验被拒绝，失败已回滚，最终仅改statement_timestamp时间基准。首次许可7天，最多3具名事件；本轮仅1条持久grant。见[交接与回执](../planning/research-assets-agent-qa-2026-11-16/aq02-delivery-2026-11-17.md)。


状态：2026-11-17首批8份各2版/48成功事件已实跑，私有未发布。接收人精确DDL已在最终CHECK回滚验证及独立核验后应用；原14函数/100约束/6policy/12trigger，当前18/100/14/12，旧35与5来源保护通过。C1第三普通成员、五类及用途仍待完成：代码已补但未重载，账号PG预测被席位14/已有19拦截并回滚，新账号/角色/成员0。仅用`wp01_test_full_baseline`，不碰临床库/旧服务/public定义/既有角色；合成席位14→20另待确认。

## 识别与兼容

新业务assetId为`rhab-`＋UUIDv4，真实父artifact.id相同，idempotencyKey为`rh-research-asset:business:v1:`＋该assetId。新族识别同时核tenant/group/project/owner/createdBy/type/status/currentVersion，不能凭请求family标签；旧27的ID不符合新模式，不能通过改key冒充business。不新增family字段回填历史，不改原内容或policyHash。

复用原ResearchArtifact/Version容器、registry/policy/events及当前角色；原catalog/detail/report_context族保持各自校验。新`business-registration.mjs`依赖调用者持既有授权锁的withAccess；`business-local-catalog.mjs`仅在原本机装配工厂接入，不改共享启动文件。正常授权不绑定邮箱/具名Study；本机两账号、A/B、8份/2版/48事件在独立local适配守门，不赋予新角色/成员许可。

## 必须保留的定义

- `scope_matches()`及原6条`scope_rows`policy原样保留；不能泛化其账号/Study表达式。新business policy与旧policy为OR时，必须包含真实business父对象识别，不能扩大旧记录可见性。
- `check_policy_parent()`、`check_event_sequence()`保留真实父Version、内容/政策封存hash、连续revision、当前actor及原报告单例特判；不删除错误分支。
- 全部外键/deferrable提交约束、幂等唯一键、hash与内容大小、状态关联、`reject_change()`保持。现无“每人每类型唯一”DB约束，不重复或误删唯一键。
- 原`recipients_valid()`、detail槽位/附件/评论/复用函数不直接改成通用；后续需明确business分支，不能冒充旧detail族。

## 拟定变更对象及验收

| 对象 | 精确规则 |
| --- | --- |
| 新`business_parent_matches`类helper | 从public真实父artifact核新ID/key及完整父链；不回查registry自身，避免RLS递归；SECURITY INVOKER、固定search_path |
| 新`business_scope_matches`类helper | 核当前GUC、active账号/租户/Study/authVersion、原Study成员/菜单及动作权限；管理员仍须有效父对象，不建成员 |
| registry project/group/owner CHECK | 保留原表达式；仅新business父链分支允许本租户其他已授权父研究及真实owner，旧报告单例限制不变 |
| `check_registry_parent()` | 增加明确business分支，保持完整父链/CAS/不可换父/非拥有者只增被允许revision/原管理员操作限制；旧分支不删 |
| 新六表business RLS | 必须“新business父对象＋当前scope授权”，按各表实际读写动作核权限；不能只增加通用scope policy |
| registry revision/working_version、policy version、event asset_revision CHECK | 原族8/24及报告2/12保持；仅business使用正PG整数边界。登记内容大小、HTTP单页与事件输出大小仍有界；当前汇总/历史先核完整授权元数据集合再分页，避免旧50行截断漏项。SQL聚合及历史大数据量性能仍待专项实测，不宣称已完成无限规模性能验收 |
| policy发现范围与request接收人 CHECK | 新business接收人须同租户、当前Study可读/已有动作权限；批准用途不超申请及原权利范围，不能仅验证字符串ID |
| `check_detail_access_purposes()` | 正常business用途仍须当前许可/审核/来源，不沿“非detail只有read_body/cite”的旧限制假称已支持全部；在C1相关动作启用前单独测试 |
| 评论/附件/复用事实 | `check_detail_fact`/`check_registry_event`和原slot函数限制保留，后续按明确business分支与实际文件/目标版本增加；C1登记成功不代表全部周边已泛化 |

候选helper名称以最终SQL冻结为准。先准备精确SQL与旧定义指纹，评审/预测后显式执行；不在服务启动时迁移，不从新key推断缺失数据或权利。

本次已冻结`business_parent_matches`、`business_object_matches`、`business_scope_matches`；owner状态不参与资产身份分类，当前操作者仍须active。实际落地仅登记基础7项CHECK、parent业务分支、registry/policy/event的精确读写及request只读policy；旧scope_matches及原policy/trigger保持。评论/复用/附件和请求写入的业务适配尚未启用，不把本次基础迁移当全表能力已泛化。

## 执行与保护

1. 固定实际beforeFingerprint，不重设既有baseline；每次比对当前DB定义与预期，不匹配停止。
2. 先SAVEPOINT/事务回滚预测新business、伪造旧族、错tenant/parent/authVersion、普通权限/管理员、重复提交/CAS等；确认旧定义和旧行恢复。
3. 首批8份草稿范围已获确认；其余新来源/具名夹具按具体清单确认后再实际写入。DDL执行不得借此修改旧数据/public/角色。
4. 原27/54/131/6/9/10按旧主键逐行hash对照；新增事实另计。继续扩充原B草稿、原报告、文件/来源/角色和账本/启动文件保护后才进入有状态阶段，不能只保护registry。
5. 应用后真实app角色测试与原两账号浏览器验证，旧接口不回退演示；发现问题停在当前任务，不清旧事实或绕过门禁。

## T04接口与兼容规则

- 沿原HTTP路径；新`rhab-UUIDv4`实际对象进入business服务，旧ID继续原族服务。创建和修订幂等哈希绑定business族、当前账号/真实Study/对象及输入；同key异内容拒绝，不得用旧族回执代替新创建。
- `GET /research-assets/registrable-sources`返回新`rh-asset-registration-options.v2`、`family=business`、真实ownAssets及admission；同类可有多份。编辑时允许唯一`assetId`查询提示，实际读写仍重验父对象/授权；旧对象继续v1来源/上传与修订能力，不能被新族的来源未启用状态覆盖。
- 新编辑DTO为`rh-asset-registration-draft.v2`；原v1不接收伪造business族。请求与恢复标记按严格ID使用PG整数边界，旧版本上限保持。字段不足/来源不明拒绝，不回填或生成正文。
- A01按完整授权结果统一分页；新族读列表为`rh-research-asset-catalog.v2`，旧列表v1仍保留26上限校验。全局统计按真实对象而非版本计数。新对象与旧对象的当前授权revision保持一致，防止原预览错误识别失权。
- 本机新业务对象只启用手工合成方案，最多每账号每Study2份、每份2版/6成功事件，合计8份/48事件；回收不释放新建槽位，提交/回收保留后续审核/恢复事件。共享、发布、AI调用及未核定的文件/知识来源不开放；界面沿原可用/不可用反馈，不展示研发说明。
- 新事实审计默认不是synthetic，专用合成执行显式标syntheticOnly=true；调用方payload不能覆盖此标志。保护核对仅排除新business集合，旧行hash与原5来源基线不重设，新事实另计。

早先服务预测证据：`business-service-prediction.json`。当时完整草稿链整体回滚、持久新增0；当前真实执行以`browser-c1/result.json`与`business-current-auth-readonly.json`为准，新增8份/16版/48事件。首批额度已满，不自动追加或修改旧对象。

## 实际运行与当前授权适配

P2来源准入更新：原admin主例报告542原生同事务验证被ANALYSIS_BASIS_STALE拦截；CRF已更正，不能仅以released/hash元数据作为新资产依据。已备通用report-source校验（父链/本人/analysis_report/固定正文/Study-snapshot-run，客户端仅说明），10新旧纯测试通过；未接新端点、未写DDL/源/资产。当前已核更正后adc来源有效但已注册，不改旧41；c2-source-refresh-admission.md增1来源报告/3原生操作待用户确认，不重跑方法或放宽旧T17守门。

当前最新：首份修正已实跑v3/revision14/withdrawn，总6份/13版/44事件。复用usage只新增loadRecords/beforeCommit/auditOptions注入，旧默认保持；local精确限定同文v3与7个后续动作，不增DDL。真实PG逐请求边界验证后总回滚，再8次原页POST通过。旧35、其他5、首份旧6回执和v1/v2政策、账本保护通过；授权旧27产品服务仍保留，本轮未写。388针对性回归/5.27秒构建及本轮独立核验通过，不是整个C1–C8总评。共享入口c12a与原067c散列差异仍外部核来源，不重设基线或称全部文件门禁通过。下一来源清单c2-report-source-admission.md待确认。

最新覆盖下段席位停点：14→20与新账号/角色已获批同事务完成；真实SMTP/原页接受邀请、普通成员A范围、五类6份/12版/36事件实跑通过，385免费测试、5.03秒构建。新代码已受控重载。用途链尚未执行，首份固定发现上限遗漏owner，需另批v3/44事件修正，不改写封存版。旧35与其他5新资产各有独立保护快照；首份原v1/v2保留，不重置原baseline。

2026-11-17下一批更新：用户已批准第三普通成员/五类及用途验证最小范围。接收人CHECK的旧OR旁路已修正为business前缀选择失败封闭CASE、helper证明严格ID/key/完整父链；真实安装表达式下helper拒绝不能回退旧规则，legacy保持。单条独立复核核销后应用到专用库：当前18函数/100约束/14policy/12trigger，回执business-recipients-applied.json接续原c73指纹，不重设原基线。旧35只读保护通过。账号创建预测被席位14/已用19拒绝，新账号/角色/成员仍0；14→20另待确认，第三身份代码未重载或验收。

B交易使用既有createAssetTargetPrisma，不放宽共享启动文件。仅资产指定读/登记/修订/私有审核/回收路由以assetHttpScopedUser保留JWT身份并解析显式范围；服务持既有锁重验当前tenant/account/authVersion、真实父链、菜单/动作及成员。租户管理员不用假ProjectMember。release/用途写/upload/AI等不借此绕过旧守卫。跨族identityRevision一致，旧族仍走原服务。

新接收人候选DDL只解决version_policy CHECK，不代替用途申请actor CHECK、用途guard等其他必要业务分支；启用前须逐项预测与评审。第三普通成员需独立local清单和最小角色，不把测试数量写入正常业务上限。受保护旧27及5来源、原角色/成员/账本/共享入口保持。

[总规格](../product/research-assets-completion-spec-2026-11-16.md) · [小步计划](../planning/research-assets-completion-2026-11-16/implementation-plan.md)。
## 2026-11-17 · C2来源接线覆盖

本批无DDL，新增原生报告来源服务复用business登记/旧T17同事务当前依据核对。GET `/research-assets/report-sources/:id?studyId=…`及POST `/registrations`、`/revisions`，唯一查询为studyId，浏览器仅提交说明，不提交科学正文或来源事实。旧report-context端点保持；C2源专用Study只读进入A01，不进入普通上传候选。源行/来源键锁、既有绑定和请求hash/CAS防重，回执恢复绑定原操作、版号、revision和真实来源。只完成本机具名链，不是全量通用来源开放。

3原生来源操作、1资产/2版/6事件及独立修补验证已通过；原41、来源/角色/账本与DDL保护通过，外部共享入口来源门禁仍单列。具体边界、超时决定和未覆盖并发竞争见[技术交接](../planning/research-assets-completion-2026-11-16/c2-delivery-2026-11-17.md)。本节覆盖下文历史待确认状态。

