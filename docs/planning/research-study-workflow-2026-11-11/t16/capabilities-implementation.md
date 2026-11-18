# T16 S06 当前动作能力 API 实现与验证

2026-11-12。对应当前主循环授权的 S06 动作权限接口增量。先补 `t16-descriptive-contract.md`，新增 core/Methods/adapter/controller 失败用例，确认缺方法/缺路由 RED 后实施。未改变 UI、运行中服务、DDL 或主三例；本记录为代码交付待独审，不是整项 T16 完成声明。

## API 与守门

`GET /research-studies/:studyId/analysis/runs/:runId/capabilities`

返回且仅返回 `{studyId,runId,status,reviewStatus,capabilities:{canReview:boolean,canCancel:boolean}}`，Cache-Control no-store；不接受额外查询字段。缺失/跨 Study 或非 descriptive Run 404，真实权限失效继续拒绝，Methods 返回错 runId、缺失/非字符串状态或非 boolean 标志时明确503，不从客户端 role 或其他模块能力推测。

Study adapter 先完成真实 Study 解析和精确 Study/group/project/skill/run 读取，再提交 wrapper 事务后调用 Methods。Methods 新 `getDescriptiveCapabilities` 使用 `mustFindRun(user,runId,false)` 取 raw Run；没有先读来源，也不通过 present/read 把派生字段塞进内部 Run。

FormalDescriptiveRuns 新 `actionCapabilities` 在现有 `withAuthorizationMutation` 事务中复用 `live(...,'snapshot',false)`：当前数据库账户/authVersion、租户/group/project、真实 Session、Agent、Skill当前版本、分配及feature全部有效后，复用审核写入/回执的 `reviewRole`。仅明确的 METHOD_REVIEW_FORBIDDEN 变为 canReview=false，其他权限/方法失败原样拒绝。管理员/PI/methodologist 为true，普通授权 Methods 研究者为false。canCancel=true 表示已通过现有取消方法相同权限，不新增运行者或角色限制。

来源失效时权限元数据仍可读，以便取消；不读来源值/输出/hash，不执行Worker，不改变Run/审计。capabilities仍仅是权限位：终结状态仍可能 true，来源失效也可能 canReview=true；顶层status/reviewStatus来自同一授权live(false)当前raw Run，S06须同时结合 fresh detail、blocked和status，再启用动作；所有写入继续独立重验。取消未终结运行的既有状态规则保持。内部live已有行锁逻辑未调整，metadata没有新增锁顺序。

## 验证

- RED：core/Methods缺方法3项、adapter缺方法1项、controller缺GET路由1项；保留日志。
- GREEN：Methods/core及既有Methods service **46/46**；adapter及实际工厂装配的Nest controller **5/5**；全服务 `tsc --noEmit --incremental false` 退出0。
- 真实保护PG：**1/1**，fixture guard限定 wp01_test_full_baseline，独立新tenant/scope/subject/role，业务路径使用aisci_app，实际MethodsService→19505认证Worker→持久Run后测试；整事务最后强制回滚。
- 实际角色：管理员、PI、methodologist为true；同一新研究者角色降级后false，伪造admin claim也false；真实PI审核可执行，普通研究者审核拒绝。
- 实际撤销：当前账户authVersion、Session、Agent、Skill、feature逐项撤销均拒绝metadata与取消；恢复后返回当前权限。缺失run、错误Study拒绝。
- 实际来源失效：撤销新fixture计划审批后详情拒绝，最小权限仍可读；普通Methods研究者canReview=false/canCancel=true，实际取消成功且返回无outputs。metadata在取消后仍只反映权限，不伪装状态可执行。
- metadata调用前后原Run与审计数量一致，真实Worker只在最初创建时执行1次；没有把单测当HTTP/UI验收。

证据及精确SHA：`docs/testing/evidence/research-t16-2026-11-12/capabilities-state/freeze.json` 和同目录 RED/GREEN/PG/tsc 日志；初版仅权限位证据保留在 `../capabilities/`。此增量未重载19501/后端，未执行真实新HTTP endpoint，未改S06，目标环境启用、实际HTTP/页面、产品/API/测试living文档与Notion统一收口仍由主循环继续完成。

## 状态核对窄补充

主循环明确需要：当前来源失效使详情409，而现取消没有requestKey/receipt，未知响应不能靠再次POST恢复。先补合同与两项独立状态RED（needs_review/pending_review、cancelled/pending_review），再将当前raw Run的status/reviewStatus与capabilities一起返回；未增加updatedAt、canCreate/context或其他端点，未改原取消/审核判定与read()。

新unit在来源失效后直接取消一次，再只读metadata得到cancelled；审计数量和Worker次数保持，不能称为原取消回执。实际保护PG复跑包括初始needs_review/pending_review、真实退回后的needs_input/returned，以及来源撤销、实际取消后的cancelled/returned；元数据全程不暴露原值、输出或来源摘要。最终46+5单元、实际PG1和tsc全部通过。所有证据仍仅本机代码/方法链验证，未重启或进行新HTTP/UI验收。
