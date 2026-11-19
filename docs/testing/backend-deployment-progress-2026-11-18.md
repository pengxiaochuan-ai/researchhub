# 独立后端与迁移交付：阶段证据及待确认

创建2026-11-18，更新2026-11-19。本轮配置受限的独立合成演练已通过，准确当前结果见[最终交付说明](backend-delivery-rehearsal-2026-11-19.md)及文末续记；主干提交以Git及最终复核记录为准，生产执行另确认。以下保留各阶段当时的失败与未完成项，不将历史“继续顺序”自动恢复为新任务。

## 已实际完成

- 私有核心构建器显式读取旧server源与已安装版本，不读旧.env、不复制node_modules或临床/业务数据；源码逐文件hash封存。URL分发的SheetJS版本不在npm同名版本中，已改用当前已安装包的私有tar封存，不降级至旧npm版本。
- 独立运行入口支持显式core路径/hash。production即使漏HUB_REQUIRE_PRIVATE_CORE也拒绝回退相邻旧项目；开发本机路径保持。现有旧源码不改。
- 新Docker PG实例`rh-deploy-20261118-0fbba918-pg`，只绑定127.0.0.1:19651，库`rh_deploy_0fbba918`，独立具名卷和syntheticOnly marker。未复制原租户/任务，也未创建业务账号、角色、Agent或额度。
- 旧专用合成库通过fixture guard确认后，仅同一只读snapshot导出public/rh_*结构，约911KB，无COPY/数据行，无wp01_meta/globals/口令。另只读核对12schema、796对象和187函数的owner/ACL/RLS/SECURITY DEFINER等元数据；生产库未访问。这些原始结果仅保留本机.tmp，不上传公开仓库。
- 迁移执行器具备plan/check/apply/verify、源hash、显式批准digest、endpoint/部署身份/非空marker绑定、逐步事务、advisory lock、锁/语句超时、前后结构指纹及ledger校验。它不会自动使未知生产基线通过。
- **真实新PG技术演练通过**：新技术probe应用一次、重复零执行、结构漂移拒绝；另一失败DDL连同本步ledger记录全部回滚。逐步迁移此前已提交步骤不会随下一步失败回滚，不称整包原子。
- 17项core/事务/运行配置相关纯测试及旧runtime定向测试通过，另1项真实PG演练通过。独评发现的事务逃逸、生产旧源码回退、目标绑定及路径问题已修补并补负测；最终整体验收仍未进行。

## 未通过／未执行

- Node22官方Docker源访问超时；本机已使用的镜像源重试未完成，已停止该自建pull。未改全局Docker配置，未降级使用Node20冒充Node22。私有Linux构建上下文已生成，**镜像构建与脱离原目录启动尚未通过**。
- 完整正式Controller/provider装配、合成初始化/历史扫描剥离、所有当前页面API及AI工具契约仍待补。现有standalone入口仅Auth/F01/F03/Studies，不称全产品运行时。
- 数据库当前结构含多处真正限制新对象的合成CHECK/slot和固定材料AI用途依据。执行器通过不代表最终生产候选DDL已完成；不能用schema-only dump直接生产恢复。
- 新账号/Study/资产等演练授权及材料AI用途生产等价设计已列入[准确待确认清单](../technical/backend-production-equivalence-admission-2026-11-18.md)，通过异步问题等待用户确认。确认前未授上述权限、未放宽约束、未调用模型/外部SMTP。
- production driver的预登记身份拒绝路径仍需补独立伪执行器负测；当前17项主要证明plan、路径、事务生成及旧runtime契约，不是生产连接实际验收。
- 未开展本轮真实浏览器业务验收，未生成虚假截图或把纯测试当完整能力；未连接生产/云，未重载或排空旧服务，未push main。

## 继续顺序

先确认最小生产等价与具名合成授权，再完成业务适配/候选迁移和完整Linux装配；解决镜像获取后在独立环境做真实API与浏览器正反例、重启/恢复、启动零隐式授权及无历史认领验证。独立总评通过、文档/Notion同步后，带skip-ci提交main，正式执行仍单独确认。

本机原始日志：`.tmp/deployment-delivery-20261118/`，含RED/GREEN、PG验证、依赖封存、私有构建上下文和失败镜像拉取记录；该目录含私有材料/运行配置，保持忽略、0600/0700，不同步Notion/Git。


## 本轮续行：授权与测试目标纠正

用户已批准最小正式化及新具名合成演练范围，当前仍未完成完整部署/迁移/浏览器验收，未push main。

一次测试选择失误运行了`node --test server/database/transactions.test.mjs server/hub-sources/visible-repository.test.mjs server/hub-sources/read-controller.test.mjs`。其中visible-repository旧集成测试自行加载`wp01_test_full_baseline`，在sentinel/异常回滚事务中临时写入合成来源；该组4项失败，2项纯测试通过，未作为新环境验收。原日志为`.tmp/deployment-delivery-20261118/transactions-controller-tests.log`。测试实现及fixture wrapper显示无内部COMMIT、异常后事务回滚，未提交业务记录；未对全部旧业务行另做新一轮hash保护验证，不扩大宣称“旧库一切保持”或“整个阶段仅只读”。本轮未清理旧数据、修补旧任务或重跑旧专项。后续集成入口仅使用经Docker label和数据库marker核定的19651新实例，禁止旧baseline/ambient env兜底。

事务注入模块和10个产品Controller导入已开始正式化；旧本机fixture逻辑保留，不把生产env交给旧fixture guard。该批及既有工具/runtime目前19项定向纯测试通过。新PG完整结构初始化第一次因未预建vector扩展失败，事务回滚；修补显式扩展前置后重试，结果继续记录。

## 已批准增量的续行结果（尚未完成）

- 独立PG结构已成功初始化：12个受管schema、796个目录对象、187个函数；源结构与新目标结构指纹均为`1636304ae3b092949aed8dc978f8373a`，初始化后tenant/account/method run计数均为0。只复制结构及必要owner/ACL/RLS，不复制业务、历史任务或fixture元数据。vector版本0.8.2。
- 首批资产24条正式化DDL经独立静态评审、真实新PG干跑后提交。附件新分支补为精确`tenant/hub-assets/`前缀，拒绝空/点/父路径段、反斜线与控制字符。第一次提交因干跑与执行的search_path不同导致after指纹校验失败，整步回滚；统一pg_catalog后提交通过。该步后指纹为`1db1c5e3ddb5bbc0ed78bcbaa2970ed5`。
- 回执当前身份/活跃Hub及材料AI依据两步经过独立静态评审并在同一新实例提交，最终结构指纹`6008480b5b467e13d4bbe2f6e53173fa`，待业务正反例验证。新增表仅应用角色SELECT/INSERT，FORCE RLS、追加事件、真实报告固定版与审核/审计绑定。修复评审发现的锁等待到期与身份失效风险：使用实时clock_timestamp、VOLATILE当前依据查询，沿官方→租户→材料锁并在等待后重验；旧fixture分支保留。生产DDL/GRANT均未执行。
- Docker Node22镜像已从原有镜像入口获取。普通npm下载最后卡在约70MB中文字体；使用相同公开包的可续传下载并按锁文件SHA512校验后，仅给本轮构建缓存补齐，无新依赖版本或旧源码修改。v3构建被主动终止，v4改用该私有缓存完成npm ci，native平台Prisma修正后的v5仍在构建；不能称镜像交付完成。
- 新包仅调整私有Prisma生成器binaryTargets为native，保留数据库模型/迁移，记录原schema SHA；旧schema文件不动。新增定向测试验证该变换。当前独立入口仍在补装，已增加显式核心providers、严格存储只读就绪检查、部署请求来源策略及完整目录指纹proof；尚未完成目标运行/浏览器验证。
- 新建同runId的独立MinIO容器/卷/bridge网络，端口19653；桶尚未初始化。凭证仅存本机0600私有文件，不进入Git/Notion。未创建云资源、调用模型或授Token额度；尚未创建本轮业务种子。
- 定向纯测试已验证：材料来源派生/当前依据拒绝、回执幂等与身份绑定、事务同连接身份及schema proof、请求同源、存储不自动建桶、原本机身份/目录/WP02边界及minimal runtime均通过。各组计数不汇总冒充全量门禁；真实PG并发、完整Linux服务、API/浏览器、独立最终总评和main提交仍待完成。

## 当前续行结果：Linux原生启动、账号闭环与004（前文为历史）

以下为本轮最新事实，取代前文“镜像未完成、无业务种子、桶未创建、未做浏览器”等阶段状态；保留失败与修复历史。完整两项交付物仍未完成，未提交或push main，生产未执行。

### 运行与结构

- Node22.23.5的linux/arm64镜像已成功构建。原生Prisma加载、AuthService/KnowledgeService加载在network-none容器通过，原开发机app路径不存在；不是拿Mac node_modules充当Linux包。目标生产若为amd64须另验，当前不冒称多架构交付。
- 私有core已封存并校验，Hub包逐文件清单及hubDigest校验已补；China地图、行政区划及城市位置静态资源显式携带。form-core-adapter按验证过的私有core解析，避免模块导入捕获相邻旧路径。Worker门在生命周期前绑定实际导入/原始处理消费者，停止后不再扫描/认领；关闭邮件失败仍尝试Nest/Prisma清理，相关测试有证。
- 独立MinIO桶已由本轮运营命令建立，应用启动只读探活、不自动建桶。仅本机独立容器/卷/端口，未创建云资源。
- 001–003保持原文件/hash/账本。追加004评论父版本修正：真实PG结构干跑后应用，指纹`469902fbca03bbb97e27235a8886a7c8`；创建回复须绑定当前有效父revision，后续保留该锚点，不因父撤回阻断子评论撤回。旧slot/ELSE保留，正向评论业务仍待授权夹具。
- 四步候选已置于`deploy/migrations/researchhub-production-equivalence-v1`，与本机应用文件逐项hash一致。公开候选经plan/apply/verify重验，4步已应用、pending=0、appliedNow=0。它严格依赖该合成结构基线，是增量候选而非空库安装/生产适用证明；生产基线未知，禁止修改指纹强行套用。

### 新具名种子与浏览器

- 使用旧原生账号/准入/Study服务初始化本轮新对象，未恢复旧租户/历史数据。共1个Study、1个只读科研角色；管理员不插课题组成员，owner已有只读成员，invite原无成员。3个账号显式创建，第四个经公开注册生成，席位4。
- 真Chrome1440×1000验证admin/owner登录→P01，读取1个真实新Study、正确身份，页面异常0。不是只测/auth接口或替换演示数。
- 注册请求202、邮箱确认201，新账号正确进入P006待加入审核，不自动批准或授私有Study。密码找回202、确认200，新密码可登录，第一次重置现场观察旧Cookie401。未为反复验证额外发送challenge。
- 管理员真实S11发邀请201并实际SMTP捕获；错误账号预览404且不能接受；原invite账号明确接受后，仅获得本Study只读成员。数据库最终核验：accounts=4、roles=1、studies=1、consumedChallenges=2、acceptedInvites=1，注册账号group/project成员均0且准入pending、authVersion=1；admin课题组成员0。agents/agentAccess/quotaGrants/modelRuns均0。
- 早期浏览器脚本存在旧标签及登录跳转预期错误，曾在无额外业务写入下失败；改为当前标签“受邀体验邮箱”、待审P006以及等待真实身份后沿同一对象续行。没有重复创建账号/重发挑战或邀请补成功数。结果与失败尝试均保留本机日志；最终账号数据库核验独立通过。
- 桌面及390px邀请只读页面、实际返回P01录屏/截图已留存。窄屏截图需等导航动画结束并关闭菜单后检查正文；未修改前端代码或原布局。仅本轮样例，不称全站移动端验收。

### 邮件未配置的准确状态

- 新增显式HUB_MAIL_MODE=disabled，允许独立包在HTTPS配置下不启动本机捕获；注册/重置/邀请在邮件业务写入前返回503，保留原本人资料当前身份校验。此模式不算生产邮件交付完成，不读取旧SMTP配置。
- 先在v15真实HTTP观察到全局过滤器把已知配置状态吞为泛化503（RED，业务计数未变），再修补只对准确HUB_MAIL_NOT_CONFIGURED返回固定公开文案，任意异常消息仍不回传。单元RED→GREEN和v16真实HTTP通过：三类邮件动作503/正确code、profile200，前后accounts=4/challenges=2/invites=1/grants=0/runs=0完全一致。独立只读评审未发现新增P1。
- 当前仍以v14捕获模式API提供本轮19611浏览器；v15/v16的19613邮件禁用测试容器只停止其本轮自有实例，未切换19501等旧服务。v16是该切片验证镜像，完整发布包未封版。
- 当前一组39项定向纯/HTTP测试全部通过，记录`current-free-gates.log`；它们不连接旧PG，不能替代完整业务/生产验收。没有付费模型调用或外部SMTP。

### 新增确认与剩余阻断

1. [知识库管理员兼容差额](../technical/backend-knowledge-admin-admission-2026-11-18.md)：K01 GET/POST真实403，库/资料/导入均0。独评核core-v2与本机两文件逐字一致：旧HTTP守卫及knowledge-import认领/提交要求成员，profile投影不能代替。须确认Hub私有构建副本的准确兼容，保留他人个人库限制、当前父链/版本/租约/提交授权；确认前不改、不插假成员。
2. [正向夹具准确增量](../technical/backend-positive-fixture-admission-2026-11-18.md)：仍待确认。原1份报告草稿不能证明原生T17已审核有效分析链；复制本身还会登记一份新资产。总量明确为5份research_artifact、其中3份asset_registry，含2复用目标；不悄悄超原对象上限，不伪造released状态。
3. 完整资产/报告AI材料用途/Hub科研Agent会话执行尚未装配；普通资料AI/模型未执行，不能称全后端就绪。复制目标正常业务key与当前reuse校验key存在冲突，后续需精确调整绑定元数据及追加校验，不放宽真实目标条件；未用假目标求通过。静态参考字典数据也尚未显式初始化，不能复制旧业务库代替。
4. 完整重启/故障恢复、零隐式授权/无历史认领全链、生产基线/权限增量和最终独立总评未完成。新包、候选DDL及本机通过部分不能作为生产执行授权，也不触发main自动发布。

本轮私有证据仍在`.tmp/deployment-delivery-20261118/`：foundation-seed-result、各镜像/原生校验、migration-result-004、public-candidate-bundle-verification、browser-auth、browser-accounts及account-loop-database-verification、disabled-mail-v15/v16结果。该目录含私有凭证/邮件，不上传Git/Notion；不把日志中的秘密复制进报告。

独立候选复核补记：只读迁移评审确认四SQL的SHA与manifest、私有实演字节一致，依赖链连续；001旧评论函数保持，修正版只在004追加，002–004包含对应生成器输出；未发现明文凭据、COPY数据或完整结构dump，未发现本阶段候选新增P1。评审未连接数据库，不将其静态结论扩称独立验证了实时账本。完整业务仍待新增确认与后续演练，不合并、不push。

## 两项批准后：知识库兼容切片已完成本机技术验证

用户已批准有限正向夹具及Hub私有副本知识库兼容，不再把这两项列为待确认。完整独立包/生产候选适用性仍未完成，未提交main。

五份精确源SHA转换覆盖HTTP Guard、导入认领/提交授权、当前正文/原件/检索读取、审核事务。前一v17完成导入后因旧retrieval内部成员守门读正文403，在同一已批准知识HTTP范围补齐当前读和审核；v18重封存coreDigest d78eac94e51f3f024174697270a639dd7b5ed785d4b3b54654122097c12beddb。旧core-v2与旧app五份源码哈希均核实未变；没有成员/角色/GRANT或Token增加。

实际Chrome上传的唯一Markdown任务complete，中文标题/正文正常；管理员原件200、审核200，未审核检索0，审核后返回2条同文档来源片段。科研只读账号GET200、审核403、无审核按钮，抽取预览正文可读；错误Study403。原件Range206与文件字节匹配，未改页面。浏览器早期脚本误在新库状态刷新前设文件、等待重复GET及未切换“文档树”就查隐藏搜索框，均保留失败日志；通过实际当前页路径续行，未重复创建库/资料/任务，也未靠改UI让测试通过。

原生定向8通过0跳过（包括prepared审核原方法配可控索引stub，不能当真实含标识材料验收）。新PG9项检查通过，均使用本轮已有记录且外层回滚：真实claim/publication、flag/authVersion撤销、真实父组失效、他人个人库、source scope约束、lease/token及当前读取撤销。第一轮group错误枚举disabled导致验证失败；改用真实archived。source不一致先被23514 scope CHECK拒绝，使用保存点恢复，不宣称同一反例经过后端提交。低层原生单元另验证“失去管理员但仍有成员写权”不能回落；PG不新增写权充反例。

重启仅rh-deploy-20261118-0fbba918-api-v18：10个账号/权限/知识表完整行hash与数量前后一致，唯一任务仍complete，没有重复处理或隐式授额。48项本轮定向纯/HTTP测试通过0跳过，独立代码评审无新增P1。真实浏览器不是全站/所有文件格式或专业用户签收。

当前数量：4账号、1权限角色、2课题组成员（owner/invite）、3原生项目成员（创建者admin及owner/invite）、1Study、1库/原件/文档/导入任务、4知识chunk；tenant_feature_entitlement仍0。3受试者、方法运行/报告及资产候选尚未生成，无法使用未启用的原生业务。

**新增单一待确认项**：[两个合成功能开关](../technical/backend-method-features-admission-2026-11-18.md)。实际研究配置403 FEATURE_NOT_ENABLED，旧TenantFeaturesService平台开关接口仅限platform_admin；本轮4账号均非平台管理员，不造第5账号或伪装身份。请求仅由数据库演练操作员为本轮新租户新增study_operations/research_methods_worker两条记录及两条系统审计，其余授权/数量/费用不变。确认前不启用、不造原生CRF/方法结果。已批准资产/报告等余项与最终发布链仍未完成，不以本切片通过代签。

私有证据：knowledge-admin-native-green-final.log、knowledge-current-free-gates.log、knowledge-private-core-verification.json、knowledge-negative-pg-result.json、knowledge-restart-result.json及browser-knowledge/read-review-result.json/http-boundary-result.json、PNG/WebM。所有凭据、原始错误/邮件及私有副本保持.tmp忽略，不同步Git/Notion。

## 两个合成功能开关与真实方法来源准备

两开关已获批，在同一新库事务增加两条启用记录及两条系统审计，先回滚演练、再提交、重复拒绝。独立只读复核无本次阻断；保留marker可空比较及before快照未独立保存的限制，详见开关准入文档，不重写旧执行SQL或重跑开关。

新原生来源：1份预置固定表单、1个合成结局定义；1方案/执行政策经检查→提交→批准→启用（executing）；3名合成受试者各有真实筛选/同意/用途事件、入组/访视/CRF。3份CRF已审核并固定输入修订，未执行Study或临床数据库锁库；1分析计划已审核、1份结构质控快照已生成。未更正CRF，未造报告批准状态。首次脚本误把方案启用状态断言为active，实际为executing；修正断言后沿已保存回执续行，没有重复业务操作。

独立确定性Worker采用5份经核定原源码文件，源摘要c4b4d7517a31673383a8e10de1a3b9da0e493aa4db1d70e8338792dfeeb545ef；旧源码重验未变。初版部署包评审指出ready探活、源根symlink和外部清单锚缺口，已补测试并修正，独立v2构建运行。实际Python3.12.14、linux/arm64，非root、只读根、无公开端口；基础RepoDigest/image ID存私有证据，不以源码摘要宣称跨架构镜像可复现。启动脚本曾误断言ready.status=ok，实际为ready；仅恢复已存在具名Worker后续步骤，未重建业务来源。

真实Worker请求：无令牌/错令牌401、正确令牌handshake200且无数值/LLM，ready200；缺令牌ready函数503是同容器子进程契约，不冒称另一个服务端启动反例。尚无描述统计算子执行。外部可信清单锚拒绝文件和清单同时重封存，不能用被测目录自算的摘要充当信任锚。13项定向新包/原包/原生知识回归通过，0跳过；不称全项目门禁通过。

原生分析运行请求被404 AGENT_NOT_FOUND拒绝：新库Agent/Skill/装备/AgentAccess/Session/方法运行/模型运行/报告/资产均0；4账号、1角色、2组成员、3项目成员、Token授额0。没有绕过原生执行身份门禁。[方法身份准确增量](../technical/backend-method-operator-admission-2026-11-18.md)待用户确认后，才能继续原来1次方法运行和报告/资产链；完整部署交付、生产适用性、最终总评和main提交仍未完成。

证据：native-config-basis-result、native-protocol-result、native-subjects-result、native-crf-result、native-crf-freeze-result、native-analysis-result（仅plan/review/preview/snapshot）、native-basis-counts、method-worker-package-v2、method-worker-boundaries-result、method-worker-slice-free-gates-final.log及environment/method-worker-state-v2。均在本轮私有目录；未上传配置/凭据/邮件。

真实Chrome来源复验：管理员S07方案与S09固定CRF可读；科研只读账号S09 GET200，六类写能力均false，实际draft请求403。3个页面观察无pageerror/横向溢出，PNG与WebM见browser-native-basis。首次测试误预期科研只读GET也403；核对原生formal-response-authority的工作台成员只读规则后更正验收断言，保留原失败结果，并补实际写拒绝，不修改产品权限或前端求通过。不是整页/全科研链验收或用户代签。

## 最小方法身份批准后：真实方法报告到资产（2026-11-19）

方法Agent/原生Skill审核及个人装备已按准确增量登记：先rollback，再commit，重复拒绝；before/after授权hash完整留存。AgentConfig/AgentAccess/ModelProfile/Token授额0，其他账号未装备Skill。旧源码未改。

唯一方法运行cmwmaxf2t000aqr016d9jbeoe实际经Python Worker执行，dispatch/publish各1，完成且原生确认；3条合成值1/2/3的mean=2、median=2、sampleStdDev=1、missing=0，逐项对照numericEvidence、固定manifest和Worker版本。随后原生生成并审核/私有启用唯一来源报告rh-formal-report-c9088012-ede5-41bb-943e-c5e65eda5720 v1；正文hash aeb72b0388b453d707db7ea7f0f3c6cb7344a12c53e637d0f5e72f8c0af2b5df。未执行模型或导出。

独立v19/v20开始装配真实business资产注册/目录/详情/治理/用途/评论：私有load和部署Host/Origin注入沿原Controller契约，所有业务仍在app角色事务核当前身份、真实父对象与原权限；旧本机分支保留。管理员要求当前role/flag一致，不插成员。原S10登记和G02审核组件的固定账号/来源/回执校验与返回链接改为当前原生报告归属、owner和能力；未改CSS、Shell、弹窗字段或操作步骤。

唯一报告资产rhab-92389ab7-b870-4dd6-9715-3c229cec4f6f：浏览器实际登记1版→提交→退回→从原报告说明修订2版→提交→本人内容审核显式勾选后批准，最终revision6、2版、6事件，私有未发布。A01默认无Study筛选统计1；A02 v2源正文与原报告相同，sourceOrigin指向真实Study/报告v1。owner默认统计0、私有详情404、实际写403。两个角色浏览器无pageerror/横向溢出，截图/视频已留本机。

保留失败及修补：初次构建G02局部重复q声明已修正；测试路由和select精确label误用按现行契约修正，不改页面适配测试。首次登记已成功但旧最终回执白名单拒绝新assetId，未再次登记；补通用强绑定回执检查，保留旧分支。免费恢复使用原真实请求键和本人的非凭据pending元数据，实际GET查原结果并重新验证原生来源；没有模拟API成功或重新POST。恢复等待跨10秒原报告轮询，进入G02当前已审核v2，通过。早期“期待4次请求”窗口不足及仍期待待提交按钮的旧状态断言保留为测试失败，未掩盖。

新源登记通路另外收紧：通用登记仅本人原创；报告必须走原报告派生接口，由后端读取固定正文，不能把真实报告hash挂到调用方篡改正文。纯反例通过，目标HTTP反例待下一镜像核验。原生来源及资产只读正向已通过；这不代表文件/复用/全部AI装配完成。未注入reportQa时该路由404，其他尚未装配对象明确不可用，不能统称AI路径全部503或完整交付。生产DDL/GRANT/云/真实发布、最终总评和main提交仍未执行。

阶段快照method-report-asset-checkpoint.json核实：4账号/1角色/2组成员/3项目成员；1Agent/1Skill/1个人装备/1Session/1方法运行；AgentConfig/AgentAccess/ModelProfile/模型运行/Token授额0；共2 research_artifact（来源报告＋1资产）、1registry/2version_policy/6asset_event。与初始化后的角色/成员完整hash一致。

私有证据：method-operator-initialization-result、native-analysis-execution、native-numeric-verification、native-report-result、method-report-asset-checkpoint、browser-report-asset下registration/recovery/governance/read-boundary结果与保留失败、PNG/WebM，以及portable-report-front/portable-receipt/asset-runtime-boundary测试和frontend-build-assets-final.log。17项上一轮定向通过，新回执/源通路反例各有红→绿；后续组合门禁待继续完成，不把不同批次数量相加称全项目通过。
# 2026-11-19 来源完整性阻断与修补落点

独立评审发现：通用原创修订入口未复核资产历史来源，可能把报告派生资产改写为原创；报告入口又可能按历史来源误认当前版。先补拒绝回归，再限制通用修订仅接受历版均为原创的资产，并在报告回执读取时核对当前固定版的唯一来源、版本、hash及实际正文。原报告、资产固定版与事件只读；本次不新增夹具或成功事件。修补与目标环境拒绝验证通过前，不认定该来源闭环完成。


来源阻断复验：22项定向纯检查0失败/0跳过；独立只读总评复核该P1修补通过。v21新镜像已启动，真实Chrome会话调用通用修订抹除报告来源返回422 SOURCE_ROUTE_REQUIRED，原报告来源读取200，仍资产v2/revision6；只读PG核实1方法/1dispatch/1publish/1来源报告/1资产/2版/6事件和权限hash保持。浏览器首次复验脚本使用错误S10参数停在等待，原失败保留，按原页契约formalReports+artifactId修正脚本后通过；未重放成功写入。证据source-current-combined.log、source-lineage-browser-final.log、browser-report-asset/lineage-rejection-result.json、method-report-asset-checkpoint.json（本机私有目录）。

## 2026-11-19 两层报告AI用途与第五步迁移

v22/v23沿原A02→AI01→固定版引用的真实Chrome验证：材料approve/revoke/reapprove共3事件，本人grant/revoke/grant共3事件；材料撤销期间原引用读取403，重新批准材料后个人仍revoked，须本人显式再启用，首次起止时间完全相同。仅原文检索、generated=false/providerStatus=not_enabled，0模型。v23统一材料锁先于个人许可锁；真实PG外层回滚验证个人撤销使旧pack/fragment均403，回滚后许可及audit完整hash不变，仍各3条事件。首次回滚脚本遗漏app实际组/项目session设置而403，修正测试上下文后通过；不放宽生产权限。证据browser-report-ai/checkpoint.json、report-ai-rollback-result.json及原失败日志保留。

005-copy-target-and-current-role已按独立只读评审，在同一具名新库先预测DDL再回滚、追加应用及重复verify。结构指纹e69a720d93bed67c868f9941bc69089c，前四步SQL/hash/账本不改，无新GRANT/角色。候选包追加第五步，运行配置只更新新环境结构指纹。复制正向与应用、讨论/文件及完整Agent装配仍逐项继续，不以迁移成功销项。

## 2026-11-19 · 独立包资产复用、附件、用途检索与部署依赖验证

在已批准的新独立合成库内，报告材料/个人AI用途各完成3条许可—撤销—再授权事件，真实A02→AI01固定片段检索与引用通过；没有模型回答或付费调用。方案资产完成固定v1复制、应用为独立本人方案草稿并原生保存v2；来源v2新增唯一414字节Markdown附件，复制和应用仍指向原v1。真实文件下载/Range/HEAD、2条父子评论及历史读取通过，导出保持关闭。修补未提交上传绑定恢复和原生裸MIME兼容，未改固定文件行、原布局或旧源码。

当前5份artifact、3份资产registry、5份用途版本、15条资产事件、1附件、2评论、2复用事实；原4账号/1角色/2组成员/3项目成员不变。方法仍仅1次，AgentConfig/AgentAccess/ModelProfile/Token新增/模型运行均0。3213行已核源省市字典显式初始化、幂等及缺行拒绝回滚通过，任务仅原批准1条。

74项本轮限定免费回归0失败/0跳过，前端构建通过。真实PG复制/应用原子回滚、错误元组/归属/正文和adminFlag反例留痕；正文不一致先由ASSET_POLICY_PARENT_INVALID拒绝，不冒称005谓词命中。390px冷启动仍宽1280且导航遮挡，属于未通过项，未擅改Frozen Shell；1440px正常，无pageerror。技术结果不能代用户专业验收。

Hub检索原生会话/队列/Orchestrator与同tx来源提交已接线，未适配消费者拒绝启动；免费契约和真实未配置状态检查通过。原admin的聊天POST实际仍被旧成员守卫403拦住，不能记作配置503实测通过；新增私有副本兼容见待确认规格。完整Agent真实执行、最终整包总评和main提交仍未完成；无生产DDL/GRANT、云或发布。[阶段证据](../testing/backend-deployment-progress-2026-11-18.md) · [聊天兼容待确认](../technical/backend-hub-chat-admin-admission-2026-11-19.md)。以下保留前序阶段，不据其旧统计判断当前结果。

新增私有证据均在`.tmp/deployment-delivery-20261118/`：`reference-data-result.json`（0→3213、重复幂等、缺行拒绝且回滚）；`deployment-task.json`（唯一任务原生创建）；`browser-final-free/result.json`（真实agents空/AI状态disabled/POST403/省市200，资产/权限/配额hash前后一致，截图/视频）；`reuse-005-negative-result.json`（临时事实表调用真实函数，未新增GRANT，不代原事实表RLS全链）；`reuse-atomic-rollback-result.json`（真实服务/真实表/约束四例全回滚）；`queue-after-rollback-result.json`（真实PG写后after拒绝传播回滚，审计hash不变，不代原生聊天正向）；`consolidated-free-regression.log`（74/74）；`frontend-build-current.log`（4.81s）。

测试失败保留：初次队列fence PG脚本漏设scope导致audit RLS拒绝，补测试上下文后才实际写入并观察after回滚，未改权限。临时probe初次从RLS不可见表复制导致0行，排查发现后改为原真实行固定JSON并保留正向对照，修正后才计入有效反例，旧失败日志不删。实际正文不一致由ASSET_POLICY_PARENT_INVALID更早拦住，未关闭它以直达005。

独立装配评审：原生签名/execution同引用、usage/abort、elevated/app/tenant assistant fence方向通过；入队缺当前授权及未适配消费者两P1已修补复核关闭。模型ready复用原生resolver，合成标记不强制清false。管理员403仍是未解决阻断，不能以状态200或免费替身测试当作已实际到达POST配置门禁或真实AI成功。新私有兼容规格待用户确认，不擅自补成员、聊天身份或额度。

v30候选补记：私有构建归档已生成并核manifest与SHA256，10,481,573字节、linux/arm64；不含runtime配置或业务数据，私有核心副本不进Git。五步迁移manifest/source hash复核通过；这不是空库安装包、amd64镜像或生产适用性证明。重启前后28表逐行JSON聚合hash完全一致，0启动授权/新认领；真实Chrome再次复测仍是桌面正常、390px未通过、聊天状态disabled且POST403。角色与两层成员hash同最小身份初始化时一致，4账号/1方法/0聊天任务/0模型运行/0Token新增。

阶段独立总评未发现新增P1源码/范围问题，验证以上回滚/重启/计数及候选文件边界；当前暂存为空，尚不能称最终index或主干提交包已审。高敏形态扫描的3个命中文件只含bootstrap变量插值和单元测试假连接，逐项核实无真实凭据。Notion同步发生过一处尖括号占位符格式警告，已改为字面ASSET_ID后无警告。待确认规格已同步技术目录既有结构；未执行其中瞬时聊天夹具或私有兼容扩展。

## 2026-11-19 · 聊天兼容获批后的原生验证与受限交付收尾

用户批准最小兼容及全回滚。本轮v32真实运行原生Sessions.ensureKnowledgeSession、createKnowledgeQueueRecords及assertWorkerAuthorized，14项正反例/17表hash一致；临时1 Agent/Config/Access/Session/message/job全部回滚。实际HTTP与Chrome管理员由原403转为503 HUB_CHAT_NOT_CONFIGURED，owner仍403，错scope403，知识读取200，auth/me仍200；0持久聊天配置/消息/任务/模型/Token。纯测先红后绿，最终合并98项0失败/0跳过（含PMC及生产driver纯测试），不称全仓门禁。

装配独评发现的工具权限上限P1已修补：不只派生menu权限，Sessions最终过滤及Worker requirements都硬限knowledge.search；多工具activeConfig的实际原生反例确认file/artifact/skill/write均拒绝。私有补丁canonical目标、symlink/hardlink及嵌套源保护P2、规格guards路径P2也已补并复核关闭。F01 approved终态不强改，未批准账号真实拒绝与缺批准纯测单列，不冒充真实撤销。

最终只读追踪另发现G02 PMC审核原文还走旧.tmp，已在独立foundation→review Controller→reading service注入同一S3读器。新增3纯契约反例覆盖实际回调、失败不回退、字节hash及I/O后授权失效；无PMC新夹具/GRANT/外部抓取，不称正向内容验收。production driver新增3个真实CLI/假psql负例：缺批准/marker/摘要、权限/TLS/登记身份、首次只读返回身份不符都拒绝，未连接数据库；连同plan共7纯测通过，已覆盖此前历史待办。

证据：chat-admin-native-rollback-result.json、browser-chat-admin/result.json及截图/录屏、chat-admin-red/green-v4、pmc-review-storage-red/green、migration-driver-gates、final-consolidated-free-gates，均在本轮私有忽略目录。原5份源码hash保持。初次临时校验脚本字符串错误未进入事务、AI01脚本错误参数曾进入invalid分支，均保留失败，修正标准入口后才计入界面结果。产品基线/版本/手册/技术规格及Notion原页同步，最终交付说明已登记测试目录。

本轮允许付费能力明确未启用，不再把生产SMTP、真实模型、生产基线或amd64检查作为此次main源码交付前置；这些列为正式执行前单独确认。剩余仅最终包hash、重启、暂存区独立评审和安全push，不恢复旧排空或新AI专项。

收尾结果：v33归档/镜像内容hash核验通过，28表重启hash不变，真实Chrome再验管理员503/科研403、登录有效/原知识读取200，0新增。155文件最终index由新上下文独立总评通过，119个JS/MJS语法检查通过；代码提交e72748e1c8950be4ea8ae1164f8d01657f3789fb带skip-ci，已推ResearchHub远程main并核SHA一致，核验时匹配工作流为0。工作树干净，私有归档/配置/数据/证据均未纳入Git；后续仅补文档交付回执，不改变代码。生产、云、付费模型、停线及发布均未执行。
