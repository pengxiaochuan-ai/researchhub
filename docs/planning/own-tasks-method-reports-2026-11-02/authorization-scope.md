# R1最小授权核对 · 2026-11-02

> 当前已切换S08完整设计待评审，S10暂停；本文件是R1只读历史授权/核对，不授权S08任务写入或自动续跑R1-02～06。新范围见[完整授权申请](../study-tasks-s08-2026-11-02/authorization-scope.md)，正式产品管理员规则见[ADR-0006](../../decisions/0006-tenant-admin-default-business-authority.md)。下方“管理员无例外”只代表当时切片，不再是产品通用原则。

状态：**用户已确认上述规格、局部交互适配及两条任务夹具范围，当前执行R1-01**。A01/A02继承现有读取权限、D01最多2条新具名任务；不是新增RBAC授权。下方原“待批准”属评审历史，以本段最新确认及实施台账为准。配套[实施规格](../../product/own-tasks-method-reports-spec-2026-11-02.md)。

最新核验：R1-01已通过，两账号原报告v1/v2真实读取及互读403已验证；D01已一次创建run `rh-r1-20261102-2e80c389`精确2条，重跑不增不覆盖。没有新增Role权限、模型或旧报告修改；原只读快照保留为当时事实，不能把旧任务0/0当当前数量。[实测交接](../../testing/own-tasks-method-reports-preflight-2026-11-02.md)。

## 1. 固定边界

- 库：`wp01_test_full_baseline`，fixture marker已验证syntheticOnly；本次事务显式READ ONLY，未访问临床库。
- tenant：`rh-kb-local-b0e2af9d-tenant`；group：`rh-kb-local-b0e2af9d-group`；project：`rh-kb-local-b0e2af9d-project`。
- owner@example.org → `rh-kb-local-b0e2af9d-owner`；admin@example.org → `rh-kb-local-b0e2af9d-admin`。管理员无跨本人/Study例外。
- 不改角色/成员/Agent/Skill/feature/配额/费用或既有scope文件；不调用任何授权初始化函数来补权限。

## 2. 已核实与尚未证明

快照时间：2026-11-02T09:53:24.704Z（北京时间17:53:24）。

| 核对项 | owner | admin | 解释 |
| --- | --- | --- | --- |
| 租户、账号、组、项目、角色、两层成员active | 是 | 是 | 数据库当前快照，不替代请求时重验authVersion |
| workbench菜单 | 有 | 有 | 与P01任务读一致，不需study.execute/configure |
| artifacts菜单＋artifact.read | 有 | 有 | 报告读取必要条件，不给create/edit |
| method feature / AgentAccess / 已发布DQ SkillAssignment匹配计数 | 1/1/1 | 1/1/1 | Skill计数本次未细核agentId/skillId组合及每份会话，不能直接当完整通过 |
| knowledge菜单/chat.use/精确SkillAssignment/科研Agent | 有/有/1/1 | 有/有/1/1 | 10:00:00.223Z补充READ ONLY核对，Skill精确匹配tenant-synthetic-dq与tenant-kb-research及已发布版本；每份会话仍待核 |
| WP07本机范围启用/账号/Study/operations | 匹配，含R01/R02/R03 | 同左 | 本片只调用既有读取链，不扩展R01/R02执行 |
| WP06本机范围启用/账号/Study/operations | 匹配，含capture/explain/report | 同左 | 读取链仍继承capture门禁；不删除/绕过 |
| 正常可见本人受派任务 | 0 | 0 | 含全部状态、排除acceptanceFixture；没有数据不制造演示结果 |
| 严格scope/owner/creator/type/prefix方法报告候选 | 12 | 8 | 仅SQL预筛，未逐份核验marker/hash/父链/当前来源 |

尚未动态证明：当前登录会话authVersion、每份报告绑定会话与KB资料、历史版有效性、同事务来源撤回后的交付效果。实施R1-01须免费逐项核对并对两个账号各读至少一份报告；任何缺口**先报实情，不自动恢复权限**。候选没有可读者不生成替代报告。

## 3. 最小实施授权申请

| 项 | 对象/动作 | 已有依据与拟实施 | 明确不含 |
| --- | --- | --- | --- |
| A01 | 两账号、固定Study、本人assignee任务列表只读 | 继承P01 workbench＋当前成员/角色校验，增加有界GET投影；不加Role权限 | 其他受派人、协作者口径、未分派、自建未分派、受试者数据、新建/改状态/分派 |
| A02 | 两账号、固定Study、本人已存在WP07方法报告及固定版本只读 | 继承artifact.read＋原方案/EDC/方法门禁，新增列表/固定版只读适配 | 全部产物、他人报告、新报告/新版本/新AI、说明编辑、审批/导出/资产操作 |
| D01 | 本轮新具名正常合成StudyTask最多2条，每账号1条 | 仅为S08数据库→API→浏览器正向验证，由受保护fixture helper一次创建；命名`rh-r1-20261102-<唯一run>-{owner,admin}-task`并保存manifest，createdBy/assignee分别本人 | 不给用户task.create权限，不改原任务/账号/角色/来源/报告，不建新账号/Study，不执行后台任务或批量清理 |

D01字段：固定tenant/group/project，source/type用现行允许的手工/custom契约，题名明确“合成只读验收”，一条open、一条completed；无subject/enrollment/visit/template/依赖/协作者、无敏感内容。具体枚举在R1-01按现代码验证，未知不得猜值落库；`acceptanceFixture:false`作为正常只读记录，通过新manifest精确归属，不恢复旧fixture或改变P01过滤。

边界反例使用不持久提交的合成事务数据或测试注入，仅本轮具名对象；如需更多持久行、修改旧授权/状态、新Study/账号、清理记录或权限撤销，另确认。两条夹具保留供用户体验，不自动删除；不能因fixture需要安装任务Worker或触碰旧服务。

## 4. 不申请、失败处理与签署

费用/AI任务/充值、远端配置访问、云资源/生产停线/发布全部不申请。task.execute/configure、artifact.create/edit/review/export、治理管理权全部不新增。原账号在旧工作台已经获批的写权限不撤销，但本片UI/API没有新增写操作。

当前结论：**现有RBAC必要条件满足，建议不增加角色权限**。报告全链动态校验与两条任务夹具仍是实施前门禁；若失败，按“缺哪项、影响哪个账号/对象、最小可选方案”提交用户，不以管理员代读/恢复权限解决。用户尚未批准本清单时不创建D01、不安装新scope、不实施只读入口。
