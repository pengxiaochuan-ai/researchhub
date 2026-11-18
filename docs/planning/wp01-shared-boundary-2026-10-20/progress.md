# WP01规格任务进度

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

## 2026-10-21 · WP01发布控制局部验证，全包评审阻断

- 本轮前置控制入口追加批准已兑现（仅本地）：cloud-assistant-bootstrap按固定六文件集合完整/唯一校验SHA清单及实际字节，缺失/重复/路径别名/错摘要一律在安装/执行前拒绝；新增WP01策略与release manifest分发，取消本机旧脚本回退。云助手＋OSS方式、消费者、权限、计费和页面保持，未触碰真实部署。
- 原Task10发布门槛已接线：受保护reviewed-source批准必须匹配准确源码提交、四项安全能力、独立总评审/消费者清单与证据摘要；controlled build封存实际镜像ID/归档/Compose摘要，再由真实发布/回退入口在替换Compose、迁移或启动前验证。Node门禁仅使用已加载镜像的node entrypoint、只读临时目录、无网络/真实.env；ready运行指纹与预放行manifest分开留证据。当前WP01_SHARED_RELEASE_APPROVAL未配置、总评审未放行，禁止填真或拿脏副本HEAD作安全版本批准；信任边界仍是受控workflow/OSS写权限，不声称能防御root/OSS写失陷或直接跑旧二进制。
- 本地发布专项24/24、前置包2测试方法/16子场景及部署契约20/20通过；完整后端828/58/16/41/68/85/23/2/2各组0失败/skip（可重叠）、Web构建与新浏览器6通过，4PNG/2WebM、0pageerror。浏览器仍是旧Web/同OS双Nest，不冒充Hub正式UI或完整W17/W18。真实脚本只替换临时路径/外部执行器，核心checksum/Node policy真实执行，不等于云/Docker/生产发布或暂停排空演练；所有RED/中间失败保留。证据：docs/test/evidence/2026-10-21-wp01-release-control/results.json。
- 已继续Task11：补all串行聚合和browser编排；all先实证未实现，再补接线，本轮完成显式重放114/情报73/DQ92三组。独立总评审发现新增AgentConfig撤权竞态后，在methods启动时停止聚合，退出143，整套不能计绿；finally清理可能未执行，保留具名合成夹具，未绕过触发器/约束或删历史。正式配置/各类别独立OS、控制面全导航、完整恢复演练和业务验收仍未通过。
- 唯一全包独立只读总评审结论No：2个Important、无已证实Critical/额外Minor。新范围是AgentsService.activateConfig/updateConfig缺共同tenant授权锁；另有已批准Task7范围内的ResearchEvidence提交确认不明后可能将completed覆写failed。主集成核实后暂不改这些生产方法，等待仅新增配置入口范围确认，再在一次修补轮处理两项，不派二次评审。Task11: partial_awaiting_agent_config_revocation_scope_confirmation；本次发布入口不再待批，不标Task9–11/全包或四层验收完成。无生产迁移/部署/真实.env修改/旧PID722/729重启/提交推送。


## 2026-10-21 · WP01启动装配门禁本地验证，发布前置入口待追加

- 本轮 main.ts 追加批准已兑现（仅本地）：容器创建后立即调用内部 assertWorkerConsumerAssembly，早于中间件、init/listen 及 Worker 生命周期；按实际类 token 解析六类 enabled 消费者并核对原生命周期入口。research-agent-runs 与 research-stage-attempt 共用既有 ResearchAgentRunsService；缺失/无效以 WP01_WORKER_CONSUMER_MISSING 中止，不调用消费者或认领。main.ts 仅新增 import 与一次调用，去除两行后 SHA 与 HEAD 的 384780d11ebecba3e97a6ab215bd8c6b66af8bda0b414c19dbcd46b52580f3b9 一致；六类消费者、默认启停、旧 RAW_PROCESSING_WORKER_DISABLED、官方知识任务策略、权限与页面未改。
- 真实编译 main＋Nest＋实际 scope 工厂/受保护合成租户目录：修补前6正常/配置对照通过、14安全反例失败；修补后20/20，缺 provider/无生命周期方法/未知kind均在初始化与listen前拒绝，相关启动/销毁钩子及实际claim均0。单元2项包含真实五个消费者类的装配，不启动真实Worker；主入口测试只替换会加载真实.env的AppModule为安全根模块，以类token生命周期哨兵观察顺序，不代表完整生产装配、真实Worker业务或目标启用。失败后不在主入口主动close引发Worker销毁钩子，保持原未捕获启动失败的进程退出策略；测试记录后自行清理。
- 完整后端828/58/16/41/68/85/23/2/2各组0失败/skip（组可重叠），Web构建通过；resources39、授权106最终整套及认证浏览器6新回归通过，4PNG/2WebM、0pageerror。授权首轮106中一项configureMembers出现PrismaClientInitializationError；保留失败，不改生产或放宽断言，在测试进程将已验证localhost明确固定127.0.0.1后整套106重跑通过，未断言已定位初始连接故障根因。真实浏览器是两隔离Nest应用同OS＋旧Web，不冒充ResearchHub正式认证UI。证据：docs/test/evidence/2026-10-21-wp01-bootstrap-assembly/results.json。
- 继续原计划Task10只读/隔离核对发现额外落点：cloud-assistant-bootstrap.sh实际下载/安装固定控制文件集合，rollback下载失败可执行本机旧ecs-release.sh；仅改下游ecs-release或workflow不足以证明入口受控。实际脚本只替换临时目录，以假Python/执行器演练：deploy正确拒绝；rollback仍执行合成旧脚本、退出0，安全反例失败（诊断退出1），未运行云/OSS/Docker或真实发布。夹具初稿在下载分支前早退，已补明确到达下载决策的断言并重跑，不把初稿当绿色门禁；原生产脚本和部署架构保持未改。
- 本次启动修补不再待批，Task9仅局部通过；Task10: partial_awaiting_release_bootstrap_scope_confirmation。请求仅追加前置cloud-assistant-bootstrap.sh的可信控制文件校验/分发与旧回退兜底及对应行为测试，保持云助手＋OSS方式，只允许已验证安全版本、缺失或校验失败即拒绝；不扩大为CI/CD重构。Task9全包/Task10–11、独立总评审、目标配置/真实目标请求/专业业务验收仍未通过；不执行task-done或正式启用。无新schema/生产迁移/部署、真实.env修改、旧PID722/729重启、提交或推送。

## 历史检查点 · WP01下载读取本地验证，启动装配门禁待追加

- 本轮两个读取入口追加批准已兑现（仅本地）：ResearchArtifactsService.fileContent 与 SessionsService.attachmentContent 共用内部 resource-read 当前身份/租户/authVersion、活跃组/角色/项目/成员短事务；各自指定原入口权限，未改 worker-publication 既有行为或公开API。产物仍 artifacts／artifact.export，诊断在同事务核原 diagnostic_artifacts 与显式 diagnosis_export，管理员不自动绕过；附件仍本人未删除会话、workbench／chat.use、服务端签发或精确历史消息引用，不新增Agent装备、创建者或最新版本要求。
- 产物真实 file→artifact/version 逐级核同租户/组/项目与父绑定，冻结文件字段、真实版本哈希及产物状态；附件冻结真实session归属与读取快照，旧附件原精确键/文件名的message见证在原生PG JSON包含查询中复核。stat后及getStream后重验，失效关闭本次未交付流；存储I/O在锁外。固定旧版本与草稿保持原可读资格，读取途中状态/版本变化中断；签发附件不增加必须持久化消息的条件。两份服务移除本批改动后重建SHA与上轮 c93bc94b8953ce18bca2a3a3be617d653ecf90cf4012b6dc86c1e480170ea238 / 19ff47f92c5ffcd3b358aea4d02b1109cf414ca25c38c9e5c7158f37feb83421 一致，其余既有代码保留。
- Range/同源URL、格式/存储摘要校验、保留、计费和页面保持。产物同步去重审计仍在取流前，加入stat后当前授权短事务；审计失败仍阻断取流，后续失权/流失败不删除此前合法访问审计，不把访问记录当成字节成功送达证明。会话附件不新增审计。原产物Range仍不支持后缀格式，附件后缀Range继续支持；测试按两个原契约分别断言，未改解析算法。
- 最终本地证据：两个读取链原生PG114/114，完整后端828/58/16/41/68/85/23/2各组0失败/skip（分组可能重叠），Web构建通过；原始读取121、resources39、共用授权106、认证浏览器6新回归通过。实际原ResearchArtifactsPage及AttachmentThumb、API/Controller、JWT-Cookie/Roles/StudyGroup守卫、服务和受限合成PG，两角色×两入口×正常/取流撤权8场景，最终8PNG/8WebM、0pageerror，正常下载/206 Range核对合成字节，撤权无字节交付并关闭流。附件组件只在虚拟测试模块补导出，不改源码；产物上游请求选择已持久化合成ready job，不运行实际导出生产者。仅合成对象与临时测试签名，不冒充完整导航、真实存储/渲染、目标或业务验收。证据：docs/test/evidence/2026-10-21-wp01-content-read/results.json。
- 失败过程保留：修补前6场景2正常对照通过、4撤权安全反例失败。专项初轮105包含产物后缀Range错误预期，按原不支持格式改测400而非放宽生产；106全绿后加真实父版本错配、跨项目会话及entry诊断撤权，整套114重新通过。完整回归一条旧fileContent源码正则因门禁移至内部helper失败，替换成实际服务的停用角色/摘要/同步审计故障/取流撤权行为测试后，全套重新通过，未添加假注释或放宽权限。
- 继续原Task9的W20装配核对，仅新增启动落点待确认：实际createDeploymentScope＋Nest隔离启动、受保护合成租户目录，注册生命周期哨兵对照通过、未知kind对照正确拒绝；声明已启用raw-processing但缺provider仍完成初始化并执行另一生命周期哨兵，反例Missing expected rejection、诊断退出1。真实Worker/claim/完整AppModule均未启动，不声称当前生产包实际缺provider。现仅诊断，未修改main.ts或启动装配代码；建议最小追加主bootstrap实际装配核验及必要声明，在任何Worker生命周期/认领前发现已启用消费者缺失即中止，保留原消费者、默认启停策略与业务行为。Task9: partial_awaiting_bootstrap_consumer_guard_scope_confirmation；本次两个下载链不再待批，Task9全包/Task10–11/独立总评审及正式四层验收未通过，无生产/新schema/真实.env修改/旧PID722/729重启/提交推送。

## 历史检查点 · WP01原始数据读取本地验证，剩余下载链待追加

- 本轮批准已兑现（仅本地）：DataService.rawContent 的 file/photo 在共同 tenant 短授权锁内校验当前账号/租户/authVersion、原 data 菜单与活跃组/角色/项目和成员；绑定真实 file/photo→subject→项目/组及可选访视。准备快照在 stat 后、getStream 后复核，失效则拒绝交付并销毁本次未交付流；存储 I/O 在锁外，不声称撤回已合法发送字节。
- 不增加 Agent、chat.use、上传者、删除或分析权限；当前获权的非上传者仍可读。指纹仅覆盖读取授权及实际读取字段/父绑定，不把名称、额度、无关按钮或普通更新时间当撤权。请求开始前已合法变更的记录按当前版本读取，不能把它误判为本请求途中陈旧。Range 算法、原生媒体 URL、异步去重审计、对象保留、计费、页面不变；重建修补前文件 SHA 与 44405f6adc4f1595bcec2be037c9a9e96b9a7f7321c277bae42a714503ba510b 一致，既有 softDelete 和确定性统计代码完整保留。
- 本地证据：原始读取原生 PG121/121；完整后端 826/58/16/41/68/85/23/2 各组 0失败/skip（分组可重叠），Web 构建通过。未改 RawDataPage/API/Controller，实际 JWT-Cookie、Roles/StudyGroup 守卫、DataService 与受限合成 PG，两角色×file/photo×正常/取流撤权共8场景通过，最终8PNG/8WebM、0pageerror；正常场景核 PNG 字节/206 Range/无 scope header 原生 URL 和旧无查询参数 URL。使用临时测试签名密钥和合成对象流，不等于完整导航、生产存储或业务验收。共用 resources39 与授权106新回归通过，认证浏览器结果见本轮归档。
- 过程失败如实保留：首轮原生夹具用了不存在的 tenant disabled，且未等异步审计落库；只修测试。修补后首轮115中109通过，6项对“请求开始前合法版本变化”的错误拒绝预期被修正，补跨项目父对象后整套121重新通过，不拼接局部结果。浏览器初稿缺闭合符、上下文未通过原客户端设置、无关处理任务详情未装配，均保留失败日志；只修测试壳，改为合法未处理上传样例，原页面及权限不变。证据：docs/test/evidence/2026-10-21-wp01-raw-content-read/results.json。
- 按原 Task9 清单继续盘点，新增两个独立读取链实证但尚未修改：ResearchArtifactsService.fileContent（产物文件下载）和 SessionsService.attachmentContent（会话附件预览）。各合法对照通过，stat 和 getStream 期间撤销成员后仍各返回流且未关闭；6场景中2对照通过/4安全反例 Missing expected rejection，诊断退出1，不能算绿色门禁。两方法与当前既有源码保持，仅留诊断；此前产物导出 Job、消息执行提交等批准不等于批准这些独立下载链。建议统一最小追加当前原入口授权、真实文件/产物版本或会话/附件引用父对象、读取快照重验及失效时未交付流释放，保持各原权限、诊断显式授权、Range/同源 URL、审计、数据保留、计费和页面。
- Task9: partial_awaiting_remaining_content_read_scope_confirmation；本次 rawContent 不再待批，下方旧“原始读取待追加”仅为历史。Task9全包、Task10–11/独立总评审、目标配置/真实目标请求/专业业务验收仍未通过，不执行 task-done 或正式放行。无新增 schema/生产迁移/部署、真实 .env 修改、旧 PID729/722 重启、提交或推送；真实模型/对象存储/外部网络0，未读临床内容。按用户范围纪律，仅为这两个新独立链停线确认。

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

## 历史检查点 · WP01独立质控整改重检本地验证，科研情报提交待追加

- 本次批准已兑现（仅本地）：DataQualityRemediationService.execute、claimDataQualityAttempt及成功／失败提交在受限RLS与共同tenant授权锁中重验当前账号/租户、组/角色/项目成员、原workbench＋remediation.retry与research_methods_worker；真实attempt→case→gate→sourceRun/session/agent→recheckRun绑定与行锁、startedAt/输入/父版本/运行状态准备指纹阻断旧执行。合法非创建者仍可执行，不增加chat.use、Agent装备或创建者资格；算子/manifest装配在锁外，结果、门禁、案件、尝试、事件、审计同tx。撤权/状态版本/提交异常直接中断，不写第二个failed或自动重放；不增加队列、租约、schema，原确定性算法、权限资格、人工审核、计费与页面不变。
- 本地证据：独立质控整改PG92/92、聚焦单元24、专业方法专项136、完整后端各组824/58/16/41/68/85（分组非去重，无失败/skip）及Web构建通过；原质控页面科研端/管理员端各成功＋撤权共4场景通过，4PNG/4WebM、0pageerror。实际页面/API客户端/Controller DTO/createAttempt/认领/提交使用真实受限PG，可信合成actor＋固定数值Worker及无关列表适配不冒充HTTP Guard、真实Python效果或专业验收。授权/RLS/认证回归及完整日志、失败过程与指纹以docs/test/evidence/2026-10-21-wp01-dq-remediation/results.json为最终台账，不把中间通过数当最终结果。 旧授权106、RLS基线12与Chrome认证6也通过；认证4PNG/2WebM、0pageerror/2条预期401，RLS12不代表Task9资源全包。
- 自动续Task9新增独立范围：ResearchIntelligenceService.runSubscription合成PG正例生成1条线索/1条审计并推进游标；在受控公开来源响应期间撤销成员后仍生成同样内容，订阅暂停/version升至2后也仍生成线索并推进游标，来源失败且已撤权仍写lastRunAt/SOURCE_FAILED。4场景中1正例、3安全反例失败均保留，不计入质控绿测。该独立情报服务与HEAD一致、未修改；建议另行批准runSubscription成功/失败/去重提交的当前授权、真实订阅归属、状态/版本防重及原子提交，保留公开检索、去重规则、权限、人工审核、计费与页面。等待这项新范围确认，不重复询问本次质控批准。
- 本批仅本地代码/合成PG契约；Task9为partial_awaiting_intelligence_publication_scope_confirmation，Task7整体资源/其他类别独立OS、Task9剩余资源封口、Task10–11及全包独立总评审/目标配置/业务验收未完成。未部署、生产迁移、修改真实.env、重启旧PID729、提交或推送，不新增客户/updates上线记录。append-only整改事件保留精确标记合成夹具，不禁用触发器；测试进程仅将已核验localhost地址固定为同一127.0.0.1回环，不改源配置、不静默重试。

## 历史检查点 · WP01专业方法提交本地验证，质控整改重检待追加

- 本次批准已兑现（仅本地）：ResearchMethodsService.executeCreatedRun／advance在受限RLS＋共同授权锁内重验当前交互请求者、有效组/项目成员、原workbench＋chat.use、真实run/session/agent及已装备的同版本发布Skill；官方Skill按official→tenant锁顺序复核。准备状态/输入/术语摘要及updatedAt快照、run行锁与条件更新阻断旧执行覆盖；复核者合法重跑不限制为原创建者，不信任过期管理员标志。原事实准备/算子在锁外，结果/终态及必要质控门禁、整改案件/事件/审计同tx；撤权/版本/提交异常直接传播，普通执行失败保留原契约，已提交但确认丢失不改写failed、不自动重放。未新增claim/schema，算子、权限资格、人工审核、计费与页面不变。
- 最终本地验证：专业方法PG67/67，聚焦41、专业方法专项134，完整后端各组824/58/16/41/68/79无失败/skip（分组非去重），Web构建、授权106及RLS资源基线12通过。新浏览器质控3项（3PNG/1WebM）＋认证6项（4PNG/2WebM）通过，0pageerror，认证2条预期401；质控用未改页面/API客户端、实际Controller DTO与执行提交、真实受限PG，可信请求接纳适配器/固定数值Worker夹具及无关空列表，不冒充公开接纳、HTTP Guard、真实Python算子或专业验收。证据：docs/test/evidence/2026-10-21-wp01-method-publication。
- 续Task9独立新缺口：DataQualityRemediationService.execute→claimDataQualityAttempt→recordRemediationRecheck／recordDataQualityRecheckWithTx不经过上述普通运行链。合成PG正例先通过；计算响应前撤销成员后仍新增needs_review结果/1条计数证据、门禁version=2并将案件closed、尝试succeeded，无拒绝。使用固定数值响应只验证提交漏洞，真实模型/远端Worker0；独立消费者及RemediationCasesService生产代码与HEAD一致、未修补。当前仅这条整改重检认领/成功/失败提交的当前授权、真实父对象/版本及原子边界待追加批准，不重复确认普通专业运行或已批上传/Worker。
- 本批仅本地契约，不代表WP01整体或目标配置/业务验收；Task7资源/其他类别独立OS、Task9–11及全包独立总评审未完成。旧PID729未重启、无真实.env修改/新增schema/生产迁移/部署/提交/推送；不新增客户上线记录。原生append-only整改事件按规则保留对应精确合成夹具，不禁用触发器或删除历史，早期测试/构建/连接故障与最终成功分开留痕。

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

## 2026-10-21 · 知识工具与问答提交通过本地验证，科研证据链新增范围待确认

- 用户追加批准Orchestrator／RuntimeContext／KbTools内部上下文及创建、编辑、附件导入、去重预检四类提交校验；已兑现，不再等待该范围批准。内部WorkerExecutionContext仅后台注入，控制器/模型参数不接收；Sessions→RuntimeContext→Orchestrator→KbTools→Knowledge贯通。
- 工具开始前及实际提交时重建当前身份、组/项目成员、Agent、活动配置与本工具权限、KB写权限和claim。创建/附件导入先锁外准备后一次提交，编辑连同旧版本、文档、索引、审计同tx，去重预检的计划/快照/审计同tx；不增加工具、不改变审核/用户确认、同步路径或页面。新建仍保留原create→edit两条审计及空白旧版本，不靠删除工具规避风险。
- Task6队列按scope扫描/领取/恢复，120秒DB租约、15秒心跳及持久token/owner约束；外租户不消费，过期新claim保守失败不重放，旧NULL claim活动任务不按updatedAt误杀。实际Sessions把回答/引文meta/用量/额度结算调用/trace/审计与问答终态CAS同事务；最终重验本轮实际尝试的工具权限，失权不生成新回答/产物，已入队用户消息及此前合法内容保留。会话软删/合并也同共同锁与受限RLS事务，审计失败整体回滚；真实Provider已耗用时继续原对账流程。
- RED→GREEN：原四工具失权/失token仍写、审计失败半提交及并发版本覆盖均已复现后修补；另补角色工具权限/活动配置撤销、最终消息失效、删除/合并锁等待与回滚。CLI chat聚合PG48/48（工具30＋队列与实际Sessions18），实际长问答126247.04375ms；导入回归14/14，长导入126400.263666ms；授权106、资源12通过。后端全量各组824/58/16/41/68/46无失败/skip，Web构建成功，非唯一用例总数。
- 新Chrome认证6/6、4PNG/2WebM、0pageerror/2预期401，仅证明现有旧Web认证回归，不冒充KB工具UI、真实模型/解析、独立OS双Worker或ResearchHub目标验收。本地测试只使用专用合成PG；真实Sessions采用受控已知用量fixture，实际模型/网络调用0，不能把known字段当真实AI执行证据。旧PID729/3001健康200、启动时间不变；无提交、生产迁移、真实配置修改、部署或正式Worker启用。
- 自动继续Task7预检时出现清单外实证：公共门禁拒旧research-run claim，但真实ResearchEvidenceService.run仍写出可见completed证据运行1条；使用受控空检索1次、无真实网络/模型、无报告。SkillInvoker把WORKER_CLAIM_LOST转普通failed结果，科研编排会当底座故障走降级。需追加ResearchEvidenceService.run内部检查点与run/items/检索策略/计数实际提交，以及SkillInvoker和科研编排中内部执行失效的中断传播；不得改检索能力、科学筛选、人工审核、计费语义或页面。尚未修改ResearchEvidenceService、SkillInvoker和科研编排分支，Task7实施停在此新增范围；Task8–11未完成。
- 证据：[本轮结果](../../../../docs/test/evidence/2026-10-21-wp01-kb-tools-and-chat/results.json)，[浏览器记录](../../../../docs/test/evidence/2026-10-20-wp01-kb-tools-20261021-pg-browser/result.json)。本轮Task6仅complete_local_worker_contract，WP01整体及四层业务验收不标通过；以下保留历史检查点。

## 2026-10-21 · PI最小修补与Task 5本地验证完成，工具副作用接线待确认

- 用户追加批准PiGovernanceService.changeMember：生产仅新增共同锁helper import及现有tx内的一次锁调用，顺序为tenant共同锁→原项目锁；成员权限、最后一位负责人保护、审计、响应及页面不变。锁顺序单元先RED，真实PG8中等待反例先RED后GREEN，覆盖并发只剩一位负责人、审计回滚、跨项目拒绝和完整审计/响应契约。
- Task 4已继续完成七套串行聚合authorization门槛106/106：当前授权21、发布37、Agent17、Subject7、原始file/photo12、Onboarding4及PI8；本地授权/发布原语门槛通过，不当作实际消费者或目标环境验收。
- 按原计划继续Task 5：disabled/foreign导入先失败测试，再接部署scope、queued持久claim、当前actor/真实KB/source/父文档校验、15秒心跳/120秒DB租约和保守恢复。旧无claim活动行不重排，过期新claim失败保留来源；进度、终态和失败均约束owner/token，未知外部结果不自动重放。
- 索引准备不写可见DB：解析/Embedding在锁外，版本/hash/归属复核后，同tx创建导入文档、原件引用、全量chunk/绑定向量及终态CAS。手工重建复用prepare/publish；二次审核同tx发布索引、审核标记、审计，并重核准备返回后的当前审核权限。保留原解析算法、身份标识确认、审核资格和关键词降级，不改前端。
- Task 5 RED包含索引单元4项、导入scope单元2项，真实PG的审核审计回滚和手工审核撤权；长部署ID使owner超长另有真实claim输入验证RED，改用随机UUID实例标识后验证。最终导入PG14通过，含实际pgvector参数写入、两实例只解析一次、撤权/旧owner零新草稿/引用/chunks、部分写故障旧索引完整保留、官方显式opt-in、恢复不重放及超过120秒的生产参数心跳。没有伪造解析或向量外部服务执行证据。
- 最终后端824/58/16/41/68/41各组通过且无skip，Web构建、授权106/资源12、Chrome认证6通过。浏览器新4PNG/2WebM、0pageerror/2预期401；仍是旧Web认证回归，不是PI/导入新界面、独立OS Worker或AI业务验收。旧PID729/3001健康200、启动时间未变，未提交/部署/启用Worker。
- Task 6接口核对的新增范围已实证：旧知识问答claim经共同发布门禁正确拒绝后，实际KbToolsService.execute(kb_create)仍能新建可见待审草稿1篇。OrchestratorService工具循环没有向KbToolsService传执行上下文；kb_update、附件导入及去重预检也有独立副作用，不可只保护最终assistant消息。诊断明确退出1，无模型/文件调用。建议追加OrchestratorService、RuntimeContext、KbToolsService及其既有Knowledge工具提交点的最小接线；保留工具能力、权限、审核/用户确认、同步请求语义及页面。相关工具/编排生产文件未修改，待用户集中批准后进入Task 6，不静默关闭工具或绕过验收。
- 证据归档docs/test/evidence/2026-10-21-wp01-pi-and-import；浏览器沿用原脚本日期前缀，分别在2026-10-20-wp01-pi-member-20261021-pg-browser与import-20261021-pg-browser，实际运行日期均为2026-10-21。产品living spec、使用说明和版本记录同步，以下旧待确认状态均为历史检查点。

## 历史检查点：原始file/photo软删除获批修复，PI成员撤权新增边界待确认

- 用户追加批准DataService.softDeleteRawItem现有file/photo两分支；已复用共同tenant锁及受限RLS事务，范围/创建者核验、软删除与只追加审计同tx。原权限、raw kind限制、幂等、响应字段、数据/对象保留及页面不变；无迁移、存储清理或其他PhotosService改动。
- RED：新单元8中2项审计回滚失败，真实PG12中4项失败（两分支锁等待与审计回滚）；最小补丁后单元8/8、原有删除回归共15/15、PG12/12通过，无skip。旧Data三项夹具仅适配withTenantTransaction/createMany接口，不改变原断言。
- 全量后端824/58/16/41/68/33各组退出0；Subject7、授权21、发布37、Agent17、资源12和Web构建通过。Chrome认证6通过，新4PNG/2WebM、0pageerror/2预期401；仅认证回归，不冒充删除界面或真实Worker端到端验收。旧PID729/3001健康200未重启。
- 通过后已继续原计划，补齐ProjectOnboarding.configureMembers真实PG4项：撤成员先提交零任务产物、发布先持锁成员变更等待、审计失败成员/PI/版本同回滚、版本冲突及幂等重试；保留生产Serializable与CAS。首次夹具指纹不符合原生CHECK，仅修合成输入为SHA-256，未放宽约束。
- 继续完整写点核对，实证另一清单外入口PiGovernanceService.changeMember仅持tenant:project旧项目锁，未参与wp01:tenant共同锁。真实合成PI成员停用在发布持锁时先提交，随后任务result仍提交；诊断明确退出1。该生产文件与HEAD一致，未修改。建议只在其现有事务先取共同tenant锁再取原项目锁，保留最后一位负责人保护、成员权限、审计、响应和页面；新增包外范围须用户确认。
- 当前切片本地验证通过，不等于Task 4/WP01完成；完整authorization runner仍拒绝未实现，Task 5–11未越过门槛，未提交、部署或启用Worker。证据归档docs/test/evidence/2026-10-20-wp01-raw-item-soft-delete和raw-item-soft-delete-pg-browser。以下为历史检查点，旧Data待确认记录已由本次批准与验证取代。

## 2026-10-20 · 被试软删除获批修复，原始文件删除新增边界待确认

- 用户追加批准SubjectsService.softDelete并要求自动续行；该方法已复用共同tenant锁/受限RLS事务，核验、状态和追加审计同tx，不改变所有权、软删除保留、幂等、响应或页面。
- 新单元5与真实PG7通过（锁等待/审计回滚先RED；撤权后零新增结果、合法先发布结果保留、失败与审计仍可保存）；全量824/58/16/41/68/25、当前授权21/发布37/Agent17/资源12、Web及Chrome认证6通过。4PNG/2WebM，0pageerror/2预期401；认证回归不代替被试删除UI或Worker业务端到端。
- 继续原计划父资源写点核对时，发现另一个清单外入口DataService.softDeleteRawItem；真实合成probe复现file删除先提交后仍发布结果，明确退出1。DataService生产源码与HEAD一致，未修改；建议仅该方法file/photo共用同锁/同事务/审计及对应验证，保留kind/所有权/存储保留和页面规则，待新增确认。
- Task 4仍未整体完成，ProjectOnboarding专项竞态、全写点与Task 5–11待继续；不启用Worker或发布生产。记录及hash在docs/test/evidence/2026-10-20-wp01-subject-soft-delete，旧进程与旧库/角色/配置/目录不动。以下是历史检查点。

## 2026-10-20 · 当前授权与发布核心已验证，新增被试软删除撤权源待确认

- 用户要求自动续行，已按计划实现当前actor/五模型真实父对象、官方例外和共同锁发布原语，接入Tenant/Account/成员角色/功能开关/Knowledge等已批变更；ProjectOnboarding保留Serializable/CAS，仅新增共同锁。
- 本轮PG当前授权21、发布核心37、Agent17、资源12、后端全量824/58/16/41/68/20及Web构建通过；Chrome认证6通过，新4PNG/2WebM，0pageerror/2预期401。仅局部真实事务与认证回归，不冒充Worker双进程、完整产品UI、生产或AI验收。
- 官方owner状态变更及知识引用发布先official后tenant，纯普通发布仅tenant；实际capability/feature/引用/Skill由服务端清单在锁内核验，不制造新业务权限规则。
- **新增确认：** 未改SubjectsService.softDelete；独立合成诊断真实复现它可绕过共同锁先提交，随后任务仍发布可见结果，诊断退出1。建议只补该入口同锁/同事务/审计及回滚/双向barrier，保留所有权、软删除、关联数据保留和页面规则。完整authorization套件继续拒绝，Task 4不标完成，Task 5–11不提前开始。
- 当前报告与证据：docs/test/WP01-Agent授权事务切片验证-2026-10-20.md及evidence/2026-10-20-wp01-current-authorization；旧PID729/3001的/api/health=200且未重启，不改旧库/角色/配置/生产/目录。以下为历史检查点。

## 2026-10-20 · Agent启停追加获批，五入口局部验证通过

- 五个Agent授权/启停入口均已获批并完成本地同锁/同事务验证（真实PG17，含启/停双向回滚和锁等待；全量824/58/16/41/68/12、资源12、认证浏览器6及Web构建通过）。本次启停扩围无剩余确认项；完整当前授权/最终发布及Task 4整体仍未完成，正式任务不得启用。
- 仅为AgentsService.update复用已有共同事务helper，审计只追加不RETURNING；启/停各自回滚和锁等待先RED后GREEN，名称/描述/返回值与跨租户拒绝兼容。无新增依赖/配置/模型或页面修改。
- 本轮新4PNG/2WebM、0pageerror/2预期401；认证浏览器回归不代表完整授权操作UI或最终发布验收。旧服务PID729/3001未重启、health200；旧库/角色/生产不改。
- 最新证据在docs/test/evidence/2026-10-20-wp01-agent-toggle及agent-toggle-pg-browser；原四入口阶段证据保留。以下阶段记录为当时历史状态。

## 2026-10-20 · Task 4四入口获批并局部验证，启停入口待确认

- 四个Agent/Skill授权入口已获批并完成局部同锁/同事务验证（真实PG11、新单元5、全量824/58/16/41/68/12、资源12/认证浏览器6及Web构建通过）；新增AgentsService.update的enabled启停入口待最小范围确认，未修改。完整当前授权/最终发布及Task 4整体未完成，不进入Task 5–11或启用正式任务。
- 四个真实锁等待/四个审计失败回滚先RED，最小修补后GREEN；审计改为只追加不RETURNING，不放宽原生RLS。
- 新4PNG/2视频独立留证，浏览器仅认证回归，不冒充四个授权操作产品UI或最终发布验收。旧服务未重启，不修改旧库或生产。
- 详见[本轮报告](../../../../docs/test/WP01-Agent授权事务切片验证-2026-10-20.md)。以下批次状态为当时历史记录，以本节最新检查点为准。

## 2026-10-20 · Task 3本地原语通过，Task 4范围待确认

- 五模型nullable expand仅完整合成库执行，新旧Prisma读写、旧原生对象/旧库catalog不变已验证。
- 最终CLI claims24/24，含126.39秒长任务/8次续租、两个真实行锁等待过期反例、会话互斥及父run合法修订；原语单元7及全量分组824/58/16/41/68/7通过，资源12/浏览器6及旧Web构建通过。
- 未接入实际消费者、独立双进程、生产或AI业务验收；旧3001 health200且未重启。Task 4预检发现AgentsService四个Agent使用权/Skill装备变更入口未列原清单，按计划新撤权源先报告，未修改该模块或Task 4代码，待最小扩围确认。
- 独立全包总评审仍在Task 11，不把本次自检当独立放行。以下各批历史记录按时间留存。

## 2026-10-20 · 完整结构库获准并通过本地门槛

- 用户明确追加授权后，新建wp01_test_full_baseline，仅PG16 schema-only恢复；169 CHECK/17触发器/124 RLS及完整目录/权限通过，业务授权437项另迁移表4项，旧库与原局部库保留。
- 新原生工具26/26（含精确AND括号特例拒绝阈值变化）、资源12/12、动态保护5/5、全量824/58/16/41/68、Chrome6/6通过；新4PNG/2视频，0pageerror/2预期401。
- Task 3仅验证库执行15 nullable列/5索引，旧原生对象和旧库catalog不变，新旧Prisma客户端读写通过；原语/并发/实际长租约测试进行中，未启动消费者或部署。
- 以下门槛重开/待新增库授权记录为前一阶段事实，不再代表当前等待状态；旧checksum异常仍未通过正式发布门槛。

## 2026-10-20 · Task 2 真实PG与合成夹具

- **追加门槛：局部通过不代表完整原生基线。** 后续只读复核发现缺169个CHECK、17个触发器/HNSW，app权限比旧库多7项，夹具也有不符合原生域值的输入。Task 2环境门槛重新打开，Task 3未写代码/执行迁移。
- 建议新增`wp01_test_full_baseline`做完整结构验证，不复制业务行、不改旧库/历史迁移/角色，不重置当前验证库；新增库待用户确认。详见权威报告及native-baseline-gaps.json，不把校验和改一致来掩盖旧历史差异。

- 用户授权现有本地实例新建专用空库，并要求无确认项自动续行；已完成受控schema/RLS、68条合成记录、误连/清理保护和catalog对照，未改旧主库数据或生产。
- 工具单元42、真实PG资源子套件12、真实PG浏览器6项通过；全量组824/58/16/41/42及旧Web构建通过。浏览器为同一OS进程内两Nest app，不冒充Worker双进程；0 pageerror，2条预期401错误保留。
- 夹具ID契约先RED，仅清理本run68条后重建兼容ID；真实PG provider接线也先RED后补test harness。生产认证/前端UI未改。
- 权威证据与消费者台账见[环境记录](environment-evidence.md)。Task 3–11继续按批准计划串行；全包总评审、正式环境与业务验收仍未完成。

## 2026-10-20 · Native实施首批

- 用户确认实施计划与主实现串行＋独立总评审；先写行为红测，再修部署scope、登录/Guard、独立Cookie及Tenant控制面。
- 原回归824/58/16组通过；本批最终包级41项、旧Web构建及6项新浏览器检查通过。真实Nest/旧前端/Chromium，DB为合成适配器，未验证真实PG/RLS。
- 独立总评审发现同模块主题控制面Important，补GET/PATCH先红后修后全量通过；测试初始化失败时资源清理Minor保留。完整证据见[首批记录](../../testing/wp01-shared-boundary/report.md)。
- 未提交/推送、未迁移、未读取真实.env或患者行，未启用Worker/生产。UI既有改动保留，不借之前UI测试证明共享隔离。
- 用户选择已有专用测试库，稍后提供安全配置路径；Task 2–11未实施，路径/保护就绪前不连接或新建环境。以下为历史文档阶段记录，不再代表当前未写代码状态。
- 18份本轮文档已同步Notion并读回：14份来源镜像、旧系统4份既有长文档仅增量同步本次WP01段并保留历史章节。源hash/段落hash及模式见notion-sync.json；不把段落同步称为历史全文逐字校验。

## 2026-10-20 · 用户批准规格

- 用户明确回复“确认批准这份 WP01 规格”，D01推荐A及包级技术边界已批准；历史草稿阶段记录保留如下，不再作为当前待批状态。
- 已更新规格、产品基线/变更及一期入口，新增implementation-plan.md；实施计划与执行方式待评审，尚未进入代码实施。
- 当前仅文档核对/同步：没有新增或执行WP01测试，没有修改运行代码、数据库、Worker配置或生产部署；G0/G1仍未通过。
- 11份关联文档（含未改动的测试矩阵和新实施计划）已按既有页面ID/目录同步Notion并读回批准状态、计划链接及源hash；新增计划页面一次。文档链接14处与11项任务结构核验通过，不算业务测试。同步映射见notion-sync.json。

## 2026-10-20

- 已限定本轮为WP01书面规格评审，不恢复UI整改或WP02等实现。
- 已读取适用开发/规格/安全边界指导，核对总体方案、准备清单和实际Auth/Prisma入口。
- 保留当前目录全部未提交改动；未修改运行代码/数据库/配置，未启动后台任务。
- 新测试、真实DB双实例与浏览器验收均未执行；本轮不得用前一轮35项前端测试证明WP01隔离。
- 主规格spec.md与20项test-design.md已成文，更新产品基线/变更、文档入口和一期WP01链接；推荐单租户账号独立登录保留为待确认D01。
- 独立只读评审完成，已收口五模型过期恢复、完整安全回退版本、官方null查询/事务、撤权串行口径与既有合法产物保留；没有为评审运行任务或数据库。
- 10份本轮文档已按原ID/对应目录同步Notion并读回核对源hash；映射见notion-sync.json。用户尚未批准书面规格，D01账号策略待确认，不进入实现阶段。
- 本轮验证仅文档链接、20项用例完整性、差异空白和同步内容；没有新测试、业务代码修补或G0/G1通过结果。
