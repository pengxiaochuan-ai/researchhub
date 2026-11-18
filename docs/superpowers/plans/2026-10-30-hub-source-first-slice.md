# ResearchHub 来源目录首个纵向交付 Implementation Plan

> **2026-10-30 最新：** 用户本轮要求的旧科研 Agent 会话/模型执行链→Hub 检索已在本机适配层接通；独立只读总评审指出的自然问句、最终提交租户上下文、撤审竞态、历史连接数及授权到期判断缺口已按合成 PG/免费替身测试修补，26/26 相关测试与两账号修补后 Chrome 通过。下方“尚未接通”为此前检查点。真实第三方来源 0 审核、报价/费用门禁阻断新增付费调用，**真实模型回答和首切片业务验收仍未完成**；Task 5–8 未勾选的非演示来源及专业验收不因此自动销项。详见[本轮验证](../../testing/hub-agent-session-2026-10-30.md)。

> 2026-10-30 最新执行关口：Task 1–4 的准入、暂存和审核服务端已完成；Task 5–8 的授权投影、G02/E01/E02 真实模式及只读 AI 检索适配已完成本机合成技术验证，真实 Chrome 空态/拒绝/缩放已留证。**第三方工作簿仍 0 审核决定，未出现真实非演示来源，旧科研 Agent 模型回答尚未接通/验收，所以首切片业务验收未完成。** 管理员需本人核实具体来源、字段、用途权利后再显式审核。下方各 Task 未勾选步骤保留为尚缺的真实来源或专业验收，不以合成夹具替代。详见[本机实测](../../testing/hub-source-first-slice-2026-10-30.md)。

> 后续本机小步（2026-10-30）：Hub 检索证据的片段、四类审核版本及引用元数据已加当前重验；合成 PG 回滚事务内以目标应用角色验证获准检索与撤回拒绝，独立审查两项 Important 已由作者按测试修补。旧 `OrchestratorService` 的知识会话、工具执行和最终发布仍只认私有 Study KB，不能将 Hub 结果直接伪装成 `kb_search` 命中；Task 8 的真实 Agent 接线、非演示来源及业务验收继续未勾选。下一步须在 ResearchHub 自有适配层明确 Hub 会话/来源类型与提交重验点，不改旧内核或扩大权限；收费 Provider 调用仍另行核价确认。

> **2026-10-30 用户本轮目标：** 接通旧科研 Agent 的会话与模型执行链到 Hub 检索。最小实现为独立 `hub:lingshu-xinyu` 会话上下文，沿用旧会话队列、Agent Access、计费/发布事务和旧 Orchestrator；ResearchHub 适配层仅把旧内核固定 `kb_search` 工具槽映射到独立 `hub_source_search` 结果，持久化来源类型为 `hub-reviewed-publication`，不读取或标记成 Study KB 文档。仅两原合成账号和当前合成 Study；新会话不得复用私有 KB 历史。工具返回、模型请求前、模型响应后、assistant 原子提交和历史/来源读取均按当前账号、租户、Hub、审核版本与片段哈希重验。无获准来源、失权或撤回一律阻断而不调用/交付模型。免费替身可验证实际编排路径，真实 Provider 调用和专业答案验收仍须另获费用确认。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已选择当前目录串行实施＋一次独立只读总评审；不得擅自切 worktree 或并行写共享文件。

**Goal:** 在本机专用合成环境贯通“两份工作簿 15,697 原始行隔离暂存 → Hub 管理员显式审核 → 获准字段 E01/E02 真实展示 → 同一授权判断下供 AI 检索”；暂存不算业务交付。

**Architecture:** 只增 ResearchHub 自有 `rh_source` schema 和本项目 API/界面适配，不修改旧 KnowledgeBase、旧公共表或旧服务。原始行不可变，审核决定追加版本；列表、详情和 AI 检索共享一个服务端有效授权投影，读取前重验租户、Hub、字段用途与撤回状态。先完成书目/摘要纵向闭环；工作簿不含全文，开放全文小试点和规模化抓取不纳入本切片完成定义。

**Tech Stack:** PostgreSQL/RLS、现有 Node ESM 本机装配、Python `openpyxl` 只读解析、React/Vite、现有科研 Agent 检索边界。

**Spec:** [独立来源目录设计](../specs/2026-10-30-hub-source-catalog-design.md)。原[仅暂存计划](2026-10-30-hub-source-staging.md)为历史参考，不再单独执行或验收。

## Global Constraints

- 仅当前目录串行、本机专用合成库与具名新夹具；不得接临床库、碰旧服务/历史任务或修改旧角色、研究权限和共享底座。数据库迁移先做目标摘要/旧表保全，任何非合成目标直接拒绝。
- Hub 管理员**本人可审核**，也可指定其他具名责任人；角色身份本身不自动通过。审核动作记录操作者、具体来源/批次/字段/用途、依据链接或受控凭据引用、版本、时间和撤回。当前合成 `admin@example.org` 是否具有相应 Hub 管理授权，先按现有服务端权限核对；缺授权不暗授。
- 15,697 是原始行，不是可见或 AI 可检索数。中文缺题名的 1 行和权利不明/审核未通过记录始终隔离；元数据、摘要、全文的展示与 AI 用途分别判定。审核可按权利证据同质的来源/批次执行，并允许逐条排除；不因来源名称、DOI 或工作簿在本地就推定许可。
- 无付费模型调用、充值、云资源、远端配置访问或真实发布。只读/确定性 AI 检索集成可以先验证；若必须发起新的收费 Provider 请求证明真实回答，先核价、核累计预算和次数后另请确认，不能用模拟回答宣称第四层通过。
- E01/E02 保留母版与公共 Shell，真实模式只呈现获准事实；方法、结果、评级、引用网络无来源时显示缺失状态，不沿用固定演示。G02 只增加有界来源审核入口，不开放正式研究审批。阅读 16/28、操作 14/22，按 UI/UE V1.1 检查桌面、手机、键盘和实际 200% 缩放。

## Review Focus

1. 同批不同来源/字段许可混杂：批量审核不能越过来源与字段边界；T04/T05 测试。
2. 审核后撤回、失权或旧请求迟到：列表/详情/AI 不交付旧正文，缓存不复活；T05/T06/T08 测试。
3. 重复 DOI、缺题名、坏 DOI/URL、不同映射版本：保留原行，不能静默合并或发布错误行；T02/T03 测试。
4. 导入中断/响应丢失/重复执行：不能出现半批或重复行，未知结果先查幂等键；T03 测试。
5. 真实模式页面脱离服务/跨账号/跨租户：明确失败或无权限，不回退演示来源；T07/T08 测试。

---

### Task 1: 合成目标、现有权限与受影响入口准入

**Files:** Modify `docs/technical/local-knowledge-runtime.md`（仅记录核对结果）；Test `scripts/hub-source-admission.test.mjs`。

**Interfaces:** 输出不可写的准入摘要：目标库指纹、租户/Hub 标识、旧表/历史任务摘要、现有管理员权限核对、E01/E02/G02 真实模式路由和本机 Agent 检索入口；不输出密钥或工作簿正文。

- [x] **Step 1:** 写拒绝临床/未知库、错误租户、错误 Hub、无管理授权的失败用例；运行 `node --test scripts/hub-source-admission.test.mjs` 见 RED。
- [x] **Step 2:** 复用现有 fixture guard 和目标摘要，做只读 PG/代码核对；运行同命令见 GREEN。原库无 Hub 授权，停下取得用户具名批准后仅增 ResearchHub 自有授权事件并复核。
- [x] **Step 3:** 记录受影响页面与两账号/未受邀账户的原始状态；不把历史计划的“下一步”自动恢复为本轮任务。

### Task 2: 专属持久化与工作簿预检

**Files:** Create `server/hub-sources/schema.sql`、`scripts/hub-source-schema.mjs`、`scripts/hub-source-xlsx.py`、`scripts/hub-source-preview.mjs`；Test `scripts/hub-source-schema.test.mjs`、`scripts/hub-source-preview.test.mjs`。

**Interfaces:** `previewWorkbook({filePath,sheetName,sourceKey,mapperVersion})` 输出文件 SHA-256、全 sheet 清单、主表行号/原值/行 hash/校验错误；迁移只增 `rh_source` 的来源、批次、原始行、规范候选/来源关联及追加审核决定/字段用途对象，全部带租户/Hub 边界和强制 RLS。规范候选默认一原始行一候选；重复仅标人工候选，不静默合并。

- [x] **Step 1:** 先写合成 XLSX 与 schema 契约测试，覆盖长摘要、空题名、坏 URL/DOI、重复 DOI、默认全禁用/RLS和旧表 DDL 禁入；运行两测试见 RED。
- [x] **Step 2:** 实现显式主 sheet 的只读预检、只增迁移；运行两测试见 GREEN，并只读预检得到中文 10,537、英文 5,160 原始行。预检函数允许合成测试文件，真正导入器负责锁定两份批准路径/hash。
- [x] **Step 3:** 仅在通过 Task 1 的专用合成库事务执行迁移，回读新表/策略与旧表摘要；迁移角色具备原有 CREATE 权限，未提权。

### Task 3: 全行隔离导入与幂等

**Files:** Create `server/hub-sources/staging-repository.mjs`、`scripts/hub-source-import.mjs`；Test `server/hub-sources/staging-repository.test.mjs`、`scripts/hub-source-import-pg.test.mjs`。

**Interfaces:** `stageBatch({db,tenantId,hubKey,preview,source}) -> {batchId,inserted,existing,errors}`；两份受控文件快照先验 hash，再在一个批次事务写原始行与错误，`display_allowed=false`、`ai_allowed=false`；同文件/主表/映射版本/范围重跑返回原批次。

- [x] **Step 1:** 写重复、不同映射版本、故障回滚、坏行保留、跨租户/Hub与旧表保全测试；运行见 RED。
- [x] **Step 2:** 实现快照和批量事务导入；运行见 GREEN。真实合成 PG 导入与重跑回读为 2 个首版批次、15,697 原始行、0 可展示、0 AI 可检索，旧表/历史任务不变；首次英文批次超时回滚后以 ResearchHub 专用同连接守门续验。
- [x] **Step 3:** 已保存字段完整率、错误和候选重复统计；来源 sheet 未重复计数，暂存明确不是上线。

### Task 4: 管理员审核与撤回的服务端闭环

**Files:** Create `server/hub-sources/review-service.mjs`、`server/hub-sources/review-controller.mjs`；Modify `scripts/local-knowledge.mjs`（仅本机路由装配）；Test `server/hub-sources/review-service.test.mjs`、`server/hub-sources/review-controller.test.mjs`。

**Interfaces:** 有界批次/来源或行级审核 API；请求必须明确书目/摘要（全文本片不填）的 `display`、`ai_retrieval` 用途、依据引用和确认数量，按当前管理授权与对象版本 CAS 追加决定；撤回追加新决定，不能覆盖旧证据。源批次同质范围可一键确认，错误/异常行永不随批次批量放行。

- [x] **Step 1:** 先写无授权/空依据/混合来源/越范围/版本 CAS/错误行/撤回测试，运行见 RED。
- [x] **Step 2:** 实现审核服务与只限现有获授权 Hub 管理员的本机路由，运行见 GREEN；两账号、未受邀和跨租户真实 HTTP 负例通过。
- [x] **Step 3:** 审核真实材料前必须由管理员本人或其指定者录入用途权利证据；当前第三方工作簿 0 审核决定，仍隔离。无新增管理权限。

### Task 5: 共用的可见/可检索授权投影

**Files:** Create `server/hub-sources/visible-repository.mjs`、`server/hub-sources/read-controller.mjs`；Modify `scripts/local-knowledge.mjs`（仅本机只读路由装配）；Test `server/hub-sources/visible-repository.test.mjs`、`server/hub-sources/read-controller.test.mjs`。

**Interfaces:** `listVisible({principal,hubKey,filters,cursor})`、`getVisible({principal,hubKey,recordId})`、`retrieveForAi({principal,hubKey,query,limit})` 统一以当前租户/Hub、记录校验、最新审核决定及字段用途生成最小投影。AI 返回不可变记录/版本/hash、实际获准片段位置与 DOI/来源链接；不返回隔离字段。

- [x] **Step 1:** 写已准书目但摘要未准、只准展示不准 AI、撤回/过期、跨租户/Hub、分页排序、同 DOI 异源等测试，运行见 RED。
- [ ] **Step 2:** 实现服务端共享判断与有界查询；运行见 GREEN。合成 PG 用至少一条具有效权利证据且实际审核的非演示来源验证读/检索，未获准行保持 0 泄漏。
- [x] **Step 3:** 记录 `staged_rows`、`approved_display_records`、`approved_ai_records` 三个独立计数与审核版本；无结果显示真实空态，不以 15,697 充当结果数。

### Task 6: 管理端批次/审核工作台

**Files:** Modify `pages/shared/G02Page.jsx`、`pages/shared/g02.css`、`src/real-mode-route.js`；Create `src/hub-source-api.js`；Test `tests/hub-source-admin-ui.test.mjs`。

**Interfaces:** G02 真实模式中仅出现有当前管理授权的来源入口；列表查看批次/错误/去重候选、查看证据和每字段用途、显式确认审核范围/数量、查看决定历史并撤回。未授权用户看不到审查正文，API 仍独立拒绝；原治理样页只保留显式演示模式。

- [x] **Step 1:** 写无权限/混合来源禁止批量、确认范围可读、撤回/慢请求/提交失败保输入/重复提交测试，运行见 RED。
- [ ] **Step 2:** 实现局部真实 UI，复用公共 Shell/Button 和字号角色；运行见 GREEN，真实 Chrome 完成管理员批次→审核→撤回并录屏/截图。

### Task 7: E01/E02 真实文献列表、详情与来源

**Files:** Modify `pages/e01/src/main.jsx`、`pages/e02/src/main.jsx`、局部 `style.css`、`src/real-mode-route.js`、`src/page-linking.js`；Test `tests/hub-source-evidence-ui.test.mjs`。

**Interfaces:** E01 按“应用筛选”读取已准列表与真实计数，打开 E02 带安全 recordId；E02 重新请求当前获准版本，显示书目、已准摘要、真实来源/审核范围/原文状态，未提供的方法/结果/评级明确缺失。真实模式不得把固定 JAMA 示例、演示引用或假 AI 解读回退到页面；显式演示模式不变。

- [x] **Step 1:** 写匿名/未审/失权/无结果/服务失败/慢筛选乱序/长标题与无全文测试，运行见 RED。
- [ ] **Step 2:** 实现真实分支与精确路由；运行见 GREEN，两个合成账号和未受邀账号真实 Chrome 核对列表→详情→来源、返回筛选、手机/200%/键盘，PNG/WebM 留证。

### Task 8: AI 检索接线与整链验收

**Files:** Create `server/hub-sources/agent-retrieval.mjs`；Modify `scripts/local-knowledge.mjs`（只加本机控制器/检索工具装配）；Test `server/hub-sources/agent-retrieval.test.mjs`、`scripts/hub-source-e2e.test.mjs`；Create `docs/testing/hub-source-first-slice-2026-10-30.md`。

**Interfaces:** 只将 `retrieveForAi` 当前获准片段及来源标识送入既有科研 Agent 检索入口；源撤回/失权后工具返回空或受限，不能让旧会话缓存继续交付。无付费许可时仅证明检索工具真实请求与过滤，不生成“模型已回答”或“业务已验收”的结论。

- [x] **Step 1:** 写工具真实输入/未审/撤回/在途失权/来源版本与数值不补造测试，运行见 RED。
- [ ] **Step 2:** 实现最小接线并运行见 GREEN；用专用合成 PG 的新审核来源完成管理→E01/E02→检索工具全链、旧知识库与历史测试任务保全。若要真实付费 Agent 回答，先按费用/次数门禁另请确认。
- [ ] **Step 3:** 完成相关单元、PG集成、旧知识回归、`pnpm run build`、真实浏览器截图/录屏；请一次独立只读总评审。作者只在本片内修补并复验，原评审结论保留。
- [ ] **Step 4:** 同步产品 living spec/变更/使用说明、API/数据库/前端架构/测试记录及 Notion。分别报告代码、目标环境、真实请求和专业用户结果；用户未签专业验收不宣称完成四层。

## Checkpoints、工期与停止条件

- **C1（Task 1–3，约 2–3 有效工作日）：** 15,697 行可追溯隔离入库；0 可展示/0 AI 只是技术检查点，不能交付给用户作为初始内容。
- **C2（Task 4–5，约 1–2 日）：** Hub 管理员可显式审核/撤回，授权投影复用；若两份工作簿缺具体用途权利证据，只能用已核准开放来源验证放行，第三方摘要仍隔离。
- **C3（Task 6–8，约 2–3 日）：** G02→E01/E02→AI 检索工具同源联调、浏览器与独立总评审。合计初估 **6–8 有效工作日**，审核依据迟到或新增授权/付费确认等待另计；11/04、11/06 按真实进度复估 11 月中旬目标。
- **首切片技术验收：** 两批 15,697 原始行、错误行保留且旧库不变；至少一条获准的全新非演示来源在 E01/E02 与 AI 检索工具可回查，未审/撤回/跨租户 0 泄漏；可见/可检索数单独显示。此下限只证明闭环，不代表领域内容覆盖率或用户专业验收。管理员随后按来源/批次确认可放行规模，不能由开发者预设 15,697 全部可用。
- **必须停下确认：** 新增管理权限/角色、真实 Provider 付费调用或超原预算、云资源、远端配置访问、旧服务停线/改造、生产迁移与真实发布；不得以计划获批代替这些逐项授权。

## Not in this slice

开放全文逐篇许可试点、DP-01 规模化网络采集、其余领域页、旧知识库独立 Study 初始化、正式审批/发布/导出与全一期 AI 专业验收仍单列；不因首切片通过自动销项。
