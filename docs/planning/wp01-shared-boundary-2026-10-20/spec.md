# WP01「共享边界」实施规格 V0.1

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

## 2026-10-21 · 当前WP01检查点

2026-10-21续行：用户已批准知识工具执行上下文最小接线，四类工具及Task 6问答队列/实际消息发布已完成本地代码与合成验证（PG48，其中工具30、队列/真实Sessions18，问答实际126秒续租）；授权106、导入14、资源12、全量824/58/16/41/68/46、Web与Chrome认证6通过。Task 7历史预检实证ResearchEvidenceService仍可在失claim后发布completed证据运行，SkillInvoker会吞执行失效且科研编排会降级继续；上述证据提交/失效传播范围现已获批并实施；当前新增确认是独立科研产物导出的认领/授权契约，不是重复确认已批范围。WP01整体、独立OS进程、目标部署和AI业务验收仍未通过，不得启用正式任务。

本轮工具/问答PG48、全量回归及浏览器证据见[当前验证报告](../../../../docs/test/WP01-Agent授权事务切片验证-2026-10-20.md)。内部上下文不作为HTTP/模型参数；锁外准备、短事务重验与实际提交不可拆分。下列初始认证/旧阶段描述为历史记录，不表示当前四类消费者都已接入或目标环境已启用。

日期：2026-10-20。状态：**规格与计划已批准，主实现串行＋独立总评审；Task 2/3本地通过；2026-10-21续行：用户已批准知识工具执行上下文最小接线，四类工具及Task 6问答队列/实际消息发布已完成本地代码与合成验证（PG48，其中工具30、队列/真实Sessions18，问答实际126秒续租）；授权106、导入14、资源12、全量824/58/16/41/68/46、Web与Chrome认证6通过。Task 7历史预检实证ResearchEvidenceService仍可在失claim后发布completed证据运行，SkillInvoker会吞执行失效且科研编排会降级继续；上述证据提交/失效传播范围现已获批并实施；当前新增确认是独立科研产物导出的认领/授权契约，不是重复确认已批范围。WP01整体、独立OS进程、目标部署和AI业务验收仍未通过，不得启用正式任务。不是全包G0/G1或生产隔离声明。** 见[环境记录](environment-evidence.md)。

批准记录：用户明确回复“确认批准这份 WP01 规格”，承接上一轮对D01推荐A的确认问题。批准包括下述技术边界、持久claim、五模型恢复策略及官方任务例外；未授权直接迁移、排空、部署或回退生产。下一步见[实施计划](implementation-plan.md)。

需求来源：[一期确认台账C04–C06/C08/C11/C12](../phase1-review-2026-10-19/README.md)、[ADR-0003](../../decisions/0003-shared-database-tenant-boundaries.md)及用户当前要求“先补齐并确认WP01，再写测试和最小修补”。

## 1. 目标、前提与退出条件

目标是让新旧部署安全复用同一PG实例、数据库和公共表，而不是重建平台、迁历史患者数据或让两套运行服务无条件互通。

已确认：ResearchHub独立部署，旧系统继续运行，业务按租户隔离，租户管理共用；公开注册默认灵枢心域新租户，私有Study另行授权；必要旧后台隔离修补允许先验证后实施。

随本规格批准的技术基线：一期单租户账号/独立登录，app/server/prisma/migrations为唯一共享迁移入口，五个执行模型采用executionToken/workerOwner/leaseExpiresAt持久claim。具体实现文件和事务同步机制在实施计划细化，真实catalog、运行配置及兼容性仍须验证。

WP01退出条件：允许范围明确且不可由请求伪造；认证/四类后台全生命周期遵循范围；并发、重启、撤权与旧执行者写回反例通过；目标环境受限角色/RLS及新旧兼容有证据；旧业务回归通过后，才允许新租户正式业务任务启用。**只补查询where或只跑Mock测试，不算WP01通过。**

## 2. 包内/包外与三端影响

| 面向 | WP01内 | WP01不做 |
| --- | --- | --- |
| 科研端 | 真实会话所属部署/租户拒绝策略、无私有研究授权的负例、任务失败/中断反馈；保留UI V1.1 | 公开注册/找回/邀请完整流程（WP02）、知识UI整域接入（WP03）、EDC/AI业务开发 |
| 管理端 | 复用旧平台超管租户管理；区分控制面与业务面；查看/审计范围和停用效果验证 | 给新租户普通管理员跨租户权限、重写第二个控制台或新建运营微服务 |
| 后端/数据库 | 部署scope、认证校验、四类Worker及必要父对象/文件/检索负例、最小兼容迁移与启用门槛 | 全仓授权重构、第二套公共表、第二条共享库自动迁移链、退役检测恢复 |

没有真实新后端时，先在隔离合成环境用同一受控后端基线的两个进程验证边界，不能把ResearchHub前端demo当第二套真实服务。后续真实登录UI仍由WP02验收，本包不声称已上线账号能力。

## 3. 共享/隔离矩阵

| 对象 | 共享内容 | 必须隔离/限制 |
| --- | --- | --- |
| Tenant/Account及公共业务表 | 同一物理表、既有主键/FK与历史结构 | 行所属tenantId；账号、成员、Hub/Study授权不能因共表自动合并 |
| 官方资源 | 已有允许tenantId=null的官方Skill/量表/知识/模板，按既有规则只读复用 | null不是任意租户通配；官方写入/导入仅显式控制面执行者，不能混进新业务Worker |
| 认证会话 | 复用哈希、authVersion、Guard和权限逻辑 | 推荐独立签名密钥/会话命名空间、host-only Cookie；不设父域共享Cookie，不自动SSO |
| 后台任务 | 同一任务表和已有幂等/会话锁契约 | 部署允许租户、执行者、claim代次、租约及当前授权 |
| 文件/索引/AI工作区 | 可复用Storage/Parser/Embedding/检索实现与服务 | 资源真实tenant/group/project、授权文档集合、部署临时目录/缓存键/工作目录；不能只改bucket而不改任务归属 |
| 租户控制面 | 旧超管现有管理入口和公共Tenant配置 | 仅显式获准控制面路径可跨租户；platform_admin不等于业务API全租户放行 |
| 迁移/发布 | 推荐app/server/prisma/migrations为唯一共享迁移链 | 两个应用独立发布；不得同时自动迁移、重跑通用seed或整份rls.sql |

### 3.1 已确认的产品决定 D01

**已批准A：一期账号仍归单租户，两套入口独立登录。** 同一人可分别拥有旧租户账号和灵枢心域账号，不按同名或邮箱自动合并。共享Account表保留`(tenantId, username)`唯一约束，未来整合再引入显式身份关联。

备选B：一期即要求同一身份跨两系统/租户通行。当前Account是单tenantId，并非全局身份+成员关系模型；B需要额外身份/会话/归属设计，会扩大WP01及WP02，不能当“共用账号表”的自然结果。

D01已随本规格批准；不改变Account归属模型，不在WP01引入SSO。登录边界按实施计划先测试后修补。

## 4. 部署与认证契约

以下是**已批准的拟新增契约**，不是当前已有配置；装配与环境变量命名在实施计划锁定。

```ts
type DeploymentScope = {
  deploymentId: string;              // 唯一部署/实例族标识，服务端可信配置
  product: 'aisciencesys' | 'researchhub';
  allowedTenantIds: readonly string[]; // 实际Tenant.id；现有ID是字符串/cuid，不假设UUID
  defaultTenantId?: string;           // ResearchHub必须显式绑定新租户
  controlPlaneEnabled: boolean;
  officialJobKinds: readonly ('knowledge-import')[];
  enabledWorkerKinds: readonly string[];
};
```

- **S01 配置失败关闭：**共享运行模式下，缺失/空/通配符/未知ID/ResearchHub默认租户不在允许集合时，不启动业务请求与Worker消费；不得回退“全部租户”。旧部署先枚举实际需要服务的旧租户，不写死猜测ID，不用新租户之外的补集表达。
- **S02 无交集：**一期旧业务允许集合与ResearchHub新租户集合不交叠；旧控制面管理新租户不等于旧业务Worker拥有新租户。
- **S03 可信来源：**域名/默认租户由服务端部署配置与受信代理映射确定。body/query/Host/X-Forwarded-Host不能扩张允许范围。旧登录tenantSlug参数可保留兼容，但必须落在本部署允许集合；新入口不能借改参数切回旧租户。
- **S04 双重认证检查：**签发前验证允许租户；JWT验签后、加载业务资源前再次验证scope，并继续重查租户/账号active与authVersion。有效但属于另一部署/租户的凭证统一拒绝，不泄露其是否存在。不能靠CORS或Cookie名证明隔离。
- **S05 会话兼容：**旧站既有Cookie/会话行为优先保留，新站采用独立配置；新增issuer/audience若实施，应固定并验收旧令牌兼容/换发，不能顺便强退所有旧用户。独立密钥不复制到文档；当前是否独立须目标环境举证。
- **S06 授权不扩张：**通过部署租户校验只是进入该租户的必要条件；无组/项目成员的基础账号仍无私有数据。Hub负责人/PI/采集角色不映射为platform_admin。

错误沿用现有框架形态，不全仓改响应封装：缺失/失效/跨部署凭证用通用401；已认证但无操作权用既有403；越权对象按既有不泄露存在性的404；scope配置错误是启动/就绪失败，不伪装空列表或Demo成功。新增机器错误码仅作候选，批准后与现有responseError规则对齐。

## 5. 后台执行契约

适用四类及科研stage attempt：knowledge-import、knowledge-chat、raw-processing、research-agent-runs。状态名称继续用各表既有queued/processing/running/failed等，不强行统一重命名。

### 5.1 每一入口均受边界约束

**发现候选→领取→重建授权→外部调用/阶段副作用→心跳→完成/失败→恢复/重试**各步都检查相同scope。bootstrap开关不是充分条件：直接schedule/kick/process、定时扫描、管理员重试、取消/超时处理也不能绕过；配置禁用后不得由上传调用kick唤醒。

候选查询在DB层就限定“允许tenantId内的普通任务，或本部署显式启用的官方knowledge-import例外”，不先全局取出私有任务再在内存过滤；只有官方路径允许后一个OR分支。按id入口也验证任务及父Session/KB/Subject/Project真实归属。stage attempt沿其run验证相同作用域。执行授权使用任务保存的accountId/createdBy及当前成员/角色，不依赖roleSnapshot；createdBy为空或无法解析的旧导入任务不猜身份，阻断自动恢复并列人工核对，不能伪造授权。

租户/账号停用、成员/组/项目失效或能力撤销后：执行前不得调用文件/模型/算子；执行中在下一可控检查点停止新增副作用，终态提交再次验权。已经发出的外部请求不承诺瞬时撤回，记录中止/取消待确认及真实调用；不得把无法撤回写成“从未执行”。

最终发布与撤权入库须定义同一个可验证的事务/授权版本或锁顺序：撤权已提交在前，发布必须拒绝；并发时按约定串行结果判定，不承诺任意时刻瞬时取消。实现计划必须列明共同同步机制及需接入的最小撤权入口，不能只在发布前做一次普通SELECT就声称原子撤权。系统仍可写failed/interrupted、审计及调用轨迹；禁止的是无权发布业务结果，不是禁止失败留痕。

### 5.2 领取、租约与旧持有者拒写

推荐新增最少持久字段：`executionToken`（每次claim新代次）、`workerOwner`、`leaseExpiresAt`；具体字段/索引以真实DB与红测为依据，一次兼容增量覆盖五个执行模型，不另起Redis/调度平台。字段可空用于expand兼容，**可空不代表新Worker允许绕过租约**。

建议首版heartbeat每15秒、lease 120秒，统一用DB时钟计算过期；仅用于新claim，不直接改写旧任务的5/30分钟恢复约定。合成测试覆盖心跳丢失、执行超过lease但正常续租、事件循环阻塞和配置关系错误。参数须随实际调用/资源测量复核；token fencing保证过期后旧执行者不能发布，不保证长外部调用被即时取消。

1. 保留已有session advisory lock与queued CAS；知识导入补DB原子claim。候选读取成功不等于领取成功，更新影响行数为1才持有任务。
2. claim条件包含id、真实tenant/scope、期望状态；claim后返回完整执行上下文和token。新消费者不执行无有效claim的旧活动任务。
3. 心跳、进度、阶段写回和终态都需匹配token/owner、当前状态、scope与有效租约；失去claim立即停止。判陈旧与恢复的UPDATE必须重核截止时间，不能只在前一次SELECT判断。
4. 完成及关联业务写入在同一受权事务内先核验claim，再以CAS提交；旧持有者晚返回不得把failed或新claim覆盖成success。科研stage attempt同时核验父run版本/状态，不退化已有较强CAS。
5. 文件/索引等跨事务副作用采用任务代次的临时/版本化产物，核验后发布引用；失去claim的产物不得进入可见索引/正式结果。若现有reindex接口无法做到，必须补最小发布门禁后再启用该路径，不能只保护最后一行状态。
6. 目标是“一个claim产生一次被接受的业务提交”，**不是承诺外部模型/OCR计费调用严格一次**。不确定的外部完成状态保留轨迹，不能为快速恢复而无条件重放。

### 5.3 官方任务与恢复边界

新业务部署默认不处理tenantId=null任务。旧控制面可显式允许官方知识导入，必须核验当前平台管理员、官方KB与执行owner，使用受控官方事务路线而非普通租户成员事务；不向forTenant/withTenantTransaction传null当通配，也不要求官方行伪造tenant/group/project。其他任务类型null拒绝。未知父对象、归属不一致、租户不在scope时不代为“修复tenantId”，保留任务并记录不含内容的阻断原因。

**首版过期恢复基线（已随规格批准）：**

| 模型 | queued/未执行 | processing/running租约过期 |
| --- | --- | --- |
| KnowledgeImportTask | 在获准范围按新token领取 | 标failed/interrupted，保留sourceFile/docId；经人工明确重试、核验可幂等继续的阶段后才新claim，不直接重放未知外部调用 |
| KnowledgeChatJob | 按既有会话互斥领取 | 保留现有stale→failed的默认，不自动重放问答/计费；用户明确重试才新任务/claim |
| ProcessingTask | 维持既有queued CAS与幂等键 | 首版保守标failed/interrupted再人工重试，已随本规格明确批准；这比旧自动running→queued更保守。若要保留自动恢复，先逐Skill证明副作用幂等与checkpoint，再批准开启 |
| ResearchAgentRun | 保留会话互斥和queued CAS | 保留现有stale→failed，保留已完成阶段/来源，不自动再跑整个科研任务 |
| ResearchAgentStageAttempt | 保留父run版本与queued CAS | 标failed/interrupted，保留既有阶段快照；只能显式局部重试，不自动覆盖父run结果 |

用户明确重试也不得复用旧token。上述不删除源文件、已入队消息或此前已合法发布的阶段产物；失claim/撤权后，只禁止本次未发布产物新增可见性。尚无执行来源的历史活动任务按排空/人工核对处理，不由新规则直接全量改状态。

**其他Worker登记门槛：**启用的提醒/情报/导出/方法/清理等入口须列运行清单；未完成同样边界验证的消费者在ResearchHub部署保持未启用且显式标注阻断，不用这四类通过代表全后台通过。旧原有任务不因本清单被静默停掉；新增发现若需修改包外模块，先报范围/评审。

## 6. DB、存储与控制面约束

- 普通业务通过受限app角色和tenant/group/project上下文；多语句业务用现有withTenantTransaction，不能把多次forTenant调用假装成一个原子事务。
- elevated用于认证/受控管理/必要后台路径不等于无限通行；每条使用路径有scope和审计。实际角色若为owner/superuser/BYPASSRLS，按catalog评估最小运行权限，迁移DDL凭据与运行态分离；未核验不得承诺RLS替elevated兜底。
- 不含tenantId的子表、官方只读行、触发器/函数/授权视图列例外清单，沿父关系验证；无授权时拒绝，不能只检查顶层任务表。
- 对象存储可共用物理服务，但保留已存在storageKey，禁止为上线新项目批量搬旧对象；下载/索引以记录归属与授权检查为准。部署临时目录、清理器、OpenCode工作区和缓存前缀隔离，不改旧key语义、不递归清理共享根。
- 共用租户控制面仍为旧超管入口，跨租户操作仅限明确列出的Tenant管理/配额/功能开关路径且审计；普通业务服务不能因为角色是platform_admin就跳过部署scope。
- 只读catalog核查不需要患者行/密码/原始媒体；记录schema/迁移hash、角色属性、grants/RLS/例外与运行版本，不把连接串或患者内容放仓库/Notion。

技术依据：[PostgreSQL 16 RLS](https://www.postgresql.org/docs/16/ddl-rowsecurity.html)明确superuser/BYPASSRLS绕过行策略；[advisory lock](https://www.postgresql.org/docs/16/explicit-locking.html#ADVISORY-LOCKS)是应用约定的锁。因此本规格将部署scope、租约和授权列为独立门禁，不从“已写RLS/有会话锁”推导全链隔离成立。

## 7. 最小修补候选与代码组织

下表是批准后候选落点，不是已创建文件；不在ResearchHub前端目录伪造一个后端。

| 切片 | 最小候选文件域 | 不应扩大为 |
| --- | --- | --- |
| 部署策略 | 旧app/server/src/common中一个DeploymentScope策略及装配；auth.service/JwtAuthGuard接入 | 全仓配置中心/身份重构 |
| 任务基础 | 共享claim/scope小契约，Prisma/schema唯一增量，已有事务原语 | 整套新调度器/Redis迁移 |
| 四类消费者 | 四个已定位Service及科研attempt；旧开关覆盖kick/tick | 重写解析/研究编排/医学算子 |
| 副作用门禁 | 导入/索引/特征/消息/产物的必要提交点 | 全量知识库或科研数据功能升级 |
| 验证与运维 | 合成双实例夹具、catalog审计、已有控制面/科研端负例 | 第二条迁移链、通用seed重跑、生产试错 |

当前源码基线根仓库HEAD为`9b2bf43`，ResearchHub为`190f509`，均有未提交改动；**HEAD不是完整工作副本指纹，也不是目标环境版本**。批准后的实施计划先锁定允许采用的文件/差异/镜像清单，再按小切片列具体文件和命令；不能全量提交已有改动。

## 8. 验证、发布与回退

详细反例见[测试与证据矩阵](test-design.md)。执行顺序：先批准规格→明确实现切片/执行方式→写行为红测→最小修补→真PG双实例→科研/控制面浏览器→目标环境配置与请求复验。Mock只能证明分支契约；真实调用的边界和实际业务结果分开举证，不借用上一轮UI测试计数。

发布门槛：

1. G0取得实际catalog/代码版本/允许租户/消费者/存储目录清单，复现既有风险，确定最小增量；此阶段允许红测失败，不算运行环境可启用。
2. 合成环境先expand，再运行新旧兼容版本和并发/重启/撤权/旧持有者反例；旧客户端能读写旧租户，不静默改历史记录。
3. 旧全部消费实例先升级至“有scope且支持claim代次”的最低安全版本。涉及短时暂停入队/排空的窗口另经用户授权，旧系统不得被默认全站停机。
4. 无租约的旧活动任务先排空/核对；未明结局列人工处理，不批量清空或直接重领。已修补旧部署验证不处理新租户后，才启用新部署写入/任务。
5. 回退先阻止新提交和新claim，处理在途/待处理新租户任务，再退到已验证且同时支持scope、claim代次、副作用发布门禁及恢复策略的最低安全版本；只有scope、没有claim fencing也不安全。**不能仅停新入口后回退到会全局扫描或无持有者门禁的旧版本**。保留新增列/记录，不用删数据降级schema。

以上最低安全版本必须进入实际受控发布/回退入口的版本清单检查并有拒绝负例；在该检查尚未实现验证前，只能记“待实施的发布门槛”，不能说系统已能阻止任意旧二进制启动。实际发布入口的最小改动由实施计划明确，不能暗中扩为整套CI/CD改造。

运行四层证据单独登记：代码实现→目标环境配置→真实请求实际执行→用户业务结果。WP01是共享安全边界验收，不代签AI专业效果。日志只含部署/租户/任务/claim及结果元数据，不记录正文、密码或原始材料。

## 9. 实施前输入与待确认

| 项目 | 获得方式与影响 |
| --- | --- |
| D01账号策略 | 已批准A：单租户账号、独立登录；不扩展全局身份模型/SSO |
| 技术规格批准 | 2026-10-20用户明确批准V0.1；实施计划评审与实际执行证据另记，不等于G0/G1通过 |
| 实施计划/方式 | 用户确认推荐Native：我串行实施＋独立总评审；首批Task 1证据见[验证记录](../../testing/wp01-shared-boundary/report.md) |
| P02代码/镜像基线 | 只读核对实际运行版本、待保留差异；未核对不能称旧版本兼容 |
| P04 catalog/角色/RLS | 受控只读访问或schema-only导出，不在聊天贴凭据；未知项阻断目标环境结论，不阻断合成规格工作 |
| P05/P06合成环境/资源 | 用户追加授权本地现有实例新建wp01_test_shared_boundary；保护/合成夹具及本地PG验证已完成，见环境记录；不接管现有端口、不代表生产资源已验证 |
| 租户与消费清单 | 旧允许集合、新Tenant.id、官方任务owner、全部运行消费者；不按名称猜ID或扫描患者行 |
| 变更窗口/恢复责任 | 生产迁移、排空、部署、回退另行审批；本轮没有执行权限或就绪证明 |

常见错误是把“共享表+现有RLS”当作完成，漏掉elevated扫描、直接kick、恢复器和旧持有者晚写回。本规格按入口与生命周期定义反例，避免只在列表/API入口加tenantId后就宣称安全。
