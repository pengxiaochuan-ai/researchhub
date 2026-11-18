# WP01 生产停线与排空 · 本机小步实施计划

## 2026-10-22 · 当前批准：收敛共享底座，业务优先

用户已批准暂停T03–T24（含T22b）完整生产排空协议实施；保留T01/T02及原安全修补、冻结证据，不新建控制schema、boot凭据或执行ticket，不装配新停线协议。T03身份方案转暂停事项，不再是本机业务开发阻断；下方旧“待确认后继续T03”等记录仅为历史，不自动恢复。

最多1个工作日（累计8小时）完成专用合成环境开发准入核对；通过后自动进入账号授权、知识资料和科研AI主链路。仅使用wp01_test_full_baseline及全新具名任务，当前目录串行，不触碰临床库、旧服务或历史测试任务；云资源、旧服务停线、真实发布及新增范围再确认。

开发准入不等于G1全部真实AI链、WP01整体或生产验收通过。T25质量/证据/文档要求随业务切片持续履行；原租户边界、当前授权、claim、受控源码/发布保护不取消。维护窗口替代策略须另行评审和授权，不能直接放行发布。注册/找回/邀请、全部已确认AI入口及11月中旬验收目标不缩减。

当前执行计划：[开发准入与业务优先](../development-admission-2026-10-22/task_plan.md)。下方截至本条之前的进度及未批准事项保留作历史/证据；当前核对结果与自动转入情况以新计划progress.md为准。


> **实施状态：Paused by user（2026-10-22）。** 下列是原已批准设计和历史任务，不是当前执行指令。T01/T02保留；T03–T24（含T22b）暂停，不因身份方案确认或依赖通过自动恢复。后续恢复完整协议须用户再次明确批准。当前执行新开发准入计划；T25仅保留随业务切片的质量纪律，不标本专项整体完成。

**Goal:** 在本机专用合成PG上实现并验证已批准的跨实例停入队／停认领、在途提交、排空、受控切换门禁与显式恢复，不触碰临床库、旧服务或真实发布。

**Architecture:** PG控制schema是权威；业务事务先锁门禁再沿原授权／父对象／claim提交。独立实例登记和执行ticket联合真实业务状态确认排空，发布脚本必须消费绑定代次与目标摘要的一次性证明；所有未知／超时保持阻断。

**Tech Stack:** 沿用NestJS 10／TypeScript／Prisma 6、PostgreSQL 16、node:test、Python unittest、Playwright及既有本机OS沙盒；不新增第三方运行依赖、Redis协议或消息队列。

**Spec:** [已批准Q01–Q12](../../../../docs/tech/wp01-deployment-boundary.md)。规格与本计划均于2026-10-22获用户批准；状态**Accepted／T01–T02已验证，T03身份衔接待确认**。批准不是生产配置／启用／执行／业务验收；云资源、生产停线／发布及新增确认项仍须停线。

## 1. Global Constraints

- 执行目录仍是当前dirty checkout；root HEAD=9b2bf43、Hub HEAD=190f509仅为定位，不是已批准发布源。保留全部已有改动，不自动commit／push／stash／清理。用户以后明确要求提交时才按精确文件暂存。
- 唯一合成目标：wp01_test_full_baseline，runId=wp01-native-20261020-a391cbb4；配置文件 `.superpowers/sdd/implementation-plan/wp01-full-baseline-target.json`。只通过既有loadFixtureInput／withFixtureTransaction逐事务重验数据库名、marker、角色和runId；不打印连接串，不修改app/server/.env。
- 每次原生／OS／浏览器运行创建新的caseLabel、租户、task、slot／boot、scope和manifest。只能认领本次新租户的精确任务集合，不能开启既有预发布A/B的全量消费者。不跑旧run-integration all、native-baseline restore/verify、通用seed或reset；它们可能改历史夹具／旧标记。
- 保留旧PID722／729、既有预发布PID和全部冻结证据。新OS实例独立快照、临时目录、回环端口与storage命名空间；不占用／停止已有服务，不全局compose up/down，不删卷／库／历史任务。
- 控制表只增于wp01_ops；不修改旧业务RLS／全局PUBLIC权限。新数据库身份是独立最小权限身份，不能直接继承可能跨库的aisci_app权限；仅复制已核验目标合成库必要ACL。无合法角色创建权限、需要改pg_hba／集群全局ACL／旧身份／其他数据库权限时停线确认，不借docker超级权限绕过。若新身份无法在同一业务事务满足既有RLS／elevated访问和实例可验证身份，T03即阻断并报告具体缺口，禁止以owner直连或自报deploymentId假装已验证。
- gate锁按deploymentId排序，先于official→tenant→原父对象／session／task锁。ReadCommitted下取得行锁后再以新语句读状态；网络／模型／解析／存储在事务锁外。暂停位不得替代已有enabled／授权／版本／claim。
- 已批准默认值：行锁5秒；控制事务10秒；ACK30秒；drain15分钟；实例heartbeat5秒／stale15秒；controller租约30秒／续租5秒；seal新鲜15秒；execution ticket租约120秒／心跳15秒。原Worker120秒／15秒、独立查询重放40秒等业务节奏保持。
- cutoff后零新任务／零新claim；cutoff前有效ticket可继续合法结果发布。SWITCHING后旧票拒绝；queued／人工审核可保留，NULL claim／未知外部结果阻断，不删数据、不强杀、不复活失效票、不自动重放。
- 主机CLI不新增公网API；应用、登记、运维身份分权。缺控制配置／表／身份／scope／协议拒绝接纳，不设计“先关闭门禁功能方便上线”的旁路；首次生产接入仍单独维护窗口。
- 每片完成同步对应product living spec／06、专项测试／技术文档和Notion；用户入口没变则不伪造使用说明书更新。最后保留四层状态：代码契约、本机配置、本机真实执行、用户业务验收；生产四层不因本机通过而销项。

## 2. Review Focus

- RF1：HTTP超时但远端／子进程继续运行，应计unknown，不能executorSettled；归T06、T23。
- RF2：暂停等待行锁期间长事务先提交，cutoff以数据库实际提交为准；归T05，不能用请求到达时间作断言。
- RF3：租户／Agent授权在排空中撤销，合法在途资格不应绕过当前授权；归T09、T17–T20。
- RF4：controller接管时旧shell仍执行，不允许新controller据fence自认Docker已停止；归T07、T22。
- RF5：工作台先清空输入再遇503，不能以API拒绝当体验通过；归T24，如现有错误交互不满足即停线列UI确认项。

## 3. 文件边界、接口与命令约定

以下任务未写仓库前缀的路径统一解析：common/、ingest/、knowledge/、sessions/、orchestrator/、data/、research-*/、remediation/及app.module.ts/main.ts均位于app/server/src/；scripts/wp01/与prisma/位于app/server/；app/scripts/为根目录原路径。不存在同名第二落点。

生产公共单元放 `app/server/src/common/quiescence/`，不搬现有大service。新增文件各自负责：contracts.ts（类型／常量）、gate.ts（同事务准入／发布锁）、execution.ts（ticket生命周期）、registry.ts（boot／ACK）、inspection.ts（DB与执行联合清点）、control.ts（操作CAS／seal／恢复）、quiescence.module.ts（装配）。SQL控制函数位于后续只增迁移；不把控制表加进public业务模型，不改Prisma datasource到别的schema。

本计划固定接口，后续任务按此引用，改名须同步计划与调用方：

```typescript
type Tx = Prisma.TransactionClient;
type Expected = { operationId: string; generation: number; expectedVersion: number };
type GateIdentity = { realmId: string; deploymentId: string; slotId: string; bootId: string; scopeHash: string };
type Ticket = { ticketId: string; identity: GateIdentity; admissionEpoch: number };
type WorkInput = { workClass: string; parentType: string; parentId: string; taskKind?: WorkerKind; taskId?: string };
// Ticket仅服务器内部构造；实现不得新增HTTP DTO字段接收它。
lockAdmission(tx: Tx, identity: GateIdentity, lane: 'enqueue' | 'claim'): Promise<number>;
beginExecution(tx: Tx, identity: GateIdentity, input: WorkInput): Promise<Ticket>;
assertPublication(tx: Tx, ticket: Ticket): Promise<void>;
settleDatabase(tx: Tx, ticket: Ticket): Promise<void>;
heartbeatExecution(tx: Tx, ticket: Ticket): Promise<boolean>;
settleExecutor(ticket: Ticket, disposition: 'confirmed' | 'unknown'): Promise<void>;
registerBoot(identity: GateIdentity, manifest: InstanceManifest): Promise<void>;
ackPaused(identity: GateIdentity, expected: Expected): Promise<void>;
inspectOperation(expected: Expected): Promise<Inspection>;
runControl(command: ControlCommand, expected: Expected): Promise<ControlResult>;
```

InstanceManifest／Inspection／ControlCommand／ControlResult在T02定义；类型字段对齐规格Q03／Q08，命令集合为plan／pause／inspect／drain／seal／verify／resume／takeover。workClass固定为worker:<六类WorkerKind>、prepare:IngestService.<四上传方法名>、prepare:KnowledgeImportService.enqueue，以及Q06列出的Service.method完整名称；T02展开为字面量联合与运行时白名单，禁止模型或调用者新增字符串。SQL函数以 `wp01_ops.q_<command>` 命名；gate／execution／registry的细分函数同名前缀，参数绑定不拼SQL。session_user身份映射只由受控角色部署记录赋予，不信GUC自报。

以下命令编制时为计划；当前仅T01–T02对应命令已实际运行，后续控制/OS/业务浏览器命令仍待实施。命令均从 /Users/mac/aisciencesys 执行。各任务已展开到完整路径；RED用-red-001新label，GREEN只将其改为-green-001，重跑递增序号，不复用失败夹具。

- U(n)：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/<n>.spec.js`；实际<n>由任务指定，不在shell原样执行占位符。
- P(case)：`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case <case> --label <全新标签>`。T01建立真实参数校验；每次都换标签，失败夹具也留存。
- O(case)：同上改为 `quiescence-runtime.mjs`；只启动本次新实例。B：改为 `quiescence-browser.mjs` 并显式传当前新runtime清单。
- 命令退出0且报告该case的所有正反例完成、未skip才算该片通过；安全反例“本应拒绝却成功”必须使测试退出非0。缺路径不能算RED：先证明测试已执行到安全断言，禁止把ImportError当安全反例。
- 各任务下的RED／GREEN命令是同一条命令，先留红日志、再实现、后留绿日志。最终测试命令由T25写入package.json，不把本稿占位符复制成脚本。

## 4. 串行任务

### T01 新具名合成夹具与测试守门

**依赖：** 计划获用户评审确认。**规格覆盖：** Q-T12。

**Files:** 新增scripts/wp01/quiescence-fixture.mjs、quiescence-fixture.test.mjs、quiescence-pg.mjs（均在app/server/下）。只读复用fixture-guard.mjs／local-config.mjs，不改旧夹具。

**Interfaces:** 产出newQuiescenceFixture(configPath, caseLabel)、withQuiescenceTransaction(fixture, identityKind, callback)；每次新租户与realm/slot/task精确清单，登记前后历史九表摘要。

- [x] RED：15项基线中14项安全反例失败，新增fixture接口缺实现日志不冒充安全RED；另以删除精确task检查的原生mutation实证退出1。
- [x] 运行并留红证据：node --test app/server/scripts/wp01/quiescence-fixture.test.mjs；原生target-guard mutation-red退出1，完整中间日志保留在本计划SDD目录。
- [x] 最小实现：新label在wp01_meta单独持久保留，新租户/任务原子创建、逐事务目标校验、不可伪造fixture引用与精确任务白名单；不清理或reset、不改marker，不输出凭据。
- [x] T01 GREEN：单元15/15、全新green-003原生12断言/九表历史摘要一致；完整后端9组0失败/skip。以下T02起尚未完成项不因T01通过自动勾选。

### T02 固定契约、清单与时间常量

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T02／04／06。

**Files:** 新增common/quiescence/contracts.ts、contracts.spec.ts、inventory.ts（app/server/src/前缀）。

**Interfaces:** 产出上一节全部类型、protocol='quiescence-gate-v1'、时间常量及validateInventory(input, expected: { scopes: readonly DeploymentScope[]; nowDbMs: number }): Inventory；Inventory含exact部署/slot/producer/consumer/scope/镜像/触发器摘要。

- [x] RED：新增具名测试，固定断言：`assert.equal(DRAIN_TIMEOUT_MS, 900000)；unknownKind／重复slot／漏consumer／修改scope／超过15秒stale拒绝；artifactDigest必须64hex，sourceCommit40hex。` 保留原算法／权限正例；测试必须到达断言。
- [x] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/contracts.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case inventory --label qp22-t02-inventory-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [x] 最小实现：用node:crypto生成规范JSON摘要，作用域数组排序去重但重复输入显式拒绝；不读取真实云清单，不给旧镜像补造能力。
- [x] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。


T02证据：首轮28项中23失败，补充3个安全反例RED；最终31/31、全新原生inventory6断言/九表摘要一致，裸后端9组和Web构建通过。仅契约/清单/观察窗口，不是实际实例注册、生产排空或T24界面验收。

### T03 只增控制表及最小权限身份

当前阻断：只读真实PG预检确认共享owner身份与受限RLS上下文衔接缺口；按已批准计划停线，未创建角色/GRANT/wp01_ops/迁移文件。待确认的最小调整与证据见docs/test/evidence/2026-10-22-wp01-quiescence-t01-t03/README.md；不能勾选T03或进入T04。

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T10／12。

**Files:** 新增prisma/migrations/20261022000100_wp01_quiescence_tables/migration.sql、common/quiescence/schema.spec.ts、scripts/wp01/quiescence-roles.mjs。

**Interfaces:** 产出规格五表、唯一未关闭realm操作约束、只增事件、只允许受限函数的角色映射；角色准备与schema SQL分开，SQL本身不CREATE ROLE。

- [ ] RED：新增具名测试，固定断言：`app/租户角色直接UPDATE gate或事件失败；伪造GUC不成为另一部署；固定search_path不能被临时表劫持；两realm同名deployment不混用。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/schema.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case schema-acl --label qp22-t03-schema-acl-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：仅在已核验合成库追加控制schema；新role前缀绑定fixture标签、无SUPERUSER/BYPASSRLS/继承旧业务role。若需目标库外权限变更或缺CREATEROLE停线；不改已执行迁移，不伪造Prisma迁移历史。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T04 实例身份与主启动前登记

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T04／10／12。

**Files:** 新增common/quiescence/registry.ts、registry.spec.ts、quiescence.module.ts及prisma/migrations/20261022000150_wp01_quiescence_registry/migration.sql；修改app.module.ts与main.ts。

**Interfaces:** 实现registerBoot／ackPaused和受限q_register_boot/q_ack_paused函数及对应GRANT；main在init/listen及任何Worker生命周期前等待登记，和现有assertWorkerConsumerAssembly并列，不替代原守门。

- [ ] RED：新增具名测试，固定断言：`旧boot ACK不可继承；缺协议／错digest／多余slot／缺身份拒绝启动且claim次数0；暂停启动只注册不接纳；stale不摘除实例。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/registry.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case instance-registry --label qp22-t04-instance-registry-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：5秒心跳／15秒stale按DB时钟；模块构造函数不得开定时器或外部调用。缺配置fail-closed，现有空消费者预发布快照不重启。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T05 入队／认领共享锁与暂停排他屏障

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01／04。

**Files:** 新增common/quiescence/gate.ts、gate.spec.ts、prisma/migrations/20261022000200_wp01_quiescence_gate/migration.sql。

**Interfaces:** 实现lockAdmission；q_pause先CLOSING后按部署排序锁全部gate，读取最新状态后原子关闭两位及epoch／事件。先于原tenant授权锁。

- [ ] RED：新增具名测试，固定断言：`enqueue持SHARE时pause不能先ACK；pause先得UPDATE时后来enqueue/claim写入0；5秒锁超时报告BLOCKED且actualGateStates仍open，不称已停线。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/gate.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case barrier-enqueue --label qp22-t05-barrier-enqueue-red-001`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case barrier-claim --label qp22-t05-barrier-claim-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：真实双连接双OS安排两个锁顺序并记录DB cutoff，不靠sleep推测。事务控制10秒，审计失败整笔回滚，半数实例不能放行。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T06 执行ticket、心跳与双终结对账

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T03／05／06。

**Files:** 新增common/quiescence/execution.ts、execution.spec.ts、prisma/migrations/20261022000300_wp01_quiescence_execution/migration.sql。

**Interfaces:** 实现beginExecution／assertPublication／settleDatabase／heartbeatExecution／settleExecutor；Ticket绑定真实父对象、boot、epoch，Worker还绑定真实claim摘要。

- [ ] RED：新增具名测试，固定断言：`120秒租约过期续租false；15秒心跳真实续租；dbSettled=true但executor未结束仍active/unknown；外部超时、COMMIT回执丢失不二次failed；SWITCHING旧票拒写。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/execution.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case execution-lifecycle --label qp22-t06-execution-lifecycle-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：业务终态与dbSettled同事务；executor确认由受控boot提交，不接受caller布尔量伪造。没有业务claim的登记过期只unknown，不增业务失败语义。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T07 操作状态机、排空、seal与显式恢复

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T04／05／06／08。

**Files:** 新增common/quiescence/control.ts、control.spec.ts、inspection.ts、inspection.spec.ts、prisma/migrations/20261022000400_wp01_quiescence_control/migration.sql。

**Interfaces:** 实现inspectOperation／runControl及q_plan/q_inspect/q_drain/q_seal/q_verify/q_resume/q_takeover；inspect只读，seal持排他屏障重验全闭包。

- [ ] RED：新增具名测试，固定断言：`900000ms观察超时后迟到结果不能DRAINED；owner30秒失效不自动open；seal15秒过期／错digest／重复消费拒绝；旧shell未知禁止takeover推进；resume不复活ticket。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/control.spec.js`；`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/inspection.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case control-state --label qp22-t07-control-state-red-001`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case drain-unknown --label qp22-t07-drain-unknown-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：PG新快照查六表真实active状态、同步票、NULL claim和悬挂对象；queued保留。丢ACK、未知外部效果／超时保持closed，控制事件CAS落库。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T08 受限本机CLI

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T06／07／10。

**Files:** 新增app/scripts/wp01-quiescence.mjs、wp01-quiescence.test.mjs；新增common/quiescence/cli-contract.ts（app/server/src/）。

**Interfaces:** 入口仅解析规格八命令并调用受限函数，输出ControlResult；凭据仅通过0600配置引用，不加公网API。

- [ ] RED：新增具名测试，固定断言：`force/skip-drain/reset-task/任意SQL拒绝；同operation同payload幂等、不同payload冲突；阻断exit3／连接未知exit4，inspect exit0不表示发布通过。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：node --test app/scripts/wp01-quiescence.test.mjs；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case cli --label qp22-t08-cli-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：区分受控运维身份和业务身份；stderr只输出允许reasonCode；不得从ambient DATABASE_URL兜底或打印参数中的秘密。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T09 共享claim与publication接线

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T02／03／08。

**Files:** 修改common/worker-claim.ts、worker-publication.ts；新增common/quiescence/worker.spec.ts和scripts/wp01/quiescence-workers.mjs。

**Interfaces:** claim(..., identity: GateIdentity)同事务lockAdmission('claim')＋claim＋beginExecution；ClaimRef附服务端Ticket。heartbeat/assertLiveClaim保留原业务检查，withWorkerPublication先assertPublication再原授权锁。

- [ ] RED：新增具名测试，固定断言：`六kind cutoff后claim全null/拒绝且状态不变；cutoff前claim可成功／失败提交；撤权／过期claim／错父对象仍拒绝；漏ticket不能走兼容成功旁路。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/worker.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case worker-six-kinds --label qp22-t09-worker-six-kinds-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：候选查询也必须部署范围内；保持官方knowledge-import原例外。共享helper只作短事务；测试专用适配不能变成生产关闭开关。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T10 Raw Worker最小启停拆分

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T02／03。

**Files:** 修改ingest/raw-processing.service.ts；新增common/quiescence/raw.spec.ts、scripts/wp01/quiescence-raw.mjs。

**Interfaces:** 新claim接T09；pause只停新claim，保留原enabled运行资格，在途process/publish/失败及heartbeat使用同ticket；单纯pause不调用onModuleDestroy。

- [ ] RED：新增具名测试，固定断言：`真实Raw停线后15秒仍续租且可提交needs_review；撤权仍拒绝；进程退出但DB running不得drained；lease自然过期按原规则failed，不自动重放。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/raw.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case raw-live --label qp22-t10-raw-live-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：仅用新CSV/MinIO对象和新tenant；不改变五类算法、SCHEMA_UNCLASSIFIED、源字节或人工审核，不启动旧任务扫描。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T11 四上传入口准入与准备登记

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01／05／09。

**Files:** 修改ingest/ingest.service.ts；新增common/quiescence/ingest.spec.ts、scripts/wp01/quiescence-ingest.mjs。

**Interfaces:** ingestRaw/ingestStoredRaw最终入队事务先lockAdmission；ingestStoredStandard/ingestPreprocessed以beginExecution登记同步工作；存储/解析准备独立ticket。

- [ ] RED：新增具名测试，固定断言：`pause发生在storage put后时任务0／半建被试0，准备未结束不得排空；重复源仍返回原幂等结果，不隐式新任务；原存储故障回退契约保持。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/ingest.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case ingest-four --label qp22-t11-ingest-four-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：结果/原审计和settleDatabase原子；原对象保留不做新自动删除；HTTP503不冒充storage_unavailable成功。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T12 人工映射确认入口

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T05／09。

**Files:** 修改ingest/ingest.service.ts；新增common/quiescence/confirm.spec.ts。

**Interfaces:** confirmEyeImport/confirmProfileImport入口beginExecution、原版本/CAS提交前assertPublication，原终态与settleDatabase同tx。

- [ ] RED：新增具名测试，固定断言：`暂停后两个confirm拒绝且features/版本/审计0新增；已进入有效确认可完成；过时映射／撤权／同版本并发仍原规则拒绝。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/confirm.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case confirm-import --label qp22-t12-confirm-import-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：不改映射、数值算法、允许操作与页面；本片不重写T11四入口。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T13 知识导入生产与直接执行

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01／02／03。

**Files:** 修改knowledge/knowledge-import.service.ts；新增common/quiescence/import.spec.ts、scripts/wp01/quiescence-import.mjs。

**Interfaces:** enqueue的source＋importTask原子事务纳入gate；schedule/process/resumePending全到T09，上传准备登记，解析和入库发布到同ticket。

- [ ] RED：新增具名测试，固定断言：`cutoff后嵌套importTask/source均0新增；直接schedule不能绕过；已有导入可合法提交；Hub拒绝official，旧控制面仍只按原许可。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/import.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case knowledge-import --label qp22-t13-knowledge-import-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：实际source/task/doc与执行结束都对账，Parser用专用合成字节；未接通真实解析不得用元数据绿测冒称实际执行。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T14 知识问答与消息原子边界

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01／02／03。

**Files:** 修改sessions/knowledge-chat-queue.service.ts、sessions/sessions.service.ts；新增common/quiescence/chat.spec.ts、scripts/wp01/quiescence-chat.mjs。

**Interfaces:** enqueue任务及其必要用户/assistant消息在同一个gate事务；processSession/resumePending用T09，原消息发布与settleDatabase同tx。

- [ ] RED：新增具名测试，固定断言：`暂停后消息不出现半成功；setImmediate及启动恢复不claim；在途合法消息可完成，撤权/旧claim不发布，用户POST不自动重放。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/chat.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case knowledge-chat --label qp22-t14-knowledge-chat-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：不把Sessions全部CRUD纳入暂停，不改变消息、审核、额度或计费；如发现原跨事务链无法最小原子接线，展示依赖后停线确认。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T15 科研run与阶段retry

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01／02／03。

**Files:** 修改sessions/research-agent-runs.service.ts；新增common/quiescence/runs.spec.ts、scripts/wp01/quiescence-runs.mjs。

**Interfaces:** enqueue及retry新attempt都lockAdmission；processSession/processAttempt/resumePending到T09；原同步阶段/snapshot可沿原ticket完成。

- [ ] RED：新增具名测试，固定断言：`cutoff后新run/新attempt均0，failed父run不能给retry豁免；旧父版本仍拒绝；暂停不丢已完成阶段，回执不明不二次失败。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/runs.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case research-runs --label qp22-t15-research-runs-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：若在途必须新建queued子任务才可完成，按BLOCKED和Q06停线补审，不新增业务checkpoint状态或自动失败。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T16 产物导出闭包

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T02／03／05。

**Files:** 修改research-artifacts/research-artifacts.service.ts；新增common/quiescence/export.spec.ts、scripts/wp01/quiescence-export.mjs。

**Interfaces:** createExport入队与processExport/resumeExports接T09；独立渲染子进程包含在execution/executorSettled内，原artifact文件提交保持权限/版本。

- [ ] RED：新增具名测试，固定断言：`rendering已结束但子进程未证实退出仍阻断；暂停后createExport不创建job；诊断显式权限、原格式、审计和数据保留不变。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/export.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case artifact-export --label qp22-t16-artifact-export-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：新合成产物和真实本地渲染进程；不把其他artifact CRUD和审核变成暂停特权。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T17 同步科研证据执行

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T03／05／09。

**Files:** 修改research-evidence/research-evidence.service.ts；新增common/quiescence/evidence.spec.ts、scripts/wp01/quiescence-evidence.mjs。

**Interfaces:** run分清新HTTP工作和持既有可信ticket的内部调用；前者beginExecution，后者继承，提交前assertPublication，现有未知持久化异常继续传播。

- [ ] RED：新增具名测试，固定断言：`暂停后新run外部调用0；在途合法证据提交一次；撤权/COMMIT未知仍不补failed、不重新检索；迟到来源回复不能关票后发布。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/evidence.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case evidence-sync --label qp22-t17-evidence-sync-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：连接器关闭/外网受沙盒阻断时，只证明提交契约，不能声称真实联网能力验收；不引入任何病人材料。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T18 专业方法与DQ重检同步执行

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T03／05／09。

**Files:** 修改research-methods/research-methods.service.ts、research-methods/data-quality-remediation.service.ts、remediation/remediation.service.ts；新增common/quiescence/methods.spec.ts、scripts/wp01/quiescence-methods.mjs。

**Interfaces:** ResearchMethodsService.create/createFromWorkbench/人工review触发的重执行先准入，再流入executeCreatedRun/advance；RemediationCasesService.createAttempt/claimDataQualityAttempt到DataQualityRemediationService.execute同父ticket流转。入口准入、准备状态/版本与原授权链保留，质控/结果/settleDatabase同tx。

- [ ] RED：新增具名测试，固定断言：`暂停后新执行和新DQ认领0；已接纳原固定算子可提交；父gate/case/run变化拒绝；登记过期不得擅自写无claim业务failed。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/methods.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case methods-dq --label qp22-t18-methods-dq-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：不新增队列／算子／业务重试，原质控评价、审核和计费保持。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T19 科研订阅同步执行

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T03／05／09。

**Files:** 修改research-intelligence/research-intelligence.service.ts；新增common/quiescence/intelligence.spec.ts、scripts/wp01/quiescence-intelligence.mjs。

**Interfaces:** runSubscription入口ticket，原成功/失败/去重提交共用assertPublication与原授权锁，原signal/游标/审计和dbSettled同tx。

- [ ] RED：新增具名测试，固定断言：`paused新订阅执行source调用0；在途有效版本去重规则不变；暂停/version变化/撤权及外部unknown仍拒绝，不把SOURCE_FAILED当排空证明。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/intelligence.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case intelligence-sync --label qp22-t19-intelligence-sync-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：保持原PubMed/ClinicalTrials状态事实，不将缺连接器标成已接通。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T20 确定性查询初次执行与显式重放

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T03／05／09。

**Files:** 修改data/data-query-replay.service.ts；新增common/quiescence/replay.spec.ts、scripts/wp01/quiescence-replay.mjs。

**Interfaces:** executeInitial/replay新执行ticket；claimReplay/prepare/heartbeat/成功失败发布携原票和原attempt租约，gate锁先于现有授权锁。

- [ ] RED：新增具名测试，固定断言：`原40秒业务心跳不变；独立120秒ticket续租；125秒合成计算在暂停中仍可按原权提交；旧lease/父版本拒绝；未知COMMIT不第二次failed。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/replay.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case query-replay-sync --label qp22-t20-query-replay-sync-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：保留确定性计算快照/幂等/审计，不在长计算事务持gate共享锁，不改历史query/attempt。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T21 内部上下文与失效传播收口

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T02／05／09。

**Files:** 修改orchestrator/agent-runtime.interface.ts、orchestrator.service.ts、skill-invoker.ts、knowledge/kb-tools.service.ts；新增common/quiescence/context.spec.ts。

**Interfaces:** RuntimeContext/WorkerExecutionContext只由服务器注入Ticket；执行内KbTools等结果写入继承原票，真正新job仍lockAdmission，isWorkerExecutionError包含新门禁失效域或统一显式中断分支。

- [ ] RED：新增具名测试，固定断言：`伪造DTO/model tool参数不产生可信Ticket；pause新工作不转fallback-success；已有合法执行工具结果可写，SWITCHING/过期拒绝且编排中止。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：`pnpm --dir app/server build && node --test app/server/dist/common/quiescence/context.spec.js`；`node app/server/scripts/wp01/quiescence-pg.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case internal-context --label qp22-t21-internal-context-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：不放宽原工具能力/权限，禁止未知workClass动态注册；不借本片扩AI能力或数值计算。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T22 真实发布脚本的切换前门禁（仅本机假执行器）

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T06／07／10。

**Files:** 修改app/scripts/ecs-release.sh、wp01-release-policy.mjs、test_deploy_contract.py；新增wp01-quiescence-release.test.mjs；bootstrap/workflow分发另拆下列必做T22b，不挤入T22a；两片各自RED→GREEN后才进入T23。

**Interfaces:** verify_shared_release后、mv Compose前消费seal并CAS SWITCHING；每个迁移/up副作用前重验ownerFence/digest/lease；最低能力加quiescence-gate-v1。

- [ ] RED：新增具名测试，固定断言：`缺seal/旧四能力/错摘要/迟到/重复消费时mv/migrate/up调用0；迁移/up/健康/回执未知时无自动resume/rollback；旧shell未结束禁止接管并发。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：node --test app/scripts/wp01-quiescence-release.test.mjs；python3 -m unittest discover -s app/scripts -p test_deploy_contract.py。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：临时目录和会记录调用的假Docker/云助手/OSS，不加载真实.env、不执行真实Docker/云命令；保持原四安全能力和已封闭旧回退。T22b只补可信分发精确文件集/摘要测试，仍不可真实发布。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

#### T22b 必做子片：新CLI可信分发与受控执行载体

**Files:** 修改app/scripts/cloud-assistant-bootstrap.sh、test_wp01_release_bootstrap.py、.github/workflows/deploy.yml、.github/workflows/rollback.yml。依赖T08、T22a。

- [ ] RED：固定控制资产集合新增wp01-quiescence.mjs后，缺失/重复/旧六文件清单/错摘要时安装与执行次数0；无PG身份时不得消费seal；断言旧fallback仍不可达。
- [ ] 运行红测：`python3 -m unittest discover -s app/scripts -p test_wp01_release_bootstrap.py`，只用临时目录/假下载与假执行器。
- [ ] 最小接线：受控workflow上传新增CLI及完整SHA清单，bootstrap精确校验并分发；控制CLI在已校验server镜像内以node运行、导入/app/server/dist/common/quiescence/cli-contract.js，不依赖宿主Node或借Nest完整启动触发Worker。只读挂载控制文件/0600私有运维配置，身份仅受限控制角色；PG控制步骤网络策略必须限制到批准PG地址，纯manifest校验继续无网络/无真实.env，不能声称默认Docker网络已经隔离。
- [ ] 同命令GREEN并与T22a假执行器顺序测试合跑；没有实际上传OSS/云助手调用/Docker发布/生产PG连接；目标网络与运维身份配置留在后续生产确认门槛。

### T23 全真实本机跨实例演练

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01–10／12。

**Files:** 新增scripts/wp01/quiescence-runtime.mjs、quiescence-runtime.test.mjs、quiescence-child.mjs（app/server/下）。

**Interfaces:** runtime CLI产出只含本次boot/PID/回环端口/快照SHA的manifest；prepare/start/status/stop仅本次对象，私有凭据不进入manifest。

- [ ] RED：新增具名测试，固定断言：`两个完整main/AppModule独立OS＋额外新旧boot哨兵，生产helper真实执行；cutoff、在途发布、自然120秒过期、unknown阻断、显式resume及原queued仅一次认领全闭环。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：node --test app/server/scripts/wp01/quiescence-runtime.test.mjs；`node app/server/scripts/wp01/quiescence-runtime.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case cross-instance --label qp22-t23-cross-instance-red-001`；`node app/server/scripts/wp01/quiescence-runtime.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --case timeout-recovery --label qp22-t23-timeout-recovery-red-001`。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：先完成新快照构建再启动；不热补既有运行快照，不复用原LocalDrainGate冒充生产。新loopback对象存储namespace，沙盒只开放合成DB/受控本地端口，禁止外部模型/临床连接。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T24 两角色真实浏览器维护体验

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T11／12。

**Files:** 新增scripts/wp01/quiescence-browser.mjs、quiescence-browser.test.mjs（app/server/下）；只读使用现有真实前端/API，不新增业务页面。

**Interfaces:** 浏览器接T23当前完整后端/真实认证与真实新synthetic actor；每角色四场景：合法入队、暂停503、进度/下载、恢复后手工新请求。

- [ ] RED：新增具名测试，固定断言：`输入保留、未假成功、网络POST计数无自动重放；paused仍可读合法结果，未授权仍401/403且无运维详情；截图/视频/console/network留证据。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：node --test app/server/scripts/wp01/quiescence-browser.test.mjs；node app/server/scripts/wp01/quiescence-browser.mjs --config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json --runtime-manifest 本次清单 --label 全新标签。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：分开记录旧Web/Hub正式接线/Hub原型，不能以原型冒充正式业务UI。现有错误组件做不到RF5时停线请求UI最小追加，不改风格或交互规范来迁就测试。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

### T25 回归入口、证据冻结与文档交付

**依赖：** 前一任务验证通过。**规格覆盖：** Q-T01–12。

**Files:** 修改app/server/package.json；新增scripts/wp01/quiescence-suite.mjs、quiescence-suite.test.mjs（app/server/下）；更新当前技术规格/计划/测试矩阵/product living specs及06，不改历史证据。

**Interfaces:** 新增test:wp01:quiescence纯单元入口；native/browser必须显式config和全新label，不自动挂入裸pnpm test；suite报告逐类别四层和失败/skip。

- [ ] RED：新增具名测试，固定断言：`缺一个case/原生/OS/浏览器证据不能partial→accepted；所有历史九表摘要和旧.env/PID保全；manifest哈希完整且Notion回读一致。` 保留原算法／权限正例；测试必须到达断言。
- [ ] 运行并留红证据：pnpm --dir app/server test:wp01:quiescence；pnpm --dir app/server test；pnpm --dir app/web build；专用suite显式参数新run。此处U/P/O须按第3节展开；预期安全反例FAIL，而不是缺文件／断言未执行。
- [ ] 最小实现：仅已获准本机合成验证；若某真实consumer/连接器未执行，报告对应阻断/降级而非元数据验收。保留原独立评审No与已修问题证据，不再派一次总评审。
- [ ] 同命令GREEN（label按第3节换新）：所有本片case退出0、0失败／skip；检查原行为回归，保存源码/新夹具/事件/时间摘要；同步该片living spec/测试台账后再下一片。

## 5. 测试矩阵与阶段闸门

| 规格验收 | 主任务 | 必须取得的真实证据 |
|---|---|---|
| Q-T01 事务屏障 | T05、T11–15、T23 | PG两锁顺序、DB cutoff与实际任务数；不同OS |
| Q-T02 入口闭包 | T02、T09–16、T21 | 六kind/direct kick/启动/official逐入口，不能只看静态grep |
| Q-T03 在途提交 | T06、T09–20 | 实际心跳/租约/原授权/CAS/成功失败和原审计 |
| Q-T04 全实例 | T04、T05、T07、T23 | boot/slot/清单交叉核对、stale仍阻断 |
| Q-T05 联合排空 | T06–07、T11–21 | 六表＋同步执行＋外部句柄，NULL/unknown负向 |
| Q-T06 迟到/接管 | T07–08、T22–23 | 超时后迟结果拒绝、旧shell未知不接管 |
| Q-T07 发布链路 | T08、T22–23 | 真实shell临时副本副作用顺序、假执行器调用清单 |
| Q-T08 恢复 | T07、T09、T23 | 原queued一次claim，旧票/failed不复活 |
| Q-T09 同步闭包 | T11–12、T17–21 | 新任务/现有任务区分，原准备/授权/版本原子性 |
| Q-T10 身份/审计 | T03–04、T08、T22 | 原生PG角色拒绝、伪GUC/固定search_path/事件原子性 |
| Q-T11 UX | T24 | 两角色Playwright截图/录屏/真实请求及输入保留 |
| Q-T12 跨部署保全 | T01、T03、T23–25 | 只新fixture、历史摘要、独立/联合范围与首次接入哨兵 |

阶段S1=T01–08：控制协议独立可测，不接业务消费者。S2=T09–16：六类队列端到端。S3=T17–21：同步执行闭包与传播。S4=T22–25：发布脚本假执行、全main真实本机演练、浏览器与交付。每阶段有任何unknown、未分类入口或新范围即停止该阶段，后续不得靠静态声明先算完成；不把25片拼成一个不可回退大补丁。

首个实施批次只做T01–T03，验证通过才继续；每次同样遵守“RED达到安全断言 → 最小修补 → GREEN → 专项/受影响回归 → 文档同步”。任务没有时间估算承诺；可靠证据优先，不以11月交付倒逼跳过门禁。

## 6. 当前自检与等待项

用户已批准计划并完成T01–T02本机验证，仅这两片复选框已勾选；T03身份衔接待确认，其后任务仍未实施。原计划编制自检：Q01–Q12均有对应任务；时间值与规格相同；U/P/O路径明示为后续创建；公共接口名字/锁顺序一致；RF1–5均落测试；没有自动提交/真实部署步骤。T01/T02通过仅证明辅助代码/契约与本机合成验证；生产协议装配／目标启用／真实业务执行／专业验收仍未通过。

用户已批准并启动计划，沿用主代理串行；当前只请求T03新增身份衔接修订，不重复询问执行方式或旧授权。后续以下情形再停线确认：目标合成身份不足或要求库外权限；在途链必需新job才能完成；需要新增UI提示/改权限/改算法/改计费；未知对象需强杀/删行/改历史；云资源、生产bootstrap/停线、迁移或真实发布。批准本机计划不授权这些操作。

本轮文档校验记录：`docs/test/evidence/2026-10-22-wp01-quiescence-plan/README.md`；既有2026-10-21规格/演练归档不修改。新增计划Notion并入原WP01实施计划子页，原页只加当前状态/链接，不复制一份冲突正文。

