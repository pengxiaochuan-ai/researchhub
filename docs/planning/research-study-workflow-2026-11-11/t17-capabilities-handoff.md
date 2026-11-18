# T17 S10 动作权限 DTO 交接

2026-11-12。`t17-reports.mjs` 的正式 list/read 同事务新增 `capabilities:{canCreate,canReview,canRelease,canExport}` 和 `docxExportStatus:'available'|'unavailable'`。每个权限复用当前 `permission`；只将 REPORT_FORBIDDEN 映射 false，身份撤销等错误继续拒绝。详情仍重验当前真实来源；列表失效项仅 blocked 元数据。DOCX 状态同时核当前 storage、启用 worker kind 与允许 tenant，不代表状态/审批/来源已满足。没有改变持久报告、版本hash、命令或回执，没有新增route、DDL或重启。

RED `.tmp/t17-capabilities-red.tap`；GREEN `.tmp/t17-capabilities-final.tap` 9/9 含真实受保护PG：独立真实管理员和只读研究者、伪造管理员claim、失效authVersion、存储/worker/租户禁用、来源撤回、只读零额外审计与导出任务；fixture事务回滚。现有内容/导出单元同时回归。服务源码 SHA `816b7a1bf7ea5a310203682c179430640b12015e5b1e9e43249cce5ef9fd02e9`，尚待独立审查和正式运行环境重载/HTTP/UI验证。

为后续角色页面验收新建单个有 fixture marker 的合成研究者与其独立角色，仅当前合成 Study 的组/项目，按合同给予 workbench/artifacts 和 chat.use/data.analyze/artifact.read；既有真实合成报告 [read 200、create/review/release/export 各403](../../testing/evidence/research-t17-2026-11-12/rh-t17-reader-bb2262c1/result.json)。私有测试会话仅存在工作区 `.tmp`，公开证据无凭据。该HTTP只证明已有服务权限矩阵，不能证明尚未重载的新DTO已启用；不代表临床或生产授权。
