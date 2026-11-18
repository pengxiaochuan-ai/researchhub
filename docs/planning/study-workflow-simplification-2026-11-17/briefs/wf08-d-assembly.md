# WF08 D · 目标装配及原页衔接（设计预备，C后编码）

2026-11-18实际科研身份复验发现：已放行快照可读、没有再次放行权；受试者编号显示请求403（DATA_IMPORT_PERMISSION_CHANGED）却经共用client的onAccessLost清空计划，卸载开始确认框。此为辅助显示错误污染主流程。PlanDetail的编号读取采用独立、可取消的只读client；403只显示编号暂不可核对，401触发现有登录核定。计划、快照、计算、写入及其权限/来源检查继续用原权威链，不放宽编号接口或增加权限。原失败与零写记录保留，使用新manifest版本核定同一Job4/Job5，旧manifest不覆盖。

同日结果往返实测发现Methods已有runId的只读结果页调用了不属于该adapter的preview方法。自动预检仅适用于提供preview能力的新计划上下文，已有runId不自动预检；原数据放行/计算/结果审核入口与权威链不变。实际浏览器异常及两条adapter回归RED保留，修复后重新验证结果往返。

2026-11-18。C代码与限定PG门禁已独评通过（actual-acceptance-review-v4 SHA d1f45ccbacdd1ea9e05a6edf5f7b10cac0a54f2c61993a4ed96a5af70b76674a）；进入同一WF08 D源集成，完整39项、跨批/清理/失权/实际重启仍是D必验。未持久迁移/启用consumer，不提前开发WF09–12。B实际PG三例已独评通过，未持久迁移/HTTP/真实Worker/跨进程/页面验收。

## 具名边界与真实生命周期

优先在`research-creation-local-integration.mjs`、`local-research-analysis.mjs`、`local-full-study-simulation.mjs`内组合一个Job runtime；`server/research-studies/controller.mjs`只接纳/读取/停止路由及Nest生命周期，不改共享`local-knowledge.mjs`主入口。必要窄新`local-analysis-jobs.mjs`或产品runtime/ordinary bridge，禁止另起通用队列。

两分支Methods使用同一consumer adapter与canonical issuer。沿core已有`createBranches({adapter})`回调，在回调内调用原本唯一`createAnalysisServices(studies,{jobAdapter:adapter})`，两个local factory将adapter作为Methods第6依赖，并返回真实ordinary/full branch；不需要另造委托adapter或延迟bind框架。外层local integration保存本次服务并组合jobs/lifecycle，交controller。onModuleInit必须完成schema/候选配置预检并start，onModuleDestroy await stop，现host的`await app.close()`沿用。数据库仅根显式迁移，启动不DDL。缺新schema/marker、空allowedTenant、分支缺失或consumer失败明确不可接纳，不能202后静默遗留。旧chat queue不注册、不启动其onModuleInit。

新增窄`server/research-analysis/job-authority.mjs`复用实际factory闭包中的core/analysis/Methods（不是按第二参数选Study的dispatch proxy）。接纳只读固定来源/ready child/版本/hash，current operator复用public Methods接口；停止资格复用current core.authorize+原operator。Methods与full guard所用adapter在原beforeLocks成功后，同物理事务补当前ResearchHub准入assertApproved：原生内核不依赖Hub表，不能只在接纳时看一次准入，而漏掉准备、派发、发布和清理时已撤销的Hub资格。该包装不授新权限、不读lease、不改core租约，失权只控制面blocked，不能写科学失败。

core当前未暴露read-only健康状态，D需窄只读`availability`或`assertAvailable`（不可调用会派发的tick当健康检查）。未start/start中/stop中/后台poll失败均不接受新意图；已存在原键重读、Job/receipt GET和取消接纳不受健康门禁抹除，取消仍只承诺失效旧代与等待结算。读状态说明原任务已保留及服务暂不可用。新Job在原事务INSERT前再次核read-only健康；后台失败后不能继续202却无人消费。该变化只D增量冻结，不篡改B/C已验快照。

## 对外只读与准入

沿A固定五类路由：create 202、job GET、admission receipt GET、cancel POST、cancellation receipt GET；保持Origin/原认证/请求大小/版本0和Study范围。查回不执行claim/Worker/写审计。`jobs.read`现view仅status/result，无进度、错误或取消资格，D需最小扩安全DTO：数量只由本Job固定target与实际原生状态/发布证据导出，未知不充已完成；安全code映射用户可读原因，绝不泄露lease/token/operator配置/原数据。取消资格使用原生当前权限独立核定，可读不推出可停；GET不能执行取消或补finished。

进度建议只给总目标/已生成/未开始或处理中/失败/已停止等有原生事实的计数，明确不适用未进入target。已生成含needs_input仍须如实标待核对，不写“全部成功”；不可编造百分比、预计秒数或把发出HTTP当已发布。GET只读metadata，不为每次轮询重新构建全部临床数值；原dispatch/publish及回看数值的来源校验保持。

D公开DTO沿A既有job字段，只增加：`progress:{total,published,unfinished,failed,cancelled,needsInput}`、`capabilities:{canRequestCancellation:boolean}`、`serviceAvailable:boolean`、`issue:null|{code,message}`。总数=已生成+未生成+失败+已停止；needsInput是published子集，不重复计数。每项只按固定Job target/Run-marker/原发布审计事实归类，runId仍null属于未开始，已绑定Run缺失或错marker则明确不可核，不猜状态。Native失败状态仍计事实，但全局受阻时unfinished呈“未生成”，不声称仍在计算。issue为服务端安全code映射的用户语句，不转发raw异常或SQL。

接纳202及admission receipt仍为`{studyId,job,receipt}`、Job GET为`{studyId,job}`；原receipt action/target/requestHash/authVersion不变。取消及取消receipt沿A`{studyId,jobId,status,receipt}`。深链用`analysisUrl(studyId,{jobId})`，jobId不混作runId/groupId；currentReader的停止意图另绑其actor/version/Study/job，不能借原作者start marker冒充。源及客户端实现可在C代码冻结/独评后独立推进，目标迁移/启用与实际E2E仍在C技术门禁后串行执行，不并行开发WF09–12。

停止请求资格由真实factory闭包中的core.authorize（当前Study data.analyze/formal/admission）与public authorizeDescriptiveJobOperatorInTransaction(expected原operator)同tx核定，GET能力与POST共用；不调用另开事务的getDescriptiveCapabilities、不按可读或默认owner推权限。实际Native结算仍核Session/source/CAS。失权或来源受阻保停止事实，未发布Run可能保原queued/running审计状态；UI须以Job终止/受阻事实说明“未生成”，不能只按Run旧状态称仍计算。原运行若有Job关联提供安全原Job回看，不隐藏历史或制造重试成功。

原Native `actionCapabilities`当前对Job绑定Run仍可能报canCancel=true，而旧cancel已受围栏禁止；D需一并最小纠正该只读能力（Job关联时旧canCancel=false、原canReview保持），并提供原Job安全链接。必要具名`app/server/src/research-methods/formal-descriptive-runs.ts`及其定向测试作为D独立增量，不改B/C已冻结版本证据；不能只隐藏前端按钮而留服务端错误可用声明。full group同理不显示旧process/cancel绕过入口，停止只走Job意图。

数据放行权与计算权分离：原合并入口仍先明确放行；对已放行固定snapshot，compute-only用户应在原方法页直接确认“开始分析”，无需重放行或重填理由。复用固定来源与Job接纳，保留旧未知Native意图的只读核对，不因新receipt404再建新Job。既有结果/快照/group无新意图不显示不会结束的预检spinner。

公开接纳仅普通标准snapshot→ordinary与full root→full。full child是整课题内部target，不单独建Job；full Study现有公开run读取/审核由group service负责，单独开Native Run会形成无结果衔接的新粒度，非本轮扩展。后台明确409 `ANALYSIS_JOB_FULL_ROOT_REQUIRED`；S06若实际读到full child，按manifest/rootSnapshotId/schemaVersion识别并给“返回整课题分析”，不显示可确认的单项启动、不硬编码Study ID，也不自动换root发起另一任务。

Full S05已放行ROOT同样可直接一次确认接纳，不重release/不填理由；这与S06禁止full child单项是两件事。旧full canCreateRun管理员hint不作为新Job计算授权，实际core原本允许data.analyze科研角色；新Job仍在服务端逐次核当前角色及operator。组合放行始终保canReleaseSnapshot。

## 客户端与页面

具名`src/analysis-start-session.js`及相关marker/测试、`pages/shared/useAnalysisStart.js`、`AnalysisStartControl.jsx`、`FormalAnalysisWorkspace.jsx`、`FullStudyAnalysisWorkspace.jsx`和原方法工作台。按实际需要扩`src/formal-analysis-session.js`严格jobId深链/当前Study绑定；不改Shell或导航。

明确区分原WF07同步marker和新Job策略/版本，绑定actor/authVersion（0合法）、Study/URL/plan/review、放行snapshot与原admission key。202及精确回执确认后关闭原分析确认框，在原工作区域展示后台状态、真实结果和按权停止。纯进度GET不dirty、不续会话；真实未保存输入、在途写及unknown仍保防丢失。刷新/登录/离页仅GET，404不自动换key或重发POST；显式续办沿原键原体。取消单独明确判断，未知原取消receipt核定；取消请求接受只说“停止中”，已发布结果保留，不能说Python已被杀死。

## 目标与四层

C冻结/独评及真实PG门禁通过后，根另写显式迁移/fixture marker与5新Job的资源预算。旧591/155、原V3 partial、旧科学/Word/旧权限来源均保护。实际验证ordinary和full原生Worker计算、接纳丢响应只读找回、离页/刷新/重新登录、真实未完成切点SIGKILL及120秒租约后恢复、已发布目标不重算、取消与迟到200、仅新授权关系/新计划的撤销。真实跨进程证据不能由B的单连接代际模拟代替。

沿两角色/五宽/native200、键盘/Esc/焦点、PNG/WebM与原始审计核数量。只读身份稳定与本页请求成功后截图。根保护读、独立终审、产品living/统一用户手册/基线/版本/技术测试与Notion同步后才整体封板，直接进入WF09。


## D 接纳与 Controller 内部接线增量

`createExecutionJobs`仅新增内部可选`presentInTransaction(tx,actorBoundScope3,sScope4,row)`与`assertAdmissionReady()`；缺省保持A原baseDTO和receipt合同。present在原Study授权事务内await，principal的group/project从当前Study context绑定而非JWT当前选中组；create/receipt/read不另开事务、不推进Native。原key先核原hash与authVersion再只读present，consumer不可用不挡原事实、原receipt或取消；只有newJob在heavy source前和紧邻audit+insert前各检查一次只读健康，未ready明确503且原tx没有接纳audit/Job。

`createAnalysisServices`可返回`jobs`与`jobLifecycle`，Controller的Nest init/destroy只await该生命周期start/stop；无分析装配的旧controller可noop，实际root factory缺schema/marker/配置须在构造/启动显式失败，启动不做DDL。新增5条原认证/no-store路由：POST `research-studies/:id/analysis/jobs`为202；GET `jobs/:jobId`与`job-receipts/:requestKey`；POST `jobs/:jobId/cancellations`为200；GET `jobs/:jobId/cancellation-receipts/:requestKey`。GET只接受空query；POST沿原Origin/256KiB保护，业务only仍由A服务校验。其他POST状态码、旧同步runs/process/review/report路径不变，不开放force/resume/消费接口。本增量不启动服务、不迁移、不重载；实际root组合与目标四层另验。

## 实际整课题入口校正：隐式预载不代表固定源选择（2026-11-18）

Job2真实plan-only页面自动预载旧snapshot后，D hook把该snapshot当作用户明确选定，始终给“开始分析”，覆盖已批准的计划合并动作；原“核对快照来源”仍保留snapshot，无法恢复合并路径。实际browser无错误/无写，但脚本等待“确认数据并开始分析”超时，原截图及GET保留。这是D上下文选择P2，不回退产品以迎合测试，也不强迫用户走两步放行。

最小校正：Full plan-only（URL没有snapshotId/runGroupId/jobId）保持新意图snapshotId=null，按当前approved plan+fresh preview确认放行并后台计算；服务端自动预载的旧snapshot仅作历史显示，不自动成为这个新意图的固定源。明确打开snapshot或group的原固定上下文仍可直接计算；job深链仍只读，source/role/opaque与旧unknown门禁不变。只改具名useAnalysisStart的两处固定源解析及必要actual hook tests，不改Shell/既有source选择按钮/后端或任何旧source记录。

同一P2的数据展示联动：FullWorkspace将view.snapshot.manifest置于fresh preview之前，且将view.snapshotId显示为已选；因此只纠正start hook不足。selectFullStudySources须停止从plan.snapshots隐式选择旧snapshot，仅明确chosen.snapshotId或明确group的metadata.snapshotId作为固定源；历史快照列表按钮/组读取保持。plan-only不请求旧snapshot、不由其409遮盖fresh approved-plan预览；明确固定源的权限/失效阻断全保留。Job深链也不自动挑无关旧group。具名src/full-study-ui-session.js及必要actual selector/read测试随同hook校正；最终执行源清单由31增至32，不改写旧31源证据。
