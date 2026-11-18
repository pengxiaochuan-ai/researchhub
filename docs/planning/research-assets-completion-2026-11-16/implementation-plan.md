# 科研资产剩余功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. 主Agent串行，最后一次独立总评；不按任务反复开实施者/评审。

**Goal:** 完成C1–C8产品闭环，保留现有60项能力及原历史，不把具名合成适配当正常产品开放。

**Architecture:** 复用composeAssetCatalog领域服务、原ResearchArtifact/Version、当前授权锁和Sessions/Billing。新business族与旧验收族兼容隔离；rh_asset自有DDL差异先预测后显式应用。以当前Study报告问答为AI首闭环，随后接真实结构字段和领域/通知。

**Tech Stack:** 现有React/Vite、NestJS适配、PostgreSQL/rh_asset、旧科研执行与DeepSeek BYOK，不新增平台/向量服务。

**Spec:** `docs/product/research-assets-completion-spec-2026-11-16.md`；原PRD、60项清单及asset-qa R1同时适用。

## Global Constraints

- 当前目录串行，仅专用合成环境；无临床库/旧服务/历史迁移，不改旧系统源码。
- 保持已确认布局与14/22操作正文；必要布局差异先确认。A02显式长文16/28。
- 不改角色/公共权限模型；管理员按既定本租户业务权限，普通人按当前Study及原按钮权限。
- 模型不碰科学数值；无实际工具/模型执行不得标真实能力完成。
- 新具名写入、DDL差异、AI用途/费用、域目录展示和云/发布各有具体执行停点，不重置旧账本/次数。

## Review Focus

1. 新business准入不能使旧族失去精确保护，也不能让单Study分页上限漏算其他研究；P1验证。
2. 账号/Study失效或source换版后不交付迟到正文/回答/附件；P2/P3/P4验证。
3. 科研审核、材料权利依据、AI用途许可和Hub目录展示互不代替；P3/P5验证。
4. 重复提交/网络丢回包不能重复登记、审核、通知、应用或扣费；P1/P2/P5验证。
5. 真实结构字段缺失须“未检查”，不能用当前合成全缺失适配掩盖未实现；P4验证。

## P0 统一现状与免费准入（0.5天，并入C1，不另加总工期）

**Files:** 本spec/plan/progress；原feature-inventory与product-baseline/product-changes；当前schema/access/family/read/source适配。

**Produces:** AS-01～60当前投影、代码落点、执行许可矩阵及旧对象保护清单。

- [x] 按上轮代码/验收核实八缺口与已完成区域，不重启历史计划。
- [x] 独立只读核实五层JS白名单和实际SQL约束，确认不存在另一套通用资产Service。
- [x] 形成规格与有序计划；旧原件只读，新夹具单列。
- [x] 更新60项现状投影和Notion。

## P1 通用业务登记（C1）

**Files:** 新`server/research-assets/business-access.mjs`、`tests/research-assets-business-access.test.mjs`；后续business-family/迁移；原catalog-access/registration/read/overview/knowledge-sources/uploads及本机装配工厂的精确适配。

**Interfaces:** `authorizeBusinessAssetStudy({tx,user,scope,permission}) -> principal`（调用者持既有授权锁）；后续business族读写复用原DTO，返回assetScope/固定版/当前identityRevision。

- [x] T01 先为非具名普通成员、跨租户/错父/旧authVersion、缺成员/按钮、管理员无须伪造成员写失败测试；实现当前授权纯事务适配，不启用新的DB准入。7项RED→GREEN通过；scope附注不带入权限或身份修订。
- [ ] T02 冻结business key/family、接收人/来源/分页语义；准备rh_asset具体DDL差异与指纹、回滚预测和旧行保护；不删legacy guard。

T02进行中：business新ID/key/完整父链已冻结；登记基础分支完成精确SQL及独立核对，旧事实基线保留。接收人、文件、用途、复用等后续业务分支仍需逐项补齐，不能把基础迁移当作完整C1。
- [ ] T03 按已确认具名清单执行专用PG预测/回滚，再显式迁移；旧27及旧公开容器不回填/升版。
- 2026-11-17：登记基础DDL已完成8份真实app-role写入/延迟约束验证后全部回滚，并仅在专用库显式应用；当前17函数/100约束/14policy/12trigger，旧27份资产及5份受保护来源不变，持久新增资产0。详见evidence/business-schema-applied.json。其余写路径迁移尚未完成。
- [ ] T04 原页面接通正常登记、多份同类、当前/历史版、审核/用途/回收/全局分页；原Study B旧草稿只读，新增事实另算；真实两角色/第三普通身份的可用性与拒绝证据分别记录。

T04首批真实执行通过：两账号A/B各2份共8份、每份2版/6事件；当前与历史版本、私有审核、回收恢复、全局统计及原页浏览器已核。366项资产回归；独立HTTP授权局部评审无阻断。第三普通成员、五类新对象与用途撤回尚未获具体写入许可，T04仍不整体勾选。下一授权清单见[c1-next-admission.md](c1-next-admission.md)。

## P2 产出沉淀与G02（C2/C3）

P1最新：席位增量已批并同事务落实；第三普通成员真实SMTP/原页邀请及五类6份/12版/36事件通过。T04仍未销项：首份方案封存发现上限漏owner，待c1-purpose-version-repair.md单份v3/44事件确认后继续用途链；不切到P2，不改旧封存版。

最新覆盖：单份v3/44事件已批准且原页实际通过，本轮独立核验无必要阻断；本批用满、旧版本及其他对象保持。当前可以按总计划准备P2；已只读核实新方法报告v1及无重复登记，c2-report-source-admission.md限定1资产/2版/6事件与私有G02退回/说明修订/批准，具体新范围确认前只做免费准备。共享入口来源门禁不随本批业务通过而销项。

**Files:** 原`report-asset-context.js`/`ReportAssetRegistration.jsx`/`ReportAssetReview.jsx`/`local-research-assets-report-context.mjs`；新通用source adapter和治理队列；原G02 provider与asset service复用。

**Interfaces:** 固定来源解析器返回 `{kind,id,version,contentHash,locator,rights}`；登记/队列仍引用同一assetId/version，不另造审批模型。

- [ ] T05 真实报告/真实方法运行/知识资料分来源读权和沉淀权测试；重放/并发只登记一次，禁止把方法说明冒充执行结果。
- [ ] T06 在S06/S10/K01原操作区接登记；通用队列可提交/退回/批准和处理用途申请，原A01/A02状态一致；两角色页面闭环及迟到失权验证。

## P3 已审报告Agent问答（C5）

**Files:** 沿既有`docs/planning/research-assets-agent-qa-2026-11-16/implementation-plan.md` AQ01–AQ06；候选`server/research-assets/ai-consent.mjs`/`asset-qa.mjs`、`server/ai-agent/asset-qa-session.mjs`及原A02/AI01区域。

**Interfaces:** 固定证据manifest绑定tenant/Study/asset/version/hash/consentRevision/fragmentId；模型仅返回定性段落和evidenceIds，后端核验并渲染。

- [ ] T07 免费核实R1依据与独立用途承载，先做分片/完整表格/有界检索负例，不默认v3或新向量任务。
- [ ] T08 精确批准后写独立AI用途许可；真实Study Session/Job/Worker最终交付和历史重投影重验，撤销即停止交付。
- [ ] T09 原页进入/追问/固定引用定位/返回，免费未命中0模型；原累计账本及调用次数核清后才提交具体付费提案。
- [ ] T10 获批后两类通用新问题成功、无证据0调用、真实在途撤销及已知用量对账；不自动重试/续额。

## P4 结构化适用性（C6）

**Files:** `research-assets-detail-ai.mjs`、现有applicability/AI契约、research design/execution preparation及方法声明适配；原A02六组区域。

**Interfaces:** 真实结构来源替换当前missingPico/blankConfig输入；每字段带source/version/path和明确缺失状态，保持原六组与人工意见DTO。

- [ ] T11 先覆盖完整/缺失/冲突/单位/源目标换版反例；确定性字段比较不让LLM算数。
- [ ] T12 支持正常获准源/目标、逐项来源、CAS人工意见与历史；真实模型验收并入同一具体预算提案，未获批只免费验证。

## P5 领域目录及通知（C4/C7）

**Files:** 新Hub资产纳入/固定展示适配；原Hub目录区域/查询；原asset_event/许可/撤回、现有通知能力或最小Hub outbox。

**Interfaces:** 目录决定绑定asset/version/component用途，不能产生Study成员或正文/AI权；通知幂等键绑定成功event及当前收件人，读取再验权。

- [ ] T13 先做纳入/移除/到期/撤回和受限摘要负例，原Hub区域展示真实资产；具名新资产及展示范围先确认。
- [ ] T14 审核/申请/许可/撤回影响按成功事件通知；重投不重复，失权不泄私有题名/摘要，不发外部邮件、不删目标草稿。

## P6 窄屏与交付（C8）

**Files:** 原A02页面局部CSS/响应式及技术部署文档；完整端到端脚本/证据/living spec/版本/手册。

- [ ] T15 先提供A02局部响应式/200%对照与必要差异确认，保留七Tab/辅助栏职责；再逐角色实测，不全站改Shell。
- [ ] T16 完整通用样例：登记→审核→领域纳入→Agent问答/六组核对→引用/模板草稿→通知/撤回；原60项逐项标代码/环境/真实执行/业务结果，已完成项做相关回归而非重做。
- [ ] T17 一次独立总评集中修补；准备独立部署包、配置/迁移/回滚和演练记录，不访问云或真实发布。
- [ ] T18 用户专业验收及真实部署确认留为实际外部停点，未经完成不标正式交付。

## 工期、停点与连续执行

剩余约12–17有效工作日＋2天缓冲，P0计入C1。原11月中旬目标已到，此估算不等于获批延期；逐闭环尽快交付，不借技术通过伪造业务完成。

每个任务以RED→GREEN、必要合成PG/真实浏览器及保护证据销项。无新增确认项连续实施；有许可/具名写入/预算/布局/发布停点时，只暂停依赖项，继续独立的免费代码/契约/准备，不静默复活旧预算。
## 2026-11-17 · P2当前覆盖

C2/C3首份新原生报告已完成本机具名链：3来源操作、1资产/2版/6事件，独立评审必要修补和真实浏览器通过。T05/T06仍不整体勾选：其他来源、普通成员和通用用途队列未完成，不把单源技术通过称全量能力。新报告AI用途未授权，不启动模型。[交接与后续清单](c2-delivery-2026-11-17.md)。

