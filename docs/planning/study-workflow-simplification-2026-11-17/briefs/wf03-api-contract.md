# WF03 批准并启用：工程合同

仅WF03，包含同一审核启用行的提交时自动检查，离线实施；不访问目标/PG/凭证，不改controller、旧TS核心、共享startup、角色或模拟注册。原四源before由根保存。

## 原生接口与服务增量

- 沿用GET `/api/research-studies/:studyId/protocols/:protocolId/release`、POST `.../approve`、POST `.../activate`。两POST仍各自200、原权限/状态/独立审核/政策/发布检查和固定材料门禁。activate始终`migrateExisting:false`。
- `release.capabilities.canApproveAndActivate`在当前管理权、pending_review且原批准全部门禁满足时为true；批准/启用目前共用同一管理权，不能拿pending_review的canActivate=false判断缺少权限。原canApprove/canActivate保留。
- release及新命令结果增加`approvedPolicy:{id,contentHash}|null`，直接投影Protocol原approvedPolicyVersionId/Hash，不推断或另建绑定。
- 新命令receipt增加`proofVersion:1,requestHash,authVersion,actorId,studyId`，保留原id/requestKey/action/targetId。requestHash为含原requestKey的严格native body canonical SHA256，action分别protocol.approve/protocol.activate；targetId为原Protocol。
- 原GET `.../release-receipts/:requestKey?action=approve|activate`可增加严格requestHash；合法hash校验原operation hash及新proof全部actor/authVersion/Study/Protocol/action/key/hash。找不到返回found:false；旧无hashGET仍兼容原返回。旧无proofVersion/authVersion等证据的回执不充新严格证明，严格GET返回409 RESEARCH_RECEIPT_UNCONFIRMED；hash冲突409 RESEARCH_REQUEST_KEY_CONFLICT。无新增复合API或DDL。

## 客户端小型意图

新`createReleaseWorkflowSession({request,storage,key,hash,onStage})`限submit/approveActivate两意图，提供setContext、start(view)、startSubmission(view)、recover、continueActivation、continueSubmission、retryOriginal、checkpoint、pending、inFlight、invalidate。绑定accountId/authVersion（0合法）/Study/Protocol/URL和epoch。临时context变化仅隔离内存与迟到，不删原存储键中的opaque marker。

只存schema/actor与目标IDs、原内容revision、policy ID/hash/version、阶段与native action/key/hash/原body不透明字段；不存policy.sections、退回原因或正文。两个native子动作独立key/hash，先持久化再dispatch；存储失败不写。新双击互斥，其他原页面编辑/原动作与串联互斥。

正常确认：固定当前pending_review+canApproveAndActivate和原policy ID/hash→POST approve→严格核定原proof→保存approved checkpoint→fresh GET release→核当前approved状态、原内容revision、最新/已批准policy ID/hash及当前canManageRelease/canActivate和材料就绪→POST activate→严格proof executing后清marker。内容revision不含status，批准后相同revision正常；状态及固定policy必须独立核验。任何新事实不匹配停止，不重绑其他版本。

approve成功后不再批准。activate首次明确拒绝仅退回已批准checkpoint，显示已批准尚未启用，后续明确继续启用只重读当前release后写activate。unknown保留该native pending；恢复只GET严格原回执，found:false/404不判定未执行、不自动POST/换key。approve proof恢复后停在approved，等待明确继续启用，GET恢复不串写；activate proof恢复后完成。先前unknown的显式原键重试遇4xx仍保marker和unknown，停止写并要求再GET。

## 页面

原ExecutionRelease卡片pending_review主动作“批准并启用”，一次站内确认说明批准固定版本且启用后只用于后续入组；次要“仅批准”保留原批准路径。原单独启用/退回/检查/政策维护保留。串联显示正在批准/正在启用/已批准尚未启用/待核对/执行中；仅未知写及在途写保护离页，纯GET不误拦。恢复批准后按钮“继续启用”，未知先“核对上次批准/启用结果”，只有明确原键重试能写；原成功阶段永不重放。

代码/纯测试不等同装配、真实原生请求或业务验收。根负责PG全回滚、真实双角色/独立审核、两阶段丢响应、治理入口/状态历史、五宽/原生200%与PNG/WebM、产品/Notion闭环。

## 提交时自动检查补充合同

draft有当前有效canSubmit时直接native submit，不重跑check；否则有管理权且提交政策条件满足时，canSubmitWithCheck展示原“提交审核”，内部native check→fresh GET release→同原revision/policy ID/hash、gate/fixed/canSubmit全真才native submit。HTTP200 check可blocked，不能据成功码继续。check未知恢复只严格GET原proof，停在checked等待明确“继续提交审核”；submit proof只接受pending_review，不串批准。检查阻断或原版本失效即停，不暗改基准/重跑旧check。

check/submit增可选成对policyVersionId+expectedPolicyHash；旧无两字段body兼容，新helper必传原snapshot。在原Protocol行锁后先核原saved key/hash/action/target/current proof，既有成功不因后来policy变化失效；只有新写再strict比latestPolicy ID/hash并核draft状态，调用原native core。无controller/TS核心改动。

checked/approved marker保留原成功check/approve子键和hash，仅是恢复线索。storage/context恢复后的continue必须先严格GET原成功proof，再fresh release核状态/原revision/固定policy/当前权限。不能凭本地stage/completed字段写下一步；正常同epoch刚核定proof的连续流可不重复GET原回执。已知checkpoint无在途/未知/未保存输入时不单独制造离页保护。

已严格核定的checked发现内容/政策已变时，停止并结束旧提交意图，原服务器检查/audit保留；研究者明确再次点当前“提交审核”才会创建新意图，不暗重绑旧check。已知checked/approved且第二步从未pending时，同内容/同policy已由现有操作到达pending_review/执行中，可在原proof与fresh状态核定后按“当前状态已完成，本次未再次提交/启用”结束本地意图。第二步已有pending/unknown绝不靠canonical状态判成功，仍只能核原key。

确认框冻结打开时的完整版本/政策ID/hash/version与输入epoch，不随轮询换成另一版。每次后续POST前动态核parent blocked、policy/reason编辑与原动作互斥；这些写前条件不混入已发动作的proof接收，新增科学输入不会丢掉已完成check或被误标unknown。dirty下仍可只读恢复原proof，已核check留存，保存后再明确继续。quiet GET及恢复GET后的新输入均保留。纯读、已知checkpoint本身不拦离页；真实写和native unknown仍保护。

所有写确认（含仅批准和原单独启用）均绑定authenticated account/authVersion/Study/Protocol/URL及当前确认token；身份、权限或页面上下文变化立即关闭旧框，已捕获旧callback也不得POST或关闭新身份的确认框。确认正文只显示冻结方案vN/政策vM，不展示hash或请求键。独立复核的旧单动作确认隔离P2已有真实组件RED和actor/version/URL反例，修补后保持全部原生动作门禁。
