# H01 Publication Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 用户已指定当前目录串行实施＋独立总评审，规则确认后无需新费用/权限的步骤自动推进；不另开worktree、不自动提交用户已有改动。

**Goal:** H01按已确认广义规则显示当前公开去重纳入论文数量及待核验情况。

**Architecture:** 复用当前public PMC/工作表投影；独立版本化首批证据清单与确定性身份分组，不增加数据库/授权/通用治理模块。

**Tech Stack:** 既有Node/NestJS、PostgreSQL、React/Vite，零新依赖。

**Spec:** `docs/product/h01-publication-count-2026-11-10.md`

## Global Constraints

仅专用合成环境；旧系统、原布局/字号、权利/AI审核、角色不变；不付费、不联网采集、不访问远端配置、不发布。用户广义规则不代签全局领域范围或逐篇管理员批准；不确定保留待核验。

## Review Focus

同DOI但PMCID或题名冲突不能误并；当前来源失效不得沿用旧清单；字段撤回不得引用隐藏正文；边界主题不可被关键词或旧分类器代签；候选增长突破现20/50上限必须null而非静默截断。

### Task 1: 证据清单和去重

Files：新增`server/hub/publication-index.mjs`、`publication-assessments.json`、`publication-index.test.mjs`；记录逐篇理由到规格关联清单。

Interface：`projectPublicationIndex(rows,assessments)`→`{value,pendingVisibleCount,excludedVisibleCount,byType,included,...}`。row为当前公开DTO；assessments默认版本化清单，可在纯单元测试传独立合成样例。

- [ ] 先写真实HTTP论文数9的RED及独立合成DOI/PMCID/冲突/证据单元测试。
- [ ] 最小实现规范化、身份连通分组、证据/版本核对、三态统计。无删除/写数据/AI数值。
- [ ] 运行定向测试至GREEN，保存本轮证据与独立逐篇核对结论。

### Task 2: 当前公开投影接线

Files：修改`server/hub/metrics.mjs`、`pages/shared/HubMetrics.jsx`及其测试，新增`publication-index-pg.test.mjs`。

Interface：`readPublicationIndex({db,tenantId,hubKey})`沿已设置public上下文读；metrics.publications接上Task1结果，原四指标不变。前端原卡仅读数量/待核验。

- [ ] PG回滚测试覆盖当前public→tenant/withheld、版本/内容失效、候选完整性；先RED后接线。
- [ ] HTTP三身份一致、scope/basis/来源可追溯；源读取失败不置0。
- [ ] 组件测试9篇/待核验2、0/null/非法计数，修订原null预期仅限当前已接线分支。

### Task 3: 目标环境与交接

- [ ] 核对本机owned服务和空在途队列，必要时只重启本机独立服务，不动旧服务。
- [ ] 全前端、定向后端/PG、构建；实际HTTP复查9/2/2及原资料/审核指纹。
- [ ] 真实浏览器刷新、匿名及两账号、临床数不变、同视口卡片几何/字号及1280/窄屏，失败/未知Hub恢复。
- [ ] 独立总评修补必要问题；产品/API/说明/测试文档与Notion同步，报告未测边界与专业签认状态。
