# Hub Token最小闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. 主实施串行，末尾一次独立代码总评审；不分派并行实现。

**Goal:** 在Hub补齐真实消费异常结算及管理员本租户待对账，不改旧系统权限。

**Architecture:** 复用原Billing/Sessions及三张现有账/审计表。Hub持久attempt登记＋新预留保护＋原子结算，自己的租户内控制面及G02叶子，不伪装平台身份。

**Tech Stack:** 现有Node ESM、Nest装配、Prisma/PostgreSQL、React/Vite、node:test与Chrome。

**Spec:** [已确认设计](../specs/2026-11-11-hub-token-reconciliation-design.md)。2026-11-11用户确认第7节局部UI；沿已确认B01–B06顺序，本文件仅细化测试/文件，不新增业务范围。

## Global Constraints

- 只用`wp01_test_full_baseline`；0付费调用，不接临床库、不改旧源码/服务/权限，不增额、充值或发布。
- 旧15笔及未知第12笔不改，旧开发费用/次数门槛不恢复，历史账本保留。
- 当前目录串行，保留他人改动，不批量提交脏目录；新文件及定向差异留证，不自动推送。
- 新Hub调用保护期限为`9999-12-31T00:00:00.000Z`，开始事件提交后才发模型；共同授权→quota→reservation兼容锁→行锁。
- API精确租户及当前身份，GET只读；无可信完整依据不允许结清。G02系统配置叶子＋列表/站内弹窗，不改一级导航。

## Review Focus

- 预留即将到期时开始事件未提交、另一预留并发：不得释放原调用容量（B01/B03真实PG）。
- Provider已完成但最终授权/来源校验失败：扣实际消费但不交付答案（B02/B03）。
- 任一尝试缺用量或结束事件丢失：未知占用不能退款（B02/B03）。
- 提交后响应丢失/不同请求键同时结算：最多一条用量及一次结算（B03/B04）。
- 管理员撤权、切账号、迟到响应：服务端拒绝，界面清私有数据且网络失败不误退出（B04/B05）。

### Task 1: B01复用准入与保护探针

**Files:** Create `server/billing/attempt-protection.mjs`, `server/billing/attempt-protection-pg.test.mjs`; 证据/状态存本计划目录。

**Interfaces:** `protectAttempt(tx,{user,reservationId,attemptId,jobId,sessionId,claim,model})`：同一事务取共同锁、重验归属及有效active、原到期尚未过、封口与重复、写保护和开始审计，返回开始事件；无网络。

- [x] 先写真PG回滚测试：模型开始保护在到期后仍被原quota计入；旧`settleTokenQuotaInTransaction`仍按active成功；跨账号/过期/封口拒绝。
- [x] `node --test server/billing/attempt-protection-pg.test.mjs`先观察缺实现失败，再实现最小函数并运行通过。读取fixture标记，仅新具名事务数据，不修改原账号。
- [x] 核对所有模型出口/claim字段及实际DB权限；不满足持久原子回执或需改旧源码/DDL时停止并提出差异。

### Task 2: B02持久attempt与完整性

**Files:** Create `server/billing/attempts.mjs`, `server/billing/attempts.test.mjs`；Modify `scripts/local-knowledge-ai.mjs`（仅新增接线）。

**Interfaces:** `completeAttempt/unknownAttempt/sealExecution`持久事件；`verifiedUsage(events,binding)`返回完整byModel或明确未知。开始保护消费Task1输出，封口后禁止新尝试。

- [x] 反例先行：多次/混模型、重复/冲突结束、500/缺失用量、回执故障、封口后迟到；校验外层失败不能被Provider早封口冒充成功。
- [x] 运行`node --test server/billing/attempts.test.mjs` RED→GREEN。
- [x] 真实模型出口接线前验证所有分支，禁止未登记出口；本轮网络Provider由替身，不能误计为实际费用。

### Task 3: B03原子结算

**Files:** Create `server/billing/settlement.mjs`, `server/billing/settlement-pg.test.mjs`；Modify Hub Billing装配。

**Interfaces:** `settleFailedExecution(user,reservationId,receipt)`仅原catch触发；成功沿原服务；未知沿原hold。

- [x] 真PG反例先行：原子用量/预留/审计与唯一关联、中途失败全回滚、不同键竞争、在途正常成功不能被抢结算、已知超过预留不截断。
- [x] 运行`node --test server/billing/settlement-pg.test.mjs` RED→GREEN，验证Task1到期跨事务竞争反例。

### Task 4: B04本租户管理API

**Files:** Create `server/billing/service.mjs`, `server/billing/controller.mjs`, `server/billing/controller.test.mjs`及PG测试；在`local-knowledge-ai.mjs`显式装配。

**Interfaces:** `/api/hub-billing/me`及reconciliations列表/详情/resolve；当前角色、isTenantAdmin、authVersion与tenant状态锁内重验，不接供应商钱包或额度分配。

- [x] 测试匿名、普通账号、伪管理员、跨租户、撤权、请求体越权字段、同源与no-store；同键异内容409/相同回执恢复。
- [x] RED→GREEN，真实HTTP及PG核对。无证据记录只有待核实，不可伪释放。

### Task 5: B05管理员叶子与弹窗

**Files:** Create `pages/shared/TokenReconciliation.jsx`, `src/hub-billing-session.js`及组件/客户端测试；Modify `pages/shared/G02Page.jsx`及G02作用域样式/系统配置叶子映射。

**Interfaces:** 当前身份→真实列表→“核对”→证据/一次提交→回读关闭；成功恢复查询/页码/焦点，失败保输入，未知原键核对。使用现有Button/站内Dialog。

- [x] 组件测试先行：无依据禁发、提交中防重复、丢响应、409、取消/Esc/焦点、切身份清理、迟到200与网络恢复。
- [x] `pnpm run build`并真实Chrome双账号、1440/390/320及200%截图录屏，不点真实模型发送。

### Task 6: B06总评审与交接

**Files:** 更新本计划进度、`docs/testing/hub-token-accounting-2026-11-11.md`及product对应文档/使用说明/版本/Notion。

- [x] 跑相关单元、真PG、原Billing回归、`node --test tests/*.test.mjs`、构建及实际UI/API回读。
- [x] 一次独立代码总评审，重要项作者RED→GREEN修补，保留原结论与全部失败，不复签冒称。
- [x] 记录四层交付与未完成项；不把零付费替身冒称新真实模型验收，不把本机称生产启用。
