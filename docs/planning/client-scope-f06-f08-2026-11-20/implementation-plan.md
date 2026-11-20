# F06 成果进入 Hub 并复用实施计划

> For agentic workers: 使用已确认的子 Agent 分工逐项实施，主 Agent 负责共享装配、集成、独立复核与验收。

**Goal:** 固定版本成果经作者提交、管理员纳入 Hub 后，由未加入源课题的成员取得单资产用途许可，在自己有创建权限的另一课题生成私有方案草稿，并可撤回后阻止新增使用。

**Architecture:** 新增独立 Hub 目录、用途许可和操作回执。复用现有固定资产来源核查和原生方案草稿服务；同一事务重新核对当前身份、源链、许可和目标权限，不放宽原 Study 权限。

**Tech Stack:** 现有 ESM / NestJS 装配、PostgreSQL 事务与 RLS、React / 共享组件、Node test 和真实 Chrome。

**Spec:** `docs/product/f06-f08-hub-knowledge-map-spec-2026-11-20.md` V0.2；用户确认方案 A，当前仅实施 F06。

## 全局约束

- 仅纳入固定版本，默认 hub内部成员可见；目录可见不等于正文、引用或复制许可。
- 跨课题许可不增加源 Study 成员权；目标必须重新核对当前 `artifact.create`。
- 原路径、Frozen Shell、现有同课题复用保持；仅 H01、G02、A02 获批局部增量。
- 现有个人课题草稿保留，不新建个人知识库；不启动 F07/F08、AI 恢复、生产迁移或真实资料发布。
- 共享脏工作区只修改本任务文件和精确装配点，独立测试实例不用 19501/19502。
- 四层分别举证：代码、环境启用、真实请求、业务结果；合成材料清晰标识，用户验收不得代签。

## 复核重点

1. 当前角色/停用/Hub成员资格变化使旧页面及迟到请求失效；测试不以邮箱判断角色。
2. 固定正文或上游来源撤回后，旧目录链接和许可不能继续交付正文及新副本。
3. 相同请求键重复提交仅产生一次结果；丢响应通过原键核对，键与不同载荷冲突拒绝。
4. 审核/撤回并发及过期按当前 revision 和数据库时间判断；合法历史成果保留。
5. 真实接收者源 Study membership 为零；目标草稿在另一 Study，仅本人可见，记录固定来源。

## Task 1：持久化目录、许可与服务

**Owner:** f06_inventory；仅 `server/hub-assets/` 新文件。

**Interfaces:** `createHubAssetsService({transact,tenantId,hubKey,lockAuthorization,resolveSource,createTarget})`，控制器冻结于 `/api/hubs/lingshu-xinyu/assets`。写操作携带 `{base:{requestKey,expectedRevision}}`，返回 entry、receipt 与可选目标结果；原键通过 `/operations/:key` 核对。

- [x] 先写契约/状态/授权失败测试，执行得到目标功能不存在的失败。
- [x] 实现目录、申请、审核、撤回、用途许可、正文、引用和跨课题复制事务及精确 SQL 权限函数。
- [x] 真实 PostgreSQL 验证约束、RLS、CAS、幂等、角色失效、源链失效和撤回；不可用函数不静默降级。

## Task 2：原生来源与目标装配

**Owner:** 主 Agent；`server/research-runtime/assets.mjs`、`main.mjs`，必要的现行迁移/打包清单与专项测试。

**Interfaces:** `assets.hubBridge.resolveSource(tx,user,ref)` 以当前用户原课题授权读取固定资产；`createTarget(tx,user,input)` 以当前目标权限调用原生 `ResearchArtifactsService.create`，返回真实 artifactId / studyId / version。

- [x] 测试非作者/错误源范围/错误版本/无目标创建权必须拒绝；不借管理员或 owner 身份。
- [x] 解析 scope IDs 后在同一应用事务重新授权，复用完整来源核验；新血缘标记不进入旧同课题复用 reader。
- [x] 装配 Hub 控制器与现行认证、成员、同源和请求大小保护；构建且测试完整 HTTP 状态。

## Task 3：最小页面接线

**Owner:** f07_inventory 新增 client/组件，主 Agent 接入 H01、G02、A02 和 Hub 导航。

**Files:** `src/hub-asset-client.js`、`tests/hub-asset-client.test.mjs`、`pages/shared/HubAssetCatalog.jsx`、`hub-asset-catalog.css`；现有 `RealHub.jsx`、`G02Page.jsx`、`GovernanceOverview.jsx`、`ResearchAssetCatalogDetail.jsx`、`src/platform-shell.js` 精确局部修改。

- [x] 客户端先测试原键回执核对、身份变更丢弃迟到响应和受限信息不回退演示内容。
- [x] 实现目录详情、审核与作者操作，按服务端能力展示，常规流程一个主动作，共享按钮与站内弹窗。
- [x] H01 仅资产页签分流，G02 保留原资产审核，A02 仅新增纳入区域；Study 导航原 A01 不变。
- [x] Chrome 验证进入→找对象→核对→提交→结果→返回、失败输入保留、键盘、窄屏和原生 200%。

## Task 4：真实闭环与交付文档

**Owner:** 主 Agent；独立评审由完成实现后的 Agent 只读复核。

- [x] 独立临时 PG 和完整运行时创建全新合成作者、管理员、接收者及两个 Study；保存合成数据声明。
- [x] 固定资产→提交→管理员纳入→接收者申请→作者许可→正文/引用→另一 Study 私有方案草稿→撤回阻止新增，真实 HTTP 与双角色浏览器均执行。
- [x] 验证匿名、非成员、跨租户、无目标权、源撤回、许可过期、并发和丢响应；记录源成员数为零及数据库真实目标/回执。
- [x] 构建、相关单元/集成、界面截图与录屏留痕；独立审查修复后复验。
- [x] 同步 living spec、产品基线/变更/版本、统一用户验证手册、客户审查报告和 Notion 原页；明确本机结果与生产未部署边界。

提交仅包含本任务已复核文件或精确差异；用户未另行要求时不推送共享脏分支。

完成口径：本轮原创固定成果基础链在独立合成环境验证通过，派生来源/生产/用户签收保留，不能扩大为全部来源已完成。实际证据与原失败见docs/testing/f06-hub-assets-2026-11-20.md。
