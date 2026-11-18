# S08执行任务整页规格 V0.1 · 2026-11-02

## 2026-11-03 · 当前技术交接状态

已批准01–11实施及本机技术验证收口；独立总评审2项Important经作者修补和真实双账号浏览器回归关闭，无二次复签。创建/分派/执行/验收/提醒/关联及恢复真实接库，8/8具名任务，0模型/外发/发布。固定历史版目标入口不支持时，按本规格展示摘要及明确限制；正式访视不启用。AC10专业用户体验未代签、S10仍暂停；**无需重复批准原范围**，已批准B02纯词表/QueryPlan可按顺序推进。[技术交接](../testing/study-tasks-s08-2026-11-03.md)与[独立评审/作者裁定](../planning/study-tasks-s08-2026-11-02/final-review.md)覆盖下方历史中间状态。

状态：**用户2026-11-02已批准完整规格、UI01–06、S01–S07及11步计划，当前串行实施。**01–02技术门禁通过，03已在专用合成库受控建立两张扩展表、两角色及两条具名任务；尚未完成页面和业务验收。实际状态见[实施台账](../planning/study-tasks-s08-2026-11-02/implementation-progress.md)。配套[管理员长期规则](../decisions/0006-tenant-admin-default-business-authority.md)、[授权清单](../planning/study-tasks-s08-2026-11-02/authorization-scope.md)、[源码证据](../planning/study-tasks-s08-2026-11-02/findings.md)。

## 1. 目标、已确认与设计假设

用户要求：按页面串行，先设计确认并完成S08**全部约定功能**，再进入下一页，不在中途切S10。不得用若干只读接口、禁用占位或原演示成功来销页。S08从“创建分派→执行反馈→提交完成→任务验收→提醒追踪→关联访视”形成真实数据库闭环。

已确认：Study任务管理者创建/分派/验收，科研人员处理本人负责或协作任务；租户管理员长期默认拥有本租户全部Study的完整业务权限，包括临床数据、方案审批、锁库、导出，不是临时验收账号特例。完整能力逐页实现；本页只交付任务及其关联上下文，不顺带开发其他页审批/锁库/导出。

以下推荐设计**已随完整规格一并批准**：

- 角色完整覆盖不等于无条件写入；活跃Study可写，归档/被冻结对象按原规则只读。取消代替物理删除，已验收/已取消任务不任意重开。
- 提醒先实现**S08站内提醒记录的真实收件人可见闭环**，不发送真实邮件/短信、不建通知中心或定时Worker；不写假“已送达”。
- 关联访视采用显式类型区分正式访视和已有合成CRF记录，本片验证只用后者。关联/核对不等于完成访视、改CRF或锁库；不开发S09正式采集。
- 管理员允许本人执行并验收自己的合成任务，明确标记“同人执行与验收，不是独立复核”，保留实际账号审计，不新增用户未要求的双人强制流程。
- 仅已有权限功能对某角色禁用属于正确角色呈现；**有权角色的功能未实现仍是缺口**，不可用禁用按钮当整页完成。

## 2. 本页完整功能清单（逐项交付，不跨页补半截）

| 编号 | 功能与可观察结果 | 关键限制 |
| --- | --- | --- |
| F01 | 从P01/S01原入口及安全深链进入精确Study，展示真实身份/角色与Study | 租户管理员可选择本租户未加入的Study；普通账号无权则403，无默认示例回退 |
| F02 | 列表、选中任务详情、状态/负责人/逾期/待验收筛选，分页、空态/读失败恢复 | 普通科研人员仅本人负责或协作；管理者当前授权Study全部；admin同租户全部，逐个明确scope |
| F03 | 新建手工任务：题名、负责人、截止日；可展开优先级/协作者/前置任务/关联记录 | 必填及首错定位；服务端验证成员/真实父对象；重复提交只创建一次 |
| F04 | 管理者编辑尚未结束任务的题名/截止日/优先级，调整负责人/协作者/前置任务 | 单对象version CAS；不把编辑混成状态变化；待验收/已验收/已取消不静默改派 |
| F05 | 执行者开始、受阻及说明、恢复执行；管理员可代办其他人任务 | 遵守真实状态图和前置任务，普通管理者未被指派时不能替执行者填完成事实 |
| F06 | 提交完成说明/受控证据引用，明确显示“待验收” | requiresReview=true的新手工任务不能直接显示已验收；资料引用不允许任意URL/任意附件 |
| F07 | 任务管理者接受/退回并显示原因/验收人/时间，退回进入继续处理 | 退回必填原因；只验收pending_review，不能跳过前序提交或伪造独立复核 |
| F08 | 取消未结束任务并填写原因，保留记录和任务历史 | 管理者/admin；旧状态图允许时才可取消，无硬删除/任意重开 |
| F09 | 发起站内任务提醒；接收者在S08任务详情能看到提醒记录及发起人/时间 | 收件人按创建时的实际负责人/协作者封存；无有效收件人不成功；不把写通知行当已读/外部送达 |
| F10 | 原「受试者与访视」区展示选中任务的真实关联摘要/固定版本，可关联/更换/解除和回链 | 仅管理者改变关联；权限不足不泄露标识/内容；不改变访视/采集状态 |
| F11 | 操作结果可重查、版本冲突重核、读写失败恢复、慢响应/退出/切账号清私有内容 | 结果不明不自动新建重试；不丢仍有权保存的表单；失权立即清理 |
| F12 | 本任务操作/提醒记录可核对真实操作者、版本及结果，回到同Study | 只读本对象白名单历史，不暴露全租户审计、自由JSON/密钥或他人私有会话 |

不在本页：S10成果/新报告/AI任务、自动调度/批量任务/全局任务中心、真实邮件/短信、正式访视录入、方案审批/锁库/导出实施、跨租户管理员、物理删除、修改旧来源/报告。它们不会被当作S08未实现功能再悄悄加进本片。

## 3. 权限矩阵与管理员自动授权

服务端统一输出`capabilities`，前端仅呈现，不授权。普通Study任务管理能力按现行活跃成员/角色与`study.configure`、`study.review`及现有项目管理者约束判定，执行能力按`study.execute`和真实任务负责/协作归属判定；不能用displayName或用户名判断。

| 操作 | 科研人员 | 当前Study任务管理者 | 当前有效租户管理员 |
| --- | --- | --- | --- |
| 任务列表/详情 | 本人负责/协作 | 本Study全部 | 本租户任一Study全部，无需成员资格 |
| 创建/编辑/分派/关联/取消 | 否 | 本Study | 本租户所选Study |
| 开始/阻塞/恢复/提交完成 | 本人负责/协作 | 仅本人负责/协作且有execute | 可代办任意本租户任务，记录实际actor与代办原因 |
| 接受/退回 | 否 | 有review的本Study | 本租户所选Study；流程不跳过 |
| 提醒 | 本人负责/协作任务 | 本Study任务 | 本租户任务 |
| 关联临床上下文读取 | 自身已有数据Scope，不由任务归属扩大 | 仍按已有数据Scope | 同租户按长期业务最高权限；本页只返回关联摘要，不复制全量数据 |

账号/租户必须当前active且authVersion一致；admin身份从当前DB重验。非管理员仍需组/Study成员、角色及原许可。每次请求保留tenant/group/project实际父链，管理员豁免的是成员/角色授权条件，不是tenant、版本、来源或业务状态条件。服务不可用/能力未装配明示阻断，不显示假成功。

负责人/协作者必须是本Study的活跃参与人，或本租户当前有效管理员（允许管理员在未加入Study时指派给自己），不能隐式添加成员。`study_operations`启用与业务角色分开；admin不能藉此绕过费用/未配置服务。当前本机已按批准的授权清单精确启用；其他环境仍须单独核对，不能自动启用。role与isTenantAdmin按旧共同政策保持一致，脏flag不授予管理员能力。

## 4. 数据、状态及字段规则

复用StudyTask、StudyTaskCollaborator、StudyTaskDependency、StudyNotification及原AuditLog；原task.version为主CAS。新手工任务`source=manual`、`taskType=custom`、requiresReview=true、reviewStatus=not_submitted；本片不让前端伪造正式访视类自动任务。原本已有系统任务可按权限查看/处理，保留其类型、规则、质控修复联动，不复制为手工任务。

状态保留原值：open→in_progress/blocked/cancelled；in_progress→blocked/completed/cancelled；blocked→in_progress/cancelled；completed/cancelled不直接改回。执行提交completed且待验收时呈现“已提交·待验收”；接受→completed/accepted，退回→in_progress/returned。原无需验收的历史任务如实显示not_required，不假装为新规则已验收。开始前所有依赖须满足原完成/验收规则，拒绝跨Study依赖、自依赖和循环依赖。

字段约束：题名trim后1～120字符；负责人单选实际账号ID；截止日按Asia/Shanghai本地日期、必填且真实存在，保存当日23:59:59.999对应UTC，不自动补今天；历史null显示未设置。优先级low/normal/high/urgent默认normal。受阻/取消/代办原因及完成说明最多2000字符，退回/验收备注最多1000字符。完成至少有效说明或受控证据；证据引用最多10项，逐项重验tenant/Study/版本/可读性。URL、存储key和任意对象JSON不能当可提交证据。关联上下文不当作“已提供完成证据”。

实现字段收口：工作证据为`{kind:'artifact_version',artifactId,version,contentHash,sourceSnapshotHash}`，只接受本轮获准账号在当前Study的本人已有草稿（方案、科研/质控报告及合成记录包）固定当前版本，不复制正文/答案。研究者另需现有artifact.read与成员权限；当前有效租户管理员按本页长期规则不需逐Study加入，但本机仍保留本人/两Study范围。引用提交在同一授权锁/事务中重验真实父scope、owner/creator、currentVersionNo及MD内容哈希；已换版/不可读/损坏拒绝，不补造。接收任务不因此读到别人的私有引用，只显示受限说明。固定版本引用不是正式批准或科学有效性认证。

请求体上限32KiB，满足2000字代办原因＋2000字完成说明＋10条引用的合法组合；超限明确400，不把容量错误当作提交成功。关系集合各最多100项且仍受总字节/本轮两账号与8任务限制，不是新批量功能。

### 4.1 最小Hub兼容扩展（已在专用合成库受控建表）

旧Task没有创建幂等键或合成记录关联字段；旧Notification没有收件人快照，不能无改动满足F03/F09/F11。建议**两张只增Hub扩展表**，不复制旧任务/用户/临床数据表、不增服务：

1. `ResearchHubStudyTaskContext`：taskId唯一，tenant/group/project、受控`kind`（none/formal_visit/synthetic_crf_record）、真实父ID与固定版本/hash、创建/更新actor/time。无原始CRF答案或正文副本；context随Task同一version CAS提交，关联本身不改变临床记录。
2. `ResearchHubStudyTaskOperation`：id、tenant/group/project、actorAccountId、requestKey、requestHash、action、taskId、expectedVersion/resultVersion、最小结果receipt、受控动作原因（取消/管理员代办等）、提醒时冻结recipientAccountIds与notice摘要、createdAt。唯一键为tenant/group/project/actor/requestKey；提交与Task/关系/Notification/Audit同一事务。记录不包含完整请求正文或临床数据；原Task不保存的取消/代办原因在此和最小审计中持久保留，F12按当前权限投影，不只在浏览器显示。

此表同时承担精确请求回执与站内提醒事件，提醒接收者读取仅限recipient快照且当前仍可读该任务；原Notification关联行保留实际状态`recorded`或等价明确非送达状态，不调用原直接写sent的捷径。无需已读回执/邮件Worker，新表有tenant RLS及受控唯一迁移；旧数据不回填，原API/默认行为兼容。实际表名/索引/字段由批准后的实施计划收口，若必须超过上述两张表或另改旧Schema先报告，不在实施中扩容。

### 4.2 关联访视与完整页面边界

正式`subjectVisitId/enrollmentId`仅接真实正式对象，不能把Artifact/合成记录ID写入旧FK。合成关联固定plan→collection→record及版本/hash，复用既有包核对逻辑；选项只返回当前角色真实可读的记录摘要。本机只对本轮新任务建立关联，前序计划/包/CRF/报告只读，不复制或修改它们。

原第二Panel在选中任务后显示关联类型、合成/正式标记、记录版本与当前可读状态。没有关联就显示“尚未关联”，管理者可选择真实记录；合成对象只在已有目标支持当前账号固定版本时回链，否则在本Panel读版本化摘要并明确目标限制，不跳到演示S09。原“录入演示访视”位置的按钮改为“打开关联访视/记录”，仅导航已有授权采集入口；该文案/语义适配须随UI清单明确批准。关联或任务完成不等于访视已完成。

## 5. 后端边界与API契约

采用**Hub有界S08适配层＋旧任务政策/服务最小复用**。不挂载整个旧study-operations Controller；不为租户管理员全局短路StudyGroupGuard；不伪造assignee账号调用旧服务。旧listMyTasks包含本人创建未分派项且回传自由对象，不能直接当新DTO。

旧更新/分派/验收有version与质控修复联动，但缺Hub当前授权/幂等和管理员代办分支。允许本规格申请的最小兼容路径：对旧Task服务增加**内部、同事务、当前身份校验的任务授权入口**，缺省旧调用仍走原路径；共享原业务状态与RemediationCase同步，不把这些副作用删掉。旧公开方法自行开启事务，不能由Hub外层事务嵌套调用来冒充原子性；抽出接收既有TransactionClient的最小任务核心，旧入口包原事务调用该核心，Hub入口在当前授权/回执同一事务中调用。受控能力须覆盖管理者取消他人任务以及管理员代办，不能沿用仅assignee/collaborator校验阻挡获准管理动作；执行/取消/验收仍按各自动作矩阵，不混成无限execute绕过。入口只接受服务端受控context，不接受客户端`admin=true`、伪造角色或改user.accountId。需要修改旧非任务模块/全局Guard或无法保留原质控修复联动时停下，不扩大底座。该兼容点已随完整规格批准，实际实施依小步计划门禁推进。

所有读写都用现有同源会话与双scope请求头，继承现行Origin/CSRF守门及安全Cookie策略，不为本页放宽、不让GET改变业务状态。先持原授权锁、核对当前actor/tenant/Study/权限和真实Task，再锁Task及有序依赖、重读version，最后提交业务行、Hub扩展、原审计/联动。锁顺序固定，包含管理员标记/成员/角色/feature变更的当前授权重验；不能在外部异步读取后沿用旧授权提交。

| 方法（`/api`前缀） | 最小输入/输出 |
| --- | --- |
| GET `/study-tasks/studies` | 当前可进入的Study最小id/name/status，admin为本租户全部；仅q/limit/cursor，不曝光全租户成员资料 |
| GET `/study-tasks/context` | 已选scope、真实身份说明、capabilities、角色可见的关联类型；不由前端推断管理员 |
| GET `/study-tasks` | query仅q/status/reviewStatus/assigneeAccountId/overdue/limit/cursor；普通账号强制本人负责或协作，不能用assignee改宽 |
| GET `/study-tasks/:id` | 受控详情、Task version、已授权关联摘要、可执行动作和最近操作/提醒记录；不返回整个Prisma对象 |
| GET `/study-tasks/participants` | 仅本Study活跃参与人及本租户有效管理员的id/displayName，分页；不含密码/邮箱/手机号 |
| GET `/study-tasks/link-options` | kind与分页/已校验父选择，真实可读关联记录摘要，不交付原始答案；`kind=completion_evidence`仅分页/搜索本人工作证据版本候选，不是可写TaskContext的kind |
| POST `/study-tasks` | requestKey、name、assigneeAccountId、dueDate、可选priority/collaborators/dependencies/context；返回taskId/version/receipt |
| PATCH `/study-tasks/:id` | requestKey、expectedVersion及元数据白名单；不允许混入status/review/owner/tenant |
| POST `/study-tasks/:id/assignments` | requestKey、expectedVersion、负责人/协作者/前置任务精确ID集合 |
| POST `/study-tasks/:id/transitions` | requestKey、expectedVersion、目标状态、相应原因/完成说明/受控证据；admin代办必有原因 |
| POST `/study-tasks/:id/reviews` | requestKey、expectedVersion、accept/return与备注；只在当前待验收状态 |
| POST `/study-tasks/:id/reminders` | requestKey、expectedVersion，不允许客户端传收件人或sent状态；后端解析当前真实收件人并封存 |
| PUT `/study-tasks/:id/context` | requestKey、expectedVersion、受控context；kind=none显式解除 |
| GET `/study-tasks/operations/:requestKey` | 当前actor自己的已提交最小回执，仍需能读目标任务；404仅表示未查到已提交回执，不当作操作必未发生 |

详情列表字段固定：id/name/status/reviewStatus/priority、负责人/协作者显示名、dueAt/overdue、version、关联摘要及capabilities；详情按角色补允许读取的说明/依赖/验收记录。所有动作response含实际taskId/version/operationId，不直接返回旧服务全对象。普通科研人员依赖若不可读，仅说明前置未满足，不泄露他人题名。

列表默认20、limit整数1～20；q trim后≤120。createdAt DESC,id DESC稳定keyset，cursor不透明且签名绑定tenant/actor/Study/过滤，未知/重复/超长参数400。负责人筛选限服务端可见集合，日期/状态不信任前端计算；不返回越权总量。固定路径优先注册，operations/participants不误匹配:id。

创建/全部修改须requestKey（8～128字母数字_-）及非创建动作必填非负expectedVersion。相同键同requestHash且当前仍获准时返回同一最小回执，不重复Task/版本/通知/审计；相同键不同请求409。实际提交与回执同事务：无回执则不能出现已提交业务结果。未知响应先GET查回执，不自动换key重放。

沿用`{code,message,fieldErrors?}`：400输入/参数；401会话；403当前权限/不可读对象（不暴露外租户存在性）；409版本/状态/来源/幂等冲突；429有界容量/提醒频率；503依赖不可用。写冲突不自动覆盖，读失败不是空数据。私有响应no-store、正文只React转义、安全同源返回、不持久化到demo-store/localStorage。审计记录真实actor、admin来源/代办、对象Scope/前后版本及操作结果。

## 6. 保持原布局与待批准的最小交互差异

母版：`WorkflowPages.jsx`的TaskBoard＋原CSS；R1-01已保存[1440/390基准](../testing/own-tasks-method-reports-preflight-2026-11-02.md)。保留Frozen Shell、原Study导航/返回位置、两个Panel顺序、原两列网格中的题名→负责人→截止日三个主字段、保存按钮和原列表位置；不改成新看板/工作台/新侧栏，不改一级导航。实施前核图发现原文“三列”误述：原CSS及1440截图均为两列，首行题名/负责人，次行截止日/保存；按真实母版纠正文义，不改变设计。

| 差异编号 | 原样→拟改样（**已随本规格批准，禁止超范围**） | 理由与影响 |
| --- | --- | --- |
| UI01 | 负责人自由文本→同槽位真实账号下拉；“保存演示任务”→“创建任务/保存修改” | 避免任意文字冒充成员；不改变三个字段顺序、原两列网格和主按钮位置 |
| UI02 | 原表单内按需展开协作者/前置任务/关联/优先级，行内新增取消编辑/真实保存状态 | 完整分派/编辑所需，不另加Panel；自然增高，不压缩字号或裁切 |
| UI03 | 原列表行原位选中/展开详情；状态select只给合法转换，完成/受阻/取消/验收/提醒用行内动作区及必要原因字段 | 不将下拉直接提交等同自动验收，选择状态后明确确认；无新弹窗/侧栏，读写失败同区域恢复 |
| UI04 | 列表自身顶部放轻量筛选/刷新、底部上一页/下一页，选中/返回保留筛选与cursor | 新增必要列表交互，不增加统计卡/跨页任务中心 |
| UI05 | 原受试者与访视Panel改真实关联摘要，原按钮改“打开关联访视/记录” | 不伪造临床内容，不自动打开演示S09；正式采集不是本页职责 |
| UI06 | 原页头现有动作行内增加“切换Study”受控选择入口，仅S08消费 | 让未入组的租户管理员真实选到其租户Study，而不是只有理论权限；不改Shell尺寸/页面标题布局，窄屏按原动作换行 |

只有本地化增量；“保持布局”不伪称这些为零交互变化。凡超出UI01–06的布局/业务变动再确认。操作/说明14/22，低优先级元数据≥12/18，长篇完成说明若显式阅读区16/28；不用缩字适配。表单首次不报错，提交后聚焦错误摘要/首错并与字段就近错误关联；不在每次失焦抢焦点。仅真实编辑差异拦离开，取消恢复服务端原值。

科研人员路径：P01→当前Study→S08→找到本人/协作任务→开始/受阻/完成说明→提交后见待验收/退回原因→看提醒/关联→回同一Study。管理者路径：同页创建→真实分派→核对进度→提醒→接受/退回→核对历史。租户管理员另验未加入Study仍可上述操作与代办，不把权限移交给前端。所有路径都测返回、慢请求、失权、丢回执恢复。

## 7. 全页验收门槛

| AC | 必须真实证明的结果 |
| --- | --- |
| AC01 | F01–F12逐项有后端+前端+真实数据库结果；获准角色无施工占位，未授权角色正确拒绝 |
| AC02 | 三角色权限矩阵、同租户未入组管理员、管理员标记撤销/过期会话、跨租户与URL/ID/成员篡改反例均有证据 |
| AC03 | 新建/编辑/分派/协作/依赖/取消全链，CAS/幂等/丢回执、循环依赖及旧任务来源类型不变 |
| AC04 | 开始→受阻→恢复→提交→退回→重新提交→接受全过程；不把待验收当已验收，不改CRF/访视或来源事实 |
| AC05 | 接收者在S08读到真实提醒，去重/冻结收件人正确，原sent不冒充交付，无邮件/短信/模型请求 |
| AC06 | 真合成关联/换绑/解除/固定版本摘要，越权/版本变化即受限；既有可用回链可打开且返回同Study，不落演示S09 |
| AC07 | 当前授权、真实父链、version与任务/关系/回执/通知/审计及原质控修复副作用同事务；失权在途不能提交 |
| AC08 | 同视口比较原母版，仅UI01–06获准增量；1440/1280/390/320、原生200%、键盘、错误焦点、长标题和截图/录屏；未测不销项 |
| AC09 | 新单元/合成PG/API集成/真实浏览器＋原任务/主链回归、构建和唯一独立代码总评审；旧服务/原角色/前序资料/费用保全，具名新数据可核对 |
| AC10 | 用户可用真实身份完成管理与执行路径并确认体验；代码/环境/真实请求/用户效果四层分列，不以测试全绿代签 |

文档同步产品基线/变更/版本/使用说明/专项/Notion；S08全部验收项完成或用户明确调整约定范围之前，**不启动S10**。本页不产科学数值或新模型结果。

## 8. 结构、命令与工期估算

沿用NestJS/Prisma/PostgreSQL、React/Vite和现有公共Button/样式，无新框架/云资源。预计Hub有界模块在`server/study-tasks/`，S08组件/DTO按页独立；旧Task服务仅批准的内部兼容点，迁移沿唯一受控链。输入/输出分离，显式动作枚举，参考：

```ts
type TaskAction = 'create' | 'edit' | 'assign' | 'transition' | 'review' | 'remind' | 'link';
type TaskReceipt = { operationId: string; taskId: string; version: number };
// actor/scope/capabilities由服务端当前授权解析，不能放进客户端可覆盖的请求体。
```

后续具体命令落入批准后的实施计划，现有可验证基线为`node --test tests/*.test.mjs src/*.test.mjs`、`node --test scripts/r1-task-fixtures.test.mjs`、`pnpm build`；新增PG/API driver须显式`--mode local-synthetic`并用fixture guard，不能自动运行旧付费/数据生成driver。

估算：**4个工作日实施/联调/技术验收＋1天同范围缓冲**；此前R1两页只读2～3天估算不适用本整页。先半天验证旧任务内部兼容与新表必要性，不成立报精确缺口，不把底座改造扩散。11月中旬目标保持，但其余页面/临床/审批/锁库/导出未因此完成；11/04、11/06据实际余量复估，不保证全站仅靠本页即可交付。

完整规格及[11步计划](../planning/study-tasks-s08-2026-11-02/implementation-plan.md)已批准并执行；实际配置、测试和缺口以实施台账为准。首半天同事务复用已通过技术证明，独立代码总评审留11；原独立设计评审见[评审记录](../planning/study-tasks-s08-2026-11-02/review.md)，不等于最终代码/真实浏览器或用户业务验收。
