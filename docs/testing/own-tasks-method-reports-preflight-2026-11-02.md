# R1-01首半天复用验证 · 2026-11-02

范围：用户确认规格、I01–I03及两条任务夹具后，仅执行R1-01。**本步复用验证通过；未接S08/S10新API或前端，不代表该切片或专业验收完成。**独立只读代码总评审未发现需阻断本步的P0/P1/P2；静态复核与真实验证证据分开保留。

## 1. 已实际验证

| 项目 | 实际结果 |
| --- | --- |
| 目标环境 | `assertFixtureTarget`验证`wp01_test_full_baseline`专用合成库，固定tenant/group/project与原owner/admin；没有连接临床库 |
| 当前账号会话 | 分别通过原本机Auth登录和GET me返回正确accountId；scope头使用原X-Study-Group-Id/X-Research-Project-Id，没有放宽原Guard |
| 真实报告复用 | 两账号各已有一份方法报告的v1/v2 GET均200、current、正文非空；与PG当前Artifact/Version/原生来源核对文本hash、factsHash、真实父scope与方法run；共4个固定版本正向读取 |
| 本人隔离 | 两账号互读对方整条真实报告路径均403，响应不交付contentMd/facts/notes；未因admin身份越权 |
| D01任务 | 一次原子创建精确两条新具名StudyTask，各assignee/createdBy为本人，无subject/enrollment/visit/template/依赖；不新增任务操作权限 |
| 幂等/数量边界 | 同一purpose的fixture_run受事务锁保护；第二次driver读取原manifest，created:false且仍只有原两条，不覆盖旧记录，不重新建一批 |
| 现有P01读取 | owner新任务open实际出现在原overview；admin新任务completed不进入现有待办（三种未完成状态）——正常口径差异，不改P01统计 |
| 保全/费用 | 两次driver前后本人原Artifact、Version及Sources、角色/两层成员摘要完全一致；原AI账本文件hash一致，0模型调用/0新增Role权限；只新增D01两任务及一条独立fixture manifest |

首个具名run：`rh-r1-20261102-2e80c389`。

- 科研人员：`rh-r1-20261102-2e80c389-owner-task`，open。
- 管理员：`rh-r1-20261102-2e80c389-admin-task`，completed。
- source/manual、taskType/custom已按旧service及policy实际值核对；无临床数据、审批或正式完成含义。夹具题名明确“R1合成只读验收”，保留供后续只读页面体验，不自动删除。

证据：[首次真实API/PG及创建](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/result.json) · [重复运行不再创建](evidence/r1-reuse-2026-11-02/rh-r1-20261102-70837e3b/result.json)。两份结果仅存请求路径/状态、定位与hash，不存密码/Cookie、完整报告正文或连接串。Auth正常登录属于既有会话/审计行为，不当作无任何数据库写入。

## 2. 真实浏览器与母版基准

通过Chrome真实打开原页面；用户浏览器既有admin身份未退出或换号。S08/S10缺少原浏览器课题上下文，使用**原Q01表单**建立题名“R1原布局参照（仅浏览器，不写数据库）”的本机演示课题/方案，只用于渲染现有母版。没有新建数据库Study，没有创建演示任务/报告；不把它当真实数据验收。

1440×900与390×844分别保存两页完整截图及Panel/字段坐标，原页面代码/CSS/布局没有修改：

- [S08桌面完整基准](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/s08-motherboard-1440-full.jpg) · [S08窄屏基准](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/s08-motherboard-390.jpg)。
- [S10桌面基准](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/s10-motherboard-1440.jpg) · [S10窄屏基准](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/s10-motherboard-390.jpg)。
- [坐标与字段记录](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/motherboard-layouts.json)：两视口document宽度等于视口宽度；不是对未来真实数据/新增交互已作视觉验收。

另在**原S06真实工作台**打开admin原报告固定v1，看到“报告v1 · 未审批 · 当前方法快照 · 历史版本只读”、正文、原方案/包版本、已审核资料快照，说明字段禁用，控制台error/warn为空。未点击新建报告、保存说明、执行方法、AI解读或资产操作。

[真实历史报告截图](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/admin-existing-report-v1.jpg) · [浏览器事实记录](evidence/r1-reuse-2026-11-02/rh-r1-20261102-2e80c389/browser-report-check.json)。该截图证明原S06读取能力，不是S10已接线；真实两账号报告服务读取另有API证据。临时视口已恢复，自动测试标签不留作用户入口。

## 3. 测试与构建

新增三个验证脚本，不装配业务Controller/路由：

- `scripts/r1-task-fixtures.mjs`：固定scope/两账号/两条允许字段构造与精确校验。
- `scripts/r1-task-fixtures.test.mjs`：5项行为测试先见RED（未实现），再GREEN，涵盖错命名空间、>2/重复、跨scope/受派人、临床父字段、覆盖不同内容。
- `scripts/r1-reuse-preflight.mjs`：真实原API/PG核对，只有两账号登录及受保护D01创建是显式写；其余GET/readOnly保全，不执行旧初始化/Worker。

执行命令：

```sh
node --test scripts/r1-task-fixtures.test.mjs
node scripts/r1-reuse-preflight.mjs --mode local-synthetic --approved-r1-d01
node --test --test-reporter=spec tests/*.test.mjs src/*.test.mjs scripts/r1-task-fixtures.test.mjs scripts/synthetic-crf-methods-report-contract.test.mjs
pnpm build
```

真实driver两次通过；首轮组合测试164/164通过，收尾对当前共享工作区复验为**165/165**，构建退出0。两次间`tests/pmc-review-content.test.mjs`有其他工作更新，本片未修改该文件或恢复其业务任务，保留并纳入当前回归。保留告警：测试输出`WebSocket server error: Port is already in use`但全部测试通过，未为此停止现有服务或改端口；构建既有大于500kB chunk告警未扩范围修补。项目package.json无统一test脚本，上述覆盖现行tests/src纯前端测试和本片/原方法报告契约，不声称跑了所有历史合成/临床/付费driver。

## 4. 四层状态与剩余门禁

- 代码：只新增验证/fixture工具；S08/S10业务代码尚未实施。
- 目标环境：原本机服务可读，D01两条任务真实存在；无服务重启、角色/表/配置变更。
- 真实执行：原两账号共4个报告固定版GET、两次互读拒绝、PG hash与P01回读通过；原S06浏览器历史报告已观察。
- 业务验收：新S08/S10完整任务链、只读DTO/列表、固定版本/来源回链/分页、真实数据布局对比、1280/320/200%、录屏与用户AC10尚未完成。不能标本片交付或审批/共享/导出可用。

当前没有新增费用/权限/云/远端配置/发布确认项；下一技术步骤是R1-02本人任务有界只读API及其失败测试，继续保持原布局。独立复核与阶段收口记入[实施台账](../planning/own-tasks-method-reports-2026-11-02/implementation-progress.md)。

## 5. 独立评审与同步

`/root/r1_preflight_review`对三个新增验证脚本做唯一独立只读总评审，未发现需阻断R1-01的P0/P1/P2。结论限静态代码，不代签PG/API/浏览器或新页面能力；原评语见[评审记录](../planning/own-tasks-method-reports-2026-11-02/review.md)。本轮living spec、授权状态、台账、产品基线/变更/版本、使用说明、路线/倒排和Notion同步，不改旧技术结论或前序验收记录。
