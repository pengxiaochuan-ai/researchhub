# T16 动作能力接口独立窄审

2026-11-12。当前冻结四文件 SHA 与 `capabilities-state/freeze.json` 一致。受审路径先按真实 Study/run/项目与 skill 限定，Methods 以 raw Run 进入当前授权事务：数据库账户和 authVersion、活跃组/项目与权限、真实 session/Agent/Skill/feature 重验，复用审核实际角色规则；只将明确无审核角色映射为 false。`live(...,false)` 不拼装或改变 Run，也不读回来源值；来源失效仍可返回最小状态、允许现有取消。`canReview`/`canCancel` 是权限位，不代表当前状态或依据已允许动作，UI 必须同时核对当前状态、详情及来源；终态也可有 true。取消未知时只读当前 cancelled，不能称为原请求回执或重发。

独立复跑 adapter/controller 5/5 `.tmp/t16-capabilities-independent-unit.tap`；作者真实 PG/Worker 测试复跑1/1 `.tmp/t16-capabilities-independent-pg.tap`。额外独立真实 PG+19505 Worker `.tmp/t16-capabilities-independent-extra-pg.tap`：新自有合成 Study 与账号，真实 PI 审核后降普通研究者，伪造管理员 claim 未使审核权限变 true、数据读取仍允许；撤销分析依据后详情受阻、仅元数据仍可读，真实取消成功后当前状态为 cancelled且不暴露输出。原测试亦验证 account/authVersion、session、Agent、Skill、feature 撤销拒绝和无新增 Worker/审计；所有PG fixture事务回滚，未改主样例。

当前审查范围未发现已证实 P1/P2。原作者完整46核心/旧服务单元、独立tsc为其证据，并非本次重复验证；新能力尚未加载目标进程、无真实新端点 HTTP 或 S06 页面验收，不能宣称产品闭环、生产或临床完成。
