# T00/T01 独立审计：当前19任务、本机通用合成范围

2026-11-12。对照 `implementation-plan.md` T00/T01、`t00-creation-contract.md`、`t00-execution-contract.md`、实现及实际证据；本记录不修改任务状态，也不代表临床或生产验收。旧 preflight 的阶段性“仅 read/configure”是历史，不用它否定后续 T05–T17 已取得的限定证据。

| 对象 | 当前可核证据 | 剩余缺口 / 不应推断 |
| --- | --- | --- |
| Study 真实父链、同 tx、撤权 | `scripts/research-creation-pg.mjs` 的 [真实PG记录](../../testing/evidence/research-creation-2026-11-11/rh-create-39ca8c05/pg-cbec7608-42eb-4473-ac84-50d40816e0e5/result.json)：RLS、跨租户、错组、真实 handoff、site/嵌套事务拒绝、共享创建失败全回滚；创建 [真实API](../../testing/evidence/research-creation-2026-11-11/rh-create-39ca8c05/api-84998562/result.json) 含成员父链、owner关系撤销和 cookie authVersion。此次当前源码 `authorization` 等 20/20 `.tmp/t00-t01-independent-unit.tap` 是单元/受控装配，非新HTTP实测。 | 历史创建证据不等同于每个后续动作的当前权限/在途撤权已完整验证；T18 全新同案仍须实际检查。 |
| Hub owner、普通关注者、管理员 | 创建 API 实际验证管理员明确设置 Hub owner，T05 [release PG](../../testing/evidence/research-t05-2026-11-11/release-pg.json) 验 owner 无项目审批权限；[队列 PG](../../testing/evidence/research-t05-2026-11-11/queue-references-pg.json) 验无 project_manager 不能审核且成员撤销复验。 | 原创建 API 结果的 `not_follow_status` 名称不能单独证明实际先建立普通 follow 再逐项尝试权限：脚本未见插入 follow。建议用新合成身份明确建立 follow、对同 Hub/Study 尝试配置、审批、采集、读/撤权，保存真实 HTTP/PG 与页面。不能据 owner 样例推定 follower 已覆盖。 |
| 中心和盲态 | `execution-policy-gate.ts` 对 configured blinding 和非 study_wide site 返回明确机制不可用；真实分析 `t15-analysis-core.mjs` 仅接受有依据的 blinding not_applicable。独立 9/9 `.tmp/t00-t01-independent-blinding.tap` 为规则单元；真实合成案例明确 site study_wide、blinding 不适用。 | 目前没有实现受限中心/盲态字段、错误/列表/AI/分析/导出全链视图，故没有真实盲态不泄漏验收。只能验证需要该机制时发布阻断，不得把合成非盲扩成临床规则；团队实际方案、职责、同意/退出及SAP材料仍缺。 |
| 受控运行、旧扫描/退役算子 | 独立 `research-runtime` 拒 worker/official 队列配置，明确 Auth/Guard 与控制器，不挂旧 AppModule；当前源码 unit/HTTP 20/20。实际19501是单独 `scripts/local-knowledge.mjs` 合成组合，明确引入受限知识和真实描述统计 worker，知识导入服务不作为 provider 以避免历史恢复；不能说本地没有所有 worker。 | 单元隔离装配不能代表当前19501所有运行路径、旧队列或退役音视频检测均已运行时逐一验证。需目标安全重载后的进程/路由/队列清单与负向真实请求证明，不得把未使用推为全仓无隐式调用。 |
| 迁移与失败 | 公共变更有 canonical Prisma migration 与独立 SQL 审查，fixture guard 针对合成库按精确 SQL 应用并留证，如 [T05迁移](../../testing/evidence/research-t05-2026-11-11/migration.json)，非 migrate deploy/db push；schema RLS 错父链失败明确。 | 该合成库无完整 Prisma applied 历史，不能由单条手工合成 DDL 证明生产唯一升级链或回滚已执行。正式目标需明确历史基线、唯一执行顺序、checksum、失败/恢复及实测回滚或前向修复方案。 |
| 本机启动自动 DDL（本审发现后最小修正） | 原 local-knowledge 在启动调用 `applyHubSchema`；0表自动创建，3表但缺 guard 自动建函数和 trigger、缺 Hub 自动 seed。现按 T01 合约将启动改为 `assertHubSchema` 只读 catalog/作用域检查，保留显式 `hub-schema --apply`；缺/篡改拒绝且受保护真实PG `READ ONLY` 校验通过，单元 2/2 含只读SQL与缺表、guard安全、禁用/事件等反例。 | 首次独立合成租户/账号创建仍是本地体验脚本行为；不能称该脚本完全无初始化写入。仅源码与本机当前库只读 PG 已核，尚未重载并实测启动成功/缺守卫失败；不把它称正式部署或已完成全链验收。 |

实际报告仅校验指定文件/证据，不证明仓库所有动态导入、所有租户角色、所有撤回链或专业结果。当前具体优先事项是受控确认 T01 本机只读启动与缺失 fail-closed，再补显式 follower 正反例和 T18 全新同案；生产/真实临床分别保留未验状态。

### 普通关注者真实负向验证契约
新建唯一标记的合成 researcher，不加入任何组/项目或 Hub owner 关系；真实登录并 PUT follow 后，用受保护 PG 读回 followed=true 且无 owner/成员，真实测试目标 Study 目录及 read/configure/approve/collect/analyze/report 拒绝，个人意图仍可保存而创建 Study 被拒绝。每个响应先核认证与输入合法性，避免将格式错误或未登录误计为权限拒绝。账号口令/Cookie 仅保存在本机私有临时位置，结果只记状态/动作与合成范围；不动旧角色/旧对象、不重载。

### 普通关注者实测更新

全新自有合成 researcher 无组/项目成员，真实19501登录并关注后，[首次HTTP及PG结果](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/result.json)证明 followed=true、无 Hub owner/组/项目成员；目标 Study 读取、配置读取、审批、建档、分析及报告受限，目录不出现研究，个人草稿可保存但建立研究 403。官方受控重载后沿用同一账号的[复验](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/reload-result.json)确认关注持久、合法配置/审批/表单分配以及 Study/分析/报告访问拒绝，目录仍不泄露。该结果覆盖实际 HTTP/PG 权限边界，不代表已执行关注者浏览器截图/录屏、所有动作矩阵、临床或生产验收；原矩阵对应“未明确测试关注者”的旧结论以本段实测更新为准。

### 普通关注者浏览器复验

同一合成身份在重载后真实 Chrome 验证：P01 仅显示本人草稿、目标 Study 不出现；Q02 可打开草稿，Q01 的“建立研究”实际 disabled，页面明确提示联系租户管理员配置研究组；S01 与 S09 直达各自真实 API 返回 404，并显示无权查看的安全状态。S05、formalAnalysis、S06、S10 只验证实际受保护 API 返回 `RESEARCH_NOT_FOUND`，不声称其页面完成。关注关系由真实 follow API 与 PG 证明，P01 并不显示已关注状态；未改变领域页面。无原生对话框和页面异常。

证据：[结果及请求](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/result.json)、[P01](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/p01.png)、[Q02](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/q02.png)、[草稿下一步](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/q01-draft.png)、[S01](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/s01.png)、[S09](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/s09.png)、[录屏](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser/video/page@4fdb66757776f8bf72b86ca69593a0a9.webm)。仅合成软件验收，未涉及真实临床或生产。

### 需要盲态或多中心机制的真实阻断契约

用两个全新独立合成 Study 和各自已发布通用 Form/Outcome，经真实19501 API保存 draft 与完整政策；A 的 blinding 为 configured，B 的 site 为 configured/restricted_sites，其余是有依据的合成规则。逐个实际 check、submit、approve，核对政策问题及失败码与最终方案状态、无入组；不会替团队配置真实临床规则，也不改已有 Study、角色或资料。若状态机在提交前阻断，则审批因非待审核状态不可达，应记录实际失败及机制问题，不能假装经历审批。

### 盲态和中心未实现机制：真实负向请求

两个全新合成 Study 使用各自已发布通用 Form/Outcome，以真实19501 API保存完整 draft 与政策：盲态 `configured/blinded`、中心 `configured/restricted_sites` 分别执行 check、提交、审批。[实际请求/PG结果](../../testing/evidence/research-t01-2026-11-12/rh-t01-mechanism-e7f342db/result.json)显示提交均 409 `EXECUTION_POLICY_BLOCKED`，分别带 `blinding_mechanism_unavailable` 和 `site_mechanism_unavailable`；审批因未进入待审核状态返回 400 `INVALID_PROTOCOL_TRANSITION`，两个方案仍 draft、无 approved policy、无入组。两项使用独立新素材及 marker，不改既有角色或主样例。

[当前发布状态读回](../../testing/evidence/research-t01-2026-11-12/rh-t01-mechanism-e7f342db/release-readback.json)核对 `policyIssues`/`submissionPolicyIssues` 含对应机制缺口、`canSubmit=false`。注意独立的方案与固定引用检查 `release.gate.ready=true`，它不包含政策门；不能称该 gate 本身已阻断，界面与调用方须同时读取政策问题。此测试证明上述两种配置不能提交和启用，不能证明已实现盲态视图或多中心隔离，也不覆盖实际临床规则和生产。

Q01 补充稳定重拍：[身份完成后的截图](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser-stable/q01-authenticated.png)和[断言](../../testing/evidence/research-t01-2026-11-12/rh-follower-ddbb6a3f/browser-stable/result.json)。等待顶栏实际显示合成关注者、主区身份核验结束后，仍为本人草稿、建立研究 disabled 且提示联系管理员；先前截图保留作中间轨迹。
