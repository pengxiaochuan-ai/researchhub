# P2账号与成员：同事务复用验证报告

## 后续进展：2026-11-13受控读取已获批并验证

下文停线为前序真实快照，原失败和退出码2保留。用户随后批准单一函数／精确EXECUTE，已完成受控回执与同事务原键恢复的5/5真实PG验证及一次独审；原RLS／旧服务不改。[当前报告](governance-p2-account-receipt-2026-11-13.md)。完整账号资格、authVersion推进与HTTP／G03仍待实现，未扩席位或持久开户，不将读取阻断解除等同P2完成。

日期：2026-11-13。**当前结论：旧服务同事务复用可行，账号原提交回执读取受RLS阻断，停在新增精确读取授权确认；P2尚未实现/装配/业务验收。**

用户已批准P2-M01～M04，不再重新请求这些已批权限。本轮只执行M04受限应用角色的临时合成全回滚验证；M01持久新账号、M02持久组/Study、M03席位10→14均尚未执行。

## 1. 真实执行结果

数据库`wp01_test_full_baseline`，通过既有目标/runId/syntheticOnly守门。业务试验连接当前角色为`aisci_app`，无superuser/BYPASSRLS；没有用owner连接写业务或把服务成功归于RLS旁路。owner连接只读系统策略/函数目录。

旧`AccountsService`和`PiGovernanceService`通过测试工具的最小Prisma包装绑定**同一个真实tx**，不是HTTP调用后补写，不是另开事务。测试不证明尚未存在的Hub控制器授权已经实现。

| 验证项 | 结果 |
| --- | --- |
| 账号停用＋未使用额度回退＋审计 | 同事务实际执行；50个临时合成Token全部退回，原账务规则未复制 |
| 账号审计失败注入 | 业务执行后注入审计失败，回滚到savepoint，账号仍active、临时额度仍50，未残留退款 |
| 恢复账号 | 旧服务实际恢复active、不返还已经退回的额度；原authVersion未变，证实仍需已获批的Hub版本适配 |
| 成员审计失败注入 | 创建成员后注入审计失败，回滚后成员关系不存在 |
| 三种既有项目角色 | researcher→data_manager→project_manager均真实执行；三条审计自动继承真实project上下文，可由受限角色读取 |
| 移除与最后负责人 | 新member软停用；移除唯一manager实际拒绝并保留active |
| 管理员关系 | 新研究中未创建admin的组成员/项目成员；这仅证明试验未伪造关系，不代表HTTP已完成管理员授权 |
| 账号层原提交回执 | 审计createMany真实报告插入1条，但相同actor/tenant/action/target查询返回null；**阻断** |
| 数据保留 | 事务强制整体回滚，另开受限只读连接确认临时账号/组/额度不存在；无持久角色、成员或账本变化 |

AuditLog的researchProjectId已有数据库默认值，旧成员审计正确继承当前Study，**无需为了成员写审计修改旧代码或增加该字段**。账号动作属于租户级，必须用空Study上下文，不能虚挂某个Study来获得回执读取。

## 2. 阻断原因与最小新增授权建议

真实策略为：`audit_tenant_insert`允许空project上下文插入researchProjectId=NULL审计；`audit_project_select`仅允许非空project且匹配该project的行。已有audit_log SELECT不等于租户级账号审计可读。切换project也不能合法读NULL行。

现有唯一业务回执函数`rh_source.read_review_receipt`固定来源审核动作、Hub及具名原授权，**不能借它读取账号操作或擅自拓宽用途**。其余匹配函数为约束/触发函数，不是通用账号回执API。

建议仅新增一个ResearchHub命名的受控读取函数：

`public.researchhub_read_account_receipt(p_tenant text, p_actor text, p_auth_version integer, p_request_key text) RETURNS jsonb`

- 在本机专用合成库新增此函数，owner为既有aisci_owner，SECURITY DEFINER固定search_path为pg_catalog，所有业务表全限定名，无动态SQL。
- REVOKE PUBLIC执行；只向`aisci_app`授予此**精确签名**EXECUTE。核验schema无应用CREATE能力，不给函数修改/表归属/角色成员资格。不放开audit_log表级读取范围，不改旧RLS或旧函数。
- 调用必须匹配服务端设置的当前tenant/account/authVersion上下文，沿原授权锁顺序复验当前账号和租户有效、role=tenant_admin且isTenantAdmin=true；不是邮箱白名单、旧JWT孤立标记或客户端自报身份。
- 只查**本租户、当前操作者本人、本轮Hub账号状态操作**的固定标记`researchhub.account-status.receipt.v1`及原requestKey；不接受任意action、SQL条件、账号或Study范围。
- Hub适配在复用旧服务的同事务审计中补服务器生成的操作标记、requestKey/hash、真实targetAccountId、结果投影；不改变旧账务或复制新账本。函数只返回该回执的固定字段，如目标id、状态、版本、退回额度和完成时间，不返回完整审计meta、邮箱/密码、密钥、其他操作者或历史无标记日志。
- 同键不同请求内容拒绝；同键结果未知只查原回执，不换键重放。当前身份失效、跨租户、错actor/version、格式错误或无标记旧审计均拒绝/不返回；目标账号必须仍属同租户。
- 仅新增函数定义及其单点执行授权；不新增业务表、管理员/Agent/Token业务权、额度、云或外部服务。先事务内安装候选并验证，再在获批后持久应用；验证失败不旁路。

这是**新DDL/EXECUTE授权**，不在已批P2-M01～M04中，不因本建议而执行。若用户批准，先写上述成功/越权/失权/旧日志拒绝的测试，再完成候选函数、Hub安全适配和原回执验证。除此之外的新增权限仍另停线确认。

## 3. 命令与证据

- `node scripts/governance-p2-reuse-probe.mjs`：最终8项具名结果＋1个阻断，退出码2表示准入不通过，**不是全绿**。
- 首次7项探测：[原结果](evidence/governance-p2-reuse-2026-11-13/rh-p2-reuse-05ff2bea/result.json)；补成员审计失败注入后的最终[8项结果](evidence/governance-p2-reuse-2026-11-13/rh-p2-reuse-8fb3cb4c/result.json)。两次均全回滚，保留第一次记录，不新造对象掩盖问题。
- `node --test server/auth/session.test.mjs server/wp02/invitation-router.test.mjs`：11/11纯回归通过；不代表新P2授权/恢复已实现。
- 实时只读核对：既有12账号/10席位、原两账号状态/角色/authVersion均未变化，同名M01新账号0；最初运行状态PID43992七服务ready，本轮没有stop/start或共享入口变更，不保证其他会话随后不重载。
- 浏览器/构建：本轮只新增诊断脚本和文档，没有运行代码或UI变化，G03尚未装配；未执行P2界面验收，不冒称页面能启停/维护成员。不为满足截图格式模拟一个可用页面。

本轮沿用串行实施＋一次独立只读总评，结果见下节；新增授权确认前停止实际开发，不提前扩席位或创建持久夹具。原始命令输出在`evidence/governance-p2-reuse-2026-11-13/commands/`，包括首次/最终准入及11项纯回归。

## 4. 当前交接状态

已证明“旧服务可以在同一受限PG事务中执行及回滚”，尚未证明“Hub入口安全启停和成员维护已生效”。账号当前授权、版本/CAS、防重、有效负责人检查和G03母版均仍待后续实施验证；当前阻断不是注册席位本身或模型额度，不需要充值/AI调用。

建议下一项：批准单点账号回执读取函数及EXECUTE后，先打通账号启停原提交恢复和当前授权，再准备已批新夹具与G03局部交互。

## 5. 独立总评与作者裁定

`/root/p2_reuse_final_review`只读核对本轮脚本、报告、旧源码与8项JSON证据，独立语法检查通过；未连接PG或复跑业务试验。无Critical/Important，认可同事务复用与账号回执阻断结论，不认可将其扩称P2产品交付。候选函数仍须实际SQL验证FORCE RLS下的执行身份、共同锁顺序、当前失权和同键冲突，不能只凭规格称安全已生效。

作者裁定：HTTP授权/CAS/并发、会话吊销、候选函数及浏览器均未执行，保持明确未验，不因本轮旧服务试验跳过；代价是P2尚不能向用户提供账号启停功能。按新数据库权限边界停线，不以owner连接或改挂Study替代。

两个Minor证据增强留项（不进入本轮集中修补）：JSON显式记录实际连接身份和UTC时间（当前身份由fixture guard在同一连接强校验，JSON role是常量）；软移除结果追加单独`status=disabled`断言（当前已实际调用并验证后续唯一manager保护，未独立断言移除后的状态字段）。均不改变当前账号回执不可读的阻断判断，后续复用验证可补，不冒称本轮覆盖全部退出字段。

执行裁定记录：先M04全回滚试验、不提前消耗持久账号/席位；沿用户指定当前共享目录，不擅自worktree/提交/删除证据。若前一取舍不适合会推迟持久注册验证，若错误扩大后一操作会影响其他会话，因此本轮只保留具名增量与证据。
