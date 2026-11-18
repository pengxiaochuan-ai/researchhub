> 2026-11-13当前决定：用户确认P4新增工作台延期；本文保留设计，未批准实施，不执行授权／DDL／夹具／模型。当前主线P5审计。已有最小质量链保留。

# P4研究质量／S05最小实施规格

日期：2026-11-13。状态：**评审稿，待用户批准；不是实施授权或功能验收。**

来源：[治理模块PRD §5.4](governance-module-prd-2026-11-12.md)、[QL01–14](governance-subpage-feature-inventory-2026-11-12.md)、[P4准入实证](../planning/governance-module-2026-11-12/p4-admission-2026-11-13.md)。本轮只写规格、授权清单和计划，不运行迁移、夹具、模型或重载。所有新增选择均为本稿建议，批准前不称为用户决定。

配套：[最小授权](../planning/governance-module-2026-11-12/p4-authorization-2026-11-13.md) · [串行计划](../planning/governance-module-2026-11-12/p4-implementation-plan-2026-11-13.md) · [拟议数据增量ADR](../decisions/0010-study-quality-extension.md)。

## 1. 用户任务与交付边界

管理员从G02研究质量事项进入S05，选有权Study，了解当前质量范围，运行核查，分派真实问题，核对原件及固定答卷，形成可追溯质量报告。科研人员处理本人有权任务、回复／更正和原件核对；统计、规则与数值来自确定性计算，AI只解释已保存结果。

**全部QL01–14与S05全部非多中心区域在本P4目标内**，不是只接问题列表即完成。分步技术交接不得冒称整页交付。中心对比继续按原计划延期；不新建全局锁库、自由规则编辑器、多中心、通用IAM、日志库、伦理材料或共享底座排空协议。

复用当前正式DataQuery／答卷更正／ReviewEvent、任务核心、ResearchMethodRun、科研Agent／计费、Artifact／Version／ExportJob／Storage及原子审计。T15具名3例BASELINE分析快照只保留原入口，不扩成通用Study锁库，不用T17描述统计报告换标题充当质量报告。

### 1.1 方案取舍

| 方案 | 影响 | 本稿建议 |
| --- | --- | --- |
| 扩旧公共表：给DataQuery加负责人、给ReviewEvent塞SDV依据 | 新旧扫描器、API及旧消费者都可能受影响；任务出现两份权威状态 | 不采用 |
| 复用旧事实和核心，Hub只补三张质量关联／事实／回执表 | 正式数据和任务仍在现有表；增量隔离、可核验 | **采用此方案，待批准** |
| 另做完整质控平台、任务与报告引擎 | 重复建设，扩大底座 | 不采用 |

## 2. 原页面与局部交互冻结

保留Shell、页头、分栏、六卡、三图、九Tab顺序、问题表与右侧AI／常用操作位置。研究选择使用原上下文区域；只有一个合法研究时自动展示，多个才选择。不新增首页或治理大屏。

| 原区域／动作 | 拟实施动作 | 用户批准点 |
| --- | --- | --- |
| 数据核查／数据核查计划 | 当前方案版本＋范围／规则摘要→显式“运行核查”→上次结果／历史；不另建核查计划审批 | 不把“分析计划”当核查计划；原动作局部文案按本稿锁定 |
| 数据问题表／负责人／批量问题分配 | 直接进入原问题；勾选明确问题后“分配任务”，一个共用负责人及截止日 | 新增所需选中态及共享站内分派弹窗；不改变表格位置／列顺序 |
| SDV监督 | 列表→原行“核对”打开站内弹窗，核对原件位置与固定答卷，选结论并保存 | 详情填充现有区域；不要求再录团队、身份或重复抄答卷 |
| 数据导出／“导出问题列表” | 统一为“质量报告”，默认下载Word；仅聚合，非逐患者问题明细 | **原按钮文案和语义局部调整必须随本稿批准**，不能静默替换 |
| 审计轨迹／趋势／规则 | 原区域读取当前Study的合法真实记录 | 不扩成G04租户全量日志，不改变G02定稿布局 |
| AI助手 | 选择当前已保存核查结果（默认最近可用结果）→“解释结果” | 另获核价／费用授权前不实际调用，也不把空态当完成 |

普通保存、运行、分派不叠加第二次“确认”；影响说明放在同一操作区域。只有已有必要的审批／放行与防丢失条件保留。普通业务确认一律共享站内弹窗，支持Esc、焦点圈定／还原；beforeunload例外保留。操作14/22、明确长文16/28，缺值不显示0，不缩字号塞内容。详细说明和内部哈希、授权测试额度、数据库接线不出现在产品常态页面。

## 3. Study、质量范围及统计合同

### 3.1 可读范围

`quality/studies`是服务端当前有权集合，不直接拿research-directory中全部研究作为临床可读集合。复用Study解析、当前租户／账号／authVersion／真实group-project父链；租户管理员依ADR-0006无需伪造成员，普通用户仍需合法Study成员／workbench及对应原权限。RLS和前端隐藏都不替代服务端授权。

每次核查服务端生成`qualityScope`：Study、执行项目、执行方案版本、截止时间、实际纳入的Enrollment／Subject／Visit／Assignment、表单版本／规则版本。纳入该方案已存在且父链一致、非删除的入组记录（退出不等于删除）；主体删除、政策不允许质量用途、不可读取或父链失效则不得取答案。纳入／排除计数与原因只在授权允许范围内返回；存在不可读取部分时明确“部分范围”，不能声称全Study。未分配表单不从预期访视数推造Assignment。新分配／更正／规则或政策改变后提示重新运行。

当次集合、修订、问题状态、SDV事件序列及规则在同一受控快照中固定。读取未完成、分页未取全或版本不一致返回失败／明确范围受限，不保存假完整快照。直接临床值仅在原有权答卷／原件页读取，质量持久化尽量只存引用、哈希和结果，避免复制答案库。

### 3.2 六卡与图表

| 原卡／图 | 精确口径 |
| --- | --- |
| 受试者总数 | 本次固定范围内有效Enrollment关联的去重Subject数；卡下标“本次核查范围”，不是租户Subject总数 |
| CRF表单总数 | 本次有效Assignment数；补充已提交／草稿／未填写数。另展示定义数时必须明确是FormVersion去重数，不能混用Response修订数 |
| 数据问题总数 | 固定范围内真实formal_response DataQuery去重数及open／closed分组（是否已有回复单独取真实journal，不新增answered状态）；只规则finding不计作人工问题 |
| 重大问题 | 仅明确配置了严重性且属于本次规则／问题依据的重大项；DataQuery无原生severity，不从规则失败、Deviation或优先级猜。未配置则“未配置分级”，不是0 |
| 平均解决时长 | 同一问题的真实创建事件至首次合法关闭事件，限时间完整且非负的closed样本；展示样本n／被排除n与单位。不以updatedAt猜关闭。若未来支持重开再评审重开口径 |
| 数据质量评分 | 仅已存在、已确认的评分公式及版本。当前无规则，卡显示“未设置评分规则”；P4不发明综合分 |
| 问题分布 | 按已存在ruleCode／状态分组，未知单列“未分类”；严重性无合同则不用假严重性饼图 |
| 质量趋势／数据趋势 | 历次成功保存的真实核查运行；纵值显示指标及分母。`cohortHash`（纳入身份／分配集合）、protocol／表单规则／口径／用途政策一致才连线，答卷修订变化本身可比较但注明新修订。范围或规则改变分段；一次运行只有一个点 |
| 各中心评分 | 延期空态，不把团队或StudyGroup当中心，不合成数值 |

汇总必须带`asOf/runId/scopeHash/rulesHash/metricVersion`及`value|null/unit/numerator/denominator/exclusions`。零分母显示不适用；0／false是有效值，空、null、未填写分开。统计由本地确定性核心产生，AI不计算。

## 4. 核查运行、规则和问题闭环

### 4.1 最小规则集

复用原表单schema规范化／校验核心：已配置required、值类型、枚举、显式min/max、明确且当前算子支持的跨字段规则。未设置范围不引旧manifest的年龄等默认医学阈值；跨字段规则未配置就显示“未配置”，不补造。草稿未完成是“尚未提交／待填写”，不冒充已提交的数据错误。非法旧值只报告，不静默修复。

新CRF适配器先在Hub内固定修订并产生去标识的聚合manifest及finding引用；仅旧`research-data-quality`支持的manifest子项进入现有确定性Worker，严禁把答案、自由文本、被试编号或原件送到算子／LLM。不能将CRF值强塞入旧scaleResults／features假装兼容。CRF专有检查使用同一表单校验核心的确定性结果，与Worker结果按明确规则ID合并，分别记录engine/version；不改旧通用算子契约。如果全部需要的检查都不在Worker支持合同内，显式记Worker不适用，不造调用成功；CRF真实执行证据仍必须完整。

### 4.2 运行与版本

复用ResearchMethodRun，而非新建quality_run表。`skillKey=hub-formal-crf-quality`、来源类型`hub-quality.v1`、明确部署／Study所有权；沿原状态转移及CAS，保存真实startedAt/completedAt、输入hash、规则／执行器版本、聚合数值、finding引用与限制。Session／Agent等必需外键使用合法真实上下文，不伪造空会话，不运行旧初始化器顺带授feature。

提交前、实际执行前、成功／失败提交前、读取结果前都重核当前授权及真实父对象。计算结束时来源变化则不得发布为当前结果；保留失败原因或历史结果的受限引用，不覆盖旧Run。来源失权则撤下结果，不能将“仅范围变更”的历史留存用于绕过撤权。

优先在原独立consumer／认领框架中做本分支的最小装配，**先验证旧扫描器不会认领新skill／前缀**；不能安全隔离则停下提交必要增量，不扩大共享Worker改造。无自动无限重试，显式重跑创建新Run；原requestKey重试恢复原运行。趋势只取当前有权且确实成功的历史结果。

### 4.3 人工问题

新质量列表是旧DataQuery的安全投影，默认更新时间降序＋ID稳定排序；允许status、文字搜索（ruleCode／字段题名／合法被试编号）、assignmentId及现有真实分类筛选。严重性筛选无配置时不提供假选项。游标绑定账号／authVersion／Study／筛选／排序；不改旧API默认ID升序行为。

固定答卷／字段进入S09；更正、回复、关闭、审阅、锁定各用原接口与权限。更正生成新修订，不自动改旧问题target或关问题。旧正式疑问回复后仍为open，仅close变closed；“已回复”是journal派生标志，不扩DataQuery状态机。不把规则警告自动转人工疑问；需要人工跟进时管理员在原创建问题动作中确认明确字段／规则／说明，走原幂等。核查、分派、任务验收、SDV一致均不自动完成访视、关闭疑问或放行分析快照。

## 5. SDV：核对什么、谁操作、怎样留痕

SDV是对“同一Study同一被试的登记原始依据”和“某个固定CRF字段修订”的人工核对，**不是判断临床真伪或替代方案审批**。

### 5.1 用户路径

在SDV列表选择核对项→弹窗自动带出被试编号、表单／字段、固定答案修订→从该被试已登记且当前有权原件中选择（单一候选默认带入）→定位页／字段→选择“一致／有差异／待核对”→保存。正常一致不要求额外写长说明；差异需要一句差异说明，待核对选择具体阻碍，必要时补充。不得要求再抄CRF答案或上传已登记文件。

首期原件限定现有ModalityFile `kind=raw`的PDF／登记图片，以及SubjectPhoto；必须同租户／执行项目／Subject，若已有subjectVisitId还需同Visit。PDF定位页码＋原件字段／段落标签；图片定位图号／区域标注，后台规范化坐标。首期不接任意URL、自由磁盘路径或临时附件，更不自动联网补“原件”。

原件不足、不可读、缺定位、内容hash未知时只能待核对，不能确认一致／有差异。操作界面可新增pending项但必须绑定合法Assignment和field。历史原件与SDV事件保留，读取仍验当前权限，不从历史事件泄漏答案／文件地址。

### 5.2 授权与证据

管理员本租户默认可核对；普通人员需Study读取、该原件读取及既有`study.review`和Study负责人关系，或本稿明确批准的本Study最小SDV许可；有任务不自动获得SDV确认权。本轮owner拟仅处理本人跟进任务，不授study.review或SDV一致确认，admin完成SDV真实正例，owner完成合法只读／越权反例。

不能直接代理旧DataService.rawContent绕过其成员／data菜单规则；旧方法当前对管理员也硬要求成员。拟由Hub使用现有Storage／安全Range和媒体类型实现本Study受控原件读取，复用当前账号、真实父链、来源指纹、读取前后版本重验及未交付流关闭模式，按ADR-0006处理管理员，不修改旧服务／旧权限，也不伪造成员。代码级复用若必须改旧服务，先另列确认。

`sourceRef`必须含kind/id、不可变内容sha256、归属版本指纹及page/locator；不能用签名URL或storageKey充当依据。旧记录缺hash时由有权受控读取实际字节计算并将指纹记入新SDV事件，不覆盖旧资料。最终提交复核实际字节hash和固定答卷ref，不能只验证数据库updatedAt。来源／CRF／政策变化后原结论保留为历史但当前显示“需重新核对”，不自动沿用一致。

## 6. 问题任务分派：一份责任人、一条权威状态

一个formal_response问题最多关联一个权威跟进StudyTask；多问题批量选择仍各建／更新自己的任务，不能一条任务无区别关闭全部问题。负责人、协作者、截止日、优先级和任务状态仅来自StudyTask／Collaborator，不在DataQuery或新表复制。

管理者选择明确问题（最多50条／一次请求的资源边界，不是累计操作限额）→同一弹窗选负责人＋截止日→一次提交。题名由现有字段题名＋问题简述自动带入，不嵌答案或患者个人信息，优先级默认normal；协作者等高级选项复用原任务页按需维护。截止日必填是原任务合同，不暗加3天／7天科学或组织SLA。

授权同时满足原任务create／assign和问题读取；候选人须当前活跃、同研究可执行任务，且有相关固定答卷／问题读取资格。当前租户管理员也可作为合法候选。普通科研人员只处理本人负责／协作任务；任务管理者仍需project_manager＋study.configure，任务验收依原study.review。本轮真实正例由admin分派／验收，owner执行，不加owner管理权。

**同事务要求**：批量全部父链／版本／受领人先核验，锁序固定，再复用任务事务核心，提交Task／上下文／质量关联／原审计／回执。任一项失败整批回滚；不串行调用多个HTTP制造半成功。相同key同参数回原结果，异参数409。已有未终结任务重分派若截止日变化，须在同一批量事务先调用原edit更新dueDate，再用该次返回的中间version调用assign（或两者等价的原事务核心组合），不得把dueDate传入不支持它的assign后静默忽略；任一步CAS失败全批回滚。已有任务更新保留原协作者／依赖，不把隐含空数组传给assign清空；已验收／取消任务不自动复活，整批提示核对该项，本期不重复创建替代任务。

关联沿S08已支持`formal_response_ref`，新增质量关联记录queryId→taskId及原固定target，不新增S08 context kind。任务详情原关联区域只补当前可读的问题回链；不得因taskId可读而返回不可读临床摘要。S08现有更换来源动作可能使关联不再一致，P4读写须校验；不一致明确“关联已变化”，排除负责人当前投影，禁止静默改绑。若实施需拦截已关联任务的非法换源，只在此类任务做最小守门并保留旧任务行为；无法局部约束则停下确认。

任务完成／验收不关闭问题，关闭问题不完成任务；S05分别展示问题状态和任务跟进状态，避免误以为已解决。无责任人的历史问题显示“未分配”，不从createdBy／closedBy猜负责人。

## 7. 质量报告与AI边界

### 7.1 固定质量报告

报告从一个已保存质量Run的固定结果生成，含Study名称、方案／口径／规则版本、统计截止时点、聚合计数／分母／缺失说明、按ruleCode和状态聚合的问题数、SDV聚合结论、真实限制和来源运行引用。**禁止**Subject／Enrollment／Participant编号、逐条queryId／taskId／答卷值、字段原值、原件内容／URL／文件名、自由文本回复／说明、原始临床数据及未审核AI正文。适用性声明明确它是质量工作报告，不是临床疗效或研究结论。

服务端固定白名单生成正文和contentBlocks，不把meta、finding列表或用户输入直接导出；确定性总数与报告保持一致。质量专用typeKey和前缀，与T17统计报告区分。复用ResearchArtifact／Version／Source／Review／ExportJob／File及渲染／存储，不复制文件服务。

保持原报告治理：生成草稿→显式提交／审核→批准→单独允许导出（底层released，仅该报告版本）→下载Word。**批准不自动放行，导出不等于Study锁库或公开发布**。原质量Tab内承接这些状态／动作，不跳新通用审批中心，不增加重复确认。管理员实际执行review／release／export只限本稿新质量报告，不顺带处理历史或其他类型。

本轮owner可创建／查看本人质量报告草稿；批准、允许导出及下载正例由admin完成。普通人员的artifact.export不因可看报告自动授予。首期Word（docx），当前PDF未配置不伪装可用，也不为PDF创建付费／云服务。Markdown/PDF另提需求，不作为已批准QL13的隐含格式承诺。

导出沿既有独立认领／租约／当前授权／版本CAS／文件hash／原子审计，准备、实际渲染提交和下载前后都重验；撤权、源失效、内容改变不交付。报告历史不覆写；源改动后旧报告可在当前合法范围标为历史阅读，不能当当前结果重新放行或新导出。失权时连历史阅读也拒绝。实际若旧claim／renderer不能安全复用此类型，先停线列必要最小适配，不启动第二个通用导出消费者。

### 7.2 AI解释

研究者对某个固定Run主动“解释结果”；先复用现有会话／科研Agent／费用守门，输入仅白名单聚合结果、规则描述及服务端给定来源标识，排除原始答案／被试号／原件／自由临床文本。模型输出定性问题解释、局限和人工建议，并从白名单选择依据；后端验证归属／真实来源、统一渲染引用和所有数值。

缺来源、伪造标识、数字推断或越权拒绝，不补造引用；AI不得算缺失率、质量分、概率，不能自动改答案、关问题、批准SDV或报告。运行、问题、SDV或规则集合已变化时旧解释标历史，发新调用需重新选择当前结果；撤权立即清除。

价格核对／真实请求／新任务数及费用上限单列F01待批；本轮不核价、不调用、不沿用旧5元或12次批准。AI结果技术和专业验收必须用新通用合成例，保存真实Provider请求／用量／费用、运行引用及最终产物；免费契约测试只证明契约，不代替真实执行。

## 8. 最小数据增量（提案，未执行）

### 8.1 复用与新增

| 承载 | 用途／权威边界 |
| --- | --- |
| 现有ResearchMethodRun | 核查固定输入引用、状态／CAS、确定性数值／finding、规则及执行证据；不新建运行表 |
| 现有DataQuery及journal／ReviewEvent | 人工问题、回复关闭时间、答卷审阅与锁定；不加负责人／SDV自由JSON |
| 现有StudyTask／Collaborator／rh_study_tasks.context／operation | 跟进责任／状态与原任务回执，不复制任务状态机 |
| 现有Artifact／Version／Source／Review／ExportJob／File | 质量专用报告和可追溯文件；不再建报告表 |
| 新`rh_quality.sdv_event` | 追加式SDV结论及固定来源，不复制答案；每次修订为新事件 |
| 新`rh_quality.query_task_link` | 一个问题与一条权威跟进任务的不可覆写关联／固定target |
| 新`rh_quality.operation` | 新SDV／批量分派／核查创建／报告创建等命令的幂等回执与请求摘要，不代替原业务审计 |

本稿没有安装SQL；精确SQL／ACL哈希在实施Q03中生成后只允许按已批准三表／字段边界及1个`rh_quality.check_parent_scope()`触发器函数／对应触发器应用。该函数为SECURITY INVOKER、固定search_path、只核父链／追加约束，撤销PUBLIC函数执行权，不给应用新增显式EXECUTE。任何额外表／函数、PUBLIC授权、SECURITY DEFINER、旧表改动必须重新确认。

### 8.2 三表字段与约束

公共字段：tenant_id、study_group_id、research_project_id、study_id、id、created_at；父对象真实且属于同一Study执行项目；Study外键只能引用真实rh_research.study，不能把外部ID当凭证。各主／外键的同租户及研究归属以复合约束或父链trigger完整验证，不只校验id存在。

- `sdv_event`：item_key（Study＋Assignment＋fieldKey稳定摘要）、sequence、previous_event_id、assignment_id、response_id、revision_no、response_hash、form_version_id／definition_hash、field_key、source_ref（kind/id/sha256/parentFingerprint/locator，或pending时null）、decision（consistent/discrepant/pending）、reason_code／comment、actor_account_id、policy_hash、operation_id。unique(scope,item_key,sequence)；sequence=1无前序，后续只能接上一序，受同一授权锁／item锁序保护。新结论和来源修正均追加；来源空仅pending。consistent不强迫comment，discrepant必须comment，pending必须具体reason_code（source_missing/source_unreadable/locator_missing/hash_unavailable/needs_clarification五选一，不作为额外身份审核）。actor、字段、源归属及fixed revision必须验证。
- `query_task_link`：query_id、task_id、target_ref／target_hash、created_by、operation_id。unique(scope,query_id)、unique(scope,task_id)，同一问题只有一条权威关联。其task真实context必须匹配该query固定target；前端不能自造关联或任意换任务。关联保留不硬删，当前有效性由实时父链判断。
- `operation`：actor_account_id、request_key、request_hash、action、target_ref、expected_versions、result_refs／receipt、created_at。unique(scope,actor,request_key)；action枚举限定本模块。回执不含答案、raw URL、密码或令牌。实际业务、原AuditLog与本回执同事务。

三表强制RLS／FORCE RLS，绑定当前tenant/group/project，Study父链校验；应用仅USAGE＋SELECT/INSERT，不授UPDATE/DELETE/TRUNCATE／建表权限；上述单一触发器函数只作为表触发器运行，不作为HTTP／SQL业务命令入口；PUBLIC无权，旧public／rh_analysis／rh_study_tasks策略和Prisma迁移历史不改。若现有Run／Artifact app授权不能写，须先提交精确最小复用缺口，不改成elevated业务写绕过。

## 9. API合同（拟议，不是当前已存在端点）

沿当前ResearchStudiesController根路径：`/api/research-studies/:id/quality`，不是另造Hub层级。除下表以外，不复制原回复、更正、审阅、锁定及任务操作API。旧消费者默认／错误格式保持。

| 方法／后缀 | 输入 | 返回／规则 |
| --- | --- | --- |
| GET `/api/research-studies/quality-studies` | q,limit,cursor | 只有合法质量读取Study＋capabilities；不返回无权研究的临床计数 |
| GET `/context` | 无 | Study、合法范围、规则／政策版本、真实capabilities；只在明示有完整统计时含total |
| GET `/queries` | q,status,assignmentId,ruleCode,limit,cursor | 固定target／状态／原更新时间、当前合法任务摘要及安全回链；更新时间倒序，患者详情不进入治理总览 |
| POST `/runs` | requestKey,protocolVersionId,expectedConfigurationHash | 服务器冻结集合，返回runId/status/receipt；范围哈希不由客户端宣称 |
| GET `/runs`、`/runs/:runId` | limit,cursor；id | 授权的历史／固定结果、scope/rules/metric hashes、currentness、finding引用／明确限制 |
| GET `/rules`、`/trends`、`/audit` | protocolVersionId；metric；对象过滤及limit,cursor | 版本化规则、同口径真时间点、Study受限轨迹。统计只从完整固定结果生成 |
| GET `/sdv-items` | assignmentId,status,limit,cursor | 从合法Assignment／字段生成项＋最新事件／历史、candidate sources的安全定位；不从事件返回原件正文 |
| POST `/sdv-events` | requestKey,assignmentId,fieldKey,fixedRef,expectedSequence,sourceRef,decision,reasonCode?,comment? | 当前授权／源hash／CAS通过后追加，返回新sequence/eventId/receipt |
| GET `/sources/:kind/:sourceId` | 安全Range和scope上下文 | Hub受控原件流，当前权限／真实父链／版本／字节hash重验；不直接暴露Storage URL |
| POST `/query-assignments` | requestKey,items[{queryId,expectedTargetHash,expectedQueryVersion,expectedTaskVersion或null}],assigneeAccountId,dueDate | 一次≤50，全部原子；返回各queryId/taskId/version及一个receipt。expectedQueryVersion用服务端提供的journal／行状态摘要，不伪造DataQuery整数version |
| POST `/reports` | requestKey,runId,expectedResultHash | 固定质量Artifact草稿、version/hash、receipt；正文服务器白名单，不接客户端全文 |
| POST `/reports/:artifactId/submissions`、`/reviews`、`/releases` | requestKey,versionNo,expectedContentHash；决定／理由沿旧合同 | 仅质量类型原状态机；提交／审核／允许导出独立，不能合并为自动批准 |
| POST `/reports/:artifactId/exports`；GET `/report-exports/:jobId`、`/file` | requestKey,versionNo,format=docx | 原导出认领／渲染／下载链；错误不伪装空文件或ready |
| GET `/reports`、`/reports/:artifactId` | limit,cursor；id | 当前合法报告／版本状态和只读正文，草稿默认本人／管理员 |
| POST `/explanations`；GET `/explanations/:id` | requestKey,runId,expectedResultHash；id | 仅F01批准后真实调用；复用旧任务／会话与计费，不新建Token账本 |
| GET `/receipts/:requestKey` | key | 本人原操作最小回执、当前同版可读结果；非重复写的恢复入口 |

所有新增列表limit默认20、1–100并有nextCursor，不让“前20条”冒充全量。游标签名绑定身份、Study、过滤和排序；源变化或权限变化先清旧集合再读。详情／列表／导出／AI分别校验capability，不靠UI按钮决定。DTO白名单，拒绝任意accountId／tenantId／scope覆盖。

错误沿现有`{code,message,fieldErrors?}`：401仅登录失效；403当前无权；404不可读／不存在安全合并；409版本／来源／幂等冲突；422内容不完整；429频率资源保护；503未配置／暂不可用。网络／5xx不是退出。写结果未知先GET原key，404不等于未提交；只有明确用户原内容重试才使用同key，永不自动换key重写。

回执读取先核身份和合法对象，不能把命令重放获得历史正文；已提交但现已失权只按允许范围保留提交事实，不交付旧内容／文件。常规页面不展示hash和requestKey，异常恢复仍保留必要入口。

## 10. G02、科研工作台和后台联动

G02 quality适配器只汇总真实可处理对象：open且当前可关闭／复核的疑问（有无回复取真实journal，不把回复变成新状态）、原submitted且未审阅记录，以及已明确分派且到期未验收的质量跟进任务。纯规则warning、正常运行、全部草稿不自动成为管理员待办。没有分派／期限不捏造“待我处理”。

同一问题与其跟进任务用`Study＋queryId＋target版本`去重；主动作仍进入S05固定对象，相关Task显示为跟进关联，不另增一条管理员待办。独立待审答卷按原修订去重，原时间排序／既定完成条件沿七类规则；成功完整读取范围才报总数，失权／部分失败单列，未接不显示0。

S09保留原编辑／审阅／锁定，S08只做关联当前问题的受限回链及必要守门，S05是本轮完整页面主线。不扩做S08新功能、G04全页或旧系统部署。后台从真实父链／scope／版本读取；异步计算、文件、AI的所有提交仍当前授权，历史失效不静默回填。

## 11. 验收与交付判定

| 编号 | 必须观察到的结果 |
| --- | --- |
| V01 真实入口与隔离 | 原owner/admin从正常登录／G02到合法Study；管理员无伪造成员可读，非成员／跨租户拒绝，不回演示数据 |
| V02 六卡与规则 | 固定夹具的整数／分母与独立oracle一致；0/false、draft/missing/null区分；无分级／评分明确缺规则，不编数值 |
| V03 人工闭环 | admin分派→owner在原页回复／更正→admin关闭／审阅；各状态独立，同key无重复，失权／目标修订变化不误处理 |
| V04 SDV | admin原件定位→差异→更正后旧结论需重核→新修订一致；无原件不能确认，owner不能越权确认，源hash／字节改变和未交付流关闭通过 |
| V05 任务一致性 | 批量中一项无权／版本旧／候选人失权整批回滚；保留协作者／依赖；S08原任务完成不关问题，非法换源不继续展示旧关联 |
| V06 真实核查／历史 | 新Run真实执行，非Mock轨迹；Worker支持子集有实际HTTP／版本／返回证据，不适用项明确；三次保存形成真实点／范围变化分段，旧T15分析入口不受影响 |
| V07 质量报告 | 原两角色创建／只读与admin提交审核／单独放行／Word下载；正文／ZIP内部白名单检查排除患者／原件／自由文本；撤权／来源变化不新交付 |
| V08 AI | F01批准后新的通用合成例真实执行，引用可追溯、费用对得上；失权在途不提交；未获费用授权不得用Mock替代销项 |
| V09 恢复与界面 | 超时／断网／409／停用／身份切换／迟到请求；保留合法输入，未知先查回执。1440母版对照＋1920／1366／390／320、原生200%、键盘与弹窗焦点、截图／录屏 |
| V10 文档与用户签收 | 单元＋强制隔离PG集成＋真实HTTP／Chrome、构建和一次独评；living spec／版本／使用说明／API及Notion一致。代码／装配／真实执行／用户专业验收分别记录 |

本稿不宣称这些验收已发生。前序数据只读，不重跑旧初始化器、不写历史任务、不改原角色／账本。不因技术检查通过而标临床或生产验收。逐项测试落点和工期见计划；本期新增费用／权限／旧代码／云／远端配置／真实发布一律先确认。

评审：一次独立只读评审发现2项Important、2项Minor，已由作者按实际源码集中修正（artifacts菜单、open/closed真实状态、租户级PermissionRole引用范围、重分派截止日的edit→assign中间CAS）。未二次独评、未运行业务验收。详见[评审记录](../planning/governance-module-2026-11-12/p4-spec-independent-review-2026-11-13.md)。
