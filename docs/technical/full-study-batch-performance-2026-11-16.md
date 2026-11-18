# 批次来源核验与精确回执契约

用户已授权批次合并方向；以下最多3项、阶段汇合和版本化回执为工程决策。保留旧limit1路径、旧原生源码/数值算法/HTTP工作流，不引入通用队列或跨请求可变来源缓存。

## 事务来源保护

新增 `analysis.withBatchResolver(tx,user,scope,studyId,rootSnapshotId,targetSnapshotIds,phase,callback)`。只有trusted v2组合调用，不开放HTTP参数。callback收到 `(resolver,guardedTx,rootCurrentClone)`；固定same physical transaction/view、完整actor/authVersion、scope/Study、阶段、root和目标snapshot白名单；finally失效，不暴露内部Map。

调用者事务先取得原official→tenant授权锁及RLS。guard执行原authorize/validateCase，按case subjects的实际非deleted且已绑定访视的文件，稳定task.id顺序FOR SHARE所有processing_task，再完整assertCurrent根快照，随后内部Map仅复用该已证明root。合法新增file/task/member需持tenant/父链锁；原worker claim/heartbeat/recover/failure不持tenant但会被task共享行锁阻断。锁后读取当前tail，不能先读旧值再等锁后复用。需PG验证更新、插入、撤权、解锁和事务结束释放。

每次child `resolver.assertCurrent`仍调用原analysis.assertCurrent授权、snapshot、approvedPlan、root/hash、sliceHash和qualityGate，只有core.project根遍历可命中内部Map。guardedTx允许原生Methods/session/audit所需写入，拒绝来源模型写、unsafe SQL、set_config和不识别写调用，不允许绕过view修改源。不同阶段/事务/actor不能复用。不可把ORM调用数称为物理SQL数。

## 原生执行复用

私有facade增加 `createBatchFromWorkbench(user,items,{studyId,rootSnapshotId})` 和 `reviewBatch(user,targets,command,{studyId,rootSnapshotId})`，最多3项。每child独立native.descriptiveRuns实例，不改全局exports/原实例，不复制原命令写模型。

审核：一次真实native事务、source guard和resolver内顺序调用原生review，保留逐项authority/live/reviewRole/锁/CAS/review/audit。任一失败整个小批原子回滚；持久claim在之前独立事务，finish/recovery按实际原生proof。

计算：snapshot事务中复用原prepare+native.create，私有execute只捕获新queued row；idempotent已有项须原生live且不进入新派发。commit后执行原native.execute；dispatch/publish原事务callback按固定slot汇合，每阶段一次真实native事务、全新source guard。callback逐项顺序执行，外层commit成功后才向全部slot释放结果；Worker/mapper仍走原生代码并在两个阶段之间。异常需reject全部slot，cleanup走独立原生事务，禁止悬挂、提前Worker或二派。source错误需正确传入各native basisErrors，使原生markBasisBlocked可按当前authority执行；授权失败不得伪造source失败。

group对queued/running保持running，不因已创建行而显示needs_review；原未决计算不得自动重新派发。

## 对外批次合同

现有process/review-operation advance显式接受limit=1或3，旧limit1走原路。新capability说明支持最大3，无可用batch后端时不假装启用。create仍保留首项单算契约，后续38项用新批次；不改原create回执。

批次claim存requestDigest、actor/authVersion、scope/Study/root/hash、ordered targets及targetsHash、limit；审核另有parent/native keys及租期。新请求key只对应最初冻结成员，恢复不能切换下一批。审核未决目标必须属于同一冻结批次，不能混入另一parent/actor/来源。旧单项claim缺字段保持原单项或原明确legacy拒绝。

独立receipt.result另存batchVersion、limit、targetsHash，并绑定requestDigest及audit_id，不能仅依赖可被同时替换的claim成员与hash。整批失败而无原生终态证明时只记录attempt_failed，不伪造finished；未决queued/running也禁止通过旧limit1派发下一项。若原生逐项证明已齐但finish回执丢失，GET只读返回实际证据；显式重放原key/body可补齐原批结束记录（包括最后一批已无新目标的情况），不得自动换成员或重新执行Worker。

新响应/精确GET包含 `batchReceipt:{version:'full-study-batch-v1',kind:'process'|'review',requestKey,studyId,runGroupId,snapshotId,manifestHash,targets,targetsHash,items,status,executionConfirmed}`；review另含operationId。targets为固定manifest，compute不以生成后的runId改变摘要；items逐项含实际runId/status/executionConfirmed。全部成员真实终态及原生证明核对后才executionConfirmed；部分/未知保持false，不能用单runId代表整批。limit3不返回具有整批含义的旧单项stepReceipt；旧limit1的receipt/stepReceipt含义不变。

frontend新的process/reviewStep最小marker使用版本2并存limit=3；旧version1严格保持limit1及原输入hash。恢复先GET，不自动POST；new batch validator验证固定范围/摘要/成员唯一与逐项证据。父进度增加不代表本批成功。再次POST仍用原输入/原key或租期后显式新attempt对应同未证成员。

## 测量与隔离

新独立证据目录full-study-batch-performance-2026-11-16。冻结前轮25原件/36科学原件/Word；使用相同根快照新run group，39项均真实Worker，审核前/后独立oracle。按最终同构版本记录每批请求、每项创建→提交/返回时间、全批计算与审核墙钟，另列故障与人为等待。固定19501，受控重载前按既有授权协调三会话；没有用户邮件、付费模型、旧数据回写或生产部署。

## 已启用HTTP入口与交接

以下均在 `/api/research-studies/:studyId/analysis/runs/:runGroupId` 下，认证/授权和旧路由不变：

| 方法与相对路径 | 批次合同 |
|---|---|
| POST `/process` | 原`limit:1`保留；显式`limit:3`，body仍为requestKey/expectedStateHash/limit，返回group DTO加batchReceipt |
| GET `/process-receipts/:requestKey` | 原key只读；新批次返回group/receipt加整批executionConfirmed与batchReceipt，group动作权限只读 |
| POST `/review-operations` | 原一次审核意图，尚未执行时0/39；追加batching capability，不预填成功 |
| POST `/review-operations/:operationId/process` | limit1原路；limit3冻结最多3项，返回原operation DTO加batchReceipt，无旧单项stepReceipt |
| GET `/review-operations/:operationId/step-receipts/:requestKey` | 原批次固定成员、摘要及逐项原生终态；缺收据404不代表可以自动POST |

当次50文件414测试/构建、实际PG七组、39真实Worker/审核和严格oracle已通过。原生审核四类审计各39、29回执完整绑定；旧117运行与原件保持。提交后owned restart与精确GET有真证据；未实现自动重启非终态Worker，不宣称midclaim crash实际验证。无schema/环境变量新增，无旧Methods源码改动，保留旧limit1用于兼容。回退能力装配应显式不提供batching；已有v2未决记录不可静默改写为单项或另key重跑，先查原回执并人工处理未证明状态。不得在已有未决批次时直接卸载原批次收据读取能力。

完整耗时、QA调试失败、Mock范围、原生200%既有裁切及用户待核对状态见 `docs/testing/full-study-batch-performance-2026-11-16.md`。不把HTTP累计称为全程墙钟，也不把事务级根复用推断为已测得的物理SQL数。
