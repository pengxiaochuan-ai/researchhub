# 团队维护减负 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 当前目录串行实施，完成后一次独立总评审，不提交其他历史改动。

**Goal:** 原位精简团队填写与审核，减少重复说明、多步选择和技术操作。
**Architecture:** 只组合原目录 API；原生 dialog 承载一次审核确认，原三个资料区不重排。
**Tech Stack:** React / Vite / node:test / 既有 PostgreSQL / Chrome Playwright。
**Spec:** `docs/product/team-maintenance-usability-2026-11-05.md`

## Global Constraints

仅 G02 团队维护；仅专用合成库、原两账号、合成团队私有草稿。无新增权限、表、费用、远端配置、云或发布。当前目录脏树保留、不自动 commit/reset。正文操作14/22、触控目标44px，其他页与公共Token不变。

## Review Focus

- dirty表单审核必须先确认保存成功，失败/未知结果不继续批准。
- 范围切换/取消/切身份/迟到响应不得复用旧可批准预览。
- 已有来源题名按精确标识恢复，新增同源不重复、不自动扩支持项/引用字段。
- 已有人物只读档案与角色可编辑区分，不能静默丢弃新填内容。
- 409恢复保留本地输入/原提交，只有人工明确选择后才采用新基准。

### Task 1: 原位减负与审核闭环

**Files:** `pages/shared/TeamDirectoryWorkbench.jsx`、`TeamWorkspaceFields.jsx`、新 `TeamReviewDialog.jsx`、`ProvinceCitySelect.jsx`、`team-workspace.css`；`src/directory-session.js`、新 `src/team-review-flow.js`；对应 `tests/team-*.test.mjs`。
**Interfaces:** 原 `createDirectoryClient`、workspace/CAS/preview/receipt 不变；新 `prepareTeamReview({client,workspace,data,dirty,audience,requestKey,onSaved})` 仅串联草稿保存与预览，不执行审核。

- [x] 写 SSR/流程/错误映射失败测试并运行，记录 RED。
- [x] 最小实现七项页面调整；保存成功后才预览，确认时才 reviews POST，原未知回执恢复保留。
- [x] 运行针对测试 GREEN，再跑全部前端220/220、相关后端50/50、构建通过。
- [x] 真实浏览器11组、冲突/失效、五视口/原生200%及科研侧4组；不批准真实资料。
- [x] 一次独立总评审，Important一次 RED→GREEN；本地living spec/手册/版本及规则完成。
- [x] 完成Notion增量同步并登记回执，向用户交接四层证据。

## 执行记录

- 2026-11-05：用户已明确“按以上范围一次性精简”，不再次要求选择实施方式。继续原批准的串行＋独立总评审。
- 初查本机页面会话已失效，无可读取的表单输入；本轮不擅自恢复/保存真实团队。实施前先写规格与规则。
- Task 1: complete（当前目录未提交，按既定脏树保全约束；tests220/220、backend50/50、build通过；browser11/11，T01/T02 4/4）。
- Final: fixed Important — 在途审核→身份checking旧框恢复；browser-f9b2e0ed RED→browser-328b8477 GREEN，原key恢复不新增审核。Minor页头文案同步修正。原评审不改称独立再次批准。
- 方法取舍：只组合原API和原生dialog，不增加依赖、表或授权。脚本不持久批准，真实成功事务由原PG回滚验证；UI明确区分故障注入与真实请求。没有其他延后Minor。

## Notion同步回执

本轮规格40f56479ab588146a954f67a0dcf0282；planning目录40f56479ab58816e9d42fda3ec383912、计划40f56479ab5881e387aedbb83136c4dc、评审40f56479ab588156b3cced4c31b62bef；测试40f56479ab58812eab27e7ef9c2b847b。现有AGENTS、UI/UE、验收、基线、产品变更、版本、手册、前端架构、原团队规格/省市规格/API与文档索引均增量更新，无warnings。一次replace_content因工具要求new_str被拒，未改变内容；改用正确参数后成功，不隐去失败。同步不涉及患者/凭证/远端配置。
