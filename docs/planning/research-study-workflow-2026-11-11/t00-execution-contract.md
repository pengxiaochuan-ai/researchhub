# T00 · 正式执行、答卷修订与分析基准交接契约

日期2026-11-11。用途：供T05–T09及其T10–T17消费者实施，补齐[t00-creation-contract.md](t00-creation-contract.md)未覆盖的临床执行部分。本文冻结工程语义及复用边界，不代表新表/API/能力已上线；涉及新增公共模型的DDL仍由相应任务列出并经代码/迁移评审后执行。本次仅写本文与独立T04迁移预审，没有操作数据库、服务、角色、模型或渠道。

## 1. 已核实事实及本契约的范围

- 现有执行链是公共`ResearchProject→StudyProtocolVersion→StudyEnrollment→SubjectVisit→FormAssignment→FormResponse`。Hub `rh_research.study_binding`只提供产品Study到旧执行容器的映射，不能再建一套Subject/Enrollment/EDC。
- `ResearchProjectMembership.roleKey`的既有写入白名单是`project_manager/researcher/data_manager`；课题组`PermissionRole.key`内置有`pi/researcher/data_entry/monitor/data_admin/readonly`，两层不可混称。实际授权必须读取当前有效角色的menuPermissions/buttonPermissions，不能假定名称等于一组固定权限。
- `StudyGroupGuard`要求当前课题组成员、菜单/按钮及当前项目成员；`PROJECT_MANAGER_REQUIRED_PERMISSIONS`额外要求project_manager。旧Guard并没有全面实现ADR-0006管理员免逐项目成员；Hub的正式操作适配需实现该明确例外，不能裸调Service后宣称自动继承。
- Hub创建解析器当前仅read/configure，siteId明确拒绝；Hub owner关系本身没有赋予PI/采集/审阅身份。创建者project_manager成员也不自动满足form.fill/study.execute。
- 公共schema当前没有StudySite/中心成员/盲态策略模型；`StudyEnrollment`有status/withdrawnAt/withdrawReason，却没有版本化筛选及研究同意事实。`Subject.consentScope`是文本，`ParticipantConsent`是purpose/channel/status/grantedAt/withdrawnAt，没有研究同意版本/证据。
- FormAssignment已有subject/enrollment/visit/participant/formVersion关联；FormResponse每assignment唯一，当前仅answers/score/status/submittedBy，尚无不可变修订和审阅签署。现场`StudyFormsService.writeAnswers`与H5`StudyOutreachService.saveH5Session`各自更新同表和访视要求满足记录，必须一起兼容。
- 既有DQ manifest主要基于Subject/Enrollment/Visit/ScaleResult/File/Feature与计数；正式答卷答案没有自动成为分析变量。现有ResearchMethodRun、DataQualityReleaseGate和ResearchArtifact版本/来源继续复用。

主要源码依据（工作区根）：`app/server/prisma/schema.prisma`、`src/common/permission-catalog.ts`、`src/common/guards/study-group.guard.ts`、`src/study-groups/study-groups.controller.ts`、`prisma/seed.ts`、`src/tenants/tenants.service.ts`、`src/study-operations/{study-operations.controller,study-forms.controller,study-forms.service,study-outreach.service,study-task-authority}.ts`、`src/research-methods/{research-method-quality-manifest,data-quality-release.service,research-methods.service}.ts`。这些`src/`和`prisma/`均相对`app/server/`。

## 2. ClinicalContext：同一身份、范围和事务

以下是内部交接类型，不是可由客户端提交的授权凭据，不是新增权限字符串目录：

```ts
type ClinicalContext = {
  tenantId: string; studyGroupId: string; executionProjectId: string;
  projectIntentId: string; studyId: string;
  actor: { kind: 'account'; accountId: string; authVersion: number }
       | { kind: 'questionnaire_session'; sessionRecordId: string; assignmentId: string };
  operation: ClinicalOperation;
  authority: { source: 'tenant_admin' | 'membership' | 'hub_configuration';
    projectRoleKey: string | null; effectivePermissionKeys: string[] };
  siteScope: { mode: 'unconfigured' | 'study_wide' | 'restricted_sites';
    policyVersionId: string | null; allowedSiteIds: string[] };
  policy: { executionPolicyVersionId: string | null; status: 'missing' | 'draft' | 'active' | 'superseded';
    consentPolicyVersionId: string | null; blindingPolicyVersionId: string | null };
  protocolVersionId: string | null;
};
```

`ClinicalOperation`为命令分类，例如protocol.configure、enrollment.enroll、response.submit；服务端逐项映射第3节**现有**权限，不向PermissionRole写入这些新操作名。创建阶段read/configure仍保留，不因新类型定义自动开放其他操作。

事务次序固定：Hub session核验→锁当前租户授权→当前account/tenant/authVersion/角色一致性→从studyId查真实绑定/活跃组及执行项目→核对本次对象真实父链→操作权限/功能启用→中心/盲态/方案/同意/状态/版本→执行与回执/审计同tx提交。客户端传来的actor、tenant、group、executionProjectId、site权限或capability均不能覆盖服务端事实。

`withResearchStudyTransaction`内部向旧业务最小tx核心交接同一个tx，不再嵌套forTenant或forTenantTransaction。需要外部Worker/渠道时，创建请求与输入快照先提交，外部调用不持长事务；结果发布再开当前授权事务重验。沿用现有授权锁/Worker运行与发布规则，不建第二个队列内核。

H5 actor由一次性邀请兑换后的当前受限会话解析，只能访问对应assignment；不赋研究账号role、不伪造PI、不直接接受tenant/Study。旧elevated事务必须显式检查每个父链和当前同意，进入共同答卷核心前设置实际受控范围；原令牌及联系方式不进入日志、分析或报告。

## 3. 操作到实际权限的映射

所有普通成员仍需活跃组/角色及当前执行项目成员。下表的菜单与feature来自现有Controller；最终实现须重复当前检查，不复制前端标签。管理员按ADR-0006免成员/普通角色按钮障碍，仍检查本租户真实对象、服务能力、方案、同意、盲态、状态、版本与审计。

| 内部操作/用途 | 普通成员现有按钮、菜单及项目角色条件 | 必须额外守门 |
| --- | --- | --- |
| protocol.configure（仅配置草稿） | 保留当前canonical有效tenant_admin、精确绑定该Hub+组的明确Hub owner；普通project_manager另查当前有效组角色的study.configure及workbench；所有身份同tx检查study_operations | Hub owner无需伪加组成员，仅授configure，不变成PI；nullable配置允许草稿缺项，保存后原样回读 |
| protocol.submit/approve/activate | 普通成员workbench + study.configure + project_manager；study_operations；tenant_admin遵循ADR-0006 | 不是仅Hub owner配置权的扩展；审批责任/独立复核按已确认政策，批准/启用必须通过时间/政策/版本检查 |
| form.manage/publish | workbench + form.manage；study_operations | 当前发布版本不可原地改；模板/量表适用性和方式确认；不能由configure单独代替 |
| scale.manage | 现有scale-governance Controller的scale.manage及其菜单/feature约束 | 专业规则、版本/使用依据、适用范围和确定性计分；无规则不计分 |
| subject.create/update | subjects + subject.create或subject.edit | 假名编号/重复规则/本研究父链；不是入组 |
| enrollment.enroll/anchor/withdraw | workbench + study.execute；study_operations | 筛选、有效研究/数据使用同意、执行方案、中心；withdraw是拟新增业务命令，沿用执行权限并核对政策责任，不自动“删除被试” |
| response.assign/draft/submit | workbench + form.fill；study_operations | 已发布定义、本次分配/访视/允许填写方式、有效同意、当前版本/未锁；更正不由普通draft入口绕行 |
| response.correct | workbench + form.fill；study_operations；另须策略允许该actor更正当前记录 | 必须有原因、expectedRevision/ref、当前未锁或已授权解锁；不能因为有form.fill就默许改所有已提交记录 |
| response.review/lock/unlock，visit.verify/complete，query.close | workbench + study.review + project_manager；study_operations | 复用既有review语义；审阅/锁定必须绑定固定revision，独立复核是否必需取政策；不能凭data_manager名称越过 |
| query.create/reply、visit.execute/attest | workbench + study.execute；study_operations | 普通回复不等于关闭；人工满足/不适用按已有verify和方案规则 |
| outreach.manage/send | workbench + participant.outreach；study_operations和participant_h5 | 有效研究/渠道同意、填写方式、获准渠道、限频/去重和真实发送授权；指定测试收件人已授权，真实投递仍待实现与验证 |
| import.confirm/file.upload | 现有data.upload及对应菜单；导入正式答卷另需form.fill；study_operations用于采集链 | 当前访视/字典/批次预检、数据来源和同意；upload本身不是临床结果已通过 |
| quality.release/waiver | 现有data.release / data.release.override及原质量Controller菜单/守门 | waiver不改变原始值；原因/范围/有效期及固定manifest；不能绕过不允许使用的数据 |
| analysis.execute | 现有data.analyze、实际MethodsService入口/Agent/Skill授权 | 固定AnalysisBasis、质量与使用范围、真实算子已配置；新操作名不是新角色权限 |
| artifact.create/review/release/export | 现有artifact.create/review/release/export及artifacts菜单；review/release需要project_manager | 固定来源Run/快照；导出前当前范围重验；data.export与artifact.export各自按旧入口，不相互冒充 |

Hub owner仅作为已有创建/configure范围的授权来源；精确绑定当前Hub+组且仍有效时配置草稿不要求伪加组成员，但与其他身份一样在同tx检查study_operations。其关系不能转成`studyGroupRoleKey='pi'`，不能给context塞满按钮，更不能写假成员。若Hub owner同时有真实成员/角色，就按真实权限核验；若只有Hub关系，则approve/collect/review/unblind不因configure而可用，显示对应未获授权操作。产品长期Hub负责人职责需要后续显式适配时，必须列出具体操作和实际身份来源，不以一句“owner全权”绕过本契约。

内置角色容易误读的事实：group `pi`与project `project_manager`是两层；project `data_manager`与group `data_admin`不同。当前seed中monitor/data_admin虽然含部分review/configure按钮但没有workbench菜单，不能仅据角色名开放旧workbench动作；以当前配置为准。seed与租户创建服务的remediation权限列表也有差异，本轮不自动重seed/扩权。

`study_operations/participant_h5`是实际服务启用前提，不允许将用户核心能力设计为默认关闭的静默旁路。缺配置时返回明确阻断并在目标环境台账登记；不可凭管理员权限绕过缺失服务，也不可宣称功能已完成。

## 4. 中心与盲态配置边界

公共schema没有可直接复用的site身份。本轮不把StudyGroup当临床中心，不从显示名/医院字符串推断site，不把缺siteId解释为“所有中心”。

最小交接为版本化执行政策里的siteScope，初始unconfigured。团队明确单中心/本研究统一范围后才可设study_wide并记录依据；需要多中心时，使用明确site ID及成员/记录site绑定，所有Subject/Enrollment/Visit/Assignment父链一致。该真实多中心映射的DDL、维护入口与责任尚待具体材料；在落地前restricted_sites操作返回未配置，不能只根据客户端siteId过滤。

盲态政策同样初始missing/draft。已确认不需盲态应保存not_required决定与依据/责任/日期，不把字段缺省当非盲。需要盲态时配置受限字段/组别、角色或职责视图、适用对象、输出/导出视图、必要揭盲方式与责任；若必要机制未实现，阻断该研究启用。PI/管理员业务权限不自动等于允许提前看组别，遵循研究已确认的盲态访问政策。

同一视图约束必须覆盖列表/计数、API错误、候选关联、来源详情、变量投影、Worker输入、报告/AI上下文、导出和下载。脱敏/盲态只在前端隐藏不成立。当前中心/盲态配置变更使相关context失效，排队/在途发布前重新解析，不复用旧允许标志。

## 5. 研究政策和参与事实：配置而非编造

### 5.1 政策版本

最小新增逻辑对象为`StudyExecutionPolicyVersion`，归属于现有executionProject/ProtocolVersion，不新增独立研究平台。它仅保存明确材料的版本引用、结构化规则与审核记录；物理公共扩展由T05评审确定，不能藏进某个VisitRequirement.config作为全Study暗门，也不把普通备注当授权。

每个版本至少包括：政策版本ID/版本号、绑定ProtocolVersion、status、来源材料引用/摘要、录入/审核actor和时间，以及以下分别有状态的部分：

| 部分 | 必须保存的工程信息 | 未提供时 |
| --- | --- | --- |
| 纳排/筛选 | 团队提供的条目/版本、人工判断或审核确定性规则、依据记录要求 | 未确认；不得由LLM自动给合格结论 |
| 研究参与同意/豁免 | 适用研究、有效文本版本、需收集的事件/证据、获准豁免决定引用 | missing；阻断正式入组 |
| 数据使用 | 当前采集/处理/分析/报告/导出用途与范围、材料版本 | missing；阻断相应用途，不因已参与研究自动允许所有处理 |
| 撤回/退出 | 生效时间含义、停止新采集/触达、历史保留及未来利用/已产成果/已交付文件处置 | missing；不得默许继续新用，也不自动删除历史 |
| 中心/盲态/职责 | 第4节明确定义、必要审核责任/分工 | 未配置；不得默认“无需” |
| 采集/更正/审阅 | 谁可更正、原因要求、锁定范围、谁可解锁、是否要求独立复核 | 草稿可保存；正式提交/更正/锁定在政策完整前不启用 |
| 安全事件流程 | 团队提供的适用流程和责任引用，是否本研究启用必要条件 | 不自造危机时限、诊断规则或外部联系人 |

草稿状态可以缺项；只有确认材料齐备且当前授权审核后active。`not_applicable/not_required`必须是有理由、有来源、有责任人的明确决定，不能初始化为通过。新的policyVersion不覆盖既有执行事实；旧入组是否转版由显式影响预览和批准决定。用户已确认通用合成案例包含现场、H5和CSV，首项为描述统计；这不构成真实研究SAP或临床政策批准。

### 5.2 参与/同意事件

最小新增逻辑对象`StudyParticipationEvent`挂现有Subject/Enrollment，保存append-only事实：screening、research_consent、data_use_consent、waiver_decision、withdrawal、exit、completion；每类事件有结构化schema，不能任意JSON当无校验事件。最少字段为scope、subject/enrollment、event kind、policyVersionId、decision/status、effectiveAt、recordedAt、实际actor、依据引用、reason以及supersedesEventId。

现有StudyEnrollment继续是执行状态入口；事件为证据与当前投影依据，不创建第二Enrollment。当前同意/筛选指针或投影由同一事务更新，所有采集/处理命令重验。历史同意无版本/证据时标unknown，不给旧consentScope文本自动补造版本；本轮只处理新案例，不批量迁移旧患者事实。

`ParticipantConsent`继续管理purpose/channel触达同意，不能替代研究或数据使用同意；其撤回也必须停止相关发送/邀请/会话。个人同意事件中的签署/授权主体与系统录入账号分别记，不伪造电子签名或声称录入账号就是签署人。

退出研究、撤回某用途同意、失访和完成是不同事件；逾期不自动失访。研究臂armCode只是字段，不能宣称完成随机化；方案要求随机化/揭盲但未有机制时明确阻断。

## 6. 正式答卷唯一模型与共同写入核心

### 6.1 身份和不变量

继续使用公共`FormTemplate/FormVersion/FormAssignment/FormResponse`，不在`rh_research`或ArtifactVersion另建正式答卷。新增最小公共子对象`FormResponseRevision`，候选物理名`public.form_response_revision`；FormResponse保留assignment唯一身份，并增当前修订指针及CAS版本。定义/迁移沿`app/server/prisma`唯一链；不在服务启动时自动创建。

```ts
type FormalResponseRef = {
  responseId: string; assignmentId: string;
  revisionNo: number; contentHash: string;
};
```

每revision至少绑定scope、response/assignment、formVersion、subject/enrollment/visit（由assignment查，不信客户端）、规范化answers/score与其算法版本、原始来源方式、previousRevision、reason/差异、actor、createdAt、contentHash。唯一键`(responseId, revisionNo)`；hash由明确canonical规则和定义版本计算，不因审阅状态变化重写原hash。0、false、缺失/未测/不适用/未知分离；未支持计分规则的score是明确未计分，不是零分。

草稿可更新，但必须CAS防双窗口覆盖；首次提交创建revision 1。提交后更正只能追加revision，current指针CAS推进，原版不可覆盖/删除。现有FormResponse.answers/score如为旧兼容保留，只能作为当前revision的同事务投影，不再成为第二可独立修改的事实源。新增正式接口返回ref；旧读接口可返回当前投影，但不得让旧读取伪装已绑定历史版本。

旧已有submitted响应无revision时不批量伪造历史。需要纳入新修订/分析链的具体记录，必须经受控兼容步骤固化当时可核验的现存值为baseline revision，注明legacy_baseline及真实登记时间，保留原submittedAt来源，不补造原审阅/作者/同意。未完成该步骤的旧响应标legacy_unversioned，不作为新快照的固定来源。本轮新案例不需要迁移旧历史研究。

### 6.2 同一个事务核心

内部共用核心建议语义为`writeFormalResponseInTransaction(tx, resolvedContext, command)`；由现有StudyFormsService现场写入、StudyOutreachService的H5保存/提交及T13导入调用。名称可沿旧模块风格，不为名称新增服务内核。

核心必须按同序执行：锁assignment/response→核对当前actor或受限会话、完整父链、当前policy/同意/中心/盲态→核对发布定义/填写模式/未锁与expectedVersion/ref→normalizeAndValidateAnswers及适用确定性计分→写草稿或新增revision→更新current兼容投影→绑定特定VisitRequirement证据ref→失效旧审阅与当前质量基准→写幂等回执/审计→提交。

H5的session/invitation提交占用与上述响应提交在同tx内；异常必须全部回滚。重复请求同键同输入返回原ref，异输入冲突；提交超时先查回执，不能另开新响应。旧已提交拒改行为保留，只有显式correct命令可更正；不能在旧writeAnswers里简单删除FORM_ALREADY_SUBMITTED检查。

`satisfyBoundVisitFormRequirements`现场/H5当前有重复实现，后续仅保留一个共享核心并改引用为固定FormalResponseRef。匹配必须核对当前研究/Subject/Enrollment/Visit/发布FormVersion以及具体requirement；只匹配template key可能把新旧定义混用，应按已冻结方案适用版本判定。提交只满足对应采集要求，不等于审阅通过或访视完成。

## 7. 审阅、锁定、解锁与访视完成

新增最小`FormResponseReview`/锁定事件挂同一response及固定revision，不以Artifact审核替代答卷审阅。保留reviewer、时间、decision、reason、policyVersion、FormalResponseRef及审计关联。review通过后新revision不继承签署；历史review不删除，只标已不适用于当前revision。

锁定范围显式为response/visit/分析数据集之一；不能一个布尔值含糊锁整个Study。普通draft/correct遇锁拒绝；unlock须现有study.review + project_manager或当前tenant_admin、政策许可、理由及影响预览。是否必须另一人复核由团队政策决定，工程不默认强制全部研究双签，也不能默许自审。

旧completeVisit继续作为唯一访视完成入口；同时核对本次要求、当前证据版本、独立核验/审阅条件和日程状态。任务accepted、表单submitted、文件uploaded分别只是来源事实，不能替代完成。先锁当前访视版本、固定源refs，检查后推进；更正已完成访视涉及的证据应使“当前完成依据待复核”，保留历史completed事实/审计，不静默擦掉已发生访视。

T04 nullable另见[t04-nullable-migration-review.md](t04-nullable-migration-review.md)：未知配置和待锚点事件严格区分，发布/启用、入组及依赖日程计算都需守门。

## 8. AnalysisBasis及失效传播

### 8.1 固定输入与当前适用性分开

```ts
type AnalysisBasis = {
  studyId: string; snapshotId: string; manifestHash: string;
  protocolVersionId: string; sapVersion: string; variableMapVersion: string;
  executionPolicyVersionId: string; consentViewHash: string; blindingViewHash: string;
  qualityGateId: string; qualityGateVersion: number;
};
```

每个快照固定纳入/排除对象、截止时间、Subject/Visit统计单位、变量/单位/缺失语义、每值FormalResponseRef或明确量表/文件/特征版本、规则/映射版本、质量规则与放行以及允许的数据视图。不得仅把问卷提交份数写入manifest后称答案已入分析；不得套旧case/control Feature查询。快照内容不可变，当前可用状态是独立治理事实。

最小新增逻辑对象`StudyAnalysisSnapshot`承接正式变量及manifest，不复用ResearchAgentStageSnapshot冒充研究数据集。复用DataQualityReleaseGate/ResearchMethodRun/ResearchArtifactSource，但需明确它们引用这个snapshot和版本。质量门必须绑定范围和manifest，不是全Study计数；旧DQ阈值只有经过本研究确认才适用。新的source ref类型及mapper随T15–T17补齐，不假定JSON里塞ID就实现契约。

### 8.2 当前失效规则

| 事件 | 立即影响 | 后续重验与恢复 |
| --- | --- | --- |
| 答卷更正/量表规则或变量映射换版 | 当前revision/映射指针变化，受影响review/fulfillment/quality依据不再当前 | 旧快照保持历史，新的正式分析需新快照/放行/运行；旧结果标旧基准，不重写原数值 |
| 同意撤回/用途收窄/退出限制 | 禁止政策不允许的新采集/邀请/发送/处理；撤销对应未使用邀请与会话 | queued/running不能只靠创建时同意继续发布；snapshot/read/export按当前政策重新筛选或阻断。历史保留/删除按明确决定，不自动物理删除 |
| 撤权/中心或盲态改变 | 当前context无效，私有读取与写入受新范围约束 | Worker结果写回、报告/导出创建与文件下载前重验；不把旧token/旧签名当永远授权 |
| 新Protocol或SAP生效 | 不改旧入组/快照版本；标当前默认版本变化 | 历史迁移明确批准；新分析选择实际适用版本，不把旧结果标成新版结果 |
| 锁定解除、疑问重开或质量豁免撤销 | 当前放行失效或受限，保留历史签署和原因 | 重新更正/审阅/质控/放行后新建基准；不得只在UI显示警告而继续导出 |
| 已生成/已交付报告受限 | 报告来源历史保留；当前访问/再次交付遵循最新政策 | 尚未交付文件可阻断；已被外部下载不能承诺技术收回，记录已交付清单与团队处置决定 |

失效事件与源更正在同tx记录；最小策略可对本研究当前基准整体标stale，避免漏掉受影响变量，但用户需看到失效原因和重做范围，不复制数据。若用后台传播，发布/读取仍须同步核对来源版本/政策，不等待异步任务才保护访问。

数值运行状态与适用性分开：成功Run随后因来源更正变旧基准，不能把completed覆盖为failed以销毁事实；未获得当前允许范围的结果不得成为当前可交付产物。LLM只能解释已有确定性Run输出，本轮不授权外部模型调用；没有模型也不能伪称完成AI解释。

## 9. T05–T09的具体接收条件

| 任务 | 进入前必须收到 | 交付时必须证明 |
| --- | --- | --- |
| T05 | T04真实持久配置及完整性检查；明确政策draft/missing状态；现有权限映射 | 草稿→提交→批准→启用各阶段当前权限/状态，缺政策/时间/版本阻断；旧Service入口同样不可绕过 |
| T06 | active执行方案、可适用政策版本、当前中心/筛选/同意事实 | 建档与入组分开；入组+锚点+访视+初始任务同tx；撤回/退出事件可查；管理员不伪成员 |
| T07 | 固定FormVersion/VisitRequirement、真实assignment、共用写核心及revision方案 | 草稿刷新继续、0/false/缺失、重复/CAS/撤权反例；初次提交固定ref，不能先裸写后补历史 |
| T08 | 首次revision及current CAS、query父链 | 带原因更正追加不覆盖，现场/H5读取当前一致；旧审阅/放行依据失效且原审计保留 |
| T09 | 固定review ref、lock/unlock政策、要求项当前证据 | 锁定拒改、解锁留因、更正重审、完成与依赖日程原子；T07–T09同页完整失败恢复 |

必须以真实PG和真实角色API/浏览器验证，不以mock守门或新类型定义完成销项。普通科研成员、具真实PI/项目管理权限者、仅Hub owner、租户管理员、只读/未授权、跨租户，以及在途撤权/撤回均包含正反例。专业业务结果由用户/课题组核对，T02或任何专项全绿均不能代签。

## 10. 当前阻断、文档交接与实施顺序

目前未收到的真实输入继续保持missing/draft：正式Protocol/CRF/量表/职责/同意与撤回政策、中心/盲态、安全流程、真实SAP及专业核对人。用户已确认通用合成案例包括现场、H5及CSV，首项为描述统计；邮件通知和指定测试收件人已获授权，地址仅保存在私有运行配置，真实发送仍待实施验证。合成确认不等于真实研究SAP或临床政策批准；正式启用和临床使用不得先放行后补材料。

全流程设计仍有历史措辞：第2节Q01既有前提、第3节DDL待选定及第14节“仅设计未运行”需由主循环按近期T01–T03证据同步；本次未改其文件。实施计划末节旧“全部未开始”由主循环已定点处理，不再次覆盖。

本文新增的三个缺口族仅为既有公共链补足：执行政策/参与事实、答卷revision/review、正式AnalysisSnapshot。不能因这些名称建立通用EDC设计器、平行账户/患者/角色/队列/Agent。每个物理扩展随对应最小任务及唯一迁移链评审，先列字段/约束/兼容读写与失败回滚，再落地。

建议下一项：完成T04真实浏览器与业务验收，再按本契约实施T05政策草稿与明确阻断；避免把未确认临床政策写成默认批准。

## 本机启动的 Hub schema 只读前置（2026-11-12）

19501 本机合成启动与显式 fixture 初始化分开：保留 `scripts/hub-schema.mjs --apply` 作为受 fixture guard 限制的显式初始化；正常启动只检查现有 `rh_hub` 精确三表及 RLS/FORCE、follow 守卫函数/绑定/事件/启用/固定安全定义、本机 Hub 和初始 scope 种子，缺失或不匹配明确拒绝启动，不创建 DDL、触发器或种子。首次合成租户/账号创建属于该本机体验脚本既有行为，不代表正式 runtime 或生产迁移链；此增量不改其行为。正式独立 runtime 保持不自动迁移，公共 schema 仍沿现有 canonical 迁移路径，合成库有受控独立评审与留痕。
启动只读 guard 校验也必须拒绝仅针对指定列（`tgattr` 非空）或附加 `WHEN` 条件（`tgqual` 非空）的触发器，不能只检查事件类型。
启动只读前置同时核对三表各自唯一 canonical 租户 RLS policy 的表、名称、ALL、PUBLIC、permissive、USING/WITH CHECK 表达式；丢失、额外策略或表达式放宽均拒绝，不能只依赖 ENABLE/FORCE 标志。
