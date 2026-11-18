# 团队维护精简与省市选择实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans。用户已明确按方案实施并复测，不重复等待计划确认。

**Goal:** 管理员在精简列表/表单维护团队，省市来自真实PG权威字典。
**Architecture:** 保持目录原子提交/版本/来源守门；只增一个共用只读字典及可选代码字段，表单按原三分区呈现。
**Tech Stack:** 现有React/Vite/Node/PostgreSQL，无新依赖。
**Spec:** ../../product/team-maintenance-refinement-2026-11-04.md

## Global Constraints

仅G02团队维护布局＋共用省市组件/API/字典；其他页面不改，原两账号、专用合成库，真实团队不批准，无AI/付费/云/生产/旧服务。当前目录串行，最终一名独立只读评审；工作树有其他未提交内容，不创建worktree、不提交/重置。原错误证据目录不复用。

## Review Focus

1. 不改其他叶子的导航/提示，团队页数据治理Tab正确、返回可达。
2. 候选分页/已选择机构不能因删除搜索而失联，旧身份迟到选择不回填。
3. 直辖市/省直辖/港澳台不伪造层级，旧文字无损，切省清城市。
4. 字典原件/版本/数据/ACL漂移拒绝，业务角色只能读；旧审核依然必需。
5. 长名称、五视口/200%、焦点/最后操作可达，失败保留输入且无旧预览可提交。

### T1 权威字典与只读接口

Files: server/reference/{divisions.mjs,schema.sql,controller.mjs,divisions.test.mjs}; scripts/reference-divisions-schema.mjs; scripts/local-knowledge.mjs。

- [x] 固定原件SHA、版本/数量/父链解析测试先失败，再实现extractDivisions(html)、listDivisions(tx,parentCode)、resolveLocation(tx,location)；无联网运行时或新依赖。
- [x] 实现单表受控建库/导入/收据/内容与ACL指纹，限定专用库，既有收据不改；真实PG读/拒绝写测试。
- [x] 增只读精确GET与同源客户端；边界/参数/目标环境实际HTTP验证。

### T2 城市选择及原草稿兼容

Files: pages/shared/ProvinceCitySelect.jsx; src/administrative-divisions.js; server/directory/{team-contract.mjs,team-workspace.mjs,contract.mjs}; tests/province-city-select.test.mjs。

- [x] 旧文字/非法父子/清省清市/迟到/错误重试测试先失败，增加可选location与division，保存/预览均PG重验。
- [x] 实现共用两级受控组件，旧文字明确保留不猜测；原子保存及旧资料/权限回归。

### T3 当前页精简

Files: pages/shared/{G02Page.jsx,TeamDirectoryWorkbench.jsx,TeamWorkspaceFields.jsx,team-workspace.css}; src/{platform-shell.js,platform-frontend.js}; server/directory/team-workspace.mjs。

- [x] 增导航作用域/无提示/无重复返回/列表状态/机构下拉及新机构条件输入测试先失败。
- [x] 最小实现与回归；list DTO增加savedAt，不新增业务写权限或默认排序推断。

### T4 真实浏览器、总评审和交接

- [x] 本机重载仅当前独立服务；五视口/200%截图、完整任务链、真实HTTP/PG及网络失败、旧界面回归。
- [x] 唯一只读独立总评审；重要问题作者RED→GREEN一次修补。
- [x] living spec/更新记录/使用说明/API数据库/测试报告与Notion同步；区分技术通过与用户体验认可。

## 进度/裁定

开始：用户已批准全部八项及第8项当前页边界。2024官方原件GET200、3213条已观察；2025入口403，不绕过。使用明确可核验2024版，文案不得称最新。已完成代码与受控单表导入，50后端/212前端/build、最新8组Chrome及4组T01/T02回归通过。七服务ready，base/team-draft/reference v2均existing；5目录主体/19事实/17决定及原账号hash不变。

Ruling：只追加字典v2收据校验列ACL/有效列写权限，原v1保留；无需新GRANT或重导，不把准入检查夸大为持续ACL监控。

Ruling：原生select计算行高normal是平台行为，仍14px/44px，不为字符串断言替换原生交互；失败日志保留。IAB临时viewport实际CSS477，已reset，严格五CSS宽/200%用Chrome独立临时profile验证。

Ruling：第8项内补窄屏空操作容器与JSONB键序假dirty，均先RED后GREEN；仅当前页范围，不修改Frozen Token/其他页面。当前dirty工作树不提交/重置。

## Notion成功回执

2026-11-04全部返回成功且无warnings；只追加本轮内容，不覆盖其他专项。产品规格40e56479ab588157995cfbc0c6a6c7b1；技术40e56479ab5881d49c24d830189787ae；测试40e56479ab588189ac47d4f5c34d29e6；规划目录40e56479ab5881d5bc86d1bbbf61c2b3；计划40e56479ab58811391d6d2cd7c39e72c；唯一评审40e56479ab5881dc87e2e45d4d5d9bd8。已有产品基线/变更/版本/使用说明/前端架构/原团队规格/身份API/数据库和ResearchHub索引分别追加同源段落及页面引用；不上传凭据、原件或临床数据。
