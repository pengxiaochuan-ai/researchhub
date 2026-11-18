# 访视采集与集中审阅 · 实施合同

## 2026-11-17 · WF06只读关注投影与当前验收

WF06本机合成已验；Notion同步及最终完成状态见本项final-manifest。 本项只在原S09 summary上做本地排序/两态筛选及来源绑定，未加endpoint/DDL/角色/共享启动器；所有原批次/回执、review/lock/complete方法及CAS语义保持。原summaryHash未直接包含score，客户端视图另绑定实际score投影、固定refs/资格、scope/session actor/version（0合法）、完整URL及active batch/pending；render与旧确认回调同步复核，筛选或来源往返不复活旧选择。未增加storage、dirty或beforeunload。

必采未提交按精确formVersion→form_response requirement→fulfillment关联，仅明确未豁免/不适用时列关注；关联未知保原状态。score只取原明确processingStatus、scoreComplete、合法missingRequired/unresolvedItems，不重算/补值/新设临床阈值，不把没有DataQuery汇总说成无疑问。原20份上限给可见反馈；共享独审谓词用于父页summary/capture fallback和Panel，保原next/status/canComplete和资格。

V6六源相关/独评101/101、根集成夹具18/18、隔离build4.80秒；全前端1198总/1197pass/1skip/0fail，93.828秒。同源94746未重启，两身份/五宽/native200原生物理图及0业务写三次fresh保护通过，591job/原行/科学Word保持；fixture1162所有权核后停止、目标释放F01。旧V4视觉异常及V1–V5/夹具/上限/独审/恢复RED均保留，不能拿其旧截图称V6同源。N/A/uncertain真实0/0、RECOVERY双方eligible2以及旧admission历史覆盖边界如实分列；只验本机合成，不背书临床/生产。[本项报告](../testing/study-workflow-wf06-2026-11-17.md)。

2026-11-16，执行范围VC01–VC09，依据[已确认方案](../product/visit-capture-review-flow-2026-11-16.md)。代码已加载19501（2026-11-16当时owned PID95366），完整页面/API/H5/故障恢复/更正重核及实际PG事务技术验证通过；当时用户业务体验待核；2026-11-17本机完整验收通过见下文，临床或生产仍未验。原生模型、角色、临床规则与数据来源不改。

## 后续UX01：确认与读取互锁

useFormalCapture增加checking与稳定holdConfirmation释放函数，原确认存续只暂停新quiet读，不取消已在途读；显式load仍执行。send在reader/未verified时的not-sent notice由执行开始/身份清理替换，不被普通GET成功抹掉。原writer/reader/verified、客户端generation与服务端权限/CAS守门保持。

CaptureConfirmation复用原ConfirmDialog，在当前actor/authVersion及打开时pathname/search未变时才执行/通知成功。pending必须匹配actor/authVersion/Study/Visit/Assignment/domain/action；未知结果先GET原回执，404不清标记。首次只读查回后才允许显式recover(true)沿原key/body，不创建新操作。纯visit complete/reverify目标assignmentId显式null，避免末表上下文误匹配。

实际保存/恢复使Assignment按revision重挂；成功提交通知父时携带真实result，父以绑定scope/assignment的一次性信号等待当前verified且无pending/busy/checking后沿原continueCapture读取最新访视。并发身份/版本/范围变化丢弃旧信号，不排队旧写。现场/管理员共享本页；单项旧服务/后端接口、H5/CSV和逐项审计保持。

[本轮真实验证](../testing/visit-confirmation-recovery-2026-11-16.md)：同源19501两角色、3提交/3审/3锁/1完访；受控GET延迟/断开与submit/complete200后丢浏览器响应均有原键GET和原生审计。真实底层断连原因未定位，不把恢复反馈修复称为网络根治。

## 端点与装配

### 2026-11-17 · UX02–05与完整验收收尾

最终源及本轮真实执行见[完整验收](../testing/visit-flow-final-acceptance-2026-11-17.md)。CaptureVisit按actor/authVersion/Study/visit/assignment对新表标题一次定位，批审完成以batchId和同scope一次定位结果，保留64px页头偏移；原同一complete确认在结果旁唯一呈现。CaptureAssignment以固定ref/answers/score区分答案修订与纯审锁版本更新，已有编辑仍保留原CAS重核。

只读workflow.load的busy不再作为未保存修改。useVisitWorkflow独立writing：write=true在WebLock/异步marker前同步置离开保护，writing或真实pending持续保护；finally释放busy/锁并保留storage resync，只有当前epoch才能同步发布dirty，防旧实例卸载后的迟到清除。前后门禁、原生键/回执和UNKNOWN策略不改。

S01只读投影排除acceptanceFixture，分别表达protocol_executing/execution_needs_check/protocol_approved/protocol_required；canStartCollection保留false，不产生Study级采集授权。当前Study身份仅严格合法S01/S03/S04/S05/S09路由，经真实me和原授权GET Study父链解析；禁止URL赋权，按账号/authVersion/路由/请求代次拒绝迟到，失权或未知不伪造身份或注销。

本轮无新API/DDL/grant，无服务写入能力扩张。后台commands只读投影已在本轮owned PID11905加载；其后协调释放19501，不用此PID冒称后续运行时永远不变。三核心文件的历史重启证据与本轮10个新FINISH原生xmin取证分开，源版本历史及失败日志保留。

前缀 `/api/research-studies/:id/visits/:visitId/workflow`：

| 方法/后缀 | 用途 |
|---|---|
| GET `/` | 同一授权Study/访视的完整清单；逐份原生readAssignment读取当前答案、schema、ref/version、审核锁定与capabilities |
| POST `/batches` | 明确选择后固定成员，仅登记；body为requestKey、expectedSummaryHash、items中的assignmentId/expectedVersion/expectedRef |
| GET `/batches/:batchId` | 原发起账号/身份版本的批次真实状态，不执行或补写任何审核 |
| GET `/batch-receipts/:requestKey` | 原create键回执查询；404不能推断未提交 |
| POST `/batches/:batchId/advance` | requestKey＋expectedStateHash，每请求至多处理一个固定成员；无自动完整访视完成 |

全新路由由原ResearchStudiesController装配，写入复用原同源/请求标记/256KiB限制；原单项start、assign、submit、review、lock、complete、reverify接口不变。未知query参数拒绝，不接受客户端指定角色/租户作为授权。

## 固定成员与事务

schemaVersion为`visit-workflow-v1`。完整summary最多100份，超限拒绝不截断；每次最多明确选择20份。scope来自原withResearchStudyTransaction，使用当前账号/authVersion及原Study父链。摘要覆盖当前方案/批准政策、访视状态/版本、成员当前ref/version/审核/锁定及能力。

header、claim、finished使用既有auditLog，create与advance受理回执使用既有`rh_research.operation`。无新DDL/grant，未另建通用流程引擎。批次只存明确成员、来源引用、动作、身份及原生子键，不存量表原答案或自由文本原因。

advance先独立提交claim＋受理回执，然后在一个新的受保护事务执行本成员原生review/lock及父finished。未审核成员先review，读取新response.version及同一ref，再lock；已审核未锁定只lock。每个原生步骤仍执行其权限、独立审阅、用途、版本/来源、CAS及审计。原子提交保证本成员完成证明和原生写一起成功；不把多成员批次宣称为一个原子事务。

## 恢复与部分失败

状态ready/processing/completed/blocked；成员pending/unknown/completed/blocked。每个advanceReceipts绑定原请求键、请求摘要、expectedStateHash、固定ref/初始version、原生子键和claim/finished。

只有精确成功证明才能显示成功。明确失败finished可核对并清该请求pending；无finished的claim始终unknown，GET不修复、不续跑；GET404不意味着可换键重做。任意失败/unknown停止连续推进，已成功项保留。

blocked在没有unknown/来源变化且仍有未领取成员时可canContinue=true，必须用户明确继续；只能领取未claim且原ref/cap仍有效成员，失败成员不自动重试，最终仍blocked。并发更正、政策/用途/授权变化停止后续写；不能用新成员/新修订代替原确认。

## 页面与角色

原页按状态突出开始/继续采集、集中审阅和完成；集中区域位于原访视完成区。双渠道未选不预建researcher mode，H5不自动发信；CSV不覆盖已有非空或已提交记录。submitted/fulfilled不等于审核锁定；未开展选采不变成门禁，不新增全部未关闭疑问阻断。

原完成/reverify沿既有完整证据校验与确认；更正后重核保留原完成时间。批次不会替用户完成访视，也不赋予采集人或管理员额外独立审阅能力。

## 浏览器恢复和明确未受理

最小标记使用localStorage，范围绑定tenant/actor/authVersion/Study/Visit，不含答案、自由文本原因或凭证；跨标签页通过Web Locks及storage事件互锁，读取事件只触发原结果核对。身份或范围变化使迟到回写失效，不能清除其他标签页仍在使用的标记。未暂存答案继续使用原beforeunload保护，不写入恢复存储。

只有服务端明确证明请求尚未受理，才可清除该次pending：create的SUMMARY_CHANGED/MEMBER_CHANGED或advance的BATCH_CHANGED，且HTTP409和`rejectedBeforeAcceptance=true`均匹配当前原请求。后端只在无该键原受理回执/claim的分支出具此标记。已提交后读失败、无FINISH的claim、网络超时及不完整证明均不能冒充未受理，仍须GET核对。原父批次保留；已明确拒绝后只重读清单/原批次，用户再次选择或明确继续才写入。

展开集中区或本页revision变化会重读summary并清原选择，避免从新状态点进旧清单。缺文件/处理证据显示在“其他采集要求”，精确回原文件区；不将表单锁定视作全部访视证据合格。字段仍复用原FormPresentation/ReadAnswers/确定性score，0、false、缺失和不适用保持原契约。

## 验证状态

297项相关纯测、10项QA保护纯测、4.83秒构建及独立43项复核通过。生产10文件哈希与冻结记录一致。旧访视只读Chrome基线位于`docs/testing/evidence/visit-capture-review-flow-2026-11-16/baseline-77107eb6/`，当次4业务GET、0业务写。

真实执行仅新独立合成Study/组/账号，旧316统计完整行及1104审计/48修订/39子快照/36科学原件及Word逐阶段fresh比较保持。新API六组、主链8动作、H5三表审锁与舌象必采拒绝、真实409、真实丢响应后95366重启/刷新/新标签只读恢复、原更正后重核及S05/第1修订UI回看均通过。QA试跑失败与已成功原操作分开留证，不换键重复成功写入。

`atomic-proof/result.json`与native-xmin.json实际证明24个成功FINISH、47条原生review/lock审计：每成员FINISH与该成员native审计的xmin相同；claim与operation回执的xmin相同且与FINISH分离。不使用后续已更正response当前xmin冒充历史证明。完整证据见[验收记录](../testing/visit-capture-review-flow-2026-11-16.md)。

广域320项中2个旧迁移PG夹具不符合现行版本/身份契约，原失败日志另留，不修改旧校验掩盖；不是全仓回归全绿。原生200%集中区补raw CDP完整图，旧Shell头部重叠不在本轮扩改。无新DDL/grant、依赖、邮件配置或旧系统源变更；回退本增量需保留已有audit/operation事实，不删除已发生记录。客户更新中心不适用：本轮未正式发布。
