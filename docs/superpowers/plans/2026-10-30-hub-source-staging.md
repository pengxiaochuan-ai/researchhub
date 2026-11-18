# ResearchHub 来源目录与首批隔离导入 Implementation Plan

> **历史方案，已由用户确认的首切片范围取代。** 本文只到 0 展示/0 AI 的技术中间态，不得单独作为实施或业务验收依据。现行合并计划见[来源目录首个纵向交付计划](2026-10-30-hub-source-first-slice.md)。保留本文供原任务拆分与风险追溯，不自动执行其中的“后续独立计划”。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 用户已选择当前目录串行实施＋独立总评审；不得擅自切工作树或启动并行写入。

**Goal:** 在本机专用合成 PG 中建立 ResearchHub 自有来源目录/批次，并将两份工作簿完整、幂等地导入隔离候选区；不公开展示、不供 AI 检索。

**Architecture:** 在共享数据库中只增 ResearchHub 专属 `rh_source` schema，不修改旧 `KnowledgeBase` 或旧公共表。通过有合成环境守门的导入命令把原工作簿的受控快照、批次和行级证据写入 staging；所有记录初始权利未核验、内容未审核，后续审核/展示/AI 另切片。

**Tech Stack:** PostgreSQL、Node.js ESM/Prisma 事务封装、Python 现有 `openpyxl 3.1.5` 仅作本机解析、React/Vite（本片不改 UI）。

**Spec:** [独立来源目录设计](../specs/2026-10-30-hub-source-catalog-design.md)。本计划只实施其中“来源目录＋批次＋全行隔离暂存”，开放全文试点、E01/E02 公开列表/详情与旧知识库独立 Study 是后续独立计划；不得把本计划通过称为完整设计落地。

## Global Constraints

- 当前目录串行实施，结束后一次独立只读总评审；保留全部现有未提交内容，不清理历史测试任务。
- 仅本机专用合成 PostgreSQL；不接临床库、不动旧服务/旧知识库/已有角色与研究权限、不访问远端配置、不创建云资源、不发布。
- 不发起付费 AI 或新增外部请求；先不抓全文。所有原始行保留，包括中文合并表缺题名的 1 行；15,697 是原始行数，15,696 是非空题名数，均非发布数。
- 原文件只有书目字段/摘要而无全文。全部导入到隔离区不等于可公开或可检索；每行初始 `rights_status=unverified`、`review_status=pending`、`display_allowed=false`、`ai_allowed=false`。
- Hub 管理员可本人担任权利核验/内容审核/撤回责任人，或指定并确认其他具名责任人；两种方式均须对具体范围显式操作并留证，不因管理员身份自动审核通过。隔离暂存不需要预先指定具体人，公开展示/AI检索必须有具名人、权利证据和审核记录。任何需要新增权限、费用、云资源、远端配置或发布的动作先停下确认。

## Review Focus

- 文件相同但映射版本不同：创建新批次，不覆盖旧映射；Task 2 测试。
- 导入中途崩溃/超时：事务不留半批，重新执行同幂等键不复制；Task 3 测试。
- 工作簿多来源 sheet：只导入中文“合并”和英文“去重”主表，保存所有 sheet 清单及主表行定位，不把各源 sheet 叠加为额外文献；Task 2/3 测试。
- 空题名、超长摘要和坏 DOI/URL：保留原行和校验错误，不能静默丢弃或提升为规范实体；Task 3 测试。
- 错租户/错 Hub/非合成库：迁移和导入均拒绝，既有旧表/前序行不变；Task 1/3 测试。

---

### Task 1: 专属 schema 与合成目标守门

**Files:**
- Create: `researchhub/server/hub-sources/staging-schema.sql` — 只增 `rh_source.source_registry`、`rh_source.import_batch`、`rh_source.source_record` 三表及必要索引/约束；三表都有 `tenant_id`，批次/记录带 `hub_key`，不依赖旧表写入。
- Create: `researchhub/scripts/hub-source-schema.mjs` — `applyHubSourceSchema({env,expectedDigest,tenantId,hubKey})`；复用 `app/server/scripts/wp01/local-config.mjs` 与 `fixture-guard.mjs` 的只许合成目标校验。
- Test: `researchhub/scripts/hub-source-schema.test.mjs`。

**Interfaces:** `applyHubSourceSchema({env,expectedDigest,tenantId,hubKey}) -> {schemaDigest,tenantId,hubKey}`。`source_registry` 唯一键 `(tenant_id,hub_key,source_key)`；`import_batch` 幂等键 `(tenant_id,hub_key,file_sha256,sheet_name,mapper_version)`；`source_record` 唯一键 `(batch_id,row_number)`，并保存原字段 JSON、行 hash、来源标识、错误 JSON、权利/审核状态和原始版本标识。三表启用且强制 RLS，策略只接收事务内服务端设置的 `app.tenant_id`，新 schema 暂不给普通运行角色增加读取权限；导入器仍逐次显式核验租户/Hub。具体 SQL 默认值与 CHECK 约束按设计稿初始全禁用。若现有专用合成角色无权创建 schema/策略，不提权，停下确认。

- [ ] **Step 1:** 在测试中固定三表/约束、RLS/普通角色无读取授权及默认禁发布值，并断言 SQL 不含对 `public.knowledge_*`、`account`、`tenant` 及旧业务表的 DDL/DML。
- [ ] **Step 2:** 运行 `node --test scripts/hub-source-schema.test.mjs`，确认缺实现导致失败。
- [ ] **Step 3:** 编写只增 SQL 与守门执行器：显式摘要、`assertFixtureTarget`、限定租户/Hub、`lock_timeout=2s`、事务化执行；迁移没有任意目标连接串入口。
- [ ] **Step 4:** 重跑上述测试，再在专用合成库 dry-run/只读预检后仅执行新 schema；用 catalog 查询核对只出现 `rh_source` 新对象，旧表清单/行数摘要不变。
- [ ] **Step 5:** 仅暂存并提交本任务文件；若当前脏工作树中这些文件已被其他工作覆盖，停下处理重叠，不提交别人的改动。

### Task 2: 工作簿解析与可追溯预检

**Files:**
- Create: `researchhub/scripts/hub-source-xlsx.py` — `iter_rows(path, sheet_name)` 以 read-only 模式流式输出每行 JSON；运行时明确使用已核对的本机 `app/skills/.venv/bin/python`，后续部署依赖另列。
- Create: `researchhub/scripts/hub-source-preview.mjs` — `previewWorkbook({filePath,sheetName,sourceKey,mapperVersion}) -> {sha256,sheetNames,rowCount,errors,rows}`，只读文件、无数据库写入。
- Test: `researchhub/scripts/hub-source-preview.test.mjs`；测试可用小型合成 XLSX，不以原文献正确性代替解析单测。

**Interfaces:** `rows` 中每行包含 `rowNumber`、`rawFields`、`rowSha256`、`sourceLabel`、`title`、`doi`、`url`、`validationErrors`；`sourceKey`、工作簿 hash、全部工作表名与 mapperVersion 供 Task 3 原样使用。摘要不截断或补写；空题名/坏标识只登记错误。

- [ ] **Step 1:** 写合成 XLSX 测试：混合中英文、空题名、长摘要、重复 DOI、源 sheet 与主 sheet 并存；断言只读取指定主 sheet 且保留行号、原值、错误和稳定 hash。
- [ ] **Step 2:** 运行 `node --test scripts/hub-source-preview.test.mjs`，确认失败。
- [ ] **Step 3:** 实现只读解析/预检；主表名、18 列映射和来源标签按实际两文件显式配置，不以工作表顺序猜测；不通过 shell 管道向磁盘写中间明文。
- [ ] **Step 4:** 重跑单测并对两份原工作簿只读预检：中文 10,537、英文 5,160 原始行；报告题名、摘要、DOI、URL 与错误计数，不据此推断使用许可。
- [ ] **Step 5:** 仅提交本任务文件及必要合成测试夹具，不提交工作簿副本、明文抽取文件或任何密钥。

### Task 3: 隔离批次导入、幂等与回读

**Files:**
- Create: `researchhub/server/hub-sources/staging-repository.mjs` — `stageBatch({db,tenantId,hubKey,preview,source}) -> {batchId,inserted,existing,errors}`，单事务写来源/批次/所有原始行；禁止把 `display_allowed`/`ai_allowed` 置真。
- Create: `researchhub/scripts/hub-source-import.mjs` — 仅接受具名两文件和显式 `tenantId/hubKey/expectedDigest`，调用预检和合成目标守门，把原工作簿按 SHA-256 复制到仅本机具名、权限受限的 ResearchHub 私有快照目录，不接任意生产连接；目录路径不能作为正式部署存储方案。
- Test: `researchhub/server/hub-sources/staging-repository.test.mjs`；集成测试 `researchhub/scripts/hub-source-import-pg.test.mjs`。

**Interfaces:** 来源目录记录原始数据库/仓储、原始 URL、条款版本、许可证据引用（初始 null）；批次记原件快照键/file SHA-256、全部 sheet、指定主 sheet、mapperVersion、operator、计数/状态；行记 batch+sheet+row、原字段/hash、解析错误、`rights_status=unverified`、`review_status=pending`、版本。快照复制成功且 hash 回验后才能提交批次；失败不得留下“成功”批次，孤立快照须可安全识别和恢复。导入过程不创建规范 Publication 或向量索引。

- [ ] **Step 1:** 写失败测试：重复运行同文件/映射不增行；映射版本变化生成新批；快照 hash 不符或第 N 行故障不留下成功批次；错租户/Hub拒绝；空题名保留为错误行；旧表/历史测试任务摘要不变。
- [ ] **Step 2:** 运行 `node --test server/hub-sources/staging-repository.test.mjs scripts/hub-source-import-pg.test.mjs`，确认失败。
- [ ] **Step 3:** 实现 repository 与具名 CLI，使用既有 `withFixtureTransaction`，在同一事务内设置且校验 `app.tenant_id` 后才访问强制 RLS 表；限制输入路径为本仓库两份文献工作簿，先校验真实 SHA/工作表，再写完整批次；未知结果时先读幂等键，不盲目重试。
- [ ] **Step 4:** 重跑测试，在专用合成库导入两份工作簿各一次并重复一次；回读应为 2 个首版批次、15,697 原始行、0 可展示、0 AI 可检索、0 全文。逐批核对错误/去重候选、旧表/旧租户/历史任务不变。
- [ ] **Step 5:** 仅提交本任务代码及测试；不提交合成库凭证或原始全文。

### Task 4: 四层交接与独立总评审

**Files:**
- Create: `researchhub/docs/testing/hub-source-staging-2026-10-30.md` — 测试命令、合成库标识摘要、两批计数、失败反例、未完成层级和证据路径。
- Modify: `researchhub/docs/product/product-baseline.md`、`researchhub/docs/product/product-changes.md`、`researchhub/docs/product/lingshu-product-prd-v2.0.md`、`researchhub/docs/README.md`、`researchhub/docs/planning/phase1-review-2026-10-19/reverse-schedule.md` — 仅把实际达成的 staging 状态从“目标”改为“本机技术完成”，不修改使用说明书中尚不存在的用户操作。

**Interfaces:** 交接输出分别报告代码、目标环境、本机真实导入、用户可见业务结果四层；末层仍为“未交付”，因为未授权审核/展示/AI。下一切片以本计划的 `batchId`、row hash 和权利状态为输入，不读取旧 KnowledgeBase 当公开源。

- [ ] **Step 1:** 执行相关单元、PG 集成、ResearchHub 构建与旧知识服务回归；任何失败先按当前任务修补，不扩大旧底座。
- [ ] **Step 2:** 在真实浏览器检查 E01/E02 仍明确未接通、无静态演示材料混入真实模式；管理端尚无批次 UI，应明确未交付而非伪造截图。录屏/截图及 API/PG 回读留证。
- [ ] **Step 3:** 请独立只读评审核对租户/Hub隔离、幂等、完整行数、原始证据和旧表保全；作者只对本片问题小修后复验，原评审结论保留。
- [ ] **Step 4:** 更新 living spec、变更/技术/测试文档并同步 Notion；只有四层中已获证据的层级才标通过。
- [ ] **Step 5:** 仅提交本任务文档与证据索引，不提交证据中含有的密钥、邮箱验证码或原始版权内容。

## 后续独立计划与停止条件

1. `P2 审核与展示`：由 Hub 管理员本人审核，或指定并确认其他具名权利核验/内容审核与撤回责任人，提供各来源的公开展示和 AI 用途证据；再设计最小角色授权、版本/撤权、E01/E02 真实列表详情和同源检索。缺证据时只保留 staging，不发布第三方摘要。E01/E02 方法/结果/讨论缺证据必须显示状态，不推写。
2. `P3 开放全文试点`：仅从官方允许的开放 API 选至少 1 篇逐篇确认重用许可；记录许可证/版本/URL/哈希、解析、人工审核和可撤权引用。网络规模化抓取 `DP-01` 另评审，不自动执行。
3. `P4 旧知识库独立 Study`：先确认专用 Study 的归属、具名 ID/成员和原知识权限；随后只在 ResearchHub K01 呈现，不把旧项目历史数据迁入或给公开用户自动赋权。

**工期估计：**本计划 staging 约 2–3 个有效工作日；P2/P3/P4 需要另计，并受权利证据和审核人输入影响。11/04、11/06 关口按“暂存/可展示/可 AI 检索/全文”分别复估；不把 15,697 暂存行计为完成 15 个领域页或 11 月中旬专业验收。

**后续决定：**用户已确认将 `P2` 的管理员审核、E01/E02 真实展示及受权 AI 检索并入首个纵向交付；该决定由新计划承载，本文原 2–3 天 staging 预算不再代表完整切片工期。
