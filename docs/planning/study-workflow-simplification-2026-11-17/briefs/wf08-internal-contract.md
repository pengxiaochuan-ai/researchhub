# WF08 · 持久分析内部实施合同

日期：2026-11-17，实施状态更新2026-11-18。A V5已完成真实数据库接纳与整事务回滚预测；B native-v1源码/相关测试已冻结待独评，独立consumer core实施中；C/full与D装配/页面尚未开始，未提交迁移或启用后台能力。依据 [WF08 brief](wf08.md) 与 [ADR-0014](../../../decisions/0014-durable-research-analysis.md)。按 A 接纳存储 → B 原生续算围栏 → C full/取消 → D 前端衔接分别 TDD，不一次修改全部文件。A当时合同原文随A源码快照保留，不重写旧验收。

本项只消费 `rh_analysis.execution_job` 的具名绑定。旧 591 条 KnowledgeChatJob、其中 155 条 queued、WF07 V3 partial 的 35 个未派发逻辑子项及其他无本 Job 绑定的 Run/group 不进入候选、接管或清理。原 Methods 同步接口继续服务未绑定 Job 的旧调用；Job 已绑定对象的新增执行、process 和取消必须经过本生命周期。回看、原键只读查回及独立审核沿原权限，不要求活租约。

下文路径以 ResearchHub 仓库为基准；`../app/server/` 指当前 canonical Nest/Prisma 后端。类型是内部伪接口，未构成可从 HTTP 反序列化的 DTO。

## 1. 固定类型与持久目标

```ts
type Scope = Readonly<{
  tenantId: string; studyGroupId: string; researchProjectId: string;
  studyId: string;
}>;
type OriginalActor = Readonly<{ accountId: string; authVersion: number }>;
// authVersion 为非负整数，0 合法；不将角色快照当授权。
type OperatorRef = Readonly<{
  agentId: string; skillId: string; skillKey: 'descriptive-statistics';
  skillVersion: number; executorVersion: string;
  configurationHash: string; // canonical backend + rules + 已声明 Worker 契约
}>;
type FixedBasis = Readonly<{
  snapshotId: string; planId: string; reviewId: string;
  manifestHash: string; branch: 'ordinary' | 'full';
}>;
type MethodTarget = Readonly<{
  targetId: string; snapshotId: string; methodKey: string;
  sliceId?: string; runId: string | null; inputHash: string | null;
}>;
type PendingBase = Readonly<{
  claimId: string;
  requestKey: string; requestHash: string;
  body: { limit: 1 | 3; expectedStateHash: string; requestKey: string };
  jobTargetsHash: string; targetIds: readonly string[];
}>;
type PendingClaim =
  | (PendingBase & { kind: 'first'; methodKey: string; snapshotId: string })
  | (PendingBase & { kind: 'batch'; batchVersion: string; targetsHash: string });
type Checkpoint = {
  version: 1; runGroupId: string | null;
  targets: readonly MethodTarget[]; pending: PendingClaim | null;
  finishedClaimIds: readonly string[];
};
type JobFence = {
  // 仅 consumer 在进程内签发；HTTP 数据不能创建此 capability。
  readonly jobId: string; readonly generation: number;
  readonly mode: 'compute' | 'settle';
};
```

- `OperatorRef` 由原 Methods 权限解析器选择一次并冻结；不仅固定版本号，还固定 Agent/Skill id 与 backend/rules 摘要。原 Worker 校验仍负责真实返回版本；不新增并无权威来源的 `workerVersion` 字符串。每次执行重验同一参考，失效就受阻，不能重新选择另一个 Agent 或升级 Skill。
- Job 固定列包括 scope、原 actor/version、稳定 deployment id、接纳 requestKey/bodyHash、FixedBasis、OperatorRef、原生根 createKey 与接纳 audit id。接纳唯一约束为 `(tenant_id,study_id,actor_id,request_key)`，**不包含 authVersion**。固定列不可 UPDATE。
- Job 状态、generation、computeAttempt、租约 token/owner/deadline、heartbeat、取消引用、Checkpoint、终态 code/时间是可变列，更新受条件 CAS 和触发器限制。`computeAttempt` 为 0..3，generation 独立递增。token 只留数据库及私有 capability 闭包，不出候选函数、HTTP、日志或前端 marker。
- 普通目标只有一个 target；full 的切片列表按已放行 root 的 ready slices 固定。snapshotId/methodKey/sliceId 不变；runId/inputHash 只允许由 null 原子绑定一次，之后不换 Run、不换输入。Checkpoint 只增已证实的绑定与 finished，不能靠存储自称成功。
- 原生 Run 的 `environment` 增加服务器专写的 `researchAnalysisJob: {version:1,jobId,targetId,bindingHash}`，不含 token/generation。它是不可变关联标记，必须与 Job 固定参考和 target 逐项交叉验证才成为可信绑定。原 `claim` 仍是每次 native dispatch 的独立防重值。发布、失败、审核和取消更新 environment 时均保留 Job marker。
- full group 原元数据同样写不可变 Job id/bindingHash。首片原 claim 只有 methodKey/snapshotId/requestDigest，不伪造 native targetsHash；本项另存 jobTargetsHash 核固定目标。batch 才保存并核原 BATCH_VERSION/targetsHash。两类原 digest 与 Job 接纳 bodyHash 独立，不能只凭 group id 或前端 opaque 认领旧记录。
- 不在 Job、候选或执行日志另存答案、数值、完整 manifest/schema、放行理由或 Worker payload。inputHash 按原 native 算法生成；运行所需值只在原来源核验/Worker 调用内存中出现。原 snapshot/gate/audit 的既有合同不变。

## 2. 新表、receipt 与 RLS

只增加一张 Job 表。接纳 receipt 直接由不可变接纳列与原子接纳 audit 构成，避免误用旧 `rh_research.operation` 的 tenant+actor 全局 key 唯一性替代本项的 Study 级约束。取消使用既有 append-only operation/audit；其 action、Job target、原取消 actor/version/bodyHash 必须完整核定，Job 只保存已接纳取消的引用。同一取消 key 精确重读；已有取消时另一个新 key 返回 conflict 与当前 Job 安全引用，不再次失效 generation、不伪造新 key 或其他人的 receipt。

DDL 列组采用下列约束，不增加第二张通用 queue 表或修改 Prisma 旧 Job model：

| 列组 | 类型与约束 |
| --- | --- |
| `id`、scope、`deployment_id`、`actor_id`、`request_key`、`snapshot_id`、`plan_id`、`review_id`、`native_create_key`、`admission_audit_id` | 非空 text；id 主键、上述接纳唯一键、父链 FK/触发器；原子接纳 audit 唯一对应 Job |
| `actor_auth_version`、`lease_generation`、`compute_attempt`、`checkpoint_version` | integer；分别 ≥0、≥0、0..3、固定1；generation/attempt 不可倒退 |
| `request_hash`、`manifest_hash`、`operator_hash` | 非空 text，64位小写 SHA256；requestHash 固定 action+Study+严格 body，actor/version 为独立不可变绑定 |
| `branch`、`status`、`operator_ref`、`checkpoint` | branch/status 用 CHECK；JSONB 只接受本文件类型，operator hash 与原对象一致、checkpoint 固定 version1/有界目标集合；不存临床值 |
| `lease_token`、`lease_owner`、`lease_expires_at`、`heartbeat_at` | 可空 text/text/timestamptz/timestamptz；活动租约四者同时存在，terminal/取消换代清空；候选函数无 token/owner 输出 |
| 取消 operation/audit 引用、`error_code`、created/updated/terminal 时间 | 原 receipt/audit 外键或同事务父链核定；只留安全 code，无 raw error/payload；时间由 DBclock 写入 |

新表 FK 指向原 snapshot id；该表当前只有 id 主键，故在新表的 INSERT/固定列触发器内核 snapshot→review→plan→StudyBinding→execution project 的完整 scope 与 hash，不为本项修改原 snapshot 唯一键或旧父触发器。Job 原 actor 与 tenant 父链也核定。目标 checkpoint 的 Run 必须在同事务匹配 native scope/actor/key/snapshot/inputHash/Job marker；不接受任意 JSON 中的 runId。

新表 ENABLE/FORCE RLS，沿现行 `app.tenant_id`、`app.study_group_id`、`app.research_project_id` 的 exact-scope USING/WITH CHECK。`aisci_app` 只获 SELECT/INSERT/必要 UPDATE，无 DELETE/TRUNCATE；固定列触发器阻止替换。PUBLIC 无表权。所有旧表/策略/角色不变。

候选发现采用唯一窄入口：

```ts
discover_execution_jobs(tenantId, deploymentId, limit /* 1..20 */)
  -> { jobId, tenantId, studyGroupId, researchProjectId, studyId,
       actorId, actorAuthVersion, status }[]
```

该 SECURITY DEFINER 函数只静态查询新表，固定 `search_path=pg_catalog`、完全限定对象名、无动态 SQL、无 claim/更新/行锁。只返回 queued 或到期 running/recovering/cancelling 中没有活租约的候选，以 DBclock 判到期，稳定按 created_at/id 排序；永不扫描旧 Run 或 Job 表。参数必须匹配非空 canonical `app.tenant_id` 与本服务端注入的稳定 deployment setting，一次只有一个 tenant，limit 严格限界；SQL 再匹配每行 tenant/deployment。consumer 在其构造时冻结非空 allowedTenantIds/deployment，只对该集合逐 tenant 调用，不能接收客户端候选参数或用空 tenant/group/project 关闭 RLS。

函数 owner 为新建专属 `rh_analysis_job_candidate_reader`：NOLOGIN、NOSUPERUSER、NOBYPASSRLS、NOCREATEDB、NOCREATEROLE、NOINHERIT；不授予它 native 表权限，不让 `aisci_app` 成为其成员。仅授 schema USAGE、新 Job 表候选投影与过滤所需列的 SELECT（包含到期判断列，但无 token/owner/checkpoint/operator 正文），以及**仅对该角色**的候选 RLS SELECT policy，严格限当前 tenant setting + 固定 deployment setting + 候选状态。`aisci_app` 原 exact tenant/group/project policy 与 FORCE RLS 完整保留，不把专属 policy 授给 app/PUBLIC。

函数 REVOKE ALL FROM PUBLIC；`aisci_app` 对函数仅获 EXECUTE，不因函数获得跨 group/project 表 SELECT。迁移需有合法创建 NOLOGIN role、授列权/专属 policy、设置 function owner 的权限，且验收 role flags/无成员关系/列权/静态函数体；缺任一条件则 fail closed，不借 elevated/direct 连接运行 consumer、不改旧角色、不关 RLS、不退回无界扫描。固定 server deployment setting 是可信装配参数及函数约束，不把任意可传 GUC 当新的用户授权机制。

权限验收检查有效权限而非只检查 GRANT 文本：扫描所有非系统用户 relation（含 view/materialized view/partition/foreign table）及 sequence，合并有效 table/any-column 权限；新 Job 列逐列核 metadata SELECT 白名单与非 metadata 零读权，显式拒绝 PUBLIC 表/列/函数 ACL、reader 的角色继承/切换路径、app 到 owner 的直接或间接成员关系及 schema CREATE/函数替换权限。已有同名 reader 角色不复用，迁移直接拒绝；发现旧 PUBLIC/列级 grant 越界也拒绝，不修改旧权限使验收变绿。

PostgreSQL function owner 转移若需新 owner 的 schema CREATE，迁移仅在同一未提交事务内临时授给该新 NOLOGIN 角色，转移后立即 revoke，并以 `has_schema_privilege(...,'CREATE')=false` 验收；对外最终权限仍只有上述 USAGE/列级 SELECT/专属 policy，不把 CREATE 留作运行权限。

候选不是授权证明。每个候选随后通过 `aisci_app` 的原 tenant/group/project scope、原 actor/version 和当前数据库身份重新 claim。发现结束即离开控制面事务；不将 definer transaction 或身份带到 native。缺 deployment、空 allowlist、缺函数/迁移、缺 operator adapter 时，服务构造或接纳报明确 unavailable，不能受理后静默无人消费。

迁移 down 为单个原子 DO：先对新表取得 ACCESS EXCLUSIVE 锁，确认 `row_security_active` 严格为 false，完整 count=0 才依次删除本项新对象；不关 RLS、不换角色、不 CASCADE。RLS 下看不到行不能作为空表证明，有已受理 Job 则拒绝回滚。

## 3. 接纳与原键读回

公开接纳只接受 `{requestKey,snapshotId}`，其余字段拒绝。分支由 fixed snapshot 服务端判定；不信客户端 branch/operator/actor/runId/force/jobFence。

同一个短事务执行：

1. 先取得原 official→tenant 授权锁，重建当前账号、authVersion、准入与 Study 读/执行 scope；以当前权威身份设置 exact RLS context。
2. 以 tenant+Study+actor+requestKey 获取接纳 advisory lock，再查本项唯一行。已存在且 bodyHash 不同报 conflict；已受理而当前 authVersion 与原记录不同，拒绝旧意图重放，**不建立第二 Job、不默升版本**。同版本同 body 返回原 Job，不进行计算。
3. 对新请求以分支对应的 inTransaction resolver 核 approved plan/review、放行 snapshot/gate、manifest、用途/同意/质量及当前来源。调用直接 resolver；不使用按 `args[1]` 判断 Study 的 HTTP dispatcher 去转发 `assertCurrent(tx,...)`。
4. 以原 native `accountAuthority/workerFeature/agentAuthority/grant` 的只读逻辑核计算权限并生成 OperatorRef。只放行权不等于计算权。此处不调用 `prepareWorkbench` 或 full workbench prepare，因它们会创建 Session。
5. 写 Job queued、固定参考及接纳 audit，作为同一原键 receipt 原子提交；提交后回 202。任何一步失败不得留 Job、接纳 audit 或 Session。释放数据已先成功的事实独立保留，不将本次失败声称为整链零副作用。

receipt GET 必须匹配接纳 actor/authVersion、Study/action/target/bodyHash/key 并核当前可见性，不能让新版本身份借旧 receipt 取得执行资格。普通 Job GET 用当前读权可查看有权的历史元数据，包括自己旧版本 Job；两者不能混称。GET 不 claim、不补 finished、不建 Session、不推进。404、断网或当前失权不等于原 POST 未执行；unknown 仍按原 key GET，不自动换 key。浏览器 logout 不取消已接纳意图；账号版本/权限变化会阻断后续 native 写。

## 4. NativeMethods 内部适配与持久点

本节下方为设计伪接口；当前已冻结ABI以`../app/server/src/research-methods/descriptive-job-contract.ts`及`wf08/b-native/interface-freeze-v2.json`为准。实际Service提供authorizeDescriptiveJobOperatorInTransaction、prepareDescriptiveJobInTransaction、resumeDescriptiveJob、settleDescriptiveJobInTransaction。adapter有beforeLocks、verify、beforeDispatch、bind、outcome五钩子及只读capabilities reader；beforeDispatch在原dispatch事务内以确定性Job+generation audit持久计次，不能用RAM charged标志。settle私有purpose区分cancel与runtime-failure/ANALYSIS_JOB_ATTEMPTS_EXHAUSTED，后者不造取消决定或receipt；两者都不能调Worker或计一次计算。

```ts
interface NativeJobMethods {
  // 已有授权事务内，只读；固定 expected 时必须逐字段相同。
  authorizeOperatorInTransaction(tx, actor, scope, expected?: OperatorRef)
    : Promise<OperatorRef>;
  prepareJobRunInTransaction(tx, actor, fixedTarget, operator, fence)
    : Promise<{ runId: string; inputHash: string; created: boolean }>;
  resumeJobRun(actor, fixedTargetWithRun, operator, fence)
    : Promise<NativeRun>; // 内部两个短事务，中间才调用 Worker
  settleJobRunInTransaction(tx, cancellingActor, fixedTargetWithRun, fence)
    : Promise<'cancelled' | 'already_published' | 'not_started'>;
}
interface JobFenceAdapter {
  // 真实实现持有私有 token；此对象不是 HTTP DTO，也不由 JSON marker 构造。
  beforeLocksInTransaction(tx, actor, operation, target, capability): Promise<void>;
  verifyLockedTargetInTransaction(tx, lockedRun, target, capability): Promise<void>;
}
```

通过 `FormalDescriptiveRuns` 的**可选可信依赖**注入 adapter；不把 `rh_analysis` SQL 引入未配置的原 app。无 Job marker 的旧路径不查新表，既有契约不变；带 Job marker 的写若未配置 adapter/capability 则 fail closed。只读及 review 不要求 lease，原来源/审核权限仍照常核；原接口已知成功的幂等重读不重执行。配置由 composition factory 私有注入；capability 以私有 issuer/运行时品牌识别并闭包持 token，不能只检查一个可构造对象的字段，不允许 HTTP body、任意 environment JSON 或 caller boolean 充授权。

已配置 adapter 时还要在 **Run marker 尚不存在** 的接纳窗口守门：legacy `prepareWorkbench`（已解析 dto.input ref）、direct create、full root create，在 Session/source/group/Run 的任何写前，查同 tenant/actor/Study/fixed snapshot 的 active Job reservation，跨 authVersion 不能绕。无私有 compute capability 不得新增写；精确已知原生幂等重读可返回。Job 的 root/child 原生保留 key 永久不可被其他调用认领；Job 终态后，新意图使用新的非保留 key 不永久锁死该 snapshot。未配置旧 app 的原无 Job 路径不查询 Rh 表。B 的 before-lock 入口同时承担 reservation guard，不能只等有 Run/environment marker 才围栏。

跨scope永久键工程裁定（2026-11-18）：新Job root仍用`analysis-job-native-<hash>`，新Job full child改用`analysis-job-native-slice-<原hash>`，原hash输入不变；该整个`analysis-job-native-`命名空间对无私有cap的legacy新写全局拒绝，不通过跨project查询猜保留状态。原因是Native key为tenant全局唯一，当前exact RLS无法证明别的project内尚未创建的保留key。C新Job group把固定Job.targets.methodKey复制到原meta.slices；原读取本来按stored slices查，旧legacy full-slice算法/已存group不变。A尚无持久表/Job，无旧Job迁移；不新增全tenant探针、definer或RLS绕过。具名源差异另冻`b-key-namespace`，不重写A5历史验收。

首个有效计算事务在取得 Job 围栏与固定 source/operator 证明后，按原 workbench scope/actor/固定 Agent 创建或复用 Session，创建 queued Run、native create audit，写 Run marker 与 Job target 的 runId/inputHash，再整体提交。Session/queued Run/Job 绑定不能分成两个提交；回滚时全部撤销。重启读到此 queued Run，按原 methodKey/inputHash/OperatorRef 续算，不再创建 Session/Run。消费时不得重新走按当前 agents 排序选首个的旧 prepare 分支。

`resumeJobRun` 仅接受此 Job 已绑定且尚未发布的 queued/running Run。running 接管必须在新活代锁下 CAS 原 status/updatedAt/inputHash，更新 native claim，并将本代计算 attempt 登记与 dispatch audit 同事务提交；不复活 failed/cancelled/已发布 Run。Worker 在事务外执行；发布前重验同 Job 活代、固定 target、原 native claim、当前权限/来源/inputHash/CAS，再原子写 native 结果、native audit 及可随本次确定的 Job checkpoint。Worker 原返回 proof、数值映射及运行时超时不变。

Lease 为 DBclock 120 秒，heartbeat 每 20 秒；读锁等待后再核数据库时间。leaseGeneration 与 computeAttempt 分离：首次真正 dispatch 及每次失租接管后的首个 dispatch 才消耗一个计算 attempt，最多 3；同代正常后续 full batch、heartbeat、只补 finished 不加次数。领到租约却尚未 dispatch 不消耗计算额度。取消使旧 generation 失效；后续 settle 可再领代但不计计算 attempt。持有第四个计算代不能派发；用尽额度仍允许停办结算。

## 5. 锁序与两个失败清理出口

统一顺序为 **official 授权锁 → tenant 授权锁 → 接纳 key 锁（仅接纳）/Job 行锁 → full group/claim 与原 source/plan 锁 → Session → native Run**；同批 Run 按稳定 target 顺序处理。所有 source/plan 锁保持原 resolver 内部顺序。任何 Worker/网络调用不跨事务持锁。不在持有 tenant 锁后才尝试取得 official，也不嵌套 Prisma/Studies 事务。

当前 `FormalDescriptiveRuns.transaction()` 在 `withAuthorizationMutation(...includeOfficial:true)` 内进入 callback；`live()` 随后依次核 Session/source，在第 107 行 `FOR UPDATE` Run。因此可信 `beforeLocksInTransaction` 要放在原授权锁已取得后、**native callback 的任何 Session/source/Run 锁之前**。目标可由事务前无锁读取的原 Run snapshot/私有 target 提供，但在 Job 锁与 Run 锁后分别重验绑定和行 hash；无锁读本身不是证明。不能先运行 `live()` 再在 publish 末尾查 Job。

full 的 `withResearchStudyTransaction` 默认先 tenant，且 group/source 可能先于 Methods 回调；Job 新内部路径必须从一开始使用 includeOfficial 的原授权事务，并在进入 group/root resolver 之前取得 Job 锁。不是在原普通 full transaction 内临时追加 official。`authorizePublication` 可重复原当前授权核验，但不能成为首次 Job 围栏或倒锁点。

必须覆盖两个独立清理出口：

1. 原 native execute 的 dispatch catch 与 publish catch 都可能调用 `markBasisBlocked`。该函数另开事务，必须携带同一私有 fence/target，在授权锁后先核 Job 再调用 `live(...basisRequired=false)`。JobFenceLost/取消代/授权失败不能放入科学 basisErrors，也不能由此写 `ANALYSIS_BASIS_STALE` 或 failed。清理自身失租时零 native/Job/audit 写；日志只能报告失租，不伪称科学失败已登记。
2. `scripts/full-study-methods-batch.mjs:41` 当前 `child.markBasisBlocked=original.markBasisBlocked.bind(original)` 会绕过 child 临时事务。保留其“独立真实事务清理”性质，但新 Job path 需显式绑定**携带同一 adapter、capability、target 的原生清理实例/闭包**，不能继续绑定无 fence 的 original，也不能复用已结束的 batch physical tx。`stage()` 在原授权事务进入 resolver 前先核 Job；dispatch/publish shared tx 的每个 child 和 parent prove/attempt_failed/finished 都必须同代。一个旧 child 失租不能单独写失败并污染新代。

同事务 publication 与 cancellation 竞争由同一 Job 行锁裁决：若 publish 先提交，其已发布结果保留；若取消先提交并换代，旧 publish、heartbeat、checkpoint、attempt_failed、markBasisBlocked、finished 一概零写。正常 native 错误原样归类；租约错误不冒充 Worker/science 失败。

## 6. full 首片、批次与 pending 恢复

```ts
interface FullJobRuns {
  prepareForJobInTransaction(tx, actor, fixedRoot, operator, fence)
    : Promise<Checkpoint>; // group + 首片 claim/receipt + target/checkpoint 原子
  reconcileForJobInTransaction(tx, actor, checkpoint, fence)
    : Promise<Checkpoint>; // 只补具备原生终态 proof 的 exact finished
  prepareNextBatchInTransaction(tx, actor, checkpoint, fence)
    : Promise<Checkpoint>; // 无 pending 后才创建新的最多3项原 claim
  settleCancellationInTransaction(tx, cancellingActor, checkpoint, fence)
    : Promise<Settlement>;
}
```

首片仍用原 `full-first-<hash(createKey)>`，slice methodKey保原hash算法，但新Job使用上文独占命名空间并写入原group.meta.slices；旧legacy算法不改。后台根key由服务器从Job派生一次保存，不将浏览器key自动换新。原create digest是`requestHash({studyId,body})`；first/process digest是`requestHash({studyId,id:groupId,body:{limit,requestKey,expectedStateHash}})`，不混入本项action或接纳bodyHash。first保真保存原limit1/expectedStateHash/body与methodKey/snapshotId/requestDigest，用jobTargetsHash另核目标；batch limit3才核原BATCH_VERSION/targetsHash。group/first claim/原operation receipt/Job checkpoint同事务提交；queued Run准备若在后续事务，则pending保留精确目标，重启只补这些未建目标，不再claim第二组。

每次 consumer 先按联合类型核 pending 的 claim/audit/operation/requestHash/原 body/原 group+root+slice snapshot；first 核原 methodKey/snapshotId + 本项 jobTargetsHash，batch 再核原 targetsHash/BATCH_VERSION：

| 已核原生状态 | 允许动作 |
| --- | --- |
| 所有目标已发布/原生终态，finished 已有 | 只读消费原事实、前移 checkpoint，不重新执行 |
| 所有目标有完整终态 proof，但缺 finished | 在本代同一事务精确补一次 finished 及 checkpoint；GET 永不补写 |
| exact target 无 Run 或 queued/running，且绑定/原权限/source 均有效 | 只 prepare/续算本 pending 中的该目标；保原 claim/body/key/hash |
| failed/cancelled/needs_input、绑定不一致、原来源/权限失效 | 停后续 dispatch，记录真实 failed/blocked；不把 executionConfirmed 误当计算成功 |

pending 未结前不建立下一 batch，不换 latest expectedStateHash 冒充原请求重试。pending 结束后，新 batch 才基于当前权威 stateHash 创建一次新 claim/key/body，绑定进 checkpoint；该值不是对旧 claim 的改写。full `remaining===0` 只表示无 queued，不足以完成：仍要逐 active slice 核无 running、无未结束 claim、全部生成有效待审/已审结果；failed/blocked/no_valid_data 不是 completed。已发布结果仅回看，不能因少一个 finished 而重算。

旧 full create/process/cancel、普通 native cancel 识别已绑定对象：只读幂等回执可以返回，任何新增执行/状态取消须可信 Job 生命周期；没有 capability 报冲突/不可用并给当前 Job 安全引用。原数据结果审核不被挡。不能仅禁新页面按钮而让旧 endpoint 绕过。

## 7. 停止与终态

取消 POST 先按当前有权者核原取消资格（full 仍核原 actor/version 与原 Study/Methods 资格），随后在上述锁序内锁 Job。原取消 key 先核 exact receipt；首次接纳取消将 Job 改 cancelling、登记原取消 actor/version/operation/audit、递增 generation 并清旧 lease，**同事务**提交。只取消业务意图，不冒称已杀 Python；网络未知只 GET 此取消 key。

settle 代不调 Worker、不创建未开始 Run、不新建 group。以原取消权限逐个处理本 Job 已绑定的未发布 queued/running Run，CAS 标 cancelled 并留 native audit；已发布 needs_review/completed/needs_input 结果及审核历史保留，未创建目标记录为本 Job stopped-before-dispatch。不能直接调用旧 full.cancel：它会拒 unfinished claim，并可取消已发布 needs_review。

对本 Job 的 pending claim，逐目标持久确认“已发布保留 / 原生已取消 / 从未建立且不再派发”，再以取消专属 proof/action 结束 claim/Job；不伪造 `executionConfirmed:true` 的成功 finished。公开 cancelled 要求无可再发布的旧代、无未结本 Job claim、所有目标均已结算。失权或绑定异常时已失效的旧代不复活，Job 显示 blocked/停止受阻，不能借后台权限补 native 取消或宣称全部停止完成。后台可写本 Job 的控制面阻断元数据，不由此获得业务 Run 写权。

completed 表示本 Job 的确定性结果已生成并已收尾，不表示独立审核已通过。failed/blocked/cancelled 均不自动回 queued；poll、重新登录或原键 receipt GET 不触发第四次计算或创建新 Job。

## 8. 最小文件与分步验收

下表是具名改动边界，不授权一次实施全部。新增迁移目录已由根冻结为 `20261117154400_research_analysis_execution_job`；不改原 `analysis_basis` migration，也不启动应用即自动 DDL。migration/down 的每个完整顶层语句前使用 `-- statement-break`；function/DO 的 dollar block 不分割，根按标记在同一事务逐语句执行，不将整个文件作为多语句 prepared statement。

| 阶段 | 源文件（新增标“新”） | 必要改动 |
| --- | --- | --- |
| A | `../app/server/prisma/migrations/20261117154400_research_analysis_execution_job/migration.sql`（新） | 新表、固定列/父链保护、exact RLS、候选函数；回滚检查只管本项新对象 |
| A | `server/research-analysis/execution-jobs.mjs`（新） | 严格接纳/receipt/read/cancel 控制面、Job repository 与私有 fence adapter；模块 import 无启动副作用 |
| B | `../app/server/src/research-methods/formal-descriptive-runs.ts` | 只读 OperatorRef、可选 adapter、原子 prepare、job-bound resume、before-lock/cleanup 与旧写防绕 |
| B | `server/research-analysis/execution-job-consumer.mjs`（新） | 固定 deployment/allowlist、候选→exact scope claim、heartbeat、至多3代计算、失租零写 |
| C | `server/research-analysis/full-study-runs.mjs`、`full-study-batch-runs.mjs` | Job 专属 group/first/batch prepare/reconcile/settle，旧 process/cancel 防绕；不改旧 receipt GET 推进语义 |
| C | `scripts/full-study-methods-batch.mjs`、`full-study-methods-facade.mjs` | 共享 physical tx 先核 Job、原子 parent proof、带 fence 的独立 child cleanup，暴露可信私有 job 适配 |
| D 装配 | `scripts/local-research-analysis.mjs`、`local-full-study-simulation.mjs`、`local-knowledge.mjs` | 私有普通/full resolver 与 native adapter；独立 Job consumer 生命周期与显式非空配置，关闭时停止领新 Job；不启动聊天队列恢复 |
| D HTTP | `server/research-studies/controller.mjs` | 新 routes 严格 body/202/当前读权；只传服务端控制面依赖，不接纳内部 capability |
| D UI | `src/analysis-start-session.js`、`pages/shared/useAnalysisStart.js`、`pages/shared/AnalysisStartControl.jsx` 及实际两分支薄适配 | 在写前重新核当前 actor/version/scope/固定放行；将原 create/process 序列替换为接纳与 GET 进度/明确停止；布局沿原。本阶段开始前逐一核实际路径和新 before，未列名旧源不顺带重排 |

`ResearchMethodsService` 原构造/未配置旧 app 保持；当前受信装配已能直接创建原 native 实例，优先以显式 native/facade 参数注入 adapter。若实际测试证明必须变更 `research-methods.service.ts`，先向根报具体无法注入点并加具名 before，不把修改全局 DI 当默认。既有 full workbench prepare 在新 Job 路径不调用，故无需为本项重写其旧选 Agent 行为。

各步先实际行为 RED，再最小 GREEN：

- **A**：同键同 body/异 body/跨版本、不建 Session、权限不足、原子回滚、RLS 跨 group/project、候选错 tenant/deployment/limit/空 allowlist；schema 应用只能根在后续批准专窗执行，实际 RLS 用真实 aisci_app 整体回滚验证。
- **B**：queued/running 精确接管，同代 heartbeat/下批不加 attempt、旧代晚回/失败 cleanup 零写、第4计算拒绝、3次后取消仍可；native 原生60与无 Job 未配置 app 契约保持，Worker spy 只证明调用边界，不能充目标计算已执行。
- **C**：首片/批次各切点 crash，已发布缺 finished 只补不算、batch child 真实 source error 清理仍受 fence、legacy endpoint 防绕、cancel/publish 两种提交顺序、无 Run 的取消不造 Run、已发布保留、失权不伪取消；不认领任何历史 partial。
- **D**：两角色/两分支离页与服务重启、接纳/取消丢响应只读找回、authVersion0、URL/身份迟到、存储失败、原结果待审与原 Methods 回看；真实4层/PNG/WebM/五宽/native200及旧全行保护由根按冻结预算执行。当前没有任何目标验证通过声明。

## 9. 实施定位与交付边界

关键定位已在上文具名：native `transaction:32 / live:103–111 / execute:128–149`；batch `childFor:35–42 / stage:56–65 / shared publish:107–124`；full `claimOne:67–84 / create:89 / cancel:98–120`；原 RLS migration `20261112040000_analysis_basis:18–24,51–62`；原授权锁 `worker-publication.ts:42–74`。这些行号是本次只读源审定位，实施以当步 before 为准。

各步实现分别保存before/hash，旧失败与旧验收不覆盖。A V5已证明事务内真实接纳/原键/RLS及回滚后零残留，B原生源码实现已冻结；尚不宣称目标已持久建表、consumer已启用或WF08四层通过。工程参数、公开DTO、最终装配及业务验收以对应后续冻结与本项final-manifest为准；WF09–WF12未开始。
