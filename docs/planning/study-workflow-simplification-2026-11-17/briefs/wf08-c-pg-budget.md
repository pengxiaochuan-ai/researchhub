# WF08 C · Full真实PG回滚预测预算

## 当前 V4 准入：真实首片发布与原 claim 补收尾

根在V3真实预测中已核定：第一例完整通过约12.997秒；第二例真实first HTTP200、Native publication及parent FINISHED逻辑故障保留后，generation2以原claim补FINISHED成功（约13.525秒、computeAttempt仍1）；batch3 queued准备已到约17.284秒，随后共享cleanup组合触canonical20秒P2028。两已尝试窗口fresh strict/seven/591/155/science/Word及DDL/role回滚保护均通过；第三例未执行。原V2/V3失败和所有原proof保留，以上不是三例整体通过。真实目录为`wf08/root/c-pg-prediction-2026-11-17T19-07-03-217Z-c3388ddc/`。

V4只收敛C的**单连接回滚预测切片**，固定来源、真实权限、source核验、21块DDL及canonical20秒规范完全不变，不为时限减少核源：

| 当前例 | 本次真实核定 | Worker HTTP硬上界 | 新Native Run上界 | 新operation/audit |
| --- | --- | ---: | ---: | ---: |
| `first-atomic-cancel` | 原first原子绑定、无数值pending、真实取消和旧代迟到零写不变 | 0 | 1 | 3 / 9 |
| `first-finished-repair` | first真实Native publication；只回滚新parent FINISHED事务；原claim/receipt读回；新consumer generation2原键补FINISHED且0重复HTTP/0attempt增加；随即请求本driver私有consumer.stop，不在回调内await自己，外层await tick再await stopPromise；不进入下一batch | 1 | 1 | 2 / 8 |
| `no-group-stop-and-denials` | 原尚无group的真实停止、namespace防绕、39目标不造Run不变 | 0 | 0 | 1 / 2 |

总上限3个事务、3个临时Job、2个group、2个Native Run、6个operation、19个audit；每例最多1个新Session；新snapshot/来源/授权变化均0。第二例剩余38目标明确未开始，`fullBatchDeferredToTarget:true`、`full39Completed:false`。任何第二次Worker HTTP在发出前拒绝，不手改Job状态/lease/generation/targets，不伪造publish/audit；全部新行仍sentinel整体回滚，逐例fresh保护且失败总结不借前例保护宣称0。

完整limit3真实派发/发布、共享source批量复用、两cleanup与parent旧代围栏、跨批/已发布不重算以及full39后台完成，**转入D同一次目标后台验收，仍为mandatory**。D还必须完成真实离页/重登、服务重启、late Worker/cancel竞争和权限/source撤销；C小切片通过不替代这些能力标准。C产品/source冻结不因预测预算收敛改变。根独评通过V4 driver后才能新attempt，作者不执行目标。

## V1–V3 预算历史（以下原文保留，不作为 V4 当前执行额度）

2026-11-18。根已裁定采用真实19505确定性Worker，不采用published metadata、数值或publish audit伪造。本文为C driver准入预算；C产品仍由指定实现者拥有，driver须等C最终源码冻结、纯守门及独评后，仅由根执行。当前未执行目标PG/HTTP/Worker，不能据本文称C或WF08验收通过。

## 固定资源与来源

- 唯一既有合成Study：`rh-study-645de1e7-52ea-4aa5-b4d7-c46cab722b25`；plan：`full-plan-358e13d2-78f7-40b0-80ef-543cfc65745f`。
- 唯一已放行root：`full-snapshot-ac55d15e-bccf-4ce3-ad29-1687b1f092f2`；manifestHash：`8d8cd84115e7cf661f0bf634acc463cd398ee55db6b965750be91411c08846f7`。来源为WF07 V4 `root/full-normal-implementation-v4-2026-11-17T13-07-44-675Z-385114ae/journal.json`中的release记录。运行前须按实际parent链、全部ready slices、scope及原hash重新核定。
- 原admin5：`rh-kb-local-b0e2af9d-admin`，tenant为`rh-kb-local-b0e2af9d-tenant`；Scope3由上述实际snapshot/Study的原生只读解析确认，不凭显示名或猜测补值。authVersion0本预算不冒称真实成功身份；C行为测试继续覆盖0合法。
- 只新增本预测的合成Job/原生运行关系，全部在事务内回滚。0新plan/review/release/snapshot/源受试者、0grant/角色/账号属性/配额变更、0表单分配或采集启动。旧591/155及WF07 V3 partial35永不接管。

## 三个物理事务

每例严格使用canonical `withFixtureTransaction(env,'direct',...)`，当前固定20秒/maxWait8秒；不复制或修改fixture guard，不通过未支持的参数假称加长。每个物理事务仅执行本项21个已哈希顶层DDL块，随后`SET LOCAL ROLE aisci_app`并保持exact RLS。原生逻辑事务复用已审`createJoinedPrisma`的串行SAVEPOINT语义，不能嵌套第二物理连接。到期停止并保留失败，不自动放宽预算或补跑。

| 例 | 真实链与核定 | 真Worker HTTP预算 | 事务内最大新Native Run |
| --- | --- | ---: | ---: |
| `first-atomic-cancel` | A full接纳；真实C group/create operation/first claim/pending；公共Native prepare/dispatch；受控无数值pending；原Job cancel receipt与settle；释放旧调用核零迟到写 | 0 | 1 |
| `first-finished-batch` | first真实发布后，仅新parent finished逻辑事务断点回滚；原claim只读核定；真实advance补finished且0重复HTTP；原limit3 batch、3个固定Native Run的真实派发/发布；穿插下述共享清理子SAVEPOINT | ≤4：first1+batch3 | 4 |
| `no-group-stop-and-denials` | 新Job尚未建group时真实cancel/settle，39个固定目标均停止且0Run/Session/group；精确namespace/public legacy防绕与错误pending/body/foreign proof拒绝只在新行/原键范围测试 | 0 | 0 |

总上限为3个物理事务、3个临时Job、最多3个临时group（通常仅前2例）、最多5个新Native Run；每例最多1个新workbench Session，优先真实复用且全部旧Session行哈希保持。SAVEPOINT反例必须复用已准备的同组Native Run，不能借每个反例另造Run。原create/process/cancel操作和audits按最终C冻结后的真实action逐项列预算与因果归属；不能以全局audit增量冒充业务数。

第二例的first和3个batch目标由原group固定顺序选择，不挑简单source或裁掉真实target以伪造完成。driver在第4个真实Worker.execute成功返回时，仅保存本driver自有consumer.stop的Promise而不await，原样返回真实reply，让Native publication与parent finished提交；外层先await tick再await该stopPromise。不能在Worker/advance回调内自等。随后核4个本例Native发布audit及parent finished，禁止进入下一batch或第5次HTTP。hard HTTP计数是最后防线，超预算则如实失败，不能截取结果冒成功。剩余35个未派发目标保持原Job固定关系，预测不声称39项全部计算完成。最终整体全回滚后0持久Job、group、Native Run、Session、operation或audit留下。

## 原键、首片及批次证据

必须记录本例新ID及以下原生元数据，均不保存患者正文或数值payload：

1. Job原requestKey/hash、固定operator及全部target key；新full child为`analysis-job-native-slice-<原hash>`，直接复制入group.meta.slices，旧`full-slice-`不变。
2. group/create operation/接纳audit；first仍为`full-first-<hash(nativeCreateKey)>`、limit1、最初expectedStateHash/body、`requestHash({studyId,id:groupId,body})`。first无原targetsHash/BATCH_VERSION；另核jobTargetsHash，不能混用。
3. first原claim/operation、真实Native Run/inputHash/marker/dispatch claim及原publish audit。首次parent finished注入仅限此新group/claim的logical transaction，不能回滚已完成的Native publication逻辑事务；不能向生产代码加测试后门。
4. 补finished必须0重复Worker、0attempt增加、0第二group；其后新batch才取当前stateHash，保limit3/BATCH_VERSION/targetsHash及新的原body。pending未结不得换CAS或另领一组。
5. batch3个Native派发/发布共用合并source frame；每个child仍逐项原授权和围栏，Job在group/source/Session/Run之前锁定。记录真实resolver阶段/目标集合与native入口，不能回退为39次逐项全量核源。

## 真实Worker与故障注入

第二例用实际`ResearchMethodWorkerClient`与现有`createLocalMethodFetch`，URL固定当前本机19505的`/v1/execute`。token来源已按`local-knowledge.mjs`的root/dir定义核实为工作区`.tmp/researchhub-knowledge-local/quality-worker.json`（不是猜测的其他目录）；本设计未读取该私有文件。driver不得import带顶层I/O的local-knowledge脚本，只引用其已核定路径和冻结source。只有根在显式main/双guard、全部实际冻结哈希匹配后，才把quality-worker token读入内存并注入真实client；不传CLI秘密、不保存token/header/cookie或秘密哈希，不读取或输出真实Excel、患者数据或原值。

fetch包装只记录本例exact Native Run/requestId、executorKey、monotonic start/elapsed、HTTP status、request/response bytes的SHA256和成功/错误；不落请求/响应正文。总真实HTTP≤4，不自动重试。保留原Worker版本、response shape、numeric policy和Native数值映射；任何不一致均失败，不能返回假accepted或用测试数字补结果。case finally终止本driver自有未完成fetch并等待本driver调用收束，不杀服务或恢复其他队列。

共享batch两cleanup/parent失败及finished围栏反例复用第二例已准备的3个Run，以logical子SAVEPOINT分别执行：

- 在真实Root/Batch来源证明后注入精确dispatch409，logical rollback后只对本新Job使租约到期；独立child cleanup及parent attempt_failed/finished须旧代零写。
- publish清理反例先由无数值controlled spy立即失败，0真实HTTP、0科学输出；真实source prove后注入publish409并按相同围栏核零写。该spy不代称真实Worker发布。
- 401/403、DB及普通CAS错误不标Native科学失败；只有当前活租约可更新本Job blocked/recovering。错误码依consumer V4有限枚举，未落源的新码须另核后再纳。
- 每个子SAVEPOINT退出后与进入前的精确Job/Native/audit/operation行哈希相同，再调用真实port完成本次正常3个HTTP。不得省掉源码实际cleanup或把parent证明换成fake成功回调。

## 准入、保护与完成边界

driver必须import零I/O，默认拒绝；精确CLI要求local-synthetic/rollback及本次真实Worker模式，显式WF08/PG/Worker窗口后才加载运行时。缺Worker配置、桥接、schema或任一冻结来源必须unavailable，不能跳过第二例后称通过。

锁定A migration/hash、namespace delta、Native2/interface2、consumer V4、C最终owned/source snapshots及driver本身。引用B纯`createJoinedPrisma`/controlled worker和原保护函数，不调用B或WF07旧主链。根执行前还须冻结最终真实worker配置来源和本例HTTP预算；失败后由根核原证据再决定新attempt，不自动重播成功HTTP。

每例fresh before/after原strict+seven，完整591 KnowledgeChatJob/155 queued、全部旧ID/rowMD5、科学316/48/39/36和Word、旧full/ordinary facts及V3partial保持。事务内也比全旧Session/Run/audit/operation行哈希，所有新ID严格归属于本Job原键/parent/claim。sentinel整体回滚后新表、函数、reader role及schema metadata恢复不存在/原值，0持久增量；owned PID/listener只记录本机进程事实，不称HTTP健康。所有失败、PNG之外的PG证据及safe诊断保留，不覆盖A/B或旧Cattempt。

即使通过，也只证明单物理连接内、真实Native/full入口和限定4次确定性Worker HTTP的回滚预测；不证明D的持久部署、离页后台、跨进程重启、真实双角色页面或WF08整体完成。
