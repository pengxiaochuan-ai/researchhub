# R1源码与环境核对 · 2026-11-02

本轮只有规格/授权核对。页面/API/角色/数据库业务记录均未修改；本机PG查询显式READ ONLY。未运行历史fixture/serve/init脚本、模型或旧服务。

## 1. 证据表

| 文件/定位 | 事实/设计后果 |
| --- | --- |
| `pages/shared/WorkflowPages.jsx:47,51` | TaskBoard两Panel＋三列表单/任务列表/状态select/访视入口；Outputs表单/复核checkbox/产出列表/资产按钮。原S10不含选中阅读/历史控件，因此I01–I03须在规格显式申请，不能借“保持布局”偷改交互 |
| `src/real-mode-route.js`、`pages/shared/workflow-main.jsx` | S08/S10未接真实业务；demo保留母版不能算真实页面已还原/接线完成 |
| `src/study-overview-route.js:36`起 | S01只允许少数已接入口，研究执行/科研产出还没有真实导航映射；本片只接原槽位，不新增一级导航 |
| `scripts/my-research-overview.mjs:2,18–55` | P01当前任务：workbench、活跃成员/角色/项目、assignee本人、acceptanceFixture:false、open/in_progress/blocked；同tx授权锁和authVersion校验可复用 |
| `../app/server/src/study-operations/study-operations.controller.ts:435–439,674–695` | 旧tasks GET菜单workbench，mine参数可切宽列表；写接口另有feature/study.configure/execute，不应为只读申请这些权限 |
| `../app/server/src/study-operations/study-operations.service.ts:603,2026–2070` | mine还包含协作者/本人创建未分派，返回subject、依赖备注等；不能直接用于Hub本片最窄口径，也不应返回整行对象 |
| `../app/server/src/study-operations/study-operations-policy.ts:47–54` | 任务五状态open/in_progress/blocked/completed/cancelled，原UI仅三中文演示状态不能直接覆盖 |
| `../app/server/prisma/schema.prisma:1636`起 | StudyTask已有版本、受派账号、scope、Fixture字段，无需建表/迁移 |
| `scripts/local-research-plans.mjs:26–35,158–159` | 报告父链读继承两账号/Study、当前authVersion、knowledge/workbench/artifacts、chat.use＋artifact.read；不能只看artifact.read就宣称全链可读 |
| `scripts/local-synthetic-edc.mjs:17–22,40,82` | 读取也继承WP06 capture门禁；包需本人、前缀及plan归属，不因只读绕过既有门禁 |
| `scripts/local-crf-methods.mjs:17–45,100–107` | WP07 scope及Agent/Skill/session/feature、真实冻结记录包/方法结果必须完整；inRun可同事务复用，无需执行Worker |
| `scripts/local-crf-methods-reports.mjs:8–36,58–67` | 指定报告族/本人、fixed version、seal/事实/文本hash/nativeSources校验；inReport复用现有tx，stale与restricted不同；原read可能canEdit:true，新只读DTO不可继承该动作 |
| `scripts/synthetic-crf-methods-report-contract.mjs:3,20–28` | 真实marker与确定性报告渲染，原正文含不可变版本与已审核资料快照；不由LLM重写，不丢血缘 |
| `src/crf-methods-session.js` | 已有方法报告GET与历史1–30版路径，但没有Study级报告只读目录；不能把旧可编辑S06整页当只读S10 |

## 2. 安全只读PG核对方法与结果

使用既有`loadFixtureInput`读取已批准本地配置路径（不打印连接串），先`assertFixtureTarget`校验专用库marker/syntheticOnly，再`withFixtureTransaction(env,'direct',...,{readOnly:true})`核对固定tenant/group/project/两个account的必要布尔值和数量。未dump正文/密码/Token/临床数据；配置中的旧库原连接仅由已有helper解析生成**专用测试库**URL，实际数据库连接目标不是aisci。

结果见[授权清单](authorization-scope.md)及[机器快照](authorization-snapshot.json)：tenant和两账号关联状态均active；workbench/artifacts/read具备，任务0/0，报告候选12/8，feature/access/Skill候选计数1/1/1。本机wp07-scope启用、R03存在；wp06-scope启用。10:00Z补核两账号knowledge/chat.use、精确SkillAssignment和research Agent均匹配。原文件未修改。没有逐份读报告、登录、调用未开发R1 API或做本轮浏览器实测；不得把本记录称成能力验收通过。

任务为空意味着需要精确D01夹具授权；报告候选充足不意味着都能过当前源门禁。报告角色仍继承Agent/Skill/session/资料校验是**已存在约束**，本片不为“只读简化”拆掉。新权限、重建报告或重批准来源不在本片默认范围。

## 3. 风险与取舍

- 原S10创建式母版与只读目录职责存在真实交互差异：以I01–I03明确申请，外观区域不重组；若用户不批准则仅保留原位受限，不伪称报告可选读。
- 无独立S08/S10 PNG，用原实现同视口截图留证，原图确认由Codex负责，用户不重复代做技术盘点。
- 不使用通用Artifact list或旧任务全量GET；不新增数据库模型、全局能力矩阵、排空控制或共享底座。
- 不改旧报告来造stale/损坏反例；使用新具名或回滚测试输入，无法做真实持久撤权时列出缺口并另确认。
- 本轮检索发现两处猜测路径不存在，已改用实际文件：旧policy是`study-operations-policy.ts`，报告契约是`synthetic-crf-methods-report-contract.mjs`。未因此执行初始化或恢复旧计划。
- 独立规格复核指出旧报告与方法链403有复用错误码，无法仅凭code区分整体验权和单对象来源受限。规格已补新适配层显式阶段分类，无法分类整页失败；不改旧内核，也不把未知403吞为空态。

## 4. 文档与验证交接

[独立评审](review.md)保留原意见与作者修订，未称新API已测试。Notion对应目录为[本片规划包](https://app.notion.com/p/40c56479ab58812480d3caa8d327e380)，产品[规格](https://app.notion.com/p/40c56479ab58815ea215c6877271fe74)、[授权](https://app.notion.com/p/40c56479ab58818499c7debd26004024)、[计划](https://app.notion.com/p/40c56479ab5881f78731ec0d9164d974)、[源码证据](https://app.notion.com/p/40c56479ab58816d9af6dffa21df3c55)、[评审](https://app.notion.com/p/40c56479ab5881f2b3b7d569ab574573)均已同步，无warnings；既有文档只追加当前状态，保留原章节/子页。

本轮验证仅覆盖文档相对链接、规格AC/授权项/计划一致性、JSON快照结构及空白检查和两次专用PG只读核对。没有新代码、构建、业务/浏览器验收、任务夹具或付费调用；不得以本次文档验证代替实施后的AC01–10。
