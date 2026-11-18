# T16 首项描述统计执行契约

## S06 当前动作权限元数据补充

2026-11-12。新增独立只读 `GET /research-studies/:studyId/analysis/runs/:runId/capabilities`，仅返回 `{studyId,runId,status,reviewStatus,capabilities:{canReview,canCancel}}`。状态和权限位来自同一已授权 `live(...,false)` 当前 raw Run，不拼接调用者声称的状态或旧详情。先由真实 Study wrapper 精确匹配 Study/group/project/descriptive run，再由 MethodsService `mustFindRun(...,false)` 取原始 Run，进入 FormalDescriptiveRuns 当前授权事务核账户/authVersion、活跃scope、真实Session、Agent、已发布Skill版本及feature。审核权限复用审核写入/回执的当前数据库角色规则 tenant_admin / pi / methodologist；普通已获 Methods 权限研究者 canReview=false。取消沿现有取消方法授权，权限有效则 canCancel=true，不另加角色或运行者限制。客户端 role、T15 计划管理员能力或历史审核事实都不能代替此判定。

这些位仅表示动作权限，不保证来源、运行状态或当前审核条件满足；UI仍须结合新读取详情、blocked和运行状态，所有写请求继续独立重验。来源已失效时可以读取此最小权限元数据以支持取消；权限、会话或方法授权失效仍拒绝，不返回 answers、行值、outputs、sourceHash、basis或Run正文。此端点不调用Worker、不改变Run/审核/审计、不把派生 capabilities 合入内部 read() 原始Run，避免改变live的原始记录哈希比较。现有详情、审核、回执和其他Skill行为保持。当前步骤只实现和验证代码，目标runtime装配/真实HTTP及S06页面验收由主循环串行推进，未经重载与真实请求不得称能力已启用。

取消响应不明且来源失效导致详情409时，此GET可核对当前status/reviewStatus：只有读到cancelled才说明当前运行已取消，不称为原取消请求的回执或证明由本次操作造成。现cancel没有requestKey/receipt，不为恢复重复POST。仍未取消或无法读取时明确待核对，不假定成功；审核/取消按钮继续由当前权限位与状态组合收敛。本补充不新增canCreate/context或其他端点，不改变业务状态机。

2026-11-12 审核回执权限补充：审核写入、同键重放与原审核回执读取，均在当前授权事务内复验实际审核角色（tenant_admin / pi / methodologist）。历史曾审核不构成当前权限；降为普通研究者后仍可按 data.analyze 查看当前有效运行，但审核回执返回 METHOD_REVIEW_FORBIDDEN。恢复合法审核角色且来源与 Methods 权限仍有效时可读取原回执，不新增审核或重派计算。独立真实 PG + 19505 Worker 已保留缺口 RED，修复后须正反例 GREEN 与浏览器链验收。

本机真实 HTTP 装配保存独立计算请求轨迹：固定19505地址、方法/运行ID、manifest摘要、请求/响应SHA、UTC、HTTP状态和实际算子/Worker版本；不保存认证头、Cookie、原始行值或令牌。日志仅用于本机合成验收，不进入产品页面，统计结果仍以正式Run持久事实为准。

沿 T15 精确 AnalysisBasis，从 S06 经正式 MethodsService 的授权、Skill 注册及分派进入独立确定性 Worker，不通过 LLM 计算数值，不以效能分析代替观察数据分析。新增 `descriptive-statistics` 白名单方法，统计单位由批准计划固定，本期基线每被试一行；源清单/固定修订/同意/最新计划审批在创建、dispatch、publish及读取/交付时复核。Worker不访问数据库，不接脚本、URL或任意代码；缺配置和不支持的方法明确失败。

输入仅固定快照 manifestHash、声明列（number/boolean）及最多1000个唯一行标识和对应原值；每个字段须明确值或null，不接受缺键/多键/数值字符串/布尔当数值。JSON字节仍服从既有65,536上限。数值列输出总行数、有效/缺失数、最小/最大/均值/中位数及样本标准差；全缺失和单有效值的未定义统计为null并附原因。布尔列输出true/false/缺失和有效样本数，不把false当缺失。统计单位/重复访视在投影层先守门，Worker仍拒绝重复rowId。不执行插补、截断、分组推断、单位推测或临床阈值。

每个实际数值均由白名单算子 `descriptive-summary` 产生并附算子版本、输入hash及明确分母，结果非有限时整次拒绝且不发布部分统计。历史快照、运行与数值保留，新更正须新快照新运行，旧结果不继续作为当前可用。预期基准来自已保存的独立 generic-v1 oracle，测试覆盖0/false/null、空样本、单样本、全缺失、非法字段、重复行及极端数值；这些单测只证明算子，不代替真实MethodsService/Worker/PG/HTTP和S06验收。

变量 key 统一为 `[A-Za-z0-9_-]{1,160}` 且显式排除 `__proto__`，与批准计划和 TS 输入投影一致；可包含连字符、数字开头，不能包含点号或路径分隔符。真实保护PG发现Prisma模型JSON写入会丢失`__proto__`列，因此计划提交、TS输入投影和Worker均提前明确拒绝，已有含该别名的快照也不可创建运行；不修通用ORM或静默丢列。`constructor`与`toString`仍须保留0/false/null实链验证。执行器版本取算子常量 `descriptive-v1`，全局 Worker 版本仍为 `t19-1`，二者分别验证。通过真实 Python serve 输出到 TS mapper 的交叉回归验证契约，不能以两侧各自单测替代。

本文件先固定数值契约；当前步骤实现Worker及边界，不因此标T16完成。MethodsService注册、Skill/Agent精准启用、正式运行持久化和页面仍需逐层完成。

## TS / MethodsService 纵向实施合同

2026-11-12。`descriptive-statistics` 同时进入 ProfessionalSkill、worker skill/executor 白名单与 workbench 会话映射；实际数值必须走 ResearchMethodWorkerClient.execute。保留全局 workerVersion=t19-1，新算子固定 descriptive-summary / descriptive-v1，执行器独立版本 descriptive-v1。缺 worker 配置、未装备已发布 Skill、无实际 Agent access 或会话权限、未启用 research_methods_worker 均明确拒绝，不构造虚假会话/Agent/Skill。

MethodsService 新增可信进程内 AnalysisBasis resolver 注入；未配置时新方法明确 503。输入只接受 `{studyId,snapshotId}`，不接受客户端 rows、answers、hash 或 basis。resolver 绑定实际 T15 assertCurrent，在 create、dispatch、publish、read、review 五阶段精确重验当前 snapshot、最新 plan review、固定修订、用途/同意及质量。当前账户/authVersion、租户与group/project活跃scope、实际 session/Agent/Skill/feature 守门保留；普通研究者继续要求真实项目/组成员及workbench/chat.use，另由T15核data.analyze。租户管理员按ADR0006不依赖逐Study成员或组角色按钮，不为过测修改共用admin role；仍须真实active scope、会话、Agent/Skill/feature及来源/用途。不可从配置字符串获得临床许可，当前仅 server allowlisted 合成 Study。

descriptive 的 workbench 会话准备也属于受保护写入：必须在同一 `withAuthorizationMutation` 事务内核当前账户/authVersion、active scope、普通研究者成员与chat.use、实际Agent/Skill/feature及真实 `assertCurrent(...,'snapshot')`，再查找/创建会话。拒绝时该事务不留下新session或run；禁止用独立预查事务后再无守门写session。会话准备提交后由原create/claim继续重验，准备成功不是运行/来源永久有效。其余旧skill的workbench路径保持。

创建使用现有 ResearchMethodRun 持久表，同一短事务写 queued、完整 basis/dataSources、requestHash/inputHash、精确 Skill/算子版本和审计。运行者只在新创建的运行上做一次 queued→running 认领（同事务 current basis/authority + row lock），执行请求不持数据库事务；环境记录不可重复认领的 claim。返回丢失、重放相同 key 或进程恢复只读原状态，不重派 running/queued/failed；不知道是否已执行时不自动重算，用户可核对或取消后以新请求创建。不同内容/身份复用 key 拒绝。worker 不可用/非法响应如实 failed；basis 变化阻止数值发布，旧快照与运行保留历史，当前读取/review 不能绕过失效。

发布前在新事务重新检查当前 basis 和同一个运行/claim/inputHash，保存 validated artifactRefs、numericEvidence、warnings、limits、环境与 dataSources 后置 needs_review。每个输出数值与 evidence 必须一一对应同名同值，要求明确 operator/version 与输入manifestHash；TS 只检查结构/有限性/一致性，不重算统计或补数。人工 confirmed 才 completed；returned/needs_input 记录审核事实并转 needs_input，需新请求运行，不因审核动作自动重派旧 claim。审阅、运行状态、审计同事务，竞争只允许一个当前状态获胜。

Hub adapter 先以真实 Study wrapper 解析/授权 scope 并提交该只读事务，再以实际 scoped user 调 MethodsService，避免持 Study 锁嵌套 Methods 事务。新工厂暴露 create/list/read/receipt/review/reviewReceipt/cancel；controller/runtime/UI 由主循环随后装配。adapter create receipt 只按同 actor/request key 的实际 MethodRun 查找并走相同 read 守门；404 保持未知，不重放创建。review 的 requestKey 绑定同 actor/run/结论/意见，审核事实、状态和回执审计原子提交；恢复只查原审核审计，不重新审核。

列表逐项尝试真实 basis 重验；旧来源失效项仅显示明确 blocked 元数据，不返回 numericEvidence/artifactRefs/dataSources/environment/inputSummary，避免一笔历史失效使后续新运行永久不可查看。权限、会话或方法授权本身失败仍拒绝。详情、回执和review继续重验并拒绝失效来源。取消是元数据例外：当前 Methods 账号/会话/方法权限仍需有效，但允许取消已失效来源的未终结运行，返回最小状态且不返回统计；取消后的迟到 Worker 不得发布。

本步骤不新建表、不执行 DDL，不改 Python worker/schema，不自动配置租户/账号、不启用真实临床。只读核对目标库发现 research_method_run_skill_key_check 仅允许原7项，因此需经独审扩展 CHECK 追加 descriptive-statistics；候选和全局历史存在即拒绝的 rollback 位于 t16/，尚未应用，不改历史迁移或执行 migrate deploy。单元测试仅证明代码边界；后续须真实受保护 PG、精准 Agent/Skill/feature 配置、实际 Worker HTTP、S06 浏览器、独立 oracle 与失效竞争证据，才能判 T16 软件能力完成。
