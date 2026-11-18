# WF08 B · 独立consumer与原生围栏适配

2026-11-18。A V5真实PG接纳/回滚门禁已过，闭环包`wf08/a-admission/a-phase-closure-v1.json`；本项仍不是WF08功能完成。与B native切片按已冻结内部接口协作，同一功能内分文件实施，不进入WF09–WF12。

## 文件与边界

新增`server/research-analysis/execution-job-consumer.mjs`及其行为测试；必要时仅在同目录另拆一个窄lease helper并在before登记，不创建通用queue框架。复用A新表和canonical capability issuer，A接纳API、DDL、其他旧表、启动入口、full编排与前端不改。import无I/O；所有目标PG/HTTP/Worker/Chrome和启动都只由根执行。

Native边界为`../app/server/src/research-methods/descriptive-job-contract.ts`的interface-v2（SHA5a66b1836a1946ab061bf301933b076ef3cb448dd11c76ce45a2a4ad1ee3601a）。必须满足同一issuer的reader与adapter六钩子`beforeLocks/verify/beforeDispatch/bind/outcome`（加capabilities reader）；真实原生接口的同事务/metadata参数不改。Scope3与Study独立传，Job逻辑Scope4不可spread进Prisma where。

## 构造与生命周期

固定非空deploymentId/allowedTenantIds，私有per-process lease owner。仅本表候选函数按获准tenant逐一发现，每次≤20；控制面事务结束后才以aisci_app exact scope、official→tenant→Job进入claim。无默认空Job允许集，无旧591/155、历史partial、Run反推接管或聊天consumer。缺schema/桥接/配置明确unavailable，不静默接纳无人消费。

构造依赖注入prisma、原授权锁、canonical issuer与服务器branch factory；先形成私有adapter再由factory创建Native/branch实例，最终暴露start/stop/tick和只读adapter，不暴露issue/token/owner/任意Job执行HTTP能力。ordinary/full桥接均须具备advance、真实reconcile/terminal proof及settle路径；C再接full真实实现，当前只用fake证明core契约，不伪称已有full运行能力。

start显式启动仅此consumer，1次只有1个本地claim/工作循环。heartbeat20秒、租约120秒，DB clock在锁后判定；normal下一批与heartbeat不换代/不加计算次数。stop停领新任务、当前步骤有界退出并清自有timer，留下可按原租约恢复的事实，不伪造user cancellation或扫描其他队列。实测重启仍由根执行，不以fake timer当真实能力。

## 租约、能力与持久计数

claim/heartbeat/control写严格CAS tenant+scope+Job+generation+private token/owner+活动状态+DB deadline；不把secret放进cap reader、marker、audit或日志。canonical issuer生成不透明cap，consumer另用私有WeakMap绑定DB租约；JSON、spread、别的issuer、同issuer但未由本consumer claim生成的cap均不授权。after-lock钩子只核本physical transaction中已经锁定的Job，不在Run锁后新拿Job锁；必要时用backendPid+txid证明，不仅凭可复用JS proxy对象。

`beforeDispatch`在原Native dispatch同事务、Run锁后且写前，以确定性Job+generation audit id记录一次attempt并原子增加0..3；同代后续读取此精确audit proof不重复增加。不用RAM charged布尔，不把prepare/heartbeat/reconcile计为一次计算。事务回滚同时撤销计数/audit；既存audit须精确核scope/actor/version/action/target/generation，不能只看id。

第4计算拒绝；先只读核已发布事实，已发布但欠收尾只补不算。尚有未发布时使用新settle代及私有`runtime-failure/ANALYSIS_JOB_ATTEMPTS_EXHAUSTED` purpose，按当前原生权限将已绑定未发布目标安全failed，未创建目标不造Run/Session，不假造取消人/receipt。第三次在途仍能原正常user-cancel；settle不受attempt额度阻断。原Worker或source/权限失败不自动换新意图重跑。

## 五个原生钩子

- beforeLocks先验cap与当前身份/Job固定scope/target/operator、活租约并锁Job；legacy无cap时查同actor/Study/snapshot跨authVersion的active reservation及永久reserved native keys，原既知精确成功重读可保留。unconfigured旧app不通过本模块，保持无新Rh SQL。

新Job root/child统一保留`analysis-job-native-`命名空间（child为`analysis-job-native-slice-`加原hash输入），无私有cap的legacy新写在查询前全局拒绝；当前RLS看不到别的project时也不留抢key窗口，不增加跨tenant/project读探针。既有精确成功只读与旧legacy full-slice合同保留，C新Job group复制固定checkpoint keys到原meta.slices。该命名纠正由根另冻`b-key-namespace`，A当前无持久Job无需迁移。
- verify在已锁Job和Native行之间交叉核id/key/inputHash/actor/agent/version/marker bindingHash，不能凭复制marker认领。
- bind只在同prepare物理事务将null runId/inputHash绑定一次；保checkpoint所有固定项/顺序与已完成证据，Native创建+audit+Job绑定整体回滚。
- beforeDispatch承担上述持久计数；lease/purpose失败不是科学basis错误，旧代零Native/Job/audit写。
- outcome在同publication或cleanup事务再核DB时钟/当前代与确切metadata；不接收数值，不用旧代失败覆盖新代。Job终态必须经真实branch proof，不能只信本地循环次数、cached计数或一个布尔成功。

取消POST已原子清旧lease/增generation；consumer只用原cancellation operation/current cancelling actor/version重建资格，不能升级原版本或套通用worker授权。已发布结果保留，未派发不造Run，尚有未结claim不称cancelled。失权可写本Job控制面blocked元数据并阻止晚到发布，不借后台身份补Native写或宣称全部取消完成。

## 测试与交付

实际RED→GREEN覆盖：import/空配置无I/O、只扫新表/allowlist/deployment、0版本、DB时钟与过期接管、活租约拒抢、迟到heartbeat/publish/失败零写、两种settle purpose不可换用、三次额度与同代多批/回滚计数、第三次后仍可取消、fakecap/marker、原子bind/错误scope、权限/source失败不自动重试、停止timer不消费旧任务。fake仓储实现真实事务rollback语义，不能以JS对象修改冒充已回滚。

保存before/hash、逐步RED/GREEN/最终相关输出、接口映射和精确冻结。先代码契约，后B/C真实PG整体回滚与D target端到端；不得用本fake工作循环销四层。
