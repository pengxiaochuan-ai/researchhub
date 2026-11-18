# A01 科研资产中心整页实施规格

## 2026-11-16 · 页头去重与原交互状态精修

用户要求去掉重复“科研资产”并继续局部UI/UE完善。只省略A01单层且与H1同名的面包屑行及占位，保留H1、左侧导航、A02/多层返回。研究筛选仅加载/未登录禁用，错误保留换范围恢复；原页签按钮补aria-pressed，禁用按钮用本页中性Token区分。14/22、卡片/左右栏/操作路径/权限保持。[UI/UE约定与验收](research-assets-ui-polish-2026-11-16.md)。

## 2026-11-16 · 首页默认全部可访问资产（现行规则）

用户确认首页默认全部当前可访问资产，研究仅作筛选；登记归属在原弹窗选择，修订不换父研究，已有操作跟随真实父研究。H01–H04、双角色主链及附加恢复/坏响应契约本机验证和同轮独评已通过。此条覆盖下方历史“默认恢复单研究”规则；旧记录保留但不再作为裸入口产品默认。[现行规则及完整证据](research-assets-home-all-studies-2026-11-16.md)。

## 2026-11-16 · 已批准的默认研究恢复完成本机验证

无显式Study时恢复当前租户/账号上次成功核验的目录范围，先真实me再原API当前授权；URL仍优先，首次多项无历史不猜第一个，失效/清空保持原选择路径。仅IDs存储，403/503、账号隔离、存储失败和迟到回写有反例；原布局、样式、Study框与后台权限不改。18定向/133相关/12真实Chrome、构建及一次独立总评通过，未正式发布。[完整规则与证据](research-assets-last-study-2026-11-16.md)。下方AS-25的“当前上下文”由本次范围内补足，不扩全租户聚合或其他页面默认规则。

2026-11-12｜V1.0。用户针对最小增量清单回复“确认，”，批准D01、A-W01～03、F01～03、I01～04及C01～C07串行实施。不是功能交付或权限已启用。文中“拟申请/待确认”保留方案提出时语义，实际执行以上述具名确认和授权清单为准；新范围仍先停线。

当前实施（2026-11-13）：A01 C01～C07已完成本机技术收口；单次独评三Important先前已修，本轮明确授权的共享协作失败Minor、真实鼠标恢复与实时录屏均补齐。623/112、构建5.39秒和双角色真实PG/HTTP/Chrome有证；实时视频27.44/17.48秒，不拼截图。10/15/39/trash0及4文件、F03/旧10-20/角色保持，模型0，原布局14/22与350右栏不变。可交用户业务/专业体验签收，不冒称已获签收或生产发布，也不自动切A02其余页。详见本轮收口报告。

依据：[完整PRD](research-assets-prd-2026-11-12.md)、[60项清单](research-assets-feature-inventory-2026-11-12.md)、[串行基线](../planning/research-assets-product-2026-11-12/implementation-phases.md)。用户本轮要求“继续按已确认的实施计划串行推进”；顺序不变：A02最小阅读依赖→集中完成A01→A02其余功能。本规格补该计划中未批准的精确数据/接口/交互与验证用途，不再重新申请顺序或以知识库全工具为前置。

## 1. 当前核对与唯一任务

让研究者在原A01完成：找到有权资产→核对固定版本→登记/修订本人候选→提交审核→查看处理结果→按许可引用或申请使用；管理员在同一页原操作区完成具名审核、限定共享、撤回和申请处理。五主Tab、预览四Tab、推荐与趋势均纳入本页完成门槛，不能仅交列表就切A02整页。

- 本轮真实浏览器：原owner已登录，1910×1075、DPR约1.34；六统计、五主Tab、五筛选、九列表头、四预览Tab及左右区域存在，所有业务区域仍未接通。当前左右列1206.08/350px、栏距16px；[截图](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-real-before.png)、[几何](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-layout-before.json)、[五Tab](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/a01-tabs-before.json)。这是现状证据，不是完成后验收。
- 专用合成PG READ ONLY复核：原两账号各5资产/10版仍为私有草稿；成员按钮均仅artifact.read/create/edit。admin的数据库身份为tenant_admin，不能因此给owner同一角色补review/release，也不能把原本人适配器的限制误解为正式管理员产品权限。[核对结果](../planning/research-assets-product-2026-11-12/evidence/a01-preflight/readonly-pg.json)。
- 旧ResearchArtifact/Version/Source/File/Review和当前授权事务可复用；旧list是产物列表，不能当资产目录整包直传。旧removeDraft会DELETE，不用于回收；旧createVersion不能修改released对象，旧单线状态也不能同时表示“已发布v1＋待审v2”。因此仅在Hub内补资产状态与用途，不修改旧Service或旧schema。
- 既有10份A02只读夹具和所有前序资料保持只读；新治理族与旧候选分开。没有创建新资产/用途/表/权限、没有重启服务或调用模型。

## 2. 整页边界与功能映射

| 区域/ID | 本页交付结果及数据口径 |
| --- | --- |
| 六统计 AS-11 | 全部及五类型，按当前可见、未回收的逻辑资产去重；版本不累加。与目录相同权限集合，统计不随列表分页改变；筛选后的总数另在分页展示，不以失败当0 |
| 搜索/五筛选 AS-12 | 关键词匹配有权题名/摘要；类型、领域、生命周期、共享范围、来源组合；URL保留生效条件。受限来源名/研究名不进入选项或搜索侧信道 |
| 九列/排序/分页 AS-13 | 名称、类型、来源Study、固定版、状态、共享范围、责任人、更新时间、动作；默认更新时间降序、id稳定次序，页码及总数真实。标题/类型/更新时间支持白名单排序 |
| 预览四Tab AS-14～18 | 与选中行固定版一致；基本信息/版本/关联/引用各自当前授权。历史版明确只读；引用在剪贴板成功后提示，拒绝时提供可选全文。缺正文权只给已许可摘要，不偷读正文 |
| 图谱 AS-19 | 仅来源/派生/固定引用的真实边，有权节点可点回原位预览及详情；无边是真空态，不根据共同标签推断合作。首批在原Tab用可键盘操作的关系节点/连线呈现，不引图数据库 |
| 我的贡献 AS-20 | 本人创建/明确共同贡献、提交、审核、成功引用事件分列，身份和作者声明分开，不造积分或排行 |
| 共享与协作 AS-21 | 我发出的共享、收到的许可、我的申请、待我处理四个局部列表；固定版本、指定接收人、用途、期限、处理理由及撤销真实，重复申请复用已有结果 |
| 回收站 AS-22 | 本人从未提交、无外部引用/授予/导出/发布历史的草稿软删及恢复；管理员可按本租户当前业务身份管理。有关联对象解释阻断，不永久删除；恢复不恢复旧许可 |
| 推荐 AS-23 | 同一可见集合，优先同领域再同类型、排除已选，理由明确；不显示AI分。换一批真实分页，穷尽提示，不悄悄重放首批 |
| 趋势 AS-24 | 服务端Asia/Shanghai按日展示最近30日成功引用/应用/下载三类事件，分列不相加；本轮没有应用/下载事件则为真实0，不编曲线，未有事件和服务不可用区分 |
| Study与返回 AS-25 | 沿原Study位置，优先合法URL/当前上下文；只有一个时默认它，多项时不猜第一个。切换清选中/旧内容，保留安全筛选；知识入口沿原位置，旧本人候选仍可显式进入 |
| 状态与恢复 AS-26 | 每个Tab均有加载、真空、筛选空、无权、服务失败、来源失效和历史态；未知提交只查原键，无假成功/演示回退 |
| 登记与治理 AS-02～08的A01动作 | 本页原上传/更多操作内完成上传、选已有获准资料、手工整理、修订、提交、具名内容/权利用途审核、限定发布、撤回；不自动发布到Hub，不切G02开发 |

本页内登记支持五类：方案说明、数据字典、量表/工具说明、分析方法/结果说明、论文/报告。没有合法运行来源的“分析”只能标方法说明，不得称已执行结果；未知来源可存私有草稿但不能提交共享审核。登记不是CRF装配、统计执行或临床开放。

S06/S10沉淀按钮、Hub纳入、G02新适配、AI、独立Study B实际应用、A02评论/导出仍按后续原60项顺序，不被本规格取消，也不借A01提前开发。

## 3. 原布局与局部交互差异（待确认I01～I04）

| 编号 | 原样→拟议最小适配 | 理由及不变项 |
| --- | --- | --- |
| I01 | 原五筛选条在同一Card增加关键词输入；原表头原位排序；原分页改成可用页码/前后页 | PRD要求搜索/排序但母版没有对应可用控件。无额外侧栏/页面；不减少五筛选、九列或缩字。五筛选立即生效，关键词Enter/搜索图标提交，不加第二个“应用”步骤 |
| I02 | 原“上传资产”打开共享模态：默认文件，可直接改为已有资料或手工整理；原“更多操作”打开同一编辑/治理表单 | 原按钮无真实表单；保持按钮位置、主区左右比例和卡片顺序。类型/题名/摘要/用途/限制/作者/来源/许可有持续label；来源已有信息自动带入。内部ID/hash/key由系统维护 |
| I03 | 原五主Tab及预览四Tab原位承载各自数据；共享申请/审核/撤回/恢复使用同一站内Dialog | 不增加主Tab、不把申请挪成另一页。每个Dialog只突出当前一个主动作；已有内容与范围明确时审核一次提交，扩大范围/撤回/回收才增加一次影响确认 |
| I04 | A01详情进入同ID固定版A02；安全returnTo保留A01条件、页码、选中版本与滚动位置；共享对象由新的受控只读投影呈现 | V1只读适配器只认本人draft，不能借同URL暗放行。仅扩充A02必要的状态/来源/当前许可只读投影，不实施其余七Tab；不修改原A02布局/旧两候选族或V1夹具权限 |

科学内容阅读16/28；列表/按钮/输入/表单14/22，辅助13/20、时间12/18。350px原右栏不因新数据加宽。窄宽表格内横滚，不裁列/缩字；短摘要有键盘/点击可达全文。模态焦点圈定、Esc/取消保输入、焦点归还；仅真实dirty启用站内离开保护及beforeunload。账号变化清私有表单/响应，checking不丢同身份dirty；后台GET不续会话。

## 4. 数据复用与Hub最小增量（提案，未迁移）

推荐在现有PG同库新增专属`rh_asset`schema四张业务扩展表；复用既有资产内容/版本/来源/审核/附件/审计表及账号/Study，不复制知识正文库、不改旧Prisma/schema/角色。参考Hub已有`server/hub-sources/schema.sql`的隔离增量方式。这是本页权利与目录所需数据，不是通用IAM/排空底座。

| 表 | 关键字段/不变量 | 不重复建设什么 |
| --- | --- | --- |
| asset_registry | asset_id PK/FK ResearchArtifact，tenant/group/project/owner，asset_kind，revision，working_version_no，submitted/approved/released_version_no，working_state，release_state，deleted_at；逻辑范围+ID唯一 | 正文继续ResearchArtifactVersion；Hub工作版与发布版分开。旧ResearchArtifact只作draft内容容器，旧生命周期不得冒称已审核资产 |
| version_policy | asset_id+version_no唯一、artifact_version_id唯一FK；固定metadata/摘要/领域、作者/贡献者、source_bindings、权利声明与依据、discovery_recipient_ceiling、允许申请用途、许可快照hash | 不存第二份正文/文件；与现有Version正文hash/父Study/marker校验绑定，INSERT后不可UPDATE/DELETE。旧Review表保存具名内容审核，新用途决定另留固定事件 |
| access_request | request_id，tenant/asset/version/recipient，initiator/requester、requested/approved_actions、purpose、expires_at、decision/state、decider/reason/time、revision、request_key/hash | 同表表达申请和获准许可；直接共享由权利人显式发起并记决定，不能伪造对方申请。只有approved且未过期/撤回的动作有效，不改Study成员/角色 |
| asset_event | tenant/asset、固定version、单调asset_revision、actor、event_type、request_key/hash、reference_target、result_receipt、created_at；操作幂等键唯一 | 不存正文/凭证；复用AuditLog写通用审计，本表承载不可覆写的业务事件/原提交回执、贡献/引用/趋势及页内处理通知 |

首批表只增不改旧表，FK用RESTRICT、无级联物理删除；新表强制tenant+Study RLS，event/version_policy为追加式，access/registry限定UPDATE。旧表单列FK不能独自证明同租户同Study，数据库校验约束/触发器与服务端均校验真实父对象；新表内部使用包含tenant/Study的复合FK。应用角色只对这四张表授所需SELECT/INSERT及registry/access的UPDATE，禁止PUBLIC/DELETE/绕过RLS。DDL/GRANT实际执行属于待确认D01；若需要改旧表索引/RLS/GRANT则再次停线。

新治理内容族`rh-research-asset:catalog-20261112:`、新marker/投影`.v2`与当前`.v1`分离；V1的10/20完全不转换、不改权限。新族仍被P01现有rh-research-asset:前缀排除。未知/旧族/篡改/错Study拒绝，不把旧历史批量纳入目录。

备选比较：全用原Artifact可最快复用存储，但现有生命周期/硬删/无用途许可不足；把共享许可混入旧Role或Audit JSON会误扩权限、缺固定版约束。另建全套Asset正文/文件/知识表则重复。推荐上述受控业务扩展，具体DDL只随已获批规格小步实现；未来真正跨Study可扩用途适配，不本轮改共享底座。

## 5. 状态、权限和交付不变量

工作态：draft→in_review→approved或changes_requested；修订追加工作版，使原待审申请失效。发布态独立：unreleased→released→withdrawn/expired；新工作版不替换旧发布版，旧版仍需当前有效许可。内容审核/权利依据通过不自动共享，发布时明确版、可发现摘要的接收范围与每项用途。旧来源的专业审核、版权、数据许可不由管理员资产审核代替。

目录每资产只有一行：作者/当前管理员默认working_version_no，并明确显示该版工作态；其他接收人默认最新一个对本人有效的已发布版本，不能看工作头。registry.released_version_no只是最新发布推荐指针，不是历史唯一有效白名单；受限于最新版本但仍有v1许可的接收人可继续看到v1。按版最近一次release/scope_narrow/withdraw/expire事件确定该版当前有效性，发布v2仅改推荐指针，不自动撤v1/迁移v1许可。显式历史、预览、引用和详情深链固定原版；目录搜索/排序/统计都基于当前角色该行实际可见版本字段，不能用私有工作版题名或领域命中。

摘要发现范围有持久化：version_policy.discovery_recipient_ceiling记录审核时允许的具名受众上界；release事件保存本版实际discoveryRecipients和期限，scope_narrow保存收窄后的完整集合，均受该上界约束。移除某接收人摘要范围时，同一事务撤销该人本版有效grant及pending请求，事件和registry revision递增；再次纳入不恢复旧许可。正文/引用仍须各自有效grant，列表/图谱/推荐不因正文grant存在而绕过摘要发现规则。范围扩大必须新固定policy/审核决定，不就地篡改上界。

来源处理区分“仅新增版本”与“原版无效”：对有独立固定版状态/许可证据的Hub资产来源，新增v2不使合法v1失效；原v1撤回/到期/许可丧失则停止。旧KB只记录当前reviewed，不能凭旧正文存在推断历史审核仍有效；读取时须有固定版、当前读权和可追溯有效审核/用途依据，无法证明时标未核验并阻断，不套旧plans的所有stale规则，也不把管理员勾选当作补造上游权利。C04同时测这两类，缺证据不宣称已完成。

F03实现细化：以目标环境真实review_kb_doc审计归属为准，不从某个源码默认值推断运行结果。当前本机已测原审计带当前Study，直接复用原记录，无需新增投影。不扩大旧AuditLog RLS或普通人租户审计读权；若某旧路径实际只留researchProjectId=NULL的审核事实，才由F03具名管理员核对原审计后，在现有AuditLog追加当前Study最小来源投影，绑定原审计ID/hash、真实文档/KB、固定版及正文hash。不是重新专业审核或第五表。读链逐次核当前旧KB可见性、当前reviewed/published及同版同hash，再核真实原项目审计或必要投影；撤审/换版仍阻断，不能恢复旧权限或推断历史审核有效。

建议产品规则：租户管理员可审核本人整理的非临床资产，必须留“本人审核”事实与理由；不取消真实方案/诊断源对象既有独立复核要求。该建议需要本轮确认，不能由长期管理员权限推导自己已同意自审。研究者无审核/发布权。

当前身份以数据库account/tenant/authVersion、租户管理员状态和真实Study父链为准。普通用户需要当前Study授权及动作权限，管理员按既定本租户业务规则行权；两者都不能越过来源/版本/用途/状态。现有plans.withScope硬绑定本人合成草稿，只复用当前授权锁/事务模式，不拆Guard泛化、不按邮箱兜底。

一条读取谓词同时用于统计、选项、搜索、列表、图谱、推荐和趋势。未发布草稿仅本人/当前管理员/具名审核人可读；接收方只可发现显式获准摘要，正文/附件/引用/AI/下载/派生分别判断。权利人也不能授自己没有的上游许可。读取摘要不自动授正文，引用不自动授AI或应用。

本轮申请用途仅`read_body`与`cite`，固定版、指定另一个原账号、最长7天，可缩短；摘要目录范围只限这两个账号。`ai/download/derive/apply`保留结构但不能批准执行，不设默认全勾选。没有正文权时引用只含获准书目信息，不含摘录。许可到期/撤销/资产撤回/来源失效立即作用于新读取、图谱、复制及提交；不得借缓存恢复。

每次变更：当前授权锁→真实父对象/来源/上游用途重验→行锁与expectedRevision/baseVersion→原键查重→状态/CAS→业务行+事件+Audit同一事务提交→当前权限下最小回执。创建同键异payload409，同键同payload仅回原结果。原键恢复不重放业务；原键查不到与临时不可查区分，明确未提交时才显式同键重试。序列化冲突不自动改payload或生成新对象。

软删只改本轮对象deletedAt及事件，不调用旧removeDraft；发布/引用/许可历史存在即阻断删除，走撤回。恢复核当前owner/管理员、原来源/约束与同键占用，不恢复旧共享；历史事件、来源和内容永久不因本页删除而物理销毁。

## 6. API与DTO（C01～C05已在本机启用，其余仍按计划）

沿现有同源Cookie及Study头；query/body未知键、重复键、混族、非规范ID/正整数拒绝400。所有读取no-store；无权/未知对象不泄漏标题，以404统一，未授权scope403、失效会话401、版本/状态409、条件缺项422、服务故障503。

| 方法与路径，前缀/api/research-assets | 请求/结果 |
| --- | --- |
| GET /catalog | q≤120、kind/domain/status/scope/source枚举、page≥1/pageSize∈{5,10,20,50}、sort∈{updatedAt,title,kind}、direction；返回items/total/page/pageSize、stats、合法filterOptions、scope/identityRevision，不返回正文 |
| GET /:id/preview?version=N&tab=basic\|versions\|relations\|citations | 返回同一固定版最小投影、当前可见版本/关系/引用、canActions/disabledReasons；摘要/正文独立，不自动读其他私有版 |
| GET /catalog/:id、GET /catalog/:id/versions/:version | 仅新治理族detail.v2完整只读投影；无正文权不返回contentMd，明确bodyAccess，当前角色及固定版许可校验。不修改原GET /:id及/:id/versions/:version的V1守门；Controller静态catalog路由先于通用:id |
| GET /graph、/contributions、/collaborations、/trash、/recommendations、/usage | 各有页码/固定时间窗口与同源可见性；recommendations用真实cursor防重复换批，graph按有权节点分页截取；空集与不可用分开 |
| GET /registrable-sources | 当前有权固定资料/产物、来源版本/允许沉淀用途/缺失项；读取不意味着可以复制，缺用途可引用为依据或存未核草稿但不能共享 |
| POST /uploads | 单个.txt/.md，UTF-8、≤5MiB，复用旧文件检查/存储及明确标识的本机文件回退；返回私有暂存ID/hash/size/status。无解析模型/联网；不自动进KB/索引。其他格式422 |
| POST /、POST /:id/versions | 创建/修订五类候选；metadata、sourceBindings、policy、contentMd或uploadId、requestKey；修订带baseVersion/expectedRevision，返回固定版与receipt。创建前预检大小/来源，上传重复仅复用文件不静默合并不同资产 |
| POST /:id/submissions、/:id/reviews、/:id/releases、/:id/withdrawals | 带version/expectedRevision/requestKey；审核内容/权利用途分别明确、理由必需；发布仅已批准范围，撤回留原因。首批仅本机具名合成范围，无Hub/公开发布 |
| GET /:id/governance?version=N | 仅当前作者/本租户管理员，返回固定版题名/摘要、来源现态、权利依据/受众上界、当前revision及可执行动作；不返回正文。policyHash/contentHash/identityRevision由系统随操作带回核对，不让用户填写。源失效仍允许当前管理员撤回已发布版本，或将待审版退回，不允许通过/发布 |
| GET /:id/usage?version=N | 当前版封印、身份、registry revision、真实接收人及可管理用途记录；不读正文。历史接收人名称保留，新增接收人仅有效账号；授予时还重验当前Study访问权 |
| GET /collaborations | 同目录查询白名单与身份/Study绑定，返回真实用途申请和许可分页；管理者可读取失效来源的最小许可历史以撤销，不恢复来源正文或批准能力 |
| POST /:id/access-requests、/:id/access-requests/:requestId/decisions、/:id/grants/:requestId/revocations | 版/接收人/用途/期限/理由与CAS；拒绝自申请、重复有效许可提示已有；请求决定不改角色，撤回后晚响应不复活 |
| POST /:id/citations | 固定版/当前目标Study/requestKey→保存成功引用事件、返回真实书目与固定深链。剪贴板失败不称“已复制”；重新复制不增加一次引用。记录与剪贴板状态分开 |
| POST /:id/trash、/:id/restores | 原对象本轮授权与关联历史、CAS、理由；仅软删/恢复 |
| GET /operations/:requestKey | 仅本人本次操作当前有权的最小回执；无读取权只可知本人的提交状态，不返回资产正文/他人请求详情 |

目录DTO版本`rh-research-asset-catalog.v1`；正式治理只读详情`rh-research-asset-detail.v2`。V1旧阅读响应与旧方法/适用性候选路由不改。列表行含稳定id/kind/title/sourceStudy可见名/version/state/scope/真实责任人/updatedAt/canActions，不透传idempotencyKey、seal、storageKey、SQL、他人账号邮箱或受限来源。

新登记asset默认返回固定v1；同一选择下A01预览、引用与A02深链均携带该版，不随刷新暗跳head。切选、筛选、Study、账号/authVersion均使在途旧响应失效；当前读失败清私有正文/禁止写但保留允许保留的本人未提交输入，401才要求重新登录。普通503不能抹成0统计。

C04实施约束：治理输入逐动作白名单，包含固定version、expectedRevision、policyHash/contentHash、identityRevision和原requestKey；审核通过时需明确已核内容与权利用途，自审（资产责任人或该固定版实际创建者）还需明确本人审核事实，理由必需。仅重复原键返回原事实，不再增加事件。每一固定版只允许首次限定发布；再次扩大/重新纳入范围须新固定policy/审核，不能借新请求键重发旧版恢复范围。发布由服务器计算≤7天期限，摘要发现与正文/引用授权分离；撤回同事务撤销本版所有pending/approved请求与许可，保留历史，不能稍后复活。24次事件上限最后一次保留给仍有效发布版的撤回，不新增额度。原容器仍draft，审核记录复用旧Review表而不驱动旧临床/报告生命周期。

C05实施约束：用途仅read_body/cite且初始不勾选；申请者本人绑定、指定共享接收人仅原另一账号，授权期限取服务器当前时间＋1～7天与发布到期的较早值。授予/拒绝/撤销绑定真实requestId和request revision，批准用途不得超出原申请。当前授权锁内锁定真实registry和许可，重验父Study/当前身份/来源/固定版封印；registry CAS、许可、事件及Audit原子提交。原键/原内容重复只读回执，异内容同键拒绝；缺失回执不自动重放。引用记录与剪贴板分离，复制前重查当前许可；仅书目及固定版链接，不附摘录、不将当前年份伪装为发表年。停用接收人和失效来源仍可缩减撤销，不能新增授予。数据库v2仅替换自有两guard并复用原函数添加access deferred约束；以精确源hash/自有定义hash的新升级Audit识别，不改D01 SQL和原审计。

I04路由明确为`/pages/a02/?researchAssetId=ID&assetCatalog=1&assetVersion=N&studyGroupId=G&researchProjectId=P&assetReturnTo=ENCODED_A01`。assetCatalog=1只选v2读通道，不能与旧assetDraftId/crfMethodAssets等混族；ID/版/Study均严格单值。assetReturnTo只允许同源/pages/a01/及本页白名单筛选/页码/选中版/scroll参数，不允许外链、hash或嵌套返回。新增makeCatalogAssetUrl及assertCatalogAssetDetail严格核schema/id/真实父Study/固定版/bodyAccess/canActions，当前登录人不必等于owner但必须由服务端允许；原makeResearchAssetUrl/旧V1校验不放宽。重登录只恢复安全站内读路径，不重放变更。

上传暂存不调用旧KB import或伪造未绑定ResearchArtifactFile：复用文件检查/存储原语，使用本机私有持久manifest记录uploadId、tenant/Study/account/authVersion、SHA/MIME/size、createdAt/expiresAt（24h）、pending/bound状态及绑定的asset/version/requestKey。随机不可枚举ID，不暴露storageKey。只可在同一有效身份范围登记时原子认领一次；同键重试回原绑定，异键重复绑定409。登记失败未提交则保留pending可重试，已提交丢响应只查原回执。取消不假称已删除文件；未绑定到期材料隐藏并保留隔离清理清单，删除/清理另按精确可恢复对象确认，本轮不自动删。已绑定文件永久随固定版本保留，软删资产不删除文件。不建第五表/通用上传服务；manifest原子写/锁与业务回执不一致时先核对原键，禁止重复创建或把坏状态算成功。

## 7. 本轮最小用途与夹具确认点

完整列表见[A01授权清单](../planning/research-assets-product-2026-11-12/a01-authorizations.md)。拟申请：D01四表及其专属最小GRANT；A-W01本轮新候选登记/修订/软删恢复；A-W02原admin对本轮新对象具名审核、限定发布/撤回；A-W03仅原两个账号间摘要发现、正文/引用申请授予/撤销；F01新10份×最多8内容版及每份最多24笔成功治理/用途操作（总≤240）；F02最多4个合成TXT/MD文件；F03现有具名合成共享KB内最多2份原创合成来源文档×最多3版及仅这两份的审核/撤审；I01～04上述局部适配。F03保证AS-02的真实KB来源正向/撤回验证，不用新资产互引冒充KB适配；权利依据来自明确原创材料与本轮授权，不由管理员勾选补造旧材料许可。

不改原Role/菜单/AccountCapability、不加临床/Study权限、不新建账号/Study、不动前序10份/20版与其他历史；不发真实邮件/不自动建全局通知。共享与协作Tab本身显示当前有权事件及未读处理结果，首批不复用StudyNotification冒充资产通知，后续全局通知按AS-59专项适配，不据此声称该60项已全部完成。不调用模型/核价、不外网抓取/远端配置/云/服务发布，不开放锁库/下载/导出/实际应用。

未获这些增量确认前只做免费只读核对、设计/评审及文档；不运行DDL、开写接口或创建夹具。若只批准读取，仍可推进共性代码但明确不能称A01整页完成；不能自行砍共享/回收区域。

## 8. 验收和工期

四层分别留证：代码、专用本机启用、真实PG/HTTP/两账号操作、用户科研任务评审。A01整页技术门槛：AS-11～26及本页登记/治理动作全部正反路径有证；真实角色、失权/来源失效、CAS、丢响应恢复、固定版深链/返回、原五Tab/四预览/推荐/趋势、软删恢复，无假统计/空按钮。不能以只读/Mock/按钮变灰销项。

本页工作区至少1440×900/1366×768/1920×1200与真实200%；另390/320验证入口和正文可操作性，原1910基线同尺寸比较。记录DPR/实际缩放/computed字号、键盘/焦点/复制失败、截图与录屏。工具不足的关键项列未测，不用旧截图、改变视口或测试数量冒称完成；不为解决本页而改公共Frozen Shell。

预计A01本页专项28～38有效小时，含免费复用准入/数据契约4～6、登记/目录8～10、治理/用途8～10、辅助区域4～6、整链/独审/文档4～6；另4小时缓冲。该专项含原总体P2分摊8～10h及P3的20～28h，不额外叠加到96～132h。仅是条件估算，不承诺余下几天完成完整60项或擅改11月中旬交期。A02整页/AI/跨Study应用及上下文入口仍为后续独立工作，不混入本页完成结论。

实施细步见[A01串行计划](../planning/research-assets-product-2026-11-12/a01-implementation-plan.md)。一次新增范围确认后无新增停点即连续执行；沿当前目录主线程实施＋最后一次独立总评，不启动并行写入。

### C07独评最小收口（不扩授权）

- 原键查回只保证本人操作状态；书目及固定链仍须当前同版发现权和引用权。撤回/到期/撤销/来源失效时返回committed最小回执、contentAccess=restricted，不含citation；前端显示已提交但当前不可读，禁止重放。幂等POST同样投影。
- 当前读失败同步通知四类操作流：401/403清受保护输入并作废在途；临时故障保留本人未提交输入及最小原键，隐藏弹窗受保护内容、停止上传之后的自动提交，迟到响应不触发成功；恢复后显式核对原键，不自动重放。正常轮询不打断正在编辑。
- 24事件总额不增加；trash必须额外预留一次restore，revision22可回收至23并恢复至24，revision23禁止新的回收。目录/options/执行共享预算判断。

### A01末项收口

共享协作读取失败与未登录/待选择Study使用现有局部不可用提示，不再假loading；真loading和已核空态不受影响。录屏通过原安装Playwright独立Chrome context实时recordVideo，故障仅拦测试contextGET或在具名POST发出前abort；没有对共享服务加新探针，也没有重arm旧探针。鼠标恢复实证为trusted mouse click detail1及真实后端原key not_found，随后明确放弃，业务事件未增加；不冒充又做一次提交后丢响应。技术完成与用户科研签收仍分开。
