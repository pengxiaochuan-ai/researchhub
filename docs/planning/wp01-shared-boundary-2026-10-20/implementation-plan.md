# WP01「共享边界」Implementation Plan

## 2026-10-22 · 当前批准：收敛共享底座，业务优先

用户已批准暂停T03–T24（含T22b）完整生产排空协议实施；保留T01/T02及原安全修补、冻结证据，不新建控制schema、boot凭据或执行ticket，不装配新停线协议。T03身份方案转暂停事项，不再是本机业务开发阻断；下方旧“待确认后继续T03”等记录仅为历史，不自动恢复。

最多1个工作日（累计8小时）完成专用合成环境开发准入核对；通过后自动进入账号授权、知识资料和科研AI主链路。仅使用wp01_test_full_baseline及全新具名任务，当前目录串行，不触碰临床库、旧服务或历史测试任务；云资源、旧服务停线、真实发布及新增范围再确认。

开发准入不等于G1全部真实AI链、WP01整体或生产验收通过。T25质量/证据/文档要求随业务切片持续履行；原租户边界、当前授权、claim、受控源码/发布保护不取消。维护窗口替代策略须另行评审和授权，不能直接放行发布。注册/找回/邀请、全部已确认AI入口及11月中旬验收目标不缩减。

当前执行计划：[开发准入与业务优先](../development-admission-2026-10-22/task_plan.md)。下方截至本条之前的进度及未批准事项保留作历史/证据；当前核对结果与自动转入情况以新计划progress.md为准。


## 2026-10-22 · T01–T02本机验证通过，T03身份衔接待确认

本轮用户批准小步计划后已串行实施T01–T02：新合成夹具守门15/15、契约/清单31/31，真实PG target-guard12断言与inventory6断言通过，各新run九表历史摘要一致；裸后端828/58/16/41/84/85/23/2/2各组0失败/skip（可重叠），Web构建通过。真实Chrome对未改Hub原型桌面/移动只读烟测2项、2PNG/2WebM、0pageerror/consoleerror；不代表正式两角色UI或新生产门禁已验证。

T03只读预检在本轮新task上发现：受限app无上下文可见0行，现有共享owner可见1行，app补原tenant/group/project事务上下文后可见1行。直接换低权限DIRECT_URL会遇到现有后台事务的RLS上下文缺口；共享owner的session_user也不能证明deployment/boot。按计划停在新增确认项，未创建role/GRANT/wp01_ops或迁移文件，未推进T04、修改旧生产方法/真实.env、重启旧服务、操作云或真实发布。

Task10–11: `partial_t01_t02_verified_t03_identity_design_confirmation`。建议补审“独立最小权限控制/登记连接＋仅服务端持有的boot凭据在原业务事务中核验”，保留原业务权限/授权/claim且不改旧RLS；这是待确认设计，不是已实施替代方案。唯一当前证据与方案说明：`docs/test/evidence/2026-10-22-wp01-quiescence-t01-t03/README.md`。旧“计划待评审/T02推进中”为历史，计划已获批，但WP01整体与生产四层未销项。

## 2026-10-22 · 停线规格已批准，小步实施计划待评审

用户已批准Q01–Q12生产停线与排空规格的推荐方案。小步计划统一见 `researchhub/docs/planning/wp01-shared-boundary-2026-10-20/production-quiescence-plan-2026-10-22.md`：25个串行任务、四阶段、首批仅T01–T03，含精确文件/接口、RED→GREEN命令与Q-T01–Q-T12测试映射。

Task10–11: `partial_quiescence_spec_accepted_plan_awaiting_review`。本轮仅计划与文档校验，没有实现/启用新协议、运行数据库或浏览器任务。后续仅本机专用合成环境；云资源、生产首次接入/停线/迁移及真实发布另行确认。以下2026-10-21“规格待评审”为历史，已由本次规格批准解决；既有四层验收与独立评审记录不改写。

## 2026-10-21 · 生产停线与排空实施规格待评审（仅文档）

用户最新批准仅编制生产停入队／停认领与排空门禁规格，评审确认前不修补生产代码、不操作云资源或真实发布。推荐的持久门禁、跨实例屏障、在途提交、超时、恢复、首次接入和验收规则统一见 `docs/tech/wp01-deployment-boundary.md` 的“Q01–Q12 生产停线与排空实施规格 V0.1”；该节为本追加范围唯一规范正文，状态 Proposed，尚未批准实施。

Task10–11: `partial_production_quiescence_spec_awaiting_review`。先前本机具名演练证据保持有效但不证明生产协议；以下旧“范围待确认”仅为历史，已由本轮“允许写规格”解决，不等于允许写代码。原源码批准、保护配置、全类真实执行和专业验收门槛不减免，WP01整体不销项。

## 2026-10-21 · 本机具名排空恢复已验证，生产门禁范围待确认

- 本轮批准的本机新建具名任务演练已验证：测试控制器7项RED→GREEN；真实IngestService/RawProcessingService、独立MinIO/PG及新OS进程＋真实Chrome16检查通过，4PNG/1WebM、0pageerror。先停入队/认领并等待准入屏障，在途实际15秒续租并提交needs_review；进程退出不冒充排空，实际等120秒DB租约到期才保守标WP01_EXECUTION_INTERRUPTED，禁止旧令牌发布和自动重放。
- 同源重复上传仍返回原failed；显式复制受控材料到新来源key，通过既有ingestStoredRaw建立新任务，不新增产品重试入口、不改写旧失败行。原字节、先前合法结果与轨迹保留。六类共享claim/recovery仅以另一全新租户的元数据验证，不冒充六类真实执行器；新NULL-claim哨兵保留人工核对，不宣称全库/整租户已排空。
- 完整后端828/58/16/41/84/85/23/2/2各组0失败/skip（组合可重叠），Web构建通过；不重复会改历史夹具的native all。九表历史摘要不变，旧.env SHA、PID722/729及既有预发布进程不变。所有运行用新夹具，失败/中间记录也保留不重用。私有连接/密钥不入证据；子进程尝试读取旧.env被系统沙盒拒绝的预期EPERM日志保留，不声称运行日志全零错误。
- 已按原计划继续只读核对发布入口：版本/摘要门禁存在，但生产没有本机测试控制器的准入/排空协议；Raw禁用同时阻断在途发布，不能直接替代优雅排空。新增待评审范围见docs/tech/wp01-deployment-boundary.md，仅提案、未改生产。Task10–11: partial_named_local_drain_verified_awaiting_production_quiescence_scope；云资源、真实发布、生产准入改造、准确安全源码批准、全类真实执行/业务验收仍未完成，WP01整体不销项。证据：docs/test/evidence/2026-10-21-wp01-local-drain/README.md。

## 历史检查点 · 本机独立预发布已建立，排空恢复待确认

- 已按用户授权建立本机独立演练环境：完整 main/AppModule 的 A/B 后端为不同 OS 进程，共用已标记专用合成库 wp01_test_full_baseline（runId=wp01-native-20261020-a391cbb4）。新端口、随机密钥、Cookie、临时/日志/OpenCode目录与独立 MinIO；只复用经校验的合成 PG 连接，不继承旧.env其他配置。旧PID722/729及源.env SHA不变，未接临床库、未迁移、未创建云资源或真实发布。
- 本轮安全测试15通过（纯配置9＋真实系统沙盒1＋运行/生命周期5）；完整后端828/58/16/41/77/85/23/2/2各组0失败/skip（组合可重叠），旧Web和Hub构建、RLS12、发布专项24及部署契约20通过。新真实Chrome8检查、3PNG/3WebM、0pageerror；预期401/403及初稿/启动失败日志保留，不把控制台负向记录说成零错误。首个internal MinIO网络在Docker Desktop不能映射端口，已改独立禁IP伪装bridge；后端OS沙盒另行实证限制外联。
- 完整双后端实际启动与会话/跨租户/控制面/私有研究边界已验证，不再只是替换AppModule的装配哨兵。后台消费者初始为空，没有扫描/排空历史合成队列；AI、解析、embedding/联网和专业产物效果未验证，ready明确deliveryReady=false。18502仍是旧Web验证Hub后端边界，不是Hub正式业务UI；18503是单独Hub前端原型。四层验收仍不整体销项。
- 当前环境目录 .tmp/wp01-pre-release/rehearsal-o7gOnS；[旧侧演练入口](http://127.0.0.1:18501/admin/tenants)、[Hub后端边界验证入口](http://127.0.0.1:18502/admin/tenants)、[Hub原型](http://127.0.0.1:18503/pages/p002/)。操作与证据：docs/test/evidence/2026-10-21-wp01-local-pre-release/README.md。私有runtime.json含演练密钥/DB连接，700目录＋600文件、gitignore，不上传或同步Notion。
- Task11: partial_local_pre_release_api_verified_awaiting_drain_confirmation。原“隔离目标待确认”已由本次本机授权解决；下一确认项仅为原计划停止入队/认领、排空与恢复演练。未自动启用任何Worker，未生成正式发布批准，唯一总评审历史No及两Important修补证据保持；云资源、真实发布或任何排空必须再获确认，WP01不能据此标整体通过。

## 历史检查点 · WP01总评审两项修补已验证，待确认独立预发布目标

- 本轮追加批准已兑现（仅本地）：activateConfig/updateConfig在现有共同tenant锁内读取/翻转配置及分配版本，interactive事务原子提交配置与原样审计；createMany只追加原审计、不读取受RLS限制的返回行，权限/RLS/schema未变。保留原版本CAS、模型/工具/技能快照和页面。Worker证据最终提交异常以WORKER_EVIDENCE_PERSISTENCE_UNCONFIRMED中断，原异常留cause，不二次覆写completed、不重新检索/假报交付；同步入口、人工审核与计费不变，SkillInvoker/Orchestrator源码未改。
- RED→GREEN：配置9项修补前7失败，证据提交18项修补前4失败；追加真实Service→SkillInvoker传播红测（19项中5失败），最终配置9/9、证据19/19。完整后端828/58/16/41/68/85/23/2/2各组0失败/skip（可重叠），Web构建、发布专项24与部署契约20通过。初稿夹具/旧单元依赖适配失败及一次构建尚未回报结束就启动的暂定native结果均保留，不当最终绿色。
- Task11已续行：串行native all最终退出0，17组1142条检查记录全通过（组合可重叠，不与专项计数相加），含授权115及科研66。新认证浏览器6＋控制面浏览器6通过，9PNG/4WebM、0pageerror；401/403负向请求及预期控制台记录保留。实际旧超管列/详情/编辑B、刷新持久化/单条审计、B管理员UI/API拒绝及authVersion失效均验证，测试席位已恢复。仍是旧Web/同OS双Nest，不是Hub正式UI、全后台导航、全类别独立Worker OS或正式业务验收。
- 唯一全包独立评审原结论No永久保留；2个Important已在既定一次修补轮用真实PG红→绿和完整回归闭环，不派二次评审、不把原报告改成Yes。两生产文件逆变换SHA与上次冻结源码一致，其余42份非文档源码/配置未变。未提交/推送、未改真实.env/旧PID722/729、未生产迁移/部署/排空。证据：docs/test/evidence/2026-10-21-wp01-final-review-fixes/README.md。
- 当前无新增代码范围确认项；下一门槛是独立预发布目标与安全配置路径（只用合成数据，不接临床库/旧生产），确认前不建立云资源、不跑真实部署/排空。Task11: partial_awaiting_isolated_pre_release_target_confirmation；Task9–11/全包四层仍不整体销项。目标变量/保护规则、OSS写ACL、准确安全源码提交及完整恢复/真实请求/业务验收未核实；“未配置”仅指本轮未设置，不能断言远端现值为空。

## 历史：本轮两项修补批准与实施契约

异常传播核对：只抛普通数据库异常会被现有SkillInvoker转换为failed结果。追加真实Service→SkillInvoker合成PG红测已复现；在ResearchEvidence既定提交边界使用既有WORKER中断协议（WORKER_EVIDENCE_PERSISTENCE_UNCONFIRMED），原异常保留cause。无需修改SkillInvoker/Orchestrator代码，复用其已批准失效传播分支；不改变同步入口、权限或计费。保留提交成功但交付不明与真正回滚两种原始证据，不把pending审核候选当正式交付。

真实PG前置核对：配置两个入口原auditLog.create带RETURNING，租户级审计无project SELECT权限而被RLS拒绝；updateConfig在forTenant扩展客户端上的数组事务还出现审计失败但配置变更残留。限于已批准两方法，将审计改同事务createMany只追加同一事件（不消费返回行），不改审计内容/权限/RLS/schema；interactive事务＋共同锁将配置/版本/审计真正原子化。新测试以审计故障及并发版本分配保护，不绕过约束。夹具曾使用已退役模型/不完整归档元数据，已按当前模型与约束修正，初稿失败保留、不充作锁缺陷证据。

用户本轮明确批准AgentsService.activateConfig/updateConfig共同租户授权锁和对应测试；保留配置版本/CAS、权限、审计与页面。原Task7证据提交问题同时修补，不再待批。当前目录串行，唯一总评审已做完；本轮为既定一次修补轮，不派二次评审，不部署/迁移/改真实配置或重启旧服务。

实施契约：配置激活和新版本创建的实际原子事务先取得现有tenant授权锁，再读/翻转配置；updateConfig的下一版本读取移入同一事务，技能快照、模型策略、现有CAS/审计及响应保持。双向真实PG barrier验证撤权先提交则Worker拒绝，发布先持锁则配置变更等待；加审计回滚、CAS冲突、版本递增及跨租户兼容用例。

证据提交契约：Worker最终事务的失败无法仅凭抛错判定COMMIT未成功，保守传播原异常，不二次覆盖已完成状态、不回滚已提交候选、不重检索或假称交付成功；普通同步入口保持原失败处理。真实PG在完成事务实际提交后注入回执错误，验证结果/审核状态保留、异常向上与无重复检索；提交前故障仍原子回滚。补回归后继续Task11，W17/W18/独立OS/目标配置/完整恢复及业务验收仍按证据单独判断，不以局部绿代替。

## 2026-10-21 · WP01发布控制局部验证，全包评审阻断

- 本轮前置控制入口追加批准已兑现（仅本地）：cloud-assistant-bootstrap按固定六文件集合完整/唯一校验SHA清单及实际字节，缺失/重复/路径别名/错摘要一律在安装/执行前拒绝；新增WP01策略与release manifest分发，取消本机旧脚本回退。云助手＋OSS方式、消费者、权限、计费和页面保持，未触碰真实部署。
- 原Task10发布门槛已接线：受保护reviewed-source批准必须匹配准确源码提交、四项安全能力、独立总评审/消费者清单与证据摘要；controlled build封存实际镜像ID/归档/Compose摘要，再由真实发布/回退入口在替换Compose、迁移或启动前验证。Node门禁仅使用已加载镜像的node entrypoint、只读临时目录、无网络/真实.env；ready运行指纹与预放行manifest分开留证据。当前WP01_SHARED_RELEASE_APPROVAL未配置、总评审未放行，禁止填真或拿脏副本HEAD作安全版本批准；信任边界仍是受控workflow/OSS写权限，不声称能防御root/OSS写失陷或直接跑旧二进制。
- 本地发布专项24/24、前置包2测试方法/16子场景及部署契约20/20通过；完整后端828/58/16/41/68/85/23/2/2各组0失败/skip（可重叠）、Web构建与新浏览器6通过，4PNG/2WebM、0pageerror。浏览器仍是旧Web/同OS双Nest，不冒充Hub正式UI或完整W17/W18。真实脚本只替换临时路径/外部执行器，核心checksum/Node policy真实执行，不等于云/Docker/生产发布或暂停排空演练；所有RED/中间失败保留。证据：docs/test/evidence/2026-10-21-wp01-release-control/results.json。
- 已继续Task11：补all串行聚合和browser编排；all先实证未实现，再补接线，本轮完成显式重放114/情报73/DQ92三组。独立总评审发现新增AgentConfig撤权竞态后，在methods启动时停止聚合，退出143，整套不能计绿；finally清理可能未执行，保留具名合成夹具，未绕过触发器/约束或删历史。正式配置/各类别独立OS、控制面全导航、完整恢复演练和业务验收仍未通过。
- 唯一全包独立只读总评审结论No：2个Important、无已证实Critical/额外Minor。新范围是AgentsService.activateConfig/updateConfig缺共同tenant授权锁；另有已批准Task7范围内的ResearchEvidence提交确认不明后可能将completed覆写failed。主集成核实后暂不改这些生产方法，等待仅新增配置入口范围确认，再在一次修补轮处理两项，不派二次评审。Task11: partial_awaiting_agent_config_revocation_scope_confirmation；本次发布入口不再待批，不标Task9–11/全包或四层验收完成。无生产迁移/部署/真实.env修改/旧PID722/729重启/提交推送。


## 历史：发布控制入口批准时的实施记录

用户本轮批准 cloud-assistant-bootstrap.sh 的控制文件校验、分发和旧回退兜底及对应行为测试；保持云助手＋OSS部署方式。Task10: in_progress_release_bootstrap_guard；此前“前置入口待追加”仅为历史，不重复询问。继续原Task10 manifest/digest/最低能力门槛，当前目录串行，不改业务消费者/权限/页面，不执行真实云发布、迁移、排空、真实.env或旧服务重启。

先验证下载缺失、集合缺失/多余/重复、摘要错配均在安装/执行前失败；旧回退不得凭本机旧脚本绕过校验。控制包固定纳入独立WP01策略文件，沿现有受控构建/OSS权限及SHA校验信任边界，不把任意标签或事后ready响应当已验证安全能力。通过后继续Task11全包回归与一次独立总评审，目标配置/真实请求/业务验收仍分层举证。

## 2026-10-21 · WP01启动装配门禁本地验证，发布前置入口待追加

- 本轮 main.ts 追加批准已兑现（仅本地）：容器创建后立即调用内部 assertWorkerConsumerAssembly，早于中间件、init/listen 及 Worker 生命周期；按实际类 token 解析六类 enabled 消费者并核对原生命周期入口。research-agent-runs 与 research-stage-attempt 共用既有 ResearchAgentRunsService；缺失/无效以 WP01_WORKER_CONSUMER_MISSING 中止，不调用消费者或认领。main.ts 仅新增 import 与一次调用，去除两行后 SHA 与 HEAD 的 384780d11ebecba3e97a6ab215bd8c6b66af8bda0b414c19dbcd46b52580f3b9 一致；六类消费者、默认启停、旧 RAW_PROCESSING_WORKER_DISABLED、官方知识任务策略、权限与页面未改。
- 真实编译 main＋Nest＋实际 scope 工厂/受保护合成租户目录：修补前6正常/配置对照通过、14安全反例失败；修补后20/20，缺 provider/无生命周期方法/未知kind均在初始化与listen前拒绝，相关启动/销毁钩子及实际claim均0。单元2项包含真实五个消费者类的装配，不启动真实Worker；主入口测试只替换会加载真实.env的AppModule为安全根模块，以类token生命周期哨兵观察顺序，不代表完整生产装配、真实Worker业务或目标启用。失败后不在主入口主动close引发Worker销毁钩子，保持原未捕获启动失败的进程退出策略；测试记录后自行清理。
- 完整后端828/58/16/41/68/85/23/2/2各组0失败/skip（组可重叠），Web构建通过；resources39、授权106最终整套及认证浏览器6新回归通过，4PNG/2WebM、0pageerror。授权首轮106中一项configureMembers出现PrismaClientInitializationError；保留失败，不改生产或放宽断言，在测试进程将已验证localhost明确固定127.0.0.1后整套106重跑通过，未断言已定位初始连接故障根因。真实浏览器是两隔离Nest应用同OS＋旧Web，不冒充ResearchHub正式认证UI。证据：docs/test/evidence/2026-10-21-wp01-bootstrap-assembly/results.json。
- 继续原计划Task10只读/隔离核对发现额外落点：cloud-assistant-bootstrap.sh实际下载/安装固定控制文件集合，rollback下载失败可执行本机旧ecs-release.sh；仅改下游ecs-release或workflow不足以证明入口受控。实际脚本只替换临时目录，以假Python/执行器演练：deploy正确拒绝；rollback仍执行合成旧脚本、退出0，安全反例失败（诊断退出1），未运行云/OSS/Docker或真实发布。夹具初稿在下载分支前早退，已补明确到达下载决策的断言并重跑，不把初稿当绿色门禁；原生产脚本和部署架构保持未改。
- 本次启动修补不再待批，Task9仅局部通过；Task10: partial_awaiting_release_bootstrap_scope_confirmation。请求仅追加前置cloud-assistant-bootstrap.sh的可信控制文件校验/分发与旧回退兜底及对应行为测试，保持云助手＋OSS方式，只允许已验证安全版本、缺失或校验失败即拒绝；不扩大为CI/CD重构。Task9全包/Task10–11、独立总评审、目标配置/真实目标请求/专业业务验收仍未通过；不执行task-done或正式启用。无新schema/生产迁移/部署、真实.env修改、旧PID722/729重启、提交或推送。

## 历史批准 · 主启动装配守门

用户本轮批准 main.ts 主启动入口的最小装配守门：Nest 容器创建完成后、任何 Worker 初始化/启动/认领及监听前，逐一核验 enabledWorkerKinds 对应实际 provider 与原生命周期入口；缺失即启动失败。保留六类既有消费者、默认空启用集合、旧 RAW_PROCESSING_WORKER_DISABLED 和官方知识任务策略，不扩展业务权限、不新增 schema 或改真实配置。Task9: in_progress_bootstrap_consumer_guard；上一检查点“待追加”仅为历史，不重复请求批准。

先以实际编译 main 入口、隔离 AppModule 与合成租户目录验证 RED，再补最小内部装配函数并验证全部 kind、共享科研 provider、未启用/未知 kind、生命周期与监听顺序；测试生命周期哨兵不等于真实 Worker 业务验收。保留既有服务/PID/页面及所有未提交改动，完整回归、原生合成 PG 与浏览器证据后继续原 Task10–11；生产发布/迁移/排空仍不在授权内。

## 历史检查点 · WP01下载读取本地验证，启动装配门禁待追加

- 本轮两个读取入口追加批准已兑现（仅本地）：ResearchArtifactsService.fileContent 与 SessionsService.attachmentContent 共用内部 resource-read 当前身份/租户/authVersion、活跃组/角色/项目/成员短事务；各自指定原入口权限，未改 worker-publication 既有行为或公开API。产物仍 artifacts／artifact.export，诊断在同事务核原 diagnostic_artifacts 与显式 diagnosis_export，管理员不自动绕过；附件仍本人未删除会话、workbench／chat.use、服务端签发或精确历史消息引用，不新增Agent装备、创建者或最新版本要求。
- 产物真实 file→artifact/version 逐级核同租户/组/项目与父绑定，冻结文件字段、真实版本哈希及产物状态；附件冻结真实session归属与读取快照，旧附件原精确键/文件名的message见证在原生PG JSON包含查询中复核。stat后及getStream后重验，失效关闭本次未交付流；存储I/O在锁外。固定旧版本与草稿保持原可读资格，读取途中状态/版本变化中断；签发附件不增加必须持久化消息的条件。两份服务移除本批改动后重建SHA与上轮 c93bc94b8953ce18bca2a3a3be617d653ecf90cf4012b6dc86c1e480170ea238 / 19ff47f92c5ffcd3b358aea4d02b1109cf414ca25c38c9e5c7158f37feb83421 一致，其余既有代码保留。
- Range/同源URL、格式/存储摘要校验、保留、计费和页面保持。产物同步去重审计仍在取流前，加入stat后当前授权短事务；审计失败仍阻断取流，后续失权/流失败不删除此前合法访问审计，不把访问记录当成字节成功送达证明。会话附件不新增审计。原产物Range仍不支持后缀格式，附件后缀Range继续支持；测试按两个原契约分别断言，未改解析算法。
- 最终本地证据：两个读取链原生PG114/114，完整后端828/58/16/41/68/85/23/2各组0失败/skip（分组可能重叠），Web构建通过；原始读取121、resources39、共用授权106、认证浏览器6新回归通过。实际原ResearchArtifactsPage及AttachmentThumb、API/Controller、JWT-Cookie/Roles/StudyGroup守卫、服务和受限合成PG，两角色×两入口×正常/取流撤权8场景，最终8PNG/8WebM、0pageerror，正常下载/206 Range核对合成字节，撤权无字节交付并关闭流。附件组件只在虚拟测试模块补导出，不改源码；产物上游请求选择已持久化合成ready job，不运行实际导出生产者。仅合成对象与临时测试签名，不冒充完整导航、真实存储/渲染、目标或业务验收。证据：docs/test/evidence/2026-10-21-wp01-content-read/results.json。
- 失败过程保留：修补前6场景2正常对照通过、4撤权安全反例失败。专项初轮105包含产物后缀Range错误预期，按原不支持格式改测400而非放宽生产；106全绿后加真实父版本错配、跨项目会话及entry诊断撤权，整套114重新通过。完整回归一条旧fileContent源码正则因门禁移至内部helper失败，替换成实际服务的停用角色/摘要/同步审计故障/取流撤权行为测试后，全套重新通过，未添加假注释或放宽权限。
- 继续原Task9的W20装配核对，仅新增启动落点待确认：实际createDeploymentScope＋Nest隔离启动、受保护合成租户目录，注册生命周期哨兵对照通过、未知kind对照正确拒绝；声明已启用raw-processing但缺provider仍完成初始化并执行另一生命周期哨兵，反例Missing expected rejection、诊断退出1。真实Worker/claim/完整AppModule均未启动，不声称当前生产包实际缺provider。现仅诊断，未修改main.ts或启动装配代码；建议最小追加主bootstrap实际装配核验及必要声明，在任何Worker生命周期/认领前发现已启用消费者缺失即中止，保留原消费者、默认启停策略与业务行为。Task9: partial_awaiting_bootstrap_consumer_guard_scope_confirmation；本次两个下载链不再待批，Task9全包/Task10–11/独立总评审及正式四层验收未通过，无生产/新schema/真实.env修改/旧PID722/729重启/提交推送。

## 历史批准 · 产物下载与会话附件读取统一修补

本轮用户批准 ResearchArtifactsService.fileContent 和 SessionsService.attachmentContent 及必要私有读取门禁。Task9: in_progress_remaining_content_read；下面“剩余下载链待追加”仅为历史，不重复询问。当前目录串行，先保留正常对照/撤权RED，再实施与验证，通过后续原计划。

契约：共同tenant短授权锁核当前账号/租户/authVersion、真实组/角色/项目/成员及原入口权限。产物保持 artifacts／artifact.export，诊断仍核原功能开关与显式 diagnosis_export；会话保持本人未删除会话、workbench／chat.use及原服务端签发或精确历史消息引用规则，不加Agent装备或额外资格。真实 file→artifact/version、session→附件引用及读取字段准备快照在stat后、取流后重验，失效销毁未交付流；存储I/O在锁外。Range/URL、原审计策略、保留、计费与页面不变，不承诺撤回已合法发送字节，不新增schema或部署。

验证清单：两入口合法/原权限/诊断能力正反例；entry/stat/getStream撤权与真实父对象、读取字段/版本变化；未交付流销毁；新签发与历史精确引用、归属隔离；Range/同源原生URL、摘要和原审计失败策略；原生受限合成PG、单元/完整后端/Web及科研/管理员实际页面截图录屏。无真实临床内容、对象存储或模型调用；保留全部已有代码，不改真实.env、不重启旧PID722/729、不提交/推送。仅新范围停线，四层验收仍分别举证。

## 历史检查点 · WP01原始数据读取本地验证，剩余下载链待追加

- 本轮批准已兑现（仅本地）：DataService.rawContent 的 file/photo 在共同 tenant 短授权锁内校验当前账号/租户/authVersion、原 data 菜单与活跃组/角色/项目和成员；绑定真实 file/photo→subject→项目/组及可选访视。准备快照在 stat 后、getStream 后复核，失效则拒绝交付并销毁本次未交付流；存储 I/O 在锁外，不声称撤回已合法发送字节。
- 不增加 Agent、chat.use、上传者、删除或分析权限；当前获权的非上传者仍可读。指纹仅覆盖读取授权及实际读取字段/父绑定，不把名称、额度、无关按钮或普通更新时间当撤权。请求开始前已合法变更的记录按当前版本读取，不能把它误判为本请求途中陈旧。Range 算法、原生媒体 URL、异步去重审计、对象保留、计费、页面不变；重建修补前文件 SHA 与 44405f6adc4f1595bcec2be037c9a9e96b9a7f7321c277bae42a714503ba510b 一致，既有 softDelete 和确定性统计代码完整保留。
- 本地证据：原始读取原生 PG121/121；完整后端 826/58/16/41/68/85/23/2 各组 0失败/skip（分组可重叠），Web 构建通过。未改 RawDataPage/API/Controller，实际 JWT-Cookie、Roles/StudyGroup 守卫、DataService 与受限合成 PG，两角色×file/photo×正常/取流撤权共8场景通过，最终8PNG/8WebM、0pageerror；正常场景核 PNG 字节/206 Range/无 scope header 原生 URL 和旧无查询参数 URL。使用临时测试签名密钥和合成对象流，不等于完整导航、生产存储或业务验收。共用 resources39 与授权106新回归通过，认证浏览器结果见本轮归档。
- 过程失败如实保留：首轮原生夹具用了不存在的 tenant disabled，且未等异步审计落库；只修测试。修补后首轮115中109通过，6项对“请求开始前合法版本变化”的错误拒绝预期被修正，补跨项目父对象后整套121重新通过，不拼接局部结果。浏览器初稿缺闭合符、上下文未通过原客户端设置、无关处理任务详情未装配，均保留失败日志；只修测试壳，改为合法未处理上传样例，原页面及权限不变。证据：docs/test/evidence/2026-10-21-wp01-raw-content-read/results.json。
- 按原 Task9 清单继续盘点，新增两个独立读取链实证但尚未修改：ResearchArtifactsService.fileContent（产物文件下载）和 SessionsService.attachmentContent（会话附件预览）。各合法对照通过，stat 和 getStream 期间撤销成员后仍各返回流且未关闭；6场景中2对照通过/4安全反例 Missing expected rejection，诊断退出1，不能算绿色门禁。两方法与当前既有源码保持，仅留诊断；此前产物导出 Job、消息执行提交等批准不等于批准这些独立下载链。建议统一最小追加当前原入口授权、真实文件/产物版本或会话/附件引用父对象、读取快照重验及失效时未交付流释放，保持各原权限、诊断显式授权、Range/同源 URL、审计、数据保留、计费和页面。
- Task9: partial_awaiting_remaining_content_read_scope_confirmation；本次 rawContent 不再待批，下方旧“原始读取待追加”仅为历史。Task9全包、Task10–11/独立总评审、目标配置/真实目标请求/专业业务验收仍未通过，不执行 task-done 或正式放行。无新增 schema/生产迁移/部署、真实 .env 修改、旧 PID729/722 重启、提交或推送；真实模型/对象存储/外部网络0，未读临床内容。按用户范围纪律，仅为这两个新独立链停线确认。

## 历史批准 · 原始 file/photo 读取最小修补

用户已批准 DataService.rawContent 的 file/photo 读取路径。本轮 Task9: in_progress_raw_content_read；下方“待追加/待确认”仅为历史检查点，不重复询问。当前目录串行实施，保留所有已有改动。

契约：保持原 data 菜单与当前成员读取资格，不增加 Agent、chat.use、上传者或删除权限。短租户授权锁内核当前账号/租户/authVersion、真实组/角色/项目与成员，绑定 file/photo→subject→项目/组及可选访视；准备快照在 stat 后、取流后重验，存储 I/O 在锁外。权限/父对象/读取版本失效则拒绝交付并销毁本次未交付流，不声称撤回已合法发送字节。Range、原生媒体 URL、异步去重审计、数据保留、计费和页面保持；不新增 schema，不部署、不修改真实配置或重启旧服务。

验证：先保留合法对照与撤权 RED，再覆盖两类对象的当前授权、真实父对象、读取字段变化、stat/取流撤权、流销毁、Range/无自定义 header URL、原审计及浏览器截图/录屏。仅具名合成 PG 和合成流，不访问临床内容/真实对象存储。验证后继续 Task9→10→11，仅新增范围需再确认；本地代码通过不等于目标配置、真实请求或业务验收。

## 历史检查点 · WP01资源封口本地验证，原始数据读取待追加

- 本次显式查询重放批准已兑现：原生PG114、查询专项23、两角色原页面6场景及完整回归通过；DataQueryReplayService不再待批。确定性算法、原资格、幂等、审核、计费和页面保持，前一检查点/证据见docs/test/evidence/2026-10-21-wp01-query-replay-publication。后续资源修补仅延续已批准Task9，不据此宣称WP01整体通过。
- Task9已修局部资源边界：分片先核拥有者再处理过期清理；默认根固定到已校验DEPLOYMENT_ID的部署子目录，不触碰旧共享根。OpenCode Pool使用启动时注入的部署scope，获取缓存实例前验证允许租户，工作区/状态/配置落到deployments/<deploymentId>/tenants/<tenantId>/workspace，不读、搬迁或清理旧目录。只物化合成配置做文件系统验证，未运行真实OpenCode或验证目标路径；目标启用前仍需核对旧活跃上传/会话状态及受控排空，不自动迁移历史。
- 知识检索、详情/原件及知识搜索在共享official→tenant短锁下核当前账号/租户、authVersion、组/角色/项目与成员和原入口权限；直接知识入口仍要求knowledge，检索保留knowledge只读或workbench＋chat.use两条原入口，不改成两者同时具备、不增加Agent装备/创建者要求。权限指纹仅含实际授权字段，不把额度/名称等普通更新时间当撤权。Embedding/向量或关键词搜索/对象stat/取流在锁外；返回前重验当前允许库、chunk→doc→kb真实父绑定、审核/回收站/文本快照。原件在stat后及取流后重验身份与文档/原件指纹，失效则销毁本次未交付流；不承诺撤回已合法发送字节。原评分/降级、storageKey、审核、计费及页面不变。
- 最终局部验证：resources聚合39/39（文件系统6＋知识PG21＋RLS基线12），包含实际512维pgvector正例/撤权/撤指派、官方只读与无chat的知识菜单正例；新增资源单元2、完整后端824/58/16/41/68/85/23/2各组0失败/skip（分组可重叠）和Web构建通过。未改OriginalDocumentView/API客户端/KnowledgeController＋实际服务/受限PG，两角色正常下载与stat期间撤权4场景、4PNG/4WebM，下载核对合成字节、0pageerror；可信合成actor和对象流不是HTTP Guard、真实对象存储、完整导航或专业验收。共用授权106及登录浏览器6（4PNG/2WebM、0pageerror）新回归通过；所有RED、夹具/类型/默认测试装配失败与最终结果留档docs/test/evidence/2026-10-21-wp01-resource-closure/results.json。
- 新增范围实证且尚未修改：DataService.rawContent的file/photo读取各有合法正例；对象stat期间撤销成员后仍各getStream一次，两个安全反例均Missing expected rejection，诊断退出1不是绿色门禁。此前批准的是softDeleteRawItem，不包含这个独立读取链；DataService全文件SHA仍44405f6adc4f1595bcec2be037c9a9e96b9a7f7321c277bae42a714503ba510b，现只诊断/留证据。建议追加该两路径的当前读取授权、真实父记录/准备版本重验及失效时未交付流释放，保留原data菜单/读取权限、Range、无自定义header的原生媒体URL、审计、数据保留、计费与页面；仅等待此新增范围，不重复批准重放或本次资源文件。
- 当前Task9为partial_awaiting_raw_content_read_scope_confirmation；全包资源入口仍未通过，Task10–11/全包独立总评审、目标配置/真实目标请求及业务验收未完成。没有生产迁移/部署、真实.env修改、旧PID729/722重启、提交或推送；模型/真实存储/外部网络0、未读临床行。既有安全代码不等于目标环境已启用；先停扩展并等待新增读取范围确认。

## 历史检查点 · WP01显式查询重放提交本地验证，继续资源封口

- 本次批准已兑现（仅本地）：DataQueryReplayService显式重放的认领、心跳、准备与成功/失败提交，在受限RLS和共同tenant授权锁下重验当前账号/租户、authVersion、课题组/角色/项目及成员、原workbench／remediation.retry和research_methods_worker；不新增data.analyze、chat.use、Agent装备或原查询创建者资格，合法其他当前成员仍可重放。真实query→case→attempt、可选session/message、阻断/放行gate→qualityRun逐级核归属与绑定，行锁和准备指纹覆盖输入、父版本、startedAt、状态、token；合法heartbeat/lease易变字段排除指纹，但单独重核实时租约。
- 复用原120秒租约、40秒心跳、幂等键和显式过期回收策略；短授权/提交事务10秒，确定性统计保持单一RepeatableRead快照，在授权/查询写锁之外运行，只有该准备事务扩为180秒有界上限。续租每次重验当前授权和真实父状态，过期或旧token不能复活。结果/草稿产物、版本/3条溯源、query/case/attempt终态、事件及原审计同事务；普通计算错误保留原失败契约，证据stale门禁与获权失败也同事务。撤权、版本/租约变化、写入/提交确认异常直接传播，不二次failed、不自动重放；已提交结果不因确认丢失被覆盖。
- 原executeInitial/list、DataService统计公式、查询规范化/结果渲染、原权限资格、显式重放幂等、人工审核、计费、页面及API返回保持。原生原请求不可变触发器与案件状态CHECK未绕过；测试改用合法ready_to_retry反例，并单独证明原请求非法变更被DB拒绝且原数值42正常完成。长时准备超时只在该重放路径增加，不改其他入口或共用默认事务配置。
- 最终本地证据：查询重放原生PG114/114，实际125秒统计续租3次且仅一份草稿；真实40秒定时器遇撤权中断、无失败终态。查询专项23/23、完整后端各组824/58/16/41/68/85/23（分组可能重叠，不作去重总数；0失败/skip）及Web构建通过。未改DataQualityPage/API客户端/Controller DTO＋实际服务/确定性DataService/受限PG，科研端与管理员端各成功/撤权/普通计算失败共6场景、6PNG/6WebM，0pageerror；可信合成actor、人工合成放行门和无关读适配不冒充HTTP Guard/专业验收。授权PG106、RLS基线12及登录浏览器6（4PNG/2WebM、0pageerror）新回归通过。首轮原生115中5项因非法测试变更和夹具超时失败，修正后全套114重新通过，原日志全部保留；不关闭原生保护，也不拼接局部通过。证据：docs/test/evidence/2026-10-21-wp01-query-replay-publication/results.json。
- 该独立重放追加范围无需再次批准；继续原计划Task9资源入口/检索/临时空间封口、Task10发布门槛及Task11全包独立总评审。Task9尚未整体通过，RLS12仅既有基线；Task7整体资源/其他类别独立OS、目标配置、真实目标请求和专业业务验收仍未完成，不运行Task9 task-done或正式放行。
- 本批未新增schema、迁移生产、部署、修改真实.env、重启旧PID729/722、提交或推送。仅具名合成PG和固定合成数值，真实模型/外部检索0；append-only合成整改事件按精确夹具保留，不删除历史或禁用触发器。
## 历史检查点 · WP01科研情报提交本地验证，查询重放提交待追加

- 本次批准已兑现（仅本地）：ResearchIntelligenceService.runSubscription的入口、成功、来源失败及去重提交共用tenant授权锁，按当前账号/租户/组/角色/项目成员、原research_intelligence菜单、research_intelligence.subscribe按钮及功能开关校验；个人订阅仍限所有者，项目订阅不加创建者或Agent/chat.use资格。真实订阅行锁与准备时完整配置/游标、status/version/updatedAt指纹阻断旧执行；复用已有version，不加schema、队列或租约。
- 公开检索留在锁外；新增线索、原去重状态、游标/订阅、原成功审计同事务。命中去重记录仍按原键/项目集合/状态/计数规则处理，但先锁实际记录及真实父订阅并核对同租户/组/项目与个人归属，无权父对象使整批回滚。普通来源失败保留原错误码；撤权、陈旧版本、写入或提交确认异常直接传播，不追加SOURCE_FAILED、不自动重放。并发请求可能各检索一次，同一准备版本仅发布一次，不冒称外部调用exactly-once。
- ClinicalTrials未连接的原预检写入也经门禁，并以本次成功预检返回的版本继续既有PubMed路径；没有实现或宣称ClinicalTrials接入。create/pause/review/save/promote、来源/去重算法、权限资格、人工核查、计费和页面未改。浏览器保持线索needs_review，拒绝冒充正式证据。
- 本地证据：情报原生PG73/73、原情报单元14/14、完整后端824/58/16/41/68/85各组（非去重总数，0失败/skip）和Web构建通过；实际未改页面/API客户端/Controller DTO/服务＋受限合成PG，两角色成功/撤权/来源失败6场景、8PNG/6WebM，0pageerror。浏览器使用可信合成actor和受控公开来源适配器，不冒充HTTP Guard或真实PubMed效果。共用授权106、RLS基线12及认证浏览器6也通过；全部中间故障以docs/test/evidence/2026-10-21-wp01-intelligence-publication/results.json为准。
- 上轮独立质控整改重检已兑现，情报“待批准”记录以下仅作历史，不重复确认。Task9因独立数据查询重放提交新增范围待确认，原资源入口/检索/临时空间封口仍未整体完成；Task7整体资源/其他类别独立OS、Task10–11、全包独立总评审、目标环境配置/真实请求/业务验收尚未完成。RLS基线12不等于Task9资源全包，未运行task-done或正式放行。
- 自动续Task9消费者清单实证：独立DataQueryReplayService.replay／claimReplay／prepareReplay／completeReplay／recordReplayFailure与心跳使用自身查询/attempt租约，不经过已修普通方法或DQ重检门禁。实际DataService确定性查询、质量证据和受限合成PG的正例生成1份产物；计算期间撤销成员后仍写结果/产物并将query、attempt成功和案件artifact_ready，故安全反例失败；失败且撤权仍将query/case/attempt写failed，第二安全反例也失败。3场景1正例通过、2安全反例失败，不能算绿色门禁。独立重放服务整体及DataService确定性重放方法与HEAD一致，本轮未修改它们；DataService文件保留此前已批准的softDelete等既有改动。建议仅追加显式重放认领/心跳/准备/成功失败提交的当前授权、真实query/case/attempt/门禁绑定、状态版本/租约防重及原子边界，保持确定性算法、原权限、显式重放幂等与过期租约策略、审核、计费和页面；等待这项新确认，不重复审批已完成情报修补。诊断日志：docs/test/evidence/2026-10-21-wp01-intelligence-publication/logs/data-query-publication-probe.log；append-only合成事件按原规则留存精确夹具，不删历史或禁用触发器。
- 无新增schema/生产迁移/部署、真实.env修改、旧PID729/722重启、git提交或推送；不新增客户/updates上线记录。仅具名合成PG和合成公开来源，不访问临床行、模型或真实网络来源。

## 历史批准记录 · 科研情报执行提交最小修补

本轮用户批准ResearchIntelligenceService.runSubscription及成功/失败/去重提交：补齐当前授权、真实订阅归属、状态/版本防重、原子提交，保留公开检索、去重规则、权限资格、人工审核、计费和页面。上轮“待追加”是历史，直接实施；验证后自动续原Task9，只为新范围停线。

契约：原research_intelligence菜单、research_intelligence.subscribe按钮和research_intelligence功能开关；有效本租户researcher/tenant_admin、组/角色/项目及成员，个人订阅仍限其所有者，项目订阅不加创建者限制；不增加Agent装备或chat.use。共用tenant授权锁先于授权读取，锁真实订阅及其作用域；使用准备时的subscription状态/version/updatedAt和完整配置/游标快照，不能提交时读取新版本冒充原准备版本。公开检索在锁外；成功线索/去重状态/游标/订阅与审计同tx，失败状态也经同门禁，提交/确认异常直接传播，不转换为第二次来源失败写入。复用已有version，不加表、队列、租约或自动重放；并发请求仍可各发一次原检索，但同准备版本只能发布一次。ClinicalTrials未连接的既有预检状态写入同样受保护，不借本次改检索接入行为。

去重键、项目级查询集合、状态与计数规则保持；实际变更命中记录前锁其真实记录/订阅，校验同租户/组/项目及个人所有权，阻断伪父对象或无权个人订阅的状态修改，不以去重命中替代授权。其余create/pause/review/save/promote及页面不纳入本轮改动。

验证：入口前及公开来源等待期间11类撤权、个人所有者/跨项目/伪订阅、暂停/恢复/version/输入/游标变化、并发单版本发布、现有去重各状态和整批故障/审计回滚、普通失败/确认丢失、合法非创建者及无Agent装备、两角色原情报页面与既有认证回归；只用具名合成PG，不读真实临床数据、修改真实.env、重启旧PID729或提交/推送/部署。

## 历史检查点 · WP01独立质控整改重检本地验证，科研情报提交待追加

- 本次批准已兑现（仅本地）：DataQualityRemediationService.execute、claimDataQualityAttempt及成功／失败提交在受限RLS与共同tenant授权锁中重验当前账号/租户、组/角色/项目成员、原workbench＋remediation.retry与research_methods_worker；真实attempt→case→gate→sourceRun/session/agent→recheckRun绑定与行锁、startedAt/输入/父版本/运行状态准备指纹阻断旧执行。合法非创建者仍可执行，不增加chat.use、Agent装备或创建者资格；算子/manifest装配在锁外，结果、门禁、案件、尝试、事件、审计同tx。撤权/状态版本/提交异常直接中断，不写第二个failed或自动重放；不增加队列、租约、schema，原确定性算法、权限资格、人工审核、计费与页面不变。
- 本地证据：独立质控整改PG92/92、聚焦单元24、专业方法专项136、完整后端各组824/58/16/41/68/85（分组非去重，无失败/skip）及Web构建通过；原质控页面科研端/管理员端各成功＋撤权共4场景通过，4PNG/4WebM、0pageerror。实际页面/API客户端/Controller DTO/createAttempt/认领/提交使用真实受限PG，可信合成actor＋固定数值Worker及无关列表适配不冒充HTTP Guard、真实Python效果或专业验收。授权/RLS/认证回归及完整日志、失败过程与指纹以docs/test/evidence/2026-10-21-wp01-dq-remediation/results.json为最终台账，不把中间通过数当最终结果。 旧授权106、RLS基线12与Chrome认证6也通过；认证4PNG/2WebM、0pageerror/2条预期401，RLS12不代表Task9资源全包。
- 自动续Task9新增独立范围：ResearchIntelligenceService.runSubscription合成PG正例生成1条线索/1条审计并推进游标；在受控公开来源响应期间撤销成员后仍生成同样内容，订阅暂停/version升至2后也仍生成线索并推进游标，来源失败且已撤权仍写lastRunAt/SOURCE_FAILED。4场景中1正例、3安全反例失败均保留，不计入质控绿测。该独立情报服务与HEAD一致、未修改；建议另行批准runSubscription成功/失败/去重提交的当前授权、真实订阅归属、状态/版本防重及原子提交，保留公开检索、去重规则、权限、人工审核、计费与页面。等待这项新范围确认，不重复询问本次质控批准。
- 本批仅本地代码/合成PG契约；Task9为partial_awaiting_intelligence_publication_scope_confirmation，Task7整体资源/其他类别独立OS、Task9剩余资源封口、Task10–11及全包独立总评审/目标配置/业务验收未完成。未部署、生产迁移、修改真实.env、重启旧PID729、提交或推送，不新增客户/updates上线记录。append-only整改事件保留精确标记合成夹具，不禁用触发器；测试进程仅将已核验localhost地址固定为同一127.0.0.1回环，不改源配置、不静默重试。

## 历史批准 · 独立质控整改重检最小修补

用户本轮批准DataQualityRemediationService.execute、claimDataQualityAttempt及成功/失败提交链：补齐当前授权、真实父对象、状态/版本防重和原子提交，保留重检算子、权限资格、人工审核、计费及页面。上一轮“待追加”改为历史，本轮先RED再最小修补、回归后自动续Task9；有新范围才停，不重复询问本次批准。

契约：重用原workbench菜单、remediation.retry按钮及research_methods_worker功能开关；当前请求者须为有效本租户研究员/租户管理员及有效组/角色/项目成员。此受控确定性消费者不调用Agent，不新增AgentAccess/Skill装备或创建者限制。认领与提交使用原共同tenant锁及真实attempt→case→gate→sourceRun/session/agent→recheckRun绑定、行锁；现有startedAt、case/gate版本与run状态/updatedAt及输入摘要形成只在进程内流转的准备快照，不用HTTP DTO或重新读取当前值替代原执行版本。新结果/门禁/案件/尝试/事件/审计同事务；失权/版本失效/不确定提交直接中断，不覆盖新状态或自动重放；普通算子失败保留原失败语义，但同样受当前授权与准备快照门禁。原manifest/Worker/mapper/算法均不持锁，append-only事件保持。

验证：认领前与计算期间撤权、父绑定/版本/取消变化、同一queued并发单次执行、实际锁顺序、成功与失败的写入/事件/审计故障整笔回滚、成功/失败重放及确认丢失、已合法输出保留、合法非创建者操作；真实合成PG及原质控页面/浏览器证据。只在wp01_test_full_baseline，不读真实临床数据，不改真实.env、不重启旧PID729、不部署/提交/推送。

## 历史检查点 · WP01专业方法提交本地验证，质控整改重检待追加

- 本次批准已兑现（仅本地）：ResearchMethodsService.executeCreatedRun／advance在受限RLS＋共同授权锁内重验当前交互请求者、有效组/项目成员、原workbench＋chat.use、真实run/session/agent及已装备的同版本发布Skill；官方Skill按official→tenant锁顺序复核。准备状态/输入/术语摘要及updatedAt快照、run行锁与条件更新阻断旧执行覆盖；复核者合法重跑不限制为原创建者，不信任过期管理员标志。原事实准备/算子在锁外，结果/终态及必要质控门禁、整改案件/事件/审计同tx；撤权/版本/提交异常直接传播，普通执行失败保留原契约，已提交但确认丢失不改写failed、不自动重放。未新增claim/schema，算子、权限资格、人工审核、计费与页面不变。
- 最终本地验证：专业方法PG67/67，聚焦41、专业方法专项134，完整后端各组824/58/16/41/68/79无失败/skip（分组非去重），Web构建、授权106及RLS资源基线12通过。新浏览器质控3项（3PNG/1WebM）＋认证6项（4PNG/2WebM）通过，0pageerror，认证2条预期401；质控用未改页面/API客户端、实际Controller DTO与执行提交、真实受限PG，可信请求接纳适配器/固定数值Worker夹具及无关空列表，不冒充公开接纳、HTTP Guard、真实Python算子或专业验收。证据：docs/test/evidence/2026-10-21-wp01-method-publication。
- 续Task9独立新缺口：DataQualityRemediationService.execute→claimDataQualityAttempt→recordRemediationRecheck／recordDataQualityRecheckWithTx不经过上述普通运行链。合成PG正例先通过；计算响应前撤销成员后仍新增needs_review结果/1条计数证据、门禁version=2并将案件closed、尝试succeeded，无拒绝。使用固定数值响应只验证提交漏洞，真实模型/远端Worker0；独立消费者及RemediationCasesService生产代码与HEAD一致、未修补。当前仅这条整改重检认领/成功/失败提交的当前授权、真实父对象/版本及原子边界待追加批准，不重复确认普通专业运行或已批上传/Worker。
- 本批仅本地契约，不代表WP01整体或目标配置/业务验收；Task7资源/其他类别独立OS、Task9–11及全包独立总评审未完成。旧PID729未重启、无真实.env修改/新增schema/生产迁移/部署/提交/推送；不新增客户上线记录。原生append-only整改事件按规则保留对应精确合成夹具，不禁用触发器或删除历史，早期测试/构建/连接故障与最终成功分开留痕。

## 历史检查点 · 专业方法提交最小修补批准

用户本轮批准 ResearchMethodsService.executeCreatedRun／advance 及必要质控评价提交；此前“待批准”仅为历史，不再重复询问。先真实合成PG RED，再最小修补及全回归；保留当前目录全部已有改动，不提交/推送、不重启或部署旧服务、不新增 schema/claim/队列。

实施契约：当前交互请求者（含合法复核重跑者，非强制创建者）在受限RLS及共同tenant授权锁内重验有效账号/租户、组/角色/项目成员、原 workbench＋chat.use、实际会话/Agent/已发布且已装备的同版本 Skill。真实 run 的 tenant/group/project/account/session/agent/skill、输入/术语摘要及 updatedAt/状态与准备版本一致；run行锁＋条件更新阻断撤权、取消、输入更新、父对象变化、同版本并发或过期执行覆盖。原外部算子/事实准备不持锁。结果、终态及必要质控门禁/整改登记使用同一事务；提交门禁/回滚异常直接中断，不降级成可见成功或覆盖新代次。原业务执行失败仍仅在当前授权且版本一致时记录原失败。无目标真实请求及专业验收不得声称上线。

测试清单：有效执行和旧人工审核语义；组/项目/账号/租户/权限/Agent/Skill/Worker feature撤销；会话删除/改绑、run状态/输入/版本变化；共同锁双向顺序；同版本竞争；质控门禁/整改故障原子回滚；原正常失败/needs_input/needs_review；实际Controller/浏览器只用合成数据，证据独立归档。

## 历史检查点 · WP01上传与原始Worker本地验证，专业方法提交待追加

- 四个上传入口追加批准已兑现（仅本地）：ingestRaw／ingestStoredRaw／ingestStoredStandard／ingestPreprocessed在受限RLS＋共同tenant授权锁下重验当前请求者、真实被试/访视；新建被试、惰性默认分组、文件、任务/特征、处理状态与原审计同事务，成功提交后才kick。预检只读，存储/摘要/解析在锁外。原始与会话材料的幂等/绑定冲突、预处理合法后续重复导入、storage_unavailable／ingested_no_store回退及原映射/数值/权限/审核/计费/页面保持；原子性指数据库业务提交，不冒称对象存储分布式事务，不自动删除不确定对象。人工确认37项既有契约继续保留。
- 原计划Task8原始Worker已完成本地接线：部署允许租户及新旧disabled开关约束bootstrap/kick/tick/process；持久claim、15秒心跳、120秒DB租约、当前任务创建者授权及真实来源校验、终态CAS与关联数据同事务。五路径fnirs/tabular/eye/media/archive的原算法和人工复核不变；失权/失claim不发布新业务结果，旧无claim活动任务仅留待核对，过期有效claim只失败中断、不自动重排。临时文件按部署/claim隔离，原执行事件保留。
- 最终本地证据：上传PG98/98、人工确认37/37、raw CLI88/88；raw实际127363.70004199998ms、8次租约推进，两个独立OS进程仅一次认领/下载/提交，实际Ingest→禁用RawWorker管线保持queued且Worker下载/算子0。完整后端各组824/58/16/41/68/78、Web构建、多模态82、授权PG106、RLS资源基线12及12项新浏览器检查通过，无skip（分组非去重）。上传组件6项为真实未改ResearchDataUploader＋Controller/Service＋受限PG，4PNG/1WebM；另认证6项4PNG/2WebM。前者用可信合成actor、不是HTTP Guard或完整导航/会话材料UI；后者只旧Web认证，均不替代目标/AI业务验收。证据：docs/test/evidence/2026-10-21-wp01-raw-ingest。
- 自动续Task9新增范围待批准：实际ResearchMethodsService.executeCreatedRun／advance在项目事实准备期间撤销成员后，仍提交needs_review草稿及8条由合成事实确定性生成的计数证据；正常正例先通过，真实模型/远端Worker调用均0。这是同步专业方法执行链，不是全局队列扫描；其生产源码及质控评价链未修改。建议追加当前授权/真实父绑定、运行状态版本防重、结果与必要质控评价的原子提交，保持原算子/权限/人工审核/计费/页面。Task9–11、Task7整体资源/其他类别独立OS证据、全包独立总评审及正式配置/业务验收仍未完成。本轮无新增schema、生产迁移/部署、真实.env改动、旧PID729重启或git提交/推送；不重复审批已修的上传/人工确认范围。

## 历史检查点 · WP01人工确认导入验证与上传提交边界待确认

- 本次批准已兑现（仅本地）：IngestService.confirmEyeImport／confirmProfileImport在受限RLS和共同tenant授权锁下重验当前交互请求者、真实任务/来源文件及全部映射被试；准备版本CAS与业务值、任务/文件状态、processing_status、原审计同事务。下载与原解析/算子在锁外，不伪造后台claim、不限createdBy、不新增schema；映射、数值、权限、审核、计费、返回形状及页面不变。eye已完成快速返回仍查当前授权；profile合法后续显式更新保留，同版本并发仅一份提交，不抢占running。
- 最新本地证据：人工确认原生PG37/37、新增单元2/2；完整后端各组824/58/16/41/68/70和Web构建、82项多模态、授权PG106、资源PG12通过，无skip。新增Chrome认证6/6、4PNG/2WebM，0pageerror和2条预期401，仅旧Web认证，不代表实际人工导入表单、生产或独立OS Worker验收。证据：docs/test/evidence/2026-10-21-wp01-manual-import。
- 自动续行Task8发现新范围（尚未修改生产方法）：ingestRaw／ingestStoredRaw／ingestStoredStandard／ingestPreprocessed四个上传入口在有效请求进入、异步准备期间撤销成员后仍发布。真实合成PG各正例先通过；撤权反例分别留下文件/任务1/1、1/1、1/1及文件/特征1/1，全部无拒绝。仅合成存储及kick计数，真实存储/模型调用、Worker执行均0；诊断退出1是未通过，不作绿色门禁。需集中批准四入口当前请求者重验及实际提交/入队原子边界后再改，保留原上传、映射/算法、存储故障回退、幂等、权限/审核/计费和页面。
- Task8原始Worker生产代码未修改，Task7整体资源/临时空间与独立OS、Task8–11和独立总评审、目标启用及业务验收仍未完成。本轮无提交/推送、生产迁移/部署、真实配置修改或旧后端重启；共享正式发布不放行。历史待确认两人工入口已由本次批准解除，不重复询问。

## 历史检查点 · WP01独立导出获批实施与人工确认导入待追加

- 用户批准的ResearchArtifactExportJob最小修补已接线：独立research-artifact-export消费者，五个nullable认领字段及恢复索引，120秒DB租约/15秒心跳；旧NULL claim活动导出不重放、不按updatedAt误杀。只增迁移仅执行受保护合成库，不改旧五模型迁移或真实配置。
- 当前请求者、真实产物/版本归属、artifacts／artifact.export及诊断原有开关、released状态、显式diagnosis_export在短事务重验；渲染和上传在锁外，file＋ready CAS同事务。三种格式、权限资格、审核、计费和页面不变；状态响应不暴露内部claim字段。异常清理先锁job核实提交结果，保留确认丢失但已提交的文件，仅清理本次确认未发布的随机key。
- 科研内部execution累积已验证输入KB/doc、实际引文与实际知识工具清单，后续快照／签名／终态再校验；回答提交后撤销文档审核时，保留此前合法回答，拒绝新增交付。此为当前已批准链路的最小补充，不把客户端清单当授权。
- 最终本地科研PG63/63（证据16＋run/attempt及实际Sessions23＋独立导出24）通过，run／导出均实跑超过126秒续租；导出包含三种真实渲染、失权/丢claim零新文件、双Service实例单次上传、回滚及已提交但确认丢失不误清理。完整后端各组824/58/16/41/68/68无失败/skip（分组非去重总数），Web构建、授权106、知识问答/工具48、资源12及Chrome认证6通过。浏览器4PNG/2WebM、0pageerror/2预期401只覆盖现有认证，不冒充导出UI、独立OS Worker、真实模型/存储或目标验收；证据见docs/test/evidence/2026-10-21-wp01-research-export/results.json。下面旧“独立导出待确认／未修改／聚合阻断”均为已替代历史。
- 自动续行Task8预检新增实证：IngestService.confirmEyeImport／confirmProfileImport在受控下载期间撤销成员后仍分别新增8条指标／1份档案并complete（正常正例同样先通过）。两人工确认方法超出原“两处kick兼容”范围，生产代码尚未修改。建议追加当前请求者授权、真实任务/父对象及版本防重、业务写入/状态/审计同事务；保留映射、算法、权限、审核、计费和页面，等待用户确认。
- 本切片仅本地代码／合成PG契约；Task7整体资源/临时空间与独立OS验证仍待后续，Task8–11及全包独立总评审、目标部署和AI业务验收未完成。未提交、推送、迁移生产、变更真实.env、重启旧PID729或启用正式Worker，不新增客户/updates上线条目。

## 历史检查点 · WP01科研提交核心验证与独立导出待确认

- 本轮科研证据实际提交和SkillInvoker／Orchestrator科研分支失效传播已获批准并实施；科研run／局部attempt与实际Sessions按部署scope、持久claim、当前授权及父版本CAS提交。检索、人工审核、计费、页面保持原有语义，模型/检索均不放入DB锁。
- 新阻断不是重复确认上述批准：独立ResearchArtifactExportJob不属于现有五类claim模型。合成PG诊断已复现成员撤权后仍新增文件记录并ready；该模型及ResearchArtifactsService生产代码尚未修改。建议另行批准独立导出认领、当前权限与原子提交及必要的只增schema/配置接线，不静默关闭旧导出。
- 科研核心验证与未保护导出分开计数，research聚合门槛保持阻断；Task7整体、Task8–11、全包独立总评审、目标环境和AI业务验收未完成。本轮未提交、迁移生产、改真实配置、重启旧PID729或启用正式Worker。以下旧待确认项只作历史，当前以本节及最新切片报告为准。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用先红测、后最小修补证明两个独立部署共库共表时，认证、任务执行与结果发布不越过获准租户及当前授权。

**Architecture:** 在现有Nest后端增加部署策略、持久claim及短事务发布门禁，保留现有会话互斥、状态/幂等语义和唯一Prisma迁移链。共享契约串行集成，消费者分别验收；不是新建调度平台或ResearchHub第二套公共后端。

**Tech Stack:** NestJS、TypeScript、Prisma、PostgreSQL、Node test runner；现有React前端与Playwright用于入口回归。

**Spec:** [已批准规格V0.1](spec.md)；反例编号见[W01–W20](test-design.md)。

日期：2026-10-20。**状态：2026-10-21续行：用户已批准知识工具执行上下文最小接线，四类工具及Task 6问答队列/实际消息发布已完成本地代码与合成验证（PG48，其中工具30、队列/真实Sessions18，问答实际126秒续租）；授权106、导入14、资源12、全量824/58/16/41/68/46、Web与Chrome认证6通过。Task 7历史预检实证ResearchEvidenceService仍可在失claim后发布completed证据运行，SkillInvoker会吞执行失效且科研编排会降级继续；上述证据提交/失效传播范围现已获批并实施；当前新增确认是独立科研产物导出的认领/授权契约，不是重复确认已批范围。WP01整体、独立OS进程、目标部署和AI业务验收仍未通过，不得启用正式任务。** 首批[验证记录](../../testing/wp01-shared-boundary/report.md)及[环境记录](environment-evidence.md)分开登记；仍不包含目录搬迁、重置旧库或生产发布。

## Global Constraints

- 共享PG实例、库及现有公共表；单租户Account、独立登录、不做SSO；旧系统继续运行，不迁历史研究数据。
- 唯一共享迁移入口为`app/server/prisma/migrations`；五模型扩展`executionToken/workerOwner/leaseExpiresAt`，保留旧记录。
- 新claim heartbeat 15秒、lease 120秒，以DB时钟判定；过期按规格五模型表保守失败/人工重试，不自动重放未知计费调用。
- 官方null只允许获准控制面的knowledge-import；不得将null传作普通租户通配。
- 每项只提交评审范围内的差异；当前目录已有改动全部保留，**不自动git commit/push**，以限定文件diff作为检查点。
- 不读患者行/媒体/凭据；不运行通用seed、整份rls.sql、生产迁移/排空/发布。本计划批准也不自动授权这些操作。
- 代码、目标配置、真实请求、业务结果分层举证；无真实新UI时不宣称ResearchHub正式登录已通过。

## Review Focus

- R1：旧凭证、同名跨租户账号、Host伪造仍须遵循部署边界，不能强退全部合法旧会话（任务1）。
- R2：撤权与发布并发，必须给出确定事务顺序；撤权先提交不再产生新业务可见性（任务4）。
- R3：外部服务已计费但迟到/超时，保留真实轨迹且不自动重放、不删除此前合法产物（任务5–8）。
- R4：断心跳/长任务/重启/失claim与旧无租约行同时存在，活跃任务不误恢复，旧执行者不能覆盖新代次（任务3、5–8）。
- R5：缺测试库身份、缺安全发布manifest或存在未登记消费者，必须失败/阻断而不是skip后报绿（任务2、9–10）。

## 文件职责与共用约定

下列代码路径均相对`/Users/mac/aisciencesys`；本文件中的文档路径相对ResearchHub。未创建的新文件由对应任务创建；不因出现路径就批量改文件。

- `app/server/src/common/deployment-scope.ts`：纯策略和配置解析；`deployment-scope.module.ts`：全局DI、启动核验和只读scope实例。
- `app/server/src/common/worker-claim.ts`：五模型类型、DB原子claim/续租/CAS，不承担业务编排。
- `app/server/src/common/worker-authorization.ts`：当前身份及父对象验证；`worker-publication.ts`：授权同步与短事务发布，不在锁内调用模型/解析服务。
- 对应现有Service只接入上述契约，不全仓重构。`app/server/scripts/wp01/`只存合成验证/只读审计工具，不成为另一迁移入口。

所有后端单元命令从根工作区执行：先`pnpm --dir app/server run build`，再运行各任务列出的`node --test …`。首次建立新导出时允许最小空实现使构建成功，必须捕获**行为断言失败**再修补，不能只交一个import不存在的红测。每项最终还须复跑受影响既有测试，保留命令、退出码、差异hash和未测项。

## Task 1：部署策略、认证与明确的控制面例外

**Files:** 创建`app/server/src/common/deployment-scope.ts`、`deployment-scope.module.ts`、`control-plane.decorator.ts`；修改`app/server/src/app.module.ts`、`auth/auth.service.ts`、`auth/auth.controller.ts`、`common/guards/jwt-auth.guard.ts`、`tenants/tenants.controller.ts`、`tenants/tenant-features.controller.ts`及`tenants/tenant-theme.controller.ts`（后七项均在`app/server/src/`）。测试补入`deployment-scope.module.spec.ts`、`deployment-auth.http.spec.ts`及专用harness/浏览器脚本；配置模板与test:wp01:auth/posttest接线同批更新，均未改真实.env。

**Interfaces:** 产出规格原样的`DeploymentScope`与`parseDeploymentScope(env: NodeJS.ProcessEnv): DeploymentScope`、`assertDeploymentTenant(scope: DeploymentScope, tenantId: string): void`、DI token `DEPLOYMENT_SCOPE`。启动通过Prisma只读核验允许ID存在。配置使用`DEPLOYMENT_ID/DEPLOYMENT_PRODUCT/ALLOWED_TENANT_IDS/DEFAULT_TENANT_ID/CONTROL_PLANE_ENABLED/OFFICIAL_JOB_KINDS/ENABLED_WORKER_KINDS`；列表按逗号分隔，未声明worker为空，未知kind拒绝；实际CUID不做UUID校验。`AUTH_COOKIE_NAME`旧默认`aisci_session`，Hub要求独立名称；JWT_SECRET仍由各部署独立配置，不新增SSO。

- [x] 写W01–W03/W17行为测试，已捕获缺部署边界、独立Cookie、控制面及未知ID的失败，不使用真实临床库。
- [x] 构建并观察行为红测；补非泄露/profile及实际路由、Host/请求体伪造验证，保留原始输出。
- [x] 按签名实现签发前/验签后scope与显式控制面门禁；独立评审指出同一Tenant模块主题路由漏列，追加GET/PATCH红测并最小修补，当前租户主题原语义保留。
- [x] 策略/装配/认证/真实HTTP/Cookie包级41项通过；Nest依赖失败时无消费生命周期注册。实际两套密钥/RLS与完整后台门槛仍未验证。
- [x] 限定diff独立评审重要项修补后完整回归824/58/16/41组通过，旧Web构建与6项新浏览器检查通过；配置说明更新，不改真实.env/数据库/Worker/生产。保留测试启动失败时资源清理Minor，见报告。

## Task 2：安全合成夹具、只读catalog与执行保护

**Files:** 创建`app/server/scripts/wp01/fixture-guard.mjs`、`fixture-guard.test.mjs`、`catalog.mjs`、`fixtures.mjs`、`run-integration.mjs`；创建本文同目录`environment-evidence.md`（记录，不含凭据）。

**Interfaces:** 产出`assertFixtureTarget(config): Promise<{ databaseName: string; runId: string }>`；只接受显式`WP01_TEST_DATABASE_URL/WP01_TEST_DIRECT_URL/WP01_TEST_DB_NAME/WP01_FIXTURE_RUN_ID`、数据库名必须`wp01_test_`开头并与当前库一致、独立fixture标记一致、无继承DATABASE_URL回退。URL含密码禁止输出。`run-integration.mjs --suite <claims|authorization|import|chat|research|raw|resources|all>`统一加载该保护。

- [x] 缺项/误连/标记/清理反例先RED；catalog只读旧库结构与迁移元数据，不查业务行。
- [x] 26项首批RED，补边界后8项RED、SQL执行保护5项RED，最小修补后工具单元42项GREEN，无skip。
- [x] 在获准专用库生成schema、复用真实124条RLS策略，创建68条A/B/C与官方合成记录；清理具名ID、锁父行并拒绝未列子表级联，不运行通用seed/整份rls.sql，不改角色属性。
- [x] 显式--config运行resources的W14部分12项通过；真实PG浏览器6项及全量回归通过。未实现的其他suite非零退出，未拿此结果销项Worker/W04/生产验收。
- [x] catalog/策略/迁移元数据/指纹/本地PID端口与源码消费者、外部调用为0均登记environment-evidence及权威报告；生产实例/目录未知项保持阻断正式启用。
- [x] 用户追加授权wp01_test_full_baseline，仅完整结构恢复，169 CHECK、17触发器、HNSW及表/schema/default权限校准；原生工具26、动态保护5、资源12、PG浏览器6通过。旧库、原局部库与历史证据不动，不复制业务数据。

## Task 3：五模型持久claim及恢复原语

**Files:** 修改`app/server/prisma/schema.prisma`；创建`app/server/prisma/migrations/20261020000000_wp01_execution_claims/migration.sql`（执行前核对唯一性/依赖，冲突则登记后更名）、`app/server/src/common/worker-claim.ts`、`worker-claim.spec.ts`（同目录）；创建`app/server/scripts/wp01/claims.mjs`。

**Interfaces:** 定义`WorkerKind = 'knowledge-import' | 'knowledge-chat' | 'raw-processing' | 'research-agent-runs' | 'research-stage-attempt'`；`ClaimRef = { kind: WorkerKind; taskId: string; tenantId: string | null; executionToken: string; workerOwner: string }`；产出`claim(tx, scope, kind, taskId, owner): Promise<ClaimRef | null>`、`heartbeat(tx, scope, claim): Promise<boolean>`、`assertLiveClaim(tx, scope, claim): Promise<void>`。tx为`Prisma.TransactionClient`，scope为任务1类型；写表/列来自固定映射，不能拼用户输入SQL。

- [x] W07–W10/R4原语层先红后修：同任务/同会话并发、显式新token、旧持有者拒写、续租恢复竞争、无token旧活动行、父版本和既有合法修订；不把原语测试当消费者/独立进程全层通过。
- [x] 构建/原语7项及真实PG claims最终24项通过，包含真实126.39秒/15秒心跳8次与两个行锁等待过期反例；命令必须显式`--config .superpowers/sdd/implementation-plan/wp01-full-baseline-target.json`，不缺省继承主库URL。
- [x] 五模型15 nullable列/5索引expand只执行完整合成库；保留状态/幂等/旧行，DB120秒，先锁持有者再重核截止，旧无claim不自动恢复。stage attempt的ClaimRef增加可选parentSnapshot，保留父状态/inputHash/executorVersion/assistantMessageId/failedStage CAS。
- [x] 新旧Prisma双向读写与旧原生对象保留已验证；资源12、浏览器6、全量824/58/16/41/68/7及旧Web构建通过，证据见[Task 3](../../../../docs/test/WP01-持久认领与租约验证-2026-10-20.md)。
- [x] 本切片自检迁移只增不删、固定映射、持有者丢失；未提交/部署/执行生产迁移，全包独立总评审留待Task 11。

## Task 4：当前授权与最终发布/撤权的共同事务顺序

**本轮最新追加批准（2026-10-21）：** 用户已批准AgentsService.activateConfig/updateConfig共同tenant授权锁及测试，与原Task7提交确认不明问题同轮修补。仅该两配置方法、原审计只追加适配及`agents-access-boundary.spec.ts`依赖桩；新增`agent-config.mjs`并接入authorization-suite。版本/CAS、权限、审核、计费和页面保持。下文10-20“不改配置版本”为当时历史边界，现仅由此次明确授权覆盖这两入口，其他配置方法/模型引擎仍不扩展。配置9项与完整授权115本地通过。

**最新追加批准（2026-10-21，PI成员变更）：** 用户批准`PiGovernanceService.changeMember`最小修补，在其现有受限RLS事务中先共同tenant锁、再原项目锁；保持成员权限、最后一位负责人保护、审计、响应和页面。新增锁顺序单元及真实PG双向barrier、并发最后负责人/审计回滚验证。仅该方法及helper import，不改整个PI治理模块；通过后自动继续原计划。

**追加Files：** `app/server/src/pi-governance/pi-governance.service.ts`、`pi-governance-authorization.spec.ts`、`scripts/wp01/pi-members.mjs`；原有诊断probe保留历史，不再把期望缺陷存在的诊断脚本当修补后门禁。

**最新追加批准（原始file/photo软删除）：** 用户已批准`DataService.softDeleteRawItem`现有两条路径复用共同tenant锁及同一受限RLS事务，保持删除权限、数据保留和页面不变；先失败测试再最小修补。批准仅涉及该方法，不含`PhotosService`或物理清理。验证后自动继续原计划，新增确认项再停线。

**追加验证Files：** `scripts/wp01/onboarding.mjs`（原计划configureMembers真实Serializable/CAS竞态及回滚验证）；`pi-member-boundary-probe.mjs`仅诊断，不修改PI生产入口。

**追加Files：** `app/server/src/data/data.service.ts`（仅softDeleteRawItem及helper import）、原始数据软删除单元、`scripts/wp01/raw-items.mjs`和既有合成夹具；旧单元仅适配事务接口。无迁移、前端或存储清理变更。

**本轮追加批准（被试软删除）：** 用户明确批准将`SubjectsService.softDelete`纳入最小修补，实施并验证后自动继续原计划。仅复用共同tenant锁，在同一受限RLS事务内核验原有范围/所有权、软删除状态及追加审计；保留返回形状、幂等、关联数据/对象存储保留，不扩大删除资格、算法、页面或数据库迁移。新增单元与真实PG双向barrier、撤权先提交零新增结果及审计失败回滚；新增包外入口仍先报告，不因本次批准一并修改。

**当前检查点：** 2026-10-21续行：用户已批准知识工具执行上下文最小接线，四类工具及Task 6问答队列/实际消息发布已完成本地代码与合成验证（PG48，其中工具30、队列/真实Sessions18，问答实际126秒续租）；授权106、导入14、资源12、全量824/58/16/41/68/46、Web与Chrome认证6通过。Task 7历史预检实证ResearchEvidenceService仍可在失claim后发布completed证据运行，SkillInvoker会吞执行失效且科研编排会降级继续；上述证据提交/失效传播范围现已获批并实施；当前新增确认是独立科研产物导出的认领/授权契约，不是重复确认已批范围。WP01整体、独立OS进程、目标部署和AI业务验收仍未通过，不得启用正式任务。全量824/58/16/41/68/41、Web与Chrome认证6通过；工具链真实probe退出1，未改工具/编排生产模块。见[切片报告](../../../../docs/test/WP01-Agent授权事务切片验证-2026-10-20.md)。

**追加批准（2026-10-20）：** 用户先批准`AgentsService.assignAccess/removeAccess/assignSkill/removeSkill`，随后再次明确“批准”，将`AgentsService.update`启停入口及审计也纳入同锁/同事务保护。沿用既有共同事务helper；update的name/description/enabled字段、角色及响应不变，不拆成两条有不同原子性的写路径。保留个人scopeKey覆盖全租户scopeKey及tenant_admin既有语义；不改Agent能力、算法、模型配置、配置版本或页面，不扩大到整个Agent引擎。启停补丁已先红后绿，PG17含启/停两方向；只代表本地切片验证，不等于完整任务/上线验收。

**Files:** 创建`app/server/src/common/worker-authorization.ts`、`worker-publication.ts`及各自`.spec.ts`；修改`app/server/src/tenants/tenants.service.ts`、`tenant-features.service.ts`（同目录）、`accounts/accounts.service.ts`、`study-groups/study-groups.service.ts`、`project-onboarding/project-onboarding.service.ts`、`knowledge/knowledge.service.ts`、`agents/agents.service.ts`（上述四个授权入口、update启停及必要tx类型兼容）；测试脚本为`app/server/scripts/wp01/authorization.mjs`、`authorization-matrix.mjs`、`authorization-publication.mjs`。本轮追加`app/server/src/subjects/subjects.service.ts`、`subjects-soft-delete-authorization.spec.ts`、`scripts/wp01/subjects.mjs`及`subject-publication-fixture.mjs`；`data/data-soft-delete.spec.ts`仅适配原有Subject测试夹具。`subject-boundary-probe.mjs`为修复前历史诊断；新`raw-delete-boundary-probe.mjs`仅实证清单外原始文件删除缺口，退出1，不授权修改DataService，也不是完整authorization套件。

**Interfaces:** `assertWorkerAuthorized(tx, scope, claim, requirements?): Promise<JwtUser>`重建当前actor并验证真实父对象；官方另核当前platform_admin及KB。`withWorkerPublication<T>(prisma, scope, claim, publish: (tx: Prisma.TransactionClient, user: JwtUser) => Promise<T>, requirements?): Promise<T>`；`withAuthorizationMutation<T>(prisma, tenantId: string | null, mutate: (tx: Prisma.TransactionClient) => Promise<T>, options?): Promise<T>`；null仅显式official+elevated允许；两者使用同一固定锁键算法，普通租户键`wp01:tenant:<id>`，官方键`wp01:official`。

**Task 4续行实施约定：** 沿用已记录的显式PrismaService依赖参数，不使用全局连接。发布短事务固定Read Committed；先共同授权锁，再当前身份/真实父关系检查、claim父run/任务锁、同tx业务写入与终态CAS。普通发布锁当前租户；声明知识库/文档引用的发布先official、再tenant（共享官方知识也必须同步撤审/删除）；官方发布仅锁official。Tenant/Account状态或角色等会影响官方owner的变更先official、再tenant，避免官方发布遗漏账号所属租户的撤权；其他普通授权变更仅tenant，统一顺序不反转。为避免预查询与锁间的资源归属竞态，知识引用统一参与official锁，代价是短暂串行化相关知识发布，不影响锁外解析/模型执行。

发布可声明服务端实际使用的requirements（capabilities/features/kbIds/docIds/skillKeys），在锁内按当前规则核验；不是信任客户端payload或用清单授予权限。基础门禁无论是否声明均检查任务actor、tenant、组/项目成员/角色权限、真实Session/KB/source/Subject/file父关系和相应Agent/选中Skill。执行期间实际引用及工具能力由Task5–8消费者声明，后续必须逐消费者核验，不因原语通过提前宣称生产链路完成。未使用的功能开关不被臆造为所有任务的新前置条件；重置密码仍只改变既有登录authVersion，不臆造任务取消规则。失败/中断/审计留痕继续允许，不走业务发布回调。

- [x] 写W11–W13/R2：撤权提交后才放行外部返回barrier，断言`assert.equal(newVisibleResults,0)`；反向顺序允许先发布再撤权；覆盖tenant/account/member/group/project/role/capability/功能开关及KB授权撤销，不阻止failed/审计留痕。
- [x] 构建并运行`node --test app/server/dist/common/worker-authorization.spec.js app/server/dist/common/worker-publication.spec.js`，随后合成库`node app/server/scripts/wp01/run-integration.mjs --suite authorization`；先复现普通SELECT与并发撤权间隙。
- [x] 使用短Read Committed事务，先`pg_advisory_xact_lock(hashtextextended(key,0))`，后重查当前授权/父对象和有效claim，再在同一tx业务写入及终态CAS；attempt顺序为租户锁→父run→attempt。所有撤权入口同锁、同事务提交；不在锁内等待文件/模型/OCR。
- [x] 最小接入入口：Tenant.update/功能开关；Account.update/resetPassword/upsertCapability/removeCapability；StudyGroup.update/updateRole/assignMember/removeMember/updateResearchProject/assignResearchProjectMember/removeResearchProjectMember；ProjectOnboarding.configureMembers；Knowledge.updateBase/setAssignments/deleteBase/deleteDoc/reviewDoc等实际会改变执行/发布资格的入口。写路径清单与源码逐个核对；新发现包外撤权源先报告，不静默漏掉或扩改。直接SQL改权限不受应用锁魔法保护，纳入受控维护窗口。
- [x] 重跑同测试通过，检查已无在tx外重新读权限或调用另一个Prisma连接的提交路径；评审新增Service依赖无循环。当前actor缺失/历史createdBy=null阻断自动执行，不伪造身份。

## Task 5：知识导入、官方例外与索引原子发布

本地代码/Worker契约门槛通过（2026-10-21），不等于独立OS双进程、生产解析/Embedding或业务验收；最终PG14及长任务、全量回归见滚动报告。

**Files:** 修改`app/server/src/knowledge/knowledge-import.service.ts`、`ingestion.service.ts`、`knowledge.service.ts`（同目录，仅必要发布入口）；创建同目录`knowledge-import-scope.spec.ts`、`ingestion-publication.spec.ts`及`app/server/scripts/wp01/import.mjs`。

**Interfaces:** 消费任务1/3/4；产出`prepareDocIndex(docId: string): Promise<PreparedDocIndex>`和`publishDocIndex(tx: Prisma.TransactionClient, prepared: PreparedDocIndex): Promise<void>`，`PreparedDocIndex`包含docId、内容版本/hash、临时chunks/向量及来源，不含可见DB引用；旧`reindexDoc`调用保持兼容但复用prepare/publish，发布时重核文档版本。临时外部对象按executionToken命名。

实施澄清（2026-10-21）：新增导入尚无已提交doc，采用`prepareDraftIndex(snapshot)`复用纯准备内核，在同一发布tx内创建doc后交`publishDocIndex`验证全部快照字段再写chunks。既有doc按version/updatedAt/content hash及归属复核；准备阶段不删除旧chunk。二次审核在锁外准备，锁内复核后发布索引/审核标记/审计，不再先提交索引再审核。此为原任务原子发布的内部契约细化，不增加外部接口或修改审核资格。

- [x] 写W05/W07/W08/W10/W12/W13/W15、R3：foreign schedule/process不读文件；A1/A2只一个解析；官方null仅显式控制owner可执行；旧createdBy空阻断；Embed返回前撤权/失claim则新chunk不可见，旧已发布索引完整保留。
- [x] 构建并运行`node --test app/server/dist/knowledge/knowledge-import-scope.spec.js app/server/dist/knowledge/ingestion-publication.spec.js`，再`node app/server/scripts/wp01/run-integration.mjs --suite import`，先复现无CAS领取/先删索引/迟到覆盖。
- [x] 候选SQL允许集合或显式官方OR，全部直接入口绑定scope/开关；领取后重验KB/source/actor。解析与Embed先暂存，短事务内核验claim/权限/doc版本，再替换索引/发布文档引用/终态CAS；禁止先删旧索引再外呼。官方使用独立受控事务，失败不回退普通租户null。
- [x] 同测试通过；过期processing保守failed，保留sourceFile/docId及调用轨迹，人工重试新token；长任务持续续租、未知外部结果不自动重放。
- [x] 检查既有手工编辑/审核重建索引调用兼容，调用方仍按自身授权工作；不扩为知识UI或解析算法升级。

## Task 6：知识问答任务与消息可见性

新增范围已批准（2026-10-21）：真实KbToolsService.execute(kb_create)可在旧claim被正确拒绝后新建可见草稿。用户已批准补通`orchestrator/orchestrator.service.ts`、`orchestrator/agent-runtime.interface.ts`、`knowledge/kb-tools.service.ts`的内部执行上下文，及现有Knowledge创建/编辑/附件导入/去重预检的实际副作用提交点；不新增工具、不改变权限/审核/用户确认或页面，不把模型循环放入DB锁。四类工具真实提交同事务校验当前身份、权限和claim；创建/导入先准备后原子发布，编辑连同历史、索引、审计原子提交，预检仍必须由用户另行确认执行；失效上下文直接中断，不能作为普通工具失败后继续模型循环。Task6开始实施，验证后自动继续原计划。

**Files:** 修改`app/server/src/sessions/knowledge-chat-queue.service.ts`、`sessions.service.ts`；扩展同目录`knowledge-chat-queue.service.spec.ts`；创建`app/server/scripts/wp01/chat.mjs`。

**Interfaces:** 消费任务1/3/4；产出内部`WorkerExecutionContext = { scope: DeploymentScope; claim: ClaimRef }`（放`worker-publication.ts`），仅由后台注入内部消息提交路径，不接收HTTP body/透传JWT。sendMessage现有公开形态保持，内部可选execution参数必须一直传至实际消息/引用/产物的写点；缺上下文不能将后台路径当同步交互绕行。

- [x] W05–W12/W15本地契约：合法旧消息保留、同会话不并发、foreign任务0变化；撤成员/实际工具权限及旧token晚返回不发布assistant/trace，异常仅由有效claim记录失败。
- [x] 先RED后修补；队列/工具单元21及CLI chat真实PG48通过（含四工具30、队列/实际Sessions18），实际126247ms问答续租，后端完整回归与Web/Chrome认证通过。
- [x] 扫描/领取/心跳/完成/失败/恢复接scope+claim；实际消息、引文meta、trace、用量/额度结算调用/审计与终态CAS同tx。工具副作用也有独立当前授权/claim事务；会话软删/合并参与共同锁并保留数据。
- [x] 过期新claim保守failed、不自动重放未知结果；旧NULL claim活动任务保留，真实Provider已耗用仍转对账，不伪造零调用。
- [x] 本地写点自检与同步语义回归通过；仅complete_local_worker_contract，真实模型、KB工具UI、独立OS双实例、目标部署、全包独立评审和业务验收仍未完成。

## Task 7：科研run/局部attempt及派生产物提交

最终来源复核补充（2026-10-21）：Sessions已合法提交的回答不因后续撤权删除；但回答提交到run/attempt签名交付之间，实际引用文档/使用工具仍须保持授权。内部execution保留本次已验证资源清单（输入KB/doc＋实际引用＋实际知识工具），后续快照/终态复用该清单门禁；不把清单作为客户端授权，不改变科研来源/检索/计费。先写真实PG“回答提交后撤销引用文档审核，保留原回答但拒绝新签名/完成”反例，再最小接线。

导出提交确认异常补充（2026-10-21）：本次随机对象key并不自动等于“未发布”。file＋ready事务若已提交但确认丢失，必须保留实际已发布对象。异常清理前在新的短事务中锁定该真实job行，等待潜在提交结束并查询该独立key是否已有文件记录；无法核实则保守保留并报警，不自动重放。清理仍只在锁外删除已核实未发布的本次key，不触碰此前合法导出。

独立导出范围已批准（2026-10-21）：用户明确批准ResearchArtifactExportJob独立认领、当前授权及必要只增schema/配置。新增research-artifact-export执行种类和单独expand迁移（executionToken/workerOwner/leaseExpiresAt/startedAt/updatedAt五个nullable列及恢复索引），不改旧五模型迁移；common scope/claim/authorization、ResearchArtifactsService及.env.example只做必要接线。保留queued/rendering/ready/failed、120秒租约/15秒心跳，旧NULL claim活动行保留、过期新claim只失败不重放；真实requestedBy、产物/版本scope、当前artifacts＋artifact.export及诊断原有feature/released/显式capability在实际提交重验。渲染/上传锁外，file与ready CAS同tx；仅清理本次独立key，不碰旧合法文件。disabled明确拒绝接单，不静默关闭旧导出；实际部署启用清单仍另行验证。本轮不改格式、权限、审核、计费、页面或真实配置，不执行生产迁移/部署。新增失败测试先证明行为，再实施；通过后继续Task7及原计划，不要求重复批准。

新增范围已批准（2026-10-21）：用户批准ResearchEvidenceService.run内部检查点、run/items/检索策略/计数实际提交，以及SkillInvoker/Orchestrator科研分支执行失效中断传播的最小修补。真实PG旧反例已留痕；实现按先RED后修、锁外检索准备与同事务当前授权/claim复核提交，失效异常不转普通Skill失败或底座降级。保持检索、筛选、人工审核、计费、同步科研与正常故障降级及页面不变；验证后继续Task7及原计划，不要求重复批准。

**Files:** 修改`app/server/src/sessions/research-agent-runs.service.ts`、`sessions.service.ts`、`app/server/src/research-artifacts/research-artifacts.service.ts`（仅实际异步产物提交点）；创建`app/server/src/sessions/research-agent-scope.spec.ts`及`app/server/scripts/wp01/research.mjs`。

**Interfaces:** 消费任务3/4/6的`ClaimRef/WorkerExecutionContext/withWorkerPublication`；attempt同时核父run scope、状态与现有assistantMessageId/版本CAS，保留快照append-only契约。

- [ ] 写W05/W08–W12/W15：run恢复SELECT后续租不会误杀；attempt跨run拒绝；父run更替后旧attempt不能覆盖；科研文档/快照/引用在撤权先提交或claim丢失后不新增可见性，此前完成阶段不删除。
- [ ] 构建并运行`node --test app/server/dist/sessions/research-agent-scope.spec.js`及`node app/server/scripts/wp01/run-integration.mjs --suite research`，先重现run恢复UPDATE漏截止/晚完成反例。
- [ ] 接入扫描/会话锁/queued CAS/心跳/阶段输出/完成失败/恢复/显式重试，传播内部execution上下文至实际产物提交；OpenCode/临时产物按部署+claim分目录，不改医学算子与AI能力设计。
- [ ] 同测试通过；run/attempt过期保守failed、显式局部重试新token，保留既有阶段来源与合法快照。无真实模型执行仅记边界契约通过。
- [ ] 检查原强CAS未弱化、产物入口无旁路；未覆盖的内部实际写点明确阻断本任务完成。

## Task 8：原始处理任务、直接kick与特征发布

人工确认追加已批准（2026-10-21）：用户批准IngestService.confirmEyeImport／confirmProfileImport当前授权、任务版本防重及原子提交。此前合成PG正例及撤权仍写8条指标/1份档案的反例保留；现在在同一受限RLS＋共同tenant锁事务中重验当前交互请求者、真实任务/来源及全部映射被试，准备快照的updatedAt/状态/父绑定不得变化，业务值/任务文件状态/processing_status/原审计一次提交。下载与原解析/算子在锁外；不伪造后台claim或改为只允许createdBy，不改映射、权限、审核、数值、计费、返回形状或页面，不新增schema。eye既有完成快速返回重验授权；profile合法后续显式更新保留，同一版本并发只提交一次，后台running不抢占。新增单元和真实PG撤权、父对象/版本变化、并发/回滚测试通过后自动续Task8及原计划，不重复确认此范围；生产发布/新包外入口仍按原门槛。

上传生产提交追加已批准并验证（2026-10-21）：四入口当前请求者/真实被试访视、惰性默认分组与新建被试、文件、任务/特征、状态、原审计同一受限事务；原存储回退/幂等/映射/算法/权限/审核/计费/页面保持。上传PG98及人工确认37通过，四入口不再待确认；外部存储/解析不入锁，不新增schema。Task8原始Worker本地契约也已通过下列测试，不代表正式发布或全包验收。

**Files:** 修改`app/server/src/ingest/raw-processing.service.ts`、`ingest.service.ts`（同目录，原两处kick兼容＋另已批准四上传及两人工确认的最小修补）；创建同目录`raw-processing-scope.spec.ts`及`app/server/scripts/wp01/raw.mjs`。

**Interfaces:** 消费任务1/3/4；保持既有raw-processing kick API，不增加前端授权。worker disabled检查覆盖bootstrap/kick/tick/process，临时计算按claim隔离，特征/结果/状态在`withWorkerPublication`提交。

- [x] 写W05/W06/W08–W12/W15：`disabled_upload_kick_does_not_claim`断言存储/算子调用均0；foreign task及父subject/file错配拒绝；正常长任务续租；旧token不能写特征；处理中撤权不发布。
- [x] 构建并运行`node --test app/server/dist/ingest/raw-processing-scope.spec.js`及`node app/server/scripts/wp01/run-integration.mjs --suite raw`，先复现禁用后kick仍消费及running自动重排风险。
- [x] 最小接入各Skill的副作用提交点，计算前后均有授权检查点，独立心跳；过期running按已批准保守failed/interrupted，人工明确重试新token，未证明幂等不恢复自动重排。
- [x] 同测试通过，支持Skill清单/算法/阈值不变，不恢复退役音视频检测，不为测试上传真实媒体。
- [x] 评审全部完成/needs_review/失败分支及既有结果读取兼容，留中断提示和重试限制证据。

本地完成证据：raw CLI88、实际127363.70004199998ms/8次续租、双独立OS一次认领/下载/提交、实际上传→disabled Worker不消费；scope/原眼动/上传/人工单位12、全后端824/58/16/41/68/78与多模态82通过。只按原Skill能力做容器盘点、表格人工映射及绑定眼动确定性导入，未恢复退役检测；原claim/state/download/route事件已恢复，idle不热轮询。整体独立总评审与真实目标/业务仍留Task11和发布门槛。

## Task 9：存储/检索/临时空间与其他消费者封口

2026-10-21当前状态：所有既往消费者/读取/启动/发布入口追加批准及本轮两个配置入口均已兑现，不再待批。唯一总评审两项Important已按本轮一次修补计划验证；最终native all17组1142记录、完整后端/Web及两套浏览器12检查通过。本地代码闭环不等于正式共享启用；当前等待独立预发布目标与安全配置路径，保留完整真实启动/独立OS/恢复/目标请求及业务验收门槛，不直接运行旧生产。

本轮授权不扩大到Agent配置归档/模型引擎或其他方法；两配置入口仅共同锁、真实原子事务及只追加同一审计事件。Evidence异常复用现有WORKER停止协议（cause保留），不改SkillInvoker/Orchestrator或计费。当前无新增代码范围待批；目标环境、资源创建、生产迁移/部署/排空仍需独立环境和安全授权，不猜生产配置。

**Files:** 修改`app/server/src/storage/storage.service.ts`、`app/server/src/sessions/chat-chunk-upload.ts`、`app/server/src/knowledge/retrieval.service.ts`、`app/server/src/knowledge/knowledge.service.ts`、`app/server/src/orchestrator/opencode/opencode-workspace.ts`、`app/server/src/orchestrator/opencode/opencode-pool.ts`；创建`app/server/src/common/worker-resource-scope.spec.ts`与`app/server/scripts/wp01/resources.mjs`；更新`environment-evidence.md`。 本次用户追加的读取文件：`app/server/src/data/data.service.ts`（仅rawContent及其私有门禁）、`raw-content-access.spec.ts`、`scripts/wp01/raw-content.mjs`、`raw-content-browser.mjs`与runner接线。`remaining-content-read-probe.mjs`只诊断，不修改两个待批消费者。 本轮已批准追加：`research-artifacts/research-artifacts.service.ts`仅fileContent/私有门禁、`sessions/sessions.service.ts`仅attachmentContent/必要私有返回、内部`common/resource-read.ts`、对应行为测试、`scripts/wp01/content-read-fixture.mjs`/`content-read.mjs`/`content-read-browser.mjs`和runner。`consumer-bootstrap-probe.mjs`仅W20诊断；未改主启动入口，不将main.ts列成已经批准实施。 本次用户已批准追加：`app/server/src/main.ts`仅import/装配调用、内部`common/worker-consumer-assembly.ts`、单元`worker-consumer-assembly.spec.ts`、`scripts/wp01/consumer-bootstrap.mjs`及`consumer-bootstrap-child.mjs`真实编译main隔离测试与runner/posttest接线。旧`consumer-bootstrap-probe.mjs`及其productionBootstrapUnmodified元数据只属于修补前冻结诊断，不重跑冒充当前状态。`release-bootstrap-probe.mjs`仅Task10实际前置shell分支隔离诊断，未改生产发布脚本；待新批准后再追加相应Task10 Files。

范围沿革说明：以上“未改main/发布脚本、待批准”均为对应历史切片状态，现已由后续用户明确批准覆盖，不是当前待确认项。本轮Task10新增文件见下节；不据历史计划扩展其他模块。

**Interfaces:** 消费scope/claim；资源入口校验真实记录归属、当前授权与允许文档集合，不把storageKey当授权。临时目录根固定部署命名空间，子目录使用claim；旧正式storageKey语义保持。

- [ ] 写W04/W16/W20/R5：B请求A已知key/检索doc/导出拒绝；无成员B账号不自动授权；B清理仅删除B本次临时对象；故意缺一个enabled消费者时启动验证失败。
- [ ] 构建后运行`node --test app/server/dist/common/worker-resource-scope.spec.js`及`node app/server/scripts/wp01/run-integration.mjs --suite resources`；先保留越权/跨目录清理的行为失败，不在共享真实根测试删除。
- [ ] 按负例最小修补真实落点；消费者运行清单逐个对应ENABLED_WORKER_KINDS，新增Hub未验证消费者明确不启用。旧提醒/情报/方法/导出等若需包外代码修改，停该扩展并报告范围，不默认全停旧任务。
- [ ] 同测试通过；官方合法只读仍可访问，跨部署私有内容/目录不得命中；未验证消费者不能用四类通过销项。
- [ ] 评审临时回收不递归共享根、无旧对象搬迁；未知实际OpenCode工作区/缓存配置阻断目标配置层，不伪称已隔离。

## Task 10：受控发布/回退的最低安全版本门槛

2026-10-21入口局部已验证：bootstrap固定六文件/SHA唯一完整校验、无旧回退；真实shell/Python/Node＋临时路径/假外部执行器，专项24、前置16场景、契约20通过。受控源码批准与构建真实字节绑定、切换/迁移前门禁及后置ready指纹分层不变。原总评审两项已由本轮一次修补/完整回归覆盖，但未有第二次评审，也未生成真实批准。目标GitHub保护/变量、OSS ACL、停止入队/排空、完整恢复及真实云发布仍未验证，本节不整体勾完成。

**Files:** 创建`app/scripts/wp01-release-policy.mjs`、`wp01-release-policy.test.mjs`（同目录）；修改`app/scripts/ecs-release.sh`、`app/scripts/write-capability-manifest.py`、`.github/workflows/deploy.yml`、`.github/workflows/rollback.yml`（仅manifest分发/校验接线）；更新`environment-evidence.md`与本包发布步骤。 用户本轮追加批准：`app/scripts/cloud-assistant-bootstrap.sh`及`test_wp01_release_bootstrap.py`，同步`test_deploy_contract.py`行为接线；不改变云助手＋OSS部署架构。

**Interfaces:** 发布manifest包含artifact digest与明确能力集合`deployment-scope-v1/claim-fencing-v1/publication-gate-v1/conservative-recovery-v1`；`assertSafeSharedRelease(manifest, requiredCapabilities): void`仅信任受控构建产物与digest匹配，不接受任意标签自报。共享模式下在迁移/切换前校验；历史无manifest版本拒绝自动回退。

- [ ] 写W19/R5：无scope版、scope-only版、缺manifest、digest不匹配均拒绝；完整已验证版本允许。断言拒绝发生在migration/compose切换之前，而不是回退后报警。
- [ ] 运行`node --test app/scripts/wp01-release-policy.test.mjs`，用假的本地执行器观察受控入口尚未拦截的行为失败，不调用云助手或Docker。
- [ ] 将校验接入现有deploy与rollback实际入口和受控control包，不改SSH/发布架构。合成演练先停止新入队/claim、核对在途、保留expand数据，再退安全基线；旧全部消费者安全版本核对不过，不启用B任务。
- [ ] 同测试通过，`bash -n app/scripts/ecs-release.sh`通过；合成恢复演练保留任务/源数据与追踪，未执行生产变更。
- [ ] 评审发布入口覆盖范围；本地任意直接跑旧二进制不是该工具能绝对禁止，必须如实列限制。需暂停入队/排空的生产窗口另请用户批准。

## Task 11：双部署/用户入口回归与证据交付

2026-10-21当前执行：native all17组1142检查记录退出0、均通过；认证6＋控制面6新浏览器通过，9PNG/4WebM，0pageerror，控制面实际HTTP拒绝状态留证据、测试席位恢复。先前all143属于冻结历史诊断，不覆盖本次结果，也不清理其未执行finally的具名合成行。原No的2 Important已按一次修补轮闭环，不派二次评审；无额外Minor。剩余全后台导航、Hub正式UI/声明未接入、各类别独立Worker OS、完整真实启动/恢复及目标/业务验收不能由本地聚合替代。当前停在独立预发布目标/安全配置确认，不运行临床/旧生产。

本轮测试Files追加：`app/server/scripts/wp01/agent-config.mjs`、`authorization-suite.mjs`接线、`research-evidence.mjs`新增COMMIT回执故障与真实SkillInvoker；`control-plane-browser.mjs`仅合成PG＋现有Web的原计划控制面验证，不新增业务Controller或页面。

**Files:** 完成`app/server/scripts/wp01/run-integration.mjs`的all套件及创建`app/server/scripts/wp01/browser.mjs`；创建`researchhub/docs/testing/wp01-shared-boundary/report.md`；更新本包spec/test-design/progress、`researchhub/docs/product/product-baseline.md`、`product-changes.md`及使用说明；旧侧对应living spec/版本/使用文档按已核对文档索引定位，不另造第二份规范。

**Interfaces:** 消费任务1–10的全部契约和fixture清单；输出W01–W20逐项真实状态、证据路径、代码/config/请求/业务四层状态。浏览器仅使用合成账号/两已登记本地进程，端口按环境台账指定，不接管当前5173演示服务。

- [ ] 先写W02–W04/W17/W18浏览器断言：合法旧登录/失效会话、无成员无私有研究、旧超管管理B可审计、普通B管理员拒绝、任务中断不假成功、旧列表详情编辑和既有任务兼容；缺新真实UI时断言对应能力未接入而不是登录成功。
- [ ] 运行`node app/server/scripts/wp01/run-integration.mjs --suite all`和`node app/server/scripts/wp01/browser.mjs`，保留失败基线；进程A/B共享同一合成库，A1/A2证明同部署并发，不用两个独立DB代替。
- [ ] 仅修复本包测试证明的缺陷；发现包外改造/业务范围变化先提请确认，不复用旧UI计数。前端若实际需改则先读UI V1.1并更新对应用户说明，不重排母版。
- [ ] 重跑所有适用单元/集成/真实浏览器、截图/录屏及旧业务回归；若改ResearchHub代码，另`pnpm --dir researchhub run build`。目标环境只在另获环境访问/变更授权后复验，不拿本地合成代替G1正式结论。
- [ ] 全包独立评审后交付限定diff、迁移/发布/恢复手册、未测清单，文档同步Notion；由用户确认WP01业务验收。任何核心门槛缺失，标阻断/部分完成而非“WP01通过”。

## 顺序、切片退出与执行方式

用户已选择主集成串行实施（Native），共享策略/schema/授权事务不能并行自由改；不逐任务派实现者。首批代码已有一次独立总评审及重要项红测修补，全包完成后仍需覆盖当时全部变更的总评审。不要重新询问已批准的规格/计划或执行方式。

第一批仅任务1：可在无真实库/生产权限下先写部署与认证行为红测并最小修补。任务2的环境保护通过且合成环境可用后，才进行任务3–11真DB部分。没有真实catalog不猜租户ID、不改目标.env；不承诺本计划能在单日完成，实际耗时进入10-23复估。

自检：规格§3–4→任务1/9；§5→任务3–8；§6→任务2/4/9；§7–8→任务10–11；§9→任务2环境门槛。R1–R5均有归属测试；接口名与tx类型统一；没有将“测试设计”计为执行证据。实际OpenCode工作区配置与其他消费者包外范围为明确环境/范围门槛，不据此擅自补系统架构。
