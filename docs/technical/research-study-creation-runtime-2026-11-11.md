## 2026-11-17 · WF02模板API及来源边界

同一Study入口新增GET `protocol-templates`有界搜索/加密cursor、GET `protocol-templates/:sourceStudyId/:sourceProtocolId`固定内容/差异/双fingerprint、POST `protocol-template-imports`（200），以及GET `protocol-template-imports/receipts/:requestKey?requestHash`。POST仅requestKey/sourceStudyId/sourceProtocolId/sourceFingerprint/targetFingerprint五字段；原授权事务锁定source/target，重读当前actor/authVersion、精确canConfigure、固定来源/许可与CAS后，原生创建新draft。操作action为protocol.template.import，operation/result JSON与原生/模板审计同事务；无DDL、RLS放宽或旧系统HTTP。

FormVersion按精确来源独立复制为locked，NULL scoring保留；Outcome固定内容一致才复用，冲突整笔拒绝；访视/requirement新ID，引用重映射且0/null/false与合成预处理标记不丢。只允许原生data_field/scale来源。模拟form_score依赖原case.Protocol/hash/variables，新Protocol不能继承，预览/提交共用可移植性blocker；不靠删除固定检查或复制登记过关。政策、许可决定、参与者与审批/启用不复制。

receipt重验当前target/source配置权、actor/authVersion（含0）及原hash/Study，found:false保持unknown，客户端不自动POST。opaque marker按actor/version/Study/URL隔离保留，不保存表单正文；临时切换/卸载保留原marker、迟到不回显；新标签S02仅查当前草稿，不替代原key核定。真实PG单物理事务/整体回滚、3次原生UI导入/6审计、身份与缩放等见[WF02验收](../testing/study-workflow-wf02-2026-11-17.md)。

## 2026-11-17 · WF01连续保存与只读恢复

Q01正常主动作依次调用原课题保存和Study创建，成功到S11；不调用旧系统HTTP，仍是ResearchHub受限服务复用原源码核心。`POST /research-projects`原成功码201，PATCH与建Study原成功码200，验收须保留原状态码。既有Study进入先重验当前Study访问，不生成新绑定。

新增`GET /api/research-projects/receipts/:requestKey?action=intent.create|intent.update|study.create&requestHash=<sha256>[&targetId=<intentId>]`。原事务校当前租户、账号、authVersion，回执按tenant/actor/key读取；固定action/hash/target及回执authVersion，并重验当前课题/Study权限。返回原result加current详情，no-store、零业务/audit写。新JSON回执增加requestHash/authVersion并同步原审计meta，无DDL/RLS/新权限；旧POST重放契约不变，旧无版本证据不供新GET核定。

浏览器只持久化opaque key/hash/action、版本/对象/组/阶段与身份绑定，正文留内存。缺回执专码RESEARCH_RECEIPT_NOT_FOUND仍保持unknown，不凭404推断未执行。核对/刷新不续写；明确原键重试核定保存后也不自动续建Study。新编辑保留，后续明确保存先重验当前同项目版本/Study，再新键PATCH原项目。账号、authVersion、URL、卸载和迟到结果均有隔离；真实pending保留离页保护，纯GET不误当修改。

本机受协调owned重载至PID90209（本次时间点），原7服务健康，回执专码真请求确认装配；没有修改共享启动器或恢复旧队列。完整请求/PG/审计/保护与浏览器限制见[本轮验收](../testing/study-workflow-wf01-2026-11-17.md)。

## 2026-11-12 · T17/S10固定报告交付

19501正式S10已接同Study固定报告、人工审核、发布、DOCX实际任务与受控下载；原文不可编辑、当前权限/用途/来源贯穿回执和文件。具体API/参数/权限/恢复及旧消费者边界见[T17技术说明](research-t17-2026-11-12.md)，[真实整页证据](../testing/research-t17-2026-11-12.md)。本次无DDL或生产部署；主同案与更正链归T18。

## T16 描述统计与当前动作能力（2026-11-12）

正式Methods/Worker装配及S06通用合成闭环已实测；所有路径、原回执/取消差异、当前授权与固定来源重验见[专项API/运行文档](research-t16-2026-11-12.md)，实际证据见[验收](../testing/research-t16-2026-11-12.md)。本机通过不代表生产启用，无新DDL或自动重算。

# 科研课题创建 · API、数据库与运行入口

## T06 参与回执与本机验收（2026-11-12）

`GET /api/research-studies/:studyId/subjects/receipts/:requestKey` 和 `GET /api/research-studies/:studyId/subjects/:subjectId/participation/receipts/:requestKey` 受当前身份与 Study/对象授权；查到后读取当前状态，404保持未知且不自动重发。真实HTTP及浏览器恢复证据见 [台账](../testing/research-t05-t06-2026-11-12.md)。T06仅本机通用合成软件四层通过，临床、生产和后续处理撤回全链未验。

日期2026-11-11。对应[产品规格](../product/research-study-creation-2026-11-11.md)与[T00契约](../planning/research-study-workflow-2026-11-11/t00-creation-contract.md)。

## 当前本机：19501统一入口

完整目录地址为 `http://127.0.0.1:19501/pages/q02/?researchProjects=1`，完整Q02目录保留“新建课题”；P01从最多5条同源预览后的“查看更多课题 →”进入，沿用现有账号、12小时Hub会话和签名秘密。`scripts/local-knowledge.mjs`把研究Controller装配到原19502API，前端沿现有同源代理访问，19502及既有Worker端口不作为第二个用户站点。

`scripts/research-creation-local-integration.mjs`只适配新模块：租户严格限于原本机租户，组/执行项目作用域在同一受限应用事务显式设置，业务授权由正式研究服务按当前身份完成。不改旧prisma固定作用域、原全局guard和AI写入钩子；没有权限种子、自动建库或恢复任务。启动只读核对专用合成库身份、已准备SQL的SHA回执及四表强制RLS。新路由JSON解析先于旧默认解析，仅这些路由256KiB；格式错误400、超限413。

前序创建接入时19501已受控重载；账号/密码/签名秘密及该次重载前Cookie保全，原80条queued、0条running任务未因本轮删除或重置。独立19611/19612实例按PID/命令/端口归属核验后停止，历史数据保留。[前序创建接入验收与限制](../testing/research-study-19501-2026-11-11.md)。本轮统一目录是否已启用另见下文及本轮待验报告，不沿用前序重载状态。

## 独立正式装配能力（当前未运行第二站点）

`node server/research-runtime/start.mjs`选择装配Hub认证、Prisma和研究Controller。复用app/server的源码和运行依赖，路径与环境定义详见`server/research-runtime/README.md`。部署须包含两个代码目录，不导入旧AppModule或本机fixture启动器。

必需配置：DATABASE_URL、DIRECT_URL、JWT_SECRET、DEPLOYMENT_ID、DEPLOYMENT_PRODUCT=researchhub、ALLOWED_TENANT_IDS、DEFAULT_TENANT_ID、AUTH_COOKIE_NAME、HUB_APP_ORIGIN、HUB_AUTH_COOKIE_SECURE；可设置HUB_API_HOST/HUB_API_PORT。控制面和Worker均不启用，缺失/非法配置启动失败；不在日志打印凭证。沿Hub12小时会话，不允许用旧Cookie名代替。

前端与API须通过同源反向代理连接；写入仅接受配置Origin和JSON，总请求256KiB。响应no-store，内部错误脱敏。没有自动迁移或后台任务恢复。

## 服务契约

| API（/api前缀） | 行为 |
| --- | --- |
| GET /research-directory?limit&q&cursor | P01/Q02统一当前授权目录；精确total、稳定游标及当前创建能力 |
| GET /research-directory/execution/:id?studyGroupId=... | 同一旧源权限下的最小概览信息；精确租户/组/项目父链 |
| GET /research-projects/context | 当前能力、活跃领域、合法创建组 |
| GET /research-projects?limit&cursor | 保留原意图专用列表契约；不再作为P01/Q02完整课题目录来源 |
| POST /research-projects | 题名必填，其余可选；requestKey必填；返回item/capabilities/creationGroups/hubs/receipt |
| GET /research-projects/:id | 真实意图与默认研究、当前能力 |
| PATCH /research-projects/:id | requestKey及expectedVersion；编辑字段白名单，CAS冲突409 |
| POST /research-projects/:id/studies | 当前合法研究组；同事务创建默认绑定，不创建/启用Protocol |
| GET /research-studies/:id | 当前研究/执行容器、可核实计数、准备状态和能力 |
| PUT /research-hub-roles/:hubKey/:accountId | 仅当前租户管理员配置明确owner关系；版本及幂等，错父链拒绝 |

`resolveResearchStudy`与`withResearchStudyTransaction`是可信进程内交接，不接受HTTP传入actor或事务；当前支持read/configure，site/clinical操作拒绝。其他业务模块后续按任务接线。

## 统一目录与旧详情适配（本轮19501本机技术验收）

`server/research-studies/directory.mjs`在研究Controller中新增两项只读GET；`src/research-directory-session.js`和共享`useResearchDirectory`供P01 limit=5、Q02 limit=20共用。默认limit=20、1–100；q最多200字符、按当前可见题名和问题/简介做服务端不区分大小写包含检索。完整title保留，summary最多160字符；全文通过原详情恢复读取。

响应为`{items,total,nextCursor,capabilities:{canCreateProject}}`。items含key/kind/id/title/summary/status/updatedAt、当前可透露的组/执行项目/意图/Study标识、`links:{primary,overview?,edit?}`及`capabilities:{canEdit,canOpenStudy}`。先按来源授权，未绑定意图key为intent:id，已绑定/旧执行项目key为execution:id。各来源在数据库按当前过滤条件计算精确total和有界页面，再稳定合并；不存在1001条扫描截止，也不由前端拉全目录后搜索。顺序为更新时间倒序/key倒序，游标保留微秒时间并绑定当前tenant、actor、authVersion、q及order；每页仍重验当前权限，游标不授予权限。 分页不承诺跨HTTP数据库快照；目录变化需按提示重新读取。

旧项目要求同租户活跃组/项目、有效组成员/角色及项目成员；管理员按本租户当前角色独立读取活跃组/项目，无需逐项目加入。旧源不额外增加workbench菜单门槛；新意图/绑定仍沿原当前owner/admin/明确Hub角色及研究成员规则。不能读取意图的旧项目成员只获旧源字段，不返回隐藏意图ID/题名/问题/owner；仍有权读意图但执行失权或组/项目停用时，不返回无权概览链接。平台管理员拒绝业务目录。

旧执行概览适配返回`{profile,group,project,capabilities}`，含真实父链及服务端判定的草稿/任务/设计提示。装配层注入复用scripts/my-research-overview.mjs的canOpenDesignWorkspace纯判定函数，使用本次受限事务当前user/group/project/membership/member按同scope计算设计提示，不再调用旧overview/API；正式装配未注入时默认hint=false，不由目录可见性推导下游业务权限。旧S01仍用精确studyGroupId/researchProjectId，新绑定Study仍用researchStudy/studyId，意图编辑仍用Q01原入口。旧overview响应、固定scope、创建写入API与Schema均不改。

客户端限制同源允许路径并验证父链/链接/总数/游标。搜索换条件清分页；身份改变与撤权清旧内容，迟到响应无效；后台重读覆盖先前展开范围，绝不合并旧失权行。跨页期间总数变化明确失败并要求重读，不用前端补数掩盖。当前目标仅19501；原owned进程46139经官方stop/start变80356、7端点ready；14条旧processing无有效lease，未修改/重放旧任务。API71请求/42主入口、专项84/装配4及Chrome证据见[本轮验收报告](../testing/research-directory-unification-2026-11-11.md)为准，前序创建/导航实测不能替代本轮验收；本轮不需要DDL、角色种子、历史迁移或新站点。

## 数据准备与回退

权威SQL：`server/research-studies/schema.sql`；依赖公共租户/账号/组/项目/审计表与rh_hub.hub。四张新表强制RLS，绑定默认唯一，操作只追加；审计父链校验用固定pg_catalog路径的窄SECURITY DEFINER触发器，应用角色无函数EXECUTE权。修改SQL须独立迁移评审，不允许通过启动器静默覆盖。

本轮仅专用合成PG由显式fixture守卫脚本准备schema，留下SHA回执；正式环境迁移与反向代理未执行。旧公共表不迁移，既有项目不自动生成意图。回退先停新入口/流量，保留已写数据、审计和回执；本批未提供或执行破坏性删表回退。

## 本机验证入口

```sh
node scripts/local-knowledge.mjs start
node scripts/local-knowledge.mjs status
node scripts/research-creation-19501.mjs --local-synthetic
```

兼容命令 `node scripts/research-creation-local.mjs`（或原 `--mode local-synthetic`）只调用共享19501启动器，不再另建租户/账号或端口，原 `--fixture` 参数拒绝。当前验收脚本仅接受专用合成库，沿用现有账号，新建具名合成课题；数据库核对只读，不改原项目/角色。凭证留在私有.tmp，不进文档/Notion。

`research-creation-api.mjs`、`research-creation-pg.mjs`、`research-creation-browser*.mjs`保留为首批隔离环境历史测试工具；其19611服务已退场，不作为当前运行说明，也不自动再启。正式Controller不依赖本机端口或fixture库名；独立正式装配保留供未来明确部署使用。完整[首批记录](../testing/research-study-creation-2026-11-11.md)与[19501记录](../testing/research-study-19501-2026-11-11.md)。
