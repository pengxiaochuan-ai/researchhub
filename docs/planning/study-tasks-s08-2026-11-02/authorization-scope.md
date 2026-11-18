# S08整页最小实施授权清单 · 已批准、专用合成环境有界启用

日期：2026-11-02。关联[S08规格](../../product/study-tasks-s08-complete-spec-2026-11-02.md)、[管理员长期规则](../../decisions/0006-tenant-admin-default-business-authority.md)。**用户已批准S01–S07及11步计划；01–03门禁通过后，S01–S06所需配置在专用合成库有界启用。**实际执行和未验收项见[实施台账](implementation-progress.md)，配置启用不等于整页业务验收。

当前配置：run=`rh-s08-1c6165b1`；admin保留原role=tenant_admin且isTenantAdmin=true，owner保留role=researcher、isTenantAdmin=false，authVersion各从0→1；owner仅当前Study变为project_manager并使用具名克隆管理角色。共同原角色及前序D01两任务不变。两扩展表、一个无两账号成员行的辅助Study和两初始新任务已建立；创建/浏览器验证新增任务继续计入8条总上限，不另计额度。当前role/flag须满足旧共同一致性政策，禁止脏flag提权。

## 1. 启用前已核实环境与身份差距（历史基线，非启用后状态）

仅本机专用合成PostgreSQL `wp01_test_full_baseline`，使用既有fixture-guard核验目标，不读写临床库、不影响旧服务。2026-11-02T11:25:26.943Z实际READ ONLY事务：

| 对象 | 当前事实 | 不能据此宣称 |
| --- | --- | --- |
| `owner@example.org` / `rh-kb-local-b0e2af9d-owner` | active、isTenantAdmin=false，当前Study角色researcher | 已拥有任务执行/管理权限 |
| `admin@example.org` / `rh-kb-local-b0e2af9d-admin` | active、isTenantAdmin=false，当前Study角色researcher | 名叫体验管理员就等于真实租户管理员 |
| 两账号共享原角色 | workbench可见；study.configure/execute/review均无 | 可直接调用旧任务写接口 |
| 合成租户feature | study_operations条目不存在 | 已启用任务业务 |

精确主scope：tenant=`rh-kb-local-b0e2af9d-tenant`、group=`rh-kb-local-b0e2af9d-group`、Study=`rh-kb-local-b0e2af9d-project`。数据库连接凭证不写入本文件/日志/Notion。

## 2. 已批准项（须按小步计划验证并启用）

| 编号 | 最小变化 | 限定与回归要求 |
| --- | --- | --- |
| S01 | 将上述admin账号真正设为本合成租户管理员，递增authVersion并重新登录 | 正式规则由DB当前身份派生，不硬编码邮箱、不授平台跨租户权限。必须核对其他已挂载模块对该flag的已有反应并记录，不能声称它们已完成管理员全权适配 |
| S02 | 克隆原角色为两个**新具名合成S08角色**：执行者增加study.execute；任务管理者增加study.configure/execute/review | 保留原角色全部原权限；不直接修改共享原角色、不增加菜单/无关权限。真实矩阵测试仅在owner原成员行上有界切换新角色及必要projectRole，递增authVersion；技术交接建议owner留任务管理者、admin留租户管理员，执行者切换过程留证据 |
| S03 | 仅本合成租户启用study_operations | 不扩Token/配额、不开收费服务、无模型/邮件请求。启用前后对原业务做回归 |
| S04 | 建立一个新具名辅助合成Study，无两账号Study成员行 | 与主Study同tenant/group，仅证明admin未入组也可管理、owner无授权拒绝；主业务仍在当前Study。不邀请第三账号，不改旧Study和历史任务 |
| S05 | 本轮最多8条新具名任务及其派生关系/操作回执/提醒/审计 | 可跨主Study与上述辅助Study；用limit=2验证分页，不为测试造大批记录。前序D01两任务只读，禁止清理/重写历史数据 |
| S06 | 两张Hub增量表及RLS/索引/唯一受控迁移；旧Task服务受控内部授权兼容点 | 仅规格4.1/5范围，保留原状态/质控修复联动；旧默认调用不变。不修改全局Guard、不挂载整套旧Controller。需超过两表、修改旧非任务模块或发现不可保留的副作用时停下报告 |
| S07 | S08前后端整页接线，局部交互UI01–06与功能F01–F12 | 保持原母版/Shell；独立只读设计/代码总评审与真实浏览器证据。S10暂停，不开展临床/审批/锁库/导出页面实施 |

S02的角色切换只服务原两个账号的角色矩阵验证，不伪装别的身份；用当前值/CAS保护并保留前后快照。旧role是组级，不能把换组角色说成天然只影响一个Study：**启用前先只读核对两账号全部活跃项目成员及已挂载接口**；如新增许可会使普通owner在当前Study以外获得新业务写权限，必须停下报告，不先放开后补救、不借测试放宽其他研究。Hub本片另有具名scope运行守门，不视为修改旧系统全局RBAC的许可。辅助Study和新角色/任务使用唯一runId前缀，驱动先核对目标/对象集合，越界即停。所有数据保留可追溯，不物理删除。

## 3. 只读来源与负例

- 前序计划、collection、合成CRF记录及报告只能作为已授权只读关联/证据源，不修订其内容、版本、状态或授权。
- 所有负例使用本轮新具名对象或纯内存/事务回滚夹具，不改变旧服务、历史测试任务或临床记录。跨租户反例使用不存在/不相符scope或专用隔离测试夹具，不扫描其他租户数据。
- 管理员撤销/在途测试仅本轮admin真实标记的受控切换，验证后恢复获准终态；不触碰原权限之外的账号。测试操作同样审计，不借用平台管理员绕过请求链。
- 正式访视读契约可用隔离单元/集成夹具验证，真实浏览器只用已有合成CRF关联，不为S08新建正式临床采集数据。

## 4. 不在授权内

付费AI/邮件发送、充值/续额、新账号/角色的泛化授权、云资源、远端配置、真实部署、旧服务停线、历史数据迁移或清理、跨租户管理员、正式采集/方案审批/锁库/共享/发布/导出操作。**永久产品权限规则不等于授权本轮执行这些业务动作。**

规格和清单已批准，[小步计划](implementation-plan.md)现已编制；计划确认后先01/02首半天兼容验证，再按门禁启用。本清单不证明账号、feature、新表或代码已经启用。
